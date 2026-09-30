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

describe('BS10-079, BS10-084, BS10-093 and BS10-095 candidate adapter', () => {
  it('maps Eggnog faint to an unconditional draw up to three', () => {
    expect(convertOfficialCardEffects(findCard('BS10-079'))).toMatchObject({
      status: 'supported',
      effects: [{ kind: 'draw-up-to', max: 3 }],
    })
    expect(convertOfficialCookieSkill(findCard('BS10-079'))).toMatchObject({
      trigger: 'passive',
      faint: true,
    })
  })

  it('keeps Plum On Play return limited to a self LV.1 Cookie', () => {
    expect(convertOfficialCardEffects(findCard('BS10-084'))).toMatchObject({
      status: 'supported',
      effects: [{
        kind: 'return-to-hand',
        target: { side: 'self', min: 0, max: 1, maxLevel: 1 },
      }],
    })
    expect(convertOfficialCookieSkill(findCard('BS10-084'))).toMatchObject({
      trigger: 'on-play',
      cost: { energy: {}, discardHand: 0 },
    })
  })

  it('keeps Orange faint draw behind the seven-card hand condition', () => {
    expect(convertOfficialCardEffects(findCard('BS10-093'))).toMatchObject({
      status: 'supported',
      effects: [{
        kind: 'draw-up-to',
        max: 2,
        condition: { kind: 'hand-count-at-most', count: 7 },
      }],
    })
    expect(convertOfficialCookieSkill(findCard('BS10-093'))).toMatchObject({
      trigger: 'passive',
      faint: true,
    })
  })

  it('preserves Lime On Play draw order and the post-draw hand check', () => {
    expect(convertOfficialCardEffects(findCard('BS10-095'))).toMatchObject({
      status: 'supported',
      effects: [
        { kind: 'draw-up-to', max: 1 },
        {
          kind: 'draw-up-to',
          max: 1,
          condition: { kind: 'hand-count-at-most', count: 6 },
        },
      ],
    })
    expect(convertOfficialCookieSkill(findCard('BS10-095'))).toMatchObject({
      trigger: 'on-play',
      cost: { energy: {}, discardHand: 0 },
    })
  })
})

describe('BS10-102, BS10-108 and BS10-118 candidate adapter', () => {
  it('keeps Alchemist purple payment and self-trash cost before milling three', () => {
    expect(convertOfficialCardEffects(findCard('BS10-102'))).toMatchObject({
      status: 'supported',
      effects: [{ kind: 'deck-to-trash', amount: 3, side: 'self' }],
    })
    expect(convertOfficialCookieSkill(findCard('BS10-102'))).toMatchObject({
      trigger: 'activate',
      cost: { energy: { purple: 1 }, selfToTrash: true },
    })
  })

  it('keeps Black Garlic discard cost and purple LV.1 Cookie recovery target', () => {
    expect(convertOfficialCardEffects(findCard('BS10-108'))).toMatchObject({
      status: 'supported',
      effects: [{
        kind: 'trash-to-hand',
        max: 1,
        energyColor: 'purple',
        cookieOnly: true,
        maxLevel: 1,
      }],
    })
    expect(convertOfficialCookieSkill(findCard('BS10-108'))).toMatchObject({
      trigger: 'on-play',
      cost: { energy: {}, discardHand: 1 },
    })
  })

  it('keeps Pastry purple payment and 15-card trash draw condition', () => {
    expect(convertOfficialCardEffects(findCard('BS10-118'))).toMatchObject({
      status: 'supported',
      effects: [{
        kind: 'draw-up-to',
        max: 1,
        condition: { kind: 'trash-count-at-least', count: 15 },
      }],
    })
    expect(convertOfficialCookieSkill(findCard('BS10-118'))).toMatchObject({
      trigger: 'activate',
      cost: { energy: { purple: 1 }, selfToTrash: true },
    })
  })
})
