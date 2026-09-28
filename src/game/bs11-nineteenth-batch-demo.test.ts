import { describe, expect, it } from 'vitest'
import { getEffectiveAttack } from './effects/combat'
import {
  createBs11074AttackDemoState,
  createBs11077AuraDemoState,
  createBs11078AttackDemoState,
  parseTestStateConfig,
} from './demo'

describe('BS11-074 neutral attack fixture', () => {
  it('pays its neutral cost from one red support', () => {
    expect(parseTestStateConfig('?test-state=bs11-074-attack:positive', 'localhost'))
      .toEqual({ kind: 'bs11-074-attack', payable: true })
    const positive = createBs11074AttackDemoState(true)
    const negative = createBs11074AttackDemoState(false)
    expect(positive.players['player-one'].battleArea[0]?.card.attackEnergyCost)
      .toEqual({ neutral: 1 })
    expect(positive.players['player-one'].supportArea[0]?.card.energyColor).toBe('red')
    expect(negative.players['player-one'].supportArea).toEqual([])
  })
})

describe('BS11-077 named Cookie attack aura fixture', () => {
  it('applies only when the owner has at least 15 cards in trash', () => {
    expect(parseTestStateConfig('?test-state=bs11-077-aura:negative', 'localhost'))
      .toEqual({ kind: 'bs11-077-aura', conditionMet: false })
    const positive = createBs11077AuraDemoState(true)
    const negative = createBs11077AuraDemoState(false)
    const attacker = positive.players['player-one'].battleArea[0]?.card
    expect(attacker?.id).toBe('BS11-072')
    expect(positive.players['player-one'].battleArea[1]?.card.id).toBe('BS11-077')
    expect(positive.players['player-one'].discardPile).toHaveLength(15)
    expect(negative.players['player-one'].discardPile).toHaveLength(14)
    expect(getEffectiveAttack(positive, attacker!.instanceId)).toBe(attacker!.attack + 1)
    expect(getEffectiveAttack(negative, attacker!.instanceId)).toBe(attacker!.attack)
  })
})

describe('BS11-078 conditional attack Then fixture', () => {
  it('changes only the printed trash threshold', () => {
    expect(parseTestStateConfig('?test-state=bs11-078-attack:positive', 'localhost'))
      .toEqual({ kind: 'bs11-078-attack', conditionMet: true })
    const positive = createBs11078AttackDemoState(true)
    const negative = createBs11078AttackDemoState(false)
    expect(positive.players['player-one'].battleArea[0]?.card.id).toBe('BS11-078')
    expect(positive.players['player-one'].supportArea).toEqual(negative.players['player-one'].supportArea)
    expect(positive.players['player-one'].discardPile).toHaveLength(15)
    expect(negative.players['player-one'].discardPile).toHaveLength(14)
  })
})
