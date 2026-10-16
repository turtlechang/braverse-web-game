import type { OfficialCardRecord } from '../cards/types'
import { applyGameCommand } from './commands'
import { getAllCardPoolEntries, getCardPoolEntry, hasFlipAbility } from './card-pool'
import { createCard, createOfficialRedStarterDeck } from './starter-deck'
import { createGame } from './setup'
import type { GameCard, GameState, PlayerId } from './types'

const required = <T,>(value: T | null | undefined, label: string): T => {
  if (value === undefined || value === null) throw Error(`Missing ${label}`)
  return value
}

export const rawSt8020: OfficialCardRecord = required(
  getCardPoolEntry('ST8-020'),
  'original Dark Enchantress Laboratory',
)

export type St8020Scenario = 'positive' | 'single-support' | 'no-green-payment'

/** Original-card main-phase state before paying to place the Stage. */
export const createSt8020PreviewState = (
  scenario: St8020Scenario = 'positive',
): GameState => {
  const copies = new Map<string, number>()
  const names = new Map<string, number>()

  const card = (id: string, owner: PlayerId): GameCard => {
    const record = id === 'ST8-020' ? rawSt8020 : required(getCardPoolEntry(id), id)
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
    { id: 'player-one', name: 'ST8-020 Stage owner', deck: createOfficialRedStarterDeck('player-one') },
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
  own.hand = [card('ST8-020', 'player-one')]
  own.battleArea = [cookie('ST8-005', 'player-one')]
  foe.battleArea = [cookie('ST1-011', 'player-two')]

  if (scenario === 'no-green-payment') {
    own.supportArea = [
      { card: card('ST1-018', 'player-one'), rested: false },
      { card: card('ST1-016', 'player-one'), rested: true },
    ]
  } else {
    own.supportArea = [{ card: card('ST3-019', 'player-one'), rested: false }]
    if (scenario === 'positive') {
      own.supportArea.push(
        { card: card('ST1-016', 'player-one'), rested: true },
        { card: card('ST1-018', 'player-one'), rested: true },
      )
    }
  }
  foe.supportArea = [{ card: card('ST3-019', 'player-two'), rested: true }]

  own.deck.push(...filler(3, 'player-one'))
  foe.deck.push(...filler(3, 'player-two'))
  const used = (player: typeof own) => player.deck.length + player.hand.length + player.discardPile.length +
    player.breakArea.length + player.supportArea.length + (player.stage ? 1 : 0) +
    player.battleArea.reduce((count, value) => count + 1 + value.hpCards.length, 0)
  own.deck.push(...filler(60 - used(own), 'player-one'))
  foe.deck.push(...filler(60 - used(foe), 'player-two'))
  return state
}

/** Play the printed Stage and advance to its owner's turn-end trigger. */
export const createSt8020TurnEndState = (
  scenario: St8020Scenario = 'positive',
  readyIds: string[] = [],
): GameState => {
  const before = createSt8020PreviewState(scenario)
  const owner = before.players['player-one']
  const source = required(owner.hand.find(card => card.id === 'ST8-020'), 'Dark Enchantress Laboratory')
  const green = owner.supportArea.find(support => !support.rested && support.card.energyColor === 'green')
  if (!green) return before

  const played = applyGameCommand(before, {
    kind: 'play-stage', playerId: 'player-one', instanceId: source.instanceId,
    paymentIds: [green.card.instanceId],
  })
  const endPhase = applyGameCommand(played, { kind: 'advance-phase', playerId: 'player-one' })
  const trigger = applyGameCommand(endPhase, { kind: 'advance-phase', playerId: 'player-one' })
  if (!trigger.pendingAbilityEffect) throw Error('The Stage must trigger at its owner turn end')
  const removed = applyGameCommand(trigger, {
    kind: 'resolve-ability-effect', playerId: 'player-one', targetIds: [],
  })
  if (readyIds.length === 0 && removed.pendingAbilityEffect?.effectIndex === 1) return removed
  return applyGameCommand(removed, {
    kind: 'resolve-ability-effect', playerId: 'player-one', targetIds: readyIds,
  })
}
