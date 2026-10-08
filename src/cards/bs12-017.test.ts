import { expect, it } from 'vitest'
import candidate from '../../data/cards/official-festival-arena-bs12.en.json'
import type { OfficialCardRecord } from './types'
import { convertOfficialCardToGameCard } from './official-card-adapter'
import { analyzeOfficialCardBehavior } from './contracts/ledger'

it.each(['BS12-017', 'BS12-017@1'])('%s pays one hand card before readying another Arena, then may select any opponent with Apple Faerie', number => {
  const source = candidate.cards.find(card => card.cardNumber === number) as OfficialCardRecord
  const conversion = convertOfficialCardToGameCard(source)
  expect(conversion).toMatchObject({ status: 'converted', gameCard: {
    type: 'cookie', level: 1, hp: 2, attack: 2, attackEnergyCost: { red: 1, neutral: 1 }, imageUrl: source.imageUrl,
    skill: { trigger: 'activate', oncePerTurn: true, restSource: false, cost: { energy: {}, discardHand: 1 }, effects: [
      { kind: 'set-cookie-active', target: { side: 'self', min: 0, max: 1, keyword: 'arena', excludeSource: true } },
    ] },
    attackEffects: [{ kind: 'damage', amount: 1, target: { side: 'opponent', min: 0, max: 1 },
      condition: { kind: 'battle-area-has-named-cookie', side: 'self', name: 'Apple Faerie Cookie' } }],
  } })
  if (conversion.status !== 'converted' || conversion.gameCard.type !== 'cookie' || !conversion.gameCard.skill) throw new Error('missing cookie skill')
  const card = conversion.gameCard
  const damage = card.attackEffects?.[0]
  if (damage?.kind !== 'damage') throw new Error('missing damage Then')
  expect(damage.target.attackTargetOnly).toBeUndefined()
  expect(analyzeOfficialCardBehavior(source, card).contract.status).toBe('verified')
  const skill = card.skill!
  const mutations = [
    { ...card, skill: { ...skill, cost: { energy: {}, discardHand: 0 } } },
    { ...card, skill: { ...skill, cost: { energy: { red: 1 }, discardHand: 1 } } },
    { ...card, skill: { ...skill, restSource: true } },
    { ...card, skill: { ...skill, oncePerTurn: false } },
    { ...card, skill: { ...skill, effects: [] } },
    { ...card, skill: { ...skill, effects: [{ kind: 'set-cookie-active' as const, target: { side: 'self' as const, min: 0, max: 1, keyword: 'arena' as const } }] } },
    { ...card, attackEffects: [] },
    { ...card, attackEffects: [{ kind: 'damage' as const, amount: 1, target: { side: 'opponent' as const, min: 0, max: 1 } }] },
    { ...card, attackEffects: [{ kind: 'damage' as const, amount: 1, target: { side: 'opponent' as const, min: 1, max: 1, attackTargetOnly: true }, condition: { kind: 'battle-area-has-named-cookie' as const, side: 'self' as const, name: 'Apple Faerie Cookie' } }] },
    { ...card, attackEffects: [{ kind: 'damage' as const, amount: 1, target: { side: 'opponent' as const, min: 0, max: 1 }, condition: { kind: 'battle-area-has-named-cookie' as const, side: 'opponent' as const, name: 'Apple Faerie Cookie' } }] },
  ]
  for (const mutant of mutations) expect(analyzeOfficialCardBehavior(source, mutant).contract.status).not.toBe('verified')
})
