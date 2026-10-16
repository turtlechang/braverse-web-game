import { describe, expect, it } from 'vitest'
import { getCardPoolEntry } from '../game/card-pool'
import { createCard } from '../game/starter-deck'
import candidateDocument from '../../data/cards/official-st9-001-003.en.json'
import type { OfficialCardRecord } from './types'
import { analyzeOfficialCardBehavior } from './contracts/ledger'

const raw = (getCardPoolEntry('ST9-002') ??
  (candidateDocument.cards as OfficialCardRecord[]).find(card => card.cardNumber === 'ST9-002'))
if (!raw) throw new Error('Original ST9-002 Aquamarine Cookie is required')

describe('ST9-002 original Aquamarine Cookie printing', () => {
  it('keeps its blue LV1 / 2 HP body and neutral N ordinary attack', () => {
    const card = createCard(raw, 'player-one', 1)
    if (card.type !== 'cookie') throw new Error('Original Cookie required')

    expect([card.name, card.cardColor ?? card.energyColor, card.energyColor, card.level, card.hp,
      card.attack, card.attackCost, card.attackEnergyCost]).toEqual([
      'Aquamarine Cookie', 'blue', 'blue', 1, 2, 1, 1, { neutral: 1 },
    ])
    expect(card.skill).toBeUndefined()
    expect(card.effects ?? []).toEqual([])
    expect(card.attackEffects ?? []).toEqual([])
    expect(card.flip).toBeUndefined()
    expect(card.imageUrl).toBe(raw.imageUrl)
    expect(analyzeOfficialCardBehavior(raw, card).contract.status).toBe('verified')
  })
})
