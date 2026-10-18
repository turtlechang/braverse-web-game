import { describe, expect, it } from 'vitest'
import document from '../../data/cards/official-st6-002.en.json'
import type { OfficialCardRecord } from './types'
import { createCard } from '../game/starter-deck'
import { analyzeOfficialCardBehavior } from './contracts'

// Independent expectations from the original ST6-002 image, reviewed 2026-10-10.
const raw = document.cards.find(card => card.cardNumber === 'ST6-002') as OfficialCardRecord

describe('ST6-002 printed Wings of Fire', () => {
  it('preserves R Activate Once and RR normal 1, with optional source HP cost for original defender damage 2', () => {
    const card = createCard(raw, 'player-one', 1)
    if (card.type !== 'cookie') throw new Error('Expected printed Cookie')
    expect([card.name, card.energyColor, card.level, card.hp, card.attack]).toEqual(['Fire Spirit Cookie', 'red', 3, 6, 1])
    expect(card.attackEnergyCost).toEqual({ red: 2 })
    expect(card.skill).toMatchObject({ trigger: 'activate', oncePerTurn: true, restSource: false,
      cost: { energy: { red: 1 }, discardHand: 0 },
      effects: [{ kind: 'damage', amount: 1, target: { side: 'opponent', min: 0, max: 1 } }],
    })
    expect(card.attackEffects).toEqual([{
      kind: 'optional-cost-attack', effectText: raw.attackText,
      cost: { energy: {}, hpToTrash: { amount: 1, sourceOnly: true } },
      effects: [{ kind: 'damage', amount: 2,
        target: { side: 'opponent', min: 1, max: 1, attackTargetOnly: true } }],
    }])
    expect(card.flip).toBeUndefined()
  })

  it('has complete timing, payment, cost, target and Then contract evidence', () => {
    const audit = analyzeOfficialCardBehavior(raw)
    expect(audit.errors).toEqual([])
    expect(audit.contract.status).toBe('verified')
  })
})
