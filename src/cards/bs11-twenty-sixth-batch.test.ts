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

describe('BS11-114 candidate contract', () => {
  it('keeps the two official Pomegranate Cookie records', () => {
    expect(records.filter((card) => /^BS11-114(@1)?$/.test(card.cardNumber)))
      .toHaveLength(2)
    expect(findCard('BS11-114')).toMatchObject({
      type: 'cookie',
      name: 'Pomegranate Cookie',
      level: 1,
      hp: 2,
      energyType: 'BLACK',
      skill: { text: expect.stringContaining('draw up to 2') },
    })
  })
})

describe('BS11-114 exact adapters', () => {
  it('maps the black discard On Play cost and conditional draw', () => {
    expect(convertOfficialCookieSkill(findCard('BS11-114'))).toMatchObject({
      trigger: 'on-play',
      cost: { energy: {}, discardHand: 1, discardHandColor: 'black' },
      effects: [{
        kind: 'draw-up-to',
        max: 2,
        condition: { kind: 'hand-count-at-most', count: 5 },
      }],
    })
  })

  it('maps the attack Then discard cost and named Cookie recovery', () => {
    expect(convertOfficialAttackEffects(findCard('BS11-114'))).toEqual([{
      kind: 'optional-cost-attack',
      cost: { energy: {}, discardHand: 1 },
      effects: [{
        kind: 'trash-to-hand',
        max: 1,
        cookieOnly: true,
        cardName: 'Dark Enchantress Cookie',
      }],
      effectText: expect.any(String),
    }])
  })

  it.each(['BS11-114', 'BS11-114@1'])('converts %s through the Cookie adapter', (cardNumber) => {
    const result = convertOfficialCardToGameCard(
      findCard(cardNumber),
      `bs11-twenty-sixth-${cardNumber}`,
    )
    expect(result.status).toBe('converted')
    if (result.status !== 'converted') return
    expect(result.gameCard).toMatchObject({
      id: 'BS11-114',
      type: 'cookie',
      skill: { trigger: 'on-play' },
    })
  })
})
