import { describe, expect, it } from 'vitest'
import document from '../../data/cards/official-st6-008.en.json'
import type { OfficialCardRecord } from './types'
import { analyzeOfficialCardBehavior } from './contracts'
import { createCard } from '../game/starter-deck'

// Independent transcription of the original ST6-008 English card image.
const raw = document.cards.find(c => c.cardNumber === 'ST6-008') as OfficialCardRecord
describe('ST6-008 printed Candy Apple Cookie', () => {
  it('has red LV2, HP3, RRR normal three, without an Activate or attack Then', () => {
    const card = createCard(raw, 'player-one', 1)
    if (card.type !== 'cookie') throw new Error('Expected original Cookie')
    expect([card.name, card.energyColor, card.level, card.hp, card.attack])
      .toEqual(['Candy Apple Cookie', 'red', 2, 3, 3])
    expect(card.attackEnergyCost).toEqual({ red: 3 })
    expect(card.skill).toBeUndefined()
    expect(card.attackEffects ?? []).toEqual([])
  })
  it('freely offers a choice to draw zero or one; does not return the revealed card', () => {
    const flip = createCard(raw, 'player-one', 1).flip
    expect(flip?.cost).toEqual({ energy: {}, discardHand: 0 })
    expect(flip?.effects).toEqual([{ kind: 'draw-up-to', max: 1 }])
    expect(flip?.attachedHpBonus).toBeUndefined()
  })
  it('has a verified strict behavior contract', () => {
    const result = analyzeOfficialCardBehavior(raw)
    expect(result.errors).toEqual([])
    expect(result.contract.status).toBe('verified')
  })
})
