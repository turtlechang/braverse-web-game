import { describe, expect, it } from 'vitest'
import { getCardPoolEntry } from '../game/card-pool'
import { createCard } from '../game/starter-deck'
import candidateDocument from '../../data/cards/official-st9-004-006.en.json'
import type { OfficialCardRecord } from './types'
import { analyzeOfficialCardBehavior } from './contracts/ledger'

const raw = (getCardPoolEntry('ST9-006') ??
  (candidateDocument.cards as OfficialCardRecord[]).find(card => card.cardNumber === 'ST9-006'))
if (!raw) throw new Error('Original ST9-006 Sea Fairy Cookie is required')

describe('ST9-006 original Sea Fairy Cookie printing', () => {
  it('keeps its once-per-turn hand-limited draw and optional attack Then', () => {
    const card = createCard(raw, 'player-one', 1)
    if (card.type !== 'cookie') throw new Error('Original Cookie required')

    expect([card.name, card.cardColor ?? card.energyColor, card.energyColor, card.level,
      card.hp, card.attack, card.attackCost, card.attackEnergyCost]).toEqual([
      'Sea Fairy Cookie', 'blue', 'blue', 3, 6, 3, 3, { blue: 3 },
    ])
    expect(card.skill).toMatchObject({
      trigger: 'activate',
      oncePerTurn: true,
      yourTurn: false,
      restSource: false,
      cost: { energy: {}, discardHand: 0 },
      effects: [{ kind: 'draw-up-to', max: 1, condition: { kind: 'hand-count-at-most', count: 5 } }],
    })
    expect(card.attackEffects).toEqual([{
      kind: 'optional-cost-attack',
      cost: { energy: {}, discardHand: 2 },
      effectText: raw.attackText,
      effects: [{
        kind: 'damage-all', amount: 1, side: 'opponent', sequential: true,
        target: { side: 'opponent', min: 1, max: 2 },
      }],
    }])
    expect(analyzeOfficialCardBehavior(raw, card).contract.status).toBe('verified')
  })
})
