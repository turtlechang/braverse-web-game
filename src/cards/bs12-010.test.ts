import { expect, it } from 'vitest'
import candidate from '../../data/cards/official-festival-arena-bs12.en.json'
import type { OfficialCardRecord } from './types'
import { convertOfficialCardToGameCard } from './official-card-adapter'
import { analyzeOfficialCardBehavior } from './contracts/ledger'

const source = candidate.cards.find(card => card.cardNumber === 'BS12-010') as OfficialCardRecord

it('BS12-010 keeps initial R, optional Arena resting cost, optional draw and the same opponent target', () => {
  expect(convertOfficialCardToGameCard(source)).toMatchObject({ status: 'converted', gameCard: {
    type: 'trap', trap: { cost: { energy: { red: 1 }, discardHand: 0 }, effects: [
      { kind: 'modify-attack', amount: -1, duration: 'this-turn', target: { side: 'opponent', min: 0, max: 1 } },
      { kind: 'optional-cost-attack', resolution: 'ability',
        cost: { energy: {}, discardHand: 0, battleCookiePosition: { count: 2, position: 'rested', keyword: 'arena' } },
        effects: [{ kind: 'draw-up-to', max: 1 },
          { kind: 'modify-attack', amount: -1, duration: 'this-turn', target: { side: 'opponent', min: 0, max: 1, previousEffectTargetOnly: true } }],
      },
    ] },
  } })
})

it('strict requires the Arena cost inside the optional Then and a linked second reduction', () => {
  const converted = convertOfficialCardToGameCard(source)
  if (converted.status !== 'converted' || converted.gameCard.type !== 'trap') throw new Error('Missing trap')
  expect(analyzeOfficialCardBehavior(source, converted.gameCard).contract.status).toBe('verified')
  const trap = converted.gameCard.trap!
  const wrapper = trap.effects[1]
  if (wrapper.kind !== 'optional-cost-attack') throw new Error('Missing optional Then')
  for (const broken of [
    { ...wrapper, cost: { energy: {}, discardHand: 0 } },
    { ...wrapper, effects: wrapper.effects.slice(0, 1) },
    { ...wrapper, effects: [wrapper.effects[0], { kind: 'modify-attack' as const, amount: -1, duration: 'this-turn' as const, target: { side: 'opponent' as const, min: 0, max: 1 } }] },
  ]) {
    expect(analyzeOfficialCardBehavior(source, { ...converted.gameCard, trap: { ...trap, effects: [trap.effects[0], broken] } }).contract.status).not.toBe('verified')
  }
})
