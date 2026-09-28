import { describe, expect, it } from 'vitest'
import bs11CandidateDocument from '../../data/cards/official-dark-enchantress-war-bs11.en.json'
import {
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

describe('BS11-001 to BS11-005 candidate adapter', () => {
  it.each([
    ['BS11-001', 'Raspberry Mousse Cookie', 'cookie', 1, 2, 1, '<{N}> Fair Duel {da} 1'],
    ['BS11-002', 'Macaron Cookie', 'cookie', 2, 5, 2, '<{R}{R}{N}> Drum Performance {da} 2'],
    ['BS11-003', 'Rose Cookie', 'flip', 2, 3, 3, '<{R}{R}{R}> Passionate Step {da} 3'],
    ['BS11-004', 'Scorpion Cookie', 'cookie', 2, 2, 4, '<{N}{N}{N}> Venom Stings {da} 4'],
    ['BS11-005', 'Cherry Cola Cookie', 'flip', 1, 1, 2, '<{R}{R}> Fizzy Sword Dance {da} 2'],
  ] as const)(
    '%s preserves the printed card body and attack fields',
    (cardNumber, name, officialType, level, hp, attack, attackText) => {
      expect(convertOfficialCardToGameCard(findCard(cardNumber))).toMatchObject({
        status: 'converted',
        gameCard: {
          id: cardNumber,
          name,
          officialType,
          type: 'cookie',
          cardColor: 'red',
          energyColor: 'red',
          level,
          hp,
          attack,
          attackText,
        },
        source: { cardNumber },
      })
    },
  )

  it('maps BS11-002 to an exact ordered draw and opponent damage effect', () => {
    const record = findCard('BS11-002')
    expect(convertOfficialCardEffects(record)).toEqual({
      status: 'supported',
      cardNumber: 'BS11-002',
      sourceText: record.skill.text,
      effects: [
        { kind: 'draw', amount: 1 },
        {
          kind: 'damage',
          amount: 1,
          target: { side: 'opponent', min: 1, max: 1 },
        },
      ],
    })
    expect(convertOfficialCookieSkill(record)).toMatchObject({
      trigger: 'activate',
      oncePerTurn: true,
      yourTurn: false,
      cost: {
        energy: { red: 1 },
        discardHand: 1,
        discardHandColor: 'red',
        discardHandType: 'item',
      },
      effects: [
        { kind: 'draw', amount: 1 },
        {
          kind: 'damage',
          amount: 1,
          target: { side: 'opponent', min: 1, max: 1 },
        },
      ],
    })
  })

  it('reuses the existing draw-up-to and attached-cookie HP FLIP semantics', () => {
    expect(convertOfficialFlipAbility(findCard('BS11-003'))).toEqual({
      text: 'Draw up to 1 card from your deck.',
      cost: { energy: {}, discardHand: 0 },
      effects: [{ kind: 'draw-up-to', max: 1 }],
    })
    expect(convertOfficialFlipAbility(findCard('BS11-005'))).toEqual({
      text: '<Discard 1 card.> The Cookie with this card attached for HP gains +1 HP.',
      cost: { energy: {}, discardHand: 1 },
      effects: [],
      attachedHpBonus: 1,
    })
  })
})
