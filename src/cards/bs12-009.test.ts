import { expect, it } from 'vitest'
import candidate from '../../data/cards/official-festival-arena-bs12.en.json'
import type { OfficialCardRecord } from './types'
import { convertOfficialCardToGameCard, normalizeOfficialCardRecord } from './official-card-adapter'
import { analyzeOfficialCardBehavior } from './contracts/ledger'

it('BS12-009 pays R and rests exactly two Arena Cookies before choosing up to one opponent Cookie', () => {
  const source = candidate.cards.find(card => card.cardNumber === 'BS12-009') as OfficialCardRecord
  expect(convertOfficialCardToGameCard(source)).toMatchObject({ status: 'converted', gameCard: {
    type: 'trap', keywords: ['arena'], trap: {
      cost: { energy: { red: 1 }, discardHand: 0, battleCookiePosition: { count: 2, position: 'rested', keyword: 'arena' } },
      effects: [{ kind: 'modify-attack', amount: -3, duration: 'this-turn', target: { side: 'opponent', min: 0, max: 1 } }],
    },
  } })
})

it('strict rejects the missing Arena resting cost even when energy and modifier survive', () => {
  const source = candidate.cards.find(card => card.cardNumber === 'BS12-009') as OfficialCardRecord
  const converted = convertOfficialCardToGameCard(source)
  if (converted.status !== 'converted' || !converted.gameCard.trap) throw new Error('009 trap missing')
  expect(analyzeOfficialCardBehavior(source).contract.status).toBe('verified')
  const incomplete = { ...converted.gameCard, trap: { ...converted.gameCard.trap, cost: { energy: { red: 1 }, discardHand: 0 } } }
  expect(analyzeOfficialCardBehavior(source, incomplete).contract.blockers).toContain('Arena Cookie resting cost has no complete runtime evidence')
})

it('keeps the bilingual source intact while excluding its translated transcript from runtime attack clauses', () => {
  const source = candidate.cards.find(card => card.cardNumber === 'BS12-009') as OfficialCardRecord
  const original = structuredClone(source)
  expect(source.attackText).toMatch(/^Card Name :/)
  expect(normalizeOfficialCardRecord(source).attackText).toBeNull()
  expect(source).toEqual(original)
})
