import { useCallback, useEffect, useState } from 'react'
import type { CookieCard, CookieInBattle, GameCard, GameState, PlayerId, PlayerState, SupportCard } from '../game'
import {
  advancePhase,
  beginAttack,
  chooseRandomDeck,
  createDemoSetupGame,
  drawMulliganCompensation,
  forceMulliganOpeningHand,
  getAttackEnergyCost,
  getCurrentReplacementTask,
  getFaintEffectCandidates,
  getFaintEffectMinMax,
  getPendingDecision,
  getReplacementCandidates,
  getRefreshCandidates,
  getTrapCandidates,
  getTrapTargetCandidates,
  keepOpeningHand,
  mulliganOpeningHand,
  selectEnergyPayment,
  selectStartingCookie,
  skipTrap,
  validateEnergyPayment,
  type DeckChoice,
} from '../game'
import {
  createAttackEffectDemoState,
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

type TestStateConfig = ReturnType<typeof parseTestStateConfig>

const opponentOfId = (playerId: PlayerId): PlayerId =>
  playerId === 'player-one' ? 'player-two' : 'player-one'

export function useMatchController(params: {
  testStateConfig: TestStateConfig | null
}) {
  const { testStateConfig } = params

  const processAiOpeningHand = useCallback(
    (initialState: GameState): GameState => {
      let nextState = initialState
      const aiId: PlayerId = 'player-two'
      const playerId: PlayerId = 'player-one'

      if (
        !nextState.players[aiId].hand.some(
          (card) => card.type === 'cookie',
        )
      ) {
        nextState = mulliganOpeningHand(nextState, aiId)
      } else {
        nextState = keepOpeningHand(nextState, aiId)
      }

      let guard = 0
      while (
        !nextState.players[aiId].hand.some(
          (card) => card.type === 'cookie',
        ) &&
        guard < 100
      ) {
        nextState = forceMulliganOpeningHand(nextState, aiId)
        nextState = drawMulliganCompensation(nextState, playerId)
        guard += 1
      }

      return nextState
    },
    [],
  )

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
    return createDemoSetupGame('player-one')
  })
  const [setupStep, setSetupStep] = useState<
    | 'deck-selection'
    | 'rps'
    | 'choose-order'
    | 'mulligan'
    | 'starting-cookie'
    | null
  >(testStateConfig === null ? 'deck-selection' : null)
  const [setupMessage, setSetupMessage] = useState(
    '請選擇本次對戰使用的牌組。',
  )
  const [deckConfig, setDeckConfig] = useState<{
    player: DeckChoice
    ai: DeckChoice
  }>({
    player: 'red',
    ai: 'red',
  })
  const [selectedAttackerId, setSelectedAttackerId] = useState<string | null>(
    null,
  )
  const [selectedAttackPaymentIds, setSelectedAttackPaymentIds] = useState<
    string[]
  >([])
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
    return '推進階段，開始這場對戰。'
  })
  const [attackShakeId, setAttackShakeId] = useState<string | null>(null)
  const [damageFlashId, setDamageFlashId] = useState<string | null>(null)
  const [faintAnimIds, setFaintAnimIds] = useState<Set<string>>(new Set())
  const [drawAnimIds, setDrawAnimIds] = useState<Set<string>>(new Set())
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

  const selectedAttacker = activePlayer.battleArea.find(
    (cookie: CookieInBattle) => cookie.card.instanceId === selectedAttackerId,
  )
  const selectedAttackCost = selectedAttacker
    ? getAttackEnergyCost(selectedAttacker.card)
    : {}
  const attackPaymentValidation = selectedAttacker
    ? validateEnergyPayment(
        selectedAttackCost,
        activePlayer.supportArea,
        selectedAttackPaymentIds,
      )
    : { valid: false, reason: '尚未選擇攻擊餅乾。' }

  const clearAttacker = useCallback(() => {
    setSelectedAttackerId(null)
    setSelectedAttackPaymentIds([])
  }, [])

  const runAction = (
    action: (current: GameState) => GameState,
    successMessage: string,
    onSuccess?: (nextGame: GameState) => void,
  ) => {
    try {
      const nextGame = action(game)
      const prevGame = game
      setGame(nextGame)
      setMessage(successMessage)

      // 攻擊動畫：宣告攻擊進入 damage 階段
      if (
        (!prevGame.pendingBattle && nextGame.pendingBattle) ||
        (prevGame.pendingBattle &&
          nextGame.pendingBattle &&
          prevGame.pendingBattle.stage !== 'damage' &&
          nextGame.pendingBattle.stage === 'damage')
      ) {
        setAttackShakeId(nextGame.pendingBattle!.attackerInstanceId)
        window.setTimeout(() => setAttackShakeId(null), 500)
      }

      // 傷害閃爍：damage 階段 remainingDamage 減少
      if (
        prevGame.pendingBattle &&
        nextGame.pendingBattle &&
        prevGame.pendingBattle.remainingDamage >
          nextGame.pendingBattle.remainingDamage
      ) {
        const targetId =
          nextGame.pendingBattle.damageTargetInstanceId ??
          nextGame.pendingBattle.targetInstanceId
        setDamageFlashId(targetId)
        window.setTimeout(() => setDamageFlashId(null), 600)
      }

      // 昏厥動畫：餅乾從戰鬥區消失
      const prevBattleIds = new Set(
        Object.values(prevGame.players).flatMap((p: PlayerState) =>
          p.battleArea.map((c: CookieInBattle) => c.card.instanceId),
        ),
      )
      const nextBattleIds = new Set(
        Object.values(nextGame.players).flatMap((p: PlayerState) =>
          p.battleArea.map((c: CookieInBattle) => c.card.instanceId),
        ),
      )
      const faintedIds = [...prevBattleIds].filter(
        (id) => !nextBattleIds.has(id),
      )
      if (faintedIds.length > 0) {
        setFaintAnimIds(new Set(faintedIds))
        window.setTimeout(() => setFaintAnimIds(new Set()), 800)
      }

      // 抽牌動畫：手牌增加
      for (const pid of ['player-one', 'player-two'] as const) {
        const prevHand = prevGame.players[pid].hand
        const nextHand = nextGame.players[pid].hand
        if (nextHand.length > prevHand.length) {
          const newIds = nextHand
            .filter(
              (card: GameCard) =>
                !prevHand.some((p: GameCard) => p.instanceId === card.instanceId),
            )
            .map((card: GameCard) => card.instanceId)
          if (newIds.length > 0) {
            setDrawAnimIds(new Set(newIds))
            window.setTimeout(() => setDrawAnimIds(new Set()), 700)
          }
        }
      }

      onSuccess?.(nextGame)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '動作無法執行。')
    }
  }

  const handleAdvancePhase = () => {
    runAction(advancePhase, '階段已推進。')
    setSelectedAttackerId(null)
    setSelectedAttackPaymentIds([])
    setSelectedFaintTargetIds([])
  }

  const handleAttackTarget = (targetInstanceId: string) => {
    if (!selectedAttackerId || !attackPaymentValidation.valid) return

    const attacker = activePlayer.battleArea.find(
      (cookie: CookieInBattle) => cookie.card.instanceId === selectedAttackerId,
    )

    runAction(
      (current) =>
        beginAttack(
          current,
          selectedAttackerId,
          targetInstanceId,
          selectedAttackPaymentIds,
        ),
      `${attacker?.card.name ?? '餅乾'}已宣告攻擊。`,
      () => {
        setSelectedAttackerId(null)
        setSelectedAttackPaymentIds([])
      },
    )
  }

  const toggleAttackPayment = (instanceId: string) => {
    setSelectedAttackPaymentIds((current) =>
      current.includes(instanceId)
        ? current.filter((id) => id !== instanceId)
        : [...current, instanceId],
    )
  }

  const beginOrderedSetup = useCallback(
    (firstPlayerId: PlayerId) => {
      let nextGame = createDemoSetupGame(firstPlayerId, deckConfig)
      if (firstPlayerId === 'player-two') {
        nextGame = processAiOpeningHand(nextGame)
      }
      setGame(nextGame)
      setSetupStep('mulligan')
      setSetupMessage(
        firstPlayerId === 'player-one'
          ? '你是先攻玩家，請先決定是否更換全部手牌。'
          : 'AI 已完成調度，現在輪到你決定是否更換全部手牌。',
      )
    },
    [deckConfig, processAiOpeningHand],
  )

  const handleRps = useCallback(
    (choice: 'rock' | 'paper' | 'scissors') => {
      const choices = ['rock', 'paper', 'scissors'] as const
      const aiChoice = choices[Math.floor(Math.random() * choices.length)]
      if (choice === aiChoice) {
        setSetupMessage('本次猜拳平手，請再選一次。')
        return
      }

      const playerWins =
        (choice === 'rock' && aiChoice === 'scissors') ||
        (choice === 'paper' && aiChoice === 'rock') ||
        (choice === 'scissors' && aiChoice === 'paper')

      if (playerWins) {
        setSetupStep('choose-order')
        setSetupMessage('你猜拳獲勝，可以選擇先攻或後攻。')
        return
      }

      setSetupMessage('AI 猜拳獲勝並選擇先攻。')
      beginOrderedSetup('player-two')
    },
    [beginOrderedSetup],
  )

  const handleDeckSelection = useCallback((playerDeck: DeckChoice) => {
    const aiDeck = chooseRandomDeck()
    setDeckConfig({ player: playerDeck, ai: aiDeck })
    setSetupStep('rps')
    setSetupMessage(
      `我方使用${playerDeck === 'red' ? '紅色' : playerDeck === 'yellow' ? '黃色' : '綠色'}牌組，AI 隨機選擇${aiDeck === 'red' ? '紅色' : aiDeck === 'yellow' ? '黃色' : '綠色'}牌組。請猜拳決定先後攻選擇權。`,
    )
  }, [])

  const handlePlayerMulligan = (replaceAll: boolean) => {
    let nextGame = replaceAll
      ? mulliganOpeningHand(game, 'player-one')
      : keepOpeningHand(game, 'player-one')
    let forcedCount = 0

    while (
      !nextGame.players['player-one'].hand.some(
        (card) => card.type === 'cookie',
      ) &&
      forcedCount < 100
    ) {
      nextGame = forceMulliganOpeningHand(nextGame, 'player-one')
      nextGame = drawMulliganCompensation(nextGame, 'player-two')
      forcedCount += 1
    }

    if (nextGame.firstPlayerId === 'player-one') {
      nextGame = processAiOpeningHand(nextGame)
    }

    setGame(nextGame)
    setSetupStep('starting-cookie')
    setSetupMessage(
      forcedCount > 0
        ? `已完成 ${forcedCount} 次強制調度；AI 每次均接受補償抽牌。請選擇起始餅乾。`
        : '雙方調度完成，請選擇一張餅乾作為起始餅乾。',
    )
  }

  const handleStartingCookie = (instanceId: string) => {
    let nextGame = selectStartingCookie(game, 'player-one', instanceId)
    const aiCookie = nextGame.players['player-two'].hand.find(
      (card) => card.type === 'cookie',
    )
    if (!aiCookie) {
      setSetupMessage('AI 沒有可放置的起始餅乾。')
      return
    }
    nextGame = selectStartingCookie(
      nextGame,
      'player-two',
      aiCookie.instanceId,
    )
    setGame(nextGame)
    setSetupStep(null)
    setMessage(
      `${nextGame.players[nextGame.firstPlayerId].name}先攻，正式進入第一回合。`,
    )
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

  const pendingDecision = getPendingDecision(game)
  const aiControlsCurrentState: boolean =
    pendingDecision
      ? pendingDecision.playerId === 'player-two'
      : game.pendingRefresh
          ? game.pendingRefresh.playerId === 'player-two'
          : game.pendingOnPlay
              ? game.pendingOnPlay.playerId === 'player-two'
            : replacementTask
                ? replacementTask.playerId === 'player-two'
                : game.pendingBattle
                  ? game.pendingBattle.stage === 'damage' ||
                    (game.pendingBattle.stage === 'flip'
                      ? game.pendingBattle.damagePlayerId ??
                        game.pendingBattle.defenderPlayerId
                      : game.pendingBattle.defenderPlayerId) === 'player-two'
                  : game.activePlayerId === 'player-two'

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
      game.pendingReplacement ||
      game.pendingOnPlay ||
      game.pendingRefresh ||
      game.pendingBattle ||
      game.pendingOpponentHandDiscard ||
      (game.pendingFaintEffects && game.pendingFaintEffects.length > 0)
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
      setSetupStep('deck-selection')
      setSetupMessage('請選擇本次對戰使用的牌組。')
      setSelectedAttackerId(null)
      setSelectedAttackPaymentIds([])
      setSelectedFaintTargetIds([])
      setAttackShakeId(null)
      setDamageFlashId(null)
      setFaintAnimIds(new Set())
      setDrawAnimIds(new Set())
      setSelectedTrapId(null)
      setTrapSelectNoTarget(false)
      setSelectedFlipDiscardIds([])
      setSelectedOpponentDiscardIds([])
    },
    [],
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
    selectedAttackerId,
    setSelectedAttackerId,
    selectedAttackPaymentIds,
    setSelectedAttackPaymentIds,
    message,
    setMessage,
    handleDeckSelection,
    handleRps,
    beginOrderedSetup,
    handlePlayerMulligan,
    handleStartingCookie,
    runAction,
    handleAdvancePhase,
    handleAttackTarget,
    toggleAttackPayment,
    clearAttacker,
    activePlayer,
    viewerPlayerId,
    opponentId,
    selectedAttacker,
    selectedAttackCost,
    attackPaymentValidation,
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
    attackShakeId,
    damageFlashId,
    faintAnimIds,
    drawAnimIds,
    // Derived
    pendingPlayer,
    pendingOptions,
    aiControlsCurrentState,
    replacementTask,
    // Reset
    resetMatchState,
  } as const
}
