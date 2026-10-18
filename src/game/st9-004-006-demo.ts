import type { OfficialCardRecord } from '../cards/types'
import st9CandidateDocument from '../../data/cards/official-st9-004-006.en.json'
import { applyGameCommand } from './commands'
import { getAllCardPoolEntries, getCardPoolEntry, hasFlipAbility } from './card-pool'
import { createCard, createOfficialRedStarterDeck } from './starter-deck'
import { createGame } from './setup'
import type { CookieCard, CookieInBattle, GameCard, GameState, PlayerId } from './types'

export type St9004To006CardNumber = 'ST9-004' | 'ST9-005' | 'ST9-006'
export type St9004To006Scenario = 'positive' | 'insufficient-energy' | 'high-hand' | 'no-blue-payment'

const required = <T,>(value: T | null | undefined, label: string): T => {
  if (value === undefined || value === null) throw Error(`Missing ${label}`)
  return value
}

const candidateByNumber = new Map(
  (st9CandidateDocument.cards as OfficialCardRecord[]).map(record => [record.cardNumber, record]),
)

export const rawSt9004To006 = (id: St9004To006CardNumber): OfficialCardRecord =>
  required(getCardPoolEntry(id) ?? candidateByNumber.get(id), `original ${id}`)

const original = (id: string): OfficialCardRecord =>
  required(getCardPoolEntry(id) ?? candidateByNumber.get(id), id)

export const st9004To006Zones = (state: GameState, playerId: PlayerId): GameCard[] => {
  const player = state.players[playerId]
  const revealed = state.pendingBattle?.defenderPlayerId === playerId
    ? state.pendingBattle.revealedHpCard
    : null
  return [
    ...player.deck,
    ...player.hand,
    ...player.breakArea,
    ...player.discardPile,
    ...player.supportArea.map(support => support.card),
    ...(player.stage ? [player.stage.card] : []),
    ...player.battleArea.flatMap(cookie => [cookie.card, ...cookie.hpCards, ...(cookie.equippedCards ?? [])]),
    ...(revealed ? [revealed] : []),
  ]
}

/** Physical 60-card fixtures for the ST9-004 FLIP, ST9-005 Blocker and ST9-006 skill/Then. */
export const createSt9004To006PreviewState = (
  cardNumber: St9004To006CardNumber,
  scenario: St9004To006Scenario = 'positive',
): GameState => {
  const copies = new Map<string, number>()
  const names = new Map<string, number>()

  const card = (id: string, owner: PlayerId): GameCard => {
    const record = original(id)
    const copyKey = `${owner}:${record.baseCardNumber || record.cardNumber}`
    const copy = (copies.get(copyKey) ?? 0) + 1
    const nameKey = `${owner}:${record.name}`
    if (copy > 4 || (names.get(nameKey) ?? 0) >= 4) throw Error(`Four-copy/name limit ${copyKey}`)
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
    if (count === 0) return result
    throw Error(`Insufficient original resources to fill ${count} cards for ${owner}`)
  }

  const cookie = (id: string, owner: PlayerId): CookieInBattle => {
    const value = card(id, owner)
    if (value.type !== 'cookie') throw Error(`Expected original Cookie ${id}`)
    return {
      card: value as CookieCard,
      hpCards: filler(value.hp, owner),
      rested: false,
      battleEntryId: `${value.instanceId}:entry`,
    }
  }

  const state = createGame(
    { id: 'player-one', name: `ST9-004～006 ${cardNumber}`, deck: createOfficialRedStarterDeck('player-one') },
    { id: 'player-two', name: 'Original-card opponent', deck: createOfficialRedStarterDeck('player-two') },
    'player-one',
    cards => cards,
  )
  state.status = 'playing'
  state.phase = 'main'
  state.turnNumber = 3
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

  if (cardNumber === 'ST9-004') {
    const paymentCount = scenario === 'insufficient-energy' ? 2 : 3
    own.battleArea = [cookie('ST9-004', 'player-one')]
    const target = cookie('ST6-003', 'player-two')
    const displaced = target.hpCards[1]
    if (!displaced) throw Error('ST6-003 four-HP target is required')
    target.hpCards[1] = card('ST9-004', 'player-two')
    foe.battleArea = [target]
    foe.deck.push(displaced)
    own.supportArea = ['ST4-020', 'ST4-021', 'ST4-001'].slice(0, paymentCount)
      .map(id => ({ card: card(id, 'player-one'), rested: false }))
    own.deck.push(...filler(3, 'player-one'))
  } else if (cardNumber === 'ST9-005') {
    own.battleArea = [cookie('ST9-005', 'player-one'), cookie('ST4-004', 'player-one')]
    foe.battleArea = [cookie('BS1-072', 'player-two')]
    own.supportArea = scenario === 'no-blue-payment'
      ? [{ card: card('ST3-019', 'player-one'), rested: false }]
      : [{ card: card('ST4-020', 'player-one'), rested: false }]
    foe.supportArea = Array.from({ length: 3 }, () => ({
      card: card('ST3-019', 'player-two'),
      rested: false,
    }))
    state.activePlayerId = 'player-two'
  } else {
    own.battleArea = [cookie('ST9-006', 'player-one')]
    foe.battleArea = [cookie('ST4-004', 'player-two'), cookie('ST4-001', 'player-two')]
    const handCount = scenario === 'high-hand' ? 6 : 5
    own.hand = filler(handCount, 'player-one')
    const blueCount = scenario === 'insufficient-energy' ? 2 : 3
    own.supportArea = ['ST4-020', 'ST4-021', 'ST4-001'].slice(0, blueCount)
      .map(id => ({ card: card(id, 'player-one'), rested: false }))
    own.deck.push(...filler(3, 'player-one'))
  }

  foe.deck.push(...filler(3, 'player-two'))
  for (const playerId of ['player-one', 'player-two'] as const) {
    const zones = st9004To006Zones(state, playerId)
    const remaining = 60 - zones.length
    if (remaining < 0) throw Error(`Fixture exceeds sixty original cards for ${playerId}`)
    state.players[playerId].deck.push(...filler(remaining, playerId))
    const cards = st9004To006Zones(state, playerId)
    if (cards.length !== 60 || new Set(cards.map(item => item.instanceId)).size !== 60) {
      throw Error(`Original sixty-card identities required for ${playerId}`)
    }
    const copyCounts = new Map<string, number>()
    for (const item of cards) copyCounts.set(item.id, (copyCounts.get(item.id) ?? 0) + 1)
    if ([...copyCounts.values()].some(count => count > 4)) throw Error(`Original four-copy limit for ${playerId}`)
  }

  if (cardNumber === 'ST9-005') {
    const attacker = required(foe.battleArea.find(entry => entry.card.id === 'BS1-072'), 'Pudding Cookie')
    const target = required(own.battleArea.find(entry => entry.card.id === 'ST4-004'), 'Lobster Cookie target')
    return applyGameCommand(state, {
      kind: 'declare-attack',
      playerId: 'player-two',
      attackerInstanceId: attacker.card.instanceId,
      targetInstanceId: target.card.instanceId,
      supportPaymentIds: foe.supportArea.map(support => support.card.instanceId),
    })
  }
  return state
}
