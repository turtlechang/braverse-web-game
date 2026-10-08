import { expect, it } from 'vitest'
import candidate from '../../data/cards/official-festival-arena-bs12.en.json'
import type { OfficialCardRecord } from './types'
import { convertOfficialCardToGameCard } from './official-card-adapter'
import { analyzeOfficialCardBehavior } from './contracts/ledger'

it('083 preserves P1 and zero-to-one own trash Cookie with printed Blocker without color, level or Arena restrictions', () => {
  const source = candidate.cards.find(card => card.cardNumber === 'BS12-083') as OfficialCardRecord
  const snapshot = structuredClone(source)
  const result = convertOfficialCardToGameCard(source)
  expect(result).toMatchObject({ status: 'converted', gameCard: {
    id: 'BS12-083', name: 'Rock Spirit Guitar String', type: 'item', energyColor: 'purple', keywords: ['arena'],
    imageUrl: 'https://cookierunbraverse.com/data/en_storage/DGc2V1vW4Qk3_7_S5q72OQ.webp',
    item: { cost: { energy: { purple: 1 }, discardHand: 0 }, effects: [{ kind: 'trash-to-battle', amount: 1, optional: true, blockerOnly: true }] },
  } })
  expect(analyzeOfficialCardBehavior(source).contract.status).toBe('verified')
  expect(source).toEqual(snapshot)
})

it.each(['free', 'wrong-color', 'discard', 'required', 'two', 'non-blocker', 'arena', 'color', 'level', 'name', 'condition', 'Then'] as const)('083 strict rejects changed printed behavior: %s', mutation => {
  const source = candidate.cards.find(card => card.cardNumber === 'BS12-083') as OfficialCardRecord
  const result = convertOfficialCardToGameCard(source)
  if (result.status !== 'converted' || !result.gameCard.item) throw new Error('Missing 083 Item')
  const card = structuredClone(result.gameCard)
  const item = card.item!
  const effect = item.effects[0]
  if (effect?.kind !== 'trash-to-battle') throw new Error('Missing 083 trash play')
  if (mutation === 'free') item.cost.energy = {}
  if (mutation === 'wrong-color') item.cost.energy = { neutral: 1 }
  if (mutation === 'discard') item.cost.discardHand = 1
  if (mutation === 'required') effect.optional = false
  if (mutation === 'two') effect.amount = 2
  if (mutation === 'non-blocker') delete effect.blockerOnly
  if (mutation === 'arena') effect.keyword = 'arena'
  if (mutation === 'color') effect.energyColor = 'purple'
  if (mutation === 'level') effect.maxLevel = 1
  if (mutation === 'name') effect.cardName = 'Pudding Cookie'
  if (mutation === 'condition') effect.condition = { kind: 'hand-count-at-most', count: 2 }
  if (mutation === 'Then') effect.thenEffects = [{ kind: 'draw-up-to', max: 1 }]
  expect(analyzeOfficialCardBehavior(source, card).contract.status).not.toBe('verified')
})
