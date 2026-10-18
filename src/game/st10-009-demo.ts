import type { OfficialCardRecord } from '../cards/types'
import st10CandidateDocument from '../../data/candidates/st6-st10/official-st10.en.json'
import { getCardPoolEntry } from './card-pool'
import { createCard } from './starter-deck'
import { createSt10006PreviewState, st10006Zones } from './st10-006-demo'
import type { CookieInBattle, GameCard, GameState, PlayerId } from './types'

export type St10009Scenario = 'owner-turn' | 'opponent-turn'

const candidateCards = st10CandidateDocument.cards as OfficialCardRecord[]

const required = <T,>(value: T | null | undefined, label: string): T => {
  if (value === undefined || value === null) throw new Error(`Missing original ${label}`)
  return value
}

export const rawSt10009 = (): OfficialCardRecord =>
  required(
    getCardPoolEntry('ST10-009') ?? candidateCards.find(card => card.cardNumber === 'ST10-009'),
    'ST10-009 printing',
  )

const takeOriginalCard = (
  state: GameState,
  playerId: PlayerId,
  cardNumber: string,
): GameCard => {
  const player = state.players[playerId]
  const existingIndex = player.deck.findIndex(card => card.id === cardNumber)
  if (existingIndex >= 0) return player.deck.splice(existingIndex, 1)[0]!

  const record = cardNumber === 'ST10-009' ? rawSt10009() : getCardPoolEntry(cardNumber)
  if (!record) throw new Error(`Missing original printing ${cardNumber}`)
  const existingCopies = st10006Zones(state, playerId).filter(card => card.id === cardNumber).length
  const replacement = player.deck.pop()
  if (!replacement) throw new Error(`Missing original deck card to replace with ${cardNumber}`)
  return createCard(record, playerId, existingCopies + 1)
}

const replaceBattleCookie = (
  state: GameState,
  playerId: PlayerId,
  currentCardNumber: string,
  nextCardNumber: string,
): CookieInBattle => {
  const player = state.players[playerId]
  const index = player.battleArea.findIndex(entry => entry.card.id === currentCardNumber)
  const current = player.battleArea[index]
  if (!current) throw new Error(`Missing original battle Cookie ${currentCardNumber}`)

  const nextCard = takeOriginalCard(state, playerId, nextCardNumber)
  if (nextCard.type !== 'cookie' || current.hpCards.length < nextCard.hp) {
    throw new Error(`Invalid printed HP for replacement Cookie ${nextCardNumber}`)
  }
  const next: CookieInBattle = {
    ...current,
    card: nextCard,
    hpCards: current.hpCards.slice(0, nextCard.hp),
    battleEntryId: `${nextCard.instanceId}:entry`,
  }
  player.battleArea = player.battleArea.map((entry, entryIndex) => entryIndex === index ? next : entry)
  player.deck.push(current.card, ...current.hpCards.slice(nextCard.hp))
  return next
}

const replaceHandCard = (
  state: GameState,
  playerId: PlayerId,
  currentCardNumber: string,
  nextCardNumber: string,
): void => {
  const player = state.players[playerId]
  const currentIndex = player.hand.findIndex(card => card.id === currentCardNumber)
  const current = player.hand[currentIndex]
  if (!current) throw new Error(`Missing original hand card ${currentCardNumber}`)
  const next = takeOriginalCard(state, playerId, nextCardNumber)
  player.hand = player.hand.map((card, index) => index === currentIndex ? next : card)
  player.deck.push(current)
}

/** Original sixty-card fixture for ST10-009 direct battle-to-trash draw. */
export const createSt10009PreviewState = (
  scenario: St10009Scenario = 'owner-turn',
): GameState => {
  const state = createSt10006PreviewState(scenario)
  replaceBattleCookie(state, 'player-one', 'ST10-006', 'ST10-009')

  for (const playerId of ['player-one', 'player-two'] as const) {
    const cards = st10006Zones(state, playerId)
    if (cards.length !== 60 || new Set(cards.map(card => card.instanceId)).size !== 60) {
      throw new Error(`Original sixty-card identities required for ${playerId}`)
    }
    const copyCounts = new Map<string, number>()
    for (const card of cards) {
      if (!card.imageUrl?.startsWith('https://cookierunbraverse.com/')) {
        throw new Error(`Original card image missing for ${card.id}`)
      }
      copyCounts.set(card.id, (copyCounts.get(card.id) ?? 0) + 1)
    }
    if ([...copyCounts.values()].some(count => count > 4)) {
      throw new Error(`Original four-copy limit exceeded for ${playerId}`)
    }
  }
  if (state.players['player-one'].battleArea[0]?.hpCards.length !== 1) {
    throw new Error('Space Doughnut requires its printed 1 HP card')
  }
  return state
}

/** Original sixty-card fixture where Little Star pays Space Doughnut as its cost. */
export const createSt10009ItemCostState = (): GameState => {
  const state = createSt10009PreviewState('owner-turn')
  replaceHandCard(state, 'player-one', 'BS2-055', 'ST10-013')
  return state
}

/** Original sixty-card fixture with two physical Space Doughnuts in battle. */
export const createSt10009MultipleDepartureState = (): GameState => {
  const state = createSt10009PreviewState('opponent-turn')
  const player = state.players['player-one']
  const card = takeOriginalCard(state, 'player-one', 'ST10-009')
  const hpCard = player.deck.pop()
  if (!hpCard || card.type !== 'cookie' || card.hp !== 1) {
    throw new Error('Space Doughnut requires one original HP card')
  }
  player.battleArea.push({
    card,
    hpCards: [hpCard],
    rested: false,
    battleEntryId: `${card.instanceId}:entry`,
  })
  return state
}

/** Original sixty-card fixture with one physical Space Doughnut on each side. */
export const createSt10009BothPlayersDepartureState = (
  opponentDeck: 'normal' | 'last-card' = 'normal',
): GameState => {
  const state = createSt10009PreviewState('owner-turn')
  replaceBattleCookie(state, 'player-two', 'ST10-002', 'ST10-009')
  if (opponentDeck === 'last-card') {
    const opponent = state.players['player-two']
    opponent.discardPile.push(...opponent.deck.splice(0, Math.max(0, opponent.deck.length - 1)))
  }
  return state
}

/** Original sixty-card fixture where a real 1-damage attack causes Space Doughnut to faint. */
export const createSt10009FaintState = (): GameState => {
  const state = createSt10009PreviewState('opponent-turn')
  replaceBattleCookie(state, 'player-two', 'ST10-002', 'ST10-005')
  return state
}
