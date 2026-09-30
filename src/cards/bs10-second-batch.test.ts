import { describe, expect, it } from 'vitest'
import bs10CandidateDocument from '../../data/cards/official-paradise-of-passion-and-sloth-catacombs-of-silence-bs10.en.json'
import {
  convertOfficialAttackEffects,
  convertOfficialCardEffects,
  convertOfficialCardToGameCard,
  convertOfficialCookieSkill,
  convertOfficialFlipAbility,
  type OfficialCardRecord,
} from '.'

const records = bs10CandidateDocument.cards as OfficialCardRecord[]

const findCard = (cardNumber: string): OfficialCardRecord => {
  const card = records.find((candidate) => candidate.cardNumber === cardNumber)
  if (!card) throw new Error(`Missing BS10 candidate fixture: ${cardNumber}`)
  return card
}

describe('BS10-006 to BS10-010 candidate adapter', () => {
  it.each([
    ['BS10-006', 'Blueberry Cookie', 'cookie', 2, 3, 2, 2, { red: 2 }, '<{R}{R}> Noble Self-Defense {da} 2\r\nThen, during this turn, if your opponent\'s Cookie fainted, select up to 1 of your opponent\'s Cookies. That Cookie receives 1 damage.'],
    ['BS10-007', 'Jungleberry Cookie', 'cookie', 2, 4, 3, 3, { red: 3 }, '<{R}{R}{R}> Queen\'s Dignity {da} 3'],
    ['BS10-008', 'Cherry Cookie', 'cookie', 2, 3, 3, 3, { red: 3 }, '<{R}{R}{R}> Sweet Cherry Party {da} 3'],
    ['BS10-009', 'Cranberry Cookie', 'cookie', 2, 3, 2, 2, { red: 2 }, '<{R}{R}> Princess Candidate Fanning {da} 2'],
    ['BS10-010', 'Tarte Tatin Cookie', 'cookie', 3, 3, 3, 2, { neutral: 2 }, '<{N}{N}> Cannonade {da} 3'],
  ] as const)('%s preserves the printed card body and attack fields', (
    cardNumber,
    name,
    type,
    level,
    hp,
    attack,
    attackCost,
    attackEnergyCost,
    attackText,
  ) => {
    const result = convertOfficialCardToGameCard(findCard(cardNumber))
    expect(result).toMatchObject({
      status: 'converted',
      gameCard: {
        id: cardNumber,
        name,
        type,
        cardColor: 'red',
        energyColor: 'red',
        level,
        hp,
        attack,
        attackCost,
        attackEnergyCost,
        attackText,
      },
      source: { cardNumber },
    })
  })

  it('maps BS10-006 attack Then to conditional opponent damage', () => {
    expect(convertOfficialAttackEffects(findCard('BS10-006'))).toEqual([{
      kind: 'damage',
      amount: 1,
      target: { side: 'opponent', min: 0, max: 1 },
      condition: {
        kind: 'cookies-fainted-this-turn-at-least',
        side: 'opponent',
        count: 1,
      },
    }])
  })

  it('maps BS10-007 free once-per-turn draw to opponent faint condition', () => {
    expect(convertOfficialCardEffects(findCard('BS10-007'))).toMatchObject({
      status: 'supported',
      effects: [{
        kind: 'draw-up-to',
        max: 1,
        condition: {
          kind: 'cookies-fainted-this-turn-at-least',
          side: 'opponent',
          count: 1,
        },
      }],
    })
    expect(convertOfficialCookieSkill(findCard('BS10-007'))).toMatchObject({
      trigger: 'activate',
      oncePerTurn: true,
      yourTurn: false,
      text: findCard('BS10-007').skill.text,
    })
    expect(convertOfficialCookieSkill(findCard('BS10-007'))?.cost).toEqual({ energy: {}, discardHand: 0 })
  })

  it('keeps BS10-008 FLIP discard and attached-cookie HP bonus', () => {
    expect(convertOfficialFlipAbility(findCard('BS10-008'))).toEqual({
      text: '<Discard 1 card.> The Cookie with this card attached for HP gains +1 HP.',
      cost: { energy: {}, discardHand: 1 },
      effects: [],
      attachedHpBonus: 1,
    })
  })

  it('maps BS10-009 any own LV2+ HP cost and source-only red reduction', () => {
    expect(convertOfficialCardEffects(findCard('BS10-009'))).toMatchObject({
      status: 'supported',
      effects: [{
        kind: 'modify-attack-cost',
        target: { side: 'self', min: 1, max: 1, sourceOnly: true },
        energyCost: { red: 1 },
        operation: 'reduce',
        duration: 'this-turn',
      }],
    })
    expect(convertOfficialCookieSkill(findCard('BS10-009'))).toMatchObject({
      trigger: 'activate',
      oncePerTurn: true,
      yourTurn: false,
      text: findCard('BS10-009').skill.text,
    })
    expect(convertOfficialCookieSkill(findCard('BS10-009'))?.cost).toEqual({
      energy: {}, discardHand: 0, hpToTrash: { amount: 1, minLevel: 2 },
    })
  })

  it('keeps BS10-010 as a neutral two-energy vanilla attack', () => {
    expect(convertOfficialCardEffects(findCard('BS10-010'))).toMatchObject({
      status: 'unsupported',
      reason: 'no-effect-text',
    })
    expect(convertOfficialAttackEffects(findCard('BS10-010'))).toBeUndefined()
    expect(convertOfficialCookieSkill(findCard('BS10-010'))).toBeUndefined()
  })
})
