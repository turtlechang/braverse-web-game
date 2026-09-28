import { describe, expect, it } from 'vitest'
import bs11CandidateDocument from '../../data/cards/official-dark-enchantress-war-bs11.en.json'
import {
  convertOfficialCardEffects,
  convertOfficialCardToGameCard,
  convertOfficialItemAbility,
  convertOfficialStageAbility,
  convertOfficialTrapAbility,
  type OfficialCardRecord,
} from '.'

const records = bs11CandidateDocument.cards as OfficialCardRecord[]

const findCard = (cardNumber: string): OfficialCardRecord => {
  const card = records.find((candidate) => candidate.cardNumber === cardNumber)
  if (!card) throw new Error(`Missing BS11 candidate fixture: ${cardNumber}`)
  return card
}

const EXPECTED = {
  'BS11-009': {
    baseCardNumber: 'BS11-009',
    variant: null,
    name: 'Orb of Eternal Flame',
    type: 'item',
    color: 'RED',
    energyType: 'RED',
    imageUrl: 'https://cookierunbraverse.com/data/en_storage/jbzkTlE3Aqn4Wb4XM9uocg.webp',
    skillText: '<{R}{R}{R}> If one of your LV.2 or higher Cookies has 1 HP remaining, select up to 1 of your opponent\'s Cookies. That Cookie receives 3 damage.',
  },
  'BS11-010': {
    baseCardNumber: 'BS11-010',
    variant: null,
    name: "Flame's Protection",
    type: 'trap',
    color: 'RED',
    energyType: 'RED',
    imageUrl: 'https://cookierunbraverse.com/data/en_storage/0w0JmtpOu6H4GMG72didzw.webp',
    skillText: "<{R}> Select up to 1 of your opponent's Cookies. During this turn, that Cookie deals -1 attack damage. Then, <{N}> if there is a [Fire Spirit Cookie] or 【Ancient】 Cookie in your battle area, select up to 1 of your opponent's Cookies. That Cookie receives 1 damage.",
  },
  'BS11-010@1': {
    baseCardNumber: 'BS11-010',
    variant: '1',
    name: "Flame's Protection",
    type: 'trap',
    color: 'RED',
    energyType: 'RED MIX',
    imageUrl: 'https://cookierunbraverse.com/data/en_storage/yA4EJRgg-3QaPx-grzwMoQ.webp',
    skillText: "<{R}> Select up to 1 of your opponent's Cookies. During this turn, that Cookie deals -1 attack damage. Then, <{N}> if there is a [Fire Spirit Cookie] or 【Ancient】 Cookie in your battle area, select up to 1 of your opponent's Cookies. That Cookie receives 1 damage.",
  },
  'BS11-011': {
    baseCardNumber: 'BS11-011',
    variant: null,
    name: 'Canyon of Destruction',
    type: 'stage',
    color: 'RED',
    energyType: 'RED',
    imageUrl: 'https://cookierunbraverse.com/data/en_storage/yGK4jUtPv1qCQSsEHEKlXw.webp',
    skillText: '<{R}> Place in your stage area.\r\n\r\n【Activate】 <{R}> <Rest this card.> During this turn, if your Cookie fainted, select up to 1 of your opponent\'s Cookies. That Cookie receives 1 damage.',
  },
  'BS11-012': {
    baseCardNumber: 'BS11-012',
    variant: null,
    name: 'Avatar of Ruin Turmeric Statue',
    type: 'item',
    color: 'RED',
    energyType: 'RED',
    imageUrl: 'https://cookierunbraverse.com/data/en_storage/Q2KF9bQ9HYzobt7F0_SqDQ.webp',
    skillText: '<{R}{R}> During this turn, if 2 or more of your Cookies fainted, select up to 1 of your opponent\'s Cookies. That Cookie receives 2 damage.',
  },
} as const

const thenText = "Then, <{N}> if there is a [Fire Spirit Cookie] or 【Ancient】 Cookie in your battle area, select up to 1 of your opponent's Cookies. That Cookie receives 1 damage."

describe('BS11-009 to BS11-012 candidate metadata and source text', () => {
  it('keeps the candidate isolated and promoted-source', () => {
    expect(bs11CandidateDocument.source.candidateStatus).toBe('promotion-ready')
    expect(bs11CandidateDocument.source.imagesDownloaded).toBe(false)
  })

  it.each(Object.entries(EXPECTED))(
    '%s preserves source text, card identity, colour, type, variant, and image URL',
    (cardNumber, expected) => {
      const record = findCard(cardNumber)
      expect(record).toMatchObject({
        cardNumber,
        baseCardNumber: expected.baseCardNumber,
        variant: expected.variant,
        name: expected.name,
        type: expected.type,
        color: expected.color,
        energyType: expected.energyType,
        imageUrl: expected.imageUrl,
      })
      expect(record.skill.text).toBe(expected.skillText)

      const converted = convertOfficialCardToGameCard(record)
      expect(converted).toMatchObject({
        status: 'converted',
        source: {
          cardNumber,
          baseCardNumber: expected.baseCardNumber,
          variant: expected.variant,
          imageUrl: expected.imageUrl,
        },
        gameCard: {
          id: expected.baseCardNumber,
          name: expected.name,
          type: expected.type,
          officialType: expected.type,
          cardColor: 'red',
          energyColor: 'red',
          imageUrl: expected.imageUrl,
        },
      })
    },
  )
})

