import { expect, it } from 'vitest'
import candidate from '../../data/cards/official-festival-arena-bs12.en.json'
import type { OfficialCardRecord } from './types'
import { convertOfficialCardToGameCard } from './official-card-adapter'
import { analyzeOfficialCardBehavior } from './contracts/ledger'

it.each(['BS12-053', 'BS12-053@1'])('%s pays one any support for attack response and checks all own supports after attack payment', number => {
  const record = candidate.cards.find(c => c.cardNumber === number) as OfficialCardRecord
  const converted = convertOfficialCardToGameCard(record)
  expect(converted).toMatchObject({ status: 'converted', gameCard: {
    type: 'cookie', name: 'Kumiho Cookie', energyColor: 'green', keywords: ['arena'], level: 3, hp: 6, attack: 3,
    attackEnergyCost: { green: 3, neutral: 1 }, imageUrl: record.imageUrl,
    skill: { trigger: 'opponent-attack', oncePerTurn: true, yourTurn: false, restSource: false,
      cost: { energy: {}, supportToTrash: 1 }, effects: [{ kind: 'modify-attack', amount: -2, duration: 'this-turn', target: { side: 'opponent', min: 0, max: 1 } }] },
    attackEffects: [{ kind: 'damage-all', amount: 1, side: 'opponent', sequential: true, target: { side: 'opponent', min: 1, max: 2 }, condition: { kind: 'all-support-rested', side: 'self' } }],
  } })
  if (converted.status !== 'converted' || converted.gameCard.type !== 'cookie' || !converted.gameCard.skill) throw new Error('Missing Kumiho')
  const card = converted.gameCard
  expect(card.skill!.effects).toHaveLength(1)
  expect(card.attackEffects).toHaveLength(1)
  expect(analyzeOfficialCardBehavior(record).contract.status).toBe('verified')
  for (const patch of [{ trigger: 'activate' as const }, { yourTurn: true }, { oncePerTurn: false }, { restSource: true }, { cost: { energy: {}, supportToTrash: 0 } }, { cost: { energy: {}, supportToTrash: 1, supportToTrashKeyword: 'arena' as const } }]) {
    expect(analyzeOfficialCardBehavior(record, { ...card, skill: { ...card.skill!, ...patch } }).contract.status).not.toBe('verified')
  }
  expect(analyzeOfficialCardBehavior(record, { ...card, attackEffects: [] }).contract.status).not.toBe('verified')
  expect(analyzeOfficialCardBehavior(record, { ...card, attackEffects: [{ kind: 'damage-all', amount: 1, side: 'opponent', condition: { kind: 'all-support-rested', side: 'opponent' } }] }).contract.status).not.toBe('verified')
})
