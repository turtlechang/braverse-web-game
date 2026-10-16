import st9CandidateDocument from '../../data/cards/official-st9-015.en.json'
import type { OfficialCardRecord } from '../cards/types'
import { getAllCardPoolEntries, getCardPoolEntry, hasFlipAbility } from './card-pool'
import { createCard, createOfficialRedStarterDeck } from './starter-deck'
import { createGame } from './setup'
import type { CookieCard, CookieInBattle, GameCard, GameState, PlayerId } from './types'

export type St9015Scenario = 'low-hand' | 'high-hand' | 'no-blue-support'

const candidateCards = new Map(
  (st9CandidateDocument.cards as OfficialCardRecord[]).map(record => [record.cardNumber, record]),
)

const original = (cardNumber: string): OfficialCardRecord => {
  const record = getCardPoolEntry(cardNumber) ?? candidateCards.get(cardNumber)
  if (!record) throw new Error(`Missing original printing ${cardNumber}`)
  return record
}

const makeFixture = (scenario: St9015Scenario): GameState => {
  const copies = new Map<string, number>()
  const names = new Map<string, number>()

  const card = (cardNumber: string, owner: PlayerId): GameCard => {
    const record = original(cardNumber)
    const base = `${owner}:${record.baseCardNumber || record.cardNumber}`
    const copy = (copies.get(base) ?? 0) + 1
    const nameKey = `${owner}:${record.name}`
    if (copy > 4 || (names.get(nameKey) ?? 0) >= 4) {
      throw new Error(`Original four-copy/name limit exceeded: ${base}`)
    }
    copies.set(base, copy)
    names.set(nameKey, (names.get(nameKey) ?? 0) + 1)
    return createCard(record, owner, copy)
  }

  const filler = (amount: number, owner: PlayerId, cookiesOnly = false): GameCard[] => {
    if (amount === 0) return []
    const result: GameCard[] = []
    for (const record of getAllCardPoolEntries()) {
      if (!record.flags.enabled || record.flags.hidden || record.flags.extra || record.variant ||
          record.type === 'extra' || record.type === 'unknown' || hasFlipAbility(record) ||
          (cookiesOnly && record.type !== 'cookie')) continue
      const base = `${owner}:${record.baseCardNumber || record.cardNumber}`
      if ((copies.get(base) ?? 0) >= 4 || (names.get(`${owner}:${record.name}`) ?? 0) >= 4) continue
      result.push(card(record.cardNumber, owner))
      if (result.length === amount) return result
    }
    throw new Error(`Insufficient original ${cookiesOnly ? 'Cookie ' : ''}filler cards for ${owner}`)
  }

  const cookie = (cardNumber: string, owner: PlayerId): CookieInBattle => {
    const source = card(cardNumber, owner)
    if (source.type !== 'cookie') throw new Error(`Expected original Cookie ${cardNumber}`)
    const hpCards = filler(source.hp, owner, true)
    if (hpCards.some(entry => entry.type !== 'cookie')) throw new Error('Printed HP stack must use Cookies')
    return {
      card: source as CookieCard,
      hpCards: hpCards as CookieCard[],
      rested: false,
      battleEntryId: `${source.instanceId}:entry`,
    }
  }

  const state = createGame(
    { id: 'player-one', name: 'ST9-015 實體驗收', deck: createOfficialRedStarterDeck('player-one') },
    { id: 'player-two', name: 'ST9-015 實體對手', deck: createOfficialRedStarterDeck('player-two') },
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
    player.breakArea = []
    player.discardPile = []
    player.supportArea = []
    player.battleArea = []
    player.extraDeck = []
    player.stage = null
    player.startingCookieSelected = true
  }

  const own = state.players['player-one']
  const opponent = state.players['player-two']
  const handCountAfterSourceLeaves = scenario === 'high-hand' ? 6 : 5
  own.hand = [card('ST9-015', 'player-one'), ...filler(handCountAfterSourceLeaves, 'player-one')]
  const supportNumber = scenario === 'no-blue-support' ? 'BS3-018' : 'BS3-090'
  const support = card(supportNumber, 'player-one')
  const expectedColor = scenario === 'no-blue-support' ? 'red' : 'blue'
  if (support.energyColor !== expectedColor) {
    throw new Error(`ST9-015 fixture requires original ${expectedColor} Support`)
  }
  own.supportArea = [{ card: support, rested: false }]
  own.battleArea = [
    cookie('BS2-029', 'player-one'),
    cookie('ST9-006', 'player-one'),
    cookie('ST9-007', 'player-one'),
  ]
  opponent.battleArea = [
    cookie('ST6-003', 'player-two'),
    cookie('BS2-029', 'player-two'),
  ]

  for (const playerId of ['player-one', 'player-two'] as const) {
    const player = state.players[playerId]
    const used = player.hand.length + player.breakArea.length + player.discardPile.length +
      player.supportArea.length + player.battleArea.reduce((sum, entry) =>
        sum + 1 + entry.hpCards.length + (entry.equippedCards?.length ?? 0), 0) +
      (player.stage ? 1 : 0)
    if (used > 60) throw new Error(`Fixture contains ${used} cards for ${playerId}`)
    player.deck = filler(60 - used, playerId)
    const zones = [
      ...player.deck,
      ...player.hand,
      ...player.breakArea,
      ...player.discardPile,
      ...player.supportArea.map(entry => entry.card),
      ...player.battleArea.flatMap(entry => [entry.card, ...entry.hpCards, ...(entry.equippedCards ?? [])]),
      ...(player.stage ? [player.stage.card] : []),
    ]
    const ids = zones.map(entry => entry.instanceId)
    if (zones.length !== 60 || new Set(ids).size !== 60) {
      throw new Error(`Expected sixty unique original cards for ${playerId}`)
    }
    for (const entry of player.battleArea) {
      if (entry.hpCards.length !== entry.card.hp) throw new Error(`Printed HP stack mismatch for ${entry.card.id}`)
    }
  }
  return state
}

export const createSt9015PreviewState = (scenario: St9015Scenario = 'low-hand'): GameState =>
  makeFixture(scenario)

export const st9015Zones = (state: GameState, playerId: PlayerId): GameCard[] => {
  const player = state.players[playerId]
  return [
    ...player.deck,
    ...player.hand,
    ...player.breakArea,
    ...player.discardPile,
    ...player.supportArea.map(entry => entry.card),
    ...(player.stage ? [player.stage.card] : []),
    ...player.battleArea.flatMap(entry => [entry.card, ...entry.hpCards, ...(entry.equippedCards ?? [])]),
  ]
}
