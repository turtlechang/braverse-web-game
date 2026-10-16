import { describe, expect, it } from 'vitest'
import { getCardPoolEntry } from '../game/card-pool'
import { createCard } from '../game/starter-deck'
import candidateDocument from '../../data/cards/official-st9-001-003.en.json'
import type { CookieCard } from '../game/types'
import type { OfficialCardRecord } from './types'
import { analyzeOfficialCardBehavior } from './contracts/ledger'

const raw = (getCardPoolEntry('ST9-003') ??
  (candidateDocument.cards as OfficialCardRecord[]).find(card => card.cardNumber === 'ST9-003'))
if (!raw) throw new Error('Original ST9-003 Blue Whale Cookie is required')

const original = (): CookieCard => {
  const card = createCard(raw, 'player-one', 1)
  if (card.type !== 'cookie') throw new Error('Original Cookie required')
  return card
}

describe('ST9-003 original Blue Whale Cookie printing', () => {
  it('keeps its blue LV2 / 4 HP body, BBB ordinary attack, and revealed-card return FLIP', () => {
    const card = original()
    expect([card.name, card.cardColor ?? card.energyColor, card.energyColor, card.level, card.hp,
      card.attack, card.attackCost, card.attackEnergyCost]).toEqual([
      'Blue Whale Cookie', 'blue', 'blue', 2, 4, 3, 3, { blue: 3 },
    ])
    expect(card.skill).toBeUndefined()
    expect(card.attackEffects ?? []).toEqual([])
    expect(card.effects).toEqual([{ kind: 'flip-to-hand' }])
    expect(card.flip).toMatchObject({
      cost: { energy: {}, discardHand: 0 },
      effects: [{ kind: 'flip-to-hand' }],
    })
    expect(card.flip?.attachedHpBonus).toBeUndefined()
    expect(card.imageUrl).toBe(raw.imageUrl)
    expect(analyzeOfficialCardBehavior(raw, card).contract.status).toBe('verified')
  })

})
