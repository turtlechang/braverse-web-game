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

  it('resets the consecutive action safety limit after control returns to the player', async () => {
    vi.useFakeTimers()
    const baseGame = {
      ...createDemoGame(),
      activePlayerId: 'player-two' as const,
    }
    const setGame = vi.fn()
    const setMessage = vi.fn()
    let captured: ReturnType<typeof useAiTurn> | null = null

    function TestHarness({
      aiControls,
      game,
    }: {
      aiControls: boolean
      game: typeof baseGame
    }) {
      captured = useAiTurn({
        game,
        setGame,
        setMessage,
        showPause: false,
        aiControlsCurrentState: aiControls,
        pendingEffect: null,
        faintActive: false,
        deckConfig: { player: 'red', ai: 'red' },
        maxConsecutiveActions: 1,
      })
      return null
    }

    const container = document.createElement('div')
    const root = createRoot(container)
    await act(() => root.render(
      <TestHarness aiControls game={{ ...baseGame }} />,
    ))
    await act(() => vi.advanceTimersByTime(450))
    expect(captured!.aiActionCount).toBe(1)

    await act(() => root.render(
      <TestHarness aiControls game={{ ...baseGame }} />,
    ))
    expect(setMessage).toHaveBeenLastCalledWith(
      'AI 停止：連續自動操作已達 1 步安全上限。',
    )

    await act(() => root.render(
      <TestHarness aiControls={false} game={{ ...baseGame }} />,
    ))
    await act(() => root.render(
      <TestHarness aiControls game={{ ...baseGame }} />,
    ))
    await act(() => vi.advanceTimersByTime(450))
    expect(captured!.aiActionCount).toBe(2)

    await act(() => root.unmount())
    vi.useRealTimers()
  })
})
