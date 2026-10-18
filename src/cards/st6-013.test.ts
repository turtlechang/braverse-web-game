import { describe, expect, it } from 'vitest'
import document from '../../data/cards/official-st6-013.en.json'
import type { OfficialCardRecord } from './types'
import { analyzeOfficialCardBehavior } from './contracts'
import { createCard } from '../game/starter-deck'
const raw = document.cards.find(card => card.cardNumber === 'ST6-013') as OfficialCardRecord
// Independent original-card transcription: R draw zero-to-one, then optional
// own HP <= 2 target gains exactly +1 attack damage for this turn.
const effects = [{ kind: 'draw-up-to', max: 1 },
  { kind: 'modify-attack', amount: 1, duration: 'this-turn',
    target: { side: 'self', min: 0, max: 1, maxRemainingHp: 2 } }]
describe('ST6-013 original draw then low-HP buff', () => {
  it('preserves original red item, R payment and complete ordered effects', () => {
    const card = createCard(raw, 'player-one', 1)
    expect([card.name, card.type, card.energyColor]).toEqual(['Hot Jellyco Missile', 'item', 'red'])
    expect(card.item?.cost).toEqual({ red: 1 })
    expect(card.item?.effects).toEqual(effects)
    expect(card.skill).toBeUndefined()
    expect(card.flip).toBeUndefined()
  })
  it('has a verified strict contract', () => {
    expect(analyzeOfficialCardBehavior(raw).contract.status).toBe('verified')
  })
  it.each(['missing-hp-limit', 'wrong-hp-limit', 'opponent', 'mandatory', 'two-targets',
    'two-damage', 'persistent', 'missing-draw', 'reverse-order', 'free'] as const)(
    'rejects executed item mutation %s despite unchanged display effects', mutation => {
      const card = createCard(raw, 'player-one', 1)
      if (!card.item) throw new Error('Missing item ability')
      const buff = card.item.effects[1]
      if (buff?.kind !== 'modify-attack' || !buff.target) throw new Error('Missing printed buff')
      if (mutation === 'missing-hp-limit') delete buff.target.maxRemainingHp
      if (mutation === 'wrong-hp-limit') buff.target.maxRemainingHp = 3
      if (mutation === 'opponent') buff.target.side = 'opponent'
      if (mutation === 'mandatory') buff.target.min = 1
      if (mutation === 'two-targets') buff.target.max = 2
      if (mutation === 'two-damage') buff.amount = 2
      if (mutation === 'persistent') buff.duration = 'persistent'
      if (mutation === 'missing-draw') card.item.effects.shift()
      if (mutation === 'reverse-order') card.item.effects.reverse()
      if (mutation === 'free') card.item.cost = {}
      expect(analyzeOfficialCardBehavior(raw, card).contract.status).not.toBe('verified')
    },
  )
})
