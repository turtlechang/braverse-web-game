import { useEffect, useState } from 'react'
import { Sparkles, Swords } from 'lucide-react'
import './App.css'
import {
  activateCookieSkill,
  advancePhase,
  beginAttack,
  canActivateCookieSkill,
  createDemoGame,
  createDemoSetupGame,
  deployCookie,
  drawMulliganCompensation,
  executeCardEffect,
  finalizePendingReplacements,
  getAttackEnergyCost,
  getBreakToTrashCandidates,
  getEffectTargetCandidates,
  getRefreshCandidates,
  getCurrentReplacementTask,
  getReplacementCandidates,
  getTrapCandidates,
  getTrapTargetCandidates,
  forceMulliganOpeningHand,
  isEffectConditionMet,
  isEffectUntargeted,
  keepOpeningHand,
  mulliganOpeningHand,
  placeSupportCard,
  playTrap,
  refreshDeck,
  replaceDefeatedCookie,
  resolveFlip,
  selectEnergyPayment,
  selectStartingCookie,
  simulateAiMatch,
  skipCookieOnPlay,
  skipDefeatedCookieReplacement,
  skipTrap,
  takeAiStep,
  validateEnergyPayment,
  type AiMatchResult,
  type DeckChoice,
  type GameCard,
  type GameState,
  type PlayerId,
  type SkillTrigger,
} from './game'
import { BattleRow } from './components/battle/BattleRow'
import { PhaseRail } from './components/layout/PhaseRail'
import { MatchToolbar } from './components/layout/MatchToolbar'
import {
  AttackPaymentPanel,
  SimulationReport,
} from './components/panels/GameStatusPanels'
import { phaseLabels, deckChoiceLabel } from './components/gameUiLabels'
import { describeEffectResult } from './components/effects/effectUiUtils'
import { EffectPanel } from './components/effects/EffectPanel'
import type { PendingEffect } from './components/effects/effectUiTypes'
import {
  createBreakToTrashDemoState,
  createFlipResponseDemoState,
  createReplacementChoiceDemoState,
  createTrapResponseDemoState,
  parseTestStateConfig,
} from './game/demo'
import {
  DecisionModal,
  CardDetailModal,
  CardPileModal,
  FlipResponseModal,
  PauseModal,
  DeckListModal,
  ResultModal,
  TrapResponseModal,
  OpeningSetupModal,
  type OpeningSetupStep,
} from './components/modals/GameModals'

const aiSimulationSeeds = Array.from({ length: 20 }, (_, index) => index + 1)

const opponentOf = (playerId: PlayerId): PlayerId =>
  playerId === 'player-one' ? 'player-two' : 'player-one'

const testStateConfig = parseTestStateConfig(
  window.location.search,
  window.location.hostname,
)

