import { expect, it } from 'vitest'
import candidate from '../../data/candidates/official-festival-arena-bs12.en.json'
import type { OfficialCardRecord } from './types'
import { convertOfficialCardToGameCard } from './official-card-adapter'
import { analyzeOfficialCardBehavior } from './contracts/ledger'

it('BS12-057 pays one same blue AND Arena hand card before optionally placing one opponent LV2-or-lower Cookie on their deck bottom', () => {
  const record = candidate.cards.find(c => c.cardNumber === 'BS12-057') as OfficialCardRecord
  const converted = convertOfficialCardToGameCard(record)
  expect(converted).toMatchObject({ status: 'converted', gameCard: {
    type: 'cookie', name: 'Marbleberry Cookie', energyColor: 'blue', keywords: ['arena'], level: 2, hp: 4,
    attack: 2, attackEnergyCost: { blue: 2, neutral: 1 }, imageUrl: record.imageUrl,
    skill: { trigger: 'on-play', oncePerTurn: false, yourTurn: false, restSource: false,
      cost: { energy: {}, discardHand: 1, discardHandColor: 'blue', discardHandKeyword: 'arena' },
      effects: [{ kind: 'field-to-deck-bottom', target: { side: 'opponent', min: 0, max: 1, maxLevel: 2 } }] },
  } })
  if (converted.status !== 'converted' || converted.gameCard.type !== 'cookie') throw new Error('Missing Marbleberry')
  const card = converted.gameCard
  expect(card.attackEffects ?? []).toEqual([])
  expect(card.skill?.effects).toHaveLength(1)
  expect(card.skill?.fromSupportArea).not.toBe(true)
  expect(card.skill?.fromBreakArea).not.toBe(true)
  expect(card.skill?.fromTrashArea).not.toBe(true)
  expect(analyzeOfficialCardBehavior(record).contract.status).toBe('verified')
})
