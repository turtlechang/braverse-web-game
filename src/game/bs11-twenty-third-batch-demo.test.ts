import { describe, expect, it } from 'vitest'
import {
  createCardCheckDemoState,
  createCardNegativeDemoState,
  createBs11090ExtraDeckDemoState,
  parseTestStateConfig,
} from './demo'
import { canActivateCookieSkill } from './skills'

describe('BS11-090 Browser fixture', () => {
  it.each(['BS11-091', 'BS11-091@1'] as const)(
    'keeps generic %s test-state in EXTRA Deck on positive and negative routes',
    (cardNumber) => {
      const positive = createCardCheckDemoState(cardNumber)
      const negative = createCardNegativeDemoState(cardNumber)

      expect(positive.players['player-one'].extraDeck?.map((card) => card.id)).toEqual(['BS11-091'])
      expect(negative.players['player-one'].extraDeck?.map((card) => card.id)).toEqual(['BS11-091'])
      expect(positive.players['player-one'].hand.some((card) => card.id === 'BS11-091')).toBe(false)
      expect(negative.players['player-one'].hand.some((card) => card.id === 'BS11-091')).toBe(false)
    },
  )

  it('parses the positive and negative EXTRA routes', () => {
    expect(parseTestStateConfig(
      '?test-state=bs11-090-extra-deck%3Apositive',
      'localhost',
    )).toEqual({ kind: 'bs11-090-extra-deck', sourceCardNumber: 'BS11-090', extraCardNumber: 'BS11-091', conditionMet: true })
    expect(parseTestStateConfig(
      '?test-state=bs11-090-extra-deck%3Anegative',
      'localhost',
    )).toEqual({ kind: 'bs11-090-extra-deck', sourceCardNumber: 'BS11-090', extraCardNumber: 'BS11-091', conditionMet: false })
  })

  it('keeps White Lily activatable only during the main phase', () => {
    const positive = createBs11090ExtraDeckDemoState(true)
    const negative = createBs11090ExtraDeckDemoState(false)

    expect(canActivateCookieSkill(
      positive,
      'player-one',
      'bs11-090-demo-source',
      'activate',
    )).toBe(true)
    expect(canActivateCookieSkill(
      negative,
      'player-one',
      'bs11-090-demo-source',
      'activate',
    )).toBe(false)
    expect(positive.players['player-one'].extraDeck?.map((card) => card.id))
      .toEqual(['BS11-091'])
    expect(positive.players['player-one'].deck).toHaveLength(9)
  })
  it.each([
    ['BS11-090', 'BS11-091'],
    ['BS11-090@1', 'BS11-091@1'],
    ['BS11-090@2', 'BS11-091@1'],
  ] as const)('routes %s and %s through distinct candidate records', (sourceCardNumber, extraCardNumber) => {
    expect(parseTestStateConfig(
      `?test-state=bs11-090-extra-deck:${sourceCardNumber}:${extraCardNumber}:positive`, 'localhost',
    )).toEqual({ kind: 'bs11-090-extra-deck', sourceCardNumber, extraCardNumber, conditionMet: true })
    const state = createBs11090ExtraDeckDemoState(true, sourceCardNumber, extraCardNumber)
    expect(state.players['player-one'].battleArea[0]?.card.instanceId).toBe('bs11-090-demo-source')
    expect(state.players['player-one'].extraDeck?.[0]?.instanceId).toBe('bs11-090-demo-extra')
  })
})
