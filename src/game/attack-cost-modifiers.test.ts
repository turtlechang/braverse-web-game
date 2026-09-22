import { describe, expect, it } from 'vitest'
import bs10 from '../../data/cards/official-paradise-of-passion-and-sloth-catacombs-of-silence-bs10.en.json'
import { convertOfficialCardToGameCard } from '../cards/official-card-adapter'
import type { OfficialCardRecord } from '../cards/types'
import { getAttackEnergyCostForState } from './energy'
import { createBattleState } from './test-helpers/battle-helpers'
import { getCardPoolEntry } from './card-pool'
import type { AttackCostModifier, GameState } from './types'

const bs10Records = bs10.cards as unknown as OfficialCardRecord[]

const officialBs10 = (id: string, suffix: string) => {
  const record = bs10Records.find((card) => card.cardNumber === id)
  if (!record) throw new Error(`Missing candidate ${id}`)
  const result = convertOfficialCardToGameCard(record, `attack-cost-${suffix}`)
  if (result.status !== 'converted') throw new Error(`${id}: ${result.reason}`)
  return { ...result.gameCard, instanceId: `${id}:${suffix}` }
}

const withModifiers = (
  modifiers: AttackCostModifier[],
  options?: { turnNumber?: number; attackerInstanceId?: string },
): GameState => {
  const state = createBattleState()
  const attacker = state.players['player-two'].battleArea[0]
  attacker.card.attackCost = 2
  attacker.card.attackEnergyCost = { red: 2, green: 1 }
  return {
    ...state,
    turnNumber: options?.turnNumber ?? 2,
    attackCostModifiers: modifiers,
  }
}

const modifier = (
  partial: Partial<AttackCostModifier> & Pick<AttackCostModifier, 'energyCost'>,
): AttackCostModifier => ({
  sourceInstanceId: 'source',
  targetInstanceId: 'attacker',
  expiresAfterTurn: null,
  ...partial,
})

describe('turn-scoped attack cost set/reduce modifiers', () => {
  it('keeps legacy modifiers as replacement (P-032 compatibility)', () => {
    const state = withModifiers([modifier({ energyCost: { red: 1 } })])
    expect(getAttackEnergyCostForState(state, 'attacker')).toEqual({ red: 1 })
  })

  it('reduces only the specified colors and retains other cost colors', () => {
    const state = withModifiers([
      modifier({ operation: 'reduce', energyCost: { red: 1 } }),
    ])
    expect(getAttackEnergyCostForState(state, 'attacker')).toEqual({ red: 1, green: 1 })
  })

  it('clamps a multicolor reduction at zero without removing unrelated colors', () => {
    const state = withModifiers([
      modifier({ operation: 'reduce', energyCost: { red: 3, green: 1 } }),
    ])
    expect(getAttackEnergyCostForState(state, 'attacker')).toEqual({})
  })

  it('applies valid modifiers in order, including a set followed by a reduction', () => {
    const state = withModifiers([
      modifier({ energyCost: { red: 3, neutral: 1 } }),
      modifier({ operation: 'reduce', energyCost: { red: 1 } }),
    ])
    expect(getAttackEnergyCostForState(state, 'attacker')).toEqual({ red: 2, neutral: 1 })
  })

  it('ignores expired modifiers and modifiers targeting a different cookie', () => {
    const state = withModifiers([
      modifier({ energyCost: { red: 1 }, expiresAfterTurn: 1 }),
      modifier({ operation: 'reduce', targetInstanceId: 'other', energyCost: { red: 2 } }),
    ])
    expect(getAttackEnergyCostForState(state, 'attacker')).toEqual({ red: 2, green: 1 })
  })

  it('composes an explicit reduction with the official BS8-075 Stage modifier', () => {
    const entry = getCardPoolEntry('BS8-075')
    expect(entry).toBeDefined()
    const converted = convertOfficialCardToGameCard(entry!)
    expect(converted.status).toBe('converted')
    if (converted.status !== 'converted') throw new Error('BS8-075 conversion failed')
    if (converted.gameCard.type !== 'stage') throw new Error('BS8-075 did not convert to a Stage')

    const state = withModifiers([
      modifier({ operation: 'reduce', energyCost: { red: 1 } }),
    ])
    state.players['player-two'] = {
      ...state.players['player-two'],
      stage: { card: converted.gameCard, rested: false },
      supportArea: Array.from({ length: 6 }, (_, index) => ({
        card: {
          id: `stage-support-${index}`,
          instanceId: `stage-support-${index}`,
          name: `stage-support-${index}`,
          type: 'item' as const,
          energyColor: 'red' as const,
        },
        rested: false,
      })),
    }
    expect(getAttackEnergyCostForState(state, 'attacker')).toEqual({
      red: 1,
      green: 1,
      neutral: 1,
    })
  })

  it('applies BS10-049 Eternal Sugar only at break LV5+ without another copy', () => {
    const state = withModifiers([])
    const eternal = officialBs10('BS10-049', 'source')
    const source = {
      card: eternal as typeof state.players['player-one']['battleArea'][number]['card'],
      hpCards: [],
      rested: false,
      battleEntryId: `${eternal.instanceId}:battle`,
    }
    const breakCard = {
      ...state.players['player-one'].battleArea[0].card,
      instanceId: 'break-lv5',
      level: 5,
    }
    const positive = {
      ...state,
      players: {
        ...state.players,
        'player-one': {
          ...state.players['player-one'],
          battleArea: [source],
          breakArea: [breakCard],
        },
      },
    }
    expect(getAttackEnergyCostForState(positive, 'attacker')).toEqual({ red: 2, green: 1, neutral: 1 })

    const second = { ...source, card: { ...source.card, instanceId: 'BS10-049:other' } }
    const disabled = {
      ...positive,
      players: {
        ...positive.players,
        'player-one': {
          ...positive.players['player-one'],
          battleArea: [source, second],
        },
      },
    }
    expect(getAttackEnergyCostForState(disabled, 'attacker')).toEqual({ red: 2, green: 1 })
  })
})
