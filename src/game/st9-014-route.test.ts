import { describe, expect, it } from 'vitest'
import { createCardCheckDemoState, createCardNegativeDemoState, parseTestStateConfig } from './demo'
import { st9014Zones } from './st9-014-demo'

describe('ST9-014 physical Browser routes', () => {
  it('routes the payable original Item with two blue Supports and three physical discard types', () => {
    expect(parseTestStateConfig('?test-state=card:ST9-014', 'localhost')).toEqual({
      kind: 'card-check', cardNumber: 'ST9-014',
    })
    const state = createCardCheckDemoState('ST9-014')
    expect(state.players['player-one'].hand.map(card => [card.id, card.type])).toEqual([
      ['ST9-014', 'item'], ['ST6-001', 'cookie'], ['BS3-018', 'item'], ['ST8-019', 'trap'],
    ])
    expect(state.players['player-one'].supportArea.map(support => [support.card.id, support.card.energyColor])).toEqual([
      ['BS3-090', 'blue'], ['BS3-090', 'blue'],
    ])
    expect(state.players['player-one'].battleArea.map(cookie => cookie.card.id)).toEqual(['ST9-002', 'ST9-001'])
    expect(st9014Zones(state, 'player-one')).toHaveLength(60)
    expect(st9014Zones(state, 'player-two')).toHaveLength(60)
  })

  it('routes an insufficient three-card hand with legal BB energy', () => {
    expect(parseTestStateConfig('?test-state=card-skill-negative:ST9-014', 'localhost')).toEqual({
      kind: 'card-negative', cardNumber: 'ST9-014', preferSkillSurface: true,
    })
    const state = createCardNegativeDemoState('ST9-014', { preferSkillSurface: true })
    expect(state.players['player-one'].hand.map(card => card.id)).toEqual(['ST9-014', 'ST6-001', 'BS3-018'])
    expect(state.players['player-one'].supportArea).toHaveLength(2)
    expect(state.players['player-one'].supportArea.every(support => support.card.energyColor === 'blue')).toBe(true)
    expect(st9014Zones(state, 'player-one')).toHaveLength(60)
  })

  it('routes enough discard cards but no blue B payment', () => {
    expect(parseTestStateConfig('?test-state=card-negative:ST9-014', 'localhost')).toEqual({
      kind: 'card-negative', cardNumber: 'ST9-014',
    })
    const state = createCardNegativeDemoState('ST9-014')
    expect(state.players['player-one'].hand.map(card => card.id)).toEqual([
      'ST9-014', 'ST6-001', 'BS3-018', 'ST8-019',
    ])
    expect(state.players['player-one'].supportArea.map(support => support.card.energyColor)).toEqual(['red'])
    expect(st9014Zones(state, 'player-one')).toHaveLength(60)
  })

  it('keeps the no-own-Cookie optional target path physically legal', () => {
    const state = createCardCheckDemoState('ST9-014', { st9014Scenario: 'no-cookies' })
    expect(state.players['player-one'].battleArea).toEqual([])
    expect(state.players['player-two'].battleArea).toHaveLength(1)
    expect(st9014Zones(state, 'player-one')).toHaveLength(60)
    expect(st9014Zones(state, 'player-two')).toHaveLength(60)
  })
})
