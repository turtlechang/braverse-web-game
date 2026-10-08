import { expect, it } from 'vitest'
import candidate from '../../data/cards/official-festival-arena-bs12.en.json'
import { convertOfficialCardToGameCard } from './official-card-adapter'
import { analyzeOfficialCardBehavior } from './contracts/ledger'
import type { OfficialCardRecord } from './types'

// Independent full-card expectation recorded before inspecting the adapter.
const record = candidate.cards.find(c => c.cardNumber === 'BS12-078') as OfficialCardRecord
it('078 has a purple Arena ANY-card FLIP cost followed by opponent-chosen exactly two at five hand cards', () => {
  const before = structuredClone(record)
  const converted = convertOfficialCardToGameCard(record)
  expect(converted).toMatchObject({ status: 'converted', gameCard: {
    type: 'cookie', name: 'Onion Cookie', energyColor: 'purple', level: 3, hp: 3, keywords: ['arena'],
    imageUrl: 'https://cookierunbraverse.com/data/en_storage/_Cp27ZHTgSptsf1ubkOkzA.webp',
    attack: 3, attackEnergyCost: { purple: 3 }, flip: {
      cost: { energy: {}, discardHand: 1, discardHandColor: 'purple', discardHandKeyword: 'arena' },
      effects: [{ kind: 'opponent-discard-hand', count: 2, condition: { kind: 'opponent-hand-count-at-least', count: 5 } }],
    },
  } })
  if (converted.status !== 'converted' || converted.gameCard.type !== 'cookie' || !converted.gameCard.flip) throw new Error('Missing Onion Cookie')
  expect(converted.gameCard.skill).toBeUndefined()
  expect(converted.gameCard.attackEffects ?? []).toEqual([])
  expect(converted.gameCard.flip.cost.discardHandType).toBeUndefined()
  expect(analyzeOfficialCardBehavior(record, converted.gameCard).contract.status).toBe('verified')
  expect(record).toEqual(before)
})
it.each(['no-cost', 'color', 'keyword', 'cookie-only', 'extra-energy', 'bottom', 'amount', 'threshold', 'random', 'ordinary', 'extra-effect'] as const)('078 rejects a changed printed contract: %s', mutation => {
  const result = convertOfficialCardToGameCard(record)
  if (result.status !== 'converted' || result.gameCard.type !== 'cookie' || !result.gameCard.flip) throw new Error('Missing Onion')
  const card = structuredClone(result.gameCard)
  const flip = card.flip!
  const effect = flip.effects[0]
  if (effect.kind !== 'opponent-discard-hand') throw new Error('Missing chosen discard')
  if (mutation === 'no-cost') flip.cost.discardHand = 0
  if (mutation === 'color') delete flip.cost.discardHandColor
  if (mutation === 'keyword') delete flip.cost.discardHandKeyword
  if (mutation === 'cookie-only') flip.cost.discardHandType = 'cookie'
  if (mutation === 'extra-energy') flip.cost.energy = { purple: 1 }
  if (mutation === 'bottom') flip.handCostDestination = 'deck-bottom'
  if (mutation === 'amount') effect.count = 1
  if (mutation === 'threshold') effect.condition = { kind: 'opponent-hand-count-at-least', count: 6 }
  if (mutation === 'random') flip.effects = [{ kind: 'opponent-random-discard', count: 2 }]
  if (mutation === 'ordinary') card.attackEnergyCost = { purple: 2, neutral: 1 }
  if (mutation === 'extra-effect') flip.effects.push({ kind: 'draw-up-to', max: 1 })
  expect(analyzeOfficialCardBehavior(record, card).errors).toContain('BS12-078 lacks purple Arena any-card hand FLIP cost, five-hand condition, opponent-chosen two trash or PPP ordinary three')
})
