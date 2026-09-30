import { describe, expect, it } from 'vitest'
import bs11CandidateDocument from '../../data/cards/official-dark-enchantress-war-bs11.en.json'
import {
  convertOfficialAttackEffects,
  convertOfficialCardEffects,
  convertOfficialCookieSkill,
  type OfficialCardRecord,
} from '.'

const records = bs11CandidateDocument.cards as OfficialCardRecord[]

const findCard = (cardNumber: string): OfficialCardRecord => {
  const card = records.find((candidate) => candidate.cardNumber === cardNumber)
  if (!card) throw new Error(`Missing BS11 candidate fixture: ${cardNumber}`)
  return card
}

const EXPECTED = {
  'BS11-050': {
    sourceId: 53165,
    name: 'Cloud Haetae Cookie',
    type: 'cookie',
    officialType: 'COOKIE',
    energyType: 'GREEN',
    level: 1,
    hp: 2,
    imageUrl: 'https://cookierunbraverse.com/data/en_storage/revipU38nmvjhtgRCtAdVg.webp',
    attackText: "<{G}> Haetae Headbutt {da} 1\r\nThen, if there are less cards in your support area than your opponent's support area, <{G}> <place this Cookie in your trash.> Place up to 1 card from the top of your deck in your support area as rested.",
  },
  'BS11-050@1': {
    sourceId: 53948,
    name: 'Cloud Haetae Cookie',
    type: 'cookie',
    officialType: 'COOKIE',
    energyType: 'GREEN',
    level: 1,
    hp: 2,
    imageUrl: 'https://cookierunbraverse.com/data/en_storage/Hdd-BaoJY_l2bI9YyDM66g.webp',
    attackText: "<{G}> Haetae Headbutt {da} 1\r\nThen, if there are less cards in your support area than your opponent's support area, <{G}> <place this Cookie in your trash.> Place up to 1 card from the top of your deck in your support area as rested.",
  },
  'BS11-051': {
    sourceId: 53166,
    name: 'Mercurial Knight Cookie',
    type: 'cookie',
    officialType: 'COOKIE',
    energyType: 'GREEN',
    level: 2,
    hp: 4,
    imageUrl: 'https://cookierunbraverse.com/data/en_storage/UQYTaCVfb-BzwPoOJG4u3A.webp',
    attackText: "<{G}{G}{G}> Sharp Mercury Glaive {da} 3\r\nThen, if there are 7 cards or more in your support area and your opponent's Cookie fainted from this Cookie's attack, set up to 2 cards in your support area as active.",
  },
  'BS11-051@1': {
    sourceId: 53949,
    name: 'Mercurial Knight Cookie',
    type: 'cookie',
    officialType: 'COOKIE',
    energyType: 'GREEN',
    level: 2,
    hp: 4,
    imageUrl: 'https://cookierunbraverse.com/data/en_storage/AmPh_gKFxWedM8IvElHdGg.webp',
    attackText: "<{G}{G}{G}> Sharp Mercury Glaive {da} 3\r\nThen, if there are 7 cards or more in your support area and your opponent's Cookie fainted from this Cookie's attack, set up to 2 cards in your support area as active.",
  },
  'BS11-052': {
    sourceId: 53167,
    name: 'Wind Archer Cookie',
    type: 'cookie',
    officialType: 'COOKIE',
    energyType: 'GREEN',
    level: 2,
    hp: 5,
    imageUrl: 'https://cookierunbraverse.com/data/en_storage/D7LKjG_SR8EhOQQZCqqtjA.webp',
    attackText: "<{G}{G}{G}> Arrow of Gale {da} 2\r\nThen, <discard 1 {G} Item card from your hand.> Select up to 1 of your opponent's Cookies. That Cookie receives 1 damage. Then, if there are 5 cards or less in your hand, draw up to 2 cards from your deck.",
  },
  'BS11-052@1': {
    sourceId: 53950,
    name: 'Wind Archer Cookie',
    type: 'cookie',
    officialType: 'COOKIE',
    energyType: 'GREEN',
    level: 2,
    hp: 5,
    imageUrl: 'https://cookierunbraverse.com/data/en_storage/DoKfhWCdPNFtfVSNP-EtZA.webp',
    attackText: "<{G}{G}{G}> Arrow of Gale {da} 2\r\nThen, <discard 1 {G} Item card from your hand.> Select up to 1 of your opponent's Cookies. That Cookie receives 1 damage. Then, if there are 5 cards or less in your hand, draw up to 2 cards from your deck.",
  },
  'BS11-053': {
    sourceId: 53168,
    name: 'Mystic Flour Cookie',
    type: 'cookie',
    officialType: 'COOKIE',
    energyType: 'GREEN',
    level: 2,
    hp: 4,
    imageUrl: 'https://cookierunbraverse.com/data/en_storage/i7slCikz-gvrMEayybG4sQ.webp',
    skillText: '【Activate】 【Once Per Turn】 <{G}> Place 1 card from the top of the HP of all your opponent\'s Cookies with 5 or more remaining HP into your opponent\'s trash.',
    attackText: "<{G}{G}{G}> Lotus Eclipse {da} 3\r\nThen, if there are less cards in your support area than your opponent's support area, <place this Cookie in your trash.> Place 1 card from the top of your deck into your support area as rested.",
  },
  'BS11-053@1': {
    sourceId: 53951,
    name: 'Mystic Flour Cookie',
    type: 'cookie',
    officialType: 'COOKIE',
    energyType: 'GREEN',
    level: 2,
    hp: 4,
    imageUrl: 'https://cookierunbraverse.com/data/en_storage/8Ih6xPGTGkFPFPEeRfOxRQ.webp',
    skillText: '【Activate】 【Once Per Turn】 <{G}> Place 1 card from the top of the HP of all your opponent\'s Cookies with 5 or more remaining HP into your opponent\'s trash.',
    attackText: "<{G}{G}{G}> Lotus Eclipse {da} 3\r\nThen, if there are less cards in your support area than your opponent's support area, <place this Cookie in your trash.> Place 1 card from the top of your deck into your support area as rested.",
  },
} as const

