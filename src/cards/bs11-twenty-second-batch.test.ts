import { describe, expect, it } from 'vitest'
import bs11CandidateDocument from '../../data/cards/official-dark-enchantress-war-bs11.en.json'
import {
  convertOfficialAttackEffects,
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

const converted = (cardNumber: string) => {
  const result = convertOfficialCardToGameCard(
    findCard(cardNumber),
    `bs11-twenty-second-${cardNumber}`,
  )
  if (result.status !== 'converted') {
    throw new Error(`${cardNumber}: ${result.reason}`)
  }
  return result.gameCard
}

describe('BS11-089 candidate contract', () => {
  it('preserves the base card and both official alternate arts', () => {
    expect(records.filter((card) => /^BS11-089(?:@1|@2)?$/.test(card.cardNumber)))
      .toHaveLength(3)
    expect(findCard('BS11-089')).toMatchObject({
      type: 'cookie',
      name: 'Silent Salt Cookie',
      level: 2,
      hp: 4,
      energyType: 'PURPLE',
      skill: {
        text: expect.stringContaining('Place 3 cards from the top of your deck into your trash'),
      },
      attackText: expect.stringContaining('all of your opponent\'s Cookies receive 1 damage'),
    })
    expect(findCard('BS11-089@1').imageUrl).not.toBe(findCard('BS11-089').imageUrl)
    expect(findCard('BS11-089@2').imageUrl).not.toBe(findCard('BS11-089').imageUrl)
  })
})

describe('BS11-089 exact adapters', () => {
  it('maps automatic deck milling as a skill cost and keeps the Refresh-gated effect', () => {
    expect(convertOfficialCookieSkill(findCard('BS11-089'))).toMatchObject({
      trigger: 'on-play',
      cost: { energy: {}, discardHand: 0, deckToTrash: { amount: 3 } },
      effects: [
        { kind: 'draw-up-to-then-discard', max: 2, discardCount: 1 },
        {
          kind: 'gain-hp',
          amount: 1,
          target: { side: 'self', min: 1, max: 1, sourceOnly: true },
          condition: { kind: 'refreshed-during-game' },
        },
      ],
    })
  })

  it('maps the Refresh-gated attack Then to sequential opponent-wide damage', () => {
    expect(convertOfficialAttackEffects(findCard('BS11-089'))).toEqual([{
      kind: 'damage-all',
      amount: 1,
      side: 'opponent',
      sequential: true,
      target: { side: 'opponent', min: 0, max: 4 },
      condition: { kind: 'refreshed-during-game' },
    }])
  })

  it.each(['BS11-089', 'BS11-089@1', 'BS11-089@2'])(
    'converts %s through the candidate adapter',
    (cardNumber) => {
      expect(converted(cardNumber)).toMatchObject({
        id: 'BS11-089',
        skill: { trigger: 'on-play' },
        attackEffects: [{ kind: 'damage-all', amount: 1 }],
      })
    },
  )
})
