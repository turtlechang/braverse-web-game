import { describe, expect, it } from 'vitest'
import bs11CandidateDocument from '../../data/cards/official-dark-enchantress-war-bs11.en.json'
import {
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

describe('BS11-097～099 candidate contract', () => {
  it('keeps the three official cards and their printed Special Play condition', () => {
    expect(records.filter((card) => /^BS11-09[7-9]$/.test(card.cardNumber)))
      .toHaveLength(3)
    expect(findCard('BS11-097')).toMatchObject({
      type: 'cookie',
      name: 'Cream Jelly Worm',
      level: 1,
      hp: 3,
      energyType: 'BLACK',
      skill: { text: expect.stringContaining('Make that Cookie faint') },
    })
    expect(findCard('BS11-098')).toMatchObject({
      type: 'cookie',
      name: 'Cream Skelecake Archer',
      level: 1,
      hp: 2,
      energyType: 'BLACK',
      skill: { text: expect.stringContaining('receives 1 damage') },
    })
    expect(findCard('BS11-099')).toMatchObject({
      type: 'cookie',
      name: 'Cream Roll Hog Rider',
      level: 1,
      hp: 2,
      energyType: 'BLACK',
      skill: { text: expect.stringContaining('place this Cookie in your trash') },
    })
  })
})

describe('BS11-097～099 exact adapters', () => {
  it('maps Cream Jelly Worm payment, Special Play gate, and restricted faint target', () => {
    expect(convertOfficialCookieSkill(findCard('BS11-097'))).toMatchObject({
      trigger: 'activate',
      oncePerTurn: true,
      cost: { energy: { black: 1 }, discardHand: 1 },
      effects: [{
        kind: 'make-faint',
        target: {
          side: 'opponent',
          min: 0,
          max: 1,
          minLevel: 1,
          maxLevel: 1,
          noSkillOnly: true,
        },
        condition: { kind: 'battle-area-has-special-play-cookie', side: 'self' },
      }],
    })
  })

  it('maps Cream Skelecake Archer to conditional damage', () => {
    expect(convertOfficialCookieSkill(findCard('BS11-098'))).toMatchObject({
      trigger: 'activate',
      oncePerTurn: true,
      cost: { energy: { black: 1 }, discardHand: 0 },
      effects: [{
        kind: 'damage',
        amount: 1,
        target: { side: 'opponent', min: 0, max: 1 },
        condition: { kind: 'battle-area-has-special-play-cookie', side: 'self' },
      }],
    })
  })

  it('maps Cream Roll Hog Rider to conditional source departure', () => {
    expect(convertOfficialCookieSkill(findCard('BS11-099'))).toMatchObject({
      trigger: 'activate',
      cost: { energy: {}, discardHand: 0 },
      effects: [{
        kind: 'field-to-trash',
        target: { side: 'self', min: 1, max: 1, sourceOnly: true },
        condition: { kind: 'battle-area-has-special-play-cookie', side: 'self' },
      }],
    })
  })

  it.each(['BS11-097', 'BS11-098', 'BS11-099'])('converts %s through the Cookie adapter', (cardNumber) => {
    const result = convertOfficialCardToGameCard(
      findCard(cardNumber),
      `bs11-twenty-fourth-${cardNumber}`,
    )
    expect(result.status).toBe('converted')
    if (result.status !== 'converted') return
    expect(result.gameCard).toMatchObject({
      id: cardNumber,
      type: 'cookie',
      skill: { trigger: 'activate' },
    })
  })
})
