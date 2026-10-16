import { describe, expect, it } from 'vitest'
import { createCardCheckDemoState, createCardNegativeDemoState, parseTestStateConfig } from './demo'
import { st9012Zones } from './st9-012-demo'

describe('ST9-012 physical Browser routes', () => {
  it('routes the On Play positive state so deployment leaves exactly four cards', () => {
    expect(parseTestStateConfig('?test-state=card-skill:ST9-012', 'localhost')).toEqual({
      kind: 'card-check', cardNumber: 'ST9-012', preferSkillSurface: true,
    })
    const state = createCardCheckDemoState('ST9-012', { preferSkillSurface: true })
    expect(state.players['player-one'].hand).toHaveLength(5)
    expect(state.players['player-one'].hand[0]?.id).toBe('ST9-012')
    expect(state.players['player-one'].supportArea).toHaveLength(4)
    expect(state.players['player-one'].supportArea.every(support => support.card.energyColor === 'blue')).toBe(true)
    expect(st9012Zones(state, 'player-one')).toHaveLength(60)
  })

  it('keeps a six-card starting hand so the printed On Play condition fails after deployment', () => {
    expect(parseTestStateConfig('?test-state=card-skill-negative:ST9-012', 'localhost')).toEqual({
      kind: 'card-negative', cardNumber: 'ST9-012', preferSkillSurface: true,
    })
    const state = createCardNegativeDemoState('ST9-012', { preferSkillSurface: true })
    expect(state.players['player-one'].hand).toHaveLength(6)
    expect(state.players['player-one'].hand[0]?.id).toBe('ST9-012')
    expect(st9012Zones(state, 'player-one')).toHaveLength(60)
  })

  it('routes a legal real attack with and without the Sea Fairy witness', () => {
    expect(parseTestStateConfig('?test-state=card-attack:ST9-012', 'localhost')).toEqual({
      kind: 'card-check', cardNumber: 'ST9-012', normalAttack: 'payable',
    })
    const positive = createCardCheckDemoState('ST9-012', { normalAttack: 'payable' })
    expect(positive.players['player-one'].battleArea.map(cookie => cookie.card.id)).toEqual(['ST9-012', 'ST9-006'])
    expect(positive.players['player-one'].supportArea).toHaveLength(3)
    expect(positive.players['player-two'].battleArea).toHaveLength(1)
    expect(st9012Zones(positive, 'player-one')).toHaveLength(60)

    expect(parseTestStateConfig('?test-state=card-negative:ST9-012', 'localhost')).toEqual({
      kind: 'card-negative', cardNumber: 'ST9-012',
    })
    const negative = createCardNegativeDemoState('ST9-012')
    expect(negative.players['player-one'].battleArea.map(cookie => cookie.card.id)).toEqual(['ST9-012'])
    expect(negative.players['player-one'].supportArea).toHaveLength(3)
    expect(st9012Zones(negative, 'player-one')).toHaveLength(60)
  })

  it('routes a real BB attack whose remaining Support cannot pay the optional blue Then', () => {
    expect(parseTestStateConfig('?test-state=card-attack-then-unpayable:ST9-012', 'localhost')).toEqual({
      kind: 'card-check', cardNumber: 'ST9-012', normalAttack: 'payable',
      st9012Scenario: 'attack-then-unpayable',
    })
    const state = createCardCheckDemoState('ST9-012', { st9012Scenario: 'attack-then-unpayable' })
    expect(state.players['player-one'].battleArea.map(cookie => cookie.card.id)).toEqual(['ST9-012', 'ST9-006'])
    expect(state.players['player-one'].supportArea.map(support => support.card.energyColor)).toEqual([
      'blue', 'blue', 'red',
    ])
    expect(st9012Zones(state, 'player-one')).toHaveLength(60)
  })
})
