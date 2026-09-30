import { describe, expect, it } from 'vitest'
import bs11CandidateDocument from '../../data/cards/official-dark-enchantress-war-bs11.en.json'
import {
  convertOfficialAttackEffects,
  convertOfficialCardToGameCard,
  convertOfficialCookieSkill,
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
  'BS11-013': {
    baseCardNumber: 'BS11-013',
    variant: null,
    name: 'Roaring Destruction',
    type: 'trap',
    color: 'RED',
    energyType: 'RED',
    imageUrl: 'https://cookierunbraverse.com/data/en_storage/7Q7nNG1nGI2sP4mo2DX-8g.webp',
    skillText: "<{R}> If one of your LV.3 Cookies has 1 HP remaining, select up to 1 of your opponent's Cookies. During this turn, that Cookie deals -3 attack damage.",
    attackText: null,
  },
  'BS11-014': {
    baseCardNumber: 'BS11-014',
    variant: null,
    name: 'Nutmeg Tiger Cookie',
    type: 'cookie',
    color: 'RED',
    energyType: 'RED',
    imageUrl: 'https://cookierunbraverse.com/data/en_storage/vhDZwqv-ifk9EgiUt-JFBQ.webp',
    skillText: null,
    attackText: "<{R}{R}> Great General {da} 2\r\nThen, select up to 1 of your Cookies. Place 1 card from the top of that Cookie's HP into your trash.",
  },
  'BS11-014@1': {
    baseCardNumber: 'BS11-014',
    variant: '1',
    name: 'Nutmeg Tiger Cookie',
    type: 'cookie',
    color: 'RED',
    energyType: 'RED',
    imageUrl: 'https://cookierunbraverse.com/data/en_storage/FwWVNlCxjlCyZNXRcYa0LA.webp',
    skillText: null,
    attackText: "<{R}{R}> Great General {da} 2\r\nThen, select up to 1 of your Cookies. Place 1 card from the top of that Cookie's HP into your trash.",
  },
  'BS11-015': {
    baseCardNumber: 'BS11-015',
    variant: null,
    name: 'Wildberry Cookie',
    type: 'cookie',
    color: 'RED',
    energyType: 'RED',
    imageUrl: 'https://cookierunbraverse.com/data/en_storage/qUkHf0vqCO3iF5XgYnaYNA.webp',
    skillText: null,
    attackText: "<{R}{R}{R}{R}> Principled Uppercut {da} 4\r\nThen, if your opponent's Cookie fainted from this Cookie's attack, during this turn, your opponent cannot activate 【On Play】.",
  },
  'BS11-015@1': {
    baseCardNumber: 'BS11-015',
    variant: '1',
    name: 'Wildberry Cookie',
    type: 'cookie',
    color: 'RED',
    energyType: 'RED',
    imageUrl: 'https://cookierunbraverse.com/data/en_storage/Kpdkz5-1LFaoE4MPpX-1Mg.webp',
    skillText: null,
    attackText: "<{R}{R}{R}{R}> Principled Uppercut {da} 4\r\nThen, if your opponent's Cookie fainted from this Cookie's attack, during this turn, your opponent cannot activate 【On Play】.",
  },
} as const

const EXPECTED_TRAP_EFFECT = {
  kind: 'modify-attack',
  amount: -3,
  duration: 'this-turn',
  target: { side: 'opponent', min: 0, max: 1 },
} as const

describe('BS11-013 to BS11-015 candidate metadata and adapter coverage', () => {
  it.each(Object.entries(EXPECTED))(
    '%s preserves source identity, text, colour, type, variant, and image',
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

  it('maps BS11-013 to the exact LV.3 and remaining-HP trap condition', () => {
    const record = findCard('BS11-013')
    expect(convertOfficialTrapAbility(record)).toEqual({
      text: EXPECTED['BS11-013'].skillText,
      cost: { energy: { red: 1 }, discardHand: 0 },
      condition: {
        kind: 'battle-area-has-cookie-with-level-and-remaining-hp',
        minLevel: 3,
        maxLevel: 3,
        remainingHp: 1,
      },
      effects: [EXPECTED_TRAP_EFFECT],
    })
  })

  it('uses the BS11-013 base key for an applicable trap variant', () => {
    const baseRecord = findCard('BS11-013')
    const variantRecord: OfficialCardRecord = {
      ...baseRecord,
      cardNumber: 'BS11-013@1',
      variant: '1',
    }

    expect(convertOfficialTrapAbility(variantRecord)).toEqual(
      convertOfficialTrapAbility(baseRecord),
    )
  })

  it.each([
    ['BS11-014', 2, 2, {
      kind: 'hp-to-trash',
      amount: 1,
      target: { side: 'self', min: 0, max: 1 },
    }],
    ['BS11-014@1', 2, 2, {
      kind: 'hp-to-trash',
      amount: 1,
      target: { side: 'self', min: 0, max: 1 },
    }],
    ['BS11-015', 4, 4, {
      kind: 'prevent-opponent-on-play',
      duration: 'this-turn',
      condition: { kind: 'opponent-cookie-fainted-in-current-battle' },
    }],
    ['BS11-015@1', 4, 4, {
      kind: 'prevent-opponent-on-play',
      duration: 'this-turn',
      condition: { kind: 'opponent-cookie-fainted-in-current-battle' },
    }],
  ] as const)(
    '%s keeps the printed attack cost, damage, and ordered Then effect',
    (cardNumber, attackCost, attackDamage, thenEffect) => {
      const record = findCard(cardNumber)
      const attackEffects = convertOfficialAttackEffects(record)

      expect(attackEffects).toEqual([thenEffect])
      expect(convertOfficialCardToGameCard(record)).toMatchObject({
        status: 'converted',
        gameCard: {
          attack: attackDamage,
          attackCost,
          attackEnergyCost: { red: attackCost },
          attackText: EXPECTED[cardNumber].attackText,
          attackEffects: [thenEffect],
        },
      })
      expect(record.skill.text).toBeNull()
      expect(convertOfficialCookieSkill(record)).toBeUndefined()
    },
  )
})
