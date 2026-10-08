import { expect, it } from 'vitest'
import candidate from '../../data/candidates/official-festival-arena-bs12.en.json'
import type { OfficialCardRecord } from './types'
import { convertOfficialCardToGameCard } from './official-card-adapter'
import { analyzeOfficialCardBehavior } from './contracts/ledger'

it.each(['BS12-058', 'BS12-058@1'])('%s preserves the printed B/1 and reveal one Arena hand card to deck bottom before drawing up to two', number => {
  const record = candidate.cards.find(c => c.cardNumber === number) as OfficialCardRecord
  const snapshot = structuredClone(record)
  const converted = convertOfficialCardToGameCard(record)
  expect(converted).toMatchObject({ status: 'converted', gameCard: {
    type: 'cookie', name: 'Peppermint Cookie', energyColor: 'blue', keywords: ['arena'], level: 1, hp: 1,
    attack: 1, attackEnergyCost: { blue: 1 }, imageUrl: record.imageUrl,
    flip: { cost: { energy: {}, discardHand: 1, discardHandKeyword: 'arena' }, handCostDestination: 'deck-bottom',
      effects: [{ kind: 'draw-up-to', max: 2 }] },
  } })
  if (converted.status !== 'converted' || converted.gameCard.type !== 'cookie') throw new Error('Missing Peppermint')
  expect(converted.gameCard.skill).toBeUndefined()
  expect(converted.gameCard.attackEffects ?? []).toEqual([])
  expect(converted.gameCard.flip?.effects).toHaveLength(1)
  expect(analyzeOfficialCardBehavior(record).contract.status).toBe('verified')
  expect(record).toEqual(snapshot)
})
