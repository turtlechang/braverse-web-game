import { describe, expect, it } from 'vitest'
import { analyzeOfficialCardBehavior } from './contracts'
import { convertOfficialCardToGameCard } from './official-card-adapter'
import { getCardPoolEntry } from '../game/card-pool'
import candidate from '../../data/candidates/st6-st10/official-st10.en.json'
import type { OfficialCardRecord } from './types'
import type { GameCard } from '../game/types'

const candidateRecords = candidate.cards as OfficialCardRecord[]

const converted = (cardNumber: string) => {
  const source = getCardPoolEntry(cardNumber) ??
    candidateRecords.find(card => card.cardNumber === cardNumber)
  if (!source) throw new Error(`Missing original ${cardNumber} printing`)
  const result = convertOfficialCardToGameCard(source, `st10-contract-${cardNumber}`)
  if (result.status !== 'converted') {
    throw new Error(`${cardNumber} must convert to its original card: ${result.reason}`)
  }
  return { source, card: result.gameCard }
}

const trap = (card: GameCard) => {
  if (card.type !== 'trap' || !card.trap) throw new Error(`${card.id} must keep its Trap ability`)
  return card.trap
}

describe('ST10-017, ST10-018, and ST10-020 original purple conversion', () => {
  it('ST10-017 applies the optional attack reduction before milling up to three cards', () => {
    const { source, card } = converted('ST10-017')
    expect([card.id, card.name, card.type, card.cardColor, card.energyColor, card.imageUrl]).toEqual([
      'ST10-017', 'Inside the Clock Tower', 'trap', 'purple', 'purple', source.imageUrl,
    ])
    expect(trap(card)).toMatchObject({
      cost: { energy: { purple: 2 }, discardHand: 0 },
      text: source.skill.text,
      effects: [
        {
          kind: 'modify-attack',
          amount: -2,
          duration: 'this-turn',
          target: { side: 'opponent', min: 0, max: 1 },
        },
        {
          kind: 'deck-to-trash',
          amount: 3,
          side: 'self',
          selectableAmount: { min: 0, max: 3 },
        },
      ],
    })
    expect(card.effects).toEqual(trap(card).effects)
    expect(analyzeOfficialCardBehavior(source, card).contract.status).toBe('verified')
  })

  it('ST10-018 recovers only a purple LV.3 Cookie after the optional attack reduction', () => {
    const { source, card } = converted('ST10-018')
    expect([card.id, card.name, card.type, card.cardColor, card.energyColor, card.imageUrl]).toEqual([
      'ST10-018', 'Reunion of Star and Moon', 'trap', 'purple', 'purple', source.imageUrl,
    ])
    expect(trap(card)).toMatchObject({
      cost: { energy: { purple: 3 }, discardHand: 0 },
      text: source.skill.text,
      effects: [
        {
          kind: 'modify-attack',
          amount: -2,
          duration: 'this-turn',
          target: { side: 'opponent', min: 0, max: 1 },
        },
        {
          kind: 'trash-to-hand',
          max: 1,
          energyColor: 'purple',
          cookieOnly: true,
          minLevel: 3,
          maxLevel: 3,
        },
      ],
    })
    expect(card.effects).toEqual(trap(card).effects)
    expect(analyzeOfficialCardBehavior(source, card).contract.status).toBe('verified')
  })

  it('ST10-020 separately retains its P placement payment, rest activation cost, and optional target', () => {
    const { source, card } = converted('ST10-020')
    expect([card.id, card.name, card.type, card.cardColor, card.energyColor, card.imageUrl]).toEqual([
      'ST10-020', 'Wizard Archives', 'stage', 'purple', 'purple', source.imageUrl,
    ])
    expect(card.stageAbility).toMatchObject({
      placementCost: { purple: 1 },
      cost: { energy: {}, discardHand: 0 },
      restSource: true,
      effects: [{
        kind: 'field-to-trash',
        target: {
          side: 'self',
          min: 0,
          max: 1,
          energyColor: 'purple',
          minLevel: 1,
          maxLevel: 1,
        },
      }],
    })
    expect(card.effects).toEqual(card.stageAbility?.effects)
    expect(analyzeOfficialCardBehavior(source, card).contract.status).toBe('verified')
  })
})
