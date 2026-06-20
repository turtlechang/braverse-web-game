import { createSeededShuffle, defaultShuffle } from './helpers'
import {
  createGame,
  forceMulliganOpeningHand,
  selectStartingCookie,
} from './setup'
import {
  createOfficialBlueStarterDeck,
  createOfficialGreenStarterDeck,
  createOfficialYellowStarterDeck,
  DECK_CREATORS,
  type DeckChoice,
} from './starter-deck'
import type {
  CardEffect,
  CookieCard,
  EnergyColor,
  GameCard,
  GameState,
  PlayerId,
  PlayerState,
  TurnPhase,
} from './types'

export const isLocalhost = (hostname: string): boolean =>
  hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]'

export const parseTestStateConfig = (
  searchString: string,
  hostname: string,
):
  | { kind: 'break-to-trash'; level: 1 | 2 }
  | { kind: 'trap-response'; payable: boolean }
  | { kind: 'flip-response' }
  | { kind: 'replacement-choice' }
  | { kind: 'item-usage'; payable: boolean }
  | { kind: 'stage-usage'; payable: boolean }
  | { kind: 'faint-damage' }
  | { kind: 'trap-pretzel'; attack: 4 | 5 }
  | { kind: 'opponent-discard-hand' }
  | { kind: 'attack-effect' }
  | { kind: 'support-to-trash-skill' }
  | { kind: 'blue-activate-skill'; payable: boolean }
  | { kind: 'blue-optional-cost-attack'; payable: boolean }
  | { kind: 'blue-inspect-deck' }
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
  if (testState === 'flip-response') {
    return { kind: 'flip-response' }
  }
  if (testState === 'replacement-choice') {
    return { kind: 'replacement-choice' }
  }
  if (testState === 'item-payable') {
    return { kind: 'item-usage', payable: true }
  }
  if (testState === 'item-unpayable') {
    return { kind: 'item-usage', payable: false }
  }
  if (testState === 'stage-payable') {
    return { kind: 'stage-usage', payable: true }
  }
  if (testState === 'stage-unpayable') {
    return { kind: 'stage-usage', payable: false }
  }
  if (testState === 'faint-damage') {
    return { kind: 'faint-damage' }
  }
  if (testState === 'trap-pretzel-payable') {
    return { kind: 'trap-pretzel', attack: 5 }
  }
  if (testState === 'trap-pretzel-unpayable') {
    return { kind: 'trap-pretzel', attack: 4 }
  }
  if (testState === 'opponent-discard-hand') {
    return { kind: 'opponent-discard-hand' }
  }
  if (testState === 'attack-effect') {
    return { kind: 'attack-effect' }
  }
  if (testState === 'st3-002-skill') {
    return { kind: 'support-to-trash-skill' }
  }
  if (testState === 'blue-activate-payable') {
    return { kind: 'blue-activate-skill', payable: true }
  }
  if (testState === 'blue-activate-unpayable') {
    return { kind: 'blue-activate-skill', payable: false }
  }
  if (testState === 'blue-attack-payable') {
    return { kind: 'blue-optional-cost-attack', payable: true }
  }
  if (testState === 'blue-attack-unpayable') {
    return { kind: 'blue-optional-cost-attack', payable: false }
  }
  if (testState === 'blue-inspect-deck') {
    return { kind: 'blue-inspect-deck' }
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
    flipDisabledUntilTurn: {},
    pendingReplacement: null,
    departedCookieCounts: {
      'player-one': 0,
      'player-two': 0,
    },
    pendingRefresh: null,
    pendingBattle: null,
  }
}

