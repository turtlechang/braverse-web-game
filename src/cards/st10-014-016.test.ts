import { describe, expect, it } from 'vitest'
import { analyzeOfficialCardBehavior } from './contracts'
import { convertOfficialCardToGameCard } from './official-card-adapter'
import { getCardPoolEntry } from '../game/card-pool'
import candidate from '../../data/candidates/st6-st10/official-st10.en.json'
import type { OfficialCardRecord } from './types'
import type { GameCard } from '../game/types'

const candidateRecords = candidate.cards as OfficialCardRecord[]

const raw = (cardNumber: string): OfficialCardRecord => {
  const record = getCardPoolEntry(cardNumber) ??
    candidateRecords.find(card => card.cardNumber === cardNumber)
  if (!record) throw new Error(`Missing original ${cardNumber} printing`)
  return record
}

const converted = (cardNumber: string) => {
  const source = raw(cardNumber)
  const result = convertOfficialCardToGameCard(source, `st10-contract-${cardNumber}`)
  if (result.status !== 'converted' || result.gameCard.type !== 'item') {
    throw new Error(`${cardNumber} must convert to its original Item`)
  }
  return { source, card: result.gameCard }
}

const item = (card: GameCard) => {
  if (card.type !== 'item' || !card.item) throw new Error(`${card.id} must keep its Item ability`)
  return card.item
}

describe('ST10-014 to ST10-016 original purple Item conversion', () => {
  it('ST10-014 pays P and one own purple LV1 battle Cookie before optional effect damage', () => {
    const { source, card } = converted('ST10-014')
    expect([card.id, card.name, card.type, card.cardColor, card.energyColor, card.imageUrl]).toEqual([
      'ST10-014', 'Lunar Compendium', 'item', 'purple', 'purple', source.imageUrl,
    ])
    expect(item(card)).toMatchObject({
      cost: {
        energy: { purple: 1 },
        discardHand: 0,
        trashBattleCookie: { count: 1, energyColor: 'purple', level: 1 },
      },
      text: source.skill.text,
      effects: [{ kind: 'damage', amount: 1, target: { side: 'opponent', min: 0, max: 1 } }],
    })
    expect(card.effects).toEqual(item(card).effects)
    expect(analyzeOfficialCardBehavior(source, card).contract.status).toBe('verified')
  })

  it('ST10-015 pays PP, checks Moonlight in either own public zone, and lets each target be skipped', () => {
    const { source, card } = converted('ST10-015')
    expect([card.id, card.name, card.type, card.cardColor, card.energyColor, card.imageUrl]).toEqual([
      'ST10-015', 'Essence of Moonlight', 'item', 'purple', 'purple', source.imageUrl,
    ])
    expect(item(card)).toMatchObject({
      cost: { purple: 2 },
      allowInactiveConditionalEffects: true,
      text: source.skill.text,
      effects: [{
        kind: 'hp-to-trash',
        amount: 1,
        target: { side: 'opponent', min: 0, max: 4 },
        condition: { kind: 'any-of', conditions: [
          { kind: 'battle-area-has-named-cookie', side: 'self', name: 'Moonlight Cookie' },
          { kind: 'trash-area-has-named-cookie', side: 'self', name: 'Moonlight Cookie' },
        ] },
      }],
    })
    expect(item(card).effects[0]?.kind).not.toBe('hp-to-trash-all')
    expect(card.effects).toEqual(item(card).effects)
    expect(analyzeOfficialCardBehavior(source, card).contract.status).toBe('verified')
  })

  it('ST10-016 pays P at the 15-card own-trash threshold and preserves cost-first no-op behavior below it', () => {
    const { source, card } = converted('ST10-016')
    expect([card.id, card.name, card.type, card.cardColor, card.energyColor, card.imageUrl]).toEqual([
      'ST10-016', 'Delicate Glass Flower', 'item', 'purple', 'purple', source.imageUrl,
    ])
    expect(item(card)).toMatchObject({
      cost: { purple: 1 },
      allowInactiveConditionalEffects: true,
      text: source.skill.text,
      effects: [{
        kind: 'damage', amount: 1, target: { side: 'opponent', min: 0, max: 1 },
        condition: { kind: 'trash-count-at-least', count: 15 },
      }],
    })
    expect(card.effects).toEqual(item(card).effects)
    expect(analyzeOfficialCardBehavior(source, card).contract.status).toBe('verified')
  })
})
