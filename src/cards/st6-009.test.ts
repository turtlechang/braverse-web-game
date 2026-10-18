import { describe, expect, it } from 'vitest'
import document from '../../data/cards/official-st6-009.en.json'
import type { OfficialCardRecord } from './types'
import { analyzeOfficialCardBehavior } from './contracts'
import { createCard } from '../game/starter-deck'

// Independent transcription of original English ST6-009 Capsaicin Cookie.
const raw = document.cards.find(c => c.cardNumber === 'ST6-009') as OfficialCardRecord
describe('ST6-009 original Capsaicin Cookie', () => {
  it('keeps red LV3, HP5 and RRRR ordinary four without attack Then or FLIP', () => {
    const card = createCard(raw, 'player-one', 1)
    if (card.type !== 'cookie') throw new Error('Expected Cookie')
    expect([card.name, card.energyColor, card.level, card.hp, card.attack])
      .toEqual(['Capsaicin Cookie', 'red', 3, 5, 4])
    expect(card.attackEnergyCost).toEqual({ red: 4 })
    expect(card.attackEffects ?? []).toEqual([])
    expect(card.flip).toBeUndefined()
  })
  it('requires R plus one arbitrary hand discard, once, without resting the source', () => {
    const card = createCard(raw, 'player-one', 1)
    if (card.type !== 'cookie') throw new Error('Expected Cookie')
    expect(card.skill).toMatchObject({ trigger: 'activate', oncePerTurn: true,
      cost: { energy: { red: 1 }, discardHand: 1 }, effects: [{ kind: 'damage', amount: 1,
        target: { side: 'opponent', min: 0, max: 1 } }] })
    expect(card.skill?.restSource).toBe(false)
  })
  it('has a verified strict contract', () => {
    const report = analyzeOfficialCardBehavior(raw)
    expect(report.errors).toEqual([])
    expect(report.contract.status).toBe('verified')
  })
})
