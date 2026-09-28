import { describe, expect, it } from 'vitest'
import {
  BS11_TWELFTH_BATCH_CARD_NUMBERS,
  createBs11TwelfthBatchDemoState,
  parseTestStateConfig,
} from './demo'

describe('BS11-040 to BS11-044 candidate Browser fixture', () => {
  it.each(BS11_TWELFTH_BATCH_CARD_NUMBERS)(
    'parses %s only through the localhost candidate route',
    (cardNumber) => {
      expect(parseTestStateConfig(
        `?test-state=bs11-twelfth-batch:${cardNumber}:positive`,
        'localhost',
      )).toEqual({
        kind: 'bs11-twelfth-batch',
        cardNumber,
        conditionMet: true,
      })
      expect(parseTestStateConfig(
        `?test-state=bs11-twelfth-batch:${cardNumber}:negative`,
        '127.0.0.1',
      )).toEqual({
        kind: 'bs11-twelfth-batch',
        cardNumber,
        conditionMet: false,
      })
      expect(parseTestStateConfig(
        `?test-state=bs11-twelfth-batch:${cardNumber}:positive`,
        'example.com',
      )).toBeNull()
    },
  )

  it('keeps BS11-040 on the real FLIP attack continuation', () => {
    const state = createBs11TwelfthBatchDemoState('BS11-040', true)
    expect(state.pendingBattle?.stage).toBe('flip')
    expect(state.pendingBattle?.revealedHpCard?.id).toBe('BS11-040')
  })

  it('separates BS11-041 green support payment from the wrong-colour lane', () => {
    const positive = createBs11TwelfthBatchDemoState('BS11-041', true)
    const negative = createBs11TwelfthBatchDemoState('BS11-041', false)
    expect(positive.players['player-one'].battleArea.some(({ card }) => card.id === 'BS11-041')).toBe(true)
    expect(positive.players['player-one'].supportArea.every(({ card }) => card.energyColor === 'green')).toBe(true)
    expect(negative.players['player-one'].supportArea.every(({ card }) => card.energyColor === 'red')).toBe(true)
    expect(positive.players['player-one'].supportArea.every(({ card }) => card.id === 'BS8-071')).toBe(true)
    expect(negative.players['player-one'].supportArea.every(({ card }) => card.id === 'BS8-021')).toBe(true)
    expect(
      positive.players['player-one'].battleArea.find(({ card }) => card.id === 'self-extra-1')?.hpCards,
    ).toHaveLength(3)
  })

  it('keeps two rested On Play candidates only in the BS11-042 positive lane', () => {
    const positive = createBs11TwelfthBatchDemoState('BS11-042', true)
    const negative = createBs11TwelfthBatchDemoState('BS11-042', false)
    expect(positive.players['player-one'].hand.some((card) => card.id === 'BS11-042')).toBe(true)
    expect(positive.players['player-one'].supportArea.filter(({ rested }) => rested)).toHaveLength(2)
    expect(negative.players['player-one'].supportArea.every(({ rested }) => !rested)).toBe(true)
    expect(positive.players['player-one'].supportArea.every(({ card }) => card.id === 'BS8-071')).toBe(true)
    expect(negative.players['player-one'].supportArea.every(({ card }) => card.id === 'BS8-071')).toBe(true)
  })

  it('uses the vanilla BS11-043 attack surface for positive and blocked lanes', () => {
    const positive = createBs11TwelfthBatchDemoState('BS11-043', true)
    const negative = createBs11TwelfthBatchDemoState('BS11-043', false)
    expect(positive.players['player-one'].battleArea[0]?.card.id).toBe('BS11-043')
    expect(negative.players['player-one'].battleArea[0]?.card.id).toBe('BS11-043')
    expect(positive.players['player-one'].battleArea[0]?.rested).toBe(false)
    expect(negative.players['player-one'].battleArea[0]?.rested).toBe(false)
    expect(positive.players['player-one'].supportArea.every(({ rested }) => !rested)).toBe(true)
    expect(negative.players['player-one'].supportArea.every(({ rested }) => rested)).toBe(true)
  })

  it('adds exactly the seventh support witness for BS11-044', () => {
    const positive = createBs11TwelfthBatchDemoState('BS11-044', true)
    const negative = createBs11TwelfthBatchDemoState('BS11-044', false)
    expect(positive.players['player-one'].supportArea).toHaveLength(7)
    expect(negative.players['player-one'].supportArea).toHaveLength(6)
    expect(positive.players['player-one'].battleArea[0]?.card.id).toBe('BS11-044')
    expect(negative.players['player-one'].battleArea[0]?.card.id).toBe('BS11-044')
  })
})
