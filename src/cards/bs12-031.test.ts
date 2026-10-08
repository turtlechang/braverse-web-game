import { expect, it } from 'vitest'
import candidate from '../../data/candidates/official-festival-arena-bs12.en.json'
import type { OfficialCardRecord } from './types'
import { convertOfficialCardToGameCard } from './official-card-adapter'
import { analyzeOfficialCardBehavior } from './contracts/ledger'

it('031 pays YY and one own yellow Arena battle Cookie to break before independent optional draw and damage', () => {
  const source = candidate.cards.find(card => card.cardNumber === 'BS12-031') as OfficialCardRecord
  const snapshot = structuredClone(source)
  const converted = convertOfficialCardToGameCard(source)
  expect(converted).toMatchObject({ status: 'converted', gameCard: { name: 'Fashionista Spotlight', type: 'item', energyColor: 'yellow', keywords: ['arena'],
    item: { cost: { energy: { yellow: 2 }, discardHand: 0, trashBattleCookie: { count: 1, toBreakArea: true, energyColor: 'yellow', keyword: 'arena' } },
      effects: [{ kind: 'draw-up-to', max: 1 }, { kind: 'damage', amount: 1, target: { side: 'opponent', min: 0, max: 1 } }] },
  } })
  if (converted.status !== 'converted' || !converted.gameCard.item) throw new Error('031 item missing')
  expect(converted.gameCard.imageUrl).toBe('https://cookierunbraverse.com/data/en_storage/_OkSPOpnVZR_X8eImX73FQ.webp')
  expect(analyzeOfficialCardBehavior(source).contract.status).toBe('verified')
  const item = converted.gameCard.item
  const damage = item.effects[1]
  if (damage.kind !== 'damage') throw new Error('031 damage missing')
  const mutations = [
    { ...item, cost: { energy: { yellow: 2 } } }, { ...item, cost: { ...item.cost, energy: {} } },
    ...[{ ...item.cost.trashBattleCookie!, keyword: undefined }, { ...item.cost.trashBattleCookie!, energyColor: undefined },
      { ...item.cost.trashBattleCookie!, toBreakArea: false }, { ...item.cost.trashBattleCookie!, faint: true },
      { ...item.cost.trashBattleCookie!, count: 0 }, { ...item.cost.trashBattleCookie!, minLevel: 2 }].map(trashBattleCookie => ({ ...item, cost: { ...item.cost, trashBattleCookie } })),
    { ...item, effects: item.effects.slice(1) }, { ...item, effects: item.effects.slice(0, 1) },
    { ...item, effects: [...item.effects].reverse() },
    { ...item, effects: [{ kind: 'draw' as const, amount: 1 }, damage] },
    ...[{ ...damage.target, min: 1 }, { ...damage.target, max: 2 }, { ...damage.target, side: 'self' as const },
      { ...damage.target, keyword: 'arena' as const }].map(target => ({ ...item, effects: [item.effects[0], { ...damage, target }] })),
  ]
  for (const changed of mutations) expect(analyzeOfficialCardBehavior(source, { ...converted.gameCard, item: changed }).contract.status).not.toBe('verified')
  expect(source).toEqual(snapshot)
})
