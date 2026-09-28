import { describe, expect, it } from 'vitest'
import bs11CandidateDocument from '../../data/cards/official-dark-enchantress-war-bs11.en.json'
import {
  convertOfficialCardEffects,
  convertOfficialCookieSkill,
  convertOfficialItemAbility,
} from './official-effect-adapter'
import type { OfficialCardRecord } from './types'

const records = bs11CandidateDocument.cards as OfficialCardRecord[]

const findCard = (cardNumber: string): OfficialCardRecord => {
  const card = records.find((candidate) => candidate.cardNumber === cardNumber)
  if (!card) throw new Error(`Missing BS11 candidate fixture: ${cardNumber}`)
  return card
}

describe('BS11-103／104／109 candidate contract', () => {
  it('keeps the official card identity, text, and art URLs', () => {
    expect(findCard('BS11-103')).toMatchObject({
      type: 'cookie',
      name: 'Skelecake Bomber',
      energyType: 'BLACK',
      skill: {
        text: expect.stringContaining('5 cards or less in your hand'),
      },
    })
    expect(findCard('BS11-104')).toMatchObject({
      type: 'cookie',
      name: 'Cake Witch',
      energyType: 'BLACK',
      skill: {
        text: expect.stringContaining('When this Cookie faints'),
      },
    })
    expect(findCard('BS11-109')).toMatchObject({
      type: 'item',
      name: 'Emblem of Darkness',
      energyType: 'BLACK',
      skill: {
        text: expect.stringContaining('5 cards from the top of your deck'),
      },
    })

    for (const cardNumber of ['BS11-103', 'BS11-104', 'BS11-109']) {
      expect(findCard(cardNumber).imageUrl).toMatch(/^https:\/\//)
    }
  })
})

describe('BS11-103／104／109 exact adapter', () => {
  it('converts the shared Special Play and black-card selectors', () => {
    expect(convertOfficialCardEffects(findCard('BS11-103'))).toMatchObject({
      status: 'supported',
      effects: [{
        kind: 'trash-to-hand',
        max: 1,
        cookieOnly: true,
        hasSpecialPlay: true,
        condition: { kind: 'hand-count-at-most', count: 5 },
      }],
    })
    expect(convertOfficialCookieSkill(findCard('BS11-103'))).toMatchObject({
      trigger: 'on-play',
      effects: [{
        kind: 'trash-to-hand',
        hasSpecialPlay: true,
      }],
    })

    expect(convertOfficialCookieSkill(findCard('BS11-104'))).toMatchObject({
      faint: true,
      effects: [{
        kind: 'inspect-deck',
        lookCount: 3,
        pickCount: 1,
        restDestination: 'trash',
        filterColor: 'black',
        optionalPick: true,
      }],
    })

    expect(convertOfficialItemAbility(findCard('BS11-109'))).toMatchObject({
      cost: { black: 1 },
      effects: [{
        kind: 'inspect-deck',
        lookCount: 5,
        pickCount: 1,
        restDestination: 'trash',
        filterType: 'cookie',
        filterHasSpecialPlay: true,
        optionalPick: true,
      }],
    })
  })
})
