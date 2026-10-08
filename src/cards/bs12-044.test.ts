import { expect, it } from 'vitest'
import candidate from '../../data/candidates/official-festival-arena-bs12.en.json'
import type { OfficialCardRecord } from './types'
import { convertOfficialCardToGameCard } from './official-card-adapter'
import { analyzeOfficialCardBehavior } from './contracts/ledger'

it('044 only readies a support after Herb Cookie was played by its optional support entry', () => {
  const record = candidate.cards.find(card => card.cardNumber === 'BS12-044') as OfficialCardRecord
  const before = structuredClone(record)
  const converted = convertOfficialCardToGameCard(record)
  expect(converted).toMatchObject({ status: 'converted', gameCard: {
    id: 'BS12-044', name: 'Herb Teapot', energyColor: 'green', level: 1, hp: 2, attack: 2,
    attackCost: 2, attackEnergyCost: { green: 2 }, keywords: ['arena'],
    attackText: '<{G}{G}> Sprinkle Water {da} 2',
    skill: { trigger: 'activate', oncePerTurn: true, cost: { energy: {}, discardHand: 0 }, effects: [
      { kind: 'support-to-battle', amount: 1, optional: true, keyword: 'arena', thenEffects: [
        { kind: 'set-active', supportCount: 1, selectable: true, optional: true, restedOnly: false,
          condition: { kind: 'previous-effect-target-card-name', cardName: 'Herb Cookie' } },
      ] },
    ] },
  } })
  if (converted.status !== 'converted' || converted.gameCard.type !== 'cookie') throw new Error('Missing Herb Teapot')
  expect(converted.gameCard.skill?.yourTurn).not.toBe(true)
  expect(converted.gameCard.skill?.restSource).not.toBe(true)
  expect(converted.gameCard.attackEffects).toBeUndefined()
  expect(converted.gameCard.skill?.effects).toHaveLength(1)
  expect(analyzeOfficialCardBehavior(record).contract.status).toBe('verified')
  expect(record).toEqual(before)
})
