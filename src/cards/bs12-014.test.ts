import { expect, it } from 'vitest'
import candidate from '../../data/candidates/official-festival-arena-bs12.en.json'
import type { OfficialCardRecord } from './types'
import { convertOfficialCardToGameCard } from './official-card-adapter'
import { analyzeOfficialCardBehavior } from './contracts/ledger'

it.each(['BS12-014', 'BS12-014@1'])('%s preserves the passive Active Phase exception and printed RR attack', number => {
  const source = candidate.cards.find(card => card.cardNumber === number) as OfficialCardRecord
  const converted = convertOfficialCardToGameCard(source)
  expect(converted).toMatchObject({ status: 'converted', gameCard: {
    type: 'cookie', level: 1, hp: 1, attack: 3, attackEnergyCost: { red: 2 },
    imageUrl: source.imageUrl, skill: { trigger: 'passive', oncePerTurn: false, restSource: false,
      effects: [{ kind: 'prevent-source-active-phase', condition: {
        kind: 'battle-area-cookie-count', side: 'self', count: 0, keyword: 'arena', excludeSource: true,
      } }],
    },
  } })
  if (converted.status !== 'converted' || !converted.gameCard.skill) throw new Error('missing passive skill')
  expect(analyzeOfficialCardBehavior(source, converted.gameCard).contract.status).toBe('verified')
  const skill = converted.gameCard.skill
  for (const effects of [[], [{ kind: 'prevent-source-active-phase' as const, condition: {
    kind: 'battle-area-cookie-count' as const, side: 'self' as const, count: 0, keyword: 'arena' as const,
  } }], [{ kind: 'prevent-source-active-phase' as const, condition: {
    kind: 'battle-area-cookie-count' as const, side: 'opponent' as const, count: 0, keyword: 'arena' as const, excludeSource: true,
  } }]]) {
    expect(analyzeOfficialCardBehavior(source, { ...converted.gameCard, skill: { ...skill, effects } }).contract.status).not.toBe('verified')
  }
})
