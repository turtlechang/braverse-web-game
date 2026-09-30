import { describe, expect, it } from 'vitest'
import bs11CandidateDocument from '../../data/cards/official-dark-enchantress-war-bs11.en.json'
import {
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
  'BS11-019': {
    name: 'Potato Salad Cookie',
    type: 'flip',
    officialType: 'FLIP',
    level: 1,
    hp: 1,
    color: 'YELLOW',
    energyType: 'YELLOW',
    attackText: '<{Y}{Y}> Have a taste-yam! {da} 2',
    skillText: null,
    flipText: '<Discard 1 card.> The Cookie with this card attached for HP gains +1 HP.',
  },
  'BS11-020': {
    name: 'Royal Margarine Cookie',
    type: 'flip',
    officialType: 'FLIP',
    level: 2,
    hp: 3,
    color: 'YELLOW',
    energyType: 'YELLOW',
    attackText: '<{Y}{Y}{Y}> Buttercream Swoop {da} 3',
    skillText: null,
    flipText: 'Draw up to 1 card from your deck.',
  },
  'BS11-021': {
    name: 'Book of Wizdom',
    type: 'cookie',
    officialType: 'COOKIE',
    level: 1,
    hp: 1,
    color: 'YELLOW',
    energyType: 'YELLOW',
    attackText: '<{Y}{Y}> Random Magic {da} 2',
    skillText: '【Activate】 【Once Per Turn】 If there is a [Wizard Cookie] in your battle area, return up to 1 Cookie that has FLIP from your trash to your hand.',
    flipText: null,
  },
  'BS11-022': {
    name: 'Mozzarella Cookie',
    type: 'cookie',
    officialType: 'COOKIE',
    level: 2,
    hp: 2,
    color: 'YELLOW',
    energyType: 'YELLOW MIX',
    attackText: '<{N}{N}{N}> Critical Bug Fix {da} 4',
    skillText: null,
    flipText: null,
  },
} as const

describe('BS11-019 to BS11-022 candidate adapter', () => {
  it.each(Object.entries(EXPECTED))(
    '%s preserves candidate identity, source text, and printed body',
    (cardNumber, expected) => {
      const record = findCard(cardNumber)
      expect(record).toMatchObject({
        cardNumber,
        baseCardNumber: cardNumber,
        name: expected.name,
        type: expected.type,
        officialType: expected.officialType,
        level: expected.level,
        hp: expected.hp,
        color: expected.color,
        energyType: expected.energyType,
        attackText: expected.attackText,
        flipText: expected.flipText,
      })
      expect(record.skill.text).toBe(expected.skillText)

      expect(convertOfficialCardToGameCard(record)).toMatchObject({
        status: 'converted',
        source: {
          cardNumber,
          baseCardNumber: cardNumber,
          variant: null,
          imageUrl: record.imageUrl,
        },
        gameCard: {
          id: cardNumber,
          name: expected.name,
          type: 'cookie',
          level: expected.level,
          hp: expected.hp,
          cardColor: 'yellow',
          energyColor: 'yellow',
          attackText: expected.attackText,
        },
      })
    },
  )

  it('maps BS11-019 FLIP to discard-one plus attached-cookie HP gain', () => {
    const record = findCard('BS11-019')
    expect(convertOfficialCardEffects(record)).toEqual({
      status: 'supported',
      cardNumber: 'BS11-019',
      sourceText: record.flipText,
      effects: [],
    })

    const flip = convertOfficialFlipAbility(record)
    if (!flip) throw new Error('BS11-019 must have a FLIP ability')
    expect(flip).toEqual({
      text: record.flipText,
      cost: { energy: {}, discardHand: 1 },
      effects: [],
      attachedHpBonus: 1,
    })
  })

  it('maps BS11-020 FLIP to a zero-cost draw-up-to effect', () => {
    const record = findCard('BS11-020')
    expect(convertOfficialCardEffects(record)).toEqual({
      status: 'supported',
      cardNumber: 'BS11-020',
      sourceText: record.flipText,
      effects: [{ kind: 'draw-up-to', max: 1 }],
    })

    const flip = convertOfficialFlipAbility(record)
    if (!flip) throw new Error('BS11-020 must have a FLIP ability')
    expect(flip).toEqual({
      text: record.flipText,
      cost: { energy: {}, discardHand: 0 },
      effects: [{ kind: 'draw-up-to', max: 1 }],
    })
    expect(flip.attachedHpBonus).toBeUndefined()
  })

  it('maps BS11-021 to an Activate once-per-turn Wizard Cookie-gated FLIP recovery', () => {
    const record = findCard('BS11-021')
    const expectedEffect = {
      kind: 'trash-to-hand',
      max: 1,
      cookieOnly: true,
      hasFlip: true,
      condition: {
        kind: 'battle-area-has-named-cookie',
        side: 'self',
        name: 'Wizard Cookie',
      },
    } as const

    expect(convertOfficialCardEffects(record)).toEqual({
      status: 'supported',
      cardNumber: 'BS11-021',
      sourceText: record.skill.text,
      effects: [expectedEffect],
    })

    const skill = convertOfficialCookieSkill(record)
    if (!skill) throw new Error('BS11-021 must have a Cookie skill')
    expect(skill).toMatchObject({
      trigger: 'activate',
      oncePerTurn: true,
      yourTurn: false,
      cost: { energy: {}, discardHand: 0 },
      text: record.skill.text,
    })
    expect(skill.effects).toEqual([expectedEffect])
  })

  it('keeps BS11-022 as a no-effect-text Cookie without skill or FLIP ability', () => {
    const record = findCard('BS11-022')
    expect(convertOfficialCardEffects(record)).toEqual({
      status: 'unsupported',
      cardNumber: 'BS11-022',
      sourceText: null,
      reason: 'no-effect-text',
    })
    expect(convertOfficialCookieSkill(record)).toBeUndefined()
    expect(convertOfficialFlipAbility(record)).toBeUndefined()

    const converted = convertOfficialCardToGameCard(record)
    if (converted.status !== 'converted') throw new Error('BS11-022 must convert')
    expect(converted.gameCard.skill).toBeUndefined()
    expect(converted.gameCard.flip).toBeUndefined()
    expect(converted.gameCard.effects).toBeUndefined()
  })
})
