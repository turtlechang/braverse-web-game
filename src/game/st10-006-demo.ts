import type { OfficialCardRecord } from '../cards/types'
import bs4Cards from '../../data/cards/official-age-of-heroes-and-kingdoms-bs4.en.json'
import st10CandidateDocument from '../../data/candidates/st6-st10/official-st10.en.json'
import { getAllCardPoolEntries, getCardPoolEntry, hasFlipAbility } from './card-pool'
import { createCard, createOfficialRedStarterDeck } from './starter-deck'
import { createGame } from './setup'
import type { CookieCard, CookieInBattle, GameCard, GameState, PlayerId } from './types'

export type St10006Scenario = 'owner-turn' | 'opponent-turn'

const candidateCards = st10CandidateDocument.cards as OfficialCardRecord[]

const required = <T,>(value: T | null | undefined, label: string): T => {
  if (value === undefined || value === null) throw new Error(`Missing original ${label}`)
  return value
}

export const rawSt10006 = (): OfficialCardRecord =>
  required(
    getCardPoolEntry('ST10-006') ?? candidateCards.find(card => card.cardNumber === 'ST10-006'),
    'ST10-006 printing',
  )

export const st10006Zones = (state: GameState, playerId: PlayerId): GameCard[] => {
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

/** Original sixty-card physical fixture for ST10-006's direct-departure trigger. */
export const createSt10006PreviewState = (scenario: St10006Scenario = 'owner-turn'): GameState => {
  const copies = new Map<string, number>()
  const names = new Map<string, number>()

  const card = (cardNumber: string, owner: PlayerId): GameCard => {
    const record = cardNumber === 'ST10-006'
      ? rawSt10006()
      : getCardPoolEntry(cardNumber)
    if (!record) throw new Error(`Missing original printing ${cardNumber}`)
    const baseNumber = record.baseCardNumber || record.cardNumber
    const copyKey = `${owner}:${baseNumber}`
    const nameKey = `${owner}:${record.name}`
    const copy = (copies.get(copyKey) ?? 0) + 1
    if (copy > 4 || (names.get(nameKey) ?? 0) >= 4) {
      throw new Error(`Original four-copy/name limit ${copyKey}`)
    }
    copies.set(copyKey, copy)
    names.set(nameKey, (names.get(nameKey) ?? 0) + 1)
    return createCard(record, owner, copy)
  }

  const filler = (count: number, owner: PlayerId): GameCard[] => {
    const result: GameCard[] = []
    if (count === 0) return result
    for (const record of getAllCardPoolEntries()) {
      const baseNumber = record.baseCardNumber || record.cardNumber
      if (!record.flags.enabled || record.flags.hidden || record.flags.extra || record.variant ||
        record.type === 'extra' || record.type === 'unknown' || hasFlipAbility(record) ||
        (copies.get(`${owner}:${baseNumber}`) ?? 0) >= 4 ||
        (names.get(`${owner}:${record.name}`) ?? 0) >= 4) continue
      result.push(card(record.poolId || record.cardNumber, owner))
      if (result.length === count) return result
    }
    throw new Error(`Insufficient original non-FLIP fillers for ${owner}`)
  }

  const cookie = (cardNumber: string, owner: PlayerId): CookieInBattle => {
    const value = card(cardNumber, owner)
    if (value.type !== 'cookie') throw new Error(`Expected original Cookie ${cardNumber}`)
    return {
      card: value as CookieCard,
      hpCards: filler(value.hp, owner),
      rested: false,
      battleEntryId: `${value.instanceId}:entry`,
    }
  }

  const state = createGame(
    { id: 'player-one', name: 'ST10-006 實體驗收', deck: createOfficialRedStarterDeck('player-one') },
    { id: 'player-two', name: '實體效果來源方', deck: createOfficialRedStarterDeck('player-two') },
    'player-one',
    cards => cards,
  )
  state.status = 'playing'
  state.phase = 'main'
  state.turnNumber = 3
  state.activePlayerId = scenario === 'owner-turn' ? 'player-one' : 'player-two'
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

  state.players['player-one'].battleArea = [cookie('ST10-006', 'player-one')]
  state.players['player-two'].battleArea = [cookie('ST10-002', 'player-two')]
  const sourcePlayerId = state.activePlayerId
  state.players[sourcePlayerId].hand = [card('BS2-055', sourcePlayerId)]
  // BS9-096 is an original purple Cookie used as an energy card in the Support Area.
  state.players[sourcePlayerId].supportArea = [{ card: card('BS9-096', sourcePlayerId), rested: false }]

  const allIds = new Set<string>()
  for (const playerId of ['player-one', 'player-two'] as const) {
    const existing = st10006Zones(state, playerId)
    const remaining = 60 - existing.length
    if (remaining < 0) throw new Error(`Fixture exceeds sixty original cards for ${playerId}`)
    state.players[playerId].deck.push(...filler(remaining, playerId))
    const playerCards = st10006Zones(state, playerId)
    if (playerCards.length !== 60 || new Set(playerCards.map(item => item.instanceId)).size !== 60) {
      throw new Error(`Original sixty-card identities required for ${playerId}`)
    }
    const counts = new Map<string, number>()
    for (const item of playerCards) {
      if (!item.imageUrl?.startsWith('https://cookierunbraverse.com/')) {
        throw new Error(`Original card image missing for ${item.id}`)
      }
      if (allIds.has(item.instanceId)) throw new Error(`Duplicate original card instance ${item.instanceId}`)
      allIds.add(item.instanceId)
      counts.set(item.id, (counts.get(item.id) ?? 0) + 1)
    }
    if ([...counts.values()].some(count => count > 4)) {
      throw new Error(`Original four-copy limit exceeded for ${playerId}`)
    }
    for (const entry of state.players[playerId].battleArea) {
      if (entry.hpCards.length !== entry.card.hp) {
        throw new Error(`Printed HP required for ${entry.card.id}`)
      }
    }
  }
  if (allIds.size !== 120) throw new Error('Original physical fixture requires 120 unique cards')

  return state
}

/** Original sixty-card fixture where a real BS4-092 On Play cost trashes Blueberry Pie. */
export const createSt10006CostDepartureState = (): GameState => {
  const state = createSt10006PreviewState('owner-turn')
  const record = (bs4Cards.cards as OfficialCardRecord[]).find(
    card => card.cardNumber === 'BS4-092',
  )
  if (!record) throw new Error('Missing original BS4-092 Milky Way Cookie printing')
  const replacedHandCard = state.players['player-one'].hand[0]
  if (!replacedHandCard) throw new Error('Missing original hand card to replace in the fixture')

  const parent = createCard(record, 'player-one', 1)
  const deck = [...state.players['player-one'].deck]
  deck.pop()
  deck.push(replacedHandCard)
  state.players['player-one'].deck = deck
  state.players['player-one'].hand = [parent]

  const zones = st10006Zones(state, 'player-one')
  if (zones.length !== 60 || new Set(zones.map(card => card.instanceId)).size !== 60) {
    throw new Error('ST10-006 cost fixture requires sixty unique original cards')
  }
  return state
}

/** Original sixty-card fixture where Little Star pays its real LV.1-cookie cost. */
export const createSt10006ItemDepartureCostState = (): GameState => {
  const state = createSt10006PreviewState('owner-turn')
  const parent = getCardPoolEntry('ST10-013')
  if (!parent || parent.type !== 'item') throw new Error('Missing original ST10-013 Little Star printing')
  const replacedHandCard = state.players['player-one'].hand[0]
  if (!replacedHandCard) throw new Error('Missing original hand card to replace in the fixture')

  const deck = [...state.players['player-one'].deck]
  deck.pop()
  deck.push(replacedHandCard)
  state.players['player-one'].deck = deck
  state.players['player-one'].hand = [createCard(parent, 'player-one', 1)]

  const zones = st10006Zones(state, 'player-one')
  if (zones.length !== 60 || new Set(zones.map(card => card.instanceId)).size !== 60) {
    throw new Error('ST10-013 cost fixture requires sixty unique original cards')
  }
  return state
}
