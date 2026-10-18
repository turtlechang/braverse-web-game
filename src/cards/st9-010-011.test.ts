import { describe, expect, it } from 'vitest'
import candidateDocument from '../../data/cards/official-st9-010-011.en.json'
import { getCardPoolEntry } from '../game/card-pool'
import { analyzeOfficialCardBehavior } from './contracts/ledger'
import { convertOfficialCardToGameCard } from './official-card-adapter'
import { convertOfficialFlipAbility } from './official-effect-adapter'
import type { OfficialCardRecord } from './types'

const candidateCards = candidateDocument.cards as OfficialCardRecord[]
const printedCard = (cardNumber: string): OfficialCardRecord => {
  const card = getCardPoolEntry(cardNumber) ??
    candidateCards.find(candidate => candidate.cardNumber === cardNumber)
  if (!card) throw new Error(`Original ${cardNumber} printing is required`)
  return card
}

const expectedCards = [
  {
    cardNumber: 'ST9-010',
    name: 'Parfait Cookie',
    level: 1,
    hp: 1,
    attack: 2,
    attackEnergyCost: { blue: 2 },
    attackText: "<{B}{B}> I'm Gonna Be A Rockstar! {da} 2",
  },
  {
    cardNumber: 'ST9-011',
    name: 'Frilled Jellyfish Cookie',
    level: 3,
    hp: 4,
    attack: 4,
    attackEnergyCost: { blue: 4 },
    attackText: '<{B}{B}{B}{B}> Frilly Snare {da} 4',
  },
] as const

describe('ST9-010–011 original FLIP printings', () => {
  it.each(expectedCards)('$cardNumber keeps its printed body and paid attached-HP FLIP', expected => {
    const raw = printedCard(expected.cardNumber)
    expect(raw).toMatchObject({
      cardNumber: expected.cardNumber,
      name: expected.name,
      type: 'flip',
      level: expected.level,
      hp: expected.hp,
      color: 'BLUE',
      energyType: 'BLUE',
      attackText: expected.attackText,
      flipText: '<Discard 1 card.> The Cookie with this card attached for HP gains +1 HP.',
      imageUrl: expect.stringMatching(/^https:\/\/cookierunbraverse\.com\//),
    })

    const converted = convertOfficialCardToGameCard(raw, `${expected.cardNumber}-test`)
    expect(converted.status).toBe('converted')
    if (converted.status !== 'converted') throw new Error(`${expected.cardNumber} must convert`)
    expect(converted.gameCard).toMatchObject({
      id: expected.cardNumber,
      name: expected.name,
      // FLIP printings are ordinary Cookie cards at runtime; the printed
      // FLIP remains on the dedicated `flip` ability field.
      type: 'cookie',
      cardColor: 'blue',
      energyColor: 'blue',
      level: expected.level,
      hp: expected.hp,
      attack: expected.attack,
      attackEnergyCost: expected.attackEnergyCost,
      attackText: expected.attackText,
      imageUrl: raw.imageUrl,
      flip: {
        cost: { energy: {}, discardHand: 1 },
        effects: [],
        attachedHpBonus: 1,
      },
    })
    expect(convertOfficialFlipAbility(raw)).toEqual({
      text: raw.flipText,
      cost: { energy: {}, discardHand: 1 },
      effects: [],
      attachedHpBonus: 1,
    })

    const audit = analyzeOfficialCardBehavior(raw)
    expect(audit.contract.status).toBe('verified')
    expect(audit.contract.costs).toEqual([
      { kind: 'discard-hand', amount: 1, clauseIds: [expect.stringMatching(/^flip-/)] },
    ])
    expect(audit.contract.steps.find(step => step.role === 'effect' &&
      step.clauseIds.some(id => id.startsWith('flip-')))?.runtimeKinds).toContain('gain-hp')
  })
})
