import type { OfficialCardRecord } from '../cards/types'
import st9CandidateDocument from '../../data/cards/official-st9.en.json'
import { applyGameCommand } from './commands'
import { getAllCardPoolEntries, getCardPoolEntry, hasFlipAbility } from './card-pool'
import { createCard, createOfficialRedStarterDeck } from './starter-deck'
import { createGame } from './setup'
import type { CookieCard, GameCard, GameState, PlayerId } from './types'

const required = <T,>(value: T | null | undefined, label: string): T => {
  if (value === undefined || value === null) throw Error(`Missing ${label}`)
  return value
}

export type St9TrapCardNumber = 'ST9-017' | 'ST9-018' | 'ST9-019'
export type St9TrapScenario = 'positive' | 'high-hand' | 'no-blue-payment' | 'one-hp-target'

const candidateByNumber = new Map(
  (st9CandidateDocument.cards as OfficialCardRecord[]).map(record => [record.cardNumber, record]),
)
const originalRecord = (id: St9TrapCardNumber): OfficialCardRecord =>
  required(getCardPoolEntry(id) ?? candidateByNumber.get(id), `original ${id}`)

export const rawSt9017 = originalRecord('ST9-017')
export const rawSt9018 = originalRecord('ST9-018')
export const rawSt9019 = originalRecord('ST9-019')

const rawByNumber: Record<St9TrapCardNumber, OfficialCardRecord> = {
  'ST9-017': rawSt9017,
  'ST9-018': rawSt9018,
  'ST9-019': rawSt9019,
}

const original = (id: string): OfficialCardRecord =>
  rawByNumber[id as St9TrapCardNumber] ?? required(getCardPoolEntry(id), id)

/** Build a real-card state immediately before Pudding Cookie declares its attack. */
export const createSt9TrapAttackStartState = (
  cardNumber: St9TrapCardNumber,
  scenario: St9TrapScenario = 'positive',
): GameState => {
  const copies = new Map<string, number>()
  const names = new Map<string, number>()

  const card = (id: string, owner: PlayerId): GameCard => {
    const record = original(id)
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
    if (count === 0) return result
    throw Error(`Insufficient original resources to fill ${count} cards`)
  }

  const cookie = (id: string, owner: PlayerId, hp?: number) => {
    const value = card(id, owner)
    if (value.type !== 'cookie') throw Error(`Expected original Cookie ${id}`)
    const hpCount = hp ?? value.hp
    return {
      card: value as CookieCard,
      hpCards: filler(hpCount, owner),
      rested: false,
      battleEntryId: `${value.instanceId}:entry`,
    }
  }

  const state = createGame(
    { id: 'player-one', name: `${cardNumber} defending player`, deck: createOfficialRedStarterDeck('player-one') },
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
  const handFillerCount = cardNumber === 'ST9-017'
    ? scenario === 'high-hand' ? 4 : 2
    : cardNumber === 'ST9-018' ? 1 : 2
  own.hand = [card(cardNumber, 'player-one'), ...Array.from({ length: handFillerCount }, () => card('ST1-011', 'player-one'))]
  own.battleArea = [cookie('ST4-004', 'player-one')]
  foe.battleArea = [
    cookie('BS1-072', 'player-two'),
    cookie(scenario === 'one-hp-target' ? 'ST4-010' : 'ST4-001', 'player-two'),
  ]

  own.supportArea = scenario === 'no-blue-payment'
    ? [
        { card: card('ST1-016', 'player-one'), rested: false },
        { card: card('ST1-018', 'player-one'), rested: false },
        { card: card('ST1-020', 'player-one'), rested: false },
      ]
    : [
        { card: card('ST4-020', 'player-one'), rested: false },
        { card: card('ST4-021', 'player-one'), rested: false },
        { card: card('ST4-001', 'player-one'), rested: false },
      ]
  foe.supportArea = Array.from({ length: 3 }, () => ({
    card: card('ST3-019', 'player-two'),
    rested: false,
  }))

  own.deck.push(...filler(3, 'player-one'))
  foe.deck.push(...filler(3, 'player-two'))
  const used = (player: typeof own) => player.deck.length + player.hand.length + player.discardPile.length +
    player.breakArea.length + player.supportArea.length + (player.stage ? 1 : 0) +
    player.battleArea.reduce((count, entry) => count + 1 + entry.hpCards.length, 0)
  own.deck.push(...filler(60 - used(own), 'player-one'))
  foe.deck.push(...filler(60 - used(foe), 'player-two'))
  return state
}

/** The actual printed Pudding Cookie attack opens the candidate Trap window. */
export const createSt9TrapPreviewState = (
  cardNumber: St9TrapCardNumber,
  scenario: St9TrapScenario = 'positive',
): GameState => {
  const state = createSt9TrapAttackStartState(cardNumber, scenario)
  const foe = state.players['player-two']
  const attacker = required(foe.battleArea.find(entry => entry.card.id === 'BS1-072'), 'Pudding Cookie attacker')
  return applyGameCommand(state, {
    kind: 'declare-attack',
    playerId: 'player-two',
    attackerInstanceId: attacker.card.instanceId,
    targetInstanceId: required(state.players['player-one'].battleArea[0], 'Lobster Cookie defender').card.instanceId,
    supportPaymentIds: foe.supportArea.map(support => support.card.instanceId),
  })
}
