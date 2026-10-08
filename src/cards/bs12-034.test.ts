import { expect, it } from 'vitest'
import candidate from '../../data/candidates/official-festival-arena-bs12.en.json'
import type { OfficialCardRecord } from './types'
import { convertOfficialCardToGameCard } from './official-card-adapter'
import { analyzeOfficialCardBehavior } from './contracts/ledger'

it.each(['BS12-034', 'BS12-034@1'])('%s matches independently inspected Madeleine print', number => {
  const record = candidate.cards.find(card => card.cardNumber === number) as OfficialCardRecord
  const snapshot = structuredClone(record)
  const converted = convertOfficialCardToGameCard(record)
  expect(converted).toMatchObject({ status: 'converted', gameCard: { name: 'Madeleine Cookie', type: 'cookie', level: 1, hp: 2,
    energyColor: 'yellow', keywords: ['arena'], attack: 2, attackCost: 2, attackEnergyCost: { yellow: 2 },
    skill: { trigger: 'passive', yourTurn: false, oncePerTurn: false, restSource: false,
      effects: [{ kind: 'modify-attack', amount: 1, duration: 'persistent', target: { side: 'self', min: 1, max: 1, sourceOnly: true },
        condition: { kind: 'break-area-card-count-at-least', side: 'self', count: 4, keyword: 'arena' } }] },
    attackEffects: [{ kind: 'optional-cost-attack', cost: { energy: {}, cookieToBreakArea: { count: 1, zones: ['hand', 'battle'], keyword: 'arena' } },
      effects: [{ kind: 'gain-hp', amount: 2, target: { side: 'self', min: 0, max: 1, minLevel: 1, maxLevel: 1 } }] }],
  } })
  expect(record).toEqual(snapshot)
  if (converted.status !== 'converted' || converted.gameCard.type !== 'cookie') throw new Error('034 conversion missing')
  expect(converted.gameCard.attackText).toMatch(/Excellent Explosion/)
  expect(converted.gameCard.attackText).not.toMatch(/Shy Ending/)
  expect(analyzeOfficialCardBehavior(record).contract.status).toBe('verified')
  const outer = converted.gameCard.attackEffects?.[0]
  if (outer?.kind !== 'optional-cost-attack') throw new Error('034 Then missing')
  for (const changed of [
    { ...outer, cost: { ...outer.cost, cookieToBreakArea: { count: 1, zones: ['hand' as const], keyword: 'arena' as const } } },
    { ...outer, cost: { ...outer.cost, cookieToBreakArea: { count: 2, zones: ['hand' as const, 'battle' as const], keyword: 'arena' as const } } },
    { ...outer, effects: [{ kind: 'gain-hp' as const, amount: 1, target: { side: 'self' as const, min: 0, max: 1, minLevel: 1, maxLevel: 1 } }] },
  ]) expect(analyzeOfficialCardBehavior(record, { ...converted.gameCard, attackEffects: [changed] }).contract.status).not.toBe('verified')
})
