import { describe, expect, it } from 'vitest'
import document from '../../data/cards/official-st6-011.en.json'
import type { OfficialCardRecord } from './types'
import { analyzeOfficialCardBehavior } from './contracts'
import { createCard } from '../game/starter-deck'

// Independent transcription of the original English ST6-011 Habanero printing.
const raw = document.cards.find(c => c.cardNumber === 'ST6-011') as OfficialCardRecord
describe('ST6-011 original Habanero Cookie', () => {
  it('keeps red LV1, HP2 and neutral-one ordinary one', () => {
    const card = createCard(raw, 'player-one', 1)
    if (card.type !== 'cookie') throw new Error('Expected Cookie')
    expect([card.name, card.energyColor, card.level, card.hp, card.attack])
      .toEqual(['Habanero Cookie', 'red', 1, 2, 1])
    expect(card.attackEnergyCost).toEqual({ neutral: 1 })
  })
  it('has no printed skill, attack Then or FLIP', () => {
    const card = createCard(raw, 'player-one', 1)
    if (card.type !== 'cookie') throw new Error('Expected Cookie')
    expect(card.skill).toBeUndefined()
    expect(card.attackEffects ?? []).toEqual([])
    expect(card.flip).toBeUndefined()
  })
  it('has a verified strict contract', () => {
    const report = analyzeOfficialCardBehavior(raw)
    expect(report.errors).toEqual([])
    expect(report.contract.status).toBe('verified')
  })
})
