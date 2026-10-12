import { describe, expect, it } from 'vitest'
import document from '../../data/cards/official-st6-004.en.json'
import { createCard } from '../game/starter-deck'
import { analyzeOfficialCardBehavior } from './contracts'
import type { OfficialCardRecord } from './types'

// Independent transcription from the original English printing, not adapter output.
const raw = document.cards.find(card => card.cardNumber === 'ST6-004') as OfficialCardRecord
describe('ST6-004 original Pitaya Dragon printing', () => {
  it('retains red Dragon LV2/HP4/RRR3, free Once discard-one Activate and source-only attack plus one', () => {
    const card = createCard(raw, 'player-one', 1)
    expect(card.type).toBe('cookie')
    if (card.type !== 'cookie') throw new Error('Expected Cookie')
    expect([card.name, card.energyColor, card.level, card.hp, card.attack]).toEqual(['Pitaya Dragon Cookie', 'red', 2, 4, 3])
    expect(card.keywords).toContain('dragon')
    expect(card.attackEnergyCost).toEqual({ red: 3 })
    expect(card.skill).toMatchObject({ trigger: 'activate', oncePerTurn: true, restSource: false,
      cost: { energy: {}, discardHand: 1 } })
    expect(card.skill?.effects).toEqual([{ kind: 'modify-attack', amount: 1, condition: undefined, duration: 'this-turn',
      target: { side: 'self', min: 1, max: 1, sourceOnly: true } }])
    expect(card.flip).toBeUndefined()
  })
  it('preserves optional R support payment and zero-or-one arbitrary opponent damage after normal attack', () => {
    const card = createCard(raw, 'player-one', 1)
    if (card.type !== 'cookie') throw new Error('Expected Cookie')
    expect(card.attackEffects).toEqual([{ kind: 'optional-cost-attack', effectText: raw.attackText,
      cost: { energy: { red: 1 } },
      effects: [{ kind: 'damage', amount: 1, target: { side: 'opponent', min: 0, max: 1 } }] }])
  })
  it('has no unrepresented printed Then clause in its strict contract', () => {
    const audit = analyzeOfficialCardBehavior(raw)
    expect(audit.errors).toEqual([])
    expect(audit.contract.status).toBe('verified')
  })
})
