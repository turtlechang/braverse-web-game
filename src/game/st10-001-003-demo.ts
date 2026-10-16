import candidateDocument from '../../data/candidates/st6-st10/official-st10.en.json'
import type { OfficialCardRecord } from '../cards/types'
import { getAllCardPoolEntries, getCardPoolEntry, hasFlipAbility } from './card-pool'
import { createCard, createOfficialRedStarterDeck } from './starter-deck'
import { createGame } from './setup'
import type { CookieInBattle, GameCard, GameState, PlayerId } from './types'

export type St10001To003CardNumber = 'ST10-001' | 'ST10-003'
export type St10001To003Scenario = 'attack' | 'insufficient-energy'

const candidateCards = candidateDocument.cards as OfficialCardRecord[]
export const rawSt10001To003 = (cardNumber: St10001To003CardNumber): OfficialCardRecord => {
  const record = getCardPoolEntry(cardNumber) ?? candidateCards.find(card => card.cardNumber === cardNumber)
  if (!record) throw new Error(`Original ${cardNumber} printing is required`)
  return record
}

export const st10001To003Zones = (state: GameState, playerId: PlayerId): GameCard[] => {
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

/** Original card identities, HP, and purple attack payment for the ST10 FLIP previews. */
export const createSt10001To003PreviewState = (
  cardNumber: St10001To003CardNumber,
  scenario: St10001To003Scenario = 'attack',
): GameState => {
  const counts = new Map<string, number>()
  const card = (number: string, owner: PlayerId): GameCard => {
    const key = `${owner}:${number}`
    const copy = (counts.get(key) ?? 0) + 1
    if (copy > 4) throw new Error(`Original four-copy limit: ${key}`)
    counts.set(key, copy)
    const raw = number.startsWith('ST10-00')
      ? rawSt10001To003(number as St10001To003CardNumber)
      : getCardPoolEntry(number)
    if (!raw) throw new Error(`Missing original printing ${number}`)
    return createCard(raw, owner, copy)
  }
  const filler = (count: number, owner: PlayerId): GameCard[] => {
    if (count === 0) return []
    const result: GameCard[] = []
    for (const raw of getAllCardPoolEntries()) {
      if (raw.variant || raw.type === 'extra' || hasFlipAbility(raw) ||
          (counts.get(`${owner}:${raw.baseCardNumber}`) ?? 0) >= 4) continue
      result.push(card(raw.baseCardNumber, owner))
      if (result.length === count) return result
    }
    throw new Error('Insufficient original-printing fillers')
  }
  const battle = (number: string, owner: PlayerId): CookieInBattle => {
    const source = card(number, owner)
    if (source.type !== 'cookie') throw new Error(`Expected Cookie ${number}`)
    return {
      card: source,
      hpCards: filler(source.hp, owner),
      rested: false,
      battleEntryId: `${source.instanceId}:entry`,
    }
  }

  const state = createGame(
    { id: 'player-one', name: 'ST10-001～003 實體驗收', deck: createOfficialRedStarterDeck('player-one') },
    { id: 'player-two', name: '實體對手', deck: createOfficialRedStarterDeck('player-two') },
    'player-one',
    cards => cards,
  )
  state.status = 'playing'
  state.phase = 'main'
  state.turnNumber = 3
  for (const player of Object.values(state.players)) {
    player.deck = []
    player.hand = []
    player.supportArea = []
    player.breakArea = []
    player.discardPile = []
    player.battleArea = []
    player.stage = null
    player.startingCookieSelected = true
  }

  const owner = state.players['player-one']
  const opponent = state.players['player-two']
  const supportCount = scenario === 'insufficient-energy' ? 2 : 3
  owner.battleArea = [battle(cardNumber, 'player-one'), battle('ST1-011', 'player-one')]
  opponent.battleArea = [battle('ST6-003', 'player-two')]
  owner.supportArea = Array.from({ length: supportCount }, () => ({
    card: card('BS9-096', 'player-one'),
    rested: false,
  }))

  // A real three-damage attack reveals the printed FLIP from the target's HP.
  const target = opponent.battleArea[0]
  const position = 1
  const displaced = target.hpCards[position]
  if (!displaced) throw new Error('The four-HP physical target is required')
  target.hpCards[position] = card(cardNumber, 'player-two')
  opponent.deck.push(displaced)

  for (const playerId of ['player-one', 'player-two'] as const) {
    const remaining = 60 - st10001To003Zones(state, playerId).length
    state.players[playerId].deck.push(...filler(remaining, playerId))
    const cards = st10001To003Zones(state, playerId)
    if (cards.length !== 60 || new Set(cards.map(item => item.instanceId)).size !== 60) {
      throw new Error(`Original sixty-card identities required for ${playerId}`)
    }
    const copyCounts = new Map<string, number>()
    for (const item of cards) copyCounts.set(item.id, (copyCounts.get(item.id) ?? 0) + 1)
    if ([...copyCounts.values()].some(count => count > 4)) throw new Error('Original four-copy limit')
  }
  return state
}
