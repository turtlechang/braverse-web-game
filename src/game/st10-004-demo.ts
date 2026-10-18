import type { OfficialCardRecord } from '../cards/types'
import st10CandidateDocument from '../../data/candidates/st6-st10/official-st10.en.json'
import { applyGameCommand } from './commands'
import { getAllCardPoolEntries, getCardPoolEntry, hasFlipAbility } from './card-pool'
import { createCard, createOfficialRedStarterDeck } from './starter-deck'
import { createGame } from './setup'
import type { CookieCard, CookieInBattle, GameCard, GameState, PlayerId } from './types'

export type St10004Scenario =
  | 'blocker'
  | 'no-purple-payment'
  | 'direct-target'
  | 'normal-attack'
  | 'normal-attack-insufficient-energy'

const st10CandidateCards = st10CandidateDocument.cards as OfficialCardRecord[]

const required = <T,>(value: T | null | undefined, label: string): T => {
  if (value === undefined || value === null) throw new Error(`Missing original ${label}`)
  return value
}

export const rawSt10004 = (): OfficialCardRecord =>
  required(
    getCardPoolEntry('ST10-004') ?? st10CandidateCards.find(card => card.cardNumber === 'ST10-004'),
    'ST10-004 printing',
  )

export const st10004Zones = (state: GameState, playerId: PlayerId): GameCard[] => {
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

/** Physical sixty-card fixtures for ST10-004's printed Blocker and PN attack. */
export const createSt10004PreviewState = (
  scenario: St10004Scenario = 'blocker',
): GameState => {
  const normalAttack = scenario === 'normal-attack' || scenario === 'normal-attack-insufficient-energy'
  const copies = new Map<string, number>()
  const names = new Map<string, number>()

  const card = (cardNumber: string, owner: PlayerId): GameCard => {
    const record = cardNumber === 'ST10-004'
      ? rawSt10004()
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
    { id: 'player-one', name: 'ST10-004 實體驗收', deck: createOfficialRedStarterDeck('player-one') },
    { id: 'player-two', name: '實體攻擊方', deck: createOfficialRedStarterDeck('player-two') },
    normalAttack ? 'player-one' : 'player-two',
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

  const owner = state.players['player-one']
  const opponent = state.players['player-two']
  const wizard = cookie('ST10-004', 'player-one')
  const originalTarget = cookie('ST6-003', normalAttack ? 'player-two' : 'player-one')

  if (normalAttack) {
    owner.battleArea = [wizard]
    opponent.battleArea = [originalTarget]
    owner.supportArea = [{ card: card('BS9-096', 'player-one'), rested: false }]
    if (scenario === 'normal-attack') {
      owner.supportArea.push({ card: card('ST1-011', 'player-one'), rested: false })
    }
  } else {
    const attackSource = cookie('ST1-011', 'player-two')
    owner.battleArea = [wizard, originalTarget]
    opponent.battleArea = [attackSource]
    owner.supportArea = [{
      card: card(scenario === 'no-purple-payment' ? 'ST6-003' : 'BS9-096', 'player-one'),
      rested: false,
    }]
    // A second real ST1-011 printing pays its printed generic N ordinary attack.
    opponent.supportArea = [{
      card: card('ST1-011', 'player-two'),
      rested: false,
    }]
  }

  for (const playerId of ['player-one', 'player-two'] as const) {
    const existing = st10004Zones(state, playerId)
    const remaining = 60 - existing.length
    if (remaining < 0) throw new Error(`Fixture exceeds sixty original cards for ${playerId}`)
    state.players[playerId].deck.push(...filler(remaining, playerId))
    const cards = st10004Zones(state, playerId)
    if (cards.length !== 60 || new Set(cards.map(item => item.instanceId)).size !== 60) {
      throw new Error(`Original sixty-card identities required for ${playerId}`)
    }
    const copyCounts = new Map<string, number>()
    for (const item of cards) copyCounts.set(item.id, (copyCounts.get(item.id) ?? 0) + 1)
    if ([...copyCounts.values()].some(count => count > 4)) {
      throw new Error(`Original four-copy limit exceeded for ${playerId}`)
    }
  }

  if (normalAttack) return state

  const target = scenario === 'direct-target' ? wizard : originalTarget
  const attackSource = opponent.battleArea[0]
  if (!attackSource) throw new Error('Original ST1-011 attack source is required')
  return applyGameCommand(state, {
    kind: 'declare-attack',
    playerId: 'player-two',
    attackerInstanceId: attackSource.card.instanceId,
    targetInstanceId: target.card.instanceId,
    supportPaymentIds: opponent.supportArea.map(support => support.card.instanceId),
  })
}