const variants = Object.keys(EXPECTED)

describe('BS11-050 to BS11-053 candidate source contract', () => {
  it('keeps the candidate promoted-source and preserves official card data and art', () => {
    expect(bs11CandidateDocument.source.candidateStatus).toBe('promotion-ready')
    expect(bs11CandidateDocument.source.imagesDownloaded).toBe(false)

    for (const cardNumber of variants) {
      const expected = EXPECTED[cardNumber as keyof typeof EXPECTED]
      const record = findCard(cardNumber)
      expect(record).toMatchObject({
        sourceId: expected.sourceId,
        locale: 'en',
        cardNumber,
        baseCardNumber: cardNumber.endsWith('@1') ? cardNumber.slice(0, -2) : cardNumber,
        variant: cardNumber.endsWith('@1') ? '1' : null,
        name: expected.name,
        type: expected.type,
        officialType: expected.officialType,
        color: 'GREEN',
        energyType: expected.energyType,
        level: expected.level,
        hp: expected.hp,
        imageUrl: expected.imageUrl,
        sourceUrl: 'https://cookierunbraverse.com/data/json/cardList_en.json',
        attackText: expected.attackText,
      })
      if ('skillText' in expected) {
        expect(record.skill).toEqual({ name: '{sk} Realm of Apathy', text: expected.skillText })
      } else {
        expect(record.skill).toEqual({ name: null, text: null })
      }
    }
  })
})

describe('BS11-050 to BS11-053 exact adapters', () => {
  it.each(['BS11-050', 'BS11-050@1'] as const)('%s keeps the support-deficit paid Then sequence', (cardNumber) => {
    const effects = convertOfficialAttackEffects(findCard(cardNumber))
    expect(effects).toMatchObject([{
      kind: 'optional-cost-attack',
      cost: { energy: { green: 1 }, discardHand: 0, selfToTrash: true },
      effects: [{
        kind: 'deck-to-support',
        amount: 1,
        rested: true,
        condition: { kind: 'support-count-less-than-opponent', difference: 1 },
      }],
    }])
  })

  it.each(['BS11-051', 'BS11-051@1'] as const)('%s requires seven supports and a faint from this attack', (cardNumber) => {
    expect(convertOfficialAttackEffects(findCard(cardNumber))).toMatchObject([{
      kind: 'set-active',
      supportCount: 2,
      selectable: true,
      optional: true,
      condition: {
        kind: 'all-of',
        conditions: [
          { kind: 'support-count-at-least', count: 7 },
          { kind: 'opponent-cookie-fainted-in-current-battle' },
        ],
      },
    }])
  })

  it.each(['BS11-052', 'BS11-052@1'] as const)('%s keeps the green Item discard and hand-gated draw', (cardNumber) => {
    expect(convertOfficialAttackEffects(findCard(cardNumber))).toMatchObject([{
      kind: 'optional-cost-attack',
      cost: {
        energy: {},
        discardHand: 1,
        discardHandColor: 'green',
        discardHandType: 'item',
      },
      effects: [
        { kind: 'damage', amount: 1, target: { side: 'opponent', min: 0, max: 1 } },
        { kind: 'draw-up-to', max: 2, condition: { kind: 'hand-count-at-most', count: 5 } },
      ],
    }])
  })

  it.each(['BS11-053', 'BS11-053@1'] as const)('%s preserves the HP threshold skill and support-deficit attack Then', (cardNumber) => {
    expect(convertOfficialCardEffects(findCard(cardNumber))).toMatchObject({
      status: 'supported',
      effects: [{
        kind: 'hp-to-trash-all',
        amount: 1,
        side: 'opponent',
        target: { side: 'opponent', min: 0, max: 4, minRemainingHp: 5 },
      }],
    })
    expect(convertOfficialCookieSkill(findCard(cardNumber))).toMatchObject({
      trigger: 'activate',
      oncePerTurn: true,
      cost: { energy: { green: 1 }, discardHand: 0 },
      effects: [{
        kind: 'hp-to-trash-all',
        amount: 1,
        side: 'opponent',
        target: { side: 'opponent', min: 0, max: 4, minRemainingHp: 5 },
      }],
    })
    expect(convertOfficialAttackEffects(findCard(cardNumber))).toMatchObject([{
      kind: 'optional-cost-attack',
      cost: { energy: {}, discardHand: 0, selfToTrash: true },
      effects: [{
        kind: 'deck-to-support',
        amount: 1,
        rested: true,
        condition: { kind: 'support-count-less-than-opponent', difference: 1 },
      }],
    }])
  })
})
