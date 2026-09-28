import { describe, expect, it } from 'vitest'
import bs11CandidateDocument from '../../data/cards/official-dark-enchantress-war-bs11.en.json'
import {
  convertOfficialAttackEffects,
  convertOfficialCardToExtraDeckCard,
  convertOfficialCardToGameCard,
  convertOfficialCookieSkill,
  type OfficialCardRecord,
} from '.'

const records = bs11CandidateDocument.cards as OfficialCardRecord[]

const findCard = (cardNumber: string): OfficialCardRecord => {
  const card = records.find((candidate) => candidate.cardNumber === cardNumber)
  if (!card) throw new Error(`Missing BS11 candidate fixture: ${cardNumber}`)
  return card
}

describe('BS11-090 / BS11-091 candidate contract', () => {
  it('preserves all White Lily and Avatar of Destiny official arts', () => {
    expect(records.filter((card) => /^BS11-090(?:@1|@2)?$/.test(card.cardNumber)))
      .toHaveLength(3)
    expect(records.filter((card) => /^BS11-091(?:@1)?$/.test(card.cardNumber)))
      .toHaveLength(2)
    expect(findCard('BS11-090')).toMatchObject({
      type: 'cookie',
      name: 'White Lily Cookie',
      level: 3,
      hp: 6,
      energyType: 'PURE',
      skill: {
        text: expect.stringContaining('Play [Avatar of Destiny] from your Extra Deck'),
      },
    })
    expect(findCard('BS11-091')).toMatchObject({
      type: 'extra',
      name: 'Avatar of Destiny',
      level: 3,
      hp: 5,
      energyType: 'PURE',
      skill: {
        text: expect.stringContaining('both players\' break areas are LV.6 or higher'),
      },
    })
    expect(findCard('BS11-090@1').imageUrl).not.toBe(findCard('BS11-090').imageUrl)
    expect(findCard('BS11-090@2').imageUrl).not.toBe(findCard('BS11-090').imageUrl)
    expect(findCard('BS11-091@1').imageUrl).not.toBe(findCard('BS11-091').imageUrl)
  })
})

describe('BS11-090 exact adapter', () => {
  it('models self-faint as the Activate cost and direct EXTRA play as one effect', () => {
    expect(convertOfficialCookieSkill(findCard('BS11-090'))).toMatchObject({
      trigger: 'activate',
      cost: { energy: {}, discardHand: 0, selfToFaint: true },
      effects: [{
        kind: 'play-extra-deck-cookie',
        cardName: 'Avatar of Destiny',
        ignorePlayRequirements: true,
        gainHp: 3,
      }],
    })
  })

  it('does not invent a Then effect for White Lily\'s ordinary attack', () => {
    for (const cardNumber of ['BS11-090', 'BS11-090@1', 'BS11-090@2']) {
      expect(convertOfficialAttackEffects(findCard(cardNumber))).toBeUndefined()
    }
  })

  it.each(['BS11-090', 'BS11-090@1', 'BS11-090@2'])('converts %s as a Cookie', (cardNumber) => {
    const result = convertOfficialCardToGameCard(
      findCard(cardNumber),
      `bs11-twenty-third-${cardNumber}`,
    )
    expect(result.status).toBe('converted')
    if (result.status !== 'converted') return
    expect(result.gameCard).toMatchObject({
      id: 'BS11-090',
      type: 'cookie',
      name: 'White Lily Cookie',
      skill: { trigger: 'activate' },
    })
  })
})

describe('BS11-091 exact EXTRA adapter', () => {
  it.each(['BS11-091', 'BS11-091@1'])('maps %s to a direct-play EXTRA requirement', (cardNumber) => {
    const result = convertOfficialCardToExtraDeckCard(findCard(cardNumber), cardNumber)
    expect(result.status).toBe('converted')
    if (result.status !== 'converted') return
    expect(result.extraDeckCard).toMatchObject({
      id: 'BS11-091',
      type: 'extra',
      name: 'Avatar of Destiny',
      level: 3,
      hp: 5,
      extraDeckPlayMode: 'enter-battle',
      playRequirement: {
        kind: 'all-of',
        conditions: [
          { kind: 'break-level-at-least', level: 6 },
          { kind: 'opponent-break-level-at-least', level: 6 },
          { kind: 'hand-count-at-most', count: 3 },
          { kind: 'opponent-hand-count-at-most', count: 3 },
        ],
      },
    })
  })
})
