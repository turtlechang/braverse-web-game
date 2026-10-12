import { describe, expect, it } from 'vitest'
import document from '../../data/cards/official-st6-006.en.json'
import type { OfficialCardRecord } from './types'
import { analyzeOfficialCardBehavior } from './contracts'
import { createCard } from '../game/starter-deck'

const raw = document.cards.find(c => c.cardNumber === 'ST6-006') as OfficialCardRecord
describe('ST6-006 original Cherry Cookie printing', () => {
  it('retains red LV2/HP4, RRR normal three without a Then', () => {
    const card = createCard(raw, 'player-one', 1)
    if (card.type !== 'cookie') throw new Error('Expected original Cookie')
    expect([card.name, card.energyColor, card.level, card.hp, card.attack]).toEqual(['Cherry Cookie', 'red', 2, 4, 3])
    expect(card.attackEnergyCost).toEqual({ red: 3 })
    expect(card.skill).toBeUndefined()
    expect(card.attackEffects ?? []).toEqual([])
  })
  it('returns the revealed card itself, freely, with no bearer selector or HP gain', () => {
    const flip = createCard(raw, 'player-one', 1).flip
    expect(flip?.cost).toEqual({ energy: {}, discardHand: 0 })
    expect(flip?.effects).toEqual([{ kind: 'flip-to-hand' }])
    expect(flip?.attachedHpBonus).toBeUndefined()
  })
  it('has a verified strict contract', () => {
    const result = analyzeOfficialCardBehavior(raw)
    expect(result.errors).toEqual([])
    expect(result.contract.status).toBe('verified')
  })
  it.each(['If your hand has 2 cards or less, return this Cookie to your hand.',
    'Return this Cookie to your hand. Then, draw 1 card.'])(
    'does not silently drop additional clauses: %s', flipText => {
      expect(createCard({ ...raw, flipText }, 'player-one', 1).flip?.effects)
        .not.toEqual([{ kind: 'flip-to-hand' }])
    },
  )
})
