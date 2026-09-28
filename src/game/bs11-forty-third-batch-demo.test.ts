import { describe, expect, it } from 'vitest'
import {
  createBs11089OnPlayDemoState,
  parseTestStateConfig,
} from './demo'

const cardNumbers = ['BS11-089', 'BS11-089@1', 'BS11-089@2'] as const

const sourceInstanceId = (cardNumber: (typeof cardNumbers)[number]) =>
  `bs11-${cardNumber.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-demo-source`

describe('BS11-089 On Play Browser fixture', () => {
  it.each(cardNumbers)('parses positive and negative routes for %s', (cardNumber) => {
    expect(parseTestStateConfig(
      `?test-state=bs11-089-on-play%3A${cardNumber}%3Apositive`,
      'localhost',
    )).toEqual({
      kind: 'bs11-089-on-play',
      cardNumber,
      conditionMet: true,
    })
    expect(parseTestStateConfig(
      `?test-state=bs11-089-on-play%3A${cardNumber}%3Anegative`,
      'localhost',
    )).toEqual({
      kind: 'bs11-089-on-play',
      cardNumber,
      conditionMet: false,
    })
  })

  it.each(cardNumbers)('loads the exact %s candidate and Refresh witness', (cardNumber) => {
    const positive = createBs11089OnPlayDemoState(cardNumber, true)
    const negative = createBs11089OnPlayDemoState(cardNumber, false)
    const instanceId = sourceInstanceId(cardNumber)
    const source = positive.players['player-one'].hand[0]

    expect(source?.instanceId).toBe(instanceId)
    expect(source?.imageUrl).toBeDefined()
    if (source?.type !== 'cookie') throw new Error('BS11-089 fixture source must be a Cookie')
    expect(source.hp).toBe(4)
    expect(positive.players['player-one'].deck).toHaveLength(10)
    expect(positive.refreshedDuringGame?.['player-one']).toBe(true)
    expect(negative.refreshedDuringGame?.['player-one']).toBe(false)
  })
})
