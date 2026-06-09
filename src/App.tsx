import { useEffect, useState } from 'react'
import { Eye, Sparkles, Swords } from 'lucide-react'
import './App.css'
import {
  activateCookieSkill,
  advancePhase,
  attackCookie,
  canActivateCookieSkill,
  createDemoGame,
  deployCookie,
  executeCardEffect,
  getAttackEnergyCost,
  getBreakToTrashCandidates,
  getEffectTargetCandidates,
  getRefreshCandidates,
  isEffectConditionMet,
  isEffectUntargeted,
  placeSupportCard,
  refreshDeck,
  replaceDefeatedCookie,
  simulateAiMatch,
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
  AiStatusPanel,
  SimulationReport,
} from './components/panels/GameStatusPanels'
import { phaseLabels, deckChoiceLabel } from './components/gameUiLabels'
import { describeEffectResult } from './components/effects/effectUiUtils'
import { EffectPanel } from './components/effects/EffectPanel'
import type { PendingEffect } from './components/effects/effectUiTypes'
import { createBreakToTrashDemoState, parseTestStateConfig } from './game/demo'
import {
  DecisionModal,
  CardDetailModal,
  PauseModal,
  DeckListModal,
  ResultModal,
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
    if (testStateConfig) return createBreakToTrashDemoState(testStateConfig.level)
    return createDemoGame()
  })
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
    if (testStateConfig) {
      return testStateConfig.level === 1
        ? '測試狀態：休息區有 1 張 LV.1 餅乾。'
        : '測試狀態：休息區有 1 張 LV.2 餅乾。'
    }
    return '推進階段，開始這場對戰。'
  })
  const [effectHistory, setEffectHistory] = useState<string[]>([])
  const [pendingEffect, setPendingEffect] =
    useState<PendingEffect | null>(null)
  const [inspectedCard, setInspectedCard] = useState<GameCard | null>(null)
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
    setGame(createDemoGame(undefined, nextConfig))
    setSelectedAttackerId(null)
    setSelectedAttackPaymentIds([])
    setPendingEffect(null)
    setEffectHistory([])
    setAiActionCount(0)
    setSimulationResults(null)
    setMessage(nextMessage)
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
  const aiControlsCurrentState =
    game.activePlayerId === 'player-two' ||
    game.pendingRefresh?.playerId === 'player-two' ||
    game.pendingReplacementPlayerId === 'player-two'

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
        attackCookie(
          current,
          selectedAttackerId,
          targetInstanceId,
          selectedAttackPaymentIds,
      ),
      `${attacker?.card.name ?? '餅乾'}完成攻擊。`,
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

      setGame(nextGame)
      setMessage(result)
      setEffectHistory((history) => [result, ...history].slice(0, 4))
      setPendingEffect(
        nextEffectIndex < pendingEffect.effects.length
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
    game.pendingRefresh?.playerId ?? game.pendingReplacementPlayerId
  const pendingPlayer = pendingPlayerId
    ? game.players[pendingPlayerId]
    : null
  const pendingOptions = game.pendingRefresh
    ? getRefreshCandidates(game, game.pendingRefresh.playerId)
    : pendingPlayer?.hand.filter((card) => card.type === 'cookie') ?? []
  const interactionLocked =
    Boolean(pendingEffect) || aiThinking || aiControlsCurrentState

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
          Boolean(game.pendingReplacementPlayerId) ||
          Boolean(game.pendingRefresh) ||
          Boolean(pendingEffect)
        }
        onAdvance={handleAdvancePhase}
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
              (nextGame) =>
                beginCookieSkill(
                  nextGame,
                  nextGame.players[activePlayer.id].battleArea.find(
                    (cookie) => cookie.card.instanceId === instanceId,
                  )?.card,
                  activePlayer.id,
                  'on-play',
                  'OnPlay 登場觸發',
                  true,
                ),
            )
          }
          onInspectCard={setInspectedCard}
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

      <AiStatusPanel
        aiThinking={aiThinking}
        aiActionCount={aiActionCount}
        onRunSimulation={runSimulation}
      />

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

      <button
        className="inspect-hand-button"
        type="button"
        onClick={() =>
          setInspectedCard(game.players[viewerPlayerId].hand[0] ?? null)
        }
      >
        <Eye aria-hidden="true" />
        <span>查看卡牌</span>
      </button>

      {pendingPlayer && pendingPlayer.id !== 'player-two' && (
        <DecisionModal
          isRefresh={Boolean(game.pendingRefresh)}
          playerName={pendingPlayer.name}
          options={pendingOptions}
          isOptionDisabled={(card) =>
            !game.pendingRefresh &&
            card.type === 'cookie' &&
            pendingPlayer.deck.length < card.hp
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
              )
            } else {
              runAction(
                (current) =>
                  replaceDefeatedCookie(current, instanceId),
                '已補充新的戰鬥區餅乾。',
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
