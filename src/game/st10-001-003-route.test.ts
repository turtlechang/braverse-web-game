import { describe, expect, it } from 'vitest'
import { createCardCheckDemoState, createCardNegativeDemoState, parseTestStateConfig } from './demo'
import { st10001To003Zones } from './st10-001-003-demo'

describe('ST10-001–003 original-printing Browser routes', () => {
  it.each(['ST10-001', 'ST10-003'] as const)('routes %s to its physical attack fixture', cardNumber => {
    expect(parseTestStateConfig(`?test-state=card:${cardNumber}`, 'localhost'))
      .toEqual({ kind: 'card-check', cardNumber })
    const state = createCardCheckDemoState(cardNumber)
    expect(state.players['player-one'].battleArea[0].card.id).toBe(cardNumber)
    expect(state.players['player-one'].battleArea[0].card.imageUrl).toMatch(/^https:\/\/cookierunbraverse\.com\//)
    expect(state.players['player-one'].battleArea[0].hpCards).toHaveLength(state.players['player-one'].battleArea[0].card.hp)
    expect(state.players['player-one'].supportArea).toHaveLength(3)
    expect(st10001To003Zones(state, 'player-one')).toHaveLength(60)
    expect(state.players['player-two'].battleArea[0].hpCards[1]?.id).toBe(cardNumber)
  })

  it.each(['ST10-001', 'ST10-003'] as const)('routes insufficient-payment %s to an illegal-attack control', cardNumber => {
    expect(parseTestStateConfig(`?test-state=card-negative:${cardNumber}`, 'localhost'))
      .toEqual({ kind: 'card-negative', cardNumber })
    const state = createCardNegativeDemoState(cardNumber)
    expect(state.players['player-one'].battleArea[0].card.id).toBe(cardNumber)
    expect(state.players['player-one'].supportArea).toHaveLength(2)
    expect(st10001To003Zones(state, 'player-one')).toHaveLength(60)
  })
})
