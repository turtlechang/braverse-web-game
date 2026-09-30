import { describe, expect, it } from 'vitest'
import bs11CandidateDocument from '../../data/cards/official-dark-enchantress-war-bs11.en.json'
import {
  convertOfficialCardEffects,
  convertOfficialCardToGameCard,
  convertOfficialItemAbility,
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
  'BS11-029': {
    sourceId: 53144,
    name: "Life's Protection",
    type: 'trap',
    officialType: 'TRAP',
    skillText: "<{Y}> Select up to 1 of your opponent's Cookies. During this turn, that Cookie deals -1 attack damage. Then, <{N}> if there is a [Millennial Tree Cookie] or 【Ancient】 Cookie in your battle area, select up to 1 of your Cookies. That Cookie gains +1 HP.",
    imageUrl: 'https://cookierunbraverse.com/data/en_storage/KVw3OjnkUqfFcueKyARwEA.webp',
  },
  'BS11-030': {
    sourceId: 53145,
    name: 'Life-Sprouting Jar',
    type: 'item',
    officialType: 'ITEM',
    skillText: '<{Y}> If your break area is LV.3 or higher, select up to 1 of your Cookies with 3 or less HP remaining. That Cookie gains +1 HP.',
    imageUrl: 'https://cookierunbraverse.com/data/en_storage/MDiyKhQKkrSN1U_f58nrrw.webp',
  },
  'BS11-031': {
    sourceId: 53146,
    name: 'Winged Tree',
    type: 'item',
    officialType: 'ITEM',
    skillText: "<{Y}> If there are 4 or more Cookies in your break area, select up to 1 of your opponent's Cookies. Until the end of your opponent's next turn, that Cookie's 【Activate】 cannot be activated unless your opponent discards 2 cards from their hand.",
    imageUrl: 'https://cookierunbraverse.com/data/en_storage/wfNKtKTmdW9sQKxwrgbVGw.webp',
  },
} as const

const LIFE_PROTECTION_EFFECTS = [
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
    effectText:
      "Then, <{N}> if there is a [Millennial Tree Cookie] or 【Ancient】 Cookie in your battle area, select up to 1 of your Cookies. That Cookie gains +1 HP.",
    effects: [{
      kind: 'gain-hp',
      amount: 1,
      target: { side: 'self', min: 0, max: 1 },
      condition: {
        kind: 'any-of',
        conditions: [
          {
            kind: 'battle-area-has-named-cookie',
            side: 'self',
            name: 'Millennial Tree Cookie',
          },
          {
            kind: 'battle-area-has-keyword',
            side: 'self',
            keyword: 'ancient',
          },
        ],
      },
    }],
  },
] as const

const LIFE_SPROUTING_JAR_EFFECT = {
  kind: 'gain-hp',
  amount: 1,
  target: { side: 'self', min: 0, max: 1, maxRemainingHp: 3 },
  condition: { kind: 'break-level-at-least', level: 3 },
} as const

const WINGED_TREE_EFFECT = {
  kind: 'require-cookie-activate-discard-hand',
  target: { side: 'opponent', min: 0, max: 1 },
  condition: {
    kind: 'break-area-card-count-at-least',
    side: 'self',
    count: 4,
  },
  count: 2,
} as const

describe('BS11-029 to BS11-031 candidate source contract', () => {
  it('keeps the BS11 candidate document promoted-source', () => {
    expect(bs11CandidateDocument.source.candidateStatus).toBe('promotion-ready')
  })

  it.each(Object.entries(EXPECTED))(
    '%s preserves source identity, metadata, and official card art',
    (cardNumber, expected) => {
      const record = findCard(cardNumber)
      expect(record).toMatchObject({
        sourceId: expected.sourceId,
        locale: 'en',
        cardNumber,
        baseCardNumber: cardNumber,
        variant: null,
        name: expected.name,
        type: expected.type,
        officialType: expected.officialType,
        rarity: 'U',
        grade: 'UNCOMMON',
        level: null,
        hp: null,
        energyType: 'YELLOW',
        color: 'YELLOW',
        skill: { name: null, text: expected.skillText },
        attackText: null,
        flipText: null,
        imageUrl: expected.imageUrl,
        sourceUrl: 'https://cookierunbraverse.com/data/json/cardList_en.json',
      })

      expect(convertOfficialCardToGameCard(record)).toMatchObject({
        status: 'converted',
        source: {
          cardNumber,
          baseCardNumber: cardNumber,
          variant: null,
          imageUrl: expected.imageUrl,
        },
        gameCard: {
          id: cardNumber,
          name: expected.name,
          type: expected.type,
          officialType: expected.type,
          cardColor: 'yellow',
          energyColor: 'yellow',
          imageUrl: expected.imageUrl,
        },
      })
    },
  )
})

describe('BS11-029 Life\'s Protection exact trap adapter', () => {
  it('keeps first-effect order, optional N payment, any-of condition, and separate targets', () => {
    const record = findCard('BS11-029')

    expect(convertOfficialCardEffects(record)).toEqual({
      status: 'supported',
      cardNumber: 'BS11-029',
      sourceText: record.skill.text,
      effects: LIFE_PROTECTION_EFFECTS,
    })

    const trap = convertOfficialTrapAbility(record)
    if (!trap) throw new Error('BS11-029 must convert to a trap ability')
    expect(trap).toEqual({
      text: record.skill.text,
      cost: { energy: { yellow: 1 }, discardHand: 0 },
      effects: LIFE_PROTECTION_EFFECTS,
    })
  })
})

describe('BS11-030 Life-Sprouting Jar exact item adapter', () => {
  it('keeps the LV.3 Break condition and max remaining HP target', () => {
    const record = findCard('BS11-030')

    expect(convertOfficialCardEffects(record)).toEqual({
      status: 'supported',
      cardNumber: 'BS11-030',
      sourceText: record.skill.text,
      effects: [LIFE_SPROUTING_JAR_EFFECT],
    })

    const item = convertOfficialItemAbility(record)
    expect(item).toEqual({
      cost: { energy: { yellow: 1 }, discardHand: 0 },
      text: record.skill.text,
      effects: [LIFE_SPROUTING_JAR_EFFECT],
    })
  })
})

describe('BS11-031 Winged Tree exact item adapter', () => {
  it('keeps the Activate restriction, Break count condition, and discard count', () => {
    const record = findCard('BS11-031')

    expect(convertOfficialCardEffects(record)).toEqual({
      status: 'supported',
      cardNumber: 'BS11-031',
      sourceText: record.skill.text,
      effects: [WINGED_TREE_EFFECT],
    })

    const item = convertOfficialItemAbility(record)
    expect(item).toEqual({
      cost: { energy: { yellow: 1 }, discardHand: 0 },
      text: record.skill.text,
      effects: [WINGED_TREE_EFFECT],
    })
    expect(WINGED_TREE_EFFECT.kind).toBe('require-cookie-activate-discard-hand')
  })
})
