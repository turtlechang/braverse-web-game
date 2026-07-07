import { useEffect, useRef, useState } from 'react'
import type {
  CookieCard,
  CookieInBattle,
  GameCommand,
  GameState,
  PlayerId,
  PlayerState,
  SupportCard,
} from '../game'
import {
  getAfterDamageEffectCandidates,
  getAfterDamageEffectMinMax,
  getBlockerCandidates,
  getCurrentReplacementTask,
  getFaintEffectCandidates,
  getFaintEffectMinMax,
  getPendingDecision,
  getReplacementCandidates,
  getRefreshCandidates,
  getTrapCandidates,
  getTrapTargetCandidates,
  getTrashBattleCookieCostCandidates,
  hasBlockingPending,
  isPlayerControllingState,
  selectEnergyPayment,
} from '../game'
import { useMatchAnimations } from './useMatchAnimations'
import { useBattleActions, type DispatchGameCommand } from './useBattleActions'
import { getPendingChoicePlayerId } from './useMatchController'

const opponentOfId = (playerId: PlayerId): PlayerId =>
  playerId === 'player-one' ? 'player-two' : 'player-one'

/**
 * 線上對戰版的戰場控制 hook,對應本地 useMatchController 的「純粹從 game
 * 推導」那部分(各種 candidate 清單、選取狀態)——資料來源是伺服器送來的
 * 遮罩版 GameState,而不是本地自行維護的 reducer 狀態。不重建本地特有的
 * 部分(牌組選擇/RPS/AI wiring/resetMatchState/loadScenarioState),因為
 * 配對與開局已經由伺服器與 OnlineMatchPanel 處理掉了。
 *
 * dispatch 在這裡只把 command 送到伺服器,不在本地套用、不等待同步結果——
 * onSuccess callback 仍會呼叫,但拿到的是送出當下的 game(不是套用後的
 * nextGame),因為線上模式沒有同步結果可用。目前唯一依賴 onSuccess 的既有
 * 呼叫端(useBattleActions 的 clearAttacker)不讀取傳入值,所以這樣是安全的。
 */
