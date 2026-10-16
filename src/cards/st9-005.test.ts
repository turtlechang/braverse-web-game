import { describe, expect, it } from 'vitest'
import { getCardPoolEntry } from '../game/card-pool'
import { createCard } from '../game/starter-deck'
import candidateDocument from '../../data/cards/official-st9-004-006.en.json'
import type { OfficialCardRecord } from './types'
import { analyzeOfficialCardBehavior } from './contracts/ledger'

const raw = (getCardPoolEntry('ST9-005') ??
  (candidateDocument.cards as OfficialCardRecord[]).find(card => card.cardNumber === 'ST9-005'))
if (!raw) throw new Error('Original ST9-005 Mystic Opal Cookie is required')

describe('ST9-005 original Mystic Opal Cookie printing', () => {
  it('keeps its printed blue Blocker payment and BN ordinary attack', () => {
    const card = createCard(raw, 'player-one', 1)
    if (card.type !== 'cookie') throw new Error('Original Cookie required')

    expect([card.name, card.cardColor ?? card.energyColor, card.energyColor, card.level,
      card.hp, card.attack, card.attackCost, card.attackEnergyCost]).toEqual([
      'Mystic Opal Cookie', 'blue', 'blue', 1, 3, 1, 2, { blue: 1, neutral: 1 },
    ])
    expect(card.skill).toMatchObject({
      trigger: 'block',
      oncePerTurn: false,
      yourTurn: false,
      restSource: false,
      cost: { energy: { blue: 1 }, discardHand: 0 },
      effects: [{ kind: 'redirect-attack', target: { side: 'self', min: 1, max: 1, sourceOnly: true } }],
    })
    expect(card.flip).toBeUndefined()
    expect(analyzeOfficialCardBehavior(raw, card).contract.status).toBe('verified')
  })
})
