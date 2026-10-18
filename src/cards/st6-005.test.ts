import { describe, expect, it } from 'vitest'
import document from '../../data/cards/official-st6-005.en.json'
import type { OfficialCardRecord } from './types'
import { analyzeOfficialCardBehavior } from './contracts'
import { createCard } from '../game/starter-deck'

// Independent transcription of the original English ST6-005 image.
const raw = document.cards.find(card => card.cardNumber === 'ST6-005') as OfficialCardRecord
describe('ST6-005 original Agar Agar Cookie printing', () => {
  it('retains red LV1/HP1 and RR normal damage 2 without an Activate or attack effect', () => {
    const card = createCard(raw, 'player-one', 1)
    if (card.type !== 'cookie') throw new Error('Expected printed Cookie')
    expect([card.name, card.energyColor, card.level, card.hp, card.attack]).toEqual(['Agar Agar Cookie', 'red', 1, 1, 2])
    expect(card.attackEnergyCost).toEqual({ red: 2 })
    expect(card.skill).toBeUndefined()
    expect(card.attackEffects ?? []).toEqual([])
  })
  it('preserves one arbitrary hand discard and one HP for the original bearer', () => {
    const card = createCard(raw, 'player-one', 1)
    expect(card.flip?.cost).toEqual({ energy: {}, discardHand: 1 })
    expect(card.flip?.attachedHpBonus).toBe(1)
    expect(card.flip?.effects).toEqual([])
  })
  it('has a verified strict behavior contract', () => {
    const audit = analyzeOfficialCardBehavior(raw)
    expect(audit.errors).toEqual([])
    expect(audit.contract.status).toBe('verified')
  })
})
