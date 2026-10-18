import type { OfficialCardRecord } from '../cards/types'
import st10CandidateDocument from '../../data/candidates/st6-st10/official-st10.en.json'
import { applyGameCommand } from './commands'
import { getAllCardPoolEntries, getCardPoolEntry, hasFlipAbility } from './card-pool'
import { createCard, createOfficialRedStarterDeck } from './starter-deck'
import { createGame } from './setup'
import type { CookieCard, GameCard, GameState, PlayerId } from './types'

export type St1017To018TrapCardNumber = 'ST10-017' | 'ST10-018'
export type St1017To018TrapScenario = 'positive' | 'skip-target' | 'no-lv3' | 'no-purple-payment'
export type St1020StageScenario = 'positive' | 'no-target' | 'no-purple-payment'

const candidateByNumber = new Map(
  (st10CandidateDocument.cards as OfficialCardRecord[]).map(record => [record.cardNumber, record]),
)

const originalRecord = (id: string): OfficialCardRecord => {
  const record = getCardPoolEntry(id) ?? candidateByNumber.get(id)
  if (!record) throw new Error(`Missing original ${id} printing`)
  return record
}

const createFixtureTools = () => {
  const copies = new Map<string, number>()
  const names = new Map<string, number>()

  const card = (id: string, owner: PlayerId): GameCard => {
    const record = originalRecord(id)
    const copyKey = `${owner}:${record.baseCardNumber || record.cardNumber}`
    const nameKey = `${owner}:${record.name}`
    const copyNumber = (copies.get(copyKey) ?? 0) + 1
    if (copyNumber > 4 || (names.get(nameKey) ?? 0) >= 4) {
      throw new Error(`Original-card four-copy limit exceeded for ${copyKey}`)
    }
    copies.set(copyKey, copyNumber)
    names.set(nameKey, (names.get(nameKey) ?? 0) + 1)
    return createCard(record, owner, copyNumber)
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
    throw new Error(`Insufficient original cards to fill ${count} slots for ${owner}`)
  }

  const cookie = (id: string, owner: PlayerId) => {
    const value = card(id, owner)
    if (value.type !== 'cookie') throw new Error(`Expected original Cookie ${id}`)
    return {
      card: value as CookieCard,
      hpCards: filler(value.hp, owner),
      rested: false,
      battleEntryId: `${value.instanceId}:entry`,
    }
  }

  return { card, filler, cookie }
}

const createBaseState = (activePlayerId: PlayerId): GameState => {
  const state = createGame(
    { id: 'player-one', name: 'ST10 original-card review', deck: createOfficialRedStarterDeck('player-one') },
    { id: 'player-two', name: 'Original-card opponent', deck: createOfficialRedStarterDeck('player-two') },
    'player-one',
    cards => cards,
  )
  state.status = 'playing'
  state.phase = 'main'
  state.turnNumber = 2
  state.activePlayerId = activePlayerId
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
  return state
}

const finishOriginalDecks = (
  state: GameState,
  filler: (count: number, owner: PlayerId) => GameCard[],
): void => {
  for (const playerId of ['player-one', 'player-two'] as const) {
    const player = state.players[playerId]
    const used = player.deck.length + player.hand.length + player.discardPile.length + player.breakArea.length +
      player.supportArea.length + (player.stage ? 1 : 0) +
      player.battleArea.reduce((count, entry) => count + 1 + entry.hpCards.length + (entry.equippedCards?.length ?? 0), 0)
    if (used > 60) throw new Error(`ST10 physical fixture uses ${used} cards for ${playerId}`)
    player.deck.push(...filler(60 - used, playerId))
  }
}

const assertPhysicalDecks = (state: GameState): void => {
  const allIds = new Set<string>()
  for (const playerId of ['player-one', 'player-two'] as const) {
    const player = state.players[playerId]
    const cards = [
      ...player.deck,
      ...player.hand,
      ...player.discardPile,
      ...player.breakArea,
      ...player.supportArea.map(entry => entry.card),
      ...(player.stage ? [player.stage.card] : []),
      ...player.battleArea.flatMap(entry => [entry.card, ...entry.hpCards, ...(entry.equippedCards ?? [])]),
    ]
    if (cards.length !== 60) throw new Error(`ST10 physical fixture requires 60 original cards for ${playerId}`)
    const copies = new Map<string, number>()
    for (const value of cards) {
      if (!value.imageUrl?.startsWith('https://cookierunbraverse.com/')) {
        throw new Error(`Original printed art is missing for ${value.id}`)
      }
      if (allIds.has(value.instanceId)) throw new Error(`Duplicate physical card ${value.instanceId}`)
      allIds.add(value.instanceId)
      copies.set(value.id, (copies.get(value.id) ?? 0) + 1)
    }
    if ([...copies.values()].some(count => count > 4)) throw new Error(`ST10 fixture exceeds four copies for ${playerId}`)
  }
  if (allIds.size !== 120) throw new Error('ST10 physical fixtures require 120 unique original cards')
}

