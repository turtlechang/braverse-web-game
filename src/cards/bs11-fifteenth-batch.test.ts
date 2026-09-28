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
const cardNumbers = ['BS11-054', 'BS11-055', 'BS11-056', 'BS11-057', 'BS11-058'] as const

const findCard = (cardNumber: string): OfficialCardRecord => {
  const card = records.find((candidate) => candidate.cardNumber === cardNumber)
  if (!card) throw new Error(`Missing BS11 candidate fixture: ${cardNumber}`)
  return card
}

const EXPECTED = {
  'BS11-054': {
    sourceId: 53169,
    name: 'Net Cookie',
    type: 'cookie',
    officialType: 'COOKIE',
    energyType: 'BLUE',
    level: 3,
    hp: 5,
    skillText: "【On Play】 Select up to 1 of your opponent's Cookies. Until the end of your opponent's next turn, that Cookie cannot attack unless your opponent discards 2 cards from their hand.",
    attackText: '<{B}{B}{B}> Web of Deception {da} 3',
    imageUrl: 'https://cookierunbraverse.com/data/en_storage/B28BB-fpUlT_NaHLG5Wbog.webp',
  },
  'BS11-055': {
    sourceId: 53170,
    name: 'Menthol Cookie',
    type: 'cookie',
    officialType: 'COOKIE',
    energyType: 'BLUE MIX',
    level: 2,
    hp: 2,
    skillText: null,
    attackText: '<{N}{N}{N}> Cool Menthol Gas {da} 4',
    imageUrl: 'https://cookierunbraverse.com/data/en_storage/kPhbHB6K-BS0JvqRvKKvNg.webp',
  },
  'BS11-056': {
    sourceId: 53171,
    name: 'Soda Dollop',
    type: 'cookie',
    officialType: 'COOKIE',
    energyType: 'BLUE',
    level: 1,
    hp: 1,
    skillText: '【Activate】 【Once Per Turn】 If there is a [Cream Soda Cookie] in your battle area, draw up to 1 card from your deck.',
    attackText: '<{B}{B}> Bubbling Blops {da} 2',
    imageUrl: 'https://cookierunbraverse.com/data/en_storage/9tsG5zy6cw2dg3o1evxUPw.webp',
  },
  'BS11-057': {
    sourceId: 53172,
    name: 'Custard Cookie III',
    type: 'flip',
    officialType: 'FLIP',
    energyType: 'BLUE',
    level: 2,
    hp: 3,
    skillText: null,
    flipText: 'Draw up to 1 card from your deck.',
    attackText: '<{B}{B}{B}> For My Subjects! {da} 3',
    imageUrl: 'https://cookierunbraverse.com/data/en_storage/aEBujf7AYY675s5zWCQKOw.webp',
  },
  'BS11-058': {
    sourceId: 53173,
    name: 'Cream Soda Cookie',
    type: 'cookie',
    officialType: 'COOKIE',
    energyType: 'BLUE MIX',
    level: 2,
    hp: 5,
    skillText: "【Once Per Turn】 When one of your opponent's Cookies attacks, <discard 2 cards.> Select up to 1 of your Cookies. That Cookie gains +1 HP.",
    attackText: '<{B}{B}{N}> Soda Splash {da} 2',
    imageUrl: 'https://cookierunbraverse.com/data/en_storage/EvaihT36IyBIcNtZ-pcjSQ.webp',
  },
} as const

describe('BS11-054 to BS11-058 candidate source contract', () => {
  it('keeps exactly the five requested base records and preserves source data', () => {
    expect(bs11CandidateDocument.source.candidateStatus).toBe('promotion-ready')
    expect(bs11CandidateDocument.source.imagesDownloaded).toBe(false)
    expect(records.filter((card) => cardNumbers.includes(card.cardNumber as typeof cardNumbers[number]))).toHaveLength(5)

    for (const cardNumber of cardNumbers) {
      const expected = EXPECTED[cardNumber]
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
        color: 'BLUE',
        energyType: expected.energyType,
        level: expected.level,
        hp: expected.hp,
        imageUrl: expected.imageUrl,
        sourceUrl: 'https://cookierunbraverse.com/data/json/cardList_en.json',
        attackText: expected.attackText,
      })
      expect(record.skill?.text ?? null).toBe(expected.skillText)
      expect(record.flipText ?? null).toBe('flipText' in expected ? expected.flipText : null)
    }
  })
})

describe('BS11-054 to BS11-058 exact adapters', () => {
  it('maps Net Cookie to an On Play targeted attack-discard requirement', () => {
    const card = findCard('BS11-054')
    expect(convertOfficialCardEffects(card)).toMatchObject({
      status: 'supported',
      effects: [{
        kind: 'require-cookie-attack-discard-hand',
        target: { side: 'opponent', min: 0, max: 1 },
        count: 2,
      }],
    })
    expect(convertOfficialCookieSkill(card)).toMatchObject({
      trigger: 'on-play',
      oncePerTurn: false,
      cost: { energy: {}, discardHand: 0 },
      effects: [{ kind: 'require-cookie-attack-discard-hand', count: 2 }],
    })
  })

  it('keeps Menthol Cookie skill-less and parses its BLUE MIX attack as neutral payment', () => {
    const card = findCard('BS11-055')
    expect(convertOfficialCookieSkill(card)).toBeUndefined()
    expect(convertOfficialAttackEffects(card)).toBeUndefined()
    expect(convertOfficialCardToGameCard(card)).toMatchObject({
      status: 'converted',
      gameCard: {
        attack: 4,
        attackCost: 3,
        attackEnergyCost: { neutral: 3 },
      },
    })
  })

  it('maps Soda Dollop to the named Cream Soda condition and Once Per Turn Activate', () => {
    const card = findCard('BS11-056')
    expect(convertOfficialCookieSkill(card)).toMatchObject({
      trigger: 'activate',
      oncePerTurn: true,
      cost: { energy: {}, discardHand: 0 },
      effects: [{
        kind: 'draw-up-to',
        max: 1,
        condition: {
          kind: 'battle-area-has-named-cookie',
          side: 'self',
          name: 'Cream Soda Cookie',
        },
      }],
    })
  })

  it('maps Custard Cookie III FLIP to a no-cost draw-up-to effect', () => {
    const card = findCard('BS11-057')
    expect(convertOfficialFlipAbility(card)).toMatchObject({
      cost: { energy: {}, discardHand: 0 },
      effects: [{ kind: 'draw-up-to', max: 1 }],
    })
    expect(convertOfficialCardToGameCard(card)).toMatchObject({
      status: 'converted',
      gameCard: {
        attack: 3,
        attackCost: 3,
        attackEnergyCost: { blue: 3 },
        flip: { effects: [{ kind: 'draw-up-to', max: 1 }] },
      },
    })
  })

  it('maps Cream Soda Cookie to the real opponent-attack response window', () => {
    const card = findCard('BS11-058')
    expect(convertOfficialCookieSkill(card)).toMatchObject({
      trigger: 'opponent-attack',
      oncePerTurn: true,
      cost: { energy: {}, discardHand: 2 },
      effects: [{
        kind: 'gain-hp',
        amount: 1,
        target: { side: 'self', min: 0, max: 1 },
      }],
    })
    expect(convertOfficialCardToGameCard(card)).toMatchObject({
      status: 'converted',
      gameCard: {
        attack: 2,
        attackCost: 3,
        attackEnergyCost: { blue: 2, neutral: 1 },
      },
    })
  })
})
