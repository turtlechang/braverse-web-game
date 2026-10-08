import { expect, it } from 'vitest'
import candidate from '../../data/candidates/official-festival-arena-bs12.en.json'
import type { OfficialCardRecord } from './types'
import { convertOfficialCardToGameCard } from './official-card-adapter'
import { analyzeOfficialCardBehavior } from './contracts/ledger'

it('082 matches the independently read continuous opponent Item hand cost and PP ordinary two', () => {
  const source = candidate.cards.find(card => card.cardNumber === 'BS12-082') as OfficialCardRecord
  const before = structuredClone(source)
  const result = convertOfficialCardToGameCard(source)
  expect(result).toMatchObject({ status: 'converted', gameCard: { id: 'BS12-082', name: 'DJ Cookie', energyColor: 'purple', level: 1, hp: 2,
    attack: 2, attackCost: 2, attackEnergyCost: { purple: 2 }, keywords: ['arena'], skill: { trigger: 'passive', restSource: false,
      oncePerTurn: false, yourTurn: false, cost: { energy: {}, discardHand: 0 },
      effects: [{ kind: 'require-item-activate-discard-hand', count: 1 }],
    } } })
  if (result.status !== 'converted' || result.gameCard.type !== 'cookie') throw new Error('Missing DJ Cookie')
  expect(result.gameCard.flip).toBeUndefined()
  expect(result.gameCard.attackEffects).toBeUndefined()
  expect(result.gameCard.attackText).toBe('<{P}{P}> Hard Beat {da} 2')
  expect(result.gameCard.imageUrl).toBe('https://cookierunbraverse.com/data/en_storage/pR9gnDv0nNwg5jT3xGg8PA.webp')
  expect(analyzeOfficialCardBehavior(source).contract.status).toBe('verified')
  expect(source).toEqual(before)
})

it.each(['missing', 'free', 'two', 'REST', 'once', 'your-turn', 'activate', 'energy', 'own-cost', 'attack', 'hp'] as const)('082 strict rejects missing or changed behavior: %s', mutation => {
  const source = candidate.cards.find(card => card.cardNumber === 'BS12-082') as OfficialCardRecord
  const result = convertOfficialCardToGameCard(source)
  if (result.status !== 'converted' || result.gameCard.type !== 'cookie' || !result.gameCard.skill) throw new Error('Missing DJ Cookie')
  const card = structuredClone(result.gameCard)
  const skill = card.skill!
  if (mutation === 'missing') skill.effects = []
  const tax = skill.effects[0]
  if (tax?.kind === 'require-item-activate-discard-hand' && mutation === 'free') tax.count = 0
  if (tax?.kind === 'require-item-activate-discard-hand' && mutation === 'two') tax.count = 2
  if (mutation === 'REST') skill.restSource = true
  if (mutation === 'once') skill.oncePerTurn = true
  if (mutation === 'your-turn') skill.yourTurn = true
  if (mutation === 'activate') skill.trigger = 'activate'
  if (mutation === 'energy') skill.cost.energy = { purple: 1 }
  if (mutation === 'own-cost') skill.cost.discardHand = 1
  if (mutation === 'attack') card.attackEnergyCost = { neutral: 2 }
  if (mutation === 'hp') card.hp = 3
  expect(analyzeOfficialCardBehavior(source, card).errors).toContain('BS12-082 lacks continuous battle-source opponent Item discard one and PP ordinary two without REST, Once or Your Turn')
})
