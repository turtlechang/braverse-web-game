import { expect, it } from 'vitest'
import candidate from '../../data/cards/official-festival-arena-bs12.en.json'
import type { OfficialCardRecord } from './types'
import { convertOfficialCardToGameCard } from './official-card-adapter'
import { analyzeOfficialCardBehavior } from './contracts/ledger'

it.each(['BS12-051', 'BS12-051@1'])('%s attacks G for one then optionally plays one own support Arena Cookie', number => {
  const record = candidate.cards.find(c => c.cardNumber === number) as OfficialCardRecord
  const converted = convertOfficialCardToGameCard(record)
  expect(converted).toMatchObject({ status: 'converted', gameCard: { type: 'cookie', name: 'Cream Ferret Cookie', level: 1, hp: 2, attack: 1, energyColor: 'green', keywords: ['arena'], attackEnergyCost: { green: 1 }, imageUrl: record.imageUrl,
    attackEffects: [{ kind: 'support-to-battle', amount: 1, optional: true, keyword: 'arena' }],
  } })
  if (converted.status !== 'converted' || converted.gameCard.type !== 'cookie') throw new Error('Missing Cream Ferret')
  const card = converted.gameCard
  expect(card.skill).toBeUndefined()
  expect(card.attackEffects).toHaveLength(1)
  expect(analyzeOfficialCardBehavior(record).contract.status).toBe('verified')
  for (const patch of [{ keyword: undefined }, { optional: false }, { amount: 2 }, { energyColor: 'green' as const }, { maxLevel: 1 }]) {
    expect(analyzeOfficialCardBehavior(record, { ...card, attackEffects: [{ ...card.attackEffects![0], ...patch }] }).contract.status).not.toBe('verified')
  }
})
