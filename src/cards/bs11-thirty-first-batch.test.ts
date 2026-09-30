import { describe, expect, it } from 'vitest'
import bs11CandidateDocument from '../../data/cards/official-dark-enchantress-war-bs11.en.json'
import {
  convertOfficialAttackEffects,
  convertOfficialCardToGameCard,
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
    `bs11-thirty-first-${cardNumber}`,
  )
  if (result.status !== 'converted') {
    throw new Error(`${cardNumber}: ${result.reason}`)
  }
  return result.gameCard
}

describe('BS11-088 and BS11-105 candidate contract', () => {
  it('preserves the official records, attack text, and distinct BS11-088 art', () => {
    expect(records.filter((card) => /^BS11-(088|105)(?:@1)?$/.test(card.cardNumber)))
      .toHaveLength(3)

    expect(findCard('BS11-088')).toMatchObject({
      type: 'cookie',
      name: 'Moonlight Cookie',
      level: 2,
      hp: 5,
      energyType: 'PURPLE',
      attackText: expect.stringContaining('15 cards or more in your opponent\'s trash'),
    })
    expect(findCard('BS11-088@1')).toMatchObject({
      baseCardNumber: 'BS11-088',
      variant: '1',
      attackText: findCard('BS11-088').attackText,
    })
    expect(findCard('BS11-105')).toMatchObject({
      type: 'cookie',
      name: 'Red Velvet Dragon',
      level: 3,
      hp: 5,
      energyType: 'BLACK',
      attackText: expect.stringContaining('Cookie that has 【Special Play】 in your battle area'),
    })
    expect(findCard('BS11-088@1').imageUrl).not.toBe(findCard('BS11-088').imageUrl)
  })
})

describe('BS11-088 and BS11-105 exact attack adapters', () => {
  it('maps BS11-088 and its variant to the opponent-trash threshold', () => {
    const expected = [{
      kind: 'damage',
      amount: 1,
      target: { side: 'opponent', min: 0, max: 1 },
      condition: { kind: 'opponent-trash-count-at-least', count: 15 },
    }]
    expect(convertOfficialAttackEffects(findCard('BS11-088'))).toEqual(expected)
    expect(convertOfficialAttackEffects(findCard('BS11-088@1'))).toEqual(expected)
    expect(converted('BS11-088')).toMatchObject({
      attack: 2,
      attackEnergyCost: { purple: 3 },
      attackEffects: expected,
    })
  })

  it('maps BS11-105 to the Special Play battle-area threshold', () => {
    const expected = [{
      kind: 'damage',
      amount: 1,
      target: { side: 'opponent', min: 0, max: 1 },
      condition: { kind: 'battle-area-has-special-play-cookie', side: 'self' },
    }]
    expect(convertOfficialAttackEffects(findCard('BS11-105'))).toEqual(expected)
    expect(converted('BS11-105')).toMatchObject({
      attack: 3,
      attackEnergyCost: { black: 3 },
      attackEffects: expected,
    })
  })
})
