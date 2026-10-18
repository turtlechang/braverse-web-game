import type { OfficialCardRecord } from '../cards/types'
import { getAllCardPoolEntries, getCardPoolEntry, hasFlipAbility } from './card-pool'
import { createCard, createOfficialRedStarterDeck } from './starter-deck'
import { createGame } from './setup'
import type { GameCard, GameState, PlayerId } from './types'

const required = <T,>(value: T | null | undefined, label: string): T => {
  if (value === undefined || value === null) throw Error(`Missing ${label}`)
  return value
}

export const raw: OfficialCardRecord = required(
  getCardPoolEntry('ST8-013'),
  'original Windgrass',
)

export const createSt8013PreviewState = (
  scenario: 'positive' | 'no-wind-archer' | 'opponent-support-rested' | 'no-opponent-support' | 'no-green-payment' = 'positive',
): GameState => {
  const copies = new Map<string, number>()
  const names = new Map<string, number>()
  const card = (id: string, owner: PlayerId): GameCard => {
    const record = id === 'ST8-013' ? raw : required(getCardPoolEntry(id), id)
    const key = `${owner}:${record.baseCardNumber || record.cardNumber}`
    const copy = (copies.get(key) ?? 0) + 1
    const nameKey = `${owner}:${record.name}`
    if (copy > 4 || (names.get(nameKey) ?? 0) >= 4) throw Error(`Four-copy/name resource limit ${key}`)
    copies.set(key, copy)
    names.set(nameKey, (names.get(nameKey) ?? 0) + 1)
    return createCard(record, owner, copy)
  }
  const filler = (count: number, owner: PlayerId): GameCard[] => {
    const result: GameCard[] = []
    if (count === 0) return result
    for (const record of getAllCardPoolEntries()) {
      if (!record.flags.enabled || record.flags.hidden || record.flags.extra || record.variant ||
        record.type === 'extra' || record.type === 'unknown' || hasFlipAbility(record) ||
        record.name === 'Wind Archer Cookie' || (copies.get(`${owner}:${record.poolId}`) ?? 0) >= 4 ||
        (names.get(`${owner}:${record.name}`) ?? 0) >= 4) continue
      result.push(card(record.poolId, owner))
      if (result.length === count) return result
    }
    throw Error('Insufficient original resources')
  }
  const cookie = (id: string, owner: PlayerId) => {
    const value = card(id, owner)
    if (value.type !== 'cookie') throw Error(`Cookie required ${id}`)
    return { card: value, hpCards: filler(value.hp, owner), rested: false, battleEntryId: `${value.instanceId}:entry` }
  }

  const state = createGame(
    { id: 'player-one', name: 'ST8-013逐卡驗收', deck: createOfficialRedStarterDeck('player-one') },
    { id: 'player-two', name: '原卡對手', deck: createOfficialRedStarterDeck('player-two') },
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
  own.hand = [card('ST8-013', 'player-one')]
  own.battleArea = [cookie(scenario === 'no-wind-archer' ? 'ST1-011' : 'ST8-005', 'player-one')]
  own.supportArea = [
    { card: card('ST3-019', 'player-one'), rested: scenario === 'no-green-payment' },
    { card: card('ST1-018', 'player-one'), rested: true },
    { card: card('ST3-020', 'player-one'), rested: scenario === 'no-green-payment' },
  ]
  foe.battleArea = [cookie('ST1-011', 'player-two')]
  foe.supportArea = scenario === 'no-opponent-support' ? [] : [
    { card: card('ST1-018', 'player-two'), rested: false },
    { card: card('ST3-019', 'player-two'), rested: scenario === 'opponent-support-rested' },
  ]

  const used = (player: typeof own) => player.hand.length + player.discardPile.length + player.breakArea.length +
    player.supportArea.length + player.battleArea.reduce((count, value) => count + 1 + value.hpCards.length, 0)
  own.deck.push(...filler(60 - used(own), 'player-one'))
  foe.deck.push(...filler(60 - used(foe), 'player-two'))
  return state
}
