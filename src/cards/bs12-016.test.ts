import { expect, it } from 'vitest'
import candidate from '../../data/cards/official-festival-arena-bs12.en.json'
import type { OfficialCardRecord } from './types'
import { convertOfficialCardToGameCard } from './official-card-adapter'
import { analyzeOfficialCardBehavior } from './contracts/ledger'

it.each(['BS12-016', 'BS12-016@1'])('%s preserves separate free ready, optional source REST, and original-target Then', number => {
  const source = candidate.cards.find(card => card.cardNumber === number) as OfficialCardRecord
  const conversion = convertOfficialCardToGameCard(source)
  expect(conversion).toMatchObject({ status: 'converted', gameCard: {
    type: 'cookie', level: 2, hp: 4, attack: 3, attackEnergyCost: { red: 2, neutral: 1 }, imageUrl: source.imageUrl,
    skill: { trigger: 'activate', oncePerTurn: true, restSource: false, cost: { energy: {}, discardHand: 0 }, effects: [
      { kind: 'set-cookie-active', target: { side: 'self', min: 0, max: 1, keyword: 'arena', excludeSource: true } },
      { kind: 'rest-cookie', target: { side: 'self', min: 0, max: 1, sourceOnly: true } },
    ] },
    attackEffects: [{ kind: 'damage', amount: 2, target: { side: 'opponent', min: 1, max: 1, attackTargetOnly: true },
      condition: { kind: 'source-set-active-by-effect-this-turn' } }],
  } })
  if (conversion.status !== 'converted' || conversion.gameCard.type !== 'cookie' || !conversion.gameCard.skill) throw new Error('missing cookie skill')
  const card = conversion.gameCard
  expect(analyzeOfficialCardBehavior(source, card).contract.status).toBe('verified')
  const skill = card.skill!
  const mutations = [
    { ...card, skill: { ...skill, cost: { energy: { red: 1 }, discardHand: 0 } } },
    { ...card, skill: { ...skill, restSource: true } },
    { ...card, skill: { ...skill, oncePerTurn: false } },
    { ...card, skill: { ...skill, effects: skill.effects.slice(0, 1) } },
    { ...card, skill: { ...skill, effects: [skill.effects[1], skill.effects[0]] } },
    { ...card, skill: { ...skill, effects: [{ kind: 'set-cookie-active' as const, target: { side: 'self' as const, min: 0, max: 1, keyword: 'arena' as const } }, skill.effects[1]] } },
    { ...card, attackEffects: [] },
    { ...card, attackEffects: [{ kind: 'damage' as const, amount: 2, target: { side: 'opponent' as const, min: 1, max: 1, attackTargetOnly: true } }] },
  ]
  for (const mutant of mutations) expect(analyzeOfficialCardBehavior(source, mutant).contract.status).not.toBe('verified')
})
