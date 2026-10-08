import { expect, it } from 'vitest'
import candidate from '../../data/cards/official-festival-arena-bs12.en.json'
import type { OfficialCardRecord } from './types'
import { convertOfficialCardToGameCard } from './official-card-adapter'
import { analyzeOfficialCardBehavior } from './contracts/ledger'

it('080 pays one hand card and selects zero to one own Arena Cookie for one HP', () => {
  const source = candidate.cards.find(card => card.cardNumber === 'BS12-080') as OfficialCardRecord
  const snapshot = structuredClone(source)
  const conversion = convertOfficialCardToGameCard(source)
  expect(conversion).toMatchObject({ status: 'converted', gameCard: { id: 'BS12-080', name: 'Kohlrabi Cookie', energyColor: 'purple',
    level: 1, hp: 1, attack: 1, attackCost: 1, attackEnergyCost: { purple: 1 }, keywords: ['arena'],
    attackText: '<{P}> Fan Photo Time {da} 1', flip: { cost: { energy: {}, discardHand: 1 }, effects: [
      { kind: 'gain-hp', amount: 1, target: { side: 'self', min: 0, max: 1, keyword: 'arena' } },
    ] } } })
  if (conversion.status !== 'converted' || conversion.gameCard.type !== 'cookie') throw new Error('Missing Kohlrabi Cookie')
  expect(conversion.gameCard.skill).toBeUndefined()
  expect(conversion.gameCard.attackEffects).toBeUndefined()
  expect(conversion.gameCard.flip?.effects).toHaveLength(1)
  expect(conversion.gameCard.imageUrl).toBe('https://cookierunbraverse.com/data/en_storage/iMrRuZFjzaqr8n7VwGUj7g.webp')
  expect(analyzeOfficialCardBehavior(source).contract.status).toBe('verified')
  expect(source).toEqual(snapshot)
})

it.each(['free', 'colored-hand', 'arena-hand', 'cookie-hand', 'energy', 'bottom', 'attached-bonus', 'ordinary-color', 'mandatory', 'two-targets', 'opponent', 'no-arena', 'colored-target', 'source-only', 'exclude-source', 'condition', 'amount', 'extra'] as const)('080 strict rejects a changed printed requirement: %s', mutation => {
  const source = candidate.cards.find(card => card.cardNumber === 'BS12-080') as OfficialCardRecord
  const conversion = convertOfficialCardToGameCard(source)
  if (conversion.status !== 'converted' || conversion.gameCard.type !== 'cookie' || !conversion.gameCard.flip) throw new Error('Missing Kohlrabi')
  const card = structuredClone(conversion.gameCard)
  const flip = card.flip!
  const gain = flip.effects[0]
  if (gain.kind !== 'gain-hp' || !gain.target) throw new Error('Missing Arena target')
  if (mutation === 'free') flip.cost.discardHand = 0
  if (mutation === 'colored-hand') flip.cost.discardHandColor = 'purple'
  if (mutation === 'arena-hand') flip.cost.discardHandKeyword = 'arena'
  if (mutation === 'cookie-hand') flip.cost.discardHandType = 'cookie'
  if (mutation === 'energy') flip.cost.energy = { purple: 1 }
  if (mutation === 'bottom') flip.handCostDestination = 'deck-bottom'
  if (mutation === 'attached-bonus') flip.attachedHpBonus = 1
  if (mutation === 'ordinary-color') card.attackEnergyCost = { neutral: 1 }
  if (mutation === 'mandatory') gain.target.min = 1
  if (mutation === 'two-targets') gain.target.max = 2
  if (mutation === 'opponent') gain.target.side = 'opponent'
  if (mutation === 'no-arena') delete gain.target.keyword
  if (mutation === 'colored-target') gain.target.energyColor = 'purple'
  if (mutation === 'source-only') gain.target.sourceOnly = true
  if (mutation === 'exclude-source') gain.target.excludeSource = true
  if (mutation === 'condition') gain.condition = { kind: 'opponent-hand-count-at-least', count: 5 }
  if (mutation === 'amount') gain.amount = 2
  if (mutation === 'extra') flip.effects.push({ kind: 'draw-up-to', max: 1 })
  expect(analyzeOfficialCardBehavior(source, card).errors).toContain('BS12-080 lacks P ordinary one, one unrestricted hand trash cost or zero-to-one own Arena Cookie gaining one HP')
})
