import { describe, expect, it } from 'vitest'
import document from '../../data/cards/official-st6-001.en.json'
import type { OfficialCardRecord } from './types'
import { createCard } from '../game/starter-deck'
import { analyzeOfficialCardBehavior } from './contracts'

// Independent expectations from the original ST6-001 card image, reviewed 2026-10-10.
const raw = document.cards.find(card => card.cardNumber === 'ST6-001') as OfficialCardRecord
describe('ST6-001 printed Mace Swing', () => {
  it('retains R normal 1, Activate Once, R and exactly the source top HP, optional enemy 1 damage', () => {
    const card = createCard(raw, 'player-one', 1)
    expect(card.type).toBe('cookie')
    if (card.type !== 'cookie') throw new Error('Expected printed Cookie')
    expect([card.name, card.energyColor, card.level, card.hp, card.attack]).toEqual(['Mala Sauce Cookie', 'red', 1, 2, 1])
    expect(card.attackEnergyCost).toEqual({ red: 1 })
    expect(card.skill).toMatchObject({ trigger: 'activate', oncePerTurn: true, restSource: false,
      cost: { energy: { red: 1 }, discardHand: 0, hpToTrash: { amount: 1, sourceOnly: true } },
      effects: [{ kind: 'damage', amount: 1, target: { side: 'opponent', min: 0, max: 1 } }],
    })
    expect(card.skill?.effects).toHaveLength(1)
    expect(card.attackEffects ?? []).toEqual([])
    expect(card.flip).toBeUndefined()
  })
  it('has complete strict timing, payment, cost and target evidence', () => {
    const audit = analyzeOfficialCardBehavior(raw)
    expect(audit.errors).toEqual([])
    expect(audit.contract.status).toBe('verified')
  })
})
