import { describe, expect, it } from 'vitest'
import { createCardCheckDemoState, createCardNegativeDemoState, parseTestStateConfig } from './demo'
import { st9010To011Zones } from './st9-010-011-demo'

describe('ST9-010–011 physical Browser routes', () => {
  it.each(['ST9-010', 'ST9-011'] as const)('routes %s to a real paid-FLIP attack fixture', cardNumber => {
    expect(parseTestStateConfig(`?test-state=card:${cardNumber}`, 'localhost'))
      .toEqual({ kind: 'card-check', cardNumber })
    const state = createCardCheckDemoState(cardNumber)
    const flipped = state.players['player-two'].battleArea[0]?.hpCards.at(-1)
    expect(state.players['player-one'].battleArea[0]?.card.id).toBe('ST9-002')
    expect(state.players['player-two'].battleArea[0]?.card.id).toBe('ST6-003')
    expect(flipped?.id).toBe(cardNumber)
    expect(state.players['player-two'].hand).toHaveLength(1)
    expect(st9010To011Zones(state, 'player-one')).toHaveLength(60)
    expect(st9010To011Zones(state, 'player-two')).toHaveLength(60)
  })

  it.each(['ST9-010', 'ST9-011'] as const)('routes %s no-payment control to a non-activatable FLIP', cardNumber => {
    expect(parseTestStateConfig(`?test-state=card-negative:${cardNumber}`, 'localhost'))
      .toEqual({ kind: 'card-negative', cardNumber })
    const state = createCardNegativeDemoState(cardNumber)
    expect(state.players['player-two'].battleArea[0]?.hpCards.at(-1)?.id).toBe(cardNumber)
    expect(state.players['player-two'].hand).toHaveLength(0)
    expect(st9010To011Zones(state, 'player-two')).toHaveLength(60)
  })
})
