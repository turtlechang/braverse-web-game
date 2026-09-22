import { describe, expect, it } from 'vitest'
import bs10CandidateDocument from '../../data/cards/official-paradise-of-passion-and-sloth-catacombs-of-silence-bs10.en.json'
import {
  convertOfficialCardEffects,
  convertOfficialCookieSkill,
  type OfficialCardRecord,
} from '.'

const records = bs10CandidateDocument.cards as OfficialCardRecord[]
const findCard = (cardNumber: string): OfficialCardRecord => {
  const card = records.find((candidate) => candidate.cardNumber === cardNumber)
  if (!card) throw new Error(`Missing BS10 candidate fixture: ${cardNumber}`)
  return card
}

describe('BS10-011, BS10-012 and BS10-025 candidate adapter', () => {
  it('maps Royal Berry activation to conditional opponent damage', () => {
    expect(convertOfficialCardEffects(findCard('BS10-011'))).toMatchObject({
      status: 'supported',
      effects: [{
        kind: 'damage',
        amount: 1,
        target: { side: 'opponent', min: 0, max: 1 },
        condition: {
          kind: 'cookies-fainted-this-turn-at-least',
          side: 'opponent',
          count: 1,
        },
      }],
    })
    expect(convertOfficialCookieSkill(findCard('BS10-011'))).toMatchObject({
      trigger: 'activate',
      oncePerTurn: true,
      cost: { energy: {}, discardHand: 0 },
    })
  })

  it('maps Devil Cookie faint to opponent damage', () => {
    expect(convertOfficialCardEffects(findCard('BS10-012'))).toMatchObject({
      status: 'supported',
      effects: [{
        kind: 'damage',
        amount: 1,
        target: { side: 'opponent', min: 0, max: 1 },
      }],
    })
    expect(convertOfficialCookieSkill(findCard('BS10-012'))).toMatchObject({
      trigger: 'passive',
      faint: true,
    })
  })

  it('maps Carrot Cookie On Play to yellow Break count draw condition', () => {
    expect(convertOfficialCardEffects(findCard('BS10-025'))).toMatchObject({
      status: 'supported',
      effects: [{
        kind: 'draw-up-to',
        max: 2,
        condition: {
          kind: 'break-area-card-count-at-least',
          side: 'self',
          count: 3,
          color: 'yellow',
        },
      }],
    })
    expect(convertOfficialCookieSkill(findCard('BS10-025'))).toMatchObject({
      trigger: 'on-play',
      cost: { energy: {}, discardHand: 0 },
    })
  })
})