export const createAttackEffectDemoState = (): GameState => {
  const p1Deck = createOfficialYellowStarterDeck('player-one')
  const p2Deck = createOfficialYellowStarterDeck('player-two')
  const wizard = p1Deck.find((card) => card.id === 'ST2-003') as CookieCard
  const breakCookie = p1Deck.find((card) => card.id === 'ST2-009') as CookieCard
  const defender = p2Deck.find((card) => card.id === 'ST2-009') as CookieCard

  return {
    players: {
      'player-one': {
        id: 'player-one',
        name: '玩家',
        ...createTestPlayerState(),
        battleArea: [
          {
            card: wizard,
            hpCards: [],
            rested: true,
            battleEntryId: `${wizard.instanceId}:battle:1`,
          },
        ],
        breakArea: [breakCookie],
      },
      'player-two': {
        id: 'player-two',
        name: 'AI 對手',
        ...createTestPlayerState(),
        battleArea: [
          {
            card: defender,
            hpCards: [],
            rested: false,
            battleEntryId: `${defender.instanceId}:battle:2`,
          },
        ],
      },
    },
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
    flipDisabledUntilTurn: {},
    pendingReplacement: null,
    departedCookieCounts: { 'player-one': 0, 'player-two': 0 },
    pendingRefresh: null,
    pendingBattle: {
      attackerPlayerId: 'player-one',
      defenderPlayerId: 'player-two',
      attackerInstanceId: wizard.instanceId,
      targetInstanceId: defender.instanceId,
      declaredDamage: wizard.attack,
      remainingDamage: 0,
      stage: 'attack-effect',
      trapUsed: false,
      revealedHpCard: null,
      preventKnockoutTargetIds: [],
      faintedColors: [],
      attackEffects: wizard.attackEffects ?? [],
      attackEffectIndex: 0,
    },
  }
}

export const createSupportToTrashSkillDemoState = (): GameState => {
  const p1Deck = createOfficialGreenStarterDeck('player-one')
  const p2Deck = createOfficialGreenStarterDeck('player-two')
  const strawberryCrepe = p1Deck.find(
    (card) => card.id === 'ST3-002',
  ) as CookieCard
  const supportCards = p1Deck
    .filter((card) => card.type !== 'cookie')
    .slice(0, 2)
  const defender = p2Deck.find(
    (card) => card.id === 'ST3-001',
  ) as CookieCard
  const opponentSupportCards = p2Deck
    .filter((card) => card.type !== 'cookie')
    .slice(0, 2)
  const hpCards = p2Deck
    .filter((card) => card.instanceId !== defender.instanceId)
    .slice(0, 2)

  return {
    players: {
      'player-one': {
        id: 'player-one',
        name: '玩家',
        ...createTestPlayerState(),
        battleArea: [
          {
            card: strawberryCrepe,
            hpCards: [],
            rested: false,
            battleEntryId: `${strawberryCrepe.instanceId}:battle:1`,
          },
        ],
        supportArea: supportCards.map((card) => ({
          card,
          rested: false,
        })),
      },
      'player-two': {
        id: 'player-two',
        name: 'AI 對手',
        ...createTestPlayerState(),
        battleArea: [
          {
            card: defender,
            hpCards,
            rested: false,
            battleEntryId: `${defender.instanceId}:battle:2`,
          },
        ],
        supportArea: opponentSupportCards.map((card) => ({
          card,
          rested: false,
        })),
      },
    },
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
    flipDisabledUntilTurn: {},
    pendingReplacement: null,
    departedCookieCounts: { 'player-one': 0, 'player-two': 0 },
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
    flipDisabledUntilTurn: {},
    pendingReplacement: null,
    departedCookieCounts: {
      'player-one': 0,
      'player-two': 0,
    },
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
      attackEffects: [],
      attackEffectIndex: 0,
    },
  }
}

