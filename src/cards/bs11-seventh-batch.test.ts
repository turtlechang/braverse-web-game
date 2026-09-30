import { describe, expect, it } from 'vitest'
import bs11CandidateDocument from '../../data/cards/official-dark-enchantress-war-bs11.en.json'
import {
  convertOfficialAttackEffects,
  convertOfficialCardEffects,
  convertOfficialCardToGameCard,
  convertOfficialCookieSkill,
  convertOfficialFlipAbility,
  type OfficialCardRecord,
} from '.'

const records = bs11CandidateDocument.cards as OfficialCardRecord[]

const findCard = (cardNumber: string): OfficialCardRecord => {
  const card = records.find((candidate) => candidate.cardNumber === cardNumber)
  if (!card) throw new Error(`Missing BS11 candidate fixture: ${cardNumber}`)
  return card
}

const EXPECTED = {
  'BS11-023': {
    sourceId: 53138,
    name: 'Chestnut Cookie',
    level: 1,
    hp: 2,
    energyType: 'YELLOW MIX',
    attackText: '<{N}> Newspaper Delivery {da} 1',
    attack: 1,
    attackCost: 1,
    attackEnergyCost: { neutral: 1 },
    skillName: null,
    skillText: null,
    imageUrl: 'https://cookierunbraverse.com/data/en_storage/Hz6-yFfHcvP2IAymw7BGqg.webp',
  },
  'BS11-024': {
    sourceId: 53139,
    name: 'Smoked Cheese Cookie',
    level: 1,
    hp: 3,
    energyType: 'YELLOW',
    attackText: '<{Y}{Y}{Y}> Smoke Explosion {da} 2',
    attack: 2,
    attackCost: 3,
    attackEnergyCost: { yellow: 3 },
    skillName: '{sk} Get Smoked!',
    skillText: 'When this Cookie faints, play up to 1 LV.3 Cookie from your hand. Then, that Cookie gains +1 HP.',
    imageUrl: 'https://cookierunbraverse.com/data/en_storage/FCgYvhVTWSYJJWF8ljztBA.webp',
  },
  'BS11-025': {
    sourceId: 53140,
    name: 'Fettuccine Cookie',
    level: 2,
    hp: 2,
    energyType: 'YELLOW',
    attackText: '<{Y}{Y}> Fettuccine Whip {da} 3\r\nThen, draw up to 2 cards from your deck and place this Cookie in your break area.',
    attack: 3,
    attackCost: 2,
    attackEnergyCost: { yellow: 2 },
    skillName: null,
    skillText: null,
    imageUrl: 'https://cookierunbraverse.com/data/en_storage/KzFZGVgnHlP-Vq7yJYifLw.webp',
  },
} as const

const SMOKED_CHEESE_EFFECT = {
  kind: 'hand-to-battle',
  amount: 1,
  minLevel: 3,
  maxLevel: 3,
  optional: true,
  gainHp: 1,
} as const

const FETTUCCINE_ATTACK_EFFECTS = [
  { kind: 'draw-up-to', max: 2 },
  {
    kind: 'battle-to-break',
    target: { side: 'self', min: 1, max: 1, sourceOnly: true },
  },
] as const

describe('BS11-023 to BS11-025 candidate source and card data', () => {
  it('keeps the BS11 candidate document promoted-source', () => {
    expect(bs11CandidateDocument.source.candidateStatus).toBe('promotion-ready')
    expect(bs11CandidateDocument.source.imagesDownloaded).toBe(false)
  })

  it.each(Object.entries(EXPECTED))(
    '%s preserves official source fields, card art, and printed card data',
    (cardNumber, expected) => {
      const record = findCard(cardNumber)
      expect(record).toMatchObject({
        sourceId: expected.sourceId,
        locale: 'en',
        cardNumber,
        baseCardNumber: cardNumber,
        variant: null,
        name: expected.name,
        type: 'cookie',
        officialType: 'COOKIE',
        rarity: 'C',
        grade: 'COMMON',
        level: expected.level,
        hp: expected.hp,
        energyType: expected.energyType,
        color: 'YELLOW',
        attackText: expected.attackText,
        flipText: null,
        keywords: [],
        imageUrl: expected.imageUrl,
        sourceUrl: 'https://cookierunbraverse.com/data/json/cardList_en.json',
        product: {
          id: 258,
          title: 'BOOSTER PACK [The Dark Enchantress War]',
        },
        skill: {
          name: expected.skillName,
          text: expected.skillText,
        },
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
          type: 'cookie',
          officialType: 'cookie',
          cardColor: 'yellow',
          energyColor: 'yellow',
          level: expected.level,
          hp: expected.hp,
          attack: expected.attack,
          attackCost: expected.attackCost,
          attackEnergyCost: expected.attackEnergyCost,
          attackText: expected.attackText,
          imageUrl: expected.imageUrl,
        },
      })
    },
  )
})

