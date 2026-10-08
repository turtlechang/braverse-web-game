import { expect, it } from 'vitest'
import candidate from '../../data/cards/official-festival-arena-bs12.en.json'
import type { OfficialCardRecord } from './types'
import { convertOfficialCardToGameCard } from './official-card-adapter'
import { analyzeOfficialCardBehavior } from './contracts/ledger'

const source = candidate.cards.find(card => card.cardNumber === 'BS12-086') as OfficialCardRecord

it('086 preserves P1 and zero to one own printed Blocker with +2 attack until own next turn ends', () => {
  const snapshot = structuredClone(source)
  const result = convertOfficialCardToGameCard(source)
  expect(result).toMatchObject({ status: 'converted', gameCard: {
    id: 'BS12-086', name: 'True Rock Spirit', type: 'trap', energyColor: 'purple', keywords: ['arena'],
    imageUrl: 'https://cookierunbraverse.com/data/en_storage/6rtLG2nuaL9lrkMOGw9w1g.webp',
    trap: { cost: { energy: { purple: 1 }, discardHand: 0 },
      effects: [{ kind: 'modify-attack', amount: 2, duration: 'own-next-turn', target: { side: 'self', min: 0, max: 1, blockerOnly: true } }],
    },
  } })
  if (result.status !== 'converted' || !result.gameCard.trap) throw new Error('Missing 086 Trap')
  expect(result.gameCard.trap.condition).toBeUndefined()
  expect(analyzeOfficialCardBehavior(source).contract.status).toBe('verified')
  expect(source).toEqual(snapshot)
})

it.each(['free', 'wrong-color', 'two-energy', 'extra-discard', 'no-effect', 'one-damage', 'received-damage', 'this-turn', 'opponent-next-turn', 'persistent', 'opponent-target', 'required-target', 'two-targets', 'no-blocker', 'arena-only', 'rested-only', 'extra-condition', 'extra-then'] as const)('086 strict rejects changed printed behavior: %s', mutation => {
  const converted = convertOfficialCardToGameCard(source)
  if (converted.status !== 'converted' || !converted.gameCard.trap) throw new Error('Missing 086 Trap')
  const card = structuredClone(converted.gameCard)
  const trap = card.trap!
  const effect = trap.effects[0]
  if (effect?.kind !== 'modify-attack') throw new Error('Missing 086 modifier')
  if (mutation === 'free') trap.cost.energy = {}
  if (mutation === 'wrong-color') trap.cost.energy = { neutral: 1 }
  if (mutation === 'two-energy') trap.cost.energy = { purple: 2 }
  if (mutation === 'extra-discard') trap.cost.discardHand = 1
  if (mutation === 'no-effect') trap.effects = []
  if (mutation === 'one-damage') effect.amount = 1
  if (mutation === 'received-damage') trap.effects = [{ ...effect, kind: 'modify-damage-received' }]
  if (mutation === 'this-turn') effect.duration = 'this-turn'
  if (mutation === 'opponent-next-turn') effect.duration = 'opponent-next-turn'
  if (mutation === 'persistent') effect.duration = 'persistent'
  if (mutation === 'opponent-target') effect.target.side = 'opponent'
  if (mutation === 'required-target') effect.target.min = 1
  if (mutation === 'two-targets') effect.target.max = 2
  if (mutation === 'no-blocker') delete effect.target.blockerOnly
  if (mutation === 'arena-only') effect.target.keyword = 'arena'
  if (mutation === 'rested-only') effect.target.restedOnly = true
  if (mutation === 'extra-condition') effect.condition = { kind: 'support-count-at-least', count: 3 }
  if (mutation === 'extra-then') effect.thenEffects = [{ kind: 'draw', amount: 1 }]
  expect(analyzeOfficialCardBehavior(source, card).contract.status).not.toBe('verified')
})
