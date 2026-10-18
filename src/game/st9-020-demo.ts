import type { OfficialCardRecord } from '../cards/types'
import st9CandidateDocument from '../../data/cards/official-st9-020.en.json'
import { getAllCardPoolEntries, getCardPoolEntry, hasFlipAbility } from './card-pool'
import { createCard, createOfficialRedStarterDeck } from './starter-deck'
import { createGame } from './setup'
import type { GameCard, GameState, PlayerId } from './types'

const required = <T,>(value: T | null | undefined, label: string): T => {
  if (value === undefined || value === null) throw Error(`Missing ${label}`)
  return value
}

const candidateSt9020 = (st9CandidateDocument.cards as OfficialCardRecord[])
  .find(record => record.cardNumber === 'ST9-020')

export const rawSt9020 = required(
  getCardPoolEntry('ST9-020') ?? candidateSt9020,
  'original Tearcrown Stage',
)

export type St9020Scenario = 'positive' | 'zero-draw' | 'high-hand' | 'no-blue-payment'

/** Original-card main-phase state before placing and activating Tearcrown. */
export const createSt9020PreviewState = (
  scenario: St9020Scenario = 'positive',
): GameState => {
  const copies = new Map<string, number>()
  const names = new Map<string, number>()

  const card = (id: string, owner: PlayerId): GameCard => {
    const record = id === 'ST9-020'
      ? rawSt9020
      : required(getCardPoolEntry(id), id)
    const copyKey = `${owner}:${record.baseCardNumber || record.cardNumber}`
    const copy = (copies.get(copyKey) ?? 0) + 1
    const nameKey = `${owner}:${record.name}`
    if (copy > 4 || (names.get(nameKey) ?? 0) >= 4) {
      throw Error(`Four-copy/name resource limit ${copyKey}`)
    }
    copies.set(copyKey, copy)
    names.set(nameKey, (names.get(nameKey) ?? 0) + 1)
    return createCard(record, owner, copy)
  }

  const filler = (count: number, owner: PlayerId): GameCard[] => {
    const result: GameCard[] = []
    if (count === 0) return result
    for (const record of getAllCardPoolEntries()) {
      if (!record.flags.enabled || record.flags.hidden || record.flags.extra || record.variant ||
          record.type === 'extra' || record.type === 'unknown' || hasFlipAbility(record) ||
          (copies.get(`${owner}:${record.baseCardNumber || record.cardNumber}`) ?? 0) >= 4 ||
          (names.get(`${owner}:${record.name}`) ?? 0) >= 4) continue
      result.push(card(record.poolId, owner))
      if (result.length === count) return result
    }
    throw Error('Insufficient original resources')
  }

  const cookie = (id: string, owner: PlayerId) => {
    const value = card(id, owner)
    if (value.type !== 'cookie') throw Error(`Expected original Cookie ${id}`)
    return {
      card: value,
      hpCards: filler(value.hp, owner),
      rested: false,
      battleEntryId: `${value.instanceId}:entry`,
    }
  }

  const state = createGame(
    { id: 'player-one', name: 'ST9-020 Stage owner', deck: createOfficialRedStarterDeck('player-one') },
    { id: 'player-two', name: 'Original-card opponent', deck: createOfficialRedStarterDeck('player-two') },
    'player-one',
    cards => cards,
  )
  state.status = 'playing'
  state.phase = 'main'
  state.turnNumber = 2
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
  const handFillerCount = scenario === 'high-hand' ? 4 : 2
  own.hand = [rawSt9020.cardNumber, ...Array.from({ length: handFillerCount }, () => 'ST1-011')]
    .map(id => card(id, 'player-one'))
  own.battleArea = [cookie('ST4-004', 'player-one')]
  foe.battleArea = [cookie('ST4-004', 'player-two')]

  own.supportArea = scenario === 'no-blue-payment'
    ? [
        { card: card('ST1-016', 'player-one'), rested: false },
        { card: card('ST1-018', 'player-one'), rested: false },
        { card: card('ST1-020', 'player-one'), rested: false },
      ]
    : [
        { card: card('ST4-020', 'player-one'), rested: false },
        { card: card('ST4-021', 'player-one'), rested: true },
        { card: card('ST4-001', 'player-one'), rested: true },
      ]
  foe.supportArea = [{ card: card('ST3-019', 'player-two'), rested: false }]

  own.deck.push(...filler(3, 'player-one'))
  foe.deck.push(...filler(3, 'player-two'))
  const used = (player: typeof own) => player.deck.length + player.hand.length + player.discardPile.length +
    player.breakArea.length + player.supportArea.length + (player.stage ? 1 : 0) +
    player.battleArea.reduce((count, entry) => count + 1 + entry.hpCards.length, 0)
  own.deck.push(...filler(60 - used(own), 'player-one'))
  foe.deck.push(...filler(60 - used(foe), 'player-two'))
  return state
}
