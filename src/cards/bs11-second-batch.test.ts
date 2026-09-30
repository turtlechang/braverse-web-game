import { describe, expect, it } from 'vitest'
import bs11CandidateDocument from '../../data/cards/official-dark-enchantress-war-bs11.en.json'
import {
  convertOfficialCardEffects,
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

describe('BS11-006 to BS11-008 candidate adapter', () => {
  it.each([
    ['BS11-006', 'Castanets', 1, 1, 'RED', 'red', 2, '<{R}{R}> Castanet Performance {da} 2', '【On Play】 <Discard 1 {R} Item card from your hand.> If there is a [Macaron Cookie] in your battle area, all of your opponent\'s Cookies receive 1 damage.'],
    ['BS11-007', 'Flat Tofu Cookie', 3, 5, 'RED MIX', 'red', 3, '<{R}{R}{N}> Spiritcaller\'s Dance {da} 3', '【Activate】 【Once Per Turn】 <{R}{R}> All of your opponent\'s Cookies receive 1 damage.'],
    ['BS11-008', 'Raspberry Cookie', 1, 1, 'RED', 'red', 1, '<{R}{R}> Raspberry Sword Dance {da} 1', '【Activate】 【Once Per Turn】 <{R}> Select up to 1 of your opponent\'s Cookies. That Cookie receives 1 damage.'],
  ] as const)('%s preserves the printed source and card body', (
    cardNumber,
    name,
    level,
    hp,
    energyType,
    cardColor,
    attack,
    attackText,
    skillText,
  ) => {
    const record = findCard(cardNumber)
    expect(record.skill.text).toBe(skillText)
    expect(record.energyType).toBe(energyType)
    expect(record.color).toBe('RED')
    expect(convertOfficialCardEffects(record)).toMatchObject({
      status: 'supported',
      cardNumber,
      sourceText: skillText,
    })
    expect(convertOfficialCardToGameCard(record)).toMatchObject({
      status: 'converted',
      gameCard: {
        id: cardNumber,
        name,
        type: 'cookie',
        cardColor,
        energyColor: 'red',
        level,
        hp,
        attack,
        attackText,
      },
      source: { cardNumber },
    })
  })

  it('maps BS11-006 to conditional ordered damage-all with its On Play cost', () => {
    const record = findCard('BS11-006')
    expect(convertOfficialCardEffects(record)).toEqual({
      status: 'supported',
      cardNumber: 'BS11-006',
      sourceText: record.skill.text,
      effects: [{
        kind: 'damage-all',
        amount: 1,
        side: 'opponent',
        condition: {
          kind: 'battle-area-has-named-cookie',
          side: 'self',
          name: 'Macaron Cookie',
        },
      }],
    })
    expect(convertOfficialCookieSkill(record)).toMatchObject({
      trigger: 'on-play',
      oncePerTurn: false,
      yourTurn: false,
      text: record.skill.text,
      cost: {
        energy: {},
        discardHand: 1,
        discardHandColor: 'red',
        discardHandType: 'item',
      },
      effects: [{
        kind: 'damage-all',
        amount: 1,
        side: 'opponent',
        condition: {
          kind: 'battle-area-has-named-cookie',
          side: 'self',
          name: 'Macaron Cookie',
        },
      }],
    })
  })

  it('maps BS11-007 to once-per-turn Activate damage-all with RR cost', () => {
    const record = findCard('BS11-007')
    expect(convertOfficialCardEffects(record)).toEqual({
      status: 'supported',
      cardNumber: 'BS11-007',
      sourceText: record.skill.text,
      effects: [{ kind: 'damage-all', amount: 1, side: 'opponent' }],
    })
    expect(convertOfficialCookieSkill(record)).toMatchObject({
      trigger: 'activate',
      oncePerTurn: true,
      yourTurn: false,
      text: record.skill.text,
      cost: { energy: { red: 2 }, discardHand: 0 },
      effects: [{ kind: 'damage-all', amount: 1, side: 'opponent' }],
    })
  })

  it('maps BS11-008 to once-per-turn Activate up-to-one opponent damage with R cost', () => {
    const record = findCard('BS11-008')
    expect(convertOfficialCardEffects(record)).toEqual({
      status: 'supported',
      cardNumber: 'BS11-008',
      sourceText: record.skill.text,
      effects: [{
        kind: 'damage',
        amount: 1,
        target: { side: 'opponent', min: 0, max: 1 },
      }],
    })
    expect(convertOfficialCookieSkill(record)).toMatchObject({
      trigger: 'activate',
      oncePerTurn: true,
      yourTurn: false,
      text: record.skill.text,
      cost: { energy: { red: 1 }, discardHand: 0 },
      effects: [{
        kind: 'damage',
        amount: 1,
        target: { side: 'opponent', min: 0, max: 1 },
      }],
    })
  })
})
