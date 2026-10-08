import { expect, it } from 'vitest'
import candidate from '../../data/cards/official-festival-arena-bs12.en.json'
import type { OfficialCardRecord } from './types'
import { convertOfficialCardToGameCard } from './official-card-adapter'
import { analyzeOfficialCardBehavior } from './contracts/ledger'

const record = candidate.cards.find(card => card.cardNumber === 'BS12-094') as OfficialCardRecord
const error = 'BS12-094 lacks black Arena LV3 HP4, neutral-three ordinary four or invents an unprinted ability'
const converted = () => {
  const result = convertOfficialCardToGameCard(record)
  if (result.status !== 'converted' || result.gameCard.type !== 'cookie') throw new Error('Missing Butter Roll Cookie')
  return result.gameCard
}

it('094 preserves the independent full-image NNN ordinary four and no skill, FLIP or Then', () => {
  const before = structuredClone(record)
  const card = converted()
  expect(card).toMatchObject({ id: 'BS12-094', name: 'Butter Roll Cookie', type: 'cookie', cardColor: 'black', energyColor: 'black',
    level: 3, hp: 4, attack: 4, attackCost: 3, attackEnergyCost: { neutral: 3 }, keywords: ['arena'],
    attackText: '<{N}{N}{N}> Securing Samples {da} 4', imageUrl: 'https://cookierunbraverse.com/data/en_storage/-86_QbdMksRgUT5trnjRHQ.webp' })
  expect(card.skill).toBeUndefined()
  expect(card.flip).toBeUndefined()
  expect(card.extraDeckOrigin).toBeUndefined()
  expect(card.effects ?? []).toEqual([])
  expect(card.attackEffects ?? []).toEqual([])
  expect(analyzeOfficialCardBehavior(record).contract.status).toBe('verified')
  expect(record).toEqual(before)
})

it.each(['level', 'hp', 'damage', 'cost-total', 'underpay', 'black-cost', 'extra-energy', 'no-arena', 'extra-keyword',
  'energy-color', 'card-color', 'skill', 'flip', 'then', 'effect', 'extra-origin'] as const)('094 strict rejects actual runtime mutation: %s', mutation => {
  const card = structuredClone(converted())
  if (mutation === 'level') card.level = 2
  if (mutation === 'hp') card.hp = 3
  if (mutation === 'damage') card.attack = 3
  if (mutation === 'cost-total') card.attackCost = 2
  if (mutation === 'underpay') card.attackEnergyCost = { neutral: 2 }
  if (mutation === 'black-cost') card.attackEnergyCost = { black: 3 }
  if (mutation === 'extra-energy') card.attackEnergyCost = { neutral: 3, red: 1 }
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
