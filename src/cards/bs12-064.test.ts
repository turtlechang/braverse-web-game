import { expect, it } from 'vitest'
import candidate from '../../data/candidates/official-festival-arena-bs12.en.json'
import type { OfficialCardRecord } from './types'
import { convertOfficialCardToGameCard } from './official-card-adapter'
import { analyzeOfficialCardBehavior } from './contracts/ledger'

const record = candidate.cards.find(card => card.cardNumber === 'BS12-064') as OfficialCardRecord
const convert = () => {
  const result = convertOfficialCardToGameCard(record)
  if (result.status !== 'converted' || result.gameCard.type !== 'cookie') throw new Error('Missing Cream Puff')
  return result.gameCard
}
it('matches the physical LV3/HP5/BBN3 and mandatory bottom reveal with an intersected conditional branch', () => {
  const before = structuredClone(record)
  const card = convert()
  expect(card).toMatchObject({ id: 'BS12-064', name: 'Cream Puff Cookie', energyColor: 'blue', cardColor: 'blue', level: 3, hp: 5,
    keywords: ['arena'], attack: 3, attackCost: 3, attackEnergyCost: { blue: 2, neutral: 1 },
    imageUrl: 'https://cookierunbraverse.com/data/en_storage/u-lepA8VhsF4Z3E9mRiaXQ.webp',
    skill: { trigger: 'on-play', oncePerTurn: false, yourTurn: false, restSource: false, cost: { energy: {}, discardHand: 0 },
      effects: [{ kind: 'reveal-bottom-deck', requireCard: true, match: { type: 'cookie', level: 2, keyword: 'arena' },
        addMatchedToHand: true, effects: [{ kind: 'draw-up-to', max: 2 }] }] } })
  expect(card.skill?.effects).toHaveLength(1)
  expect(card.attackEffects ?? []).toEqual([])
  expect(card.flip).toBeUndefined()
  const audit = analyzeOfficialCardBehavior(record)
  expect(audit.errors).toEqual([])
  expect(audit.contract.status).toBe('verified')
  expect(record).toEqual(before)
})
it.each(['missing', 'type', 'level', 'keyword', 'color-filter', 'optional-reveal', 'no-hand', 'wrong-draw', 'hand-cap', 'extra-cost', 'your-turn', 'rest', 'once'] as const)('rejects incomplete or overrestricted runtime: %s', mutation => {
  const card = structuredClone(convert())
  const skill = card.skill!
  const reveal = skill.effects[0]
  if (reveal.kind !== 'reveal-bottom-deck' || !reveal.match || !reveal.effects || reveal.effects[0].kind !== 'draw-up-to') throw new Error('Missing match branch')
  if (mutation === 'missing') skill.effects = []
  if (mutation === 'type') reveal.match.type = 'item'
  if (mutation === 'level') reveal.match.level = 1
  if (mutation === 'keyword') delete reveal.match.keyword
  if (mutation === 'color-filter') Reflect.set(reveal.match, 'energyColor', 'blue')
  if (mutation === 'optional-reveal') reveal.requireCard = false
  if (mutation === 'no-hand') reveal.addMatchedToHand = false
  if (mutation === 'wrong-draw') reveal.effects[0].max = 1
  if (mutation === 'hand-cap') reveal.effects[0].untilHandSize = 2
  if (mutation === 'extra-cost') skill.cost = { energy: { blue: 1 } }
  if (mutation === 'your-turn') skill.yourTurn = true
  if (mutation === 'rest') skill.restSource = true
  if (mutation === 'once') skill.oncePerTurn = true
  expect(analyzeOfficialCardBehavior(record, card).errors).toContain('BS12-064 lacks required bottom reveal, same LV2 Arena Cookie to hand then optional two draws and printed BBN3/HP5')
})
