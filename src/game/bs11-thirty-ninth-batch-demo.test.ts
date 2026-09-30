import { describe, expect, it } from 'vitest'
import {
  createBs11088105AttackThenDemoState,
  createBs11088OnPlayDemoState,
  parseTestStateConfig,
} from './demo'

const cardNumbers = ['BS11-088', 'BS11-088@1', 'BS11-105'] as const

describe('BS11-088／088@1／105 attack Then Browser fixture', () => {
  it.each(cardNumbers)('parses positive and negative routes for %s', (cardNumber) => {
    expect(parseTestStateConfig(
      `?test-state=bs11-088-105-attack-then%3A${cardNumber}%3Apositive`,
      'localhost',
    )).toEqual({
      kind: 'bs11-088-105-attack-then',
      cardNumber,
      conditionMet: true,
    })
    expect(parseTestStateConfig(
      `?test-state=bs11-088-105-attack-then%3A${cardNumber}%3Anegative`,
      'localhost',
    )).toEqual({
      kind: 'bs11-088-105-attack-then',
      cardNumber,
      conditionMet: false,
    })
  })

  it('sets the opponent trash threshold only for BS11-088 variants', () => {
    const positive = createBs11088105AttackThenDemoState('BS11-088', true)
    const negative = createBs11088105AttackThenDemoState('BS11-088@1', false)

    expect(positive.players['player-two'].discardPile).toHaveLength(15)
    expect(negative.players['player-two'].discardPile).toHaveLength(14)
    expect(positive.pendingBattle?.stage).toBe('attack-effect')
    expect(negative.pendingBattle?.stage).toBe('attack-effect')
  })

  it('adds a real Special Play Cookie ally only on the BS11-105 positive route', () => {
    const positive = createBs11088105AttackThenDemoState('BS11-105', true)
    const negative = createBs11088105AttackThenDemoState('BS11-105', false)

    expect(positive.players['player-one'].battleArea).toHaveLength(2)
    expect(positive.players['player-one'].battleArea[1]?.card).toMatchObject({
      id: 'BS11-111',
      name: 'Mold Dough Cookie',
    })
    expect(positive.players['player-one'].battleArea[1]?.card.skill?.specialPlayCost).toBeDefined()
    expect(negative.players['player-one'].battleArea).toHaveLength(1)
  })
})

describe('BS11-088／@1 On Play Browser fixture', () => {
  it.each(['BS11-088', 'BS11-088@1'] as const)('separates legal battle cost from blocked route for %s', (cardNumber) => {
    for (const [result, conditionMet] of [['positive', true], ['negative', false]] as const) {
      expect(parseTestStateConfig(
        `?test-state=bs11-088-on-play%3A${cardNumber}%3A${result}`,
        'localhost',
      )).toEqual({ kind: 'bs11-088-on-play', cardNumber, conditionMet })
    }
    const positive = createBs11088OnPlayDemoState(cardNumber, true)
    const negative = createBs11088OnPlayDemoState(cardNumber, false)
    expect(positive.players['player-one'].hand.some((card) => card.instanceId === `player-one-${cardNumber}-1`)).toBe(true)
    expect(positive.players['player-one'].battleArea.map((entry) => entry.card.id)).toContain('BS11-086')
    expect(negative.players['player-one'].battleArea).toHaveLength(0)
    expect(positive.players['player-one'].discardPile.map((card) => card.id)).toEqual(['BS11-087', 'BS11-085'])
    expect(negative.players['player-one'].discardPile.map((card) => card.id)).toEqual(['BS11-087', 'BS11-085'])
  })
})
