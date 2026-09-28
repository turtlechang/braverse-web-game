import { describe, expect, it } from 'vitest'
import bs11CandidateDocument from '../../data/cards/official-dark-enchantress-war-bs11.en.json'
import {
  convertOfficialAttackEffects,
  convertOfficialCardEffects,
  convertOfficialCardToGameCard,
  convertOfficialCookieSkill,
  type OfficialCardRecord,
} from '.'
import { analyzeOfficialCardBehavior } from './contracts/ledger'

const records = bs11CandidateDocument.cards as OfficialCardRecord[]

const findCard = (cardNumber: string): OfficialCardRecord => {
  const card = records.find((candidate) => candidate.cardNumber === cardNumber)
  if (!card) throw new Error(`Missing BS11 candidate fixture: ${cardNumber}`)
  return card
}

const EXPECTED = {
  'BS11-032': {
    sourceId: 53147,
    name: 'Burnt Cheese Cookie',
    skillName: "{sk} Earth's Protection",
    skillText: 'Can be activated when your turn ends. During this turn, if a LV.3 Cookie was played from your break area, place this Cookie in your trash.',
    attackText: "<{Y}> Gatekeeper's Warning {da} 1\r\nThen, <place 1 other {Y} Cookie from your battle area into your break area.> Draw up to 1 card from your deck.",
    imageUrl: 'https://cookierunbraverse.com/data/en_storage/z6eJKRRuYNFH2-LpxqRHKA.webp',
  },
  'BS11-033': {
    sourceId: 53148,
    name: 'Pavlova Cookie',
    skillName: null,
    skillText: null,
    attackText: "<{Y}> Arrow of Love {da} 1\r\nThen, during this turn, if any of your Cookies gained HP, <place this Cookie in your trash.> Draw up to 1 card from your deck.",
    imageUrl: 'https://cookierunbraverse.com/data/en_storage/4oxrgBNMlN4A9WER5vGxIQ.webp',
  },
  'BS11-034': {
    sourceId: 53149,
    name: 'Golden Cheese Cookie',
    skillName: "{sk} Immortal's Return",
    skillText: 'If this Cookie is in your break area, <reveal Cookies from your hand with a total LV. sum of 3.> Play this Cookie. Then, place the revealed Cookies in your break area.',
    attackText: "<{Y}{N}{N}> Radiant Brilliance {da} 3\r\nThen, <{N}> deals 1 damage for each LV.2 or higher 【Ancient】 Cookie in your break area.",
    imageUrl: 'https://cookierunbraverse.com/data/en_storage/FNSdHWijvzxe3Jet8qEAnA.webp',
  },
  'BS11-035': {
    sourceId: 53150,
    name: 'Millennial Tree Cookie',
    skillName: '{sk} Millennial Tree',
    skillText: '【On Play】 <{Y}{Y}> <Place 1 Cookie from your hand into your break area.> Return up to 1 {Y} Cookie that is LV.2 or lower from your break area to your hand.',
    attackText: "<{Y}{Y}{Y}> World Tree Shield {da} 3\r\nThen, <{Y}> <discard 1 Cookie that has FLIP from your hand.> Deals 2 damage.",
    imageUrl: 'https://cookierunbraverse.com/data/en_storage/GFUQDZ11mga3x_6sLEZwCA.webp',
  },
} as const

const BURNT_CHEESE_ATTACK = [
  {
    kind: 'battle-to-break',
    target: {
      side: 'self',
      min: 0,
      max: 1,
      excludeSource: true,
      energyColor: 'yellow',
    },
    thenEffects: [{ kind: 'draw-up-to', max: 1 }],
  },
] as const

const PAVLOVA_ATTACK = [
  {
    kind: 'field-to-trash',
    target: { side: 'self', min: 1, max: 1, sourceOnly: true },
    condition: { kind: 'cookie-gained-hp-this-turn' },
  },
  { kind: 'draw-up-to', max: 1 },
] as const

describe('BS11-032 to BS11-035 candidate source contract', () => {
  it('keeps the candidate document promoted-source and preserves the supplied card art/text', () => {
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
        type: 'cookie',
        officialType: 'COOKIE',
        energyType: cardNumber === 'BS11-034' ? 'YELLOW MIX' : 'YELLOW',
        color: 'YELLOW',
        skill: { name: expected.skillName, text: expected.skillText },
        attackText: expected.attackText,
        flipText: null,
        imageUrl: expected.imageUrl,
        sourceUrl: 'https://cookierunbraverse.com/data/json/cardList_en.json',
      })
    }
  })
})

