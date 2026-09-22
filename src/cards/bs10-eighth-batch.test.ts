import { describe, expect, it } from 'vitest'
import bs10CandidateDocument from '../../data/cards/official-paradise-of-passion-and-sloth-catacombs-of-silence-bs10.en.json'
import {
  convertOfficialAttackEffects,
  convertOfficialCardEffects,
  convertOfficialCookieSkill,
  type OfficialCardRecord,
} from '.'

const records = bs10CandidateDocument.cards as OfficialCardRecord[]
const findCard = (cardNumber: string): OfficialCardRecord => {
  const card = records.find((candidate) => candidate.cardNumber === cardNumber)
  if (!card) throw new Error(`Missing BS10 candidate fixture: ${cardNumber}`)
  return card
}

describe('BS10 eighth conversion batch', () => {
  it('keeps Hollyberry attack restriction dynamic and Licorice departure trigger explicit', () => {
    expect(convertOfficialCardEffects(findCard('BS10-021'))).toMatchObject({
      status: 'supported',
      effects: [],
    })
    expect(convertOfficialCookieSkill(findCard('BS10-021'))).toMatchObject({
      trigger: 'passive',
      cannotAttackCondition: { kind: 'source-hp-at-most', amount: 3 },
    })

    expect(convertOfficialCardEffects(findCard('BS10-109'))).toMatchObject({
      status: 'supported',
      effects: [{ kind: 'deck-to-trash', amount: 3, side: 'self' }],
    })
    expect(convertOfficialCookieSkill(findCard('BS10-109'))).toMatchObject({
      trigger: 'departure',
      effects: [{ kind: 'deck-to-trash', amount: 3, side: 'self' }],
    })
  })

  it('keeps Light of Sloth payment split from its equipped attack effect', () => {
    expect(convertOfficialCardEffects(findCard('BS10-045'))).toMatchObject({
      status: 'supported',
      effects: [
        {
          kind: 'gain-hp',
          amount: 1,
          target: {
            side: 'self',
            min: 0,
            max: 1,
            energyColor: 'yellow',
            minLevel: 3,
            maxLevel: 3,
          },
        },
        {
          kind: 'optional-cost-attack',
          resolution: 'ability',
          cost: { energy: { yellow: 1 }, discardHand: 0 },
          effects: [{
            kind: 'equip-source',
            requiredCookieId: 'BS10-049',
          }],
        },
      ],
    })
  })

  it('keeps Eternal Sugar passive cost and attack Then separately executable', () => {
    expect(convertOfficialCardEffects(findCard('BS10-049'))).toMatchObject({
      status: 'supported',
      effects: [],
    })
    expect(convertOfficialCookieSkill(findCard('BS10-049'))).toMatchObject({
      trigger: 'passive',
      passiveEffects: [{
        kind: 'modify-attack-cost',
        operation: 'increase',
        energyCost: { neutral: 1 },
      }],
    })
    expect(convertOfficialAttackEffects(findCard('BS10-049'))).toMatchObject([{
      kind: 'optional-cost-attack',
      cost: { energy: {}, discardHand: 1 },
      effects: [{
        kind: 'gain-hp',
        amount: 1,
        target: { side: 'self', min: 0, max: 1, maxRemainingHp: 5 },
      }],
    }])
  })

  it('keeps Silverbell movement lock, Custard order, and Refresh gates', () => {
    expect(convertOfficialCardEffects(findCard('BS10-070'))).toMatchObject({
      status: 'supported',
      effects: [{
        kind: 'prevent-opponent-battle-movement',
        sourceOnly: true,
        condition: { kind: 'support-count-at-most', count: 4 },
      }],
    })
    expect(convertOfficialCardEffects(findCard('BS10-094'))).toMatchObject({
      status: 'supported',
      effects: [
        { kind: 'field-to-deck-bottom', target: { side: 'self', min: 1, max: 1, excludeSource: true } },
        { kind: 'draw-up-to', max: 1 },
      ],
    })
    expect(convertOfficialCardEffects(findCard('BS10-107'))).toMatchObject({
      status: 'supported',
      effects: [
        { kind: 'draw-up-to', max: 2, condition: { kind: 'refreshed-during-game' } },
        { kind: 'opponent-discard-hand', count: 1 },
      ],
    })
    expect(convertOfficialCardEffects(findCard('BS10-110'))).toMatchObject({
      status: 'supported',
      effects: [{ kind: 'draw-up-to', max: 1, condition: { kind: 'refreshed-during-game' } }],
    })
  })

  it('keeps Light of Silence and Silent Salt Refresh-gated effects', () => {
    expect(convertOfficialCardEffects(findCard('BS10-119'))).toMatchObject({
      status: 'supported',
      effects: [
        { kind: 'damage', amount: 1, condition: { kind: 'refreshed-during-game' } },
        {
          kind: 'optional-cost-attack',
          resolution: 'ability',
          cost: { energy: { purple: 1 }, discardHand: 0 },
          effects: [{ kind: 'equip-source', requiredCookieId: 'BS10-122' }],
        },
      ],
    })
    expect(convertOfficialCardEffects(findCard('BS10-122'))).toMatchObject({
      status: 'supported',
      effects: [
        { kind: 'deck-to-trash', amount: 5, side: 'self' },
        { kind: 'draw-up-to', max: 2 },
      ],
    })
    expect(convertOfficialAttackEffects(findCard('BS10-122'))).toMatchObject([{
      kind: 'hp-to-trash-all',
      amount: 1,
      side: 'opponent',
      condition: { kind: 'refreshed-during-game' },
    }])
  })

  it('converts the remaining BS10 attack Then clauses with their printed boundaries', () => {
    expect(convertOfficialAttackEffects(findCard('BS10-020'))).toMatchObject([
      { kind: 'draw', amount: 1, condition: { kind: 'opponent-cookie-fainted-in-current-battle' } },
      { kind: 'discard-hand', count: 1, condition: { kind: 'opponent-cookie-fainted-in-current-battle' } },
    ])
    expect(convertOfficialAttackEffects(findCard('BS10-022'))).toMatchObject([{
      kind: 'optional-cost-attack',
      cost: { hpToTrash: { amount: 1, excludeSource: true } },
      effects: [{ kind: 'field-to-trash', target: { sourceOnly: true } }],
    }])
    expect(convertOfficialAttackEffects(findCard('BS10-023'))).toMatchObject([{
      kind: 'optional-cost-attack',
      cost: { discardHand: 1 },
      effects: [{ kind: 'gain-hp', condition: { kind: 'opponent-cookie-fainted-in-current-battle' } }],
    }])
    expect(convertOfficialAttackEffects(findCard('BS10-034'))).toMatchObject([
      { kind: 'draw-up-to', max: 1, condition: { kind: 'cookie-gained-hp-this-turn' } },
    ])
    expect(convertOfficialAttackEffects(findCard('BS10-036'))).toMatchObject([
      { kind: 'gain-hp', target: { maxLevel: 1, side: 'self' } },
    ])
    expect(convertOfficialAttackEffects(findCard('BS10-046'))).toMatchObject([
      { kind: 'gain-hp', target: { sourceOnly: true }, condition: { kind: 'source-hp-at-most', amount: 3 } },
    ])
    expect(convertOfficialAttackEffects(findCard('BS10-047'))).toMatchObject([{
      kind: 'optional-cost-attack',
      cost: { hpToTrash: { amount: 1 } },
      effects: [{ kind: 'gain-hp', target: { side: 'self' } }],
    }])
    expect(convertOfficialAttackEffects(findCard('BS10-052'))).toMatchObject([
      { kind: 'support-to-trash', side: 'self', condition: { kind: 'opponent-support-count-at-least', count: 7 } },
      { kind: 'support-to-trash', side: 'opponent', condition: { kind: 'opponent-support-count-at-least', count: 7 } },
    ])
    expect(convertOfficialAttackEffects(findCard('BS10-071'))).toMatchObject([{
      kind: 'optional-cost-attack',
      cost: { energy: { green: 2 } },
      effects: [{ kind: 'deck-to-support', amount: 1, rested: true, condition: { kind: 'support-count-at-most', count: 5 } }],
    }])
    expect(convertOfficialAttackEffects(findCard('BS10-072'))).toMatchObject([
      { kind: 'damage', amount: 1, condition: { kind: 'all-support-rested', side: 'opponent' } },
    ])
    expect(convertOfficialAttackEffects(findCard('BS10-075'))).toMatchObject([
      { kind: 'damage', amount: 1, condition: { kind: 'hand-count-at-least', count: 7 } },
    ])
    expect(convertOfficialAttackEffects(findCard('BS10-096'))).toMatchObject([{
      kind: 'optional-cost-attack',
      cost: { energy: { blue: 1 }, selfToDeckBottom: true },
      effects: [{ kind: 'draw-up-to', max: 2, condition: { kind: 'hand-count-at-most', count: 7 } }],
    }])
    expect(convertOfficialAttackEffects(findCard('BS10-097'))).toMatchObject([
      { kind: 'draw-up-to', max: 2, condition: { kind: 'hand-count-at-most', count: 4 } },
    ])
    expect(convertOfficialAttackEffects(findCard('BS10-106'))).toMatchObject([
      { kind: 'deck-to-trash', amount: 5, side: 'self' },
    ])
    expect(convertOfficialAttackEffects(findCard('BS10-121'))).toMatchObject([{
      kind: 'optional-cost-attack',
      cost: { deckToTrash: { amount: 5 } },
      effects: [
        { kind: 'damage', amount: 1 },
      ],
    }])
  })
})
