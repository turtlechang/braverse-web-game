import { describe, expect, it } from 'vitest'
import { createCardCheckDemoState, createCardNegativeDemoState, parseTestStateConfig } from './demo'
import { st9001To003Zones } from './st9-001-003-demo'

describe('ST9-001–003 original-printing Browser routes', () => {
  it.each(['ST9-001', 'ST9-002', 'ST9-003'] as const)('routes %s to its physical attack fixture', cardNumber => {
    expect(parseTestStateConfig(`?test-state=card:${cardNumber}`, 'localhost'))
      .toEqual({ kind: 'card-check', cardNumber })
    const state = createCardCheckDemoState(cardNumber)
    expect(state.players['player-one'].battleArea[0].card.id).toBe(cardNumber)
    expect(state.players['player-one'].battleArea[0].card.imageUrl).toMatch(/^https:\/\/cookierunbraverse\.com\//)
    expect(state.players['player-one'].battleArea[0].hpCards).toHaveLength(state.players['player-one'].battleArea[0].card.hp)
    expect(st9001To003Zones(state, 'player-one')).toHaveLength(60)
    expect(state.players['player-one'].supportArea.length).toBe(cardNumber === 'ST9-002' ? 1 : 3)
  })

  it.each(['ST9-001', 'ST9-002', 'ST9-003'] as const)('routes insufficient-payment %s to an illegal-attack control', cardNumber => {
    expect(parseTestStateConfig(`?test-state=card-negative:${cardNumber}`, 'localhost'))
      .toEqual({ kind: 'card-negative', cardNumber })
    const state = createCardNegativeDemoState(cardNumber)
    expect(state.players['player-one'].battleArea[0].card.id).toBe(cardNumber)
    expect(state.players['player-one'].supportArea.length).toBe(cardNumber === 'ST9-002' ? 0 : 2)
    expect(st9001To003Zones(state, 'player-one')).toHaveLength(60)
  })
})
