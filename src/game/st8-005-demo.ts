import type { OfficialCardRecord } from '../cards/types'
import { zones } from './st8-002-demo'
import { getAllCardPoolEntries, getCardPoolEntry } from './card-pool'
import { createCard, createOfficialRedStarterDeck } from './starter-deck'
import { createGame } from './setup'
import { applyGameCommand } from './commands'
import { getActingPlayerId } from './controller'
import { takeAiStep } from './ai'
import type { CookieInBattle, GameCard, GameState, PlayerId } from './types'

export const raw = getCardPoolEntry('ST8-005') as OfficialCardRecord
if (!raw) throw Error('Original ST8-005 required')

// Build only the original resources this fixture needs. Calling the general
// FLIP catalogue here would convert the entire live pool before the first case.
const base = (): GameState => {
  const counts = new Map<string, number>()
  const card = (record: OfficialCardRecord, owner: PlayerId): GameCard => {
    const key = owner + ':' + record.cardNumber, copy = (counts.get(key) ?? 0) + 1
    if (copy > 4) throw Error('Original four-copy limit')
    counts.set(key, copy)
    return createCard(record, owner, copy)
  }
  const original = (number: string, owner: PlayerId) => {
    const record = number === 'ST8-005' ? raw : getCardPoolEntry(number)
    if (!record) throw Error('Original resource required: ' + number)
    return card(record, owner)
  }
  const filler = (count: number, owner: PlayerId) => {
    const result: GameCard[] = []
    if (count === 0) return result
    for (const record of getAllCardPoolEntries()) {
      if (record.variant || record.type === 'extra' || record.type === 'flip' || record.flipText ||
        (counts.get(owner + ':' + record.cardNumber) ?? 0) >= 4) continue
      const next = card(record, owner)
      if (next.type === 'cookie' && next.flip) continue
      result.push(next)
      if (result.length === count) return result
    }
    throw Error('Original non-FLIP filler required')
  }
  const battle = (number: string, owner: PlayerId): CookieInBattle => {
    const source = original(number, owner)
    if (source.type !== 'cookie') throw Error('Original Cookie required')
    return { card: source, hpCards: filler(source.hp, owner), rested: false, battleEntryId: source.instanceId + ':entry' }
  }
  const state = createGame({ id: 'player-one', name: 'ST8-005 實體驗收', deck: createOfficialRedStarterDeck('player-one') },
    { id: 'player-two', name: '實體對手', deck: createOfficialRedStarterDeck('player-two') }, 'player-one', cards => cards)
  state.status = 'playing'; state.phase = 'main'; state.turnNumber = 3
  for (const player of Object.values(state.players)) {
    player.deck = []; player.hand = []; player.supportArea = []; player.breakArea = []; player.discardPile = []
    player.battleArea = []; player.stage = null; player.startingCookieSelected = true
  }
  state.players['player-one'].battleArea = [battle('ST8-005', 'player-one'), battle('ST1-011', 'player-one')]
  state.players['player-two'].battleArea = [battle('BS12-059', 'player-two')]
  state.players['player-one'].supportArea = ['ST3-016', 'ST3-019', 'ST3-020'].map(number => ({ card: original(number, 'player-one'), rested: false }))
  for (const id of ['player-one', 'player-two'] as const) state.players[id].deck.push(...filler(60 - zones(state, id).length, id))
  return state
}

