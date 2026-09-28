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
  'BS11-036': {
    sourceId: 53151,
    name: 'Eternal Sugar Cookie',
    type: 'cookie',
    officialType: 'COOKIE',
    level: 2,
    hp: 4,
    energyType: 'YELLOW',
    color: 'YELLOW',
    skillName: '{sk} Delightful Abyss',
    skillText: "【Activate】 【Once Per Turn】 If there is no other [Eternal Sugar Cookie] in your battle area, select up to 1 of your opponent's Cookies. Until the end of your opponent's next turn, the attack cost of that Cookie is increased by 1 {N}.",
    attackText: '<{Y}{Y}{Y}> Paradise of Happiness {da} 3\r\nThen, if this Cookie\'s remaining HP is 3 or less, this Cookie gains +1 HP.',
    flipText: null,
    imageUrl: 'https://cookierunbraverse.com/data/en_storage/sq4qGzQF0bO9YG49DAoQnw.webp',
  },
  'BS11-036@1': {
    sourceId: 53947,
    name: 'Eternal Sugar Cookie',
    type: 'cookie',
    officialType: 'COOKIE',
    level: 2,
    hp: 4,
    energyType: 'YELLOW',
    color: 'YELLOW',
    skillName: '{sk} Delightful Abyss',
    skillText: "【Activate】 【Once Per Turn】 If there is no other [Eternal Sugar Cookie] in your battle area, select up to 1 of your opponent's Cookies. Until the end of your opponent's next turn, the attack cost of that Cookie is increased by 1 {N}.",
    attackText: '<{Y}{Y}{Y}> Paradise of Happiness {da} 3\r\nThen, if this Cookie\'s remaining HP is 3 or less, this Cookie gains +1 HP.',
    flipText: null,
    imageUrl: 'https://cookierunbraverse.com/data/en_storage/vAS8LtSsdSYcsi--_tR0vg.webp',
  },
  'BS11-037': {
    sourceId: 53152,
    name: 'Bellflower Cookie',
    type: 'cookie',
    officialType: 'COOKIE',
    level: 2,
    hp: 2,
    energyType: 'GREEN MIX',
    color: 'GREEN',
    skillName: null,
    skillText: null,
    attackText: '<{N}{N}{N}> Herbal Decoction {da} 4',
    flipText: null,
    imageUrl: 'https://cookierunbraverse.com/data/en_storage/WsJ3ZV0FItq-m_Iwn-7akA.webp',
  },
  'BS11-038': {
    sourceId: 53153,
    name: 'Director Q',
    type: 'cookie',
    officialType: 'COOKIE',
    level: 1,
    hp: 1,
    energyType: 'GREEN',
    color: 'GREEN',
    skillName: '{sk} Ready, Set...',
    skillText: '【Activate】 【Once Per Turn】 If there is a [Shine Muscat Cookie] in your battle area, set up to 1 card in your support area as active.',
    attackText: '<{G}{G}> Action! {da} 2',
    flipText: null,
    imageUrl: 'https://cookierunbraverse.com/data/en_storage/yMBGxJFzfsuMSVC6Qw-eLQ.webp',
  },
  'BS11-039': {
    sourceId: 53154,
    name: 'Rosemary Cookie',
    type: 'flip',
    officialType: 'FLIP',
    level: 1,
    hp: 1,
    energyType: 'GREEN',
    color: 'GREEN',
    skillName: null,
    skillText: null,
    attackText: '<{G}{G}> Happy Gardening {da} 2',
    flipText: '<Discard 1 card.> The Cookie with this card attached for HP gains +1 HP.',
    imageUrl: 'https://cookierunbraverse.com/data/en_storage/3-mLaknFuUsvy7eGreXNlw.webp',
  },
} as const

const ETERNAL_SUGAR_SKILL = [{
  kind: 'modify-attack-cost',
  target: { side: 'opponent', min: 0, max: 1 },
  energyCost: { neutral: 1 },
  operation: 'increase',
  duration: 'opponent-next-turn',
  condition: {
    kind: 'battle-area-has-named-cookie',
    side: 'self',
    name: 'Eternal Sugar Cookie',
    excludeSource: true,
    negate: true,
  },
}] as const

const ETERNAL_SUGAR_ATTACK = [{
  kind: 'gain-hp',
  amount: 1,
  target: { side: 'self', min: 1, max: 1, sourceOnly: true },
  condition: { kind: 'source-hp-at-most', amount: 3 },
}] as const

const DIRECTOR_Q_SKILL = [{
  kind: 'set-active',
  supportCount: 1,
  selectable: true,
  optional: true,
  condition: {
    kind: 'battle-area-has-named-cookie',
    side: 'self',
    name: 'Shine Muscat Cookie',
  },
}] as const