export const createFlipResponseDemoState = (): GameState => {
  const p1Deck = DECK_CREATORS.red('player-one')
  const p2Deck = DECK_CREATORS.red('player-two')
  const revealedFlip = p1Deck.find(
    (card) => card.id === 'ST1-001' && card.flip,
  )!
  const defender = p1Deck.find(
    (card) =>
      card.type === 'cookie' &&
      card.instanceId !== revealedFlip.instanceId,
  ) as CookieCard
  const attacker = p2Deck.find((card) => card.type === 'cookie') as CookieCard
  const hand = p1Deck
    .filter(
      (card) =>
        card.instanceId !== revealedFlip.instanceId &&
        card.instanceId !== defender.instanceId,
    )
    .slice(0, 6)
  const usedP1 = new Set([
    revealedFlip.instanceId,
    defender.instanceId,
    ...hand.map((card) => card.instanceId),
  ])

  const p1: PlayerState = {
    id: 'player-one',
    name: '玩家',
    ...createTestPlayerState(),
    deck: p1Deck.filter((card) => !usedP1.has(card.instanceId)),
    hand,
    battleArea: [
      {
        card: defender,
        hpCards: [],
        rested: false,
        battleEntryId: `${defender.instanceId}:battle:1`,
      },
    ],
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

  return {
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
    flipDisabledUntilTurn: {},
    pendingReplacement: null,
    departedCookieCounts: {
      'player-one': 0,
      'player-two': 0,
    },
    pendingRefresh: null,
    pendingBattle: {
      attackerPlayerId: 'player-two',
      defenderPlayerId: 'player-one',
      attackerInstanceId: attacker.instanceId,
      targetInstanceId: defender.instanceId,
      declaredDamage: 1,
      remainingDamage: 0,
      stage: 'flip',
      trapUsed: false,
      revealedHpCard: revealedFlip,
      preventKnockoutTargetIds: [],
      faintedColors: [],
      attackEffects: [],
      attackEffectIndex: 0,
    },
  }
}

export const createReplacementChoiceDemoState = (): GameState => {
  const p1Deck = DECK_CREATORS.red('player-one')
  const p2Deck = DECK_CREATORS.red('player-two')
  const remainingCookie = p1Deck.find(
    (card) => card.type === 'cookie',
  ) as CookieCard
  const replacementCookie = p1Deck.find(
    (card) =>
      card.type === 'cookie' &&
      card.instanceId !== remainingCookie.instanceId,
  ) as CookieCard
  const opponentCookie = p2Deck.find(
    (card) => card.type === 'cookie',
  ) as CookieCard
  const usedP1 = new Set([
    remainingCookie.instanceId,
    replacementCookie.instanceId,
  ])

  return {
    players: {
      'player-one': {
        id: 'player-one',
        name: '玩家',
        ...createTestPlayerState(),
        deck: p1Deck.filter((card) => !usedP1.has(card.instanceId)),
        hand: [replacementCookie],
        battleArea: [
          {
            card: remainingCookie,
            hpCards: [],
            rested: false,
            battleEntryId: `${remainingCookie.instanceId}:battle:1`,
          },
        ],
      },
      'player-two': {
        id: 'player-two',
        name: 'AI 對手',
        ...createTestPlayerState(),
        battleArea: [
          {
            card: opponentCookie,
            hpCards: [],
            rested: false,
            battleEntryId: `${opponentCookie.instanceId}:battle:2`,
          },
        ],
      },
    },
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
    pendingReplacement: {
      tasks: [{ playerId: 'player-one', remaining: 1 }],
    },
    departedCookieCounts: {
      'player-one': 0,
      'player-two': 0,
    },
    pendingOnPlay: null,
    pendingRefresh: null,
    pendingBattle: null,
  }
}

const testCookieCard = (
  instanceId: string,
  level = 1,
  hp = 1,
  attack = 1,
): CookieCard => ({
  id: instanceId,
  instanceId,
  name: instanceId,
  type: 'cookie',
  level,
  hp,
  attack,
  attackCost: 0,
})

const testSupportCard = (
  instanceId: string,
  color: EnergyColor | 'wild' = 'red',
): GameCard => ({
  id: instanceId,
  instanceId,
  name: instanceId,
  type: 'item',
  energyColor: color,
})

const baseTestState = (
  activePlayerId: PlayerId,
  phase: TurnPhase,
): GameState => ({
  players: {
    'player-one': {
      id: 'player-one',
      name: '玩家',
      ...createTestPlayerState(),
    },
    'player-two': {
      id: 'player-two',
      name: 'AI 對手',
      ...createTestPlayerState(),
    },
  },
  firstPlayerId: activePlayerId,
  activePlayerId,
  turnNumber: 1,
  phase,
  status: 'playing',
  result: null,
  supportPlacedThisTurn: false,
  skillUsesThisTurn: [],
  nextBattleEntrySequence: 3,
  attackModifiers: [],
  damageReceivedModifiers: [],
  flipDisabledUntilTurn: {},
  pendingReplacement: null,
  departedCookieCounts: {
    'player-one': 0,
    'player-two': 0,
  },
  pendingOnPlay: null,
  pendingRefresh: null,
  pendingBattle: null,
})

export const createItemUsageDemoState = (payable: boolean): GameState => {
  const itemCard: GameCard = {
    id: 'test-item',
    instanceId: 'test-item-1',
    name: '測試物品',
    type: 'item',
    item: {
      cost: { red: 1 },
      text: '測試物品效果',
      effects: [
        {
          kind: 'modify-attack',
          amount: 1,
          duration: 'this-turn',
          target: { side: 'self', min: 1, max: 1 },
        },
      ],
    },
  }

  const p1Cookie = testCookieCard('p1-cookie')
  const p2Cookie = testCookieCard('p2-cookie')
  const support = testSupportCard('pay-1', 'red')

  const state = baseTestState('player-one', payable ? 'main' : 'support')

  return {
    ...state,
    players: {
      ...state.players,
      'player-one': {
        ...state.players['player-one'],
        hand: [itemCard],
        battleArea: [
          {
            card: p1Cookie,
            hpCards: [],
            rested: false,
            battleEntryId: `${p1Cookie.instanceId}:battle:1`,
          },
        ],
        supportArea: payable
          ? [{ card: support, rested: false }]
          : [],
      },
      'player-two': {
        ...state.players['player-two'],
        battleArea: [
          {
            card: p2Cookie,
            hpCards: [],
            rested: false,
            battleEntryId: `${p2Cookie.instanceId}:battle:2`,
          },
        ],
      },
    },
  }
}

export const createOpponentDiscardHandDemoState = (): GameState => {
  const p1Deck = createOfficialYellowStarterDeck('player-one')
  const p2Deck = createOfficialYellowStarterDeck('player-two')
  const roguefort = p2Deck.find((card) => card.id === 'ST2-001') as CookieCard
  const yellowSupport = p2Deck.find(
    (card) =>
      card.type !== 'cookie' &&
      (card.energyColor === 'yellow' || card.energyColor === 'wild'),
  )!
  const opponentCookie = p1Deck.find((card) => card.type === 'cookie') as CookieCard

  const p2HpCards = Array.from({ length: roguefort.hp }, (_, i) =>
    testSupportCard(`roguefort-hp-${i}`),
  )
  const p1HpCards = Array.from({ length: opponentCookie.hp }, (_, i) =>
    testSupportCard(`opp-hp-${i}`),
  )

  const p1HandCards = p1Deck
    .filter(
      (card) =>
        card.instanceId !== opponentCookie.instanceId &&
        card.type !== 'cookie',
    )
    .slice(0, 3)

  const usedP2 = new Set([
    roguefort.instanceId,
    yellowSupport.instanceId,
  ])
  const usedP1 = new Set([
    opponentCookie.instanceId,
    ...p1HandCards.map((c) => c.instanceId),
  ])

  return {
    players: {
      'player-one': {
        id: 'player-one',
        name: '玩家',
        ...createTestPlayerState(),
        deck: p1Deck.filter((c) => !usedP1.has(c.instanceId)),
        hand: p1HandCards,
        battleArea: [
          {
            card: opponentCookie,
            hpCards: p1HpCards,
            rested: false,
            battleEntryId: `${opponentCookie.instanceId}:battle:1`,
          },
        ],
      },
      'player-two': {
        id: 'player-two',
        name: 'AI 對手',
        ...createTestPlayerState(),
        deck: p2Deck.filter((c) => !usedP2.has(c.instanceId)),
        hand: [roguefort],
        battleArea: [
          {
            card: roguefort,
            hpCards: p2HpCards,
            rested: false,
            battleEntryId: `${roguefort.instanceId}:battle:2`,
          },
        ],
        supportArea: [{ card: yellowSupport, rested: false }],
      },
    },
    firstPlayerId: 'player-one',
    activePlayerId: 'player-two',
    turnNumber: 2,
    phase: 'main',
    status: 'playing',
    result: null,
    supportPlacedThisTurn: false,
    skillUsesThisTurn: [],
    nextBattleEntrySequence: 3,
    attackModifiers: [],
    damageReceivedModifiers: [],
    flipDisabledUntilTurn: {},
    pendingReplacement: null,
    departedCookieCounts: { 'player-one': 0, 'player-two': 0 },
    pendingOpponentHandDiscard: {
      playerId: 'player-one',
      count: 1,
      sourcePlayerId: 'player-two',
      sourceInstanceId: roguefort.instanceId,
      sourceCardName: 'Roguefort Cookie',
      effectText: 'opponent-discard-hand',
    },
    pendingRefresh: null,
    pendingBattle: null,
  }
}

export const createFaintDamageDemoState = (): GameState => {
  const p2Cookie = testCookieCard('p2-target', 1, 2)
  const faintCookie: CookieCard = {
    ...testCookieCard('cherry-cookie', 2),
    name: 'Cherry Cookie',
    attackCost: 0,
    attackEnergyCost: {},
    skill: {
      trigger: 'passive',
      oncePerTurn: false,
      yourTurn: false,
      restSource: false,
      cost: { energy: {}, discardHand: 0 },
      text: "When this Cookie faints, select up to 1 of your opponent's Cookies. That Cookie receives 1 damage.",
      effects: [
        {
          kind: 'damage',
          amount: 1,
          target: { side: 'opponent', min: 0, max: 1 },
        },
      ],
      faint: true,
    },
  }
  const state = baseTestState('player-one', 'main')
  return {
    ...state,
    players: {
      ...state.players,
      'player-one': {
        ...state.players['player-one'],
        breakArea: [faintCookie],
      },
      'player-two': {
        ...state.players['player-two'],
        battleArea: [
          {
            card: p2Cookie,
            hpCards: [testSupportCard('hp-1'), testSupportCard('hp-2')],
            rested: false,
            battleEntryId: `${p2Cookie.instanceId}:battle:1`,
          },
        ],
      },
    },
    pendingFaintEffects: [
      {
        sourcePlayerId: 'player-one',
        sourceInstanceId: faintCookie.instanceId,
        effect: {
          kind: 'damage',
          amount: 1,
          target: { side: 'opponent', min: 0, max: 1 },
        },
        context: {
          sourcePlayerId: 'player-one',
          sourceInstanceId: faintCookie.instanceId,
        },
      },
    ],
  }
}

export const createPretzelSnareDemoState = (attack: number): GameState => {
  const p1Deck = createOfficialYellowStarterDeck('player-one')
  const trap = p1Deck.find((card) => card.id === 'ST2-021')!
  const defender = p1Deck.find((card) => card.type === 'cookie') as CookieCard
  const p2Deck = createOfficialYellowStarterDeck('player-two')
  const attacker = p2Deck.find((card) => card.type === 'cookie') as CookieCard

  const requiredColor = Object.keys(trap.trap!.cost.energy)[0] as 'yellow'
  const requiredCount = trap.trap!.cost.energy[requiredColor] ?? 0
  const supports = p1Deck
    .filter(
      (card) =>
        card.type !== 'cookie' &&
        card.instanceId !== trap.instanceId &&
        (card.energyColor === requiredColor || card.energyColor === 'wild'),
    )
    .slice(0, requiredCount)

  const defenderHpCards = Array.from({ length: defender.hp }, (_, i) =>
    testSupportCard(`def-hp-${i}`),
  )
  const attackerHpCards = Array.from({ length: attacker.hp }, (_, i) =>
    testSupportCard(`atk-hp-${i}`),
  )

  const p1: PlayerState = {
    id: 'player-one',
    name: '玩家',
    ...createTestPlayerState(),
    hand: [trap],
    battleArea: [
      {
        card: defender,
        hpCards: defenderHpCards,
        rested: false,
        battleEntryId: `${defender.instanceId}:battle:1`,
      },
    ],
    supportArea: supports.length === requiredCount
      ? supports.map((card) => ({ card, rested: false }))
      : [],
  }
  const p2: PlayerState = {
    id: 'player-two',
    name: 'AI 對手',
    ...createTestPlayerState(),
    battleArea: [
      {
        card: attacker,
        hpCards: attackerHpCards,
        rested: false,
        battleEntryId: `${attacker.instanceId}:battle:2`,
      },
    ],
  }

  return {
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
    flipDisabledUntilTurn: {},
    pendingReplacement: null,
    departedCookieCounts: { 'player-one': 0, 'player-two': 0 },
    pendingRefresh: null,
    pendingBattle: {
      attackerPlayerId: 'player-two',
      defenderPlayerId: 'player-one',
      attackerInstanceId: attacker.instanceId,
      targetInstanceId: defender.instanceId,
      declaredDamage: attack,
      remainingDamage: attack,
      stage: 'trap',
      trapUsed: false,
      revealedHpCard: null,
      preventKnockoutTargetIds: [],
      faintedColors: [],
      attackEffects: [],
      attackEffectIndex: 0,
    },
  }
}

export const createStageUsageDemoState = (payable: boolean): GameState => {
  const stageCard: GameCard = {
    id: 'test-stage',
    instanceId: 'test-stage-1',
    name: '測試場景',
    type: 'stage',
    stageAbility: {
      placementCost: { red: 1 },
      cost: { red: 1 },
      text: '測試場景效果',
      restSource: true,
      effects: [
        {
          kind: 'modify-attack',
          amount: 1,
          duration: 'this-turn',
          target: { side: 'self', min: 1, max: 1 },
        },
      ],
    },
  }

  const oldStage: GameCard = {
    id: 'old-stage',
    instanceId: 'old-stage-1',
    name: '舊場景',
    type: 'stage',
  }

  const p1Cookie = testCookieCard('p1-cookie')
  const p2Cookie = testCookieCard('p2-cookie')
  const support1 = testSupportCard('pay-1', 'red')
  const support2 = testSupportCard('pay-2', 'red')

  if (payable) {
    const state = baseTestState('player-one', 'main')
    return {
      ...state,
      players: {
        ...state.players,
        'player-one': {
          ...state.players['player-one'],
          hand: [stageCard],
          battleArea: [
            {
              card: p1Cookie,
              hpCards: [],
              rested: false,
              battleEntryId: `${p1Cookie.instanceId}:battle:1`,
            },
          ],
          supportArea: [
            { card: support1, rested: false },
            { card: support2, rested: false },
          ],
          stage: { card: oldStage, rested: false },
        },
        'player-two': {
          ...state.players['player-two'],
          battleArea: [
            {
              card: p2Cookie,
              hpCards: [],
              rested: false,
              battleEntryId: `${p2Cookie.instanceId}:battle:2`,
            },
          ],
        },
      },
    }
  }

  const state = baseTestState('player-one', 'main')
  return {
    ...state,
    players: {
      ...state.players,
      'player-one': {
        ...state.players['player-one'],
        battleArea: [
          {
            card: p1Cookie,
            hpCards: [],
            rested: false,
            battleEntryId: `${p1Cookie.instanceId}:battle:1`,
          },
        ],
        supportArea: [
          { card: support1, rested: false },
          { card: support2, rested: false },
        ],
        stage: { card: stageCard, rested: true },
      },
      'player-two': {
        ...state.players['player-two'],
        battleArea: [
          {
            card: p2Cookie,
            hpCards: [],
            rested: false,
            battleEntryId: `${p2Cookie.instanceId}:battle:2`,
          },
        ],
      },
    },
  }
}
export const createBlueActivateSkillDemoState = (payable: boolean): GameState => {
  const p1Deck = createOfficialBlueStarterDeck('player-one')
  const p2Deck = createOfficialBlueStarterDeck('player-two')
  const werewolf = p1Deck.find((c) => c.id === 'ST4-012') as CookieCard
  const handCards = p1Deck.filter((c) => c.instanceId !== werewolf.instanceId && c.type !== 'cookie').slice(0, payable ? 3 : 0)
  const defender = p2Deck.find((c) => c.type === 'cookie') as CookieCard
  const usedP1 = new Set([werewolf.instanceId, ...handCards.map((c) => c.instanceId)])
  const usedP2 = new Set([defender.instanceId])
  return {
    players: {
      'player-one': {
        id: 'player-one',
        name: '玩家',
        ...createTestPlayerState(),
        deck: p1Deck.filter((c) => !usedP1.has(c.instanceId)),
        hand: handCards,
        battleArea: [{ card: werewolf, hpCards: [], rested: false, battleEntryId: `${werewolf.instanceId}:battle:1` }],
      },
      'player-two': {
        id: 'player-two',
        name: 'AI 對手',
        ...createTestPlayerState(),
        deck: p2Deck.filter((c) => !usedP2.has(c.instanceId)),
        battleArea: [{ card: defender, hpCards: [], rested: false, battleEntryId: `${defender.instanceId}:battle:2` }],
      },
    },
    firstPlayerId: 'player-one', activePlayerId: 'player-one', turnNumber: 1, phase: 'main', status: 'playing', result: null,
    supportPlacedThisTurn: false, skillUsesThisTurn: [], nextBattleEntrySequence: 3, attackModifiers: [], damageReceivedModifiers: [],
    flipDisabledUntilTurn: {}, pendingReplacement: null, departedCookieCounts: { 'player-one': 0, 'player-two': 0 }, pendingRefresh: null, pendingBattle: null,
  }
}

export const createBlueOptionalCostAttackDemoState = (payable: boolean): GameState => {
  const p1Deck = createOfficialBlueStarterDeck('player-one')
  const p2Deck = createOfficialBlueStarterDeck('player-two')
  const caviar = p1Deck.find((c) => c.id === 'ST4-013') as CookieCard
  const handCards = p1Deck.filter((c) => c.instanceId !== caviar.instanceId && c.type !== 'cookie').slice(0, payable ? 4 : 1)
  const defender = p2Deck.find((c) => c.type === 'cookie') as CookieCard
  const usedP1 = new Set([caviar.instanceId, ...handCards.map((c) => c.instanceId)])
  const usedP2 = new Set([defender.instanceId])
  const optEffect: CardEffect = {
    kind: 'optional-cost-attack',
    cost: { energy: {}, discardHand: 2 },
    effects: [{ kind: 'damage', amount: 1, target: { side: 'opponent', min: 1, max: 1 } }],
    effectText: 'Discard 2 cards from your hand to deal 1 damage to 1 opponent cookie.',
  }
  return {
    players: {
      'player-one': {
        id: 'player-one',
        name: '玩家',
        ...createTestPlayerState(),
        deck: p1Deck.filter((c) => !usedP1.has(c.instanceId)),
        hand: handCards,
        battleArea: [{ card: { ...caviar, attackEffects: [optEffect] }, hpCards: [], rested: true, battleEntryId: `${caviar.instanceId}:battle:1` }],
      },
      'player-two': {
        id: 'player-two',
        name: 'AI 對手',
        ...createTestPlayerState(),
        deck: p2Deck.filter((c) => !usedP2.has(c.instanceId)),
        battleArea: [{ card: defender, hpCards: [], rested: false, battleEntryId: `${defender.instanceId}:battle:2` }],
      },
    },
    firstPlayerId: 'player-one', activePlayerId: 'player-one', turnNumber: 1, phase: 'main', status: 'playing', result: null,
    supportPlacedThisTurn: false, skillUsesThisTurn: [], nextBattleEntrySequence: 3, attackModifiers: [], damageReceivedModifiers: [],
    flipDisabledUntilTurn: {}, pendingReplacement: null, departedCookieCounts: { 'player-one': 0, 'player-two': 0 }, pendingRefresh: null,
    pendingBattle: {
      attackerPlayerId: 'player-one', defenderPlayerId: 'player-two',
      attackerInstanceId: caviar.instanceId, targetInstanceId: defender.instanceId,
      declaredDamage: 1, remainingDamage: 0, stage: 'attack-effect',
      trapUsed: false, revealedHpCard: null, preventKnockoutTargetIds: [],
      faintedColors: [], attackEffects: [optEffect], attackEffectIndex: 0,
    },
  }
}

export const createBlueInspectDeckDemoState = (): GameState => {
  const p1Deck = createOfficialBlueStarterDeck('player-one')
  const p2Deck = createOfficialBlueStarterDeck('player-two')
  const caviar = p1Deck.find((c) => c.id === 'ST4-013') as CookieCard
  const deckTop3 = p1Deck.filter((c) => c.instanceId !== caviar.instanceId).slice(0, 3)
  const defender = p2Deck.find((c) => c.type === 'cookie') as CookieCard
  const usedP1 = new Set([caviar.instanceId, ...deckTop3.map((c) => c.instanceId)])
  const usedP2 = new Set([defender.instanceId])
  return {
    players: {
      'player-one': {
        id: 'player-one',
        name: '玩家',
        ...createTestPlayerState(),
        deck: p1Deck.filter((c) => !usedP1.has(c.instanceId)),
        battleArea: [{ card: caviar, hpCards: [], rested: false, battleEntryId: `${caviar.instanceId}:battle:1` }],
      },
      'player-two': {
        id: 'player-two',
        name: 'AI 對手',
        ...createTestPlayerState(),
        deck: p2Deck.filter((c) => !usedP2.has(c.instanceId)),
        battleArea: [{ card: defender, hpCards: [], rested: false, battleEntryId: `${defender.instanceId}:battle:2` }],
      },
    },
    firstPlayerId: 'player-one', activePlayerId: 'player-one', turnNumber: 1, phase: 'main', status: 'playing', result: null,
    supportPlacedThisTurn: false, skillUsesThisTurn: [], nextBattleEntrySequence: 3, attackModifiers: [], damageReceivedModifiers: [],
    flipDisabledUntilTurn: {}, pendingReplacement: null, departedCookieCounts: { 'player-one': 0, 'player-two': 0 }, pendingRefresh: null, pendingBattle: null,
    pendingInspectDeck: {
      playerId: 'player-one',
      sourceInstanceId: caviar.instanceId,
      sourceCardName: 'Captain Caviar Cookie',
      revealedCards: deckTop3,
      lookCount: 3,
      pickCount: 1,
    },
  }
}