function App() {
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
    return createDemoSetupGame('player-one')
  })
  const [setupStep, setSetupStep] = useState<OpeningSetupStep | null>(
    testStateConfig === null ? 'rps' : null,
  )
  const [setupMessage, setSetupMessage] = useState(
    '選擇剪刀、石頭或布，勝者取得先後攻選擇權。',
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
    return '推進階段，開始這場對戰。'
  })
  const [effectHistory, setEffectHistory] = useState<string[]>([])
  const [pendingEffect, setPendingEffect] =
    useState<PendingEffect | null>(null)
  const [inspectedCard, setInspectedCard] = useState<GameCard | null>(null)
  const [inspectedDiscardPlayerId, setInspectedDiscardPlayerId] =
    useState<PlayerId | null>(null)
  const [selectedTrapId, setSelectedTrapId] = useState<string | null>(null)
  const [selectedFlipDiscardIds, setSelectedFlipDiscardIds] = useState<
    string[]
  >([])
  const [showPause, setShowPause] = useState(false)
  const [showDeckList, setShowDeckList] = useState(false)
  const [deckListOwner, setDeckListOwner] = useState<'player' | 'ai'>('player')
  const [aiThinking, setAiThinking] = useState(false)
  const [aiActionCount, setAiActionCount] = useState(0)
  const [simulationResults, setSimulationResults] = useState<
    AiMatchResult[] | null
  >(null)

  const resetGame = (
    nextConfig: { player: DeckChoice; ai: DeckChoice },
    nextMessage: string,
  ) => {
    setGame(createDemoSetupGame('player-one', nextConfig))
    setSetupStep('rps')
    setSetupMessage('選擇剪刀、石頭或布，勝者取得先後攻選擇權。')
    setSelectedAttackerId(null)
    setSelectedAttackPaymentIds([])
    setPendingEffect(null)
    setEffectHistory([])
    setAiActionCount(0)
    setSimulationResults(null)
    setMessage(nextMessage)
  }

  const processAiOpeningHand = (initialState: GameState): GameState => {
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
  }

  const beginOrderedSetup = (firstPlayerId: PlayerId) => {
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
  }

  const handleRps = (choice: 'rock' | 'paper' | 'scissors') => {
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
  }

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
  const activePlayer = game.players[game.activePlayerId]
  const viewerPlayerId: PlayerId = 'player-one'
  const opponentId = opponentOf(viewerPlayerId)
  const currentEffect =
    pendingEffect?.effects[pendingEffect.effectIndex] ?? null
  const effectTargetCandidates =
    pendingEffect && currentEffect && !isEffectUntargeted(currentEffect) && currentEffect.kind !== 'break-to-trash'
      ? getEffectTargetCandidates(
          game,
          pendingEffect.context,
          currentEffect.target,
        )
      : []
  const breakToTrashCandidates =
    pendingEffect && currentEffect?.kind === 'break-to-trash'
      ? getBreakToTrashCandidates(
          game,
          pendingEffect.context,
          currentEffect,
        )
      : []
  const effectTargetIds = new Set(
    effectTargetCandidates.map((cookie) => cookie.card.instanceId),
  )
  const breakEffectTargetIds = new Set(
    breakToTrashCandidates.map((card) => card.instanceId),
  )
  const selectedEffectTargetIds = new Set(
    pendingEffect?.selectedTargetIds ?? [],
  )
  const selectedSkillPaymentIds = new Set(
    pendingEffect?.selectedPaymentIds ?? [],
  )
  const selectedAttackPaymentIdSet = new Set(selectedAttackPaymentIds)
  const selectedAttacker = activePlayer.battleArea.find(
    (cookie) => cookie.card.instanceId === selectedAttackerId,
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
  const replacementTask = getCurrentReplacementTask(game)
  const aiControlsCurrentState =
    game.pendingRefresh
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

  useEffect(() => {
    if (pendingEffect || effectHistory.length === 0) return

    const timer = window.setTimeout(() => setEffectHistory([]), 1000)
    return () => window.clearTimeout(timer)
  }, [effectHistory, pendingEffect])

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
      setGame((current) => {
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

  useEffect(() => {
    if (
      showPause ||
      game.status !== 'playing' ||
      !aiControlsCurrentState ||
      pendingEffect
    ) {
      return
    }

    if (aiActionCount >= 200) {
      return
    }

    const thinkingTimer = window.setTimeout(
      () => setAiThinking(true),
      0,
    )
    const timer = window.setTimeout(() => {
      const decision = takeAiStep(game, 'player-two')
      setAiThinking(false)

      if (decision.action === 'error' || decision.state === game) {
        setMessage(`AI 停止：${decision.description}`)
        return
      }

      setGame(decision.state)
      setMessage(`AI：${decision.description}`)
      setAiActionCount((count) => count + 1)
    }, 450)

    return () => {
      window.clearTimeout(thinkingTimer)
      window.clearTimeout(timer)
    }
  }, [
    aiActionCount,
    aiControlsCurrentState,
    game,
    pendingEffect,
    showPause,
  ])

  const beginCookieSkill = (
    nextGame: GameState,
    card: GameCard | undefined,
    playerId: PlayerId,
    trigger: SkillTrigger,
    triggerLabel: string,
    optional = false,
  ) => {
    if (
      !card?.skill ||
      card.skill.trigger !== trigger ||
      nextGame.status !== 'playing'
    ) {
      return
    }

    const context = {
      sourcePlayerId: playerId,
      sourceInstanceId: card.instanceId,
    }
    const availableEffects = card.skill.effects.filter((effect) =>
      isEffectConditionMet(nextGame, context, effect),
    )

    if (availableEffects.length === 0) {
      if (trigger === 'on-play' && nextGame.pendingOnPlay) {
        setGame(
          skipCookieOnPlay(nextGame, playerId, card.instanceId),
        )
      }
      setMessage(`${card.name}的效果尚未滿足發動條件。`)
      return
    }

    if (
      !canActivateCookieSkill(
        nextGame,
        playerId,
        card.instanceId,
        trigger,
      )
    ) {
      if (trigger === 'on-play' && nextGame.pendingOnPlay) {
        setGame(
          skipCookieOnPlay(nextGame, playerId, card.instanceId),
        )
      }
      setMessage(`${card.name}目前無法支付或發動技能。`)
      return
    }

    setSelectedAttackerId(null)
    setSelectedAttackPaymentIds([])
    setPendingEffect({
      sourceCard: card,
      context,
      skill: card.skill,
      trigger,
      effects: availableEffects,
      effectIndex: 0,
      selectedTargetIds: [],
      selectedPaymentIds: [],
      skillActivated: false,
      optional,
      triggerLabel,
    })
    setMessage(`${card.name}的技能等待支付能量並選擇目標。`)
  }

  const runAction = (
    action: (current: GameState) => GameState,
    successMessage: string,
    onSuccess?: (nextGame: GameState) => void,
  ) => {
    try {
      const nextGame = action(game)
      setGame(nextGame)
      setMessage(successMessage)
      onSuccess?.(nextGame)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '動作無法執行。')
    }
  }

  const handleAdvancePhase = () => {
    if (pendingEffect) return
    runAction(advancePhase, '階段已推進。')
    setSelectedAttackerId(null)
    setSelectedAttackPaymentIds([])
  }

  const handleAttackTarget = (targetInstanceId: string) => {
    if (!selectedAttackerId || !attackPaymentValidation.valid) return

    const attacker = activePlayer.battleArea.find(
      (cookie) => cookie.card.instanceId === selectedAttackerId,
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

  const toggleEffectTarget = (instanceId: string) => {
    if (
      !pendingEffect ||
      !currentEffect ||
      (!effectTargetIds.has(instanceId) &&
        !breakEffectTargetIds.has(instanceId))
    ) {
      return
    }

    const max =
      currentEffect.kind === 'break-to-trash'
        ? currentEffect.max
        : isEffectUntargeted(currentEffect)
          ? 0
          : currentEffect.target.max

    const isSelected = pendingEffect.selectedTargetIds.includes(instanceId)
    const selectedTargetIds = isSelected
      ? pendingEffect.selectedTargetIds.filter((id) => id !== instanceId)
      : pendingEffect.selectedTargetIds.length < max
        ? [...pendingEffect.selectedTargetIds, instanceId]
        : pendingEffect.selectedTargetIds

    setPendingEffect({ ...pendingEffect, selectedTargetIds })
  }

  const toggleSkillPayment = (instanceId: string) => {
    if (!pendingEffect || pendingEffect.skillActivated) return

    const isSelected =
      pendingEffect.selectedPaymentIds.includes(instanceId)
    const selectedPaymentIds = isSelected
      ? pendingEffect.selectedPaymentIds.filter((id) => id !== instanceId)
      : [...pendingEffect.selectedPaymentIds, instanceId]

    setPendingEffect({ ...pendingEffect, selectedPaymentIds })
  }

  const skipOptionalSkill = () => {
    if (!pendingEffect?.optional) return

    setGame(
      skipCookieOnPlay(
        game,
        pendingEffect.context.sourcePlayerId,
        pendingEffect.sourceCard.instanceId,
      ),
    )
    setMessage(`${pendingEffect.sourceCard.name}的 OnPlay 技能未發動。`)
    setPendingEffect(null)
  }

  const confirmEffect = () => {
    if (!pendingEffect || !currentEffect) return

    const targetNames =
      currentEffect.kind === 'break-to-trash'
        ? pendingEffect.selectedTargetIds.map(
            (instanceId) =>
              breakToTrashCandidates.find(
                (card) => card.instanceId === instanceId,
              )?.name ?? instanceId,
          )
        : pendingEffect.selectedTargetIds.map(
            (instanceId) =>
              effectTargetCandidates.find(
                (cookie) => cookie.card.instanceId === instanceId,
              )?.card.name ?? instanceId,
          )

    try {
      const activatedGame = pendingEffect.skillActivated
        ? game
        : activateCookieSkill(
            game,
            pendingEffect.context.sourcePlayerId,
            pendingEffect.sourceCard.instanceId,
            pendingEffect.trigger,
            pendingEffect.selectedPaymentIds,
          )
      const nextGame = executeCardEffect(
        activatedGame,
        pendingEffect.context,
        currentEffect,
        pendingEffect.selectedTargetIds,
      )
      const result = describeEffectResult(currentEffect, targetNames)
      const nextEffectIndex = pendingEffect.effectIndex + 1
      const hasNextEffect =
        nextGame.status === 'playing' &&
        nextEffectIndex < pendingEffect.effects.length
      const resolvedGame =
        nextGame.status !== 'playing' || hasNextEffect
          ? nextGame
          : finalizePendingReplacements(nextGame)

      setGame(resolvedGame)
      setMessage(result)
      setEffectHistory((history) => [result, ...history].slice(0, 4))
      setPendingEffect(
        hasNextEffect
          ? {
              ...pendingEffect,
              effectIndex: nextEffectIndex,
              selectedTargetIds: [],
              skillActivated: true,
            }
          : null,
      )
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : '效果無法執行。',
      )
    }
  }

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
  const interactionLocked =
    Boolean(pendingEffect) ||
    Boolean(game.pendingOnPlay) ||
    Boolean(game.pendingBattle) ||
    aiThinking ||
    aiControlsCurrentState

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
  const selectedTrapTargets = selectedTrap
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
          .map((support) => support.card.instanceId)
      : []

  const runSimulation = () => {
    const results = aiSimulationSeeds.map((seed) =>
      simulateAiMatch(createDemoGame(seed, deckConfig)),
    )
    setSimulationResults(results)
    const completed = results.filter((result) => !result.stuck).length
    setMessage(`AI 驗證完成：${completed}/20 場正常結束。`)
  }

  return (
    <main className="game-shell">
      <div className="board-texture" />

      <PhaseRail
        phase={game.phase}
        turnNumber={game.turnNumber}
        disabled={
          game.status === 'finished' ||
          Boolean(game.pendingReplacement) ||
          Boolean(game.pendingOnPlay) ||
          Boolean(game.pendingRefresh) ||
          Boolean(pendingEffect)
        }
        onAdvance={handleAdvancePhase}
        aiThinking={aiThinking}
        aiActionCount={aiActionCount}
        onRunSimulation={runSimulation}
      />

      <MatchToolbar
        deckConfig={deckConfig}
        activePlayerName={activePlayer.name}
        phase={game.phase}
        message={message}
        onPlayerDeckChange={(deck) => {
          const newConfig = { ...deckConfig, player: deck }
          setDeckConfig(newConfig)
          resetGame(newConfig, `我方 ${deckChoiceLabel[deck]} vs AI ${deckChoiceLabel[deckConfig.ai]}。`)
        }}
        onAiDeckChange={(deck) => {
          const newConfig = { ...deckConfig, ai: deck }
          setDeckConfig(newConfig)
          resetGame(newConfig, `我方 ${deckChoiceLabel[deckConfig.player]} vs AI ${deckChoiceLabel[deck]}。`)
        }}
        onReset={() => {
          resetGame(deckConfig, `我方 ${deckChoiceLabel[deckConfig.player]} vs AI ${deckChoiceLabel[deckConfig.ai]} 新對局。`)
        }}
        onViewDeck={() => {
          setDeckListOwner('player')
          setShowDeckList(true)
        }}
        onPause={() => setShowPause(true)}
      />

      <section className="table-area" aria-label="Braverse 對戰桌">
        <BattleRow
          game={game}
          playerId={opponentId}
          position="top"
          selectedAttackerId={selectedAttackerId}
          effectTargetIds={effectTargetIds}
          breakEffectTargetIds={breakEffectTargetIds}
          selectedEffectTargetIds={selectedEffectTargetIds}
          selectedSkillPaymentIds={selectedSkillPaymentIds}
          selectedAttackPaymentIds={selectedAttackPaymentIdSet}
          attackPaymentValid={attackPaymentValidation.valid}
          interactionLocked={interactionLocked}
          onAttackTarget={handleAttackTarget}
          onEffectTarget={toggleEffectTarget}
          onInspectCard={setInspectedCard}
          onInspectDiscard={setInspectedDiscardPlayerId}
        />

        <div className="table-divider">
          <span />
          <strong>
            {aiThinking ? (
              <>
                <Sparkles aria-hidden="true" /> AI 思考中
              </>
            ) : pendingEffect ? (
              <>
                <Sparkles aria-hidden="true" /> 選擇效果目標
              </>
            ) : selectedAttackerId ? (
              <>
                <Swords aria-hidden="true" /> 選擇攻擊目標
              </>
            ) : (
              `${activePlayer.name} · ${phaseLabels[game.phase]}`
            )}
          </strong>
          <span />
        </div>

        <BattleRow
          game={game}
          playerId={viewerPlayerId}
          position="bottom"
          selectedAttackerId={selectedAttackerId}
          effectTargetIds={effectTargetIds}
          breakEffectTargetIds={breakEffectTargetIds}
          selectedEffectTargetIds={selectedEffectTargetIds}
          selectedSkillPaymentIds={selectedSkillPaymentIds}
          selectedAttackPaymentIds={selectedAttackPaymentIdSet}
          attackPaymentValid={attackPaymentValidation.valid}
          interactionLocked={interactionLocked}
          onSelectAttacker={(instanceId) => {
            setSelectedAttackerId(instanceId)
            setSelectedAttackPaymentIds([])
            setMessage('選擇支援卡支付攻擊費用。')
          }}
          onEffectTarget={toggleEffectTarget}
          onPlaceSupport={(instanceId) =>
            runAction(
              (current) => placeSupportCard(current, instanceId),
              '已將卡牌配置到支援區。',
            )
          }
          onSkillPayment={toggleSkillPayment}
          onAttackPayment={toggleAttackPayment}
          onActivateSkill={(instanceId) => {
            const card = activePlayer.battleArea.find(
              (cookie) => cookie.card.instanceId === instanceId,
            )?.card
            beginCookieSkill(
              game,
              card,
              activePlayer.id,
              'activate',
              'Activate 主動發動',
            )
          }}
          onDeployCookie={(instanceId) =>
            runAction(
              (current) => deployCookie(current, instanceId),
              '新餅乾已登場並配置 HP。',
              (nextGame) => {
                if (nextGame.pendingRefresh) return
                beginCookieSkill(
                  nextGame,
                  nextGame.players[activePlayer.id].battleArea.find(
                    (cookie) => cookie.card.instanceId === instanceId,
                  )?.card,
                  activePlayer.id,
                  'on-play',
                  'OnPlay 登場觸發',
                  true,
                )
              },
            )
          }
          onInspectCard={setInspectedCard}
          onInspectDiscard={setInspectedDiscardPlayerId}
        />
      </section>

      {selectedAttacker && !pendingEffect && (
        <AttackPaymentPanel
          attackerName={selectedAttacker.card.name}
          attackCost={selectedAttackCost}
          selectedPaymentCount={selectedAttackPaymentIds.length}
          isValid={attackPaymentValidation.valid}
          validationReason={attackPaymentValidation.reason}
          onCancel={() => {
            setSelectedAttackerId(null)
            setSelectedAttackPaymentIds([])
            setMessage('已取消攻擊。')
          }}
        />
      )}

      {simulationResults && (
        <SimulationReport
          simulationResults={simulationResults}
          seeds={aiSimulationSeeds}
          onClose={() => setSimulationResults(null)}
        />
      )}

      <EffectPanel
        pendingEffect={pendingEffect}
        currentEffect={currentEffect}
        effectHistory={effectHistory}
        onConfirm={confirmEffect}
        onSkip={skipOptionalSkill}
      />

      {setupStep && (
        <OpeningSetupModal
          step={setupStep}
          message={setupMessage}
          hand={game.players[viewerPlayerId].hand}
          onRps={handleRps}
          onChooseFirstPlayer={(playerFirst) =>
            beginOrderedSetup(playerFirst ? 'player-one' : 'player-two')
          }
          onMulligan={handlePlayerMulligan}
          onSelectStartingCookie={handleStartingCookie}
        />
      )}

      {game.pendingBattle?.stage === 'trap' &&
        game.pendingBattle.defenderPlayerId === viewerPlayerId &&
        playerTrapCandidates.length > 0 && (
          <TrapResponseModal
            cards={playerTrapCandidates}
            selectedTrapId={selectedTrapId}
            paymentCards={game.players[viewerPlayerId].supportArea
              .filter((support) =>
                selectedTrapPaymentIds.includes(support.card.instanceId),
              )
              .map((support) => support.card)}
            targetCards={selectedTrapTargets.map((target) => target.card)}
            onSelectTrap={setSelectedTrapId}
            onSkip={() => {
              setSelectedTrapId(null)
              runAction(
                (current) => skipTrap(current, viewerPlayerId),
                '未發動陷阱，進入傷害結算。',
              )
            }}
            onConfirm={() => {
              if (!selectedTrap) return
              setSelectedTrapId(null)
              runAction(
                (current) =>
                  playTrap(current, viewerPlayerId, {
                    trapInstanceId: selectedTrap.instanceId,
                    paymentIds: selectedTrapPaymentIds,
                    targetIds: selectedTrapTargets.map(
                      (target) => target.card.instanceId,
                    ),
                    supportTrashIds: selectedTrapSupportTrashIds,
                  }),
                `已發動${selectedTrap.name}。`,
              )
            }}
          />
        )}

      {game.pendingBattle?.stage === 'flip' &&
        (game.pendingBattle.damagePlayerId ??
          game.pendingBattle.defenderPlayerId) === viewerPlayerId &&
        game.pendingBattle.revealedHpCard && (
          <FlipResponseModal
            key={game.pendingBattle.revealedHpCard.instanceId}
            card={game.pendingBattle.revealedHpCard}
            hand={game.players[viewerPlayerId].hand}
            discardCount={
              game.pendingBattle.revealedHpCard.flip?.cost.discardHand ?? 0
            }
            selectedDiscardIds={selectedFlipDiscardIds}
            onToggleDiscard={(instanceId) =>
              setSelectedFlipDiscardIds((current) =>
                current.includes(instanceId)
                  ? current.filter((id) => id !== instanceId)
                  : [...current, instanceId],
              )
            }
            onSkip={() => {
              setSelectedFlipDiscardIds([])
              runAction(
                (current) =>
                  resolveFlip(current, viewerPlayerId, { activate: false }),
                '未發動 FLIP，繼續傷害結算。',
              )
            }}
            onActivate={() => {
              setSelectedFlipDiscardIds([])
              runAction(
                (current) =>
                  resolveFlip(current, viewerPlayerId, {
                    activate: true,
                    discardHandIds: selectedFlipDiscardIds,
                  }),
                `已發動${game.pendingBattle?.revealedHpCard?.name ?? 'FLIP'}。`,
              )
            }}
          />
        )}

      {pendingPlayer && pendingPlayer.id !== 'player-two' && (
        <DecisionModal
          isRefresh={Boolean(game.pendingRefresh)}
          playerName={pendingPlayer.name}
          replacementCount={replacementTask?.remaining}
          options={pendingOptions}
          isOptionDisabled={(card) =>
            !game.pendingRefresh &&
            card.type === 'cookie' &&
            pendingPlayer.deck.length < card.hp
          }
          onSkipReplacement={
            game.pendingRefresh
              ? undefined
              : () =>
                  runAction(
                    (current) =>
                      skipDefeatedCookieReplacement(current),
                    '已選擇不補餅乾。',
                  )
          }
          onSelect={(instanceId) => {
            if (game.pendingRefresh) {
              runAction(
                (current) =>
                  refreshDeck(
                    current,
                    pendingPlayer.id,
                    instanceId,
                ),
                '牌庫 Refresh 已完成。',
                (nextGame) => {
                  const onPlay = nextGame.pendingOnPlay
                  if (!onPlay) return
                  const card = nextGame.players[
                    onPlay.playerId
                  ].battleArea.find(
                    (cookie) =>
                      cookie.card.instanceId ===
                      onPlay.sourceInstanceId,
                  )?.card
                  beginCookieSkill(
                    nextGame,
                    card,
                    onPlay.playerId,
                    'on-play',
                    'OnPlay 登場觸發',
                    true,
                  )
                },
              )
            } else {
              runAction(
                (current) =>
                  replaceDefeatedCookie(current, instanceId),
                '已補充新的戰鬥區餅乾。',
                (nextGame) => {
                  if (nextGame.pendingRefresh) return
                  const onPlay = nextGame.pendingOnPlay
                  if (!onPlay) return
                  const card = nextGame.players[
                    onPlay.playerId
                  ].battleArea.find(
                    (cookie) =>
                      cookie.card.instanceId ===
                      onPlay.sourceInstanceId,
                  )?.card
                  beginCookieSkill(
                    nextGame,
                    card,
                    onPlay.playerId,
                    'on-play',
                    'OnPlay 登場觸發',
                    true,
                  )
                },
              )
            }
          }}
        />
      )}

      {inspectedCard && (
        <CardDetailModal
          card={inspectedCard}
          onClose={() => setInspectedCard(null)}
        />
      )}

      {inspectedDiscardPlayerId && (
        <CardPileModal
          title={`${game.players[inspectedDiscardPlayerId].name}棄牌區`}
          cards={game.players[inspectedDiscardPlayerId].discardPile}
          onInspect={(card) => {
            setInspectedDiscardPlayerId(null)
            setInspectedCard(card)
          }}
          onClose={() => setInspectedDiscardPlayerId(null)}
        />
      )}

      {showPause && (
        <PauseModal
          turnNumber={game.turnNumber}
          phaseLabel={phaseLabels[game.phase]}
          onResume={() => setShowPause(false)}
        />
      )}

      {showDeckList && (
        <DeckListModal
          deckListOwner={deckListOwner}
          viewedDeck={deckConfig[deckListOwner]}
          onSetDeckListOwner={setDeckListOwner}
          onClose={() => setShowDeckList(false)}
        />
      )}

      {game.result && (
        <ResultModal
          winnerName={game.players[game.result.winnerId].name}
          loserId={game.result.loserId}
          viewerPlayerId={viewerPlayerId}
          reason={game.result.reason}
          onRestart={() => {
            resetGame(deckConfig, `我方 ${deckChoiceLabel[deckConfig.player]} vs AI ${deckChoiceLabel[deckConfig.ai]} 新對局。`)
          }}
        />
      )}
    </main>
  )
}

export default App
