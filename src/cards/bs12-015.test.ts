import { expect, it } from 'vitest'
import candidate from '../../data/cards/official-festival-arena-bs12.en.json'
import type { OfficialCardRecord } from './types'
import { convertOfficialCardToGameCard } from './official-card-adapter'
import { analyzeOfficialCardBehavior } from './contracts/ledger'

it.each(['BS12-015', 'BS12-015@1'])('%s preserves the passive and user-ruled original-target Then', number => {
  const source = candidate.cards.find(card => card.cardNumber === number) as OfficialCardRecord
  const conversion = convertOfficialCardToGameCard(source)
  expect(conversion).toMatchObject({ status: 'converted', gameCard: {
    type: 'cookie', level: 2, hp: 5, attack: 3, attackEnergyCost: { red: 2, neutral: 1 }, imageUrl: source.imageUrl,
    skill: { trigger: 'passive', oncePerTurn: false, restSource: false, effects: [{ kind: 'prevent-source-active-phase',
      condition: { kind: 'battle-area-cookie-count', side: 'self', count: 0, keyword: 'arena', excludeSource: true } }] },
    attackEffects: [{ kind: 'damage', amount: 1, target: { side: 'opponent', min: 1, max: 1, attackTargetOnly: true },
      condition: { kind: 'battle-area-has-keyword', side: 'self', keyword: 'arena', excludeSource: true } }],
  } })
  if (conversion.status !== 'converted' || conversion.gameCard.type !== 'cookie') throw new Error('missing cookie')
  const card = conversion.gameCard
  expect(analyzeOfficialCardBehavior(source, card).contract.status).toBe('verified')
  for (const attackEffects of [[], [{ kind: 'damage' as const, amount: 1, target: { side: 'opponent' as const, min: 1, max: 1 } }],
    [{ kind: 'damage' as const, amount: 1, target: { side: 'self' as const, min: 1, max: 1, attackTargetOnly: true },
      condition: { kind: 'battle-area-has-keyword' as const, side: 'self' as const, keyword: 'arena' as const, excludeSource: true } }]]) {
    expect(analyzeOfficialCardBehavior(source, { ...card, attackEffects }).contract.status).not.toBe('verified')
  }
})
