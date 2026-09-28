import { describe, expect, it } from 'vitest'
import {
  createBs11114OnPlayDemoState,
  parseTestStateConfig,
} from './demo'

const cardNumbers = ['BS11-114', 'BS11-114@1'] as const

describe('BS11-114 On Play demo routes', () => {
  it.each(cardNumbers)('parses positive and negative routes for %s', (cardNumber) => {
    expect(parseTestStateConfig(
      `?test-state=${encodeURIComponent(`bs11-114-on-play:${cardNumber}:positive`)}`,
      'localhost',
    )).toEqual({
      kind: 'bs11-114-on-play',
      cardNumber,
      conditionMet: true,
    })
    expect(parseTestStateConfig(
      `?test-state=${encodeURIComponent(`bs11-114-on-play:${cardNumber}:negative`)}`,
      'localhost',
    )).toEqual({
      kind: 'bs11-114-on-play',
      cardNumber,
      conditionMet: false,
    })
  })

  it.each(cardNumbers)('builds a real candidate source and black discard witness for %s', (cardNumber) => {
    const state = createBs11114OnPlayDemoState(cardNumber, true)
    const player = state.players['player-one']

    expect(player.hand[0]).toMatchObject({
      id: 'BS11-114',
      type: 'cookie',
      name: 'Pomegranate Cookie',
    })
    expect(player.hand[1]).toMatchObject({
      type: 'item',
      energyColor: 'black',
    })
    expect(player.hand).toHaveLength(6)
    expect(player.deck).toHaveLength(6)
  })

  it.each(cardNumbers)('keeps the printed hand threshold false after payment for %s', (cardNumber) => {
    const positive = createBs11114OnPlayDemoState(cardNumber, true)
    const negative = createBs11114OnPlayDemoState(cardNumber, false)

    expect(positive.players['player-one'].hand).toHaveLength(6)
    expect(negative.players['player-one'].hand).toHaveLength(8)
    expect(positive.players['player-one'].battleArea).toHaveLength(1)
    expect(negative.players['player-one'].battleArea).toHaveLength(1)
  })
})