/** Original HP6 source and sixty-card resources; candidate routes remain isolated. */
export const fixture = (scenario = 'positive'): GameState => {
  if (scenario.startsWith('ai-')) return JSON.parse(JSON.stringify(fixture(scenario.slice(3)))
    .replaceAll('player-one', 'player-swap').replaceAll('player-two', 'player-one').replaceAll('player-swap', 'player-two')) as GameState
  let state = base()
  const own = state.players['player-one'], foe = state.players['player-two']
  const source = createCard(raw, 'player-one', 1)
  if (source.type !== 'cookie') throw Error('Original Cookie required')
  own.battleArea[0] = { ...own.battleArea[0], card: source, battleEntryId: source.instanceId + ':entry' }
  const count = scenario === 'manual' ? 7 : scenario === 'three-supports' ? 3 : scenario === 'four-supports' ? 4 : scenario === 'six-supports' ? 6 : 5
  while (own.supportArea.length < count) {
    const card = own.deck.shift()
    if (!card) throw Error('Physical support required')
    own.supportArea.push({ card, rested: false })
  }
  if (scenario === 'manual') {
    const item = getCardPoolEntry('ST1-016'), red = getCardPoolEntry('ST1-018')
    if (!item || !red) throw Error('Original Item and red payments required')
    own.deck.shift()
    own.hand.push(createCard(item, 'player-one', 99))
    for (let index = 0; index < 2; index++) {
      own.supportArea[3 + index] = { card: createCard(red, 'player-one', 90 + index), rested: false }
    }
  }
  if (scenario.startsWith('skill') || scenario === 'refresh') {
    if (scenario !== 'skill-no-item') {
      const item = getCardPoolEntry('ST1-016'), red = getCardPoolEntry('ST1-018')
      if (!item || !red) throw Error('Original Item and red payments required')
      own.deck.shift()
      own.hand = [createCard(item, 'player-one', 99)]
      for (let index = 0; index < 2; index++) own.supportArea[index] = { card: createCard(red, 'player-one', 90 + index), rested: false }
      state = applyGameCommand(state, { kind: 'play-item', playerId: 'player-one', instanceId: own.hand[0].instanceId,
        paymentIds: own.supportArea.slice(0, 2).map(support => support.card.instanceId), effectTargets: [[]] })
    }
    const player = state.players['player-one']
    const handCount = scenario === 'skill-five' ? 5 : scenario === 'skill-six' ? 6 : scenario === 'skill-four' ? 4 : 0
    player.hand.push(...player.deck.splice(0, handCount))
    if (scenario === 'skill-rested') player.battleArea[0].rested = true
    if (scenario === 'skill-wrong-phase') state.phase = 'support'
    if (scenario === 'skill-opponent-turn') state.activePlayerId = 'player-two'
    if (scenario === 'skill-used') state = activate(state)
    if (scenario === 'refresh') player.discardPile.push(...player.deck.splice(1))
  }
  if (scenario === 'rested-energy') own.supportArea[2].rested = true
  if (scenario === 'wrong-color') {
    const record = getCardPoolEntry('ST2-020')
    if (!record) throw Error('Original wrong-color support required')
    own.supportArea[2] = { card: createCard(record, 'player-one', 99), rested: false }
  }
  if (scenario === 'rested-source') own.battleArea[0].rested = true
  if (scenario === 'wrong-phase') state.phase = 'support'
  if (scenario === 'first-turn') state.turnNumber = 1
  if (scenario === 'play') { const original = own.battleArea.shift()!; own.hand.push(original.card); own.deck.push(...original.hpCards) }
  if (scenario === 'other-target') {
    const index = foe.deck.findIndex(card => card.type === 'cookie' && card.hp >= 2)
    if (index < 0) throw Error('Original additional Cookie required')
    const [card] = foe.deck.splice(index, 1)
    if (card.type !== 'cookie') throw Error('Original Cookie required')
    foe.battleArea.push({ card, hpCards: foe.deck.splice(0, card.hp), rested: false, battleEntryId: card.instanceId + ':entry' })
  }
  if (scenario === 'source-faints') {
    const kumiho = getCardPoolEntry('BS1-002')
    if (!kumiho) throw Error('Original Kumiho required')
    foe.supportArea = foe.deck.splice(0, 3).map(card => ({ card, rested: false }))
    foe.hand = foe.deck.splice(0, 2)
    for (let index = 0; index < 2; index++) foe.battleArea[0].hpCards[foe.battleArea[0].hpCards.length - 1 - index] = createCard(kumiho, 'player-two', index + 1)
    state.activePlayerId = 'player-two'
    state = applyGameCommand(state, { kind: 'declare-attack', playerId: 'player-two', attackerInstanceId: foe.battleArea[0].card.instanceId,
      targetInstanceId: source.instanceId, supportPaymentIds: foe.supportArea.map(support => support.card.instanceId) })
    state = applyGameCommand(state, { kind: 'skip-trap', playerId: 'player-one' })
    state = applyGameCommand(state, { kind: 'resolve-battle', playerId: 'player-two' })
    if (state.players['player-one'].battleArea[0].hpCards.length !== 2) throw Error('Real ordinary4 parent required')
    for (let index = 0; index < 10 && !(state.activePlayerId === 'player-one' && state.phase === 'main'); index++) {
      state = applyGameCommand(state, { kind: 'advance-phase', playerId: state.activePlayerId })
    }
  }
  for (const id of ['player-one', 'player-two'] as const) {
    const cards = zones(state, id)
    if (cards.length !== 60 || new Set(cards.map(card => card.instanceId)).size !== 60) throw Error('Original sixty-card identities required')
    for (const card of cards) if (cards.filter(other => other.id === card.id).length > 4) throw Error('Four-copy limit')
  }
  return state
}

