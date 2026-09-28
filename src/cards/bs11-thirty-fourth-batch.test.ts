import { describe, expect, it } from 'vitest'
import bs11CandidateDocument from '../../data/cards/official-dark-enchantress-war-bs11.en.json'
import {
  convertOfficialCardEffects,
  convertOfficialCardToGameCard,
  convertOfficialCookieSkill,
} from '.'
import type { OfficialCardRecord } from './types'

const records = bs11CandidateDocument.cards as OfficialCardRecord[]

const findCard = (cardNumber: string): OfficialCardRecord => {
  const card = records.find((candidate) => candidate.cardNumber === cardNumber)
  if (!card) throw new Error(`Missing BS11 candidate fixture: ${cardNumber}`)
  return card
}

const expectedEffect = {
  kind: 'set-cookie-level',
  level: 1,
  duration: 'this-turn',
  target: { side: 'self', min: 1, max: 1, sourceOnly: true },
}

describe('BS11-092 candidate contract', () => {
  it('preserves the official Cookie body, timing text, and card art', () => {
    expect(findCard('BS11-092')).toMatchObject({
      baseCardNumber: 'BS11-092',
      name: 'Licorice Cookie',
      type: 'cookie',
      level: 2,
      hp: 4,
      energyType: 'BLACK',
      color: 'BLACK',
      skill: {
        name: '{sk} Licorice Power',
        text: '【Activate】 【Once Per Turn】 During this turn, the LV. of this Cookie in your battle area becomes 1.',
      },
      attackText: '<{K}{K}{K}> Giant Servants {da} 2',
      imageUrl: 'https://cookierunbraverse.com/data/en_storage/WGZzvmUQ9PlhmNGavMqzZQ.webp',
    })
  })
})

describe('BS11-092 exact Activate adapter', () => {
  it('converts the free Once Per Turn skill without changing the printed LV', () => {
    const record = findCard('BS11-092')
    expect(convertOfficialCardEffects(record)).toEqual({
      status: 'supported',
      cardNumber: 'BS11-092',
      sourceText: record.skill.text,
      effects: [expectedEffect],
    })
    expect(convertOfficialCookieSkill(record)).toMatchObject({
      trigger: 'activate',
      oncePerTurn: true,
      yourTurn: false,
      restSource: false,
      cost: { energy: {}, discardHand: 0 },
      effects: [expectedEffect],
    })

    const converted = convertOfficialCardToGameCard(record)
    if (converted.status !== 'converted') throw new Error('BS11-092 must convert')
    expect(converted.gameCard).toMatchObject({
      type: 'cookie',
      level: 2,
      hp: 4,
      attack: 2,
      attackCost: 3,
      attackEnergyCost: { black: 3 },
      skill: {
        trigger: 'activate',
        oncePerTurn: true,
        cost: { energy: {}, discardHand: 0 },
        effects: [expectedEffect],
      },
    })
  })
})
