import { describe, expect, it } from 'vitest'
import { getCardPoolEntry } from '../game/card-pool'
import { createCard } from '../game/starter-deck'
import candidateDocument from '../../data/cards/official-st9-001-003.en.json'
import type { OfficialCardRecord } from './types'
import { analyzeOfficialCardBehavior } from './contracts/ledger'

const raw = (getCardPoolEntry('ST9-001') ??
  (candidateDocument.cards as OfficialCardRecord[]).find(card => card.cardNumber === 'ST9-001'))
if (!raw) throw new Error('Original ST9-001 Gold Citrine Cookie is required')

describe('ST9-001 original Gold Citrine Cookie printing', () => {
  it('keeps its blue LV2 / 4 HP body and neutral NNN ordinary attack', () => {
    const card = createCard(raw, 'player-one', 1)
    if (card.type !== 'cookie') throw new Error('Original Cookie required')

    expect([card.name, card.cardColor ?? card.energyColor, card.energyColor, card.level, card.hp,
      card.attack, card.attackCost, card.attackEnergyCost]).toEqual([
      'Gold Citrine Cookie', 'blue', 'blue', 2, 4, 3, 3, { neutral: 3 },
    ])
    expect(card.skill).toBeUndefined()
    expect(card.effects ?? []).toEqual([])
    expect(card.attackEffects ?? []).toEqual([])
    expect(card.flip).toBeUndefined()
    expect(card.imageUrl).toBe(raw.imageUrl)
    expect(analyzeOfficialCardBehavior(raw, card).contract.status).toBe('verified')
  })
})
