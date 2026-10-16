import { describe, expect, it } from 'vitest'
import { createCardCheckDemoState, createCardNegativeDemoState, parseTestStateConfig } from './demo'
import { st9015Zones } from './st9-015-demo'

describe('ST9-015 physical Browser routes', () => {
  it('routes the original Item with the exact five-card post-payment boundary', () => {
    expect(parseTestStateConfig('?test-state=card:ST9-015', 'localhost')).toEqual({
      kind: 'card-check', cardNumber: 'ST9-015',
    })
    const state = createCardCheckDemoState('ST9-015')
    expect(state.players['player-one'].hand).toHaveLength(6)
    expect(state.players['player-one'].hand[0]?.id).toBe('ST9-015')
    expect(state.players['player-one'].supportArea[0]?.card.id).toBe('BS3-090')
    expect(state.players['player-one'].battleArea.map(entry => [entry.card.id, entry.hpCards.length])).toEqual([
      ['BS2-029', 5], ['ST9-006', 6], ['ST9-007', 5],
    ])
    expect(state.players['player-two'].battleArea.map(entry => [entry.card.id, entry.hpCards.length])).toEqual([
      ['ST6-003', 4], ['BS2-029', 5],
    ])
    expect(st9015Zones(state, 'player-one')).toHaveLength(60)
  })

  it('routes a paid high-hand state where draw is gated but the independent Then remains', () => {
    expect(parseTestStateConfig('?test-state=card-skill-negative:ST9-015', 'localhost')).toEqual({
      kind: 'card-negative', cardNumber: 'ST9-015', preferSkillSurface: true,
    })
    const state = createCardNegativeDemoState('ST9-015', { preferSkillSurface: true })
    expect(state.players['player-one'].hand).toHaveLength(7)
    expect(state.players['player-one'].supportArea[0]?.card.energyColor).toBe('blue')
    expect(st9015Zones(state, 'player-one')).toHaveLength(60)
  })

  it('routes a legal printed Item with no blue Support payment available', () => {
    expect(parseTestStateConfig('?test-state=card-negative:ST9-015', 'localhost')).toEqual({
      kind: 'card-negative', cardNumber: 'ST9-015',
    })
    const state = createCardNegativeDemoState('ST9-015')
    expect(state.players['player-one'].supportArea[0]?.card.id).toBe('BS3-018')
    expect(state.players['player-one'].supportArea[0]?.card.energyColor).toBe('red')
    expect(st9015Zones(state, 'player-one')).toHaveLength(60)
  })
})
