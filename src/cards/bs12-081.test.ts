import { expect, it } from 'vitest'
import candidate from '../../data/cards/official-festival-arena-bs12.en.json'
import type { OfficialCardRecord } from './types'
import { convertOfficialCardToGameCard } from './official-card-adapter'
import { analyzeOfficialCardBehavior } from './contracts/ledger'

it('081 preserves the independently read purple Arena hand Blocker cost without adding REST', () => {
  const source = candidate.cards.find(card => card.cardNumber === 'BS12-081') as OfficialCardRecord
  const before = structuredClone(source)
  const result = convertOfficialCardToGameCard(source)
  expect(result).toMatchObject({ status: 'converted', gameCard: { id: 'BS12-081', name: 'Pudding Cookie', energyColor: 'purple',
    level: 1, hp: 2, attack: 1, attackCost: 1, attackEnergyCost: { purple: 1 }, keywords: ['arena'],
    attackText: '<{P}> Little Deviant {da} 1', skill: { trigger: 'block', restSource: false, oncePerTurn: false, yourTurn: false,
      cost: { energy: {}, discardHand: 1, discardHandColor: 'purple', discardHandKeyword: 'arena' },
      effects: [{ kind: 'redirect-attack', target: { side: 'self', min: 1, max: 1, sourceOnly: true } }],
    } } })
  if (result.status !== 'converted' || result.gameCard.type !== 'cookie') throw new Error('Missing Pudding Cookie')
  expect(result.gameCard.flip).toBeUndefined()
  expect(result.gameCard.attackEffects).toBeUndefined()
  expect(result.gameCard.imageUrl).toBe('https://cookierunbraverse.com/data/en_storage/V0yJ5NsqdCVZ8VgoRZwnnw.webp')
  expect(analyzeOfficialCardBehavior(source).contract.status).toBe('verified')
  expect(source).toEqual(before)
})

it.each(['free', 'no-color', 'no-arena', 'cookie-only', 'energy', 'REST', 'once', 'your-turn', 'activate', 'no-redirect', 'opponent', 'wrong-attack'] as const)('081 strict rejects changed printed behavior: %s', mutation => {
  const source = candidate.cards.find(card => card.cardNumber === 'BS12-081') as OfficialCardRecord
  const result = convertOfficialCardToGameCard(source)
  if (result.status !== 'converted' || result.gameCard.type !== 'cookie' || !result.gameCard.skill) throw new Error('Missing Pudding')
  const card = structuredClone(result.gameCard)
  const skill = card.skill!
  if (mutation === 'free') skill.cost.discardHand = 0
  if (mutation === 'no-color') delete skill.cost.discardHandColor
  if (mutation === 'no-arena') delete skill.cost.discardHandKeyword
  if (mutation === 'cookie-only') skill.cost.discardHandType = 'cookie'
  if (mutation === 'energy') skill.cost.energy = { purple: 1 }
  if (mutation === 'REST') skill.restSource = true
  if (mutation === 'once') skill.oncePerTurn = true
  if (mutation === 'your-turn') skill.yourTurn = true
  if (mutation === 'activate') skill.trigger = 'activate'
  if (mutation === 'no-redirect') skill.effects = []
  const redirect = skill.effects[0]
  if (mutation === 'opponent' && redirect?.kind === 'redirect-attack') redirect.target.side = 'opponent'
  if (mutation === 'wrong-attack') card.attackEnergyCost = { neutral: 1 }
  expect(analyzeOfficialCardBehavior(source, card).errors).toContain('BS12-081 lacks P ordinary one or unrestricted-type purple Arena hand-cost Blocker without REST, Once or Your Turn')
})
