import type { OfficialCardRecord } from '../cards/types'
import { fixture as muscleFixture, zones } from './st8-002-demo'
import { getCardPoolEntry } from './card-pool'
import { createCard } from './starter-deck'
import { applyGameCommand } from './commands'
import type { GameState } from './types'

export const raw = getCardPoolEntry('ST8-004') as OfficialCardRecord
if (!raw) throw Error('Original ST8-004 required')

/** Original HP5 source and physical resources; no candidate route is registered here. */
export const fixture = (scenario = 'positive'): GameState => {
  if (scenario.startsWith('ai-')) return JSON.parse(JSON.stringify(fixture(scenario.slice(3)))
    .replaceAll('player-one', 'player-swap').replaceAll('player-two', 'player-one').replaceAll('player-swap', 'player-two')) as GameState
  let state = muscleFixture('attack')
  const own = state.players['player-one'], foe = state.players['player-two']
  const source = createCard(raw, 'player-one', 1)
  if (source.type !== 'cookie') throw Error('Original Cookie required')
  const hp = own.deck.shift()
  if (!hp) throw Error('Physical fifth HP required')
  own.battleArea[0] = {
    ...own.battleArea[0], card: source, battleEntryId: source.instanceId + ':entry',
    hpCards: [...own.battleArea[0].hpCards, hp],
  }
  const count = scenario === 'three' ? 3 : ['four', 'opponent-five'].includes(scenario) ? 4 : scenario === 'six' ? 6 : 5
  while (own.supportArea.length < count) {
    const card = own.deck.shift()
    if (!card) throw Error('Physical support required')
    own.supportArea.push({ card, rested: scenario !== 'already-active' })
  }
  if (scenario === 'opponent-five') foe.supportArea = foe.deck.splice(0, 5).map(card => ({ card, rested: false }))
  if (scenario === 'rested-energy') own.supportArea[2].rested = true
  if (scenario === 'wrong-color') {
    const index = own.deck.findIndex(card => card.energyColor !== 'green')
    if (index < 0) throw Error('Physical non-green support required')
    const original = own.supportArea[2].card
    own.supportArea[2].card = own.deck[index]
    own.deck[index] = original
  }
  if (scenario === 'rested-source') own.battleArea[0].rested = true
  if (scenario === 'wrong-phase') state.phase = 'support'
  if (scenario === 'first-turn') state.turnNumber = 1
  if (scenario === 'play') {
    const source = own.battleArea.shift()
    if (!source) throw Error('Original source required')
    own.hand.push(source.card)
    own.deck.push(...source.hpCards)
  }
  if (scenario === 'target-faints') {
    const record = getCardPoolEntry('ST1-005')
    if (!record) throw Error('Original Leek required')
    const card = createCard(record, 'player-two', 1)
    if (card.type !== 'cookie') throw Error('Original Cookie required')
    const target = foe.battleArea[0]
    foe.deck.push(...target.hpCards.splice(card.hp))
    foe.battleArea[0] = { ...target, card, battleEntryId: card.instanceId + ':entry' }
  }
  if (scenario === 'source-faints') {
    const kumiho = getCardPoolEntry('BS1-002')
    if (!kumiho) throw Error('Original Kumiho required')
    foe.supportArea = foe.deck.splice(0, 3).map(card => ({ card, rested: false }))
    const cost = foe.deck.shift()
    if (!cost) throw Error('Physical hand cost required')
    foe.hand = [cost]
    foe.battleArea[0].hpCards[foe.battleArea[0].hpCards.length - 1] = createCard(kumiho, 'player-two', 1)
    state.activePlayerId = 'player-two'
  }
  for (const id of ['player-one', 'player-two'] as const) {
    const cards = zones(state, id)
    if (cards.length !== 60 || new Set(cards.map(card => card.instanceId)).size !== 60) throw Error('Sixty original identities required')
    for (const card of cards) if (cards.filter(other => other.id === card.id).length > 4) throw Error('Four-copy limit')
  }
  if (scenario === 'source-faints') {
    state = applyGameCommand(state, {
      kind: 'declare-attack', playerId: 'player-two', attackerInstanceId: foe.battleArea[0].card.instanceId,
      targetInstanceId: source.instanceId, supportPaymentIds: foe.supportArea.map(support => support.card.instanceId),
    })
    state = applyGameCommand(state, { kind: 'skip-trap', playerId: 'player-one' })
    state = applyGameCommand(state, { kind: 'resolve-battle', playerId: 'player-two' })
    for (let i = 0; i < 10 && !(state.activePlayerId === 'player-one' && state.phase === 'main'); i++) {
      state = applyGameCommand(state, { kind: 'advance-phase', playerId: state.activePlayerId })
    }
    if (state.players['player-one'].battleArea[0].hpCards.length !== 1 || state.phase !== 'main' || state.activePlayerId !== 'player-one') throw Error('Real four-damage parent sequence required')
  }
  return state
}

export const declare = (state: GameState) => applyGameCommand(state, {
  kind: 'declare-attack', playerId: 'player-one',
  attackerInstanceId: state.players['player-one'].battleArea[0].card.instanceId,
  targetInstanceId: state.players['player-two'].battleArea[0].card.instanceId,
  supportPaymentIds: state.players['player-one'].supportArea.slice(0, 3).map(support => support.card.instanceId),
})

export const openThen = (scenario = 'positive') => {
  let state = declare(fixture(scenario))
  state = applyGameCommand(state, { kind: 'skip-trap', playerId: 'player-two' })
  for (let i = 0; i < 3; i++) state = applyGameCommand(state, { kind: 'resolve-next-damage', playerId: 'player-two' })
  return state
}
