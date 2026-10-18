import { describe, expect, it } from 'vitest'
import { createCardCheckDemoState, createCardNegativeDemoState, parseTestStateConfig } from './demo'
import { st9013Zones } from './st9-013-demo'

describe('ST9-013 physical Browser routes', () => {
  it('routes the payable real Item with a blue hand card and blue Support', () => {
    expect(parseTestStateConfig('?test-state=card:ST9-013', 'localhost')).toEqual({
      kind: 'card-check', cardNumber: 'ST9-013',
    })
    const state = createCardCheckDemoState('ST9-013')
    expect(state.players['player-one'].hand.map(card => card.id)).toEqual([
      'ST9-013', 'ST9-002', 'ST6-001',
    ])
    expect(state.players['player-one'].supportArea.map(support => support.card.id)).toEqual(['BS3-090'])
    expect(state.players['player-one'].supportArea[0]?.card.energyColor).toBe('blue')
    expect(st9013Zones(state, 'player-one')).toHaveLength(60)
  })

  it('routes a blue-cost discard boundary when no blue hand card is present', () => {
    expect(parseTestStateConfig('?test-state=card-skill-negative:ST9-013', 'localhost')).toEqual({
      kind: 'card-negative', cardNumber: 'ST9-013', preferSkillSurface: true,
    })
    const state = createCardNegativeDemoState('ST9-013', { preferSkillSurface: true })
    expect(state.players['player-one'].hand.map(card => card.id)).toEqual(['ST9-013', 'ST6-001'])
    expect(state.players['player-one'].supportArea[0]?.card.energyColor).toBe('blue')
    expect(st9013Zones(state, 'player-one')).toHaveLength(60)
  })

  it('routes a payment boundary when no active blue Support is present', () => {
    expect(parseTestStateConfig('?test-state=card-negative:ST9-013', 'localhost')).toEqual({
      kind: 'card-negative', cardNumber: 'ST9-013',
    })
    const state = createCardNegativeDemoState('ST9-013')
    expect(state.players['player-one'].hand.map(card => card.id)).toEqual([
      'ST9-013', 'ST9-002', 'ST6-001',
    ])
    expect(state.players['player-one'].supportArea[0]?.card.id).toBe('BS3-018')
    expect(state.players['player-one'].supportArea[0]?.card.energyColor).toBe('red')
    expect(st9013Zones(state, 'player-one')).toHaveLength(60)
  })
})
