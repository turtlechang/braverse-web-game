import { expect, it } from 'vitest'
import candidate from '../../data/cards/official-festival-arena-bs12.en.json'
import type { OfficialCardRecord } from './types'
import { convertOfficialCardToGameCard } from './official-card-adapter'
import { analyzeOfficialCardBehavior } from './contracts/ledger'

it.each(['BS12-052', 'BS12-052@1'])('%s only triggers from support, discards one then optionally damages one opponent', number => {
  const record = candidate.cards.find(c => c.cardNumber === number) as OfficialCardRecord
  const converted = convertOfficialCardToGameCard(record)
  expect(converted).toMatchObject({ status: 'converted', gameCard: {
    type: 'cookie', name: 'Cocoa Cookie', energyColor: 'green', keywords: ['arena'], level: 1, hp: 2, attack: 2, attackEnergyCost: { green: 1, neutral: 1 }, imageUrl: record.imageUrl,
    skill: { trigger: 'on-play', fromSupportArea: true, oncePerTurn: false, yourTurn: false, restSource: false,
      cost: { energy: {}, discardHand: 1 }, effects: [{ kind: 'damage', amount: 1, target: { side: 'opponent', min: 0, max: 1 } }] },
  } })
  if (converted.status !== 'converted' || converted.gameCard.type !== 'cookie') throw new Error('Missing Cocoa')
  const card = converted.gameCard
  expect(card.attackEffects ?? []).toEqual([])
  expect(card.skill?.effects).toHaveLength(1)
  expect(analyzeOfficialCardBehavior(record).contract.status).toBe('verified')
  for (const patch of [{ trigger: 'passive' as const }, { fromSupportArea: false }, { yourTurn: true }, { oncePerTurn: true }, { cost: { energy: {}, discardHand: 0 } }]) {
    expect(analyzeOfficialCardBehavior(record, { ...card, skill: { ...card.skill!, ...patch } }).contract.status).not.toBe('verified')
  }
})
