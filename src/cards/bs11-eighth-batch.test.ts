import { describe, expect, it } from 'vitest'
import bs11CandidateDocument from '../../data/cards/official-dark-enchantress-war-bs11.en.json'
import {
  convertOfficialCardEffects,
  convertOfficialCardToGameCard,
  convertOfficialCookieSkill,
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
  'BS11-026': {
    sourceId: 53141,
    name: 'Wizard Cookie',
    type: 'cookie',
    officialType: 'COOKIE',
    level: 2,
    hp: 3,
    energyType: 'YELLOW',
    color: 'YELLOW',
    skillName: '{sk} Newly Acquired Magic',
    skillText: '【Activate】 【Once Per Turn】 <{Y}> <Discard 1 Cookie that has FLIP from your hand.> Select up to 1 of your opponent\'s Cookies. That Cookie receives 1 damage.',
    attackText: '<{Y}{Y}> Powerful Incantation {da} 2',
    imageUrl: 'https://cookierunbraverse.com/data/en_storage/8rHylxWbP-ZLviVwhrPyIg.webp',
  },
  'BS11-027': {
    sourceId: 53142,
    name: 'Passion Escaping Paradise',
    type: 'trap',
    officialType: 'TRAP',
    level: null,
    hp: null,
    energyType: 'YELLOW',
    color: 'YELLOW',
    skillName: null,
    skillText: "<{Y}{Y}> During this turn, all of your opponent's Cookies deal -1 attack damage. Then, select up to 1 of your opponent's Cookies. During this turn, the attack cost of that Cookie is increased by 1 {N}.",
    attackText: null,
    imageUrl: 'https://cookierunbraverse.com/data/en_storage/nLjgLyvqBtwJ4iwfQM4OMg.webp',
  },
  'BS11-028': {
    sourceId: 53143,
    name: 'Berry Paradise',
    type: 'stage',
    officialType: 'STAGE',
    level: null,
    hp: null,
    energyType: 'YELLOW',
    color: 'YELLOW',
    skillName: null,
    skillText: '<{Y}> Place in your stage area.\r\n\r\n【Activate】 <Rest this card.> <Place 1 card from the top of your {Y} Cookie\'s HP into your trash.> If there are 6 cards or less in your hand, draw up to 1 card from your deck.',
    attackText: null,
    imageUrl: 'https://cookierunbraverse.com/data/en_storage/CA2QCZS93bWF4xI7C-XAhQ.webp',
  },
} as const

const WIZARD_DAMAGE_EFFECT = {
  kind: 'damage',
  amount: 1,
  target: { side: 'opponent', min: 0, max: 1 },
} as const

const PASSION_EFFECTS = [
  {
    kind: 'modify-all-attack',
    amount: -1,
    duration: 'this-turn',
    side: 'opponent',
  },
  {
    kind: 'modify-attack-cost',
    target: { side: 'opponent', min: 0, max: 1 },
    energyCost: { neutral: 1 },
    operation: 'increase',
    duration: 'this-turn',
  },
] as const

const BERRY_DRAW_EFFECT = {
  kind: 'draw-up-to',
  max: 1,
  condition: { kind: 'hand-count-at-most', count: 6 },
} as const

describe('BS11-026 to BS11-028 candidate source and card data', () => {
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
        type: expected.type,
        officialType: expected.officialType,
        rarity: 'U',
        level: expected.level,
        hp: expected.hp,
        energyType: expected.energyType,
        color: expected.color,
        attackText: expected.attackText,
        flipText: null,
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

describe('BS11-026 Wizard Cookie exact skill adapter', () => {
  it('keeps Activate/Once Per Turn, Y1 payment, FLIP Cookie discard, and optional target', () => {
    const record = findCard('BS11-026')

    expect(convertOfficialCardEffects(record)).toEqual({
      status: 'supported',
      cardNumber: 'BS11-026',
      sourceText: record.skill.text,
      effects: [WIZARD_DAMAGE_EFFECT],
    })

    expect(convertOfficialCookieSkill(record)).toMatchObject({
      trigger: 'activate',
      oncePerTurn: true,
      yourTurn: false,
      restSource: false,
      cost: {
        energy: { yellow: 1 },
        discardHand: 1,
        discardHandType: 'cookie',
        discardHandHasFlip: true,
      },
      text: record.skill.text,
      effects: [WIZARD_DAMAGE_EFFECT],
    })

    const converted = convertOfficialCardToGameCard(record)
    if (converted.status !== 'converted') throw new Error('BS11-026 must convert')
    expect(converted.gameCard).toMatchObject({
      attack: 2,
      attackCost: 2,
      attackEnergyCost: { yellow: 2 },
      skill: {
        trigger: 'activate',
        oncePerTurn: true,
        cost: {
          discardHand: 1,
          discardHandType: 'cookie',
          discardHandHasFlip: true,
        },
        effects: [WIZARD_DAMAGE_EFFECT],
      },
    })
  })
})

describe('BS11-027 Passion Escaping Paradise exact trap adapter', () => {
  it('keeps all-opponent damage reduction before the optional neutral attack-cost increase', () => {
    const record = findCard('BS11-027')
    const trap = convertOfficialTrapAbility(record)
    if (!trap) throw new Error('BS11-027 must convert to a trap ability')

    expect(trap.cost).toEqual({ energy: { yellow: 2 }, discardHand: 0 })
    expect(trap.condition).toBeUndefined()
    expect(trap.effects).toEqual(PASSION_EFFECTS)

    const converted = convertOfficialCardToGameCard(record)
    if (converted.status !== 'converted') throw new Error('BS11-027 must convert')
    expect(converted.gameCard).toMatchObject({
      type: 'trap',
      trap: {
        cost: { energy: { yellow: 2 }, discardHand: 0 },
        effects: PASSION_EFFECTS,
      },
    })
  })
})

describe('BS11-028 Berry Paradise exact stage adapter', () => {
  it('keeps Y1 placement, rest self, yellow Cookie HP cost, hand gate, and draw order', () => {
    const record = findCard('BS11-028')
    const stage = convertOfficialStageAbility(record)
    if (!stage) throw new Error('BS11-028 must convert to a stage ability')

    expect(stage).toEqual({
      placementCost: { yellow: 1 },
      cost: {
        energy: {},
        discardHand: 0,
        hpToTrash: { amount: 1, energyColor: 'yellow' },
      },
      text: record.skill.text,
      effects: [BERRY_DRAW_EFFECT],
      restSource: true,
    })

    const converted = convertOfficialCardToGameCard(record)
    if (converted.status !== 'converted') throw new Error('BS11-028 must convert')
    expect(converted.gameCard).toMatchObject({
      type: 'stage',
      stageAbility: stage,
    })
  })
})
