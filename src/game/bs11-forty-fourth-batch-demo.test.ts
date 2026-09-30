import { describe, expect, it } from 'vitest'
import {
  createBs11084TrapDemoState,
  createBs11086087AttackThenDemoState,
  parseTestStateConfig,
} from './demo'

const attackThenCards = [
  'BS11-086',
  'BS11-086@1',
  'BS11-087',
  'BS11-087@1',
] as const

describe('BS11-084 to BS11-087 candidate Browser fixtures', () => {
  it('parses the Refresh-gated Trap route', () => {
    expect(parseTestStateConfig(
      `?test-state=${encodeURIComponent('bs11-084-trap:positive')}`,
      'localhost',
    )).toEqual({ kind: 'bs11-084-trap', conditionMet: true })
    expect(parseTestStateConfig(
      `?test-state=${encodeURIComponent('bs11-084-trap:negative')}`,
      'localhost',
    )).toEqual({ kind: 'bs11-084-trap', conditionMet: false })
  })

  it('keeps BS11-084 Refresh evidence separate from Trap activation', () => {
    expect(createBs11084TrapDemoState(true).refreshedDuringGame?.['player-one']).toBe(true)
    expect(createBs11084TrapDemoState(false).refreshedDuringGame?.['player-one']).toBe(false)
  })

  it.each(attackThenCards)('parses and prepares the exact %s continuation', (cardNumber) => {
    expect(parseTestStateConfig(
      `?test-state=${encodeURIComponent(`bs11-086-087-attack-then:${cardNumber}:positive`)}`,
      'localhost',
    )).toEqual({ kind: 'bs11-086-087-attack-then', cardNumber, conditionMet: true })

    const positive = createBs11086087AttackThenDemoState(cardNumber, true)
    const negative = createBs11086087AttackThenDemoState(cardNumber, false)
    const positiveSource = positive.players['player-one'].battleArea[0]
    const negativeSource = negative.players['player-one'].battleArea[0]

    expect(positiveSource?.card.id).toBe(cardNumber.split('@')[0])
    expect(positive.pendingBattle?.stage).toBe('attack-effect')
    expect(positive.pendingBattle?.attackerInstanceId).toBe(positiveSource?.card.instanceId)
    expect(negative.players['player-one'].battleArea).toHaveLength(1)
    expect(negative.pendingBattle?.stage).toBe('attack-effect')
    expect(negative.pendingBattle?.attackerInstanceId).toBe(negativeSource?.card.instanceId)

    if (cardNumber.startsWith('BS11-086')) {
      expect(positive.players['player-one'].discardPile.map((card) => card.name))
        .toContain('Dark Cacao Cookie')
      expect(negative.players['player-one'].discardPile.map((card) => card.name))
        .not.toContain('Dark Cacao Cookie')
    } else {
      expect(positive.players['player-one'].battleArea).toHaveLength(2)
      expect(positive.players['player-one'].battleArea[1]?.card.keywords)
        .toContain('ancient')
      expect(negative.players['player-one'].discardPile).toHaveLength(14)
    }
  })
})
