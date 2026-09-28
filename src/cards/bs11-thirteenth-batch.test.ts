import { describe, expect, it } from 'vitest'
import bs11CandidateDocument from '../../data/cards/official-dark-enchantress-war-bs11.en.json'
import {
  convertOfficialCardEffects,
  convertOfficialItemAbility,
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
  'BS11-045': {
    sourceId: 53160,
    name: 'Grand Dust Hotel',
    type: 'stage',
    officialType: 'STAGE',
    energyType: 'GREEN',
    imageUrl: 'https://cookierunbraverse.com/data/en_storage/VAoB7XQSusXTeBtSMCbBUA.webp',
    skillText: '<{G}> Place in your stage area.\r\n\r\n【Activate】 <{G}{G}> <Rest this card.> Select up to 2 of your {G} Cookies. Set those Cookies as active.',
  },
  'BS11-046': {
    sourceId: 53161,
    name: 'Awakened Apathy',
    type: 'trap',
    officialType: 'TRAP',
    energyType: 'GREEN',
    imageUrl: 'https://cookierunbraverse.com/data/en_storage/dB63swLGUg6n-YwQeWphXQ.webp',
    skillText: "<{G}{G}> Select up to 1 of your opponent's Cookies. During this turn, that Cookie deals -2 attack damage. Then, if your support area has 2 or more cards less than your opponent's support area, that Cookie deals an additional -1 attack damage.",
  },
  'BS11-047': {
    sourceId: 53162,
    name: 'Dumpling Censer',
    type: 'item',
    officialType: 'ITEM',
    energyType: 'GREEN',
    imageUrl: 'https://cookierunbraverse.com/data/en_storage/jeJ0q4m3sECBV87h0o95oA.webp',
    skillText: '<{G}> <Return 1 card from your support area to your hand.> During this turn, your opponent\'s Cookies\' 【On Play】 become \\"<{N}> Return 1 card from your support area to your hand\\".',
  },
  'BS11-048': {
    sourceId: 53163,
    name: "Wind's Protection",
    type: 'trap',
    officialType: 'TRAP',
    energyType: 'GREEN',
    imageUrl: 'https://cookierunbraverse.com/data/en_storage/yI99-LvE86NjI8a2tPL71Q.webp',
    skillText: "<{G}> Select up to 1 of your opponent's Cookies. During this turn, that Cookie deals -1 attack damage. Then, <{N}> if there is a [Wind Archer Cookie] or 【Ancient】 Cookie in your battle area, rest up to 1 card in your opponent's support area.",
  },
  'BS11-048@1': {
    sourceId: 54212,
    name: "Wind's Protection",
    type: 'trap',
    officialType: 'TRAP',
    energyType: 'GREEN MIX',
    imageUrl: 'https://cookierunbraverse.com/data/en_storage/D9F3lLXNvzCkyhHhKpYQ3A.webp',
    skillText: "<{G}> Select up to 1 of your opponent's Cookies. During this turn, that Cookie deals -1 attack damage. Then, <{N}> if there is a [Wind Archer Cookie] or 【Ancient】 Cookie in your battle area, rest up to 1 card in your opponent's support area.",
  },
  'BS11-049': {
    sourceId: 53164,
    name: 'Emerald of the Wind',
    type: 'item',
    officialType: 'ITEM',
    energyType: 'GREEN',
    imageUrl: 'https://cookierunbraverse.com/data/en_storage/jD-atczILVP9mSQhQqFW_g.webp',
    skillText: '<{G}> Play up to 1 [Wind Archer Cookie] from your trash.',
  },
} as const

const windProtectionThen = {
  kind: 'optional-cost-attack',
  resolution: 'ability',
  payBeforeCondition: true,
  cost: { energy: { neutral: 1 }, discardHand: 0 },
  effectText: "Then, <{N}> if there is a [Wind Archer Cookie] or 【Ancient】 Cookie in your battle area, rest up to 1 card in your opponent's support area.",
  effects: [{
    kind: 'rest-support',
    side: 'opponent',
    amount: 1,
    activeOnly: true,
    optional: true,
    condition: {
      kind: 'any-of',
      conditions: [
        { kind: 'battle-area-has-named-cookie', side: 'self', name: 'Wind Archer Cookie' },
        { kind: 'battle-area-has-keyword', side: 'self', keyword: 'ancient' },
      ],
    },
  }],
} as const

