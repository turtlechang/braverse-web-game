import { useCallback, useEffect, useState } from 'react'
import type { CookieCard, CookieInBattle, GameState, PlayerId, PlayerState, SupportCard } from '../game'
import {
  advancePhase,
  createDemoSetupGame,
  getCurrentReplacementTask,
  getFaintEffectCandidates,
  getFaintEffectMinMax,
  hasBlockingPending,
  getReplacementCandidates,
  getRefreshCandidates,
  getTrapCandidates,
  getTrapTargetCandidates,
  isPlayerControllingState,
  selectEnergyPayment,
  skipTrap,
  type DeckChoice,
} from '../game'
import {
  createAttackEffectDemoState,
  createBlueActivateSkillDemoState,
  createBlueInspectDeckDemoState,
  createBlueOptionalCostAttackDemoState,
  createBreakToTrashDemoState,
  createFaintDamageDemoState,
  createFlipResponseDemoState,
  createItemUsageDemoState,
  createPretzelSnareDemoState,
  createReplacementChoiceDemoState,
  createOpponentDiscardHandDemoState,
  createStageUsageDemoState,
  createSupportToTrashSkillDemoState,
  createTrapResponseDemoState,
  parseTestStateConfig,
} from '../game/demo'
import { useMatchSetup } from './useMatchSetup'
import { useMatchAnimations } from './useMatchAnimations'
import { useBattleActions, type RunGameAction } from './useBattleActions'

type TestStateConfig = ReturnType<typeof parseTestStateConfig>

const opponentOfId = (playerId: PlayerId): PlayerId =>
  playerId === 'player-one' ? 'player-two' : 'player-one'

