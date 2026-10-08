import { expect, it } from 'vitest'
import candidate from '../../data/candidates/official-festival-arena-bs12.en.json'
import type { OfficialCardRecord } from './types'
import { convertOfficialCardToGameCard } from './official-card-adapter'
import { analyzeOfficialCardBehavior } from './contracts/ledger'

const source = candidate.cards.find(card => card.cardNumber === 'BS12-087') as OfficialCardRecord

it('087 pays PP for optional opponent current-turn -2, then same target -1 at ten own trash Arena cards', () => {
  const snapshot = structuredClone(source)
  const result = convertOfficialCardToGameCard(source)
  expect(result).toMatchObject({ status: 'converted', gameCard: {
    id: 'BS12-087', name: 'Coming To An Understanding', type: 'trap', energyColor: 'purple', keywords: ['arena'],
    imageUrl: 'https://cookierunbraverse.com/data/en_storage/fmzao0wNn8CZ8Sha5dYUiQ.webp',
    trap: { cost: { energy: { purple: 2 }, discardHand: 0 }, effects: [{
      kind: 'modify-attack', amount: -2, duration: 'this-turn', target: { side: 'opponent', min: 0, max: 1 },
      thenEffects: [{ kind: 'modify-attack', amount: -1, duration: 'this-turn',
        target: { side: 'opponent', min: 0, max: 1, previousEffectTargetOnly: true },
        condition: { kind: 'trash-keyword-count-at-least', keyword: 'arena', count: 10 } }],
    }] },
  } })
  if (result.status !== 'converted' || !result.gameCard.trap) throw new Error('Missing 087 Trap')
  expect(result.gameCard.trap.condition).toBeUndefined()
  expect(analyzeOfficialCardBehavior(source).contract.status).toBe('verified')
  expect(source).toEqual(snapshot)
})

it.each(['one-energy', 'free', 'wrong-color', 'extra-discard', 'required-target', 'self-target', 'two-targets', 'arena-target', 'persistent', 'no-then', 'extra-effect', 'unconditional', 'nine-threshold', 'no-arena', 'new-target', 'required-then', 'then-damage', 'then-plus', 'then-longer'] as const)('087 strict rejects altered printed semantics: %s', mutation => {
  const result = convertOfficialCardToGameCard(source)
  if (result.status !== 'converted' || !result.gameCard.trap) throw new Error('Missing 087 Trap')
  const card = structuredClone(result.gameCard)
  const trap = card.trap!
  const first = trap.effects[0]
  if (first.kind !== 'modify-attack') throw new Error('Missing first reduction')
  const then = first.thenEffects?.[0]
  if (then?.kind !== 'modify-attack' || then.condition?.kind !== 'trash-keyword-count-at-least') throw new Error('Missing Then')
  const condition = then.condition
  if (mutation === 'one-energy') trap.cost.energy = { purple: 1 }
  if (mutation === 'free') trap.cost.energy = {}
  if (mutation === 'wrong-color') trap.cost.energy = { neutral: 2 }
  if (mutation === 'extra-discard') trap.cost.discardHand = 1
  if (mutation === 'required-target') first.target.min = 1
  if (mutation === 'self-target') first.target.side = 'self'
  if (mutation === 'two-targets') first.target.max = 2
  if (mutation === 'arena-target') first.target.keyword = 'arena'
  if (mutation === 'persistent') first.duration = 'persistent'
  if (mutation === 'no-then') first.thenEffects = []
  if (mutation === 'extra-effect') trap.effects.push({ kind: 'draw', amount: 1 })
  if (mutation === 'unconditional') delete then.condition
  if (mutation === 'nine-threshold') condition.count = 9
  if (mutation === 'no-arena') then.condition = { kind: 'trash-count-at-least', count: 10 }
  if (mutation === 'new-target') delete then.target.previousEffectTargetOnly
  if (mutation === 'required-then') then.target.min = 1
  if (mutation === 'then-damage') first.thenEffects = [{ kind: 'damage', amount: 1, target: then.target }]
  if (mutation === 'then-plus') then.amount = 1
  if (mutation === 'then-longer') then.duration = 'own-next-turn'
  expect(analyzeOfficialCardBehavior(source, card).contract.status).not.toBe('verified')
})