/** Opens the real opponent-attack Trap window for one printed ST10 Trap. */
export const createSt1017To018TrapPreviewState = (
  cardNumber: St1017To018TrapCardNumber,
  scenario: St1017To018TrapScenario,
): GameState => {
  const validScenarios: Record<St1017To018TrapCardNumber, readonly St1017To018TrapScenario[]> = {
    'ST10-017': ['positive', 'skip-target', 'no-purple-payment'],
    'ST10-018': ['positive', 'skip-target', 'no-lv3', 'no-purple-payment'],
  }
  if (!validScenarios[cardNumber].includes(scenario)) {
    throw new Error(`Unsupported ST10 Trap scenario ${cardNumber}:${scenario}`)
  }

  const state = createBaseState('player-two')
  const { card, filler, cookie } = createFixtureTools()
  const own = state.players['player-one']
  const foe = state.players['player-two']
  const energyCount = cardNumber === 'ST10-017' ? 2 : 3
  own.hand = [card(cardNumber, 'player-one'), ...Array.from({ length: 2 }, () => card('ST1-011', 'player-one'))]
  own.battleArea = [cookie('ST4-004', 'player-one')]
  foe.battleArea = [cookie('BS1-072', 'player-two'), cookie('ST4-001', 'player-two')]
  own.supportArea = scenario === 'no-purple-payment'
    ? ['ST1-016', 'ST1-018', 'ST1-020'].map(id => ({ card: card(id, 'player-one'), rested: false }))
    : ['BS9-096', 'BS9-098', 'BS9-101'].slice(0, energyCount)
      .map(id => ({ card: card(id, 'player-one'), rested: false }))
  foe.supportArea = Array.from({ length: 3 }, () => ({ card: card('ST3-019', 'player-two'), rested: false }))
  if (cardNumber === 'ST10-018') {
    own.discardPile = scenario === 'no-lv3'
      ? [card('BS9-097', 'player-one'), card('ST4-004', 'player-one')]
      : [card('BS9-109', 'player-one'), card('BS9-097', 'player-one'), card('ST4-004', 'player-one')]
  }
  own.deck.push(...filler(3, 'player-one'))
  foe.deck.push(...filler(3, 'player-two'))
  finishOriginalDecks(state, filler)
  assertPhysicalDecks(state)

  const attacker = foe.battleArea.find(entry => entry.card.id === 'BS1-072')
  const defender = own.battleArea[0]
  if (!attacker || !defender) throw new Error('ST10 Trap fixture is missing the printed attacker or defender')
  return applyGameCommand(state, {
    kind: 'declare-attack',
    playerId: 'player-two',
    attackerInstanceId: attacker.card.instanceId,
    targetInstanceId: defender.card.instanceId,
    supportPaymentIds: foe.supportArea.map(entry => entry.card.instanceId),
  })
}

/** Main-phase state for placing Wizard Archives and activating its real effect. */
export const createSt1020StagePreviewState = (scenario: St1020StageScenario): GameState => {
  const state = createBaseState('player-one')
  const { card, filler, cookie } = createFixtureTools()
  const own = state.players['player-one']
  const foe = state.players['player-two']
  own.hand = [card('ST10-020', 'player-one'), ...Array.from({ length: 2 }, () => card('ST1-011', 'player-one'))]
  own.battleArea = scenario === 'no-target'
    ? [cookie('ST4-002', 'player-one')]
    : [cookie('BS9-096', 'player-one'), cookie('ST4-002', 'player-one')]
  foe.battleArea = [cookie('ST4-004', 'player-two')]
  own.supportArea = scenario === 'no-purple-payment'
    ? ['ST1-016', 'ST1-018', 'ST1-020'].map(id => ({ card: card(id, 'player-one'), rested: false }))
    : [{ card: card('BS9-098', 'player-one'), rested: false }]
  own.deck.push(...filler(3, 'player-one'))
  foe.deck.push(...filler(3, 'player-two'))
  finishOriginalDecks(state, filler)
  assertPhysicalDecks(state)
  return state
}