describe('BS11-036 to BS11-039 candidate source contract', () => {
  it('keeps the candidate promoted-source and preserves source fields and supplied art', () => {
    expect(bs11CandidateDocument.source).toMatchObject({
      candidateStatus: 'promotion-ready',
      imagesDownloaded: false,
    })

    for (const [cardNumber, expected] of Object.entries(EXPECTED)) {
      const record = findCard(cardNumber)
      expect(record).toMatchObject({
        sourceId: expected.sourceId,
        locale: 'en',
        cardNumber,
        baseCardNumber: cardNumber === 'BS11-036@1' ? 'BS11-036' : cardNumber,
        variant: cardNumber === 'BS11-036@1' ? '1' : null,
        name: expected.name,
        type: expected.type,
        officialType: expected.officialType,
        level: expected.level,
        hp: expected.hp,
        energyType: expected.energyType,
        color: expected.color,
        skill: { name: expected.skillName, text: expected.skillText },
        attackText: expected.attackText,
        flipText: expected.flipText,
        imageUrl: expected.imageUrl,
        sourceUrl: 'https://cookierunbraverse.com/data/json/cardList_en.json',
      })
    }
  })
})

describe('BS11-036 to BS11-039 exact adapters', () => {
  it('maps BS11-036 and its @1 art to the same conditional skill and HP-gated Then', () => {
    for (const cardNumber of ['BS11-036', 'BS11-036@1']) {
      const record = findCard(cardNumber)
      expect(convertOfficialCardEffects(record)).toEqual({
        status: 'supported',
        cardNumber,
        sourceText: record.skill.text,
        effects: ETERNAL_SUGAR_SKILL,
      })
      expect(convertOfficialCookieSkill(record)).toMatchObject({
        trigger: 'activate',
        oncePerTurn: true,
        cost: { energy: {}, discardHand: 0 },
        effects: ETERNAL_SUGAR_SKILL,
      })
      expect(convertOfficialAttackEffects(record)).toEqual(ETERNAL_SUGAR_ATTACK)

      const converted = convertOfficialCardToGameCard(record)
      if (converted.status !== 'converted') throw new Error(`${cardNumber} must convert`)
      expect(converted.gameCard).toMatchObject({
        name: 'Eternal Sugar Cookie',
        level: 2,
        hp: 4,
        attack: 3,
        attackCost: 3,
        attackEnergyCost: { yellow: 3 },
        attackEffects: ETERNAL_SUGAR_ATTACK,
      })
    }
  })

  it('keeps BS11-037 as a no-skill GREEN MIX Cookie with its neutral attack cost', () => {
    const record = findCard('BS11-037')
    expect(convertOfficialCookieSkill(record)).toBeUndefined()
    expect(convertOfficialAttackEffects(record)).toBeUndefined()

    const converted = convertOfficialCardToGameCard(record)
    if (converted.status !== 'converted') throw new Error('BS11-037 must convert')
    if (converted.gameCard.type !== 'cookie') throw new Error('BS11-037 must be a Cookie')
    expect(converted.gameCard).toMatchObject({
      name: 'Bellflower Cookie',
      level: 2,
      hp: 2,
      attack: 4,
      attackCost: 3,
      attackEnergyCost: { neutral: 3 },
    })
    expect(converted.gameCard.attackEffects).toBeUndefined()
  })

  it('maps BS11-038 to the Shine Muscat condition and selectable optional support recovery', () => {
    const record = findCard('BS11-038')
    expect(convertOfficialCardEffects(record)).toEqual({
      status: 'supported',
      cardNumber: 'BS11-038',
      sourceText: record.skill.text,
      effects: DIRECTOR_Q_SKILL,
    })
    expect(convertOfficialCookieSkill(record)).toMatchObject({
      trigger: 'activate',
      oncePerTurn: true,
      cost: { energy: {}, discardHand: 0 },
      effects: DIRECTOR_Q_SKILL,
    })

    const converted = convertOfficialCardToGameCard(record)
    if (converted.status !== 'converted') throw new Error('BS11-038 must convert')
    expect(converted.gameCard).toMatchObject({
      name: 'Director Q',
      level: 1,
      hp: 1,
      attack: 2,
      attackCost: 2,
      attackEnergyCost: { green: 2 },
      skill: { effects: DIRECTOR_Q_SKILL },
    })
  })

  it('maps BS11-039 FLIP to one discard and one attached HP', () => {
    const record = findCard('BS11-039')
    expect(convertOfficialCookieSkill(record)).toBeUndefined()
    expect(convertOfficialAttackEffects(record)).toBeUndefined()
    expect(convertOfficialFlipAbility(record)).toEqual({
      text: record.flipText,
      cost: { energy: {}, discardHand: 1 },
      effects: [],
      attachedHpBonus: 1,
    })

    const converted = convertOfficialCardToGameCard(record)
    if (converted.status !== 'converted') throw new Error('BS11-039 must convert')
    expect(converted.gameCard).toMatchObject({
      name: 'Rosemary Cookie',
      level: 1,
      hp: 1,
      attack: 2,
      attackCost: 2,
      attackEnergyCost: { green: 2 },
      flip: {
        cost: { energy: {}, discardHand: 1 },
        effects: [],
        attachedHpBonus: 1,
      },
    })
  })
})