export function useOnlineMatchController(params: {
  game: GameState
  viewerPlayerId: PlayerId
  sendCommand: (command: GameCommand) => void
}) {
  const { game, viewerPlayerId, sendCommand } = params
  const opponentId = opponentOfId(viewerPlayerId)
  const activePlayer = game.players[game.activePlayerId]

  const [message, setMessage] = useState('對局已開始。')
  const [selectedTrapId, setSelectedTrapId] = useState<string | null>(null)
  const [selectedTrapDiscardIds, setSelectedTrapDiscardIds] = useState<
    string[]
  >([])
  const [selectedTrapTrashBattleCookieIds, setSelectedTrapTrashBattleCookieIds] =
    useState<string[]>([])
  const [trapSelectNoTarget, setTrapSelectNoTarget] = useState(false)
  const [selectedTrapTargetId, setSelectedTrapTargetId] = useState<string | null>(null)
  const [pendingResponseMode, setPendingResponseMode] = useState<'trap' | 'blocker' | null>(null)
  const [selectedBlockerId, setSelectedBlockerId] = useState<string | null>(null)
  const [selectedFlipDiscardIds, setSelectedFlipDiscardIds] = useState<
    string[]
  >([])
  const [selectedFaintTargetIds, setSelectedFaintTargetIds] = useState<
    string[]
  >([])
  const [selectedAfterDamageTargetIds, setSelectedAfterDamageTargetIds] =
    useState<string[]>([])
  const [selectedOpponentDiscardIds, setSelectedOpponentDiscardIds] =
    useState<string[]>([])

  const animations = useMatchAnimations()
  const previousGameRef = useRef(game)
  useEffect(() => {
    animations.observeTransition(previousGameRef.current, game)
    previousGameRef.current = game
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game])

  const dispatch: DispatchGameCommand = (command, successMessage, onSuccess) => {
    const commands = Array.isArray(command) ? command : [command]
    for (const cmd of commands) {
      sendCommand(cmd)
    }
    setMessage(successMessage)
    onSuccess?.(game)
  }
  const battleActions = useBattleActions({ game, dispatch })

  const handleAdvancePhase = () => {
    dispatch(
      { kind: 'advance-phase', playerId: viewerPlayerId },
      '階段已推進。',
    )
    battleActions.clearAttacker()
    setSelectedFaintTargetIds([])
  }

  // 活躍/抽牌階段沒有玩家操作可做,自動推進——比照本地 useMatchController
  // 的同名邏輯,只是改成把 advance-phase 送到伺服器而不是本地套用。
  useEffect(() => {
    if (
      game.status !== 'playing' ||
      game.activePlayerId !== viewerPlayerId ||
      (game.phase !== 'active' && game.phase !== 'draw') ||
      hasBlockingPending(game)
    ) {
      return
    }

    const timer = window.setTimeout(() => {
      dispatch(
        { kind: 'advance-phase', playerId: viewerPlayerId },
        game.phase === 'active'
          ? '活躍動作已自動完成。'
          : '抽牌已自動完成，進入支援階段。',
      )
    }, 350)

    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game, viewerPlayerId])

  // 沒有陷阱/Blocker 可回應時自動略過——比照本地版本的同名邏輯。
  useEffect(() => {
    const battle = game.pendingBattle
    if (
      battle?.stage !== 'trap' ||
      battle.defenderPlayerId !== viewerPlayerId ||
      getTrapCandidates(game, viewerPlayerId).length > 0 ||
      getBlockerCandidates(game, viewerPlayerId).length > 0
    ) {
      return
    }

    const timer = window.setTimeout(() => {
      setSelectedTrapId(null)
      setSelectedTrapDiscardIds([])
      setSelectedTrapTargetId(null)
      dispatch(
        { kind: 'skip-trap', playerId: viewerPlayerId },
        '未發動回應，進入傷害結算。',
      )
    }, 0)

    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game, viewerPlayerId])

  // Faint
  const pendingFaint =
    game.pendingFaintEffects && game.pendingFaintEffects.length > 0
      ? game.pendingFaintEffects[0]
      : null
  const faintSourceCard = pendingFaint
    ? (() => {
        for (const player of Object.values(game.players) as PlayerState[]) {
          const found =
            player.breakArea.find(
              (cookie: CookieCard) => cookie.instanceId === pendingFaint.sourceInstanceId,
            ) ??
            player.battleArea.find(
              (cookie: CookieInBattle) =>
                cookie.card.instanceId === pendingFaint.sourceInstanceId,
            )?.card
          if (found) return found
        }
        return null
      })()
    : null
  const faintCandidates =
    pendingFaint && pendingFaint.sourcePlayerId === viewerPlayerId
      ? getFaintEffectCandidates(game)
      : []
  const faintTargetIds = new Set(
    faintCandidates.map((cookie) => cookie.card.instanceId),
  )
  const hasFaint =
    Boolean(pendingFaint && pendingFaint.sourcePlayerId === viewerPlayerId)
  const faintMinMax = pendingFaint
    ? getFaintEffectMinMax(pendingFaint.effect)
    : { min: 0, max: 0 }
  const currentPendingDecision = getPendingDecision(game)

  // After-damage
  const pendingAfterDamage =
    game.pendingAfterDamageEffects && game.pendingAfterDamageEffects.length > 0
      ? game.pendingAfterDamageEffects[0]
      : null
  const afterDamageSourceCard = pendingAfterDamage
    ? (() => {
        for (const player of Object.values(game.players) as PlayerState[]) {
          const found =
            player.breakArea.find(
              (cookie: CookieCard) =>
                cookie.instanceId === pendingAfterDamage.sourceInstanceId,
            ) ??
            player.battleArea.find(
              (cookie: CookieInBattle) =>
                cookie.card.instanceId === pendingAfterDamage.sourceInstanceId,
            )?.card
          if (found) return found
        }
        return null
      })()
    : null
  const afterDamageCandidates =
    pendingAfterDamage &&
    pendingAfterDamage.sourcePlayerId === viewerPlayerId
      ? getAfterDamageEffectCandidates(game)
      : []
  const afterDamageTargetIds = new Set(
    afterDamageCandidates.map((cookie) => cookie.card.instanceId),
  )
  const hasAfterDamage =
    Boolean(
      pendingAfterDamage &&
      pendingAfterDamage.sourcePlayerId === viewerPlayerId &&
      currentPendingDecision?.kind === 'after-damage-effect',
    )
  const afterDamageMinMax = pendingAfterDamage
    ? getAfterDamageEffectMinMax(pendingAfterDamage.effect)
    : { min: 0, max: 0 }

  // Trap
  const playerTrapCandidates =
    game.pendingBattle?.stage === 'trap' &&
    game.pendingBattle.defenderPlayerId === viewerPlayerId
      ? getTrapCandidates(game, viewerPlayerId)
      : []
  const selectedTrap = playerTrapCandidates.find(
    (card) => card.instanceId === selectedTrapId,
  )
  const selectedTrapPaymentIds = selectedTrap?.trap
    ? selectEnergyPayment(
        selectedTrap.trap.cost.energy ?? selectedTrap.trap.cost,
        game.players[viewerPlayerId].supportArea,
      ) ?? []
    : []
  const selectedTrapDiscardCost = selectedTrap?.trap?.cost.discardHand ?? 0
  const selectedTrapTrashBattleCookieCost =
    selectedTrap?.trap?.cost.trashBattleCookie?.count ?? 0
  const selectedTrapTrashBattleCookieCandidates = selectedTrap?.trap
    ? getTrashBattleCookieCostCandidates(
        selectedTrap.trap.cost,
        game.players[viewerPlayerId].battleArea,
      )
    : []
  const selectedTrapDiscardCandidates = selectedTrap
    ? game.players[viewerPlayerId].hand.filter(
        (card) =>
          card.instanceId !== selectedTrap.instanceId &&
          (!selectedTrap.trap?.cost.discardHandColor ||
            card.energyColor === selectedTrap.trap.cost.discardHandColor),
      )
    : []
  const trapAllowEmptyTarget =
    selectedTrap?.trap?.effects.some(
      (effect) =>
        (effect.kind === 'damage' ||
          effect.kind === 'modify-attack' ||
          effect.kind === 'prevent-knockout') &&
        (effect.target.min ?? 0) === 0,
    ) ?? false
  const trapTargetCandidates =
    selectedTrap && !trapSelectNoTarget
      ? getTrapTargetCandidates(
          game,
          viewerPlayerId,
          selectedTrap.instanceId,
        )
      : []
  const attackerInstanceId = game.pendingBattle?.attackerInstanceId ?? null
  const selectedTrapTarget = selectedTrapTargetId
    ? trapTargetCandidates.find(
        (candidate) => candidate.card.instanceId === selectedTrapTargetId,
      )
    : attackerInstanceId
      ? trapTargetCandidates.find(
          (candidate) => candidate.card.instanceId === attackerInstanceId,
        )
      : undefined
  const selectedTrapTargets = selectedTrapTarget
    ? [selectedTrapTarget]
    : trapTargetCandidates.slice(0, 1)
  const selectedTrapSupportTrashIds =
    selectedTrap?.trap?.effects.some(
      (effect) => effect.kind === 'support-to-trash',
    )
      ? game.players[viewerPlayerId].supportArea
          .slice(0, 1)
          .map((support: SupportCard) => support.card.instanceId)
      : []

  // Blocker
  const playerBlockerCandidates =
    game.pendingBattle?.stage === 'trap' &&
    game.pendingBattle.defenderPlayerId === viewerPlayerId
      ? getBlockerCandidates(game, viewerPlayerId)
      : []
  const selectedBlocker = playerBlockerCandidates.find(
    (cookie) => cookie.card.instanceId === selectedBlockerId,
  )
  const selectedBlockerPaymentIds = selectedBlocker?.card.skill
    ? selectEnergyPayment(
        selectedBlocker.card.skill.cost.energy ?? selectedBlocker.card.skill.cost,
        game.players[viewerPlayerId].supportArea,
      ) ?? []
    : []

  const replacementTask = getCurrentReplacementTask(game)
  const viewerControlsState = isPlayerControllingState(game, viewerPlayerId)

  const pendingPlayerId = getPendingChoicePlayerId(game, replacementTask)
  const pendingPlayer = pendingPlayerId ? game.players[pendingPlayerId] : null
  const pendingOptions = game.pendingRefresh
    ? getRefreshCandidates(game, game.pendingRefresh.playerId)
    : pendingPlayer
      ? getReplacementCandidates(game, pendingPlayer.id)
      : []

  return {
    game,
    viewerPlayerId,
    opponentId,
    activePlayer,
    message,
    setMessage,
    dispatch,
    handleAdvancePhase,
    selectedAttackerId: battleActions.selectedAttackerId,
    setSelectedAttackerId: battleActions.setSelectedAttackerId,
    selectedAttackPaymentIds: battleActions.selectedAttackPaymentIds,
    setSelectedAttackPaymentIds: battleActions.setSelectedAttackPaymentIds,
    handleAttackTarget: battleActions.handleAttackTarget,
    toggleAttackPayment: battleActions.toggleAttackPayment,
    clearAttacker: battleActions.clearAttacker,
    selectedAttacker: battleActions.selectedAttacker,
    selectedAttackCost: battleActions.selectedAttackCost,
    attackPaymentValidation: battleActions.attackPaymentValidation,
    // Trap
    selectedTrapId,
    setSelectedTrapId,
    selectedTrapDiscardIds,
    setSelectedTrapDiscardIds,
    selectedTrapTrashBattleCookieIds,
    setSelectedTrapTrashBattleCookieIds,
    trapSelectNoTarget,
    setTrapSelectNoTarget,
    playerTrapCandidates,
    selectedTrap,
    selectedTrapPaymentIds,
    selectedTrapDiscardCost,
    selectedTrapDiscardCandidates,
    selectedTrapTrashBattleCookieCost,
    selectedTrapTrashBattleCookieCandidates,
    trapAllowEmptyTarget,
    trapTargetCandidates,
    attackerInstanceId,
    selectedTrapTargetId,
    setSelectedTrapTargetId,
    selectedTrapTargets,
    selectedTrapSupportTrashIds,
    // Blocker
    selectedBlockerId,
    setSelectedBlockerId,
    playerBlockerCandidates,
    selectedBlockerPaymentIds,
    pendingResponseMode,
    setPendingResponseMode,
    // Flip
    selectedFlipDiscardIds,
    setSelectedFlipDiscardIds,
    // Faint
    selectedFaintTargetIds,
    setSelectedFaintTargetIds,
    pendingFaint,
    faintSourceCard,
    faintCandidates,
    faintTargetIds,
    hasFaint,
    faintMin: faintMinMax.min,
    faintMax: faintMinMax.max,
    // After-damage
    selectedAfterDamageTargetIds,
    setSelectedAfterDamageTargetIds,
    pendingAfterDamage,
    afterDamageSourceCard,
    afterDamageCandidates,
    afterDamageTargetIds,
    hasAfterDamage,
    afterDamageMin: afterDamageMinMax.min,
    afterDamageMax: afterDamageMinMax.max,
    // Opponent discard
    selectedOpponentDiscardIds,
    setSelectedOpponentDiscardIds,
    // Animation
    attackShakeId: animations.attackShakeId,
    damageFlashId: animations.damageFlashId,
    faintAnimIds: animations.faintAnimIds,
    drawAnimIds: animations.drawAnimIds,
    // Derived
    pendingPlayer,
    pendingOptions,
    viewerControlsState,
    replacementTask,
  } as const
}
