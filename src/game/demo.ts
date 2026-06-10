import { createSeededShuffle, defaultShuffle } from './helpers'
import {
  createGame,
  forceMulliganOpeningHand,
  selectStartingCookie,
} from './setup'
import {
  createOfficialYellowStarterDeck,
  DECK_CREATORS,
  type DeckChoice,
} from './starter-deck'
import type { CookieCard, GameCard, GameState, PlayerState } from './types'

export const isLocalhost = (hostname: string): boolean =>
  hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]'

export const parseTestStateConfig = (
  searchString: string,
  hostname: string,
):
  | { kind: 'break-to-trash'; level: 1 | 2 }
  | { kind: 'trap-response'; payable: boolean }
  | null => {
  if (!isLocalhost(hostname)) return null
  const params = new URLSearchParams(searchString)
  const testState = params.get('test-state')
  if (testState === 'break-to-trash-lv1') {
    return { kind: 'break-to-trash', level: 1 }
  }
  if (testState === 'break-to-trash-lv2') {
    return { kind: 'break-to-trash', level: 2 }
  }
  if (testState === 'trap-payable') {
    return { kind: 'trap-response', payable: true }
  }
  if (testState === 'trap-unpayable') {
    return { kind: 'trap-response', payable: false }
  }
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

const ensureOpeningCookie = (
  state: GameState,
  playerId: 'player-one' | 'player-two',
  shuffle: (cards: GameCard[]) => GameCard[],
) => {
  let nextState = state
  let attempts = 0

  while (
    !nextState.players[playerId].hand.some(
      (card) => card.type === 'cookie',
    ) &&
    attempts < 100
  ) {
    nextState = forceMulliganOpeningHand(nextState, playerId, shuffle)
    attempts += 1
  }

  if (attempts >= 100) {
    throw new Error(`無法替 ${playerId} 取得含餅乾的起始手牌。`)
  }

  return nextState
}

export type DeckConfig = DeckChoice | { player: DeckChoice; ai: DeckChoice }

export const createDemoSetupGame = (
  firstPlayerId: 'player-one' | 'player-two',
  deck: DeckConfig = 'red',
  seed?: number,
): GameState => {
  const playerChoice = typeof deck === 'string' ? deck : deck.player
  const aiChoice = typeof deck === 'string' ? deck : deck.ai
  const shuffle =
    seed === undefined ? defaultShuffle : createSeededShuffle(seed)

  return createGame(
    {
      id: 'player-one',
      name: '玩家',
      deck: DECK_CREATORS[playerChoice]('player-one'),
    },
    {
      id: 'player-two',
      name: 'AI 對手',
      deck: DECK_CREATORS[aiChoice]('player-two'),
    },
    firstPlayerId,
    shuffle,
  )
}

export const createDemoGame = (
  seed?: number,
  deck: DeckConfig = 'red',
): GameState => {
  const effectiveSeed = seed ?? 7
  const shuffle = createSeededShuffle(effectiveSeed)
  let state = createDemoSetupGame('player-one', deck, effectiveSeed)

  state = ensureOpeningCookie(state, 'player-one', shuffle)
  state = ensureOpeningCookie(state, 'player-two', shuffle)
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
  freeMulliganDecided: true,
  forcedMulliganCount: 0,
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
    pendingBattle: null,
  }
}

export const createTrapResponseDemoState = (payable: boolean): GameState => {
  const p1Deck = createOfficialYellowStarterDeck('player-one')
  const p2Deck = createOfficialYellowStarterDeck('player-two')
  const trap = p1Deck.find((card) => card.id === 'ST2-020')!
  const defender = p1Deck.find((card) => card.type === 'cookie') as CookieCard
  const attacker = p2Deck.find((card) => card.type === 'cookie') as CookieCard
  const breakArea: CookieCard[] = []
  let breakLevel = 0
  for (const card of p1Deck) {
    if (card.type !== 'cookie' || card.instanceId === defender.instanceId) {
      continue
    }
    breakArea.push(card)
    breakLevel += card.level
    if (breakLevel >= 5) break
  }
  const requiredColor = Object.keys(trap.trap!.cost.energy)[0] as
    | 'red'
    | 'yellow'
    | 'green'
    | 'blue'
    | 'purple'
    | 'black'
  const requiredCount = trap.trap!.cost.energy[requiredColor] ?? 0
  const supports = p1Deck
    .filter(
      (card) =>
        card.type !== 'cookie' &&
        card.instanceId !== trap.instanceId &&
        (card.energyColor === requiredColor || card.energyColor === 'wild'),
    )
    .slice(0, requiredCount)

  if (supports.length !== requiredCount) {
    throw new Error('測試牌組沒有足夠的同色或萬用支援卡支付陷阱費用。')
  }

  const p1: PlayerState = {
    id: 'player-one',
    name: '玩家',
    ...createTestPlayerState(),
    hand: [trap],
    battleArea: [
      {
        card: defender,
        hpCards: [],
        rested: false,
        battleEntryId: `${defender.instanceId}:battle:1`,
      },
    ],
    supportArea: payable
      ? supports.map((card) => ({ card, rested: false }))
      : [],
    breakArea,
  }
  const p2: PlayerState = {
    id: 'player-two',
    name: 'AI 對手',
    ...createTestPlayerState(),
    battleArea: [
      {
        card: attacker,
        hpCards: [],
        rested: false,
        battleEntryId: `${attacker.instanceId}:battle:2`,
      },
    ],
  }
  const state: GameState = {
    players: { 'player-one': p1, 'player-two': p2 },
    firstPlayerId: 'player-two',
    activePlayerId: 'player-two',
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
    pendingBattle: null,
  }

  return {
    ...state,
    pendingBattle: {
      attackerPlayerId: 'player-two',
      defenderPlayerId: 'player-one',
      attackerInstanceId: attacker.instanceId,
      targetInstanceId: defender.instanceId,
      declaredDamage: attacker.attack,
      remainingDamage: attacker.attack,
      stage: 'trap',
      trapUsed: false,
      revealedHpCard: null,
      preventKnockoutTargetIds: [],
      faintedColors: [],
    },
  }
}
