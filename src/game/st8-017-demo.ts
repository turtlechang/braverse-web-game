import type { OfficialCardRecord } from '../cards/types'
import { getAllCardPoolEntries, getCardPoolEntry, hasFlipAbility } from './card-pool'
import { applyGameCommand } from './commands'
import { createCard, createOfficialRedStarterDeck } from './starter-deck'
import { createGame } from './setup'
import type { GameCard, GameState, PlayerId } from './types'

const required = <T,>(value: T | null | undefined, label: string): T => {
  if (value === undefined || value === null) throw Error(`Missing ${label}`)
  return value
}

export const rawSt8017: OfficialCardRecord = required(
  getCardPoolEntry('ST8-017'),
  'original Hindering Darkness',
)

export type St8017Scenario = 'positive' | 'unequal-supports' | 'no-green-payment'

export const st8017Scenarios: readonly St8017Scenario[] = [
  'positive', 'unequal-supports', 'no-green-payment',
]

/** Original-card game state immediately before the opponent declares an attack. */
export const createSt8017AttackStartState = (scenario: St8017Scenario = 'positive'): GameState => {
  const copies = new Map<string, number>()
  const names = new Map<string, number>()

  const card = (id: string, owner: PlayerId): GameCard => {
    const record = id === 'ST8-017' ? rawSt8017 : required(getCardPoolEntry(id), id)
    const copyKey = `${owner}:${record.baseCardNumber || record.cardNumber}`
    const copy = (copies.get(copyKey) ?? 0) + 1
    const nameKey = `${owner}:${record.name}`
    if (copy > 4 || (names.get(nameKey) ?? 0) >= 4) throw Error(`Four-copy/name resource limit ${copyKey}`)
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
    { id: 'player-one', name: 'ST8-017 defending player', deck: createOfficialRedStarterDeck('player-one') },
    { id: 'player-two', name: 'Original-card attacker', deck: createOfficialRedStarterDeck('player-two') },
    'player-one',
    cards => cards,
  )
  state.status = 'playing'
  state.phase = 'main'
  state.turnNumber = 2
  state.activePlayerId = 'player-two'
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
  own.hand = [card('ST8-017', 'player-one')]
  own.battleArea = [cookie('ST8-005', 'player-one')]
  foe.battleArea = [cookie('ST8-005', 'player-two'), cookie('ST1-011', 'player-two')]

  const ownGreen = scenario !== 'no-green-payment'
  own.supportArea = [
    { card: card(ownGreen ? 'ST3-019' : 'ST1-018', 'player-one'), rested: false },
    { card: card(ownGreen ? 'ST3-019' : 'ST1-018', 'player-one'), rested: false },
    { card: card('ST1-016', 'player-one'), rested: true },
  ]
  const foeSupportCount = scenario === 'unequal-supports' ? 4 : 3
  foe.supportArea = Array.from({ length: foeSupportCount }, () => ({
    card: card('ST3-019', 'player-two'),
    rested: false,
  }))

  own.deck.push(...filler(3, 'player-one'))
  foe.deck.push(...filler(3, 'player-two'))

  const used = (player: typeof own) => player.deck.length + player.hand.length + player.discardPile.length +
    player.breakArea.length + player.supportArea.length +
    player.battleArea.reduce((count, value) => count + 1 + value.hpCards.length, 0)
  own.deck.push(...filler(60 - used(own), 'player-one'))
  foe.deck.push(...filler(60 - used(foe), 'player-two'))

  return state
}

/** Build the actual attack-payment and Trap-response window through game commands. */
export const createSt8017PreviewState = (scenario: St8017Scenario = 'positive'): GameState => {
  const state = createSt8017AttackStartState(scenario)
  const foe = state.players['player-two']
  const attacker = required(foe.battleArea.find(value => value.card.id === 'ST8-005'), 'Wind Archer attacker')
  const attackPayment = foe.supportArea.slice(0, 3).map(support => support.card.instanceId)
  return applyGameCommand(state, {
    kind: 'declare-attack', playerId: 'player-two',
    attackerInstanceId: attacker.card.instanceId,
    targetInstanceId: required(state.players['player-one'].battleArea[0], 'Wind Archer defender').card.instanceId,
    supportPaymentIds: attackPayment,
  })
}
