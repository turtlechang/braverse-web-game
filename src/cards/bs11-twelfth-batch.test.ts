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
  'BS11-040': {
    sourceId: 53155,
    name: 'Melon Bun Cookie',
    type: 'flip',
    level: 2,
    hp: 3,
    energyType: 'GREEN',
    attackText: '<{G}{G}{G}> Ore Mining {da} 3',
    flipText: 'Draw up to 1 card from your deck.',
    imageUrl: 'https://cookierunbraverse.com/data/en_storage/b10d4od8VaDzfaoMfwDjvg.webp',
  },
  'BS11-041': {
    sourceId: 53156,
    name: 'Peach Blossom Cookie',
    type: 'cookie',
    level: 3,
    hp: 4,
    energyType: 'GREEN',
    skillText: '【Activate】 【Once Per Turn】 <Return 1 {G} card from your support area to your hand.> All of your Cookies gain +1 HP.',
    attackText: '<{G}{G}{G}> Gentle Fruit Scent {da} 3',
    imageUrl: 'https://cookierunbraverse.com/data/en_storage/TJ6BUvIfocKweCNvQNUVGQ.webp',
  },
  'BS11-042': {
    sourceId: 53157,
    name: 'Shine Muscat Cookie',
    type: 'cookie',
    level: 2,
    hp: 4,
    energyType: 'GREEN MIX',
    skillText: '【On Play】 Set up to 1 card in your support area as active.',
    attackText: '<{G}{G}{N}> Skilled Adlibs {da} 2',
    imageUrl: 'https://cookierunbraverse.com/data/en_storage/hPbuWevgeq6K5ILjOTo24Q.webp',
  },
  'BS11-043': {
    sourceId: 53158,
    name: 'Ginseng Cookie',
    type: 'cookie',
    level: 1,
    hp: 2,
    energyType: 'GREEN MIX',
    attackText: '<{N}> Ginseng Acupuncture {da} 1',
    imageUrl: 'https://cookierunbraverse.com/data/en_storage/XRP8wWnxPf4r2WxW7y95LA.webp',
  },
  'BS11-044': {
    sourceId: 53159,
    name: 'Silverbell Cookie',
    type: 'cookie',
    level: 1,
    hp: 3,
    energyType: 'GREEN',
    skillText: 'If there are 7 cards or more in your support area, this Cookie gains +1 attack damage.',
    attackText: '<{G}{G}{G}> Silver Arrow {da} 2',
    imageUrl: 'https://cookierunbraverse.com/data/en_storage/0L5n_T5ckFK14T8z8gpICQ.webp',
  },
} as const

const PEACH_BLOSSOM_EFFECTS = [{
  kind: 'gain-hp',
  amount: 1,
  target: { side: 'self', min: 1, max: 2, allMatching: true },
}] as const

describe('BS11-040 to BS11-044 candidate source contract', () => {
  it('keeps the candidate document promoted-source and preserves supplied card art/text', () => {
    expect(bs11CandidateDocument.source.candidateStatus).toBe('promotion-ready')
    expect(bs11CandidateDocument.source.imagesDownloaded).toBe(false)

    for (const [cardNumber, expected] of Object.entries(EXPECTED)) {
      const record = findCard(cardNumber)
      expect(record).toMatchObject({
        sourceId: expected.sourceId,
        locale: 'en',
        cardNumber,
        baseCardNumber: cardNumber,
        variant: null,
        name: expected.name,
        type: expected.type,
        officialType: expected.type === 'flip' ? 'FLIP' : 'COOKIE',
        level: expected.level,
        hp: expected.hp,
        energyType: expected.energyType,
        color: 'GREEN',
        attackText: expected.attackText,
        flipText: 'flipText' in expected ? expected.flipText : null,
        imageUrl: expected.imageUrl,
        sourceUrl: 'https://cookierunbraverse.com/data/json/cardList_en.json',
      })
      if ('skillText' in expected) {
        expect(record.skill).toEqual({ name: expect.any(String), text: expected.skillText })
      } else {
        expect(record.skill).toEqual({ name: null, text: null })
      }
    }
  })
})

describe('BS11-040 to BS11-044 exact card adapters', () => {
  it('converts BS11-040 as a zero-cost GREEN FLIP with draw up to 1', () => {
    const record = findCard('BS11-040')
    expect(convertOfficialFlipAbility(record)).toEqual({
      text: record.flipText,
      cost: { energy: {}, discardHand: 0 },
      effects: [{ kind: 'draw-up-to', max: 1 }],
    })
    expect(convertOfficialAttackEffects(record)).toBeUndefined()
  })

  it('converts BS11-041 with a green support cost and all-Cookie HP gain', () => {
    const record = findCard('BS11-041')
    expect(convertOfficialCardEffects(record)).toEqual({
      status: 'supported',
      cardNumber: 'BS11-041',
      sourceText: record.skill.text,
      effects: PEACH_BLOSSOM_EFFECTS,
    })
    expect(convertOfficialCookieSkill(record)).toMatchObject({
      trigger: 'activate',
      oncePerTurn: true,
      cost: {
        energy: {},
        discardHand: 0,
        supportToHand: 1,
        supportToHandColor: 'green',
      },
      effects: PEACH_BLOSSOM_EFFECTS,
    })
  })

  it('converts BS11-042 as an On Play optional support recovery', () => {
    const record = findCard('BS11-042')
    expect(convertOfficialCardEffects(record)).toEqual({
      status: 'supported',
      cardNumber: 'BS11-042',
      sourceText: record.skill.text,
      effects: [{
        kind: 'set-active',
        supportCount: 1,
        selectable: true,
        optional: true,
      }],
    })
    expect(convertOfficialCookieSkill(record)).toMatchObject({
      trigger: 'on-play',
      cost: { energy: {}, discardHand: 0 },
    })
  })

  it('keeps BS11-043 as a no-effect GREEN MIX Cookie', () => {
    const record = findCard('BS11-043')
    expect(convertOfficialCookieSkill(record)).toBeUndefined()
    expect(convertOfficialAttackEffects(record)).toBeUndefined()

    const converted = convertOfficialCardToGameCard(record)
    if (converted.status !== 'converted') throw new Error('BS11-043 must convert')
    if (converted.gameCard.type !== 'cookie') throw new Error('BS11-043 must be a Cookie')
    expect(converted.gameCard).toMatchObject({
      name: 'Ginseng Cookie',
      level: 1,
      hp: 2,
      attack: 1,
      attackCost: 1,
      attackEnergyCost: { neutral: 1 },
    })
    expect(converted.gameCard.attackEffects).toBeUndefined()
  })

  it('keeps BS11-044 as a persistent support-count attack bonus', () => {
    const record = findCard('BS11-044')
    expect(convertOfficialCardEffects(record)).toEqual({
      status: 'supported',
      cardNumber: 'BS11-044',
      sourceText: record.skill.text,
      effects: [],
    })
    expect(convertOfficialCookieSkill(record)).toMatchObject({
      trigger: 'passive',
      passiveEffects: [{
        kind: 'modify-attack',
        amount: 1,
        duration: 'persistent',
        target: { side: 'self', min: 1, max: 1, sourceOnly: true },
        condition: { kind: 'support-count-at-least', count: 7 },
      }],
    })
  })
})
