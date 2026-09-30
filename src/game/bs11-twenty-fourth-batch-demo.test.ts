import { describe, expect, it } from 'vitest'
import { canActivateCookieSkill } from './skills'
import {
  createBs11097To099SpecialPlayGateDemoState,
  parseTestStateConfig,
} from './demo'

const cardNumbers = ['BS11-097', 'BS11-098', 'BS11-099'] as const

describe('BS11-097～099 Browser fixture', () => {
  it.each(cardNumbers)('parses positive and negative routes for %s', (cardNumber) => {
    expect(parseTestStateConfig(
      `?test-state=bs11-097-099-special-play%3A${cardNumber}%3Apositive`,
      'localhost',
    )).toEqual({
      kind: 'bs11-097-099-special-play',
      cardNumber,
      conditionMet: true,
    })
    expect(parseTestStateConfig(
      `?test-state=bs11-097-099-special-play%3A${cardNumber}%3Anegative`,
      'localhost',
    )).toEqual({
      kind: 'bs11-097-099-special-play',
      cardNumber,
      conditionMet: false,
    })
  })

  it.each(cardNumbers)('gates %s behind a real Special Play Cookie', (cardNumber) => {
    const positive = createBs11097To099SpecialPlayGateDemoState(cardNumber, true)
    const negative = createBs11097To099SpecialPlayGateDemoState(cardNumber, false)
    const sourceInstanceId = `bs11-${cardNumber.slice(5)}-demo-source`

    expect(canActivateCookieSkill(
      positive,
      'player-one',
      sourceInstanceId,
      'activate',
    )).toBe(true)
    expect(canActivateCookieSkill(
      negative,
      'player-one',
      sourceInstanceId,
      'activate',
    )).toBe(false)
  })
})
