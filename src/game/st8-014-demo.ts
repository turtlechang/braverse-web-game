import type { OfficialCardRecord } from '../cards/types'
import { getAllCardPoolEntries, getCardPoolEntry, hasFlipAbility } from './card-pool'
import { createCard, createOfficialRedStarterDeck } from './starter-deck'
import { createGame } from './setup'
import type { GameCard, GameState, PlayerId } from './types'

const required = <T,>(value: T | null | undefined, label: string): T => {
  if (value === undefined || value === null) throw Error(`Missing ${label}`)
  return value
}

export const rawSt8014: OfficialCardRecord = required(
  getCardPoolEntry('ST8-014'),
  'original Cape of the Vanquisher',
)

export type St8014Scenario =
  | 'positive'
  | 'support-below-threshold'
  | 'no-eligible-target'
  | 'no-green-payment'

export const createSt8014PreviewState = (
  scenario: St8014Scenario = 'positive',
): GameState => {
  const copies = new Map<string, number>()
  const names = new Map<string, number>()

  const card = (id: string, owner: PlayerId): GameCard => {
    const record = id === 'ST8-014' ? rawSt8014 : required(getCardPoolEntry(id), id)
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

  const cookie = (id: string, owner: PlayerId, remainingHp: number) => {
    const value = card(id, owner)
    if (value.type !== 'cookie' || remainingHp > value.hp) {
      throw Error(`Cookie with sufficient printed HP required: ${id}`)
    }
    return {
      card: value,
      hpCards: filler(remainingHp, owner),
      rested: false,
      battleEntryId: `${value.instanceId}:entry`,
    }
  }

  const state = createGame(
    { id: 'player-one', name: 'ST8-014 Cape of the Vanquisher', deck: createOfficialRedStarterDeck('player-one') },
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
  own.hand = [card('ST8-014', 'player-one')]
  own.battleArea = scenario === 'no-eligible-target'
    ? [cookie('ST8-005', 'player-one', 4), cookie('ST1-011', 'player-one', 2)]
    : [cookie('ST8-005', 'player-one', 3), cookie('ST8-005', 'player-one', 4), cookie('ST1-011', 'player-one', 2)]

  const supportCount = scenario === 'support-below-threshold' ? 4 : 5
  own.supportArea = [
    {
      card: card(scenario === 'no-green-payment' ? 'ST1-018' : 'ST3-019', 'player-one'),
      rested: scenario === 'no-green-payment',
    },
    ...filler(supportCount - 1, 'player-one').map(supportCard => ({ card: supportCard, rested: true })),
  ]
  foe.battleArea = [cookie('ST1-011', 'player-two', 2)]

  const used = (player: typeof own) => player.hand.length + player.discardPile.length + player.breakArea.length +
    player.supportArea.length + player.battleArea.reduce((count, value) => count + 1 + value.hpCards.length, 0)
  own.deck.push(...filler(60 - used(own), 'player-one'))
  foe.deck.push(...filler(60 - used(foe), 'player-two'))
  return state
}
