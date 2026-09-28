import { describe, expect, it } from 'vitest'
import bs11CandidateDocument from '../../data/cards/official-dark-enchantress-war-bs11.en.json'
import {
  convertOfficialCardEffects,
  convertOfficialItemAbility,
  convertOfficialTrapAbility,
} from './official-effect-adapter'
import type { OfficialCardRecord } from './types'

const records = bs11CandidateDocument.cards as OfficialCardRecord[]

const findCard = (cardNumber: string): OfficialCardRecord => {
  const card = records.find((candidate) => candidate.cardNumber === cardNumber)
  if (!card) throw new Error(`Missing BS11 candidate fixture: ${cardNumber}`)
  return card
}

describe('BS11-106／107／110 candidate contract', () => {
  it('keeps the official types, names, colors, and printed condition text', () => {
    expect(findCard('BS11-106')).toMatchObject({
      type: 'trap',
      name: 'World-reflecting Mirrors',
      energyType: 'BLACK',
      skill: { text: expect.stringContaining('LV.5 or higher') },
    })
    expect(findCard('BS11-107')).toMatchObject({
      type: 'item',
      name: 'Oven of Burning Fate',
      energyType: 'BLACK',
      skill: { text: expect.stringContaining('total LV. sum') },
    })
    expect(findCard('BS11-110')).toMatchObject({
      type: 'trap',
      name: 'Draining Magic Circle',
      energyType: 'BLACK',
      skill: { text: expect.stringContaining('additional -1 attack damage') },
    })

    for (const cardNumber of ['BS11-106', 'BS11-107', 'BS11-110']) {
      expect(findCard(cardNumber).imageUrl).toMatch(/^https:\/\//)
    }
  })
})

describe('BS11-106／107／110 exact adapter', () => {
  it('converts the shared battle-area conditions without weakening them', () => {
    const trap106 = convertOfficialTrapAbility(findCard('BS11-106'))
    const item107 = convertOfficialItemAbility(findCard('BS11-107'))
    const trap110 = convertOfficialTrapAbility(findCard('BS11-110'))

    expect(convertOfficialCardEffects(findCard('BS11-106')).status).toBe('supported')
    expect(convertOfficialCardEffects(findCard('BS11-107')).status).toBe('supported')
    expect(convertOfficialCardEffects(findCard('BS11-110')).status).toBe('supported')

    expect(trap106).toMatchObject({
      cost: { energy: { black: 1 }, discardHand: 0 },
      conditionalCost: {
        condition: { kind: 'battle-area-has-level-or-special-play-cookie' },
        cost: { energy: {}, discardHand: 0 },
      },
      effects: [{ kind: 'modify-attack', amount: -1 }],
    })
    expect(item107).toMatchObject({
      cost: { black: 2 },
      effects: [{
        kind: 'damage',
        amount: 2,
        condition: {
          kind: 'battle-area-cookie-level-sum-at-least',
          side: 'self',
          level: 5,
        },
      }],
    })
    expect(trap110).toMatchObject({
      cost: { energy: { black: 1 }, discardHand: 0 },
      effects: [{
        kind: 'modify-attack',
        thenEffects: [{
          kind: 'modify-attack',
          amount: -1,
          target: { previousEffectTargetOnly: true },
          condition: {
            kind: 'any-of',
            conditions: [
              { kind: 'battle-area-has-cookie-with-min-level', side: 'self', minLevel: 5 },
              { kind: 'battle-area-has-special-play-cookie', side: 'self' },
            ],
          },
        }],
      }],
    })
  })
})