describe('BS11-032 to BS11-035 exact card adapters', () => {
  it('converts BS11-032 with LV.3 break provenance and ordered attack Then effects', () => {
    const record = findCard('BS11-032')
    expect(convertOfficialCardEffects(record)).toEqual({
      status: 'supported',
      cardNumber: 'BS11-032',
      sourceText: record.skill.text,
      effects: [{
        kind: 'field-to-trash',
        target: { side: 'self', min: 1, max: 1, sourceOnly: true },
        condition: {
          kind: 'cookie-played-from-break-this-turn',
          exactLevel: 3,
        },
      }],
    })
    expect(convertOfficialAttackEffects(record)).toEqual(BURNT_CHEESE_ATTACK)
    expect(convertOfficialCookieSkill(record)).toMatchObject({
      trigger: 'passive',
      endPhase: true,
      endPhaseScope: 'your-turn',
      cost: { energy: {}, discardHand: 0 },
    })
  })

  it('converts BS11-033 as an attack-only card with conditional trash before draw', () => {
    const record = findCard('BS11-033')
    expect(convertOfficialCookieSkill(record)).toBeUndefined()
    expect(convertOfficialAttackEffects(record)).toEqual(PAVLOVA_ATTACK)

    const converted = convertOfficialCardToGameCard(record)
    if (converted.status !== 'converted') throw new Error('BS11-033 must convert')
    if (converted.gameCard.type !== 'cookie') throw new Error('BS11-033 must be a Cookie')
    expect(converted.gameCard.attackEffects).toEqual(PAVLOVA_ATTACK)
  })

  it('converts BS11-034 with selectable LV sum 3, fixed HP 5, and Ancient break count', () => {
    const record = findCard('BS11-034')
    expect(convertOfficialCardEffects(record)).toEqual({
      status: 'supported',
      cardNumber: 'BS11-034',
      sourceText: record.skill.text,
      effects: [
        {
          kind: 'reveal-hand',
          amount: 3,
          minAmount: 1,
          maxAmount: 3,
          levelSum: 3,
          asCost: true,
          selectCard: true,
          cookieOnly: true,
        },
        { kind: 'break-source-to-battle', hpCount: 5 },
        { kind: 'hand-to-break', amount: 3, optional: true, revealedCardOnly: true },
      ],
    })
    expect(convertOfficialAttackEffects(record)).toEqual([{
      kind: 'optional-cost-attack',
      cost: { energy: { neutral: 1 }, discardHand: 0 },
      effects: [{
        kind: 'damage-by-break-count',
        perCount: 1,
        minBreakLevel: 2,
        keyword: 'ancient',
        target: { side: 'opponent', min: 0, max: 1 },
      }],
      effectText: 'Then, <{N}> deals 1 damage for each LV.2 or higher Ancient Cookie in your break area.',
    }])
    expect(convertOfficialCookieSkill(record)).toMatchObject({
      trigger: 'activate',
      fromBreakArea: true,
      cost: { energy: {}, discardHand: 0 },
    })
  })

  it('passes the strict contract gate for the Pavlova and Golden Cheese variants', () => {
    for (const cardNumber of ['BS11-033', 'BS11-033@1', 'BS11-034', 'BS11-034@1']) {
      const audit = analyzeOfficialCardBehavior(findCard(cardNumber))
      expect(audit.contract.status, `${cardNumber}: ${audit.errors.join(' | ')}`).toBe('verified')
      expect(audit.errors).toEqual([])
    }
  })

  it('converts BS11-035 On Play cost/effects separately from the attack Then cost', () => {
    const record = findCard('BS11-035')
    expect(convertOfficialCardEffects(record)).toEqual({
      status: 'supported',
      cardNumber: 'BS11-035',
      sourceText: record.skill.text,
      effects: [],
    })
    expect(convertOfficialCookieSkill(record)).toMatchObject({
      trigger: 'on-play',
      cost: { energy: {}, discardHand: 0 },
      effects: [],
      onPlayCost: { energy: { yellow: 2 }, discardHand: 0 },
      onPlayEffects: [
        { kind: 'hand-to-break', amount: 1 },
        {
          kind: 'break-to-hand',
          amount: 1,
          optional: true,
          energyColor: 'yellow',
          maxLevel: 2,
        },
      ],
    })
    expect(convertOfficialAttackEffects(record)).toEqual([{
      kind: 'optional-cost-attack',
      cost: {
        energy: { yellow: 1 },
        discardHand: 1,
        discardHandType: 'cookie',
        discardHandHasFlip: true,
      },
      effects: [{
        kind: 'damage',
        amount: 2,
        target: { side: 'opponent', min: 0, max: 1, attackTargetOnly: true },
      }],
      effectText: 'Then, <{Y}> <discard 1 Cookie that has FLIP from your hand.> Deals 2 damage.',
    }])
  })
})
