import { expect, it } from 'vitest'
import candidate from '../../data/candidates/official-festival-arena-bs12.en.json'
import type { OfficialCardRecord } from './types'
import { convertOfficialCardToGameCard } from './official-card-adapter'
import { analyzeOfficialCardBehavior } from './contracts/ledger'

const source = candidate.cards.find(card => card.cardNumber === 'BS12-013') as OfficialCardRecord
it('Limited Edition Record pays R, adds one attack this turn and readies that same red Arena Cookie', () => {
  expect(convertOfficialCardToGameCard(source)).toMatchObject({ status: 'converted', gameCard: {
    type: 'item', item: { cost: { red: 1 }, effects: [{ kind: 'modify-attack', amount: 1, duration: 'this-turn',
      target: { side: 'self', min: 0, max: 1, energyColor: 'red', keyword: 'arena' },
      thenEffects: [{ kind: 'set-cookie-active', target: { side: 'self', min: 0, max: 1, energyColor: 'red', keyword: 'arena', previousEffectTargetOnly: true } }],
    }] },
  } })
})

it('strict rejects omitted, reordered or weakened modifier and same-target Then evidence', () => {
  const converted = convertOfficialCardToGameCard(source)
  if (converted.status !== 'converted' || !converted.gameCard.item) throw new Error('Missing item')
  const item = converted.gameCard.item
  const effect = item.effects[0]
  if (effect.kind !== 'modify-attack') throw new Error('Missing modifier')
  const then = effect.thenEffects?.[0]
  if (then?.kind !== 'set-cookie-active') throw new Error('Missing Then')
  expect(analyzeOfficialCardBehavior(source, converted.gameCard).contract.status).toBe('verified')
  for (const effects of [[], [{ ...effect, amount: 2 }], [{ ...effect, duration: 'opponent-next-turn' as const }],
    [{ ...effect, thenEffects: [] }], [{ ...effect, target: { ...effect.target, energyColor: undefined } }],
    [{ ...effect, target: { ...effect.target, keyword: undefined } }],
    [{ ...effect, thenEffects: [{ ...then, target: { ...then.target, previousEffectTargetOnly: undefined } }] }],
    [then, { ...effect, thenEffects: undefined }],
  ]) expect(analyzeOfficialCardBehavior(source, { ...converted.gameCard, item: { ...item, effects } }).contract.status).not.toBe('verified')
})