describe('BS11-045 to BS11-049 candidate source contract', () => {
  it('preserves inventory status, source text, variant identity, and official art', () => {
    expect(bs11CandidateDocument.source.candidateStatus).toBe('promotion-ready')
    expect(bs11CandidateDocument.source.imagesDownloaded).toBe(false)

    for (const [cardNumber, expected] of Object.entries(EXPECTED)) {
      const record = findCard(cardNumber)
      expect(record).toMatchObject({
        sourceId: expected.sourceId,
        locale: 'en',
        cardNumber,
        baseCardNumber: cardNumber === 'BS11-048@1' ? 'BS11-048' : cardNumber,
        variant: cardNumber === 'BS11-048@1' ? '1' : null,
        name: expected.name,
        type: expected.type,
        officialType: expected.officialType,
        energyType: expected.energyType,
        color: 'GREEN',
        imageUrl: expected.imageUrl,
        sourceUrl: 'https://cookierunbraverse.com/data/json/cardList_en.json',
        skill: { name: null, text: expected.skillText },
      })
    }
  })
})

describe('BS11-045 to BS11-049 exact card adapters', () => {
  it('converts BS11-045 with G placement, G2 activation, and green rested-Cookie targets', () => {
    const record = findCard('BS11-045')
    const expectedEffects = [{
      kind: 'set-cookie-active',
      target: { side: 'self', min: 0, max: 2, energyColor: 'green', restedOnly: true },
    }]

    expect(convertOfficialCardEffects(record)).toEqual({
      status: 'supported',
      cardNumber: record.cardNumber,
      sourceText: record.skill.text,
      effects: expectedEffects,
    })
    expect(convertOfficialStageAbility(record)).toMatchObject({
      placementCost: { green: 1 },
      cost: { energy: { green: 2 }, discardHand: 0 },
      restSource: true,
      effects: expectedEffects,
    })
  })

  it('converts BS11-046 with a same-target support-difference Then clause', () => {
    const record = findCard('BS11-046')
    const converted = convertOfficialTrapAbility(record)
    expect(convertOfficialCardEffects(record)).toMatchObject({ status: 'supported' })
    expect(converted).toMatchObject({
      cost: { energy: { green: 2 }, discardHand: 0 },
      effects: [{
        kind: 'modify-attack',
        amount: -2,
        target: { side: 'opponent', min: 0, max: 1 },
        thenEffects: [{
          kind: 'modify-attack',
          amount: -1,
          target: { previousEffectTargetOnly: true },
          condition: { kind: 'support-count-less-than-opponent', difference: 2 },
        }],
      }],
    })
  })

  it('converts both BS11-048 images with a paid conditional support-rest Then', () => {
    for (const cardNumber of ['BS11-048', 'BS11-048@1']) {
      const record = findCard(cardNumber)
      const converted = convertOfficialTrapAbility(record)
      expect(convertOfficialCardEffects(record)).toMatchObject({ status: 'supported' })
      expect(converted).toMatchObject({
        cost: { energy: { green: 1 }, discardHand: 0 },
        effects: [{
          kind: 'modify-attack',
          amount: -1,
        }, windProtectionThen],
      })
    }
  })

  it('maps BS11-047 to a paid On Play replacement instead of a block', () => {
    const record = findCard('BS11-047')
    expect(convertOfficialCardEffects(record)).toMatchObject({
      status: 'supported',
      effects: [{
        kind: 'replace-opponent-on-play',
        duration: 'this-turn',
        cost: { energy: { neutral: 1 }, discardHand: 0 },
        effects: [{ kind: 'support-to-hand', amount: 1 }],
      }],
    })
    expect(convertOfficialItemAbility(record)).toMatchObject({
      cost: { energy: { green: 1 }, discardHand: 0, supportToHand: 1 },
      effects: [{ kind: 'replace-opponent-on-play' }],
    })
  })

  it('converts BS11-049 with a green cost and a named Cookie trash target', () => {
    const record = findCard('BS11-049')
    expect(convertOfficialItemAbility(record)).toMatchObject({
      cost: { energy: { green: 1 }, discardHand: 0 },
      effects: [{
        kind: 'trash-to-battle',
        amount: 1,
        optional: true,
        cardName: 'Wind Archer Cookie',
      }],
    })
  })
})
