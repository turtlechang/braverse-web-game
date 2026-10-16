import { describe, expect, it } from 'vitest'
import { getCardPoolEntry } from '../game/card-pool'
import { createCard } from '../game/starter-deck'
import candidateDocument from '../../data/cards/official-st9-004-006.en.json'
import type { OfficialCardRecord } from './types'
import { analyzeOfficialCardBehavior } from './contracts/ledger'

const raw = (getCardPoolEntry('ST9-004') ??
  (candidateDocument.cards as OfficialCardRecord[]).find(card => card.cardNumber === 'ST9-004'))
if (!raw) throw new Error('Original ST9-004 Pond Dino Cookie is required')

describe('ST9-004 original Pond Dino Cookie printing', () => {
  it('keeps its blue LV2 / 3 HP body, BBB attack, and one-card FLIP', () => {
    const card = createCard(raw, 'player-one', 1)
    if (card.type !== 'cookie') throw new Error('Original Cookie required')

    expect([card.name, card.cardColor ?? card.energyColor, card.energyColor, card.level,
      card.hp, card.attack, card.attackCost, card.attackEnergyCost]).toEqual([
      'Pond Dino Cookie', 'blue', 'blue', 2, 3, 3, 3, { blue: 3 },
    ])
    expect(card.skill).toBeUndefined()
    expect(card.flip?.cost).toEqual({ energy: {}, discardHand: 0 })
    expect(card.flip?.effects).toEqual([{ kind: 'draw-up-to', max: 1 }])
    expect(analyzeOfficialCardBehavior(raw, card).contract.status).toBe('verified')
  })
})
