import { describe, expect, it } from 'vitest'
import bs11CandidateDocument from '../../data/candidates/official-dark-enchantress-war-bs11.en.json'
import {
  convertOfficialCardEffects,
  convertOfficialCardToGameCard,
  convertOfficialCookieSkill,
  convertOfficialStageAbility,
  convertOfficialTrapAbility,
  type OfficialCardRecord,
} from '.'

const records = bs11CandidateDocument.cards as OfficialCardRecord[]
const cardNumbers = [
  'BS11-060',
  'BS11-061',
  'BS11-062',
  'BS11-063',
  'BS11-063@1',
] as const

const findCard = (cardNumber: string): OfficialCardRecord => {
  const card = records.find((candidate) => candidate.cardNumber === cardNumber)
  if (!card) throw new Error(`Missing BS11 candidate fixture: ${cardNumber}`)
  return card
}

const EXPECTED = {
  'BS11-060': {
    sourceId: 53175,
    name: 'Hero Cookie',
    type: 'cookie',
    officialType: 'COOKIE',
    energyType: 'BLUE MIX',
    level: 1,
    hp: 2,
    skillText: null,
    flipText: null,
    attackText: '<{N}> New Suit Design {da} 1',
    imageUrl: 'https://cookierunbraverse.com/data/en_storage/NWRtbFcg-kw4-5oCAmqX4g.webp',
  },
  'BS11-061': {
    sourceId: 53176,
    name: 'Candy Apple Cookie',
    type: 'cookie',
    officialType: 'COOKIE',
    energyType: 'BLUE',
    level: 1,
    hp: 3,
    skillText: "【Activate】 【Once Per Turn】 <{B}{B}> Select up to 1 of your opponent's Cookies. Place 1 card from the top of that Cookie's HP on the bottom of your opponent's deck.",
    flipText: null,
    attackText: '<{B}{B}> Apple of My Eye! {da} 1',
    imageUrl: 'https://cookierunbraverse.com/data/en_storage/UVxFySVpt0K-vn0RGdvXQw.webp',
  },
  'BS11-062': {
    sourceId: 53177,
    name: 'Top of the Spire of Deceit',
    type: 'stage',
    officialType: 'STAGE',
    energyType: 'BLUE',
    level: null,
    hp: null,
    skillText: '<{B}{B}> Place in your stage area.\r\n\r\n【Activate】 <Place this card in your trash.> View all cards in your opponent\'s hand.',
    flipText: null,
    attackText: null,
    imageUrl: 'https://cookierunbraverse.com/data/en_storage/TWrBheSy1fgWQ9_92HZVxg.webp',
  },
  'BS11-063': {
    sourceId: 53178,
    name: "Sea's Protection",
    type: 'trap',
    officialType: 'TRAP',
    energyType: 'BLUE',
    level: null,
    hp: null,
    skillText: "<{B}> Select up to 1 of your opponent's Cookies. During this turn, that Cookie deals -1 attack damage. Then, if there is a [Sea Fairy Cookie] or 【Ancient】 Cookie in your battle area, draw up to 1 card from your deck.",
    flipText: null,
    attackText: null,
    imageUrl: 'https://cookierunbraverse.com/data/en_storage/GbSI_he-mnQb44Smx4zGHQ.webp',
  },
  'BS11-063@1': {
    sourceId: 54213,
    name: "Sea's Protection",
    type: 'trap',
    officialType: 'TRAP',
    energyType: 'BLUE',
    level: null,
    hp: null,
    skillText: "<{B}> Select up to 1 of your opponent's Cookies. During this turn, that Cookie deals -1 attack damage. Then, if there is a [Sea Fairy Cookie] or 【Ancient】 Cookie in your battle area, draw up to 1 card from your deck.",
    flipText: null,
    attackText: null,
    imageUrl: 'https://cookierunbraverse.com/data/en_storage/XgVKXPLcsVUyJKvEVspn5A.webp',
  },
} as const

