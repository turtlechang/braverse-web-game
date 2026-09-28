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

describe('BS11-115 candidate contract', () => {
  it('keeps the four official Dark Enchantress Cookie records', () => {
    expect(records.filter((card) => /^BS11-115(@[1-3])?$/.test(card.cardNumber)))
      .toHaveLength(4)
    expect(findCard('BS11-115')).toMatchObject({
      type: 'cookie',
      name: 'Dark Enchantress Cookie',
      level: 3,
      hp: 6,
      energyType: 'BLACK',
      skill: { text: expect.stringContaining('Place 2') },
    })
  })
})

describe('BS11-115 exact adapters', () => {
  it('maps the two-cookie Special Play cost and support-count-gated On Play', () => {
    expect(convertOfficialCookieSkill(findCard('BS11-115'))).toMatchObject({
      trigger: 'on-play',
      specialPlayCost: {
        energy: {},
        discardHand: 0,
        trashBattleCookie: {
          count: 2,
          level: 2,
          energyColor: 'black',
          hasSpecialPlay: true,
        },
      },
      effects: [{
        kind: 'damage-all',
        amount: 1,
        side: 'opponent',
        sequential: true,
        target: { side: 'opponent', min: 0, max: 4 },
        condition: { kind: 'opponent-support-count-at-least', count: 4 },
      }],
    })
  })

  it('maps the black energy attack Then cost and single target damage', () => {
    expect(convertOfficialAttackEffects(findCard('BS11-115'))).toEqual([{
      kind: 'optional-cost-attack',
      cost: { energy: { black: 2 }, discardHand: 0 },
      effects: [{
        kind: 'damage',
        amount: 2,
        target: { side: 'opponent', min: 0, max: 1 },
      }],
      effectText: expect.any(String),
    }])
  })

  it.each(['BS11-115', 'BS11-115@1', 'BS11-115@2', 'BS11-115@3'])('converts %s through the Cookie adapter', (cardNumber) => {
      const result = convertOfficialCardToGameCard(
        findCard(cardNumber),
        `bs11-twenty-seventh-${cardNumber}`,
      )
      expect(result.status).toBe('converted')
      if (result.status !== 'converted') return
      expect(result.gameCard).toMatchObject({
        id: 'BS11-115',
        type: 'cookie',
        skill: { trigger: 'on-play' },
      })
    })
})
