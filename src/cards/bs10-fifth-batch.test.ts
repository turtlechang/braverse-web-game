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

describe('BS10-058, BS10-059, BS10-061, BS10-069 and BS10-074 candidate adapter', () => {
  it('preserves Clover support return then optional green hand placement', () => {
    expect(convertOfficialCardEffects(findCard('BS10-058'))).toMatchObject({
      status: 'supported',
      effects: [
        { kind: 'support-to-hand', amount: 1 },
        { kind: 'hand-to-support', amount: 1, energyColor: 'green', rested: true, optional: true },
      ],
    })
    expect(convertOfficialCookieSkill(findCard('BS10-058'))).toMatchObject({
      trigger: 'on-play',
      cost: { energy: {}, discardHand: 0 },
    })
  })

  it('preserves Yeast Spores green payment, support sacrifice and rested source placement', () => {
    expect(convertOfficialCardEffects(findCard('BS10-059'))).toMatchObject({
      status: 'supported',
      effects: [{ kind: 'place-source-to-support', rested: true }],
    })
    expect(convertOfficialCookieSkill(findCard('BS10-059'))).toMatchObject({
      trigger: 'activate',
      cost: { energy: { green: 1 }, supportToTrash: 1 },
    })
  })

  it('keeps Carameleon once-per-turn support deficit condition', () => {
    expect(convertOfficialCardEffects(findCard('BS10-061'))).toMatchObject({
      status: 'supported',
      effects: [{
        kind: 'hand-to-support',
        amount: 1,
        rested: true,
        optional: true,
        condition: { kind: 'support-count-less-than-opponent', difference: 1 },
      }],
    })
    expect(convertOfficialCookieSkill(findCard('BS10-061'))).toMatchObject({
      trigger: 'activate',
      oncePerTurn: true,
      cost: { energy: {}, discardHand: 0 },
    })
  })

  it('keeps White Lily green On Play cost and opponent support threshold', () => {
    expect(convertOfficialCardEffects(findCard('BS10-069'))).toMatchObject({
      status: 'supported',
      effects: [{
        kind: 'deck-to-support',
        amount: 1,
        rested: true,
        condition: { kind: 'opponent-support-count-at-least', count: 6 },
      }],
    })
    expect(convertOfficialCookieSkill(findCard('BS10-069'))).toMatchObject({
      trigger: 'on-play',
      cost: { energy: { green: 1 }, discardHand: 0 },
    })
  })

  it('keeps Candy Diver bottom-deck cost and seven-card hand condition', () => {
    expect(convertOfficialCardEffects(findCard('BS10-074'))).toMatchObject({
      status: 'supported',
      effects: [{
        kind: 'draw-up-to',
        max: 1,
        condition: { kind: 'hand-count-at-most', count: 7 },
      }],
    })
    expect(convertOfficialCookieSkill(findCard('BS10-074'))).toMatchObject({
      trigger: 'activate',
      oncePerTurn: true,
      cost: { energy: { blue: 1 }, selfToDeckBottom: true },
    })
  })
})
