import { expect, it } from 'vitest'
import candidate from '../../data/cards/official-festival-arena-bs12.en.json'
import type { OfficialCardRecord } from './types'
import { convertOfficialCardToGameCard } from './official-card-adapter'
import { analyzeOfficialCardBehavior } from './contracts/ledger'

it('048 places for G, rests itself to play an Arena support Cookie, then optionally pays G to rest an opponent support', () => {
  const record = candidate.cards.find(card => card.cardNumber === 'BS12-048') as OfficialCardRecord
  const before = structuredClone(record)
  const converted = convertOfficialCardToGameCard(record)
  expect(converted).toMatchObject({ status: 'converted', gameCard: {
    name: 'Orchestra Hall', type: 'stage', energyColor: 'green', keywords: ['arena'],
    stageAbility: {
      placementCost: { green: 1 }, cost: { energy: {}, discardHand: 0 }, restSource: true,
      effects: [{ kind: 'support-to-battle', amount: 1, optional: true, keyword: 'arena', thenEffects: [{
        kind: 'optional-cost-attack', resolution: 'ability', cost: { energy: { green: 1 }, discardHand: 0 },
        effects: [{ kind: 'rest-support', side: 'opponent', amount: 1, optional: true }],
      }] }],
    },
  } })
  if (converted.status !== 'converted' || !converted.gameCard.stageAbility) throw new Error('Missing Orchestra Hall')
  const ability = converted.gameCard.stageAbility
  expect(ability.oncePerTurn).not.toBe(true)
  expect(ability.triggered).not.toBe(true)
  expect(analyzeOfficialCardBehavior(record).contract.status).toBe('verified')
  const play = ability.effects[0]
  if (play.kind !== 'support-to-battle') throw new Error('Missing entry')
  const then = play.thenEffects![0]
  if (then.kind !== 'optional-cost-attack') throw new Error('Missing optional cost')
  const variants = [
    { ...ability, placementCost: {} }, { ...ability, restSource: false },
    { ...ability, oncePerTurn: true }, { ...ability, cost: { energy: { green: 1 } } },
    { ...ability, effects: [{ ...play, keyword: undefined }] },
    { ...ability, effects: [{ ...play, thenEffects: undefined }, then] },
    { ...ability, effects: [{ ...play, thenEffects: [{ ...then, cost: { energy: {} } }] }] },
    { ...ability, effects: [{ ...play, thenEffects: [{ ...then, resolution: 'attack' as const }] }] },
    { ...ability, effects: [{ ...play, thenEffects: [{ ...then, effects: [{ kind: 'rest-support' as const, side: 'self' as const, amount: 1, optional: true }] }] }] },
  ]
  for (const stageAbility of variants) expect(analyzeOfficialCardBehavior(record, { ...converted.gameCard, stageAbility }).contract.status).not.toBe('verified')
  expect(record).toEqual(before)
})
