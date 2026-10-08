import { expect, it } from 'vitest'
import candidate from '../../data/cards/official-festival-arena-bs12.en.json'
import type { OfficialCardRecord } from './types'
import { convertOfficialCardToGameCard } from './official-card-adapter'
import { analyzeOfficialCardBehavior } from './contracts/ledger'

const record = candidate.cards.find(card => card.cardNumber === 'BS12-097') as OfficialCardRecord
const error = 'BS12-097 lacks black Arena LV1 HP2, neutral-one ordinary one or invents an unprinted ability'
const converted = () => {
  const result = convertOfficialCardToGameCard(record)
  if (result.status !== 'converted' || result.gameCard.type !== 'cookie') throw new Error('Missing Subtle Jasmine Cake Hound')
  return result.gameCard
}

it('097 preserves the independent full-image N ordinary one and no skill, FLIP or Then', () => {
  const before = structuredClone(record)
  const card = converted()
  expect(card).toMatchObject({ id: 'BS12-097', name: 'Subtle Jasmine Cake Hound', type: 'cookie', cardColor: 'black', energyColor: 'black',
    level: 1, hp: 2, attack: 1, attackCost: 1, attackEnergyCost: { neutral: 1 }, keywords: ['arena'],
    attackText: '<{N}> Rolling in Grass {da} 1', imageUrl: 'https://cookierunbraverse.com/data/en_storage/KC3zzsplFg3QBkxkl4yeJg.webp' })
  expect(card.skill).toBeUndefined()
  expect(card.flip).toBeUndefined()
  expect(card.extraDeckOrigin).toBeUndefined()
  expect(card.effects ?? []).toEqual([])
  expect(card.attackEffects ?? []).toEqual([])
  expect(analyzeOfficialCardBehavior(record).contract.status).toBe('verified')
  expect(record).toEqual(before)
})

it.each(['level', 'hp', 'damage', 'cost-total', 'underpay', 'black-cost', 'extra-energy', 'no-arena', 'extra-keyword',
  'energy-color', 'card-color', 'skill', 'flip', 'then', 'effect', 'extra-origin'] as const)('097 strict rejects actual runtime mutation: %s', mutation => {
  const card = structuredClone(converted())
  if (mutation === 'level') card.level = 2
  if (mutation === 'hp') card.hp = 3
  if (mutation === 'damage') card.attack = 2
  if (mutation === 'cost-total') card.attackCost = 0
  if (mutation === 'underpay') card.attackEnergyCost = { neutral: 0 }
  if (mutation === 'black-cost') card.attackEnergyCost = { black: 1 }
  if (mutation === 'extra-energy') card.attackEnergyCost = { neutral: 1, red: 1 }
  if (mutation === 'no-arena') card.keywords = []
  if (mutation === 'extra-keyword') card.keywords = ['arena', 'ancient']
  if (mutation === 'energy-color') card.energyColor = 'purple'
  if (mutation === 'card-color') card.cardColor = 'purple'
  if (mutation === 'skill') card.skill = { trigger: 'activate', oncePerTurn: false, restSource: false, yourTurn: false, text: 'Unprinted ability', cost: { energy: {}, discardHand: 0 }, effects: [{ kind: 'draw-up-to', max: 1 }] }
  if (mutation === 'flip') card.flip = { text: 'Unprinted FLIP', cost: { energy: {}, discardHand: 0 }, effects: [{ kind: 'draw-up-to', max: 1 }] }
  if (mutation === 'then') card.attackEffects = [{ kind: 'damage', amount: 1, target: { side: 'opponent', min: 0, max: 1 } }]
  if (mutation === 'effect') card.effects = [{ kind: 'draw-up-to', max: 1 }]
  if (mutation === 'extra-origin') card.extraDeckOrigin = 'extra'
  expect(analyzeOfficialCardBehavior(record, card).errors).toContain(error)
})
