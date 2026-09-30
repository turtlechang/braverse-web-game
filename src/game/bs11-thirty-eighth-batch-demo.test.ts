import { describe, expect, it } from 'vitest'
import {
  createBs11106107110ConditionDemoState,
  parseTestStateConfig,
} from './demo'

const cardNumbers = ['BS11-106', 'BS11-107', 'BS11-110'] as const

describe('BS11-106／107／110 Browser fixture', () => {
  it.each(cardNumbers)('parses positive and negative routes for %s', (cardNumber) => {
    expect(parseTestStateConfig(
      `?test-state=bs11-106-107-110-condition%3A${cardNumber}%3Apositive`,
      'localhost',
    )).toEqual({
      kind: 'bs11-106-107-110-condition',
      cardNumber,
      conditionMet: true,
    })
    expect(parseTestStateConfig(
      `?test-state=bs11-106-107-110-condition%3A${cardNumber}%3Anegative`,
      'localhost',
    )).toEqual({
      kind: 'bs11-106-107-110-condition',
      cardNumber,
      conditionMet: false,
    })
  })

  it('adds a real Special Play Cookie only on the Trap positive routes', () => {
    const positive = createBs11106107110ConditionDemoState('BS11-106', true)
    const negative = createBs11106107110ConditionDemoState('BS11-110', false)

    expect(positive.players['player-one'].battleArea).toHaveLength(2)
    expect(positive.players['player-one'].battleArea[1]?.card).toMatchObject({
      id: 'BS11-111',
      name: 'Mold Dough Cookie',
    })
    expect(positive.pendingBattle?.stage).toBe('trap')
    expect(negative.players['player-one'].battleArea[1]?.card.id).toBe('self-extra-1')
    expect(negative.players['player-one'].battleArea[1]?.card.level).toBeLessThan(5)
    expect(negative.players['player-one'].battleArea[1]?.card.skill?.specialPlayCost).toBeUndefined()
  })

  it('sets BS11-107 to exactly LV.5 only on the positive route', () => {
    const positive = createBs11106107110ConditionDemoState('BS11-107', true)
    const negative = createBs11106107110ConditionDemoState('BS11-107', false)
    const levelSum = (state: ReturnType<typeof createBs11106107110ConditionDemoState>) =>
      state.players['player-one'].battleArea.reduce((sum, entry) => sum + entry.card.level, 0)

    expect(levelSum(positive)).toBe(5)
    expect(levelSum(negative)).toBeLessThan(5)
    expect(positive.players['player-one'].hand[0]).toMatchObject({
      id: 'BS11-107',
      type: 'item',
    })
    expect(positive.players['player-one'].supportArea.filter((support) => !support.rested)).not.toHaveLength(0)
  })
})
