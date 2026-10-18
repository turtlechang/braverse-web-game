import st9CandidateDocument from '../../data/cards/official-st9.en.json'
import type { OfficialCardRecord } from '../cards/types'
import { getAllCardPoolEntries, getCardPoolEntry, hasFlipAbility } from './card-pool'
import { createCard, createOfficialRedStarterDeck } from './starter-deck'
import { createGame } from './setup'
import { createSt8008PreviewState } from './st8-008-demo'
import { createSt9004To006PreviewState } from './st9-004-006-demo'
import type { CookieCard, CookieInBattle, GameCard, GameState, PlayerId } from './types'

export type St9007To009CardNumber = 'ST9-007' | 'ST9-008' | 'ST9-009'
export type St9007To009Scenario =
  | 'positive'
  | 'high-hand'
  | 'no-eligible-return'
  | 'sea-fairy-trigger'
  | 'other-source-trigger'

const candidateCards = new Map(
  (st9CandidateDocument.cards as OfficialCardRecord[]).map(record => [record.cardNumber, record]),
)

const original = (id: string): OfficialCardRecord => {
  const record = getCardPoolEntry(id) ?? candidateCards.get(id)
  if (!record) throw new Error(`Missing original ${id}`)
  return record
}

export const rawSt9007To009 = (id: St9007To009CardNumber): OfficialCardRecord => original(id)

const counts = (state: GameState, playerId: PlayerId): GameCard[] => {
  const player = state.players[playerId]
  return [
    ...player.deck,
    ...player.hand,
    ...player.breakArea,
    ...player.discardPile,
    ...player.supportArea.map(support => support.card),
    ...(player.stage ? [player.stage.card] : []),
    ...player.battleArea.flatMap(cookie => [cookie.card, ...cookie.hpCards, ...(cookie.equippedCards ?? [])]),
  ]
}

export const st9007To009Zones = counts

const withWaveDropInHand = (state: GameState): GameState => {
  const owner = state.players['player-one']
  const displaced = owner.hand[0]
  if (!displaced) throw new Error('A real hand card is required for the Wave Drop fixture')
  if (owner.deck.length === 0) throw new Error('A deck card is required for the Wave Drop swap')
  owner.deck.pop()
  const waveDrop = createCard(rawSt9007To009('ST9-009'), 'player-one', 1)
  owner.hand = [waveDrop, ...owner.hand.slice(1)]
  owner.deck.push(displaced)
  return state
}

/** Build physical original-card routes for the ST9-007–009 card batch. */
export const createSt9007To009PreviewState = (
  cardNumber: St9007To009CardNumber,
  scenario: St9007To009Scenario = 'positive',
): GameState => {
  if (cardNumber === 'ST9-009') {
    if (scenario === 'other-source-trigger') {
      return withWaveDropInHand(createSt8008PreviewState('attack'))
    }
    return withWaveDropInHand(createSt9004To006PreviewState('ST9-006'))
  }

  const copies = new Map<string, number>()
  const names = new Map<string, number>()
  const card = (id: string, owner: PlayerId): GameCard => {
    const record = original(id)
    const copyKey = `${owner}:${record.baseCardNumber || record.cardNumber}`
    const copy = (copies.get(copyKey) ?? 0) + 1
    const nameKey = `${owner}:${record.name}`
    if (copy > 4 || (names.get(nameKey) ?? 0) >= 4) {
      throw new Error(`Original four-copy/name limit exceeded: ${copyKey}`)
    }
    copies.set(copyKey, copy)
    names.set(nameKey, (names.get(nameKey) ?? 0) + 1)
    return createCard(record, owner, copy)
  }

  const filler = (amount: number, owner: PlayerId): GameCard[] => {
    const result: GameCard[] = []
    if (amount <= 0) return result
    for (const record of getAllCardPoolEntries()) {
      if (!record.flags.enabled || record.flags.hidden || record.flags.extra || record.variant ||
          record.type === 'extra' || record.type === 'unknown' || hasFlipAbility(record) ||
          (copies.get(`${owner}:${record.baseCardNumber || record.cardNumber}`) ?? 0) >= 4 ||
          (names.get(`${owner}:${record.name}`) ?? 0) >= 4) continue
      result.push(card(record.poolId, owner))
      if (result.length === amount) return result
    }
    throw new Error(`Insufficient original cards to fill ${amount} slots for ${owner}`)
  }

  const cookie = (id: string, owner: PlayerId): CookieInBattle => {
    const source = card(id, owner)
    if (source.type !== 'cookie') throw new Error(`Expected original Cookie ${id}`)
    return {
      card: source as CookieCard,
      hpCards: filler(source.hp, owner),
      rested: false,
      battleEntryId: `${source.instanceId}:entry`,
    }
  }

  const state = createGame(
    { id: 'player-one', name: `ST9-007～009 ${cardNumber}`, deck: createOfficialRedStarterDeck('player-one') },
    { id: 'player-two', name: 'Original-card opponent', deck: createOfficialRedStarterDeck('player-two') },
    'player-one',
    cards => cards,
  )
  state.status = 'playing'
  state.phase = 'main'
  state.turnNumber = 3
  state.activePlayerId = 'player-one'
  for (const player of Object.values(state.players)) {
    player.deck = []
    player.hand = []
    player.battleArea = []
    player.supportArea = []
    player.discardPile = []
    player.breakArea = []
    player.extraDeck = []
    player.stage = null
    player.startingCookieSelected = true
  }

  const own = state.players['player-one']
  const foe = state.players['player-two']
  foe.battleArea = [cookie('ST4-004', 'player-two')]
  foe.deck.push(...filler(3, 'player-two'))

  if (cardNumber === 'ST9-007') {
    own.battleArea = [cookie('ST9-007', 'player-one')]
    const handSize = scenario === 'high-hand' ? 4 : 3
    own.hand = filler(handSize, 'player-one')
    own.deck.push(...filler(3, 'player-one'))
  } else {
    const costCookie = scenario === 'no-eligible-return' ? 'ST9-006' : 'ST8-008'
    own.battleArea = [cookie(costCookie, 'player-one')]
    own.hand = [card('ST9-008', 'player-one'), ...filler(2, 'player-one')]
    own.deck.push(...filler(3, 'player-one'))
  }

  for (const playerId of ['player-one', 'player-two'] as const) {
    const used = counts(state, playerId).length
    if (used > 60) throw new Error(`Fixture contains ${used} cards for ${playerId}`)
    state.players[playerId].deck.push(...filler(60 - used, playerId))
    const cards = counts(state, playerId)
    if (cards.length !== 60 || new Set(cards.map(item => item.instanceId)).size !== 60) {
      throw new Error(`Exactly sixty unique original cards are required for ${playerId}`)
    }
    const printedNames = new Map<string, number>()
    for (const item of cards) printedNames.set(item.name, (printedNames.get(item.name) ?? 0) + 1)
    if ([...printedNames.values()].some(amount => amount > 4)) {
      throw new Error(`Original four-copy limit exceeded in ${playerId}'s deck`)
    }
    for (const activeCookie of state.players[playerId].battleArea) {
      if (activeCookie.hpCards.length !== activeCookie.card.hp) {
        throw new Error(`Printed HP stack mismatch for ${activeCookie.card.id}`)
      }
    }
  }

  return state
}
