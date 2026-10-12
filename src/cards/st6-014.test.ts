import { describe, expect, it } from 'vitest'
import document from '../../data/cards/official-st6-014.en.json'
import type { OfficialCardRecord } from './types'
import { analyzeOfficialCardBehavior } from './contracts'
import { createCard } from '../game/starter-deck'
const raw = document.cards.find(card => card.cardNumber === 'ST6-014') as OfficialCardRecord
// Original print: RR plus one own Cookie top HP, all opponents one damage,
// then optional own Fire Spirit gets one attack damage for this turn.
describe('ST6-014 original HP cost, all-opponent damage and named Then', () => {
  it('preserves all printed costs, targets and order', () => {
    const card = createCard(raw, 'player-one', 1)
    expect([card.name, card.type, card.energyColor]).toEqual(['Essence of Conflagration', 'item', 'red'])
    expect(card.item?.cost).toEqual({energy:{red:2},discardHand:0,hpToTrash:{amount:1}})
    expect(card.item?.effects).toEqual([
      {kind:'damage-all',amount:1,side:'opponent'},
      {kind:'modify-attack',amount:1,duration:'this-turn',
        target:{side:'self',min:0,max:1,cardName:'Fire Spirit Cookie'}},
    ])
    expect(card.skill).toBeUndefined()
    expect(card.flip).toBeUndefined()
  })
  it('has a verified strict contract', () => {
    expect(analyzeOfficialCardBehavior(raw).contract.status).toBe('verified')
  })
  it.each(['missing-hp-cost','two-hp','source-only-hp','blue-cost','free',
    'own-damage','two-damage','wrong-name','opponent-target','mandatory',
    'two-targets','persistent','two-buff','reverse-order'] as const)(
    'rejects executed item mutation %s despite unchanged display effects', mutation => {
      const card = createCard(raw, 'player-one', 1), ability = card.item
      if (!ability?.cost.hpToTrash) throw new Error('Missing printed item cost')
      const damage = ability.effects[0], buff = ability.effects[1], hp = ability.cost.hpToTrash
      if (damage?.kind !== 'damage-all' || buff?.kind !== 'modify-attack' || !buff.target)
        throw new Error('Missing complete printed effects')
      if (mutation === 'missing-hp-cost') delete ability.cost.hpToTrash
      if (mutation === 'two-hp') hp.amount = 2
      if (mutation === 'source-only-hp') hp.sourceOnly = true
      if (mutation === 'blue-cost') ability.cost.energy = {blue:2}
      if (mutation === 'free') ability.cost.energy = {}
      if (mutation === 'own-damage') damage.side = 'self'
      if (mutation === 'two-damage') damage.amount = 2
      if (mutation === 'wrong-name') buff.target.cardName = 'Habanero Cookie'
      if (mutation === 'opponent-target') buff.target.side = 'opponent'
      if (mutation === 'mandatory') buff.target.min = 1
      if (mutation === 'two-targets') buff.target.max = 2
      if (mutation === 'persistent') buff.duration = 'persistent'
      if (mutation === 'two-buff') buff.amount = 2
      if (mutation === 'reverse-order') ability.effects.reverse()
      expect(analyzeOfficialCardBehavior(raw,card).contract.status).not.toBe('verified')
    },
  )
})
