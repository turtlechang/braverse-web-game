import { describe, expect, it } from 'vitest'
import bs11CandidateDocument from '../../data/cards/official-dark-enchantress-war-bs11.en.json'
import {
  convertOfficialCardEffects,
  convertOfficialCardToGameCard,
  convertOfficialCookieSkill,
  type OfficialCardRecord,
} from '.'

const records = bs11CandidateDocument.cards as OfficialCardRecord[]

const findCard = (cardNumber: string): OfficialCardRecord => {
  const card = records.find((candidate) => candidate.cardNumber === cardNumber)
  if (!card) throw new Error(`Missing BS11 candidate fixture: ${cardNumber}`)
  return card
}

describe('BS11-094 candidate contract', () => {
  it('preserves the official source record and card art', () => {
    expect(findCard('BS11-094')).toMatchObject({
      baseCardNumber: 'BS11-094',
      name: 'Jam Skelecake Grunt',
      type: 'cookie',
      level: 1,
      hp: 3,
      energyType: 'BLACK MIX',
      color: 'BLACK',
      skill: {
        name: '{sk} Poking Preparations',
        text: "【Blocker】 <{K}> (When one of your opponent's Cookies attacks, you can redirect the attack to this Cookie.)",
      },
      attackText: '<{K}{N}> Jam Pitchfork {da} 1',
      imageUrl: 'https://cookierunbraverse.com/data/en_storage/bFs34TcyuM412HR4jYggow.webp',
    })
  })
})

describe('BS11-094 exact Blocker adapter', () => {
  it('keeps the black payment, block trigger, and source-only redirect effect', () => {
    const record = findCard('BS11-094')
    const expectedEffect = {
      kind: 'redirect-attack',
      target: { side: 'self', min: 1, max: 1, sourceOnly: true },
    }

    expect(convertOfficialCardEffects(record)).toEqual({
      status: 'supported',
      cardNumber: 'BS11-094',
      sourceText: record.skill.text,
      effects: [expectedEffect],
    })
    expect(convertOfficialCookieSkill(record)).toMatchObject({
      trigger: 'block',
      oncePerTurn: false,
      yourTurn: false,
      restSource: false,
      cost: { energy: { black: 1 }, discardHand: 0 },
      effects: [expectedEffect],
    })

    const converted = convertOfficialCardToGameCard(record)
    if (converted.status !== 'converted') throw new Error('BS11-094 must convert')
    expect(converted.gameCard).toMatchObject({
      type: 'cookie',
      attack: 1,
      attackCost: 2,
      attackEnergyCost: { black: 1, neutral: 1 },
      skill: {
        trigger: 'block',
        cost: { energy: { black: 1 }, discardHand: 0 },
        effects: [expectedEffect],
      },
    })
  })
})
