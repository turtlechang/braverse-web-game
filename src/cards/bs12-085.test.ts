import { expect, it } from 'vitest'
import candidate from '../../data/cards/official-festival-arena-bs12.en.json'
import type { OfficialCardRecord } from './types'
import { convertOfficialCardToGameCard } from './official-card-adapter'
import { analyzeOfficialCardBehavior } from './contracts/ledger'

const source = candidate.cards.find(card => card.cardNumber === 'BS12-085') as OfficialCardRecord

it('085 preserves P1 and five own trash Blocker Cookies before returning every own trash card and shuffling', () => {
  const snapshot = structuredClone(source)
  const result = convertOfficialCardToGameCard(source)
  expect(result).toMatchObject({ status: 'converted', gameCard: {
    id: 'BS12-085', name: 'Rainbow Headphones', type: 'item', energyColor: 'purple', keywords: ['arena'],
    imageUrl: 'https://cookierunbraverse.com/data/en_storage/pRwcG5KCxw7r9vNdGX2p9g.webp',
    item: { cost: { energy: { purple: 1 }, discardHand: 0 }, allowInactiveConditionalEffects: true,
      effects: [{ kind: 'trash-to-deck-all', side: 'self', condition: { kind: 'trash-blocker-cookie-count-at-least', count: 5 } }],
    },
  } })
  expect(analyzeOfficialCardBehavior(source).contract.status).toBe('verified')
  expect(source).toEqual(snapshot)
})

it.each(['free', 'wrong-color', 'two-energy', 'extra-discard', 'no-condition', 'four', 'six', 'both-sides', 'all-trash-count', 'arena-count', 'extra-then', 'extra-effect', 'no-effect', 'block-below-threshold'] as const)('085 strict rejects changed printed behavior: %s', mutation => {
  const result = convertOfficialCardToGameCard(source)
  if (result.status !== 'converted' || !result.gameCard.item) throw new Error('Missing 085 Item')
  const card = structuredClone(result.gameCard)
  const item = card.item!
  const effect = item.effects[0]
  if (effect?.kind !== 'trash-to-deck-all' || !effect.condition || !('count' in effect.condition)) throw new Error('Missing 085 trash condition')
  const condition = effect.condition
  if (mutation === 'free') item.cost.energy = {}
  if (mutation === 'wrong-color') item.cost.energy = { neutral: 1 }
  if (mutation === 'two-energy') item.cost.energy = { purple: 2 }
  if (mutation === 'extra-discard') item.cost.discardHand = 1
  if (mutation === 'no-condition') delete effect.condition
  if (mutation === 'four') condition.count = 4
  if (mutation === 'six') condition.count = 6
  if (mutation === 'both-sides') effect.side = 'both'
  if (mutation === 'all-trash-count') effect.condition = { kind: 'trash-count-at-least', count: 5 }
  if (mutation === 'arena-count') effect.condition = { kind: 'trash-keyword-count-at-least', keyword: 'arena', count: 5 }
  if (mutation === 'extra-then') effect.thenEffects = [{ kind: 'draw', amount: 1 }]
  if (mutation === 'extra-effect') item.effects.push({ kind: 'draw', amount: 1 })
  if (mutation === 'no-effect') item.effects = []
  if (mutation === 'block-below-threshold') item.allowInactiveConditionalEffects = false
  expect(analyzeOfficialCardBehavior(source, card).contract.status).not.toBe('verified')
})
