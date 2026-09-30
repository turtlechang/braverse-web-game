import { describe, expect, it } from 'vitest'
import {
  createBs11016HpTotalDemoState,
  parseTestStateConfig,
} from './demo'

describe('BS11-016 candidate Browser fixture', () => {
  it.each(['BS11-016', 'BS11-016@1'] as const)('prepares %s positive and negative HP-total routes', (cardNumber) => {
    expect(parseTestStateConfig(
      `?test-state=${encodeURIComponent(`bs11-016-hp-total:${cardNumber}:positive`)}`,
      'localhost',
    )).toEqual({ kind: 'bs11-016-hp-total', cardNumber, conditionMet: true })
    expect(parseTestStateConfig(
      `?test-state=${encodeURIComponent(`bs11-016-hp-total:${cardNumber}:negative`)}`,
      'localhost',
    )).toEqual({ kind: 'bs11-016-hp-total', cardNumber, conditionMet: false })

    const positive = createBs11016HpTotalDemoState(cardNumber, true)
    const negative = createBs11016HpTotalDemoState(cardNumber, false)
    expect(positive.players['player-one'].battleArea.map((cookie) => cookie.hpCards.length)).toEqual([2, 1])
    expect(positive.players['player-one'].battleArea.map((cookie) => cookie.card.energyColor)).toEqual(['red', 'red'])
    expect(negative.players['player-one'].battleArea.map((cookie) => cookie.hpCards.length)).toEqual([1, 1])
    expect(negative.players['player-one'].battleArea.map((cookie) => cookie.card.energyColor)).toEqual(['red', 'blue'])
  })
})
