import { describe, expect, it } from 'vitest'
import document from '../../data/cards/official-st6-003.en.json'
import type { OfficialCardRecord } from './types'
import { createCard } from '../game/starter-deck'
import { analyzeOfficialCardBehavior } from './contracts'

// Independent expectations from the original English ST6-003 image, reviewed 2026-10-10.
const raw = document.cards.find(c => c.cardNumber === 'ST6-003') as OfficialCardRecord
describe('ST6-003 printed Devil Cookie', () => {
  it('retains red LV2, 4 HP and NNN normal 3 without inventing a skill or FLIP', () => {
    const card = createCard(raw, 'player-one', 1)
    expect(card.type).toBe('cookie')
    if (card.type !== 'cookie') throw new Error('Expected Cookie')
    expect([card.name, card.energyColor, card.level, card.hp, card.attack]).toEqual(['Devil Cookie', 'red', 2, 4, 3])
    expect(card.attackEnergyCost).toEqual({ neutral: 3 })
    expect(card.skill).toBeUndefined()
    expect(card.attackEffects ?? []).toEqual([])
    expect(card.flip).toBeUndefined()
  })
  it('has a verified no-extra-effect contract', () => {
    const audit = analyzeOfficialCardBehavior(raw)
    expect(audit.errors).toEqual([])
    expect(audit.contract.status).toBe('verified')
  })
})
