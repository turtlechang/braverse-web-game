import { describe, expect, it } from 'vitest'
import bs11CandidateDocument from '../../data/cards/official-dark-enchantress-war-bs11.en.json'
import {
  convertOfficialCardToGameCard,
  convertOfficialFlipAbility,
  type OfficialCardRecord,
} from '.'

const records = bs11CandidateDocument.cards as OfficialCardRecord[]

const EXPECTED = {
  'BS11-095': {
    sourceId: 53210,
    name: 'Matcha Cookie',
    type: 'flip',
    officialType: 'FLIP',
    energyType: 'BLACK',
    color: 'BLACK',
    level: 1,
    hp: 1,
    attackText: '<{K}{K}> Tea Seed Summoning {da} 2',
    flipText: 'Draw up to 1 card from your deck.',
    imageUrl: 'https://cookierunbraverse.com/data/en_storage/J7YQ5bBw4HSo-EE4srQlpQ.webp',
  },
  'BS11-102': {
    sourceId: 53217,
    name: 'Cake Warrior',
    type: 'cookie',
    officialType: 'COOKIE',
    energyType: 'BLACK MIX',
    color: 'BLACK',
    level: 1,
    hp: 2,
    attackText: '<{N}{N}> Stick Swing {da} 2',
    flipText: null,
    imageUrl: 'https://cookierunbraverse.com/data/en_storage/kiih9sp8oEYyHjifKcC7Ww.webp',
  },
} as const

const findCard = (cardNumber: keyof typeof EXPECTED): OfficialCardRecord => {
  const card = records.find((candidate) => candidate.cardNumber === cardNumber)
  if (!card) throw new Error(`Missing BS11 candidate fixture: ${cardNumber}`)
  return card
}

describe('BS11-095／102 candidate source contract', () => {
  it('preserves the official FLIP and vanilla Cookie records with verified art', () => {
    expect(bs11CandidateDocument.source.candidateStatus).toBe('promotion-ready')
    expect(bs11CandidateDocument.source.imagesDownloaded).toBe(false)

    for (const cardNumber of Object.keys(EXPECTED) as Array<keyof typeof EXPECTED>) {
      const expected = EXPECTED[cardNumber]
      expect(findCard(cardNumber)).toMatchObject({
        sourceId: expected.sourceId,
        locale: 'en',
        cardNumber,
        baseCardNumber: cardNumber,
        variant: null,
        name: expected.name,
        type: expected.type,
        officialType: expected.officialType,
        color: expected.color,
        energyType: expected.energyType,
        level: expected.level,
        hp: expected.hp,
        skill: { name: null, text: null },
        attackText: expected.attackText,
        flipText: expected.flipText,
        imageUrl: expected.imageUrl,
        sourceUrl: 'https://cookierunbraverse.com/data/json/cardList_en.json',
      })
    }
  })
})

describe('BS11-095 exact FLIP adapter and BS11-102 conversion', () => {
  it('maps BS11-095 to a free draw-up-to-one FLIP', () => {
    expect(convertOfficialFlipAbility(findCard('BS11-095'))).toEqual({
      text: EXPECTED['BS11-095'].flipText,
      cost: { energy: {}, discardHand: 0 },
      effects: [{ kind: 'draw-up-to', max: 1 }],
    })
  })

  it('converts BS11-095 with the exact FLIP and BS11-102 as a vanilla BLACK MIX Cookie', () => {
    const flip = convertOfficialCardToGameCard(findCard('BS11-095'))
    const vanilla = convertOfficialCardToGameCard(findCard('BS11-102'))

    expect(flip).toMatchObject({
      status: 'converted',
      gameCard: {
        name: 'Matcha Cookie',
        type: 'cookie',
        officialType: 'flip',
        cardColor: 'black',
        energyColor: 'black',
        level: 1,
        hp: 1,
        attack: 2,
        attackCost: 2,
        attackEnergyCost: { black: 2 },
        flip: { cost: { energy: {}, discardHand: 0 }, effects: [{ kind: 'draw-up-to', max: 1 }] },
      },
    })
    expect(vanilla).toMatchObject({
      status: 'converted',
      gameCard: {
        name: 'Cake Warrior',
        type: 'cookie',
        officialType: 'cookie',
        cardColor: 'black',
        energyColor: 'black',
        level: 1,
        hp: 2,
        attack: 2,
        attackCost: 2,
        attackEnergyCost: { neutral: 2 },
      },
    })
    if (vanilla.status !== 'converted') throw new Error('BS11-102 must convert')
    expect(vanilla.gameCard).not.toHaveProperty('flip')
  })
})