describe('BS11-023 no-effect contract', () => {
  it('keeps Chestnut Cookie as a vanilla Cookie without skill or FLIP effect', () => {
    const record = findCard('BS11-023')
    expect(convertOfficialCardEffects(record)).toEqual({
      status: 'unsupported',
      cardNumber: 'BS11-023',
      sourceText: null,
      reason: 'no-effect-text',
    })
    expect(convertOfficialCookieSkill(record)).toBeUndefined()
    expect(convertOfficialFlipAbility(record)).toBeUndefined()
    expect(convertOfficialAttackEffects(record)).toBeUndefined()

    const converted = convertOfficialCardToGameCard(record)
    if (converted.status !== 'converted') throw new Error('BS11-023 must convert')
    if (converted.gameCard.type !== 'cookie') throw new Error('BS11-023 must be a Cookie')
    expect(converted.gameCard.skill).toBeUndefined()
    expect(converted.gameCard.flip).toBeUndefined()
    expect(converted.gameCard.effects).toBeUndefined()
    expect(converted.gameCard.attackEffects).toBeUndefined()
  })
})

describe('BS11-024 faint trigger contract', () => {
  it('maps the LV.3 hand play and binds Then +1 HP to the played Cookie', () => {
    const record = findCard('BS11-024')
    expect(convertOfficialCardEffects(record)).toEqual({
      status: 'supported',
      cardNumber: 'BS11-024',
      sourceText: record.skill.text,
      effects: [SMOKED_CHEESE_EFFECT],
    })
    expect(convertOfficialCookieSkill(record)).toMatchObject({
      trigger: 'passive',
      oncePerTurn: false,
      yourTurn: false,
      faint: true,
      cost: { energy: {}, discardHand: 0 },
      text: record.skill.text,
      effects: [SMOKED_CHEESE_EFFECT],
    })

    const converted = convertOfficialCardToGameCard(record)
    if (converted.status !== 'converted') throw new Error('BS11-024 must convert')
    expect(converted.gameCard.effects).toEqual([SMOKED_CHEESE_EFFECT])
    expect(converted.gameCard.skill).toMatchObject({
      faint: true,
      effects: [SMOKED_CHEESE_EFFECT],
    })
  })
})

describe('BS11-025 attack Then contract', () => {
  it('draws first and then moves only the attacking Cookie to the break area', () => {
    const record = findCard('BS11-025')
    expect(convertOfficialCardEffects(record)).toEqual({
      status: 'unsupported',
      cardNumber: 'BS11-025',
      sourceText: null,
      reason: 'no-effect-text',
    })
    expect(convertOfficialCookieSkill(record)).toBeUndefined()
    expect(convertOfficialAttackEffects(record)).toEqual(FETTUCCINE_ATTACK_EFFECTS)

    const converted = convertOfficialCardToGameCard(record)
    if (converted.status !== 'converted') throw new Error('BS11-025 must convert')
    if (converted.gameCard.type !== 'cookie') throw new Error('BS11-025 must be a Cookie')
    expect(converted.gameCard.attackEffects).toEqual(FETTUCCINE_ATTACK_EFFECTS)
    expect(converted.gameCard.effects).toBeUndefined()
  })
})
