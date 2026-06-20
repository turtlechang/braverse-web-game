/// @vitest-environment jsdom

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it, vi } from 'vitest'
import { createDemoGame } from '../game'
import { useAiTurn } from './useAiTurn'

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

describe('useAiTurn', () => {
  it('clears aiThinking when AI no longer controls the current state', async () => {
    vi.useFakeTimers()
    const game = createDemoGame()
    const setGame = vi.fn()
    const setMessage = vi.fn()
    let captured: ReturnType<typeof useAiTurn> | null = null

    function TestHarness({ aiControls }: { aiControls: boolean }) {
      captured = useAiTurn({
        game,
        setGame,
        setMessage,
        showPause: false,
        aiControlsCurrentState: aiControls,
        pendingEffect: null,
        faintActive: false,
        deckConfig: { player: 'red', ai: 'red' },
      })
      return null
    }

    const container = document.createElement('div')
    const root = createRoot(container)
    await act(() => root.render(<TestHarness aiControls />))
    await act(() => vi.advanceTimersByTime(0))
    expect(captured!.aiThinking).toBe(true)

    await act(() => root.render(<TestHarness aiControls={false} />))
    expect(captured!.aiThinking).toBe(false)

    await act(() => root.unmount())
    vi.useRealTimers()
  })
})
