import { describe, expect, it } from 'vitest'
import { analyzeOfficialCardBehavior } from './contracts/ledger'
import { createCard } from '../game/starter-deck'
import { rawSt10004 } from '../game/st10-004-demo'

describe('ST10-004 original Wizard Cookie printing', () => {
  it('keeps its purple LV1/3HP body, PN attack, and paid source-only Blocker', () => {
    const printed = rawSt10004()
    const card = createCard(printed, 'player-one', 1)
    if (card.type !== 'cookie') throw new Error('Original Cookie required')

    expect([card.name, card.cardColor ?? card.energyColor, card.energyColor, card.level,
      card.hp, card.attack, card.attackCost, card.attackEnergyCost]).toEqual([
      'Wizard Cookie', 'purple', 'purple', 1, 3, 1, 2, { purple: 1, neutral: 1 },
    ])
    expect(card.skill).toMatchObject({
      trigger: 'block',
      oncePerTurn: false,
      yourTurn: false,
      restSource: false,
      cost: { energy: { purple: 1 }, discardHand: 0 },
      effects: [{ kind: 'redirect-attack', target: { side: 'self', min: 1, max: 1, sourceOnly: true } }],
    })
    expect(card.flip).toBeUndefined()
    expect(card.attackEffects ?? []).toEqual([])
    expect(analyzeOfficialCardBehavior(printed, card).contract.status).toBe('verified')
  })
})
