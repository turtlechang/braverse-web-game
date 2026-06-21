/// @vitest-environment jsdom

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createDemoGame, type GameState } from '../game'
import { useMatchAnimations } from './useMatchAnimations'

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

afterEach(() => {
  vi.useRealTimers()
})

describe('useMatchAnimations', () => {
  it('marks newly drawn cards and clears the animation after 700ms', async () => {
    vi.useFakeTimers()
    let captured: ReturnType<typeof useMatchAnimations> | null = null

    function TestHarness() {
      captured = useMatchAnimations()
      return null
    }

    const container = document.createElement('div')
    const root = createRoot(container)
    await act(() => root.render(<TestHarness />))

    const previous = createDemoGame()
    const drawnCard = previous.players['player-one'].deck[0]
    const next: GameState = {
      ...previous,
      players: {
        ...previous.players,
        'player-one': {
          ...previous.players['player-one'],
          hand: [...previous.players['player-one'].hand, drawnCard],
          deck: previous.players['player-one'].deck.slice(1),
        },
      },
    }

    await act(() => captured!.observeTransition(previous, next))
    expect(captured!.drawAnimIds.has(drawnCard.instanceId)).toBe(true)

    await act(() => vi.advanceTimersByTime(700))
    expect(captured!.drawAnimIds.size).toBe(0)

    await act(() => root.unmount())
  })
})