export const activate = (state: GameState) => applyGameCommand(state, { kind: 'activate-skill', playerId: 'player-one',
  sourceInstanceId: state.players['player-one'].battleArea[0].card.instanceId, trigger: 'activate', paymentIds: [], effectTargets: [] })

export const declare = (state: GameState) => applyGameCommand(state, { kind: 'declare-attack', playerId: 'player-one',
  attackerInstanceId: state.players['player-one'].battleArea[0].card.instanceId, targetInstanceId: state.players['player-two'].battleArea[0].card.instanceId,
  supportPaymentIds: state.players['player-one'].supportArea.slice(0, 3).map(support => support.card.instanceId) })

export const settle = (state: GameState): GameState => {
  for (let index = 0; index < 30 && state.status === 'playing' && (state.pendingBattle || state.pendingAbilityEffect || state.pendingReplacement || state.pendingRefresh); index++) {
    const decision = takeAiStep(state, getActingPlayerId(state), { level: 5, searchNow: () => 0 })
    if (decision.action === 'error') throw Error(decision.error)
    if (decision.state === state) throw Error('Continuation must progress')
    state = decision.state
  }
  return state
}

export const openThen = (scenario = 'positive'): GameState => {
  let state = declare(fixture(scenario))
  state = applyGameCommand(state, { kind: 'skip-trap', playerId: 'player-two' })
  if (scenario === 'source-faints') {
    const sourceId = state.pendingBattle!.attackerInstanceId
    for (let index = 0; index < 2; index++) {
      state = applyGameCommand(state, { kind: 'resolve-next-damage', playerId: 'player-two' })
      if (state.pendingBattle?.revealedHpCard?.id !== 'BS1-002') throw Error('Real Kumiho FLIP required')
      state = applyGameCommand(state, { kind: 'resolve-flip', playerId: 'player-two', activate: true,
        discardHandIds: [state.players['player-two'].hand[0].instanceId], targetIds: [sourceId] })
      for (let step = 0; step < 20 && (state.pendingReplacement || state.pendingAbilityEffect); step++) {
        if (state.pendingReplacement) state = applyGameCommand(state, { kind: 'skip-replacement', playerId: getActingPlayerId(state) })
        else {
          const decision = takeAiStep(state, getActingPlayerId(state), { level: 5, searchNow: () => 0 })
          if (decision.action === 'error') throw Error(decision.error)
          state = decision.state
        }
      }
    }
    for (let index = 0; index < 10 && state.pendingBattle?.stage !== 'attack-effect'; index++) {
      const decision = takeAiStep(state, getActingPlayerId(state), { level: 5, searchNow: () => 0 })
      if (decision.action === 'error') throw Error(decision.error)
      state = decision.state
    }
  } else for (let index = 0; index < 3; index++) state = applyGameCommand(state, { kind: 'resolve-next-damage', playerId: 'player-two' })
  return state
}
