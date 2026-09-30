import { describe, expect, it } from 'vitest'
import { canSpecialPlayCookie } from './actions'
import {
  createBs11115SpecialPlayDemoState,
  parseTestStateConfig,
} from './demo'

const cardNumbers = ['BS11-115', 'BS11-115@1', 'BS11-115@2', 'BS11-115@3'] as const

const sourceInstanceId = (cardNumber: (typeof cardNumbers)[number]) =>
  `bs11-${cardNumber.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-demo-source`

describe('BS11-115 Special Play Browser fixture', () => {
  it.each(cardNumbers)('parses positive and negative routes for %s', (cardNumber) => {
    expect(parseTestStateConfig(
      `?test-state=bs11-115-special-play%3A${cardNumber}%3Apositive`,
      'localhost',
    )).toEqual({
      kind: 'bs11-115-special-play',
      cardNumber,
      negative: false,
      supportConditionMet: true,
    })
    expect(parseTestStateConfig(
      `?test-state=bs11-115-special-play%3A${cardNumber}%3Anegative`,
      'localhost',
    )).toEqual({
      kind: 'bs11-115-special-play',
      cardNumber,
      negative: true,
      supportConditionMet: true,
    })
    expect(parseTestStateConfig(
      `?test-state=bs11-115-special-play%3A${cardNumber}%3Acondition-unmet`,
      'localhost',
    )).toEqual({
      kind: 'bs11-115-special-play',
      cardNumber,
      negative: false,
      supportConditionMet: false,
    })
  })

  it.each(cardNumbers)('gates %s behind two eligible Special Play Cookies', (cardNumber) => {
    const positive = createBs11115SpecialPlayDemoState(cardNumber, false)
    const negative = createBs11115SpecialPlayDemoState(cardNumber, true)
    const instanceId = sourceInstanceId(cardNumber)

    expect(positive.players['player-one'].hand[0]?.instanceId).toBe(instanceId)
    expect(positive.players['player-one'].hand[0]?.imageUrl).toBeDefined()
    expect(positive.players['player-one'].battleArea).toHaveLength(2)
    expect(negative.players['player-one'].battleArea).toHaveLength(2)
    expect(canSpecialPlayCookie(positive, 'player-one', instanceId)).toBe(true)
    expect(canSpecialPlayCookie(negative, 'player-one', instanceId)).toBe(false)
  })

  it.each(cardNumbers)('keeps %s Special Play legal when the On Play condition is unmet', (cardNumber) => {
    const state = createBs11115SpecialPlayDemoState(cardNumber, false, false)

    expect(state.players['player-two'].supportArea).toHaveLength(3)
    expect(canSpecialPlayCookie(state, 'player-one', sourceInstanceId(cardNumber))).toBe(true)
  })
})