describe('BS11-009 and BS11-012 item adapters', () => {
  it('keeps BS11-009 level and remaining-HP on the same Cookie condition', () => {
    const record = findCard('BS11-009')
    expect(convertOfficialCardEffects(record)).toEqual({
      status: 'supported',
      cardNumber: 'BS11-009',
      sourceText: EXPECTED['BS11-009'].skillText,
      effects: [{
        kind: 'damage',
        amount: 3,
        target: { side: 'opponent', min: 0, max: 1 },
        condition: {
          kind: 'battle-area-has-cookie-with-level-and-remaining-hp',
          side: 'self',
          minLevel: 2,
          remainingHp: 1,
        },
      }],
    })
    expect(convertOfficialItemAbility(record)).toEqual({
      cost: { energy: { red: 3 }, discardHand: 0 },
      text: EXPECTED['BS11-009'].skillText,
      effects: [{
        kind: 'damage',
        amount: 3,
        target: { side: 'opponent', min: 0, max: 1 },
        condition: {
          kind: 'battle-area-has-cookie-with-level-and-remaining-hp',
          side: 'self',
          minLevel: 2,
          remainingHp: 1,
        },
      }],
    })
  })

  it('keeps BS11-012 red-red cost, faint count condition, and target', () => {
    const record = findCard('BS11-012')
    expect(convertOfficialItemAbility(record)).toMatchObject({
      cost: { energy: { red: 2 }, discardHand: 0 },
      text: EXPECTED['BS11-012'].skillText,
      effects: [{
        kind: 'damage',
        amount: 2,
        target: { side: 'opponent', min: 0, max: 1 },
        condition: {
          kind: 'cookies-fainted-this-turn-at-least',
          side: 'self',
          count: 2,
        },
      }],
    })
    expect(convertOfficialCardEffects(record)).toMatchObject({
      status: 'supported',
      sourceText: EXPECTED['BS11-012'].skillText,
      effects: [{
        kind: 'damage',
        amount: 2,
        condition: { kind: 'cookies-fainted-this-turn-at-least', side: 'self', count: 2 },
      }],
    })
  })
})

describe('BS11-010 and BS11-010@1 trap adapters', () => {
  it.each(['BS11-010', 'BS11-010@1'])('%s keeps both Then segments and independent targets', (cardNumber) => {
    const record = findCard(cardNumber)
    const trap = convertOfficialTrapAbility(record)
    expect(trap).toMatchObject({
      text: EXPECTED[cardNumber as keyof typeof EXPECTED].skillText,
      cost: { energy: { red: 1 }, discardHand: 0 },
      effects: [
        {
          kind: 'modify-attack',
          amount: -1,
          duration: 'this-turn',
          target: { side: 'opponent', min: 0, max: 1 },
        },
        {
          kind: 'optional-cost-attack',
          resolution: 'ability',
          payBeforeCondition: true,
          cost: { energy: { neutral: 1 }, discardHand: 0 },
          effectText: thenText,
          effects: [{
            kind: 'damage',
            amount: 1,
            target: { side: 'opponent', min: 0, max: 1 },
            condition: {
              kind: 'any-of',
              conditions: [
                { kind: 'battle-area-has-named-cookie', side: 'self', name: 'Fire Spirit Cookie' },
                { kind: 'battle-area-has-keyword', side: 'self', keyword: 'ancient' },
              ],
            },
          }],
        },
      ],
    })
  })
})

describe('BS11-011 stage adapter', () => {
  it('keeps placement cost, activation red cost, restSource, faint condition, and target', () => {
    const record = findCard('BS11-011')
    expect(convertOfficialStageAbility(record)).toEqual({
      placementCost: { red: 1 },
      cost: { energy: { red: 1 }, discardHand: 0 },
      text: EXPECTED['BS11-011'].skillText,
      effects: [{
        kind: 'damage',
        amount: 1,
        target: { side: 'opponent', min: 0, max: 1 },
        condition: {
          kind: 'cookies-fainted-this-turn-at-least',
          side: 'self',
          count: 1,
        },
      }],
      restSource: true,
    })
  })
})
