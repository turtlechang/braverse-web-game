import { describe, expect, it } from 'vitest'
import bs11CandidateDocument from '../../data/cards/official-dark-enchantress-war-bs11.en.json'
import {
  convertOfficialAttackEffects,
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

const EXPECTED = {
  'BS11-017': {
    baseCardNumber: 'BS11-017',
    variant: null,
    name: 'Hollyberry Cookie',
    type: 'cookie',
    color: 'RED',
    energyType: 'RED MIX',
    imageUrl: 'https://cookierunbraverse.com/data/en_storage/e4YtAKr2n97Jh0Ev0NOBHQ.webp',
    skillText: 'If this Cookie has 3 or less HP remaining, the attack cost of this Cookie is reduced by 1 {R}.',
    attackText: '<{R}{N}{N}> Song of the Aegis {da} 2\r\nThen, if there is another 【Ancient】 Cookie in your battle area, deals 2 damage.',
  },
  'BS11-017@1': {
    baseCardNumber: 'BS11-017',
    variant: '1',
    name: 'Hollyberry Cookie',
    type: 'cookie',
    color: 'RED',
    energyType: 'RED MIX',
    imageUrl: 'https://cookierunbraverse.com/data/en_storage/mtH4OQzdovsd5awiq0SkpA.webp',
    skillText: 'If this Cookie has 3 or less HP remaining, the attack cost of this Cookie is reduced by 1 {R}.',
    attackText: '<{R}{N}{N}> Song of the Aegis {da} 2\r\nThen, if there is another 【Ancient】 Cookie in your battle area, deals 2 damage.',
  },
  'BS11-018': {
    baseCardNumber: 'BS11-018',
    variant: null,
    name: 'Burning Spice Cookie',
    type: 'cookie',
    color: 'RED',
    energyType: 'RED',
    imageUrl: 'https://cookierunbraverse.com/data/en_storage/JBwpyQf1XDbcST3gThKX-A.webp',
    skillText: '【Activate】 【Once Per Turn】 <Make 1 of your {R} Cookies faint.> If there are 5 cards or less in your hand, draw up to 2 cards from your deck.',
    attackText: '<{R}{R}{R}> Destroyer\'s Wrath {da} 3\r\nThen, <make 1 of your Cookies faint.> Deals 1 damage.',
  },
  'BS11-018@1': {
    baseCardNumber: 'BS11-018',
    variant: '1',
    name: 'Burning Spice Cookie',
    type: 'cookie',
    color: 'RED',
    energyType: 'RED',
    imageUrl: 'https://cookierunbraverse.com/data/en_storage/NT79kgGP8tC6Ed2dP1bhbQ.webp',
    skillText: '【Activate】 【Once Per Turn】 <Make 1 of your {R} Cookies faint.> If there are 5 cards or less in your hand, draw up to 2 cards from your deck.',
    attackText: '<{R}{R}{R}> Destroyer\'s Wrath {da} 3\r\nThen, <make 1 of your Cookies faint.> Deals 1 damage.',
  },
} as const

const HOLLYBERRY_PASSIVE = {
  kind: 'modify-attack-cost',
  target: { side: 'self', min: 1, max: 1, sourceOnly: true },
  energyCost: { red: 1 },
  operation: 'reduce',
  duration: 'persistent',
  condition: { kind: 'source-hp-at-most', amount: 3 },
} as const

const BURNING_SPICE_SKILL_EFFECTS = [{
  kind: 'draw-up-to',
  max: 2,
  condition: { kind: 'hand-count-at-most', count: 5 },
}] as const

describe('BS11-017 and BS11-018 candidate metadata and source text', () => {
  it('keeps the candidate isolated and promoted-source', () => {
    expect(bs11CandidateDocument.source.candidateStatus).toBe('promotion-ready')
    expect(bs11CandidateDocument.source.imagesDownloaded).toBe(false)
  })

  it.each(Object.entries(EXPECTED))(
    '%s preserves source identity, text, colour, type, variant, image, and base card identity',
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
      expect(record.attackText).toBe(expected.attackText)

      expect(convertOfficialCardToGameCard(record)).toMatchObject({
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
          attackText: expected.attackText,
        },
      })
    },
  )
})

describe('BS11-017 and BS11-018 exact skill adapters', () => {
  it.each(['BS11-017', 'BS11-017@1'] as const)(
    '%s keeps the persistent Hollyberry passive separate from one-shot effects',
    (cardNumber) => {
      const record = findCard(cardNumber)
      expect(convertOfficialCardEffects(record)).toEqual({
        status: 'supported',
        cardNumber,
        sourceText: record.skill.text,
        effects: [],
      })
      expect(convertOfficialCookieSkill(record)).toMatchObject({
        trigger: 'passive',
        oncePerTurn: false,
        cost: { energy: {}, discardHand: 0 },
        effects: [],
        passiveEffects: [HOLLYBERRY_PASSIVE],
      })
    },
  )

  it.each(['BS11-018', 'BS11-018@1'] as const)(
    '%s keeps the exact faint cost, hand condition, and timing markers',
    (cardNumber) => {
      const record = findCard(cardNumber)
      expect(convertOfficialCardEffects(record)).toEqual({
        status: 'supported',
        cardNumber,
        sourceText: record.skill.text,
        effects: BURNING_SPICE_SKILL_EFFECTS,
      })
      expect(convertOfficialCookieSkill(record)).toMatchObject({
        trigger: 'activate',
        oncePerTurn: true,
        cost: {
          energy: {},
          discardHand: 0,
          trashBattleCookie: { count: 1, faint: true, energyColor: 'red' },
        },
        effects: BURNING_SPICE_SKILL_EFFECTS,
      })
    },
  )
})

describe('BS11-017 and BS11-018 attack Then adapters', () => {
  it.each(['BS11-017', 'BS11-017@1'] as const)(
    '%s requires another Ancient and never counts the source Cookie',
    (cardNumber) => {
      expect(convertOfficialAttackEffects(findCard(cardNumber))).toEqual([{
        kind: 'damage',
        amount: 2,
        target: { side: 'opponent', min: 0, max: 1 },
        condition: {
          kind: 'battle-area-has-keyword',
          side: 'self',
          keyword: 'ancient',
          excludeSource: true,
        },
      }])
    },
  )

  it.each(['BS11-018', 'BS11-018@1'] as const)(
    '%s resolves attack Then in make-faint then damage order',
    (cardNumber) => {
      expect(convertOfficialAttackEffects(findCard(cardNumber))).toEqual([
        { kind: 'make-faint', target: { side: 'self', min: 0, max: 1 } },
        { kind: 'damage', amount: 1, target: { side: 'opponent', min: 0, max: 1 } },
      ])
    },
  )
})

describe('BS11-017 and BS11-018 conversion status', () => {
  it.each(Object.keys(EXPECTED))('%s is converted by every card-layer adapter', (cardNumber) => {
    const record = findCard(cardNumber)
    expect(convertOfficialCardEffects(record).status).toBe('supported')
    expect(convertOfficialAttackEffects(record)).toBeDefined()
    expect(convertOfficialCardToGameCard(record).status).toBe('converted')
  })
})
