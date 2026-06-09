import { createSeededShuffle } from './helpers'
import { createGame, selectStartingCookie } from './setup'
import {
  createOfficialYellowStarterDeck,
  DECK_CREATORS,
  type DeckChoice,
} from './starter-deck'
import type { CookieCard, GameCard, GameState, PlayerState } from './types'

const identityShuffle = (cards: GameCard[]) => [...cards]

export const isLocalhost = (hostname: string): boolean =>
  hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]'

export const parseTestStateConfig = (
  searchString: string,
  hostname: string,
): { level: 1 | 2 } | null => {
  if (!isLocalhost(hostname)) return null
  const params = new URLSearchParams(searchString)
  const testState = params.get('test-state')
  if (testState === 'break-to-trash-lv1') return { level: 1 }
  if (testState === 'break-to-trash-lv2') return { level: 2 }
  return null
}

const selectFirstCookie = (
  state: GameState,
  playerId: 'player-one' | 'player-two',
) => {
  const cookie = state.players[playerId].hand.find(
    (card) => card.type === 'cookie',
  )

  if (!cookie) {
    throw new Error(`種子牌序未讓 ${playerId} 抽到起始餅乾。`)
  }

  return selectStartingCookie(state, playerId, cookie.instanceId)
}

export type DeckConfig = DeckChoice | { player: DeckChoice; ai: DeckChoice }

export const createDemoGame = (
  seed?: number,
  deck: DeckConfig = 'red',
): GameState => {
  const playerChoice = typeof deck === 'string' ? deck : deck.player
  const aiChoice = typeof deck === 'string' ? deck : deck.ai
  const createPlayerDeck = DECK_CREATORS[playerChoice]
  const createAiDeck = DECK_CREATORS[aiChoice]

  let state = createGame(
    {
      id: 'player-one',
      name: '玩家',
      deck: createPlayerDeck('player-one'),
    },
    {
      id: 'player-two',
      name: 'AI 對手',
      deck: createAiDeck('player-two'),
    },
    'player-one',
    seed === undefined ? identityShuffle : createSeededShuffle(seed),
  )

  state = selectFirstCookie(state, 'player-one')
  state = selectFirstCookie(state, 'player-two')

  return state
}

const createTestPlayerState = (): Omit<PlayerState, 'id' | 'name'> => ({
  deck: [],
  hand: [],
  battleArea: [],
  supportArea: [],
  breakArea: [],
  discardPile: [],
  stage: null,
  hasMulliganed: true,
  startingCookieSelected: true,
})

export const createBreakToTrashDemoState = (
  breakAreaLevel: 1 | 2 = 1,
): GameState => {
  const p1Deck = createOfficialYellowStarterDeck('player-one')
  const p2Deck = createOfficialYellowStarterDeck('player-two')

  const eclair = p1Deck.find((c) => c.id === 'ST2-008')!
  const battleCookie = p1Deck.find((c) => c.id === 'ST2-002')!
  const breakCookie =
    breakAreaLevel === 1
      ? p1Deck.find((c) => c.id === 'ST2-009')!
      : p1Deck.find((c) => c.id === 'ST2-004')!
  const support1 = p1Deck.find((c) => c.id === 'ST2-016')!
  const support2 = p1Deck.find(
    (c) => c.id === 'ST2-019' && c.instanceId !== support1.instanceId,
  )!

  const p2Cookie = p2Deck.find((c) => c.id === 'ST2-009')!

  const usedP1 = new Set([
    eclair.instanceId,
    battleCookie.instanceId,
    breakCookie.instanceId,
    support1.instanceId,
    support2.instanceId,
  ])
  const p1: PlayerState = {
    id: 'player-one',
    name: '玩家',
    ...createTestPlayerState(),
    deck: p1Deck.filter((c) => !usedP1.has(c.instanceId)),
    hand: [eclair],
    battleArea: [
      {
        card: battleCookie as CookieCard,
        hpCards: [],
        rested: false,
        battleEntryId: `${battleCookie.instanceId}:battle:1`,
      },
    ],
    supportArea: [
      { card: support1, rested: false },
      { card: support2, rested: false },
    ],
    breakArea: [breakCookie as CookieCard],
  }

  const usedP2 = new Set([p2Cookie.instanceId])
  const p2: PlayerState = {
    id: 'player-two',
    name: 'AI 對手',
    ...createTestPlayerState(),
    deck: p2Deck.filter((c) => !usedP2.has(c.instanceId)),
    hand: [p2Cookie],
    battleArea: [
      {
        card: p2Cookie as CookieCard,
        hpCards: [],
        rested: false,
        battleEntryId: `${p2Cookie.instanceId}:battle:2`,
      },
    ],
  }

  return {
    players: { 'player-one': p1, 'player-two': p2 },
    firstPlayerId: 'player-one',
    activePlayerId: 'player-one',
    turnNumber: 1,
    phase: 'main',
    status: 'playing',
    result: null,
    supportPlacedThisTurn: false,
    skillUsesThisTurn: [],
    nextBattleEntrySequence: 3,
    attackModifiers: [],
    damageReceivedModifiers: [],
    pendingReplacementPlayerId: null,
    pendingRefresh: null,
  }
}
