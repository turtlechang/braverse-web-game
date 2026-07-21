/** @vitest-environment jsdom */

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { GameCard, PendingBattle } from '../game'
import {
  FLIP_CARD_PREVIEW_DURATION,
  useFlipCardPreview,
} from './useFlipCardPreview'

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

const flipCard: GameCard = {
  id: 'ST5-022',
  instanceId: 'flip-card-one',
  name: 'FLIP Cookie',
  type: 'item',
  flip: {
    text: 'Draw 1 card.',
    cost: {},
    effects: [],
  },
}

const flipBattle = (card = flipCard): PendingBattle => ({
  attackerPlayerId: 'player-one',
  defenderPlayerId: 'player-two',
  attackerInstanceId: 'attacker',
  targetInstanceId: 'defender',
  declaredDamage: 1,
  remainingDamage: 1,
  stage: 'flip',
  trapUsed: false,
  revealedHpCard: card,
  preventKnockoutTargetIds: [],
  faintedColors: [],
  attackEffects: [],
  attackEffectIndex: 0,
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useFlipCardPreview', () => {
  it('shows the attacking player the FLIP card for three seconds', async () => {
    vi.useFakeTimers()
    let preview: ReturnType<typeof useFlipCardPreview> | null = null

    function TestHarness() {
      preview = useFlipCardPreview(flipBattle(), 'player-one')
      return null
    }

    const container = document.createElement('div')
    const root = createRoot(container)
    await act(() => root.render(<TestHarness />))

    expect(preview!.card).toBe(flipCard)
    await act(() => vi.advanceTimersByTime(FLIP_CARD_PREVIEW_DURATION - 1))
    expect(preview!.card).toBe(flipCard)

    await act(() => vi.advanceTimersByTime(1))
    expect(preview!.card).toBeNull()

    await act(() => root.unmount())
    container.remove()
  })

  it('can dismiss the current FLIP preview without re-opening it', async () => {
    vi.useFakeTimers()
    let preview: ReturnType<typeof useFlipCardPreview> | null = null

    function TestHarness({ battle }: { battle: PendingBattle | null }) {
      preview = useFlipCardPreview(battle, 'player-one')
      return null
    }

    const container = document.createElement('div')
    const root = createRoot(container)
    const battle = flipBattle()
    await act(() => root.render(<TestHarness battle={battle} />))

    await act(() => preview!.dismiss())
    expect(preview!.card).toBeNull()

    await act(() => root.render(<TestHarness battle={{ ...battle }} />))
    expect(preview!.card).toBeNull()

    const nextCard = { ...flipCard, instanceId: 'flip-card-two' }
    await act(() => root.render(<TestHarness battle={flipBattle(nextCard)} />))
    expect(preview!.card).toBe(nextCard)

    await act(() => root.unmount())
    container.remove()
  })

  it('does not open the attack preview when the viewer is defending', async () => {
    let preview: ReturnType<typeof useFlipCardPreview> | null = null

    function TestHarness() {
      preview = useFlipCardPreview(flipBattle(), 'player-two')
      return null
    }

    const container = document.createElement('div')
    const root = createRoot(container)
    await act(() => root.render(<TestHarness />))

    expect(preview!.card).toBeNull()

    await act(() => root.unmount())
    container.remove()
  })
})
