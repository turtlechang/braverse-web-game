import { useCallback, useEffect, useRef, useState } from 'react'
import type { GameState } from '../game'
import {
  createDemoGame,
  simulateAiMatch,
  takeAiStep,
} from '../game'
import type { AiMatchResult } from '../game'
import type { AiDecision } from '../game'
import type { DeckChoice } from '../game'

const aiSimulationSeeds = Array.from({ length: 20 }, (_, index) => index + 1)

export function useAiTurn(params: {
  game: GameState
  setGame: (value: GameState | ((prev: GameState) => GameState)) => void
  setMessage: (value: string) => void
  showPause: boolean
  aiControlsCurrentState: boolean
  pendingEffect: unknown | null
  faintActive: boolean
  deckConfig: { player: DeckChoice; ai: DeckChoice }
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
    deckConfig,
    maxConsecutiveActions = 200,
  } = params

  const [aiThinking, setAiThinking] = useState(false)
  const [aiActionCount, setAiActionCount] = useState(0)
  const [simulationResults, setSimulationResults] =
    useState<AiMatchResult[] | null>(null)
  const [pendingAiDecision, setPendingAiDecision] =
    useState<AiDecision | null>(null)
  const aiThinkingTimerRef = useRef<number | null>(null)
  const aiActionTimerRef = useRef<number | null>(null)
  const consecutiveAiActionCountRef = useRef(0)

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
      const decision = takeAiStep(game, 'player-two')
      setAiThinking(false)

      if (decision.action === 'error' || decision.state === game) {
        setMessage(`AI 停止：${decision.description}`)
        return
      }

      if (decision.revealedCard) {
        setPendingAiDecision(decision)
        setMessage(`AI 公開${decision.revealedCard.name}，等待確認。`)
        return
      }

      setGame(decision.state)
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
    faintActive,
    game,
    maxConsecutiveActions,
    pendingEffect,
    pendingAiDecision,
    showPause,
    setGame,
    setMessage,
  ])

  const runSimulation = useCallback(() => {
    const results = aiSimulationSeeds.map((seed) =>
      simulateAiMatch(createDemoGame(seed, deckConfig)),
    )
    setSimulationResults(results)
    const completed = results.filter((result) => !result.stuck).length
    setMessage(`AI 驗證完成：${completed}/20 場正常結束。`)
  }, [deckConfig, setMessage])

  const resetAiCounts = useCallback(() => {
    setAiActionCount(0)
    setSimulationResults(null)
    setPendingAiDecision(null)
    consecutiveAiActionCountRef.current = 0
  }, [])

  const confirmAiDecision = useCallback(() => {
    if (!pendingAiDecision) return
    setGame(pendingAiDecision.state)
    setMessage(`AI：${pendingAiDecision.description}`)
    consecutiveAiActionCountRef.current += 1
    setAiActionCount((count) => count + 1)
    setPendingAiDecision(null)
  }, [pendingAiDecision, setGame, setMessage])

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
  } as const
}