export function useMatchController(params: {
  testStateConfig: TestStateConfig | null
}) {
  const { testStateConfig } = params

  const [game, setGame] = useState(() => {
    if (testStateConfig?.kind === 'break-to-trash') {
      return createBreakToTrashDemoState(testStateConfig.level)
    }
    if (testStateConfig?.kind === 'trap-response') {
      return createTrapResponseDemoState(testStateConfig.payable)
    }
    if (testStateConfig?.kind === 'flip-response') {
      return createFlipResponseDemoState()
    }
    if (testStateConfig?.kind === 'replacement-choice') {
      return createReplacementChoiceDemoState()
    }
    if (testStateConfig?.kind === 'item-usage') {
      return createItemUsageDemoState(testStateConfig.payable)
    }
    if (testStateConfig?.kind === 'stage-usage') {
      return createStageUsageDemoState(testStateConfig.payable)
    }
    if (testStateConfig?.kind === 'faint-damage') {
      return createFaintDamageDemoState()
    }
    if (testStateConfig?.kind === 'trap-pretzel') {
      return createPretzelSnareDemoState(testStateConfig.attack)
    }
    if (testStateConfig?.kind === 'opponent-discard-hand') {
      return createOpponentDiscardHandDemoState()
    }
    if (testStateConfig?.kind === 'attack-effect') {
      return createAttackEffectDemoState()
    }
    if (testStateConfig?.kind === 'support-to-trash-skill') {
      return createSupportToTrashSkillDemoState()
    }
    if (testStateConfig?.kind === 'blue-activate-skill') {
      return createBlueActivateSkillDemoState(testStateConfig.payable)
    }
    if (testStateConfig?.kind === 'blue-optional-cost-attack') {
      return createBlueOptionalCostAttackDemoState(testStateConfig.payable)
    }
    if (testStateConfig?.kind === 'blue-inspect-deck') {
      return createBlueInspectDeckDemoState()
    }
    return createDemoSetupGame('player-one')
  })
  const [message, setMessage] = useState(() => {
    if (testStateConfig?.kind === 'break-to-trash') {
      return testStateConfig.level === 1
        ? '測試狀態：休息區有 1 張 LV.1 餅乾。'
        : '測試狀態：休息區有 1 張 LV.2 餅乾。'
    }
    if (testStateConfig?.kind === 'replacement-choice') {
      return '測試狀態：選擇是否補餅乾。'
    }
    if (testStateConfig?.kind === 'item-usage') {
      return testStateConfig.payable
        ? '測試狀態：合法物品卡使用。'
        : '測試狀態：不合法物品卡使用（非主要階段）。'
    }
    if (testStateConfig?.kind === 'stage-usage') {
      return testStateConfig.payable
        ? '測試狀態：合法場景卡放置與啟動。'
        : '測試狀態：不合法場景卡啟動（已橫置）。'
    }
    if (testStateConfig?.kind === 'faint-damage') {
      return '測試狀態：Cherry Cookie 昏厥效果選擇目標。'
    }
    if (testStateConfig?.kind === 'trap-pretzel') {
      return testStateConfig.attack === 5
        ? '測試狀態：Pretzel Snare 可支付（攻擊 5）。'
        : '測試狀態：Pretzel Snare 不可支付（攻擊 4）。'
    }
    if (testStateConfig?.kind === 'opponent-discard-hand') {
      return '測試狀態：Roguefort Cookie OnPlay 對手棄牌。'
    }
    if (testStateConfig?.kind === 'attack-effect') {
      return '測試狀態：Wizard Cookie 攻擊後續效果。'
    }
    if (testStateConfig?.kind === 'support-to-trash-skill') {
      return '測試狀態：ST3-002 支援卡代價技能。'
    }
    if (testStateConfig?.kind === 'blue-activate-skill') {
      return testStateConfig.payable
        ? '測試狀態：Werewolf Cookie 可發動技能（手牌充足）。'
        : '測試狀態：Werewolf Cookie 不可發動技能（手牌不足）。'
    }
    if (testStateConfig?.kind === 'blue-optional-cost-attack') {
      return testStateConfig.payable
        ? '測試狀態：Captain Caviar 可支付攻擊後續效果。'
        : '測試狀態：Captain Caviar 不可支付攻擊後續效果。'
    }
    if (testStateConfig?.kind === 'blue-inspect-deck') {
      return '測試狀態：Captain Caviar OnPlay 檢視牌庫頂 3 張。'
    }
    return '推進階段，開始這場對戰。'
  })
  const setup = useMatchSetup({
    game,
    setGame,
    setMessage,
    enabled: testStateConfig === null,
  })
  const {
    setupStep,
    setSetupStep,
    setupMessage,
    setSetupMessage,
    deckConfig,
    setDeckConfig,
    handleDeckSelection,
    handleRps,
    beginOrderedSetup,
    handlePlayerMulligan,
    handleStartingCookie,
    resetSetup,
  } = setup
  const animations = useMatchAnimations()
  const [selectedTrapId, setSelectedTrapId] = useState<string | null>(null)
  const [trapSelectNoTarget, setTrapSelectNoTarget] = useState(false)
  const [selectedFlipDiscardIds, setSelectedFlipDiscardIds] = useState<
    string[]
  >([])
  const [selectedFaintTargetIds, setSelectedFaintTargetIds] = useState<
    string[]
  >([])
  const [selectedOpponentDiscardIds, setSelectedOpponentDiscardIds] =
    useState<string[]>([])

  const viewerPlayerId: PlayerId = 'player-one'
  const opponentId = opponentOfId(viewerPlayerId)
  const activePlayer = game.players[game.activePlayerId]

  const runAction: RunGameAction = (action, successMessage, onSuccess) => {
    try {
      const nextGame = action(game)
      const prevGame = game
      setGame(nextGame)
      setMessage(successMessage)
      animations.observeTransition(prevGame, nextGame)

      onSuccess?.(nextGame)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '動作無法執行。')
    }
  }
  const battleActions = useBattleActions({ game, runAction })

  const handleAdvancePhase = () => {
    runAction(advancePhase, '階段已推進。')
    battleActions.clearAttacker()
    setSelectedFaintTargetIds([])
  }

  // Derived state
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
        selectedTrap.trap.cost.energy,
        game.players[viewerPlayerId].supportArea,
      ) ?? []
    : []
  const trapAllowEmptyTarget =
    selectedTrap?.trap?.effects.some(
      (effect) =>
        (effect.kind === 'damage' ||
          effect.kind === 'modify-attack' ||
          effect.kind === 'prevent-knockout') &&
        (effect.target.min ?? 0) === 0,
    ) ?? false
  const selectedTrapTargets =
    selectedTrap && !trapSelectNoTarget
      ? getTrapTargetCandidates(
          game,
          viewerPlayerId,
          selectedTrap.instanceId,
        ).slice(0, 1)
      : []
  const selectedTrapSupportTrashIds =
    selectedTrap?.trap?.effects.some(
      (effect) => effect.kind === 'support-to-trash',
    )
      ? game.players[viewerPlayerId].supportArea
          .slice(0, 1)
          .map((support: SupportCard) => support.card.instanceId)
      : []

  const replacementTask = getCurrentReplacementTask(game)

  const aiControlsCurrentState: boolean =
    isPlayerControllingState(game, 'player-two')

  const pendingPlayerId =
    game.pendingRefresh?.playerId ??
    (!game.pendingOnPlay ? replacementTask?.playerId : undefined)
  const pendingPlayer = pendingPlayerId
    ? game.players[pendingPlayerId]
    : null
  const pendingOptions = game.pendingRefresh
    ? getRefreshCandidates(game, game.pendingRefresh.playerId)
    : pendingPlayer
      ? getReplacementCandidates(game, pendingPlayer.id)
      : []

  useEffect(() => {
    if (
      setupStep ||
      game.status !== 'playing' ||
      game.activePlayerId !== viewerPlayerId ||
      (game.phase !== 'active' && game.phase !== 'draw') ||
      hasBlockingPending(game)
    ) {
      return
    }

    const timer = window.setTimeout(() => {
      setGame((current) => {
        if (
          current.activePlayerId !== viewerPlayerId ||
          (current.phase !== 'active' && current.phase !== 'draw')
        ) {
          return current
        }
        return advancePhase(current)
      })
      setMessage(
        game.phase === 'active'
          ? '活躍動作已自動完成。'
          : '抽牌已自動完成，進入支援階段。',
      )
    }, 350)

    return () => window.clearTimeout(timer)
  }, [game, setupStep, viewerPlayerId])

  // auto-skip trap
  useEffect(() => {
    const battle = game.pendingBattle
    if (
      battle?.stage !== 'trap' ||
      battle.defenderPlayerId !== viewerPlayerId ||
      getTrapCandidates(game, viewerPlayerId).length > 0
    ) {
      return
    }

    const timer = window.setTimeout(() => {
      setSelectedTrapId(null)
      setGame((current: GameState) => {
        const currentBattle = current.pendingBattle
        if (
          currentBattle?.stage !== 'trap' ||
          currentBattle.defenderPlayerId !== viewerPlayerId ||
          getTrapCandidates(current, viewerPlayerId).length > 0
        ) {
          return current
        }
        return skipTrap(current, viewerPlayerId)
      })
    }, 0)

    return () => window.clearTimeout(timer)
  }, [game, viewerPlayerId])

  // resetMatchState: resets all match-owned state (used by App's resetGame)
  const resetMatchState = useCallback(
    (nextConfig: { player: DeckChoice; ai: DeckChoice }) => {
      setGame(createDemoSetupGame('player-one', nextConfig))
      resetSetup()
      battleActions.clearAttacker()
      setSelectedFaintTargetIds([])
      animations.resetAnimations()
      setSelectedTrapId(null)
      setTrapSelectNoTarget(false)
      setSelectedFlipDiscardIds([])
      setSelectedOpponentDiscardIds([])
    },
    [animations, battleActions, resetSetup],
  )

  return {
    game,
    setGame,
    setupStep,
    setSetupStep,
    setupMessage,
    setSetupMessage,
    deckConfig,
    setDeckConfig,
    selectedAttackerId: battleActions.selectedAttackerId,
    setSelectedAttackerId: battleActions.setSelectedAttackerId,
    selectedAttackPaymentIds: battleActions.selectedAttackPaymentIds,
    setSelectedAttackPaymentIds: battleActions.setSelectedAttackPaymentIds,
    message,
    setMessage,
    handleDeckSelection,
    handleRps,
    beginOrderedSetup,
    handlePlayerMulligan,
    handleStartingCookie,
    runAction,
    handleAdvancePhase,
    handleAttackTarget: battleActions.handleAttackTarget,
    toggleAttackPayment: battleActions.toggleAttackPayment,
    clearAttacker: battleActions.clearAttacker,
    activePlayer,
    viewerPlayerId,
    opponentId,
    selectedAttacker: battleActions.selectedAttacker,
    selectedAttackCost: battleActions.selectedAttackCost,
    attackPaymentValidation: battleActions.attackPaymentValidation,
    // Trap
    selectedTrapId,
    setSelectedTrapId,
    trapSelectNoTarget,
    setTrapSelectNoTarget,
    playerTrapCandidates,
    selectedTrap,
    selectedTrapPaymentIds,
    trapAllowEmptyTarget,
    selectedTrapTargets,
    selectedTrapSupportTrashIds,
    // Flip
    selectedFlipDiscardIds,
    setSelectedFlipDiscardIds,
    // Faint (raw hasFaint without !pendingEffect check)
    selectedFaintTargetIds,
    setSelectedFaintTargetIds,
    pendingFaint,
    faintSourceCard,
    faintCandidates,
    faintTargetIds,
    hasFaint,
    faintMin: faintMinMax.min,
    faintMax: faintMinMax.max,
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
    aiControlsCurrentState,
    replacementTask,
    // Reset
    resetMatchState,
  } as const
}
