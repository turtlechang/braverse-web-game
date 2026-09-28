import { describe, expect, it } from 'vitest'
import bs11CandidateDocument from '../../data/cards/official-dark-enchantress-war-bs11.en.json'
import {
  convertOfficialCardToGameCard,
  convertOfficialFlipAbility,
  type OfficialCardRecord,
} from '.'

const records = bs11CandidateDocument.cards as OfficialCardRecord[]
const cardNumbers = ['BS11-093', 'BS11-096', 'BS11-100', 'BS11-101'] as const

const EXPECTED = {
  'BS11-093': {
    sourceId: 53208,
    name: 'Poison Mushroom Cookie',
    attackText: '<{K}> Fragrant Shroomies {da} 1',
    flipText: '<Discard 1 card.> The Cookie with this card attached for HP gains +1 HP.',
    imageUrl: 'https://cookierunbraverse.com/data/en_storage/fg4xO-nbXQR--3Vife1MKg.webp',
    attack: 1,
    attackCost: 1,
  },
  'BS11-096': {
    sourceId: 53211,
    name: 'Butter Roll Cookie',
    attackText: '<{K}{K}> Dough Ingredient Prep {da} 2',
    flipText: '<Discard 1 card.> The Cookie with this card attached for HP gains +1 HP.',
    imageUrl: 'https://cookierunbraverse.com/data/en_storage/3EEqKZr7PvjInBqDNHAFsA.webp',
    attack: 2,
    attackCost: 2,
  },
  'BS11-100': {
    sourceId: 53215,
    name: 'Agar Agar Cookie',
    attackText: '<{K}> Nature Power Release {da} 1',
    flipText: 'Draw up to 1 card from your deck.',
    imageUrl: 'https://cookierunbraverse.com/data/en_storage/_beufkuGD8c4oS6K8-YjRQ.webp',
    attack: 1,
    attackCost: 1,
  },
  'BS11-101': {
    sourceId: 53216,
    name: 'Schwarzwälder',
    attackText: '<{K}> Choco Chip Hammer {da} 1',
    flipText: '<Discard 1 card.> The Cookie with this card attached for HP gains +1 HP.',
    imageUrl: 'https://cookierunbraverse.com/data/en_storage/RBTsJf2uJWr_FZ4dEXNe-g.webp',
    attack: 1,
    attackCost: 1,
  },
} as const

const findCard = (cardNumber: string): OfficialCardRecord => {
  const card = records.find((candidate) => candidate.cardNumber === cardNumber)
  if (!card) throw new Error(`Missing BS11 candidate fixture: ${cardNumber}`)
  return card
}

describe('BS11-093／096／100／101 candidate source contract', () => {
  it('preserves the four official FLIP records and verified card art', () => {
    expect(bs11CandidateDocument.source.candidateStatus).toBe('promotion-ready')
    expect(bs11CandidateDocument.source.imagesDownloaded).toBe(false)

    for (const cardNumber of cardNumbers) {
      const expected = EXPECTED[cardNumber]
      expect(findCard(cardNumber)).toMatchObject({
        sourceId: expected.sourceId,
        locale: 'en',
        cardNumber,
        baseCardNumber: cardNumber,
        variant: null,
        name: expected.name,
        type: 'flip',
        officialType: 'FLIP',
        color: 'BLACK',
        energyType: 'BLACK',
        level: 1,
        hp: 1,
        skill: { name: null, text: null },
        attackText: expected.attackText,
        flipText: expected.flipText,
        imageUrl: expected.imageUrl,
        sourceUrl: 'https://cookierunbraverse.com/data/json/cardList_en.json',
      })
    }
  })
})

describe('BS11-093／096／100／101 exact FLIP adapters', () => {
  it.each([
    ['BS11-093', { discardHand: 1, attachedHpBonus: 1 }],
    ['BS11-096', { discardHand: 1, attachedHpBonus: 1 }],
    ['BS11-101', { discardHand: 1, attachedHpBonus: 1 }],
  ] as const)('maps %s to the discard-one attached-cookie HP bonus', (cardNumber, expected) => {
    expect(convertOfficialFlipAbility(findCard(cardNumber))).toEqual({
      text: EXPECTED[cardNumber].flipText,
      cost: { energy: {}, discardHand: expected.discardHand },
      effects: [],
      attachedHpBonus: expected.attachedHpBonus,
    })
  })

  it('maps BS11-100 to a free draw-up-to-one FLIP', () => {
    expect(convertOfficialFlipAbility(findCard('BS11-100'))).toEqual({
      text: EXPECTED['BS11-100'].flipText,
      cost: { energy: {}, discardHand: 0 },
      effects: [{ kind: 'draw-up-to', max: 1 }],
    })
  })

  it.each(cardNumbers)('converts %s with printed LV.1／HP1 and black attack payment', (cardNumber) => {
    const converted = convertOfficialCardToGameCard(findCard(cardNumber))
    if (converted.status !== 'converted') throw new Error(`${cardNumber} must convert`)
    const expected = EXPECTED[cardNumber]
    expect(converted.gameCard).toMatchObject({
      name: expected.name,
      type: 'cookie',
      officialType: 'flip',
      level: 1,
      hp: 1,
      attack: expected.attack,
      attackCost: expected.attackCost,
      attackEnergyCost: { black: expected.attackCost },
      flip: cardNumber === 'BS11-100'
        ? { cost: { energy: {}, discardHand: 0 }, effects: [{ kind: 'draw-up-to', max: 1 }] }
        : { cost: { energy: {}, discardHand: 1 }, effects: [], attachedHpBonus: 1 },
    })
  })
})
