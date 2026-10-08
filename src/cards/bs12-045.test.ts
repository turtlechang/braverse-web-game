import { expect, it } from 'vitest'
import candidate from '../../data/cards/official-festival-arena-bs12.en.json'
import type { OfficialCardRecord } from './types'
import { convertOfficialCardToGameCard } from './official-card-adapter'
import { analyzeOfficialCardBehavior } from './contracts/ledger'

it('045 counts all five own supports for a free On Play draw and prints GN2', () => {
  const record = candidate.cards.find(card => card.cardNumber === 'BS12-045') as OfficialCardRecord
  const snapshot = structuredClone(record)
  const converted = convertOfficialCardToGameCard(record)
  expect(converted).toMatchObject({ status: 'converted', gameCard: {
    name: 'Clover Cookie', energyColor: 'green', level: 1, hp: 2, attack: 2,
    attackCost: 2, attackEnergyCost: { green: 1, neutral: 1 }, keywords: ['arena'],
    attackText: '<{G}{N}> Small Melody {da} 2',
    skill: { trigger: 'on-play', cost: { energy: {}, discardHand: 0 }, effects: [
      { kind: 'draw-up-to', max: 1, condition: { kind: 'support-count-at-least', count: 5 } },
    ] },
  } })
  if (converted.status !== 'converted' || converted.gameCard.type !== 'cookie') throw new Error('Missing Clover')
  expect(converted.gameCard.skill?.yourTurn).not.toBe(true)
  expect(converted.gameCard.skill?.oncePerTurn).not.toBe(true)
  expect(converted.gameCard.skill?.restSource).not.toBe(true)
  expect(converted.gameCard.attackEffects).toBeUndefined()
  expect(converted.gameCard.skill?.effects).toHaveLength(1)
  expect(analyzeOfficialCardBehavior(record).contract.status).toBe('verified')
  expect(record).toEqual(snapshot)
})
