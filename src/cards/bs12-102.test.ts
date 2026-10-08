import { expect, it } from 'vitest'
import candidate from '../../data/candidates/official-festival-arena-bs12.en.json'
import type { OfficialCardRecord } from './types'
import { convertOfficialCardToGameCard } from './official-card-adapter'
import { analyzeOfficialCardBehavior } from './contracts/ledger'

const record = candidate.cards.find(card => card.cardNumber === 'BS12-102') as OfficialCardRecord
const error = 'BS12-102 lacks black Arena Stage, K placement, K plus source REST activation or up to one own trash Arena Cookie with Special Play recovery'

it('102 separates black placement from black plus source REST and recovers up to one own trash Arena Cookie with Special Play', () => {
  const before = structuredClone(record)
  const result = convertOfficialCardToGameCard(record)
  expect(result).toMatchObject({ status: 'converted', gameCard: {
    id: 'BS12-102', name: "Manager Scarlet's Coffee Truck", type: 'stage', cardColor: 'black', energyColor: 'black', keywords: ['arena'],
    stageAbility: { placementCost: { black: 1 }, cost: { energy: { black: 1 }, discardHand: 0 }, restSource: true,
      effects: [{ kind: 'trash-to-hand', max: 1, cookieOnly: true, keyword: 'arena', hasSpecialPlay: true }] },
  } })
  if (result.status !== 'converted' || result.gameCard.type !== 'stage') throw new Error('Missing Coffee Truck')
  expect(result.gameCard.stageAbility?.oncePerTurn).toBeUndefined()
  expect(result.gameCard.imageUrl).toBe('https://cookierunbraverse.com/data/en_storage/KQuJ75nwlt_XV9srpo1_Xw.webp')
  expect(analyzeOfficialCardBehavior(record).contract.status).toBe('verified')
  expect(record).toEqual(before)
})

it.each(['name', 'color', 'energy-color', 'arena', 'no-ability', 'placement-free', 'placement-wrong', 'placement-extra',
  'activation-free', 'activation-wrong', 'activation-extra', 'discard', 'mill', 'REST', 'once', 'end-phase', 'trigger', 'owner',
  'source-energy', 'cost-override', 'no-recovery', 'two-recovery', 'not-cookie', 'no-arena', 'no-special', 'color-only',
  'max-level', 'min-level', 'name-only', 'names-only', 'same-name-excluded', 'blocker', 'flip-only', 'condition', 'extra-effect'] as const)('102 strict rejects runtime semantic mutation: %s', mutation => {
    const result = convertOfficialCardToGameCard(record)
    if (result.status !== 'converted' || result.gameCard.type !== 'stage') throw new Error('Missing Coffee Truck')
    const card = structuredClone(result.gameCard), ability = card.stageAbility!, recovery = ability.effects[0]
    if (recovery.kind !== 'trash-to-hand') throw new Error('Missing printed recovery')
    if (mutation === 'name') card.name = 'Wrong Stage'
    if (mutation === 'color') card.cardColor = 'red'
    if (mutation === 'energy-color') card.energyColor = 'red'
    if (mutation === 'arena') card.keywords = []
    if (mutation === 'no-ability') card.stageAbility = undefined
    if (mutation === 'placement-free') ability.placementCost = {}
    if (mutation === 'placement-wrong') ability.placementCost = { red: 1 }
    if (mutation === 'placement-extra') ability.placementCost = { black: 1, neutral: 1 }
    if (mutation === 'activation-free') ability.cost.energy = {}
    if (mutation === 'activation-wrong') ability.cost.energy = { red: 1 }
    if (mutation === 'activation-extra') ability.cost.energy = { black: 1, neutral: 1 }
    if (mutation === 'discard') ability.cost.discardHand = 1
    if (mutation === 'mill') ability.cost.deckToTrash = { amount: 1 }
    if (mutation === 'REST') ability.restSource = false
    if (mutation === 'once') ability.oncePerTurn = true
    if (mutation === 'end-phase') ability.endPhase = true
    if (mutation === 'trigger') ability.triggered = true
    if (mutation === 'owner') ability.ownerIndependent = true
    if (mutation === 'source-energy') ability.sourceEnergy = { black: 1 }
    if (mutation === 'cost-override') ability.activationCostOverride = { condition: 'friendly-cookie-fainted-this-turn', cost: { energy: {} } }
    if (mutation === 'no-recovery') ability.effects = []
    if (mutation === 'two-recovery') recovery.max = 2
    if (mutation === 'not-cookie') recovery.cookieOnly = false
    if (mutation === 'no-arena') recovery.keyword = undefined
    if (mutation === 'no-special') recovery.hasSpecialPlay = false
    if (mutation === 'color-only') recovery.energyColor = 'black'
    if (mutation === 'max-level') recovery.maxLevel = 1
    if (mutation === 'min-level') recovery.minLevel = 1
    if (mutation === 'name-only') recovery.cardName = 'Strategist Cake Hound'
    if (mutation === 'names-only') recovery.cardNames = ['Strategist Cake Hound']
    if (mutation === 'same-name-excluded') recovery.excludeCardName = 'Strategist Cake Hound'
    if (mutation === 'blocker') recovery.blockerOnly = true
    if (mutation === 'flip-only') recovery.hasFlip = true
    if (mutation === 'condition') recovery.condition = { kind: 'hand-count-at-most', count: 5 }
    if (mutation === 'extra-effect') ability.effects.push({ kind: 'draw', amount: 1 })
    expect(analyzeOfficialCardBehavior(record, card).errors).toContain(error)
  })
