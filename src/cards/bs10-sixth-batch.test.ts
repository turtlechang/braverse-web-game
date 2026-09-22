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

describe('BS10-044, BS10-046, BS10-050, BS10-071, BS10-072, BS10-097 and BS10-117', () => {
  it('keeps Angel HP cost and other yellow Cookie gain target', () => {
    expect(convertOfficialCardEffects(findCard('BS10-044'))).toMatchObject({
      status: 'supported',
      effects: [{
        kind: 'gain-hp',
        amount: 1,
        target: { side: 'self', min: 0, max: 1, excludeSource: true, energyColor: 'yellow' },
      }],
    })
    expect(convertOfficialCookieSkill(findCard('BS10-044'))).toMatchObject({
      trigger: 'activate',
      oncePerTurn: true,
      cost: { energy: { yellow: 1 }, hpToTrash: { amount: 1, sourceOnly: true } },
    })
  })

  it('keeps Sugarfly hand and gained-HP conditions together', () => {
    expect(convertOfficialCardEffects(findCard('BS10-046'))).toMatchObject({
      status: 'supported',
      effects: [{
        kind: 'draw-up-to',
        max: 1,
        condition: {
          kind: 'all-of',
          conditions: [
            { kind: 'hand-count-at-most', count: 6 },
            { kind: 'cookie-gained-hp-this-turn' },
          ],
        },
      }],
    })
    expect(convertOfficialCookieSkill(findCard('BS10-046'))).toMatchObject({
      trigger: 'activate',
      oncePerTurn: true,
      cost: { energy: {}, discardHand: 0 },
    })
  })

  it('keeps Gim support threshold and selectable active effect', () => {
    expect(convertOfficialCardEffects(findCard('BS10-050'))).toMatchObject({
      status: 'supported',
      effects: [{
        kind: 'set-active',
        supportCount: 1,
        selectable: true,
        optional: true,
        condition: { kind: 'support-count-at-least', count: 7 },
      }],
    })
    expect(convertOfficialCookieSkill(findCard('BS10-050'))).toMatchObject({
      trigger: 'activate',
      oncePerTurn: true,
      cost: { energy: {}, discardHand: 0 },
    })
  })

  it('keeps Mercurial Knight green Cookie return cost and rested source placement', () => {
    expect(convertOfficialCardEffects(findCard('BS10-071'))).toMatchObject({
      status: 'supported',
      effects: [{ kind: 'place-source-to-support', rested: true }],
    })
    expect(convertOfficialCookieSkill(findCard('BS10-071'))).toMatchObject({
      trigger: 'activate',
      cost: {
        energy: { green: 2 },
        supportToHand: 1,
        supportToHandType: 'cookie',
        supportToHandColor: 'green',
      },
    })
  })

  it('keeps Elder Faerie active opponent support target behind the threshold', () => {
    expect(convertOfficialCardEffects(findCard('BS10-072'))).toMatchObject({
      status: 'supported',
      effects: [{
        kind: 'rest-support',
        side: 'opponent',
        amount: 1,
        activeOnly: true,
        condition: { kind: 'opponent-support-count-at-least', count: 6 },
      }],
    })
    expect(convertOfficialCookieSkill(findCard('BS10-072'))).toMatchObject({
      trigger: 'activate',
      oncePerTurn: true,
      cost: { energy: {}, discardHand: 0 },
    })
  })

  it('keeps Manju hand discard cost and opponent hand threshold', () => {
    expect(convertOfficialCardEffects(findCard('BS10-097'))).toMatchObject({
      status: 'supported',
      effects: [{
        kind: 'opponent-discard-hand',
        count: 1,
        condition: { kind: 'opponent-hand-count-at-least', count: 6 },
      }],
    })
    expect(convertOfficialCookieSkill(findCard('BS10-097'))).toMatchObject({
      trigger: 'activate',
      oncePerTurn: true,
      cost: { energy: {}, discardHand: 1 },
    })
  })

  it('keeps Seaweed purple payment and other LV.2-or-lower Cookie trash cost', () => {
    expect(convertOfficialCardEffects(findCard('BS10-117'))).toMatchObject({
      status: 'supported',
      effects: [{ kind: 'deck-to-trash', amount: 3, side: 'self' }],
    })
    expect(convertOfficialCookieSkill(findCard('BS10-117'))).toMatchObject({
      trigger: 'on-play',
      cost: {
        energy: { purple: 1 },
        trashBattleCookie: {
          count: 1,
          maxLevel: 2,
          energyColor: 'purple',
          excludeSource: true,
        },
      },
    })
  })
})