describe('BS11-060 to BS11-063 candidate source contract', () => {
  it('keeps the six requested records and preserves source data', () => {
    expect(bs11CandidateDocument.source.candidateStatus).toBe('inventory')
    expect(bs11CandidateDocument.source.imagesDownloaded).toBe(false)
    expect(records.filter((card) => cardNumbers.includes(card.cardNumber as typeof cardNumbers[number]))).toHaveLength(6)

    for (const cardNumber of cardNumbers) {
      const expected = EXPECTED[cardNumber]
      const record = findCard(cardNumber)
      expect(record).toMatchObject({
        sourceId: expected.sourceId,
        locale: 'en',
        cardNumber,
        baseCardNumber: cardNumber === 'BS11-063@1' ? 'BS11-063' : cardNumber,
        variant: cardNumber === 'BS11-063@1' ? '1' : null,
        name: expected.name,
        type: expected.type,
        officialType: expected.officialType,
        color: 'BLUE',
        energyType: expected.energyType,
        level: expected.level,
        hp: expected.hp,
        imageUrl: expected.imageUrl,
        sourceUrl: 'https://cookierunbraverse.com/data/json/cardList_en.json',
        attackText: expected.attackText,
      })
      expect(record.skill?.text ?? null).toBe(expected.skillText)
      expect(record.flipText ?? null).toBe(expected.flipText)
    }
  })
})

describe('BS11-060 to BS11-063 exact adapters', () => {
  it('keeps Hero Cookie skill-less and parses BLUE MIX attack as neutral payment', () => {
    const card = findCard('BS11-060')
    expect(convertOfficialCookieSkill(card)).toBeUndefined()
    expect(convertOfficialCardToGameCard(card)).toMatchObject({
      status: 'converted',
      gameCard: {
        attack: 1,
        attackCost: 1,
        attackEnergyCost: { neutral: 1 },
      },
    })
  })

  it('maps Candy Apple Cookie to a 2B once-per-turn optional HP-to-deck-bottom effect', () => {
    const card = findCard('BS11-061')
    expect(convertOfficialCardEffects(card)).toMatchObject({
      status: 'supported',
      effects: [{
        kind: 'field-to-deck-bottom',
        target: { side: 'opponent', min: 0, max: 1 },
        hpOnly: true,
      }],
    })
    expect(convertOfficialCookieSkill(card)).toMatchObject({
      trigger: 'activate',
      oncePerTurn: true,
      cost: { energy: { blue: 2 }, discardHand: 0 },
      effects: [{ kind: 'field-to-deck-bottom' }],
    })
  })

  it('maps Top of the Spire of Deceit to stage placement, trash cost, and opponent hand view', () => {
    const card = findCard('BS11-062')
    expect(convertOfficialStageAbility(card)).toMatchObject({
      placementCost: { blue: 2 },
      cost: { energy: {}, discardHand: 0, stageSourceToTrash: true },
      effects: [{ kind: 'reveal-hand', amount: 0, side: 'opponent', viewAll: true }],
    })
  })

  it('maps Sea\'s Protection and its alternate art to conditional draw after optional -1 attack', () => {
    const expectedEffects = [
      {
        kind: 'modify-attack',
        amount: -1,
        duration: 'this-turn',
        target: { side: 'opponent', min: 0, max: 1 },
      },
      {
        kind: 'draw-up-to',
        max: 1,
        condition: {
          kind: 'any-of',
          conditions: [
            { kind: 'battle-area-has-named-cookie', side: 'self', name: 'Sea Fairy Cookie' },
            { kind: 'battle-area-has-keyword', side: 'self', keyword: 'ancient' },
          ],
        },
      },
    ]
    for (const cardNumber of ['BS11-063', 'BS11-063@1'] as const) {
      const trap = convertOfficialTrapAbility(findCard(cardNumber))
      expect(trap).toMatchObject({
        cost: { energy: { blue: 1 }, discardHand: 0 },
        effects: expectedEffects,
      })
    }
  })
})
