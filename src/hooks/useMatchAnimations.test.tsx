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

async function harness() {
  let current: ReturnType<typeof useMatchAnimations> | null = null
  function Harness() { current = useMatchAnimations(); return null }
  const root = createRoot(document.createElement('div'))
  await act(() => root.render(<Harness />))
  return { get animation() { return current! }, close: () => act(() => root.unmount()) }
}

describe('ordered animation lifecycle', () => {
  it('deduplicates receipts and keeps the next event after the first timeout', async () => {
    vi.useFakeTimers()
    const h = await harness()
    const events = [{id:'one',kind:'turn' as const,label:'回合',duration:400},{id:'two',kind:'finish' as const,label:'勝利',duration:1000}]
    await act(() => { h.animation.enqueue(events); h.animation.enqueue(events) })
    expect(h.animation.activeEvents[0].id).toBe('one')
    await act(() => vi.advanceTimersByTime(400))
    expect(h.animation.activeEvents[0].id).toBe('two')
    await act(() => vi.advanceTimersByTime(1000))
    expect(h.animation.isPlaying).toBe(false)
    await h.close()
  })
  it('skip cancels timers without replaying acknowledged events', async () => {
    vi.useFakeTimers()
    const h = await harness()
    const event={id:'skip',kind:'finish' as const,label:'勝利',duration:1000}
    await act(() => h.animation.enqueue([event]))
    await act(() => h.animation.skip())
    await act(() => {h.animation.enqueue([event]);vi.advanceTimersByTime(1000)})
    expect(h.animation.activeEvents).toEqual([])
    expect(vi.getTimerCount()).toBe(0)
    await h.close()
  })
  it('uses half duration in fast mode and zero waiting in reduced mode', async () => {
    vi.useFakeTimers()
    const h=await harness()
    await act(()=>h.animation.setSpeed('fast'))
    await act(()=>h.animation.enqueue([{id:'fast',kind:'turn',label:'回合',duration:400}]))
    expect(h.animation.duration).toBe(200)
    await act(()=>h.animation.setSpeed('reduced'))
    await act(()=>h.animation.enqueue([{id:'reduced',kind:'turn',label:'回合',duration:400}]))
    expect(h.animation.isPlaying).toBe(false)
    expect(h.animation.isBusy()).toBe(false)
    await h.close()
    localStorage.clear()
  })
  it('clears animations on visibility changes and on unmount', async () => {
    vi.useFakeTimers()
    const h=await harness()
    await act(()=>h.animation.enqueue([{id:'background',kind:'turn',label:'回合',duration:400}]))
    await act(()=>document.dispatchEvent(new Event('visibilitychange')))
    expect(h.animation.isPlaying).toBe(false)
    await h.close()
    expect(vi.getTimerCount()).toBe(0)
  })
})
