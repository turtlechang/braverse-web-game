import { describe, expect, it } from 'vitest'
import document from '../../data/cards/official-st6-007.en.json'
import type { OfficialCardRecord } from './types'
import { analyzeOfficialCardBehavior } from './contracts'
import { createCard } from '../game/starter-deck'

// Independent transcription of the original English ST6-007 image.
const raw = document.cards.find(card => card.cardNumber === 'ST6-007') as OfficialCardRecord
describe('ST6-007 original Chili Pepper Cookie printing', () => {
  it('retains red LV3/HP4 and RRRR normal damage 4 without an Activate or attack effect', () => {
    const card = createCard(raw, 'player-one', 1)
    if (card.type !== 'cookie') throw new Error('Expected printed Cookie')
    expect([card.name, card.energyColor, card.level, card.hp, card.attack]).toEqual(['Chili Pepper Cookie', 'red', 3, 4, 4])
    expect(card.attackEnergyCost).toEqual({ red: 4 })
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
