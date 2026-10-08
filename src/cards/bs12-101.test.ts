import {expect, it} from 'vitest'
import candidate from '../../data/cards/official-festival-arena-bs12.en.json'
import type {OfficialCardRecord} from './types'
import {convertOfficialCardToGameCard} from './official-card-adapter'
import {analyzeOfficialCardBehavior} from './contracts/ledger'

const record = candidate.cards.find(card => card.cardNumber === 'BS12-101') as OfficialCardRecord
const error = 'BS12-101 lacks black Arena LV1 HP2, K1 ordinary one and optional one Arena Cookie hand discard before drawing up to one'

it('101 preserves printed K1 ordinary one then optional one Arena Cookie hand discard before drawing up to one', () => {
  const before = structuredClone(record)
  const result = convertOfficialCardToGameCard(record)
  expect(result).toMatchObject({status: 'converted', gameCard: {
    id: 'BS12-101', name: 'Chess Choco Cookie', type: 'cookie', cardColor: 'black', energyColor: 'black',
    level: 1, hp: 2, attack: 1, attackCost: 1, attackEnergyCost: {black: 1}, keywords: ['arena'],
    attackEffects: [{kind: 'optional-cost-attack', cost: {energy: {}, discardHand: 1, discardHandType: 'cookie', discardHandKeyword: 'arena'},
      effects: [{kind: 'draw-up-to', max: 1}]}],
  }})
  if (result.status !== 'converted' || result.gameCard.type !== 'cookie') throw new Error('Missing Chess Choco Cookie')
  const card = result.gameCard, then = card.attackEffects?.[0]
  expect(card.skill).toBeUndefined()
  expect(card.flip).toBeUndefined()
  expect(card.extraDeckOrigin).toBeUndefined()
  expect(card.attackEffects).toHaveLength(1)
  if (then?.kind !== 'optional-cost-attack') throw new Error('Missing printed attack Then')
  expect(then.resolution ?? 'attack').toBe('attack')
  expect(then.mandatory).not.toBe(true)
  expect(then.effectText).toContain('discard 1')
  expect(card.imageUrl).toBe('https://cookierunbraverse.com/data/en_storage/IkY8l2B-wbOFc3gdIXuH_A.webp')
  expect(analyzeOfficialCardBehavior(record).contract.status).toBe('verified')
  expect(record).toEqual(before)
})

it.each(['level', 'hp', 'damage', 'attack-total', 'neutral-attack', 'red-card', 'no-arena', 'skill', 'flip', 'extra',
  'no-then', 'second-then', 'ability', 'mandatory', 'pay-before-condition', 'no-hand', 'two-hand', 'no-cookie', 'no-arena-cost',
  'black-hand', 'lv1-hand', 'non-cookie-hand', 'deck-bottom', 'energy', 'support', 'mill', 'no-draw', 'draw-two',
  'fixed-draw', 'condition', 'until-hand', 'extra-effect'] as const)('101 strict rejects runtime semantic mutation: %s', mutation => {
  const result = convertOfficialCardToGameCard(record)
  if (result.status !== 'converted' || result.gameCard.type !== 'cookie') throw new Error('Missing Chess Choco Cookie')
  const card = structuredClone(result.gameCard), then = card.attackEffects?.[0]
  if (then?.kind !== 'optional-cost-attack' || then.effects[0]?.kind !== 'draw-up-to') throw new Error('Missing printed Then')
  const draw = then.effects[0]
  if (mutation === 'level') card.level = 2
  if (mutation === 'hp') card.hp = 3
  if (mutation === 'damage') card.attack = 2
  if (mutation === 'attack-total') card.attackCost = 2
  if (mutation === 'neutral-attack') card.attackEnergyCost = {neutral: 1}
  if (mutation === 'red-card') card.energyColor = 'red'
  if (mutation === 'no-arena') card.keywords = []
  if (mutation === 'skill') card.skill = {trigger: 'activate', oncePerTurn: false, yourTurn: false, restSource: false, text: 'Unprinted skill', cost: {energy: {}, discardHand: 0}, effects: [{kind: 'draw', amount: 1}]}
  if (mutation === 'flip') card.flip = {cost: {energy: {}, discardHand: 0}, effects: [{kind: 'draw', amount: 1}], text: 'Unprinted FLIP'}
  if (mutation === 'extra') card.extraDeckOrigin = 'extra'
  if (mutation === 'no-then') card.attackEffects = []
  if (mutation === 'second-then') card.attackEffects!.push(structuredClone(then))
  if (mutation === 'ability') then.resolution = 'ability'
  if (mutation === 'mandatory') then.mandatory = true
  if (mutation === 'pay-before-condition') then.payBeforeCondition = true
  if (mutation === 'no-hand') then.cost.discardHand = 0
  if (mutation === 'two-hand') then.cost.discardHand = 2
  if (mutation === 'no-cookie') then.cost.discardHandType = undefined
  if (mutation === 'no-arena-cost') then.cost.discardHandKeyword = undefined
  if (mutation === 'black-hand') then.cost.discardHandColor = 'black'
  if (mutation === 'lv1-hand') then.cost.discardHandLevel = 1
  if (mutation === 'non-cookie-hand') then.cost.discardHandNonCookie = true
  if (mutation === 'deck-bottom') then.cost.handCostDestination = 'deck-bottom'
  if (mutation === 'energy') then.cost.energy = {black: 1}
  if (mutation === 'support') then.cost.supportToTrash = 1
  if (mutation === 'mill') then.cost.deckToTrash = {amount: 1}
  if (mutation === 'no-draw') then.effects = []
  if (mutation === 'draw-two') draw.max = 2
  if (mutation === 'fixed-draw') then.effects = [{kind: 'draw', amount: 1}]
  if (mutation === 'condition') draw.condition = {kind: 'hand-count-at-most', count: 5}
  if (mutation === 'until-hand') draw.untilHandSize = 5
  if (mutation === 'extra-effect') then.effects.push({kind: 'draw', amount: 1})
  const contract = analyzeOfficialCardBehavior(record, card).contract
  expect(contract.status).not.toBe('verified')
  expect(contract.blockers).toContain(error)
})
