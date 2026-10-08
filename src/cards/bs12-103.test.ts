import {expect, it} from 'vitest'
import candidate from '../../data/cards/official-festival-arena-bs12.en.json'
import type {OfficialCardRecord} from './types'
import {convertOfficialCardToGameCard} from './official-card-adapter'
import {analyzeOfficialCardBehavior} from './contracts/ledger'

const record = candidate.cards.find(card => card.cardNumber === 'BS12-103') as OfficialCardRecord
const error = 'BS12-103 lacks black Arena K1 Item, four own top cards, optional revealed black Arena card to hand or all unchosen cards to trash'

it('103 pays K1, views four, reveals zero or one black Arena card to hand and trashes every unchosen viewed card', () => {
  const snapshot = structuredClone(record)
  const result = convertOfficialCardToGameCard(record)
  expect(result).toMatchObject({status: 'converted', gameCard: {
    id: 'BS12-103', name: "Veteran Director's Sunglasses", type: 'item', cardColor: 'black', energyColor: 'black', keywords: ['arena'],
    item: {cost: {energy: {black: 1}, discardHand: 0}, effects: [{kind: 'inspect-deck', lookCount: 4, pickCount: 1,
      filterColor: 'black', filterKeyword: 'arena', optionalPick: true, revealPicked: true, restDestination: 'trash'}]},
    imageUrl: 'https://cookierunbraverse.com/data/en_storage/oU9pVxKaR909FITaO-837A.webp',
  }})
  expect(analyzeOfficialCardBehavior(record).contract.status).toBe('verified')
  expect(record).toEqual(snapshot)
})

it.each(['name', 'color', 'energy-color', 'arena', 'no-item', 'free', 'wrong-energy', 'extra-energy', 'discard', 'mill', 'hp-cost',
  'source-energy', 'override', 'equipment', 'inactive', 'no-effect', 'extra-effect', 'look-three', 'look-five', 'pick-zero', 'pick-two',
  'required', 'no-reveal', 'no-black', 'wrong-black', 'no-arena', 'wrong-keyword', 'cookie-only', 'item-only', 'special-only',
  'opponent-deck', 'battle-destination', 'support-destination', 'bottom', 'top', 'rested-support', 'extra-hp', 'condition'] as const)(
  '103 strict rejects a runtime semantic mutation: %s', mutation => {
    const result = convertOfficialCardToGameCard(record)
    if (result.status !== 'converted' || !result.gameCard.item) throw new Error('Missing Sunglasses Item')
    const card = structuredClone(result.gameCard), ability = card.item!, effect = ability.effects[0]
    if (effect.kind !== 'inspect-deck') throw new Error('Missing printed inspection')
    if (mutation === 'name') card.name = 'Wrong Item'
    if (mutation === 'color') card.cardColor = 'purple'
    if (mutation === 'energy-color') card.energyColor = 'red'
    if (mutation === 'arena') card.keywords = []
    if (mutation === 'no-item') card.item = undefined
    if (mutation === 'free') ability.cost.energy = {}
    if (mutation === 'wrong-energy') ability.cost.energy = {purple: 1}
    if (mutation === 'extra-energy') ability.cost.energy = {black: 1, neutral: 1}
    if (mutation === 'discard') ability.cost.discardHand = 1
    if (mutation === 'mill') ability.cost.deckToTrash = {amount: 1}
    if (mutation === 'hp-cost') ability.cost.hpToTrash = {amount: 1}
    if (mutation === 'source-energy') ability.sourceEnergy = {black: 1}
    if (mutation === 'override') ability.activationCostOverride = {condition: 'friendly-cookie-fainted-this-turn', cost: {energy: {}}}
    if (mutation === 'equipment') ability.equippedAttackEffects = [{kind: 'draw', amount: 1}]
    if (mutation === 'inactive') ability.allowInactiveConditionalEffects = true
    if (mutation === 'no-effect') ability.effects = []
    if (mutation === 'extra-effect') ability.effects.push({kind: 'draw', amount: 1})
    if (mutation === 'look-three') effect.lookCount = 3
    if (mutation === 'look-five') effect.lookCount = 5
    if (mutation === 'pick-zero') effect.pickCount = 0
    if (mutation === 'pick-two') effect.pickCount = 2
    if (mutation === 'required') effect.optionalPick = false
    if (mutation === 'no-reveal') effect.revealPicked = false
    if (mutation === 'no-black') effect.filterColor = undefined
    if (mutation === 'wrong-black') effect.filterColor = 'red'
    if (mutation === 'no-arena') effect.filterKeyword = undefined
    if (mutation === 'wrong-keyword') effect.filterKeyword = 'ancient'
    if (mutation === 'cookie-only') effect.filterType = 'cookie'
    if (mutation === 'item-only') effect.filterType = 'item'
    if (mutation === 'special-only') effect.filterHasSpecialPlay = true
    if (mutation === 'opponent-deck') effect.side = 'opponent'
    if (mutation === 'battle-destination') effect.pickDestination = 'battle'
    if (mutation === 'support-destination') effect.pickDestination = 'support'
    if (mutation === 'bottom') effect.restDestination = 'bottom'
    if (mutation === 'top') effect.restDestination = 'top'
    if (mutation === 'rested-support') effect.restDestination = 'support-rested'
    if (mutation === 'extra-hp') effect.extraHp = 1
    if (mutation === 'condition') effect.condition = {kind: 'hand-count-at-most', count: 5}
    expect(analyzeOfficialCardBehavior(record, card).errors).toContain(error)
  },
)
