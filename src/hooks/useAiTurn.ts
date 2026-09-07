import { useCallback, useEffect, useRef, useState } from 'react'
import type { GameState } from '../game'
import {
  createDemoGame,
  simulateAiMatch,
  takeAiStep,
} from '../game'
import type { AiLevel, AiMatchResult } from '../game'
import type { AiDecision } from '../game'
import type { AiStrategyMemory } from '../game'
import type { BuiltInDeckChoice, DeckChoice } from '../game'
import type { BattleReplayAiDecision, BattleReplayAiMetadata } from '../game'
import type { CustomDeck } from '../game/custom-deck'
import { AI_STRATEGY_VERSION } from '../game'

const aiSimulationSeeds = Array.from({ length: 20 }, (_, index) => index + 1)

export function useAiTurn(params: {
  game: GameState
  setGame: (value: GameState | ((prev: GameState) => GameState)) => void
  setMessage: (value: string) => void
  showPause: boolean
  aiControlsCurrentState: boolean
  pendingEffect: unknown | null
  faintActive: boolean
  afterDamageActive: boolean
  deckConfig: { player: DeckChoice; ai: BuiltInDeckChoice }
  playerCustomDeck?: CustomDeck | null
  aiLevel?: AiLevel
  strategyCommit?: string | null
  maxConsecutiveActions?: number
}) {
  const {
    game,
    setGame,
    setMessage,
    showPause,
    aiControlsCurrentState,
    pendingEffect,
    faintActive,
    afterDamageActive,
    deckConfig,
    playerCustomDeck,
    aiLevel = 4,
    strategyCommit = null,
    maxConsecutiveActions = 200,
  } = params

  const [aiThinking, setAiThinking] = useState(false)
  const [aiActionCount, setAiActionCount] = useState(0)
  const [simulationResults, setSimulationResults] =
    useState<AiMatchResult[] | null>(null)
  const [pendingAiDecision, setPendingAiDecision] =
    useState<AiDecision | null>(null)
  const [replayDecisions, setReplayDecisions] = useState<BattleReplayAiDecision[]>([])
  const aiThinkingTimerRef = useRef<number | null>(null)
  const aiActionTimerRef = useRef<number | null>(null)
  const consecutiveAiActionCountRef = useRef(0)
  const aiStrategyMemoryRef = useRef<AiStrategyMemory | null>(null)
  const replayDecisionsRef = useRef<BattleReplayAiDecision[]>([])

  const recordAiDecision = useCallback(
    (decision: AiDecision, previousState: GameState) => {
      const previousLogId = previousState.commandLog?.at(-1)?.id ?? null
      const currentLogId = decision.state.commandLog?.at(-1)?.id ?? null
      const reason = decision.reason
        ? (() => {
            const { strategyMemory, ...publicReason } = decision.reason!
            void strategyMemory
            return publicReason
          })()
        : undefined
      const entry: BattleReplayAiDecision = {
        commandLogId:
          currentLogId !== null && currentLogId !== previousLogId
            ? currentLogId
            : null,
        playerId: 'player-two',
        action: decision.action,
        description: decision.description,
        ...(reason ? { reason } : {}),
      }
      replayDecisionsRef.current = [...replayDecisionsRef.current, entry]
      setReplayDecisions(replayDecisionsRef.current)
    },
    [],
  )

  useEffect(() => {
    if (!aiControlsCurrentState) {
      consecutiveAiActionCountRef.current = 0
      return
    }

    if (
      showPause ||
      game.status !== 'playing' ||
      pendingEffect ||
      faintActive ||
      afterDamageActive ||
      pendingAiDecision
    ) {
      return
    }

    if (consecutiveAiActionCountRef.current >= maxConsecutiveActions) {
      setMessage(
        `AI 停止：連續自動操作已達 ${maxConsecutiveActions} 步安全上限。`,
      )
      return
    }

    const thinkingTimer = (window.setTimeout(
      () => setAiThinking(true),
      0,
    ) as unknown) as number
    aiThinkingTimerRef.current = thinkingTimer
    const timer = (window.setTimeout(() => {
      const decision = takeAiStep(game, 'player-two', {
        level: aiLevel,
        memory: aiStrategyMemoryRef.current ?? undefined,
      })
      if (decision.reason?.strategyMemory) {
        aiStrategyMemoryRef.current = decision.reason.strategyMemory
      }
      setAiThinking(false)

      if (decision.action === 'error' || decision.state === game) {
        setMessage(`AI 停止：${decision.description}`)
        return
      }

      if (decision.revealedCards?.length) {
        setPendingAiDecision(decision)
        setMessage(
          `AI 棄置 ${decision.revealedCards.length} 張卡牌，等待公開確認。`,
        )
        return
      }

      if (decision.revealedCard) {
        // 實驗性：單張卡牌公開（如 FLIP）不再暫停等待玩家點擊確認，改由 toast 訊息帶出。
        setGame(decision.state)
        recordAiDecision(decision, game)
        setMessage(`AI 公開 ${decision.revealedCard.name}：${decision.description}`)
        consecutiveAiActionCountRef.current += 1
        setAiActionCount((count) => count + 1)
        return
      }

      setGame(decision.state)
      recordAiDecision(decision, game)
      setMessage(`AI：${decision.description}`)
      consecutiveAiActionCountRef.current += 1
      setAiActionCount((count) => count + 1)
    }, 450) as unknown) as number
    aiActionTimerRef.current = timer

    return () => {
      setAiThinking(false)
      if (aiThinkingTimerRef.current !== null) {
        window.clearTimeout(aiThinkingTimerRef.current)
        aiThinkingTimerRef.current = null
      }
      if (aiActionTimerRef.current !== null) {
        window.clearTimeout(aiActionTimerRef.current)
        aiActionTimerRef.current = null
      }
    }
  }, [
    aiActionCount,
    aiControlsCurrentState,
    aiLevel,
    faintActive,
    afterDamageActive,
    game,
    maxConsecutiveActions,
    pendingEffect,
    pendingAiDecision,
    recordAiDecision,
    showPause,
    setGame,
    setMessage,
  ])

  const runSimulation = useCallback(() => {
    const results = aiSimulationSeeds.map((seed) =>
      simulateAiMatch(
        createDemoGame(seed, deckConfig, playerCustomDeck ?? undefined),
      ),
    )
    setSimulationResults(results)
    const completed = results.filter((result) => !result.stuck).length
    setMessage(`AI 驗證完成：${completed}/20 場正常結束。`)
  }, [deckConfig, playerCustomDeck, setMessage])

  const resetAiCounts = useCallback(() => {
    setAiActionCount(0)
    setSimulationResults(null)
    setPendingAiDecision(null)
    consecutiveAiActionCountRef.current = 0
    aiStrategyMemoryRef.current = null
    replayDecisionsRef.current = []
    setReplayDecisions([])
  }, [])

  const confirmAiDecision = useCallback(() => {
    if (!pendingAiDecision) return
    setGame(pendingAiDecision.state)
    recordAiDecision(pendingAiDecision, game)
    setMessage(`AI：${pendingAiDecision.description}`)
    consecutiveAiActionCountRef.current += 1
    setAiActionCount((count) => count + 1)
    setPendingAiDecision(null)
  }, [game, pendingAiDecision, recordAiDecision, setGame, setMessage])

  const dismissSimulation = useCallback(() => {
    setSimulationResults(null)
  }, [])

  return {
    aiThinking,
    aiActionCount,
    simulationResults,
    pendingAiDecision,
    confirmAiDecision,
    resetAiCounts,
    dismissSimulation,
    runSimulation,
    replayMetadata: {
      agents: {
        'player-two': {
          aiLevel,
          strategyVersion: AI_STRATEGY_VERSION,
          strategyCommit,
        },
      },
      decisions: replayDecisions,
    } satisfies BattleReplayAiMetadata,
  } as const
}
