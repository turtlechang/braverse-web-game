import { describe, expect, it } from 'vitest'
import {
  createBs11071AttackDemoState,
  createBs11072SkillDemoState,
  createBs11073AttackDemoState,
  parseTestStateConfig,
} from './demo'

describe('BS11-071 attack and EXTRA skill fixture', () => {
  it.each(['BS11-071', 'BS11-071@1', 'BS11-071@2'] as const)('%s exposes payment and EXTRA choice', (cardNumber) => {
    expect(parseTestStateConfig(`?test-state=bs11-071-attack:${cardNumber}:positive`, 'localhost'))
      .toEqual({ kind: 'bs11-071-attack', cardNumber, thenPayable: true })
    const positive = createBs11071AttackDemoState(cardNumber, true)
    const negative = createBs11071AttackDemoState(cardNumber, false)
    expect(positive.pendingBattle).toBeNull()
    expect(positive.players['player-one'].battleArea[0]?.card.id).toBe('BS11-071')
    expect(positive.players['player-one'].battleArea[0]?.card.officialType)
      .toBe(cardNumber === 'BS11-071@2' ? 'flip' : 'cookie')
    expect(positive.players['player-one'].battleArea[0]?.card.flip).toBeUndefined()
    expect(positive.players['player-one'].supportArea).toHaveLength(4)
    expect(negative.players['player-one'].supportArea).toHaveLength(3)
    expect(positive.players['player-one'].extraDeck?.[0]).toMatchObject({
      id: 'BS9-055', name: 'Shadow Milk Cookie',
    })
    expect(positive.players['player-one'].hand).toHaveLength(1)
  })
})

describe('BS11-072 threshold fixture', () => {
  it('crosses the 15-card own-trash boundary without changing the target or payment', () => {
    expect(parseTestStateConfig('?test-state=bs11-072-skill:negative', 'localhost'))
      .toEqual({ kind: 'bs11-072-skill', conditionMet: false })
    const positive = createBs11072SkillDemoState(true)
    const negative = createBs11072SkillDemoState(false)
    expect(positive.players['player-one'].discardPile).toHaveLength(15)
    expect(negative.players['player-one'].discardPile).toHaveLength(14)
    expect(positive.players['player-one'].supportArea).toEqual(negative.players['player-one'].supportArea)
    expect(positive.players['player-two'].battleArea).toEqual(negative.players['player-two'].battleArea)
  })
})

describe('BS11-073 neutral attack fixture', () => {
  it('uses three mixed supports to cross the printed neutral cost', () => {
    expect(parseTestStateConfig('?test-state=bs11-073-attack:positive', 'localhost'))
      .toEqual({ kind: 'bs11-073-attack', payable: true })
    const positive = createBs11073AttackDemoState(true)
    const negative = createBs11073AttackDemoState(false)
    expect(positive.players['player-one'].battleArea[0]?.card.attackEnergyCost)
      .toEqual({ neutral: 3 })
    expect(positive.players['player-one'].supportArea.map((entry) => entry.card.energyColor))
      .toEqual(['red', 'purple', 'purple'])
    expect(negative.players['player-one'].supportArea).toHaveLength(2)
  })
})
