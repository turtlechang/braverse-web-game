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
  buildReplayIssueBundle,
  getAfterDamageEffectCandidates,
  getAfterDamageEffectMinMax,
  getBlockerCandidates,
  getCurrentReplacementTask,
  getFaintEffectCardCandidates,
  getFaintEffectCandidateLabel,
  getFaintEffectCandidates,
  getFaintEffectMinMax,
  getDiscardHandCostCandidates,
  getSupportEffectCandidates,
  getPendingDecision,
  getReplacementCandidates,
  getRefreshCandidates,
  getTrapCandidates,
  getTrapTargetCandidates,
  getTrapSelfTargetCandidates,
  getTrashBattleCookieCostCandidates,
  getTrashToDeckCandidates,
  getEnergyCostTotal,
  hasBlockingPending,
  isEnergyColorCompatibleWithCost,
  isPlayerControllingState,
  selectEnergyPayment,
  validateEnergyPayment,
} from '../game'
import { useMatchAnimations } from './useMatchAnimations'
import { useBattleActions, type DispatchGameCommand } from './useBattleActions'
import { getPendingChoicePlayerId } from './useMatchController'
import { registerIssueBundleProvider } from './issueBundleSource'

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
  const [selectedTrapHandToBreakIds, setSelectedTrapHandToBreakIds] = useState<
    string[]
  >([])
  const [selectedTrapDiscardIds, setSelectedTrapDiscardIds] = useState<
    string[]
  >([])
  const [selectedTrapTrashBattleCookieIds, setSelectedTrapTrashBattleCookieIds] =
    useState<string[]>([])
  const [trapSelectNoTarget, setTrapSelectNoTarget] = useState(false)
  const [selectedTrapTargetId, setSelectedTrapTargetId] = useState<string | null>(null)
  const [selectedTrapSelfTargetId, setSelectedTrapSelfTargetId] = useState<string | null>(null)
  const [selectedTrapSupportTrashIds, setSelectedTrapSupportTrashIds] = useState<string[]>([])
  const [pendingResponseMode, setPendingResponseMode] = useState<'trap' | 'blocker' | null>(null)
  const [selectedBlockerId, setSelectedBlockerId] = useState<string | null>(null)
  const [selectedFlipDiscardIds, setSelectedFlipDiscardIds] = useState<
    string[]
  >([])
  const [selectedFaintTargetIds, setSelectedFaintTargetIds] = useState<
    string[]
  >([])
  const [selectedFaintPaymentIds, setSelectedFaintPaymentIds] = useState<
    string[]
  >([])
  const [selectedFaintCostHandIds, setSelectedFaintCostHandIds] = useState<
    string[]
  >([])
  const [selectedFaintCostSupportIds, setSelectedFaintCostSupportIds] = useState<
    string[]
  >([])
  const [selectedAfterDamageTargetIds, setSelectedAfterDamageTargetIds] =
    useState<string[]>([])
  const [selectedOpponentDiscardIds, setSelectedOpponentDiscardIds] =
    useState<string[]>([])
  const [selectedOpponentRestSupportIds, setSelectedOpponentRestSupportIds] =
    useState<string[]>([])
  const [selectedPlaceHandHpId, setSelectedPlaceHandHpId] = useState<
    string | undefined
  >(undefined)

  const animations = useMatchAnimations()
  const previousGameRef = useRef(game)
  useEffect(() => {
    animations.observeTransition(previousGameRef.current, game)
    previousGameRef.current = game
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game])

  // 註冊問題包 provider 給 GameErrorBoundary。線上 game 已是伺服器遮罩版，
  // builder 的 online 模式會再遮罩一次（防禦性）並強制 initialState 為 null；
  // 牌組識別線上端不可知，failedCommand 由伺服器拒絕（command-rejected，
  // 見 known-risks R14）尚未回流 UI，先維持 null。
  useEffect(() => {
    registerIssueBundleProvider((errorSummary) =>
      buildReplayIssueBundle({
        state: game,
        mode: 'online',
        viewerId: viewerPlayerId,
        decks: { playerOne: 'unknown', playerTwo: 'unknown' },
        errorSummary,
      }),
    )
  }, [game, viewerPlayerId])

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
    setSelectedFaintPaymentIds([])
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
    if (battle?.stage === 'damage') {
      const damagePlayerId = battle.damagePlayerId ?? battle.defenderPlayerId
      if (damagePlayerId !== viewerPlayerId) return

      const timer = window.setTimeout(() => {
        dispatch(
          { kind: 'resolve-next-damage', playerId: viewerPlayerId },
          '正在結算傷害。',
        )
      }, 500)

      return () => window.clearTimeout(timer)
    }

    if (
      battle?.stage !== 'trap' ||
      // 陷阱已經打出去了（例如 BS3-093），戰鬥還停在 'trap' 階段只是為了等玩家
      // 確認 reveal-top-deck 的巢狀效果——getTrapCandidates 在 trapUsed 之後
      // 一律回傳空陣列，不代表「沒有陷阱可用該自動略過」，見 useMatchController.ts
      // 同名效果的註解。
      battle.trapUsed ||
      battle.defenderPlayerId !== viewerPlayerId ||
      getTrapCandidates(game, viewerPlayerId).length > 0 ||
      getBlockerCandidates(game, viewerPlayerId).length > 0
    ) {
      return
    }

    const timer = window.setTimeout(() => {
      setSelectedTrapId(null)
      setSelectedTrapDiscardIds([])
      setSelectedTrapHandToBreakIds([])
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
  const faintCardCandidates =
    pendingFaint && pendingFaint.sourcePlayerId === viewerPlayerId
      ? getFaintEffectCardCandidates(game)
      : []
  const faintTargetIds = new Set(
    faintCandidates.map((cookie) => cookie.card.instanceId),
  )
  const hasFaint =
    Boolean(pendingFaint && pendingFaint.sourcePlayerId === viewerPlayerId)
  const faintMinMax = pendingFaint
    ? getFaintEffectMinMax(game, pendingFaint.effect)
    : { min: 0, max: 0 }
  const faintEnergyCost =
    pendingFaint?.effect.kind === 'hand-to-battle'
      ? pendingFaint.effect.energyCost ?? {}
      : {}
  const faintEnergyCostTotal = getEnergyCostTotal(faintEnergyCost)
  const faintCostHandAmount = pendingFaint?.cost?.discardHand ?? 0
  const faintCostSupportAmount = pendingFaint?.cost?.supportToTrash ?? 0
  const faintCostHandCandidates =
    pendingFaint && pendingFaint.sourcePlayerId === viewerPlayerId
      ? getDiscardHandCostCandidates(
          pendingFaint.cost ?? {},
          game.players[viewerPlayerId].hand,
          pendingFaint.sourceInstanceId,
        )
      : []
  const faintCostSupportCandidates =
    pendingFaint && pendingFaint.sourcePlayerId === viewerPlayerId &&
    faintCostSupportAmount > 0
      ? getSupportEffectCandidates(game, pendingFaint.context).map(
          (support) => support.card,
        )
      : []
  const faintPaymentCandidates =
    pendingFaint &&
    pendingFaint.sourcePlayerId === viewerPlayerId &&
    faintEnergyCostTotal > 0
      ? game.players[viewerPlayerId].supportArea
          .filter((support) => {
            if (support.rested) return false
            if (selectedFaintPaymentIds.includes(support.card.instanceId)) {
              return true
            }
            if (selectedFaintPaymentIds.length >= faintEnergyCostTotal) {
              return false
            }
            return isEnergyColorCompatibleWithCost(
              faintEnergyCost,
              support.card.energyColor,
            )
          })
          .map((support) => support.card)
      : []
  const faintPaymentValid =
    faintEnergyCostTotal === 0 ||
    validateEnergyPayment(
      faintEnergyCost,
      game.players[viewerPlayerId].supportArea,
      selectedFaintPaymentIds,
    ).valid
  const toggleFaintPayment = (instanceId: string) => {
    if (faintEnergyCostTotal === 0) return
    setSelectedFaintPaymentIds((current) => {
      if (current.includes(instanceId)) {
        return current.filter((id) => id !== instanceId)
      }
      if (current.length >= faintEnergyCostTotal) return current
      if (!faintPaymentCandidates.some((card) => card.instanceId === instanceId)) {
        return current
      }
      return [...current, instanceId]
    })
  }
  const toggleFaintCostHand = (instanceId: string) => {
    if (faintCostHandAmount === 0) return
    setSelectedFaintCostHandIds((current) => {
      if (current.includes(instanceId)) return current.filter((id) => id !== instanceId)
      if (current.length >= faintCostHandAmount) return current
      if (!faintCostHandCandidates.some((card) => card.instanceId === instanceId)) {
        return current
      }
      return [...current, instanceId]
    })
  }
  const toggleFaintCostSupport = (instanceId: string) => {
    if (faintCostSupportAmount === 0) return
    setSelectedFaintCostSupportIds((current) => {
      if (current.includes(instanceId)) return current.filter((id) => id !== instanceId)
      if (current.length >= faintCostSupportAmount) return current
      if (!faintCostSupportCandidates.some((card) => card.instanceId === instanceId)) {
        return current
      }
      return [...current, instanceId]
    })
  }
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
  const [selectedTrapPaymentIds, setSelectedTrapPaymentIds] = useState<string[]>([])
  const trapEnergyCost =
    selectedTrap?.trap?.cost.energy ?? selectedTrap?.trap?.cost ?? {}
  const trapEnergyCostTotal = getEnergyCostTotal(trapEnergyCost)
  const trapPaymentCandidates =
    trapEnergyCostTotal > 0
      ? game.players[viewerPlayerId].supportArea.filter((support) => {
          if (support.rested) return false
          return isEnergyColorCompatibleWithCost(
            trapEnergyCost,
            support.card.energyColor,
          )
        })
      : []
  const trapPaymentTargetIds = new Set(
    trapPaymentCandidates.map((support) => support.card.instanceId),
  )
  const trapPaymentValid = validateEnergyPayment(
    trapEnergyCost,
    game.players[viewerPlayerId].supportArea,
    selectedTrapPaymentIds,
  ).valid
  const toggleTrapPayment = (instanceId: string) => {
    setSelectedTrapPaymentIds((current) => {
      if (current.includes(instanceId)) {
        return current.filter((id) => id !== instanceId)
      }
      if (current.length >= trapEnergyCostTotal) return current
      const candidate = game.players[viewerPlayerId].supportArea.find(
        (support) =>
          support.card.instanceId === instanceId && !support.rested,
      )
      if (
        !candidate ||
        !trapPaymentCandidates.some(
          (support) => support.card.instanceId === candidate.card.instanceId,
        )
      ) {
        return current
      }
      const next = [...current, instanceId]
      if (next.length === trapEnergyCostTotal) {
        return validateEnergyPayment(
          trapEnergyCost,
          game.players[viewerPlayerId].supportArea,
          next,
        ).valid
          ? next
          : current
      }
      return next
    })
  }
  const selectedTrapDiscardCost = selectedTrap?.trap?.cost.discardHand ?? 0
  const selectedTrapTrashBattleCookieCost =
    selectedTrap?.trap?.cost.trashBattleCookie?.count ?? 0
  const selectedTrapTrashBattleCookieCandidates = selectedTrap?.trap
    ? getTrashBattleCookieCostCandidates(
        selectedTrap.trap.cost,
        game.players[viewerPlayerId].battleArea,
      )
    : []
  const selectedTrapHandToBreakCost =
    selectedTrap?.trap?.cost.handToBreakArea?.count ?? 0
  const selectedTrapHandToBreakCandidates = selectedTrap
    ? game.players[viewerPlayerId].hand.filter(
        (card) =>
          card.instanceId !== selectedTrap.instanceId &&
          card.type === 'cookie' &&
          (!selectedTrap.trap?.cost.handToBreakArea?.energyColor ||
            card.energyColor ===
              selectedTrap.trap.cost.handToBreakArea.energyColor),
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
          effect.kind === 'damage-by-break-count' ||
          effect.kind === 'modify-attack' ||
          effect.kind === 'modify-attack-by-break-count' ||
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
  const trapSelfTargetCandidates =
    selectedTrap && !trapSelectNoTarget
      ? getTrapSelfTargetCandidates(game, viewerPlayerId, selectedTrap.instanceId)
      : []
  const selectedTrapSelfTarget = selectedTrapSelfTargetId
    ? trapSelfTargetCandidates.find(
        (candidate) => candidate.card.instanceId === selectedTrapSelfTargetId,
      )
    : undefined
  const selectedTrapSelfTargets = selectedTrapSelfTarget
    ? [selectedTrapSelfTarget]
    : trapSelfTargetCandidates.slice(0, 1)
  const trapSupportTrashEffect = selectedTrap?.trap?.effects.find(
    (effect) => effect.kind === 'support-to-trash',
  )
  const trapSupportTrashAmount =
    trapSupportTrashEffect?.kind === 'support-to-trash'
      ? trapSupportTrashEffect.amount
      : 0
  const trapSupportTrashCandidates =
    trapSupportTrashAmount > 0
      ? game.players[viewerPlayerId].supportArea.map(
          (support: SupportCard) => support.card,
        )
      : []

  const toggleTrapSupportTrash = (id: string) => {
    if (!trapSupportTrashCandidates.some((card) => card.instanceId === id)) {
      return
    }
    setSelectedTrapSupportTrashIds((current) =>
      current.includes(id)
        ? current.filter((cId) => cId !== id)
        : current.length < trapSupportTrashAmount
          ? [...current, id]
          : current,
    )
  }

  const [selectedTrapSupportToHandIds, setSelectedTrapSupportToHandIds] = useState<string[]>([])
  const trapSupportToHandEffect = selectedTrap?.trap?.effects.find(
    (effect) => effect.kind === 'support-to-hand',
  )
  const trapSupportToHandAmount =
    trapSupportToHandEffect?.kind === 'support-to-hand'
      ? trapSupportToHandEffect.amount
      : 0
  const trapSupportToHandCandidates =
    trapSupportToHandAmount > 0
      ? game.players[viewerPlayerId].supportArea.map(
          (support: SupportCard) => support.card,
        )
      : []
  const toggleTrapSupportToHand = (id: string) => {
    if (!trapSupportToHandCandidates.some((card) => card.instanceId === id)) {
      return
    }
    setSelectedTrapSupportToHandIds((current) =>
      current.includes(id)
        ? current.filter((cId) => cId !== id)
        : current.length < trapSupportToHandAmount
          ? [...current, id]
          : current,
    )
  }
  const [selectedTrapHandToSupportIds, setSelectedTrapHandToSupportIds] = useState<string[]>([])
  const trapHandToSupportEffect = selectedTrap?.trap?.effects.find(
    (effect) => effect.kind === 'hand-to-support',
  )
  const trapHandToSupportAmount =
    trapHandToSupportEffect?.kind === 'hand-to-support'
      ? trapHandToSupportEffect.amount
      : 0
  const trapHandToSupportCandidates =
    trapHandToSupportAmount > 0
      ? game.players[viewerPlayerId].hand.filter(
          (card) => card.instanceId !== selectedTrap?.instanceId,
        )
      : []
  const toggleTrapHandToSupport = (id: string) => {
    if (!trapHandToSupportCandidates.some((card) => card.instanceId === id)) {
      return
    }
    setSelectedTrapHandToSupportIds((current) =>
      current.includes(id)
        ? current.filter((cId) => cId !== id)
        : current.length < trapHandToSupportAmount
          ? [...current, id]
          : current,
    )
  }
  const [selectedTrapTrashToDeckIds, setSelectedTrapTrashToDeckIds] = useState<string[]>([])
  const trapTrashToDeckEffect = selectedTrap?.trap?.effects.find(
    (effect) => effect.kind === 'trash-to-deck',
  )
  const trapTrashToDeckAmount =
    trapTrashToDeckEffect?.kind === 'trash-to-deck'
      ? trapTrashToDeckEffect.max
      : 0
  const trapTrashToDeckCandidates =
    trapTrashToDeckEffect?.kind === 'trash-to-deck' && selectedTrap
      ? getTrashToDeckCandidates(
          game,
          { sourcePlayerId: viewerPlayerId, sourceInstanceId: selectedTrap.instanceId },
          trapTrashToDeckEffect,
        )
      : []
  const toggleTrapTrashToDeck = (instanceId: string) => {
    if (!trapTrashToDeckCandidates.some((card) => card.instanceId === instanceId)) {
      return
    }
    setSelectedTrapTrashToDeckIds((current) =>
      current.includes(instanceId)
        ? current.filter((id) => id !== instanceId)
        : current.length < trapTrashToDeckAmount
          ? [...current, instanceId]
          : current,
    )
  }

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
    attackPaymentTargetIds: battleActions.attackPaymentTargetIds,
    clearAttacker: battleActions.clearAttacker,
    selectedAttacker: battleActions.selectedAttacker,
    selectedAttackCost: battleActions.selectedAttackCost,
    attackPaymentValidation: battleActions.attackPaymentValidation,
    // Trap
    selectedTrapId,
    setSelectedTrapId,
    selectedTrapDiscardIds,
    setSelectedTrapDiscardIds,
    selectedTrapHandToBreakIds,
    setSelectedTrapHandToBreakIds,
    selectedTrapTrashBattleCookieIds,
    setSelectedTrapTrashBattleCookieIds,
    trapSelectNoTarget,
    setTrapSelectNoTarget,
    playerTrapCandidates,
    selectedTrap,
    selectedTrapPaymentIds,
    setSelectedTrapPaymentIds,
    trapPaymentCandidates,
    trapPaymentTargetIds,
    trapPaymentValid,
    trapEnergyCostTotal,
    toggleTrapPayment,
    selectedTrapDiscardCost,
    selectedTrapDiscardCandidates,
    selectedTrapHandToBreakCost,
    selectedTrapHandToBreakCandidates,
    selectedTrapTrashBattleCookieCost,
    selectedTrapTrashBattleCookieCandidates,
    trapAllowEmptyTarget,
    trapTargetCandidates,
    attackerInstanceId,
    selectedTrapTargetId,
    setSelectedTrapTargetId,
    selectedTrapTargets,
    trapSelfTargetCandidates,
    selectedTrapSelfTargetId,
    setSelectedTrapSelfTargetId,
    selectedTrapSelfTargets,
    selectedTrapSupportTrashIds,
    setSelectedTrapSupportTrashIds,
    trapSupportTrashCandidates,
    trapSupportTrashAmount,
    toggleTrapSupportTrash,
    selectedTrapSupportToHandIds,
    setSelectedTrapSupportToHandIds,
    trapSupportToHandCandidates,
    trapSupportToHandAmount,
    toggleTrapSupportToHand,
    selectedTrapHandToSupportIds,
    setSelectedTrapHandToSupportIds,
    trapHandToSupportCandidates,
    trapHandToSupportAmount,
    toggleTrapHandToSupport,
    selectedTrapTrashToDeckIds,
    setSelectedTrapTrashToDeckIds,
    trapTrashToDeckCandidates,
    trapTrashToDeckAmount,
    toggleTrapTrashToDeck,
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
    selectedFaintPaymentIds,
    setSelectedFaintPaymentIds,
    selectedFaintCostHandIds,
    setSelectedFaintCostHandIds,
    selectedFaintCostSupportIds,
    setSelectedFaintCostSupportIds,
    faintEnergyCost,
    faintEnergyCostTotal,
    faintPaymentCandidates,
    faintPaymentValid,
    toggleFaintPayment,
    faintCostHandAmount,
    faintCostHandCandidates,
    toggleFaintCostHand,
    faintCostSupportAmount,
    faintCostSupportCandidates,
    toggleFaintCostSupport,
    pendingFaint,
    faintSourceCard,
    faintCandidates,
    faintCardCandidates,
    faintCandidateLabel: getFaintEffectCandidateLabel(game),
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
    // Opponent rest support (BS5-065 Petrification)
    selectedOpponentRestSupportIds,
    setSelectedOpponentRestSupportIds,
    // Place hand HP (兩階段選擇第二階段)
    selectedPlaceHandHpId,
    setSelectedPlaceHandHpId,
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
