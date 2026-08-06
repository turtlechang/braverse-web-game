import { createSeededShuffle, defaultShuffle } from './helpers'
import {
  createGame,
  forceMulliganOpeningHand,
  selectStartingCookie,
} from './setup'
import {
  createCard,
  createOfficialBlueStarterDeck,
  createOfficialGreenStarterDeck,
  createOfficialPurpleStarterDeck,
  createOfficialYellowStarterDeck,
  type BuiltInDeckChoice,
  DECK_CREATORS,
  type DeckChoice,
} from './starter-deck'
import { getCardPoolEntry } from './card-pool'
import type {
  CustomDeck,
} from './custom-deck'
import { createDeckFromCustomDeck } from './custom-deck'
import type {
  CardEffect,
  CookieCard,
  EnergyColor,
  GameCard,
  GameState,
  PendingBattle,
  PendingFaintEffect,
  PlayerId,
  PlayerState,
  TurnPhase,
} from './types'

export const isLocalhost = (hostname: string): boolean =>
  hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]'

export const BS4_CONDITION_CARD_NUMBERS = [
  'BS4-011',
  'BS4-012',
  'BS4-014',
  'BS4-016',
  'BS4-020',
  'BS4-023',
  'BS4-024',
  'BS4-039',
  'BS4-040',
  'BS4-048',
  'BS4-049',
  'BS4-052',
  'BS4-053',
  'BS4-059',
  'BS4-061',
  'BS4-073',
  'BS4-083',
  'BS4-089',
  'BS4-090',
  'BS4-094',
  'BS4-106',
  'BS4-107',
] as const

export type Bs4ConditionCardNumber =
  (typeof BS4_CONDITION_CARD_NUMBERS)[number]

const isBs4ConditionCardNumber = (
  value: string,
): value is Bs4ConditionCardNumber =>
  (BS4_CONDITION_CARD_NUMBERS as readonly string[]).includes(value)

export const parseTestStateConfig = (
  searchString: string,
  hostname: string,
):
  | { kind: 'break-to-trash'; level: 1 | 2 }
  | { kind: 'trap-response'; payable: boolean }
  | { kind: 'blocker-response'; payable: boolean }
  | { kind: 'trap-and-blocker-response'; payable: boolean }
  | { kind: 'flip-response' }
  | { kind: 'replacement-choice' }
  | { kind: 'st5-010-on-play' }
  | { kind: 'ai-discard-reveal' }
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
  | { kind: 'blue-st4-016' }
  | { kind: 'blue-st4-017' }
  | { kind: 'blue-st4-018' }
  | { kind: 'blue-st4-019' }
  | { kind: 'blue-st4-020'; payable: boolean }
  | { kind: 'card-check'; cardNumber: string }
  | {
      kind: 'bs4-condition'
      cardNumber: Bs4ConditionCardNumber
      conditionMet: boolean
    }
  | { kind: 'bs3-121-special-victory' }
  | { kind: 'soul-jam-019-equipped' }
  | { kind: 'soul-jam-043-equipped' }
  | { kind: 'soul-jam-066-equipped' }
  | { kind: 'soul-jam-091-equipped' }
  | { kind: 'soul-jam-115-equipped' }
  | { kind: 'soul-jam-115-protection-demo' }
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
  if (testState === 'blocker-payable') {
    return { kind: 'blocker-response', payable: true }
  }
  if (testState === 'blocker-unpayable') {
    return { kind: 'blocker-response', payable: false }
  }
  if (testState === 'trap-and-blocker-payable') {
    return { kind: 'trap-and-blocker-response', payable: true }
  }
  if (testState === 'trap-and-blocker-unpayable') {
    return { kind: 'trap-and-blocker-response', payable: false }
  }
  if (testState === 'flip-response') {
    return { kind: 'flip-response' }
  }
  if (testState === 'replacement-choice') {
    return { kind: 'replacement-choice' }
  }
  if (testState === 'st5-010-on-play') {
    return { kind: 'st5-010-on-play' }
  }
  if (testState === 'ai-discard-reveal') {
    return { kind: 'ai-discard-reveal' }
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
  if (
    testState === 'blue-st4-016' ||
    testState === 'blue-st4-017' ||
    testState === 'blue-st4-018' ||
    testState === 'blue-st4-019'
  ) {
    return { kind: testState }
  }
  if (testState === 'blue-st4-020-payable') {
    return { kind: 'blue-st4-020', payable: true }
  }
  if (testState === 'blue-st4-020-unpayable') {
    return { kind: 'blue-st4-020', payable: false }
  }
  if (testState?.startsWith('card:')) {
    const cardNumber = testState.slice('card:'.length).trim()
    if (cardNumber.length > 0) {
      return { kind: 'card-check', cardNumber }
    }
  }
  if (testState?.startsWith('bs4-condition:')) {
    const [, cardNumber, result] = testState.split(':')
    if (
      cardNumber &&
      isBs4ConditionCardNumber(cardNumber) &&
      (result === 'met' || result === 'unmet')
    ) {
      return {
        kind: 'bs4-condition',
        cardNumber,
        conditionMet: result === 'met',
      }
    }
  }
  if (testState === 'bs3-121-special-victory') {
    return { kind: 'bs3-121-special-victory' }
  }
  if (testState === 'soul-jam-019-equipped') return { kind: 'soul-jam-019-equipped' }
  if (testState === 'soul-jam-043-equipped') return { kind: 'soul-jam-043-equipped' }
  if (testState === 'soul-jam-066-equipped') return { kind: 'soul-jam-066-equipped' }
  if (testState === 'soul-jam-091-equipped') return { kind: 'soul-jam-091-equipped' }
  if (testState === 'soul-jam-115-equipped') return { kind: 'soul-jam-115-equipped' }
  if (testState === 'soul-jam-115-protection-demo') return { kind: 'soul-jam-115-protection-demo' }
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

export type DeckConfig =
  | DeckChoice
  | { player: DeckChoice; ai: BuiltInDeckChoice }

export const createDemoSetupGame = (
  firstPlayerId: 'player-one' | 'player-two',
  deck: DeckConfig = 'red',
  seed?: number,
  playerCustomDeck?: CustomDeck,
): GameState => {
  const playerChoice = typeof deck === 'string' ? deck : deck.player
  const aiChoice =
    typeof deck === 'string' ? (deck === 'custom' ? 'red' : deck) : deck.ai
  const builtInPlayerChoice =
    playerChoice === 'custom' ? 'red' : playerChoice
  const shuffle =
    seed === undefined ? defaultShuffle : createSeededShuffle(seed)

  const playerDeck =
    playerChoice === 'custom' && playerCustomDeck
      ? createDeckFromCustomDeck(playerCustomDeck, 'player-one')
      : DECK_CREATORS[builtInPlayerChoice]('player-one')

  return createGame(
    {
      id: 'player-one',
      name: '玩家',
      deck: playerDeck,
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
  const requiredColor = Object.keys(trap.trap!.cost.energy ?? trap.trap!.cost)[0] as
    | 'red'
    | 'yellow'
    | 'green'
    | 'blue'
    | 'purple'
    | 'black'
  const requiredCount =
    (trap.trap!.cost.energy ?? trap.trap!.cost)[requiredColor] ?? 0
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

export const createBlockerResponseDemoState = (payable: boolean): GameState => {
  const p1Deck = createOfficialYellowStarterDeck('player-one')
  const p2Deck = createOfficialYellowStarterDeck('player-two')
  const defender = p1Deck.find((card) => card.type === 'cookie') as CookieCard
  const attacker = p2Deck.find((card) => card.type === 'cookie') as CookieCard

  const blockerCookie: CookieCard = {
    ...defender,
    instanceId: 'blocker-cookie-demo',
    id: 'BS1-009',
    name: 'Affogato Cookie',
    level: 1,
    hp: 3,
    attack: 1,
    attackCost: 2,
    energyColor: 'red',
    skill: {
      trigger: 'block',
      oncePerTurn: false,
      yourTurn: false,
      restSource: false,
      cost: { energy: { red: 1 }, discardHand: 0, trashBattleCookie: undefined },
      text: '{bl} 《{R}》',
      effects: [
        {
          kind: 'redirect-attack',
          target: { side: 'self', min: 1, max: 1, sourceOnly: true },
        },
      ],
    },
    attackEffects: [],
    effectText: '',
    trap: undefined,
    flip: undefined,
  }

  const supports = p1Deck
    .filter(
      (card) =>
        card.type !== 'cookie' &&
        card.instanceId !== defender.instanceId &&
        (card.energyColor === 'red' || card.energyColor === 'wild'),
    )
    .slice(0, 1)

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

  const p1: PlayerState = {
    id: 'player-one',
    name: '玩家',
    ...createTestPlayerState(),
    hand: [],
    battleArea: [
      {
        card: defender,
        hpCards: [],
        rested: false,
        battleEntryId: `${defender.instanceId}:battle:1`,
      },
      {
        card: blockerCookie,
        hpCards: [],
        rested: false,
        battleEntryId: `${blockerCookie.instanceId}:battle:2`,
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
        battleEntryId: `${attacker.instanceId}:battle:3`,
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
    nextBattleEntrySequence: 4,
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

export const createTrapAndBlockerDemoState = (payable: boolean): GameState => {
  const p1Deck = createOfficialYellowStarterDeck('player-one')
  const p2Deck = createOfficialYellowStarterDeck('player-two')
  const trap = p1Deck.find((card) => card.id === 'ST2-020')!
  const defender = p1Deck.find((card) => card.type === 'cookie') as CookieCard
  const attacker = p2Deck.find((card) => card.type === 'cookie') as CookieCard

  const blockerCookie: CookieCard = {
    ...defender,
    instanceId: 'blocker-cookie-demo',
    id: 'BS1-009',
    name: 'Affogato Cookie',
    level: 1,
    hp: 3,
    attack: 1,
    attackCost: 2,
    energyColor: 'red',
    skill: {
      trigger: 'block',
      oncePerTurn: false,
      yourTurn: false,
      restSource: false,
      cost: { energy: { red: 1 }, discardHand: 0, trashBattleCookie: undefined },
      text: '{bl} 《{R}》',
      effects: [
        {
          kind: 'redirect-attack',
          target: { side: 'self', min: 1, max: 1, sourceOnly: true },
        },
      ],
    },
    attackEffects: [],
    effectText: '',
    trap: undefined,
    flip: undefined,
  }

  const requiredColor = Object.keys(trap.trap!.cost.energy ?? trap.trap!.cost)[0] as
    | 'red'
    | 'yellow'
    | 'green'
    | 'blue'
    | 'purple'
    | 'black'
  const requiredCount =
    (trap.trap!.cost.energy ?? trap.trap!.cost)[requiredColor] ?? 0
  const trapSupports = p1Deck
    .filter(
      (card) =>
        card.type !== 'cookie' &&
        card.instanceId !== trap.instanceId &&
        (card.energyColor === requiredColor || card.energyColor === 'wild'),
    )
    .slice(0, requiredCount)

  const blockerSupports = p1Deck
    .filter(
      (card) =>
        card.type !== 'cookie' &&
        card.instanceId !== trap.instanceId &&
        card.instanceId !== blockerCookie.instanceId &&
        (card.energyColor === 'red' || card.energyColor === 'wild'),
    )
    .slice(0, 1)

  const allSupports = [...trapSupports, ...blockerSupports]

  const breakArea: CookieCard[] = []
  let breakLevel = 0
  for (const card of p1Deck) {
    if (
      card.type !== 'cookie' ||
      card.instanceId === defender.instanceId ||
      card.instanceId === blockerCookie.instanceId
    ) {
      continue
    }
    breakArea.push(card)
    breakLevel += card.level
    if (breakLevel >= 5) break
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
      {
        card: blockerCookie,
        hpCards: [],
        rested: false,
        battleEntryId: `${blockerCookie.instanceId}:battle:2`,
      },
    ],
    supportArea: payable
      ? allSupports.map((card) => ({ card, rested: false }))
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
        battleEntryId: `${attacker.instanceId}:battle:3`,
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
    nextBattleEntrySequence: 4,
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

  const requiredColor = Object.keys(
    trap.trap!.cost.energy ?? trap.trap!.cost,
  )[0] as 'yellow'
  const requiredCount =
    (trap.trap!.cost.energy ?? trap.trap!.cost)[requiredColor] ?? 0
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
  const costCards = p1Deck
    .filter((c) => c.instanceId !== caviar.instanceId && c.type !== 'cookie')
    .slice(0, payable ? 2 : 1)
  const deployableCookie = p1Deck.find(
    (c) => c.instanceId !== caviar.instanceId && c.type === 'cookie',
  )
  const handCards = payable && deployableCookie
    ? [...costCards, deployableCookie]
    : costCards
  const defender = p2Deck.find((c) => c.type === 'cookie') as CookieCard
  const defenderHpCards = p2Deck
    .filter((c) => c.instanceId !== defender.instanceId)
    .slice(0, 2)
  const usedP1 = new Set([caviar.instanceId, ...handCards.map((c) => c.instanceId)])
  const usedP2 = new Set([
    defender.instanceId,
    ...defenderHpCards.map((c) => c.instanceId),
  ])
  const attackEffects = caviar.attackEffects ?? []
  return {
    players: {
      'player-one': {
        id: 'player-one',
        name: '玩家',
        ...createTestPlayerState(),
        deck: p1Deck.filter((c) => !usedP1.has(c.instanceId)),
        hand: handCards,
        battleArea: [{ card: caviar, hpCards: [], rested: true, battleEntryId: `${caviar.instanceId}:battle:1` }],
      },
      'player-two': {
        id: 'player-two',
        name: 'AI 對手',
        ...createTestPlayerState(),
        deck: p2Deck.filter((c) => !usedP2.has(c.instanceId)),
        battleArea: [{ card: defender, hpCards: defenderHpCards, rested: false, battleEntryId: `${defender.instanceId}:battle:2` }],
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
      faintedColors: [], attackEffects, attackEffectIndex: 0,
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

export const createSt5010OnPlayDemoState = (): GameState => {
  const p1Deck = createOfficialPurpleStarterDeck('player-one')
  const p2Deck = createOfficialPurpleStarterDeck('player-two')
  const carol = p1Deck.find(
    (card): card is CookieCard => card.id === 'ST5-010',
  )!
  const support = p1Deck.find(
    (card) =>
      card.instanceId !== carol.instanceId &&
      card.energyColor === 'purple',
  )!
  const target = p2Deck.find(
    (card): card is CookieCard => card.type === 'cookie',
  )!
  const replacement = p2Deck.find(
    (card): card is CookieCard =>
      card.type === 'cookie' && card.instanceId !== target.instanceId,
  )!
  const usedP1 = new Set([carol.instanceId, support.instanceId])
  const usedP2 = new Set([target.instanceId, replacement.instanceId])
  const targetHpCards = p2Deck
    .filter((card) => !usedP2.has(card.instanceId))
    .slice(0, 2)
  targetHpCards.forEach((card) => usedP2.add(card.instanceId))

  return {
    players: {
      'player-one': {
        id: 'player-one',
        name: '玩家',
        ...createTestPlayerState(),
        deck: p1Deck.filter((card) => !usedP1.has(card.instanceId)),
        hand: [carol],
        supportArea: [{ card: support, rested: false }],
      },
      'player-two': {
        id: 'player-two',
        name: 'AI 對手',
        ...createTestPlayerState(),
        deck: p2Deck.filter((card) => !usedP2.has(card.instanceId)),
        hand: [replacement],
        battleArea: [
          {
            card: target,
            hpCards: targetHpCards,
            rested: false,
            battleEntryId: `${target.instanceId}:battle:1`,
          },
        ],
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
    nextBattleEntrySequence: 2,
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

export const createAiDiscardRevealDemoState = (): GameState => {
  const base = createDemoGame(7, { player: 'purple', ai: 'purple' })
  const ai = base.players['player-two']
  const hand = ai.hand.slice(0, 2)
  const handIds = new Set(hand.map((card) => card.instanceId))

  return {
    ...base,
    activePlayerId: 'player-one',
    phase: 'main',
    players: {
      ...base.players,
      'player-two': {
        ...ai,
        hand,
        deck: ai.deck.filter((card) => !handIds.has(card.instanceId)),
      },
    },
    pendingOpponentHandDiscard: {
      playerId: 'player-two',
      count: 2,
      sourcePlayerId: 'player-one',
      sourceInstanceId: 'ai-discard-reveal-source',
      sourceCardName: '公開棄牌測試',
      effectText: 'opponent-discard-hand',
    },
  }
}

export const createBlueSt4DemoState = (
  cardId: 'ST4-016' | 'ST4-017' | 'ST4-018' | 'ST4-019',
): GameState => {
  const p1Deck = createOfficialBlueStarterDeck('player-one')
  const p2Deck = createOfficialBlueStarterDeck('player-two')
  const item = p1Deck.find((card) => card.id === cardId)!
  const battleCookie = p1Deck.find(
    (card): card is CookieCard =>
      card.type === 'cookie' &&
      (cardId !== 'ST4-017' || card.level === 1) &&
      card.energyColor === 'blue',
  )!
  const opponentCookie = p2Deck.find(
    (card): card is CookieCard => card.type === 'cookie',
  )!
  const retainedCookie =
    cardId === 'ST4-016' || cardId === 'ST4-017'
      ? p1Deck.find(
          (card): card is CookieCard =>
            card.type === 'cookie' &&
            card.instanceId !== battleCookie.instanceId,
        )
      : undefined
  const paymentCount = cardId === 'ST4-016' || cardId === 'ST4-018' ? 2 : 1
  const reserved = new Set([
    item.instanceId,
    battleCookie.instanceId,
    ...(retainedCookie ? [retainedCookie.instanceId] : []),
  ])
  const hpCards = p1Deck
    .filter((card) => !reserved.has(card.instanceId))
    .slice(0, 3)
  hpCards.forEach((card) => reserved.add(card.instanceId))
  const supportCards = p1Deck
    .filter((card) => !reserved.has(card.instanceId) && card.energyColor === 'blue')
    .slice(0, paymentCount)
  supportCards.forEach((card) => reserved.add(card.instanceId))
  const extraHand = p1Deck
    .filter((card) => !reserved.has(card.instanceId))
    .slice(0, cardId === 'ST4-019' ? 3 : 0)
  extraHand.forEach((card) => reserved.add(card.instanceId))
  const usedP2 = new Set([opponentCookie.instanceId])

  return {
    players: {
      'player-one': {
        id: 'player-one',
        name: '玩家',
        ...createTestPlayerState(),
        hand: [item, ...extraHand],
        deck: p1Deck.filter((card) => !reserved.has(card.instanceId)),
        battleArea: [
          {
            card: battleCookie,
            hpCards,
            rested: false,
            battleEntryId: `${battleCookie.instanceId}:battle:1`,
          },
          ...(retainedCookie
            ? [{
                card: retainedCookie,
                hpCards: [],
                rested: false,
                battleEntryId: `${retainedCookie.instanceId}:battle:3`,
              }]
            : []),
        ],
        supportArea: supportCards.map((card) => ({ card, rested: false })),
      },
      'player-two': {
        id: 'player-two',
        name: 'AI 對手',
        ...createTestPlayerState(),
        deck: p2Deck.filter((card) => !usedP2.has(card.instanceId)),
        battleArea: [{
          card: opponentCookie,
          hpCards: [],
          rested: false,
          battleEntryId: `${opponentCookie.instanceId}:battle:2`,
        }],
      },
    },
    firstPlayerId: 'player-one',
    activePlayerId: 'player-one',
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
    pendingRefresh: null,
    pendingBattle: null,
  }
}

export const createBlueSt4TrapDemoState = (payable: boolean): GameState => {
  const p1Deck = createOfficialBlueStarterDeck('player-one')
  const p2Deck = createOfficialBlueStarterDeck('player-two')
  const trap = p1Deck.find((card) => card.id === 'ST4-020')!
  const defender = p1Deck.find(
    (card): card is CookieCard => card.type === 'cookie',
  )!
  const attacker = p2Deck.find(
    (card): card is CookieCard => card.type === 'cookie',
  )!
  const usedP1 = new Set([trap.instanceId, defender.instanceId])
  const support = p1Deck.find(
    (card) =>
      !usedP1.has(card.instanceId) &&
      (card.energyColor === 'blue' || card.energyColor === 'wild'),
  )!
  usedP1.add(support.instanceId)
  const discardCandidates = p1Deck
    .filter((card) => !usedP1.has(card.instanceId))
    .slice(0, payable ? 3 : 1)
  discardCandidates.forEach((card) => usedP1.add(card.instanceId))
  const usedP2 = new Set([attacker.instanceId])

  return {
    players: {
      'player-one': {
        id: 'player-one',
        name: '玩家',
        ...createTestPlayerState(),
        deck: p1Deck.filter((card) => !usedP1.has(card.instanceId)),
        hand: [trap, ...discardCandidates],
        battleArea: [{
          card: defender,
          hpCards: [],
          rested: false,
          battleEntryId: `${defender.instanceId}:battle:1`,
        }],
        supportArea: [{ card: support, rested: false }],
      },
      'player-two': {
        id: 'player-two',
        name: 'AI 對手',
        ...createTestPlayerState(),
        deck: p2Deck.filter((card) => !usedP2.has(card.instanceId)),
        battleArea: [{
          card: attacker,
          hpCards: [],
          rested: false,
          battleEntryId: `${attacker.instanceId}:battle:2`,
        }],
      },
    },
    firstPlayerId: 'player-two',
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
    pendingRefresh: null,
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

// ---------------------------------------------------------------------------
// Generic, data-driven "card check" test state.
//
// Instead of one hand-built scenario per card (as above), this builds a
// minimal legal GameState for ANY official card number by looking it up in
// the shared card pool and inspecting which ability field the created
// GameCard actually carries (`skill` / `attackEffects` / `flip` / `trap` /
// `item` / `stageAbility`). A handful of scenario "shapes" are dispatched by
// that inspection, reusing the same field conventions as the hand-built
// scenarios above (phase 'main', mulligan/starting-cookie already resolved,
// support/energy pre-placed for cost payment, a spread of legal opponent
// targets across levels/remaining-HP so level- or HP-filtered target
// selectors have at least one match, etc.).
// ---------------------------------------------------------------------------

const cardCheckFillerCookie = (
  instanceId: string,
  level: number,
  hp: number,
  damage = 0,
  energyColor?: EnergyColor,
): { cookie: CookieCard; hpCards: GameCard[] } => {
  const cookie: CookieCard = {
    id: instanceId,
    instanceId,
    name: instanceId,
    type: 'cookie',
    level,
    hp,
    attack: 1,
    attackCost: 0,
    energyColor,
  }
  const remainingHp = Math.max(0, hp - damage)
  const hpCards = Array.from({ length: remainingHp }, (_, i) =>
    testSupportCard(`${instanceId}-hp-${i}`),
  )
  return { cookie, hpCards }
}

const cardCheckBattleEntry = (
  cookie: CookieCard,
  hpCards: GameCard[],
  sequence: number,
  rested = false,
) => ({
  card: cookie,
  hpCards,
  rested,
  battleEntryId: `${cookie.instanceId}:battle:${sequence}`,
})

/**
 * Builds a minimal legal GameState positioned so the given card's ability
 * (if any) can be triggered through the real UI. Throws if the card number
 * isn't in the shared official card pool.
 */
export const createCardCheckDemoState = (cardNumber: string): GameState => {
  const entry = getCardPoolEntry(cardNumber)
  if (!entry) {
    throw new Error(`找不到卡片編號 ${cardNumber} 的官方資料。`)
  }
  const card = createCard(entry, 'player-one', 1)
  const payColor: EnergyColor = card.energyColor && card.energyColor !== 'wild'
    ? card.energyColor
    : 'purple'

  // A spread of opponent battle cookies covering several levels and
  // remaining-HP totals so level/remaining-HP-filtered target selectors have
  // at least one legal candidate.
  const opp1 = cardCheckFillerCookie('opp-lv1', 1, 6, 0, 'red')
  const opp2 = cardCheckFillerCookie('opp-lv3', 3, 8, 3, 'yellow')
  const opponentStage: GameCard = {
    id: 'opp-stage-card',
    instanceId: 'opp-stage-card-1',
    name: '對手場景卡',
    type: 'stage',
  }
  const opponentBreakArea: CookieCard[] = [
    cardCheckFillerCookie('opp-break-1', 2, 4, 0, 'red').cookie,
    cardCheckFillerCookie('opp-break-2', 2, 4, 0, 'yellow').cookie,
  ]

  // Extra battle cookies for the player, beyond the card under test, so
  // self-side target selectors and trash-battle-cookie costs have
  // candidates that aren't the tested card itself.
  const selfExtra1 = cardCheckFillerCookie('self-extra-1', 1, 4, 0, payColor)

  // Generous energy support to pay any skill/item/trap/stage energy cost.
  const energySupportColors: EnergyColor[] = card.id === 'P-032'
    ? ['red', 'yellow', 'green', 'blue', 'purple', 'red', 'yellow']
    : Array.from({ length: 6 }, () => payColor)
  const energySupports = energySupportColors.map((color, i) =>
    testSupportCard(`support-pay-${i}`, color),
  )
  // Hand filler cards for discard-hand style costs, beyond the tested card.
  const handFillers = Array.from({ length: 4 }, (_, i) =>
    testSupportCard(`hand-filler-${i}`, i % 2 === 0 ? payColor : 'wild'),
  )
  // Some OnPlay effects require an additional Cookie in hand (for example,
  // BS3-038 places a level-2-or-higher Cookie from hand into the break area).
  // Keep that legal candidate in the browser card-check fixture without
  // changing any production deck or runtime rule.
  const handCookieFiller = cardCheckFillerCookie(
    'hand-cookie-filler',
    2,
    4,
    0,
    payColor,
  ).cookie
  // Trash (discard pile) filler for skills that select from trash.
  const trashFillers: GameCard[] = [
    cardCheckFillerCookie('trash-cookie-1', 1, 3).cookie,
    cardCheckFillerCookie('trash-cookie-2', 2, 4, 0, payColor).cookie,
    testSupportCard('trash-item-1', payColor),
    ...Array.from({ length: 5 }, (_, i) =>
      testSupportCard(`trash-purple-cost-${i}`, 'purple'),
    ),
    ...(card.id === 'BS5-094'
      ? Array.from({ length: 5 }, (_, i) =>
          cardCheckFillerCookie(
            `BS5-094-purple-cookie-${i}`,
            1,
            3,
            0,
            'purple',
          ).cookie,
        )
      : []),
  ]
  // Deploying a cookie draws HP cards from the top of the deck
  // (see deployCookie in actions.ts); an empty deck immediately triggers
  // deck-exhaustion (`pendingRefresh`), which in turn blocks on-play skill
  // resolution and other pending-state-gated actions. Give both players a
  // generous filler deck so no card-check scenario accidentally exhausts it.
  const deckFiller = (prefix: string): GameCard[] =>
    Array.from({ length: 20 }, (_, i) => testSupportCard(`${prefix}-deck-${i}`, payColor))

  // Own break area filler for break-area-level conditions (flip cards) and
  // for skills that select own-color cookies from the break area (e.g.
  // "Select {Y} Cookies from your break area" — colorless fillers would give
  // such skills zero legal candidates and silently never activate).
  const ownBreakArea: CookieCard[] = [
    cardCheckFillerCookie('self-break-1', 2, 4, 0, payColor).cookie,
    cardCheckFillerCookie('self-break-2', 2, 4, 0, payColor).cookie,
  ]

  const baseState = (): GameState => ({
    players: {
      'player-one': {
        id: 'player-one',
        name: '玩家',
        ...createTestPlayerState(),
        deck: deckFiller('p1'),
      },
      'player-two': {
        id: 'player-two',
        name: 'AI 對手',
        ...createTestPlayerState(),
        deck: deckFiller('p2'),
      },
    },
    firstPlayerId: 'player-one',
    activePlayerId: 'player-one',
    turnNumber: 2,
    phase: 'main',
    status: 'playing',
    result: null,
    supportPlacedThisTurn: false,
    skillUsesThisTurn: [],
    nextBattleEntrySequence: 10,
    attackModifiers: [],
    damageReceivedModifiers: [],
    flipDisabledUntilTurn: {},
    pendingReplacement: null,
    departedCookieCounts: { 'player-one': 0, 'player-two': 0 },
    pendingOnPlay: null,
    pendingRefresh: null,
    pendingBattle: null,
  })

  // The real game caps each side's battle area at 2 cookies.
  const opponentBattleArea = [
    cardCheckBattleEntry(opp1.cookie, opp1.hpCards, 1),
    cardCheckBattleEntry(opp2.cookie, opp2.hpCards, 2),
  ]

  // --- Non-cookie cards (item / trap / stage) --------------------------
  if (card.type === 'item') {
    const state = baseState()
    return {
      ...state,
      players: {
        ...state.players,
        'player-one': {
          ...state.players['player-one'],
          hand: [card, ...handFillers],
          battleArea: [cardCheckBattleEntry(selfExtra1.cookie, selfExtra1.hpCards, 4)],
          supportArea: energySupports.map((c) => ({ card: c, rested: false })),
          discardPile: trashFillers,
        },
        'player-two': {
          ...state.players['player-two'],
          battleArea: opponentBattleArea,
          stage: { card: opponentStage, rested: false },
        },
      },
    }
  }

  if (card.type === 'stage') {
    const stageBattleCookie = card.id === 'P-032'
      ? { ...selfExtra1.cookie, keywords: ['ancient'] as ['ancient'] }
      : selfExtra1.cookie
    const stageHand = card.id === 'P-028'
      ? [card, handCookieFiller, ...handFillers]
      : [card, ...handFillers]
    const stageBreakArea = card.id === 'P-028'
      ? [
          cardCheckFillerCookie('p028-break-lv1', 1, 2, 0, 'yellow').cookie,
          ...ownBreakArea,
        ]
      : ownBreakArea
    const oldStage: GameCard = { id: 'old-stage', instanceId: 'old-stage-1', name: '舊場景', type: 'stage' }
    const state = baseState()
    return {
      ...state,
      players: {
        ...state.players,
        'player-one': {
          ...state.players['player-one'],
          hand: stageHand,
          battleArea: [cardCheckBattleEntry(stageBattleCookie, selfExtra1.hpCards, 4)],
          supportArea: energySupports.map((c) => ({ card: c, rested: false })),
          stage: { card: oldStage, rested: false },
          breakArea: stageBreakArea,
          discardPile: trashFillers,
        },
        'player-two': {
          ...state.players['player-two'],
          battleArea: opponentBattleArea,
        },
      },
    }
  }

  if (card.type === 'trap') {
    const defender = cardCheckFillerCookie('trap-defender', 2, 5, 0, payColor)
    // A high-attack attacker so "attacker attack more than N" trap
    // conditions have a chance of being met, plus 2 extra opponent battle
    // cookies (beyond the attacker) so traps that select an opponent target
    // (rather than just redirecting/countering the current attack) have
    // legal candidates.
    const attacker: CookieCard = { ...cardCheckFillerCookie('trap-attacker', 2, 5, 0, 'black').cookie, attack: 6 }
    const bigTrashFillers = Array.from({ length: 16 }, (_, i) =>
      cardCheckFillerCookie(`trash-bulk-${i}`, 1, 3).cookie,
    )
    const trapBreakArea: CookieCard[] = card.id === 'BS5-087'
      ? [
          cardCheckFillerCookie('BS5-087-break-1', 3, 4).cookie,
          cardCheckFillerCookie('BS5-087-break-2', 3, 4).cookie,
        ]
      : []
    const trapOpponentSecondCookie =
      card.id === 'BS5-109' ? opp1.cookie : opp2.cookie
    const state = baseState()
    return {
      ...state,
      firstPlayerId: 'player-two',
      activePlayerId: 'player-two',
      players: {
        ...state.players,
        'player-one': {
          ...state.players['player-one'],
          hand: [card, ...handFillers],
          battleArea: [cardCheckBattleEntry(defender.cookie, defender.hpCards, 4)],
          supportArea: energySupports.map((c) => ({ card: c, rested: false })),
          breakArea: trapBreakArea,
          discardPile: [...trashFillers, ...bigTrashFillers],
        },
        'player-two': {
          ...state.players['player-two'],
          battleArea: [
            cardCheckBattleEntry(attacker, [], 5),
            cardCheckBattleEntry(
              trapOpponentSecondCookie,
              trapOpponentSecondCookie === opp1.cookie
                ? opp1.hpCards
                : opp2.hpCards,
              6,
            ),
          ],
          stage: { card: opponentStage, rested: false },
        },
      },
      pendingBattle: {
        attackerPlayerId: 'player-two',
        defenderPlayerId: 'player-one',
        attackerInstanceId: attacker.instanceId,
        targetInstanceId: defender.cookie.instanceId,
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

  // --- Cookie / flip cards ----------------------------------------------

  // Flip-attachment cards trigger when revealed as an HP card during an
  // attack, not from the player's hand — mirror createFlipResponseDemoState.
  if (card.flip) {
    const defender = cardCheckFillerCookie('flip-defender', 2, 5, 4, payColor) // 1 HP card left: the flip card itself
    const attacker = cardCheckFillerCookie('flip-attacker', 2, 5, 0, 'black')
    // Keep the break area above the thresholds used by conditional FLIP
    // effects, but below the level-10 defeat limit.  The generic card-check
    // state must remain playable after FLIP resolves; otherwise
    // `resolveDrawUpTo` can correctly detect a break-level defeat and clear
    // `pendingBattle` before `resolveFlip` finishes its transition.
    const bigOwnBreakArea: CookieCard[] = [
      cardCheckFillerCookie('self-break-big-1', 3, 5).cookie,
      cardCheckFillerCookie('self-break-big-2', 2, 5).cookie,
      ...ownBreakArea,
    ]
    const state = baseState()
    return {
      ...state,
      firstPlayerId: 'player-two',
      activePlayerId: 'player-two',
      players: {
        ...state.players,
        'player-one': {
          ...state.players['player-one'],
          hand: handFillers,
          battleArea: [
            cardCheckBattleEntry(defender.cookie, defender.hpCards, 4),
            cardCheckBattleEntry(selfExtra1.cookie, selfExtra1.hpCards, 6),
          ],
          breakArea: bigOwnBreakArea,
          discardPile: trashFillers,
        },
        'player-two': {
          ...state.players['player-two'],
          battleArea: [cardCheckBattleEntry(attacker.cookie, attacker.hpCards, 5)],
          breakArea: opponentBreakArea,
        },
      },
      pendingBattle: {
        attackerPlayerId: 'player-two',
        defenderPlayerId: 'player-one',
        attackerInstanceId: attacker.cookie.instanceId,
        targetInstanceId: defender.cookie.instanceId,
        declaredDamage: 1,
        remainingDamage: 0,
        stage: 'flip',
        trapUsed: false,
        revealedHpCard: card,
        preventKnockoutTargetIds: [],
        faintedColors: [],
        attackEffects: [],
        attackEffectIndex: 0,
      },
    }
  }

  // Faint-triggered skill ("when this Cookie faints ..."): mirror
  // createFaintDamageDemoState — the card is already in the break area with
  // a pending faint effect queued.
  if (card.skill?.faint) {
    const target = cardCheckFillerCookie('faint-target', 2, 5, 0, payColor)
    const state = baseState()
    const faintCard: CookieCard = { ...(card as CookieCard) }
    const pendingFaintEffects: PendingFaintEffect[] = card.skill.effects.map((effect) => ({
      sourcePlayerId: 'player-one',
      sourceInstanceId: faintCard.instanceId,
      sourceCardName: faintCard.name,
      effect,
      context: { sourcePlayerId: 'player-one', sourceInstanceId: faintCard.instanceId },
    }))
    return {
      ...state,
      players: {
        ...state.players,
        'player-one': {
          ...state.players['player-one'],
          breakArea: [faintCard, ...ownBreakArea],
          discardPile: trashFillers,
        },
        'player-two': {
          ...state.players['player-two'],
          battleArea: [
            cardCheckBattleEntry(target.cookie, target.hpCards, 4),
            ...opponentBattleArea,
          ],
        },
      },
      pendingFaintEffects,
    }
  }

  // Attack-post-effect cookies ("Then ..." attack text): mirror
  // createAttackEffectDemoState / createBlueOptionalCostAttackDemoState.
  const cookieCard = card as CookieCard
  if (cookieCard.attackEffects && cookieCard.attackEffects.length > 0) {
    const state = baseState()
    // The generic fixture should enter the card's real post-attack UI rather
    // than silently auto-skipping an effect whose condition happens to be
    // false in the neutral spread above. Keep these adjustments local to the
    // browser fixture; they do not alter the official card pool or rules.
    const attackSourceHpCount =
      cookieCard.id === 'BS4-039'
        ? 2
        : cookieCard.id === 'BS5-098'
          ? 1
          : 0
    const attackSourceHpCards = Array.from(
      { length: attackSourceHpCount },
      (_, index) => testSupportCard(`${cookieCard.id}-source-hp-${index + 1}`),
    )
    const attackOpponentBattleArea = opponentBattleArea.map((entry, index) =>
      cookieCard.id === 'BS4-016' && index === 0
        ? {
            ...entry,
            hpCards: [testSupportCard(`${cookieCard.id}-target-hp-1`)],
          }
        : entry,
    )
    const attackOwnBreakArea =
      cookieCard.id === 'BS4-023' || cookieCard.id === 'BS4-029'
        ? [
            cardCheckFillerCookie(
              `${cookieCard.id}-yellow-break-lv3`,
              3,
              5,
              0,
              'yellow',
            ).cookie,
            ...ownBreakArea,
          ]
        : ownBreakArea
    const attackPlayerSupportArea =
      cookieCard.id === 'BS4-053' || cookieCard.id === 'BS4-061'
        ? [
            ...energySupports.map((card) => ({ card, rested: false })),
            ...scenarioSupports(
              `${cookieCard.id}-condition-support`,
              1,
              'green',
            ),
          ]
        : energySupports.map((card) => ({ card, rested: false }))
    const attackOpponentSupportArea =
      cookieCard.id === 'BS4-049'
        ? scenarioSupports('BS4-049-condition-support', 7, 'green')
        : []
    const attackPlayerHand =
      cookieCard.id === 'BS4-073' || cookieCard.id === 'BS4-083'
        ? [
            ...handFillers,
            testSupportCard(`${cookieCard.id}-condition-hand`, 'blue'),
          ]
        : cookieCard.id === 'BS5-071'
          ? handFillers.slice(0, 2)
          : handFillers
    const attackOpponentDiscard =
      cookieCard.id === 'BS4-089'
        ? [
            ...trashFillers,
            ...Array.from({ length: 8 }, (_, index) =>
              testSupportCard(`BS4-089-condition-trash-${index + 1}`),
            ),
          ]
        : trashFillers
    const attackBattleArea =
      cookieCard.id === 'BS4-029'
        ? [cardCheckBattleEntry(card as CookieCard, attackSourceHpCards, 4, true)]
        : [
            cardCheckBattleEntry(
              card as CookieCard,
              attackSourceHpCards,
              4,
              true,
            ),
            cardCheckBattleEntry(selfExtra1.cookie, selfExtra1.hpCards, 6),
          ]
    const attackPlayerDiscard =
      cookieCard.id === 'BS4-090'
        ? [
            ...trashFillers,
            ...Array.from({ length: 3 }, (_, index) =>
              createCard(
                getCardPoolEntry('BS4-102')!,
                'player-one',
                300 + index,
              ),
            ),
          ]
        : trashFillers
    return {
      ...state,
      players: {
        ...state.players,
        'player-one': {
          ...state.players['player-one'],
          hand: attackPlayerHand,
          battleArea: attackBattleArea,
          supportArea: attackPlayerSupportArea,
          breakArea: attackOwnBreakArea,
          discardPile: attackPlayerDiscard,
        },
        'player-two': {
          ...state.players['player-two'],
          battleArea: attackOpponentBattleArea,
          supportArea: attackOpponentSupportArea,
          stage: { card: opponentStage, rested: false },
          discardPile: attackOpponentDiscard,
        },
      },
      pendingBattle: {
        attackerPlayerId: 'player-one',
        defenderPlayerId: 'player-two',
        attackerInstanceId: card.instanceId,
        targetInstanceId: opp1.cookie.instanceId,
        declaredDamage: cookieCard.attack,
        remainingDamage: 0,
        stage: 'attack-effect',
        trapUsed: false,
        revealedHpCard: null,
        preventKnockoutTargetIds: [],
        faintedColors:
          cookieCard.id === 'BS5-085' || cookieCard.id === 'BS5-097'
            ? ['yellow']
            : [],
        attackEffects: cookieCard.attackEffects,
        attackEffectIndex: 0,
      },
    }
  }

  // Activatable / passive / block-triggered skill.
  if (card.skill) {
    const state = baseState()
    if (card.skill.trigger === 'block') {
      // Blocker-style skill: triggers when the opponent attacks another of
      // the player's cookies — mirror createBlockerResponseDemoState.
      const defender = cardCheckFillerCookie('blocker-defender', 2, 5, 0, payColor)
      const attacker = cardCheckFillerCookie('blocker-attacker', 2, 5, 0, 'black')
      return {
        ...state,
        firstPlayerId: 'player-two',
        activePlayerId: 'player-two',
        players: {
          ...state.players,
          'player-one': {
            ...state.players['player-one'],
            hand: handFillers,
            battleArea: [
              cardCheckBattleEntry(defender.cookie, defender.hpCards, 4),
              cardCheckBattleEntry(card as CookieCard, [], 6),
            ],
            supportArea: energySupports.map((c) => ({ card: c, rested: false })),
            discardPile: trashFillers,
          },
          'player-two': {
            ...state.players['player-two'],
            battleArea: [cardCheckBattleEntry(attacker.cookie, attacker.hpCards, 5)],
          },
        },
        pendingBattle: {
          attackerPlayerId: 'player-two',
          defenderPlayerId: 'player-one',
          attackerInstanceId: attacker.cookie.instanceId,
          targetInstanceId: defender.cookie.instanceId,
          declaredDamage: attacker.cookie.attack,
          remainingDamage: attacker.cookie.attack,
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

    if (card.skill.trigger === 'on-play') {
      // On-play skills ({ap} in the card text) resolve when the cookie is
      // deployed from hand, not via a battlefield "activate skill" button —
      // mirror createOpponentDiscardHandDemoState / createSt5010OnPlayDemoState:
      // the card sits in hand, ready to deploy into an empty battle-area
      // slot, with the opponent's diverse battle area (and one own-side
      // cookie already on the field) providing legal targets for whatever
      // the on-play effect selects.
      return {
        ...state,
        players: {
          ...state.players,
          'player-one': {
            ...state.players['player-one'],
            hand: [card, handCookieFiller, ...handFillers],
            battleArea: [cardCheckBattleEntry(selfExtra1.cookie, selfExtra1.hpCards, 6)],
            supportArea: energySupports.map((c) => ({ card: c, rested: false })),
            breakArea: ownBreakArea,
            discardPile: trashFillers,
          },
          'player-two': {
            ...state.players['player-two'],
            battleArea: opponentBattleArea,
            stage: { card: opponentStage, rested: false },
            breakArea: opponentBreakArea,
          },
        },
      }
    }

    // 'activate' / 'passive' (and any other non-block, non-on-play
    // trigger): put the card on the battlefield with enough hand/support/
    // trash to pay whatever cost it has, plus a spread of legal targets on
    // both sides.
    const sourceHpCards =
      card.id === 'BS4-005'
        ? [testSupportCard('BS4-005-source-hp')]
        : []
    return {
      ...state,
      players: {
        ...state.players,
        'player-one': {
          ...state.players['player-one'],
          hand: handFillers,
          battleArea: [
            cardCheckBattleEntry(card as CookieCard, sourceHpCards, 4),
            cardCheckBattleEntry(selfExtra1.cookie, selfExtra1.hpCards, 6),
          ],
          supportArea: energySupports.map((c) => ({ card: c, rested: false })),
          breakArea: ownBreakArea,
          discardPile: trashFillers,
        },
        'player-two': {
          ...state.players['player-two'],
          battleArea: opponentBattleArea,
          stage: { card: opponentStage, rested: false },
          breakArea: opponentBreakArea,
        },
      },
    }
  }

  // No skill/flip/attackEffects/item/trap/stageAbility text: a vanilla
  // cookie. Light check only — verify it can be deployed and can attack.
  const state = baseState()
  return {
    ...state,
    players: {
      ...state.players,
      'player-one': {
        ...state.players['player-one'],
        hand: [card, ...handFillers],
        battleArea: [cardCheckBattleEntry(selfExtra1.cookie, selfExtra1.hpCards, 4)],
        supportArea: energySupports.map((c) => ({ card: c, rested: false })),
      },
      'player-two': {
        ...state.players['player-two'],
        battleArea: opponentBattleArea,
      },
    },
  }
}

const updateDemoPlayer = (
  state: GameState,
  playerId: PlayerId,
  patch: Partial<PlayerState>,
): GameState => ({
  ...state,
  players: {
    ...state.players,
    [playerId]: {
      ...state.players[playerId],
      ...patch,
    },
  },
})

const scenarioCookie = (
  instanceId: string,
  level: number,
  hp: number,
  energyColor: EnergyColor,
  remainingHp = hp,
): { cookie: CookieCard; hpCards: GameCard[] } =>
  cardCheckFillerCookie(
    instanceId,
    level,
    hp,
    Math.max(0, hp - remainingHp),
    energyColor,
  )

const scenarioSupports = (
  prefix: string,
  count: number,
  energyColor: EnergyColor,
  rested = false,
) =>
  Array.from({ length: count }, (_, index) => ({
    card: testSupportCard(`${prefix}-${index + 1}`, energyColor),
    rested,
  }))

const scenarioPendingBattle = (
  attackerPlayerId: PlayerId,
  attackerInstanceId: string,
  defenderPlayerId: PlayerId,
  targetInstanceId: string,
  attackEffects: CookieCard['attackEffects'],
  faintedColors: EnergyColor[] = [],
  stage: PendingBattle['stage'] = 'attack-effect',
): PendingBattle => ({
  attackerPlayerId,
  defenderPlayerId,
  attackerInstanceId,
  targetInstanceId,
  declaredDamage: 1,
  remainingDamage: 0,
  stage,
  trapUsed: false,
  revealedHpCard: null,
  preventKnockoutTargetIds: [],
  faintedColors,
  attackEffects: attackEffects ?? [],
  attackEffectIndex: 0,
})

/**
 * Creates focused BS4 condition fixtures for the cards that the generic
 * card-check state cannot satisfy. The `met` and `unmet` variants are both
 * intentionally legal states; the latter keeps the card available while
 * removing only the relevant condition or target.
 */
export const createBs4ConditionDemoState = (
  cardNumber: Bs4ConditionCardNumber,
  conditionMet: boolean,
): GameState => {
  let state = createCardCheckDemoState(cardNumber)

  const setPlayer = (playerId: PlayerId, patch: Partial<PlayerState>) => {
    state = updateDemoPlayer(state, playerId, patch)
  }

  const putSourceInBattle = (
    remainingHp: number,
    rested = false,
  ): CookieCard => {
    const player = state.players['player-one']
    const source =
      player.hand.find((card) => card.id === cardNumber) ??
      player.battleArea.find((entry) => entry.card.id === cardNumber)?.card
    if (!source || source.type !== 'cookie') {
      throw new Error(`BS4 condition fixture requires Cookie ${cardNumber}`)
    }
    const otherBattleCookies = player.battleArea
      .filter((entry) => entry.card.id !== cardNumber)
      .slice(0, 1)
    const entry = cardCheckBattleEntry(
      source,
      Array.from({ length: Math.max(0, remainingHp) }, (_, index) =>
        testSupportCard(`${cardNumber}-source-hp-${index + 1}`),
      ),
      90,
      rested,
    )
    setPlayer('player-one', {
      hand: player.hand.filter((card) => card.id !== cardNumber),
      battleArea: [entry, ...otherBattleCookies],
    })
    return source
  }

  const setAttackScenario = (
    remainingHp = 2,
  ): CookieCard => {
    const source = putSourceInBattle(remainingHp, true)
    const opponent = state.players['player-two']
    const target = opponent.battleArea[0]
    if (!target) throw new Error(`BS4 condition fixture requires an opponent target for ${cardNumber}`)
    state = {
      ...state,
      activePlayerId: 'player-one',
      phase: 'main',
      pendingBattle: scenarioPendingBattle(
        'player-one',
        source.instanceId,
        'player-two',
        target.card.instanceId,
        source.attackEffects,
      ),
    }
    return source
  }

  const setOpponentTargetRemainingHp = (remainingHp: number) => {
    const opponent = state.players['player-two']
    setPlayer('player-two', {
      battleArea: opponent.battleArea.map((entry, index) =>
        index === 0
          ? {
              ...entry,
              hpCards: Array.from({ length: remainingHp }, (_, hpIndex) =>
                testSupportCard(`${cardNumber}-target-hp-${hpIndex + 1}`),
              ),
            }
          : entry,
      ),
    })
  }

  const setDiscardCount = (playerId: PlayerId, count: number, prefix: string) => {
    setPlayer(playerId, {
      discardPile: Array.from({ length: count }, (_, index) =>
        testSupportCard(`${prefix}-${index + 1}`),
      ),
    })
  }

  const addBattleAlly = (
    level: number,
    energyColor: EnergyColor,
    instanceId: string,
  ) => {
    const player = state.players['player-one']
    const ally = scenarioCookie(instanceId, level, 5, energyColor)
    const sourceEntry = player.battleArea.find(
      (entry) => entry.card.id === cardNumber,
    )
    setPlayer('player-one', {
      battleArea: sourceEntry
        ? [sourceEntry, cardCheckBattleEntry(ally.cookie, ally.hpCards, 91)]
        : player.battleArea,
    })
  }

  switch (cardNumber) {
    case 'BS4-011': {
      const source = putSourceInBattle(2, true)
      const target = state.players['player-two'].battleArea[0]
      state = {
        ...state,
        pendingBattle: scenarioPendingBattle(
          'player-one',
          source.instanceId,
          'player-two',
          target.card.instanceId,
          source.attackEffects,
          conditionMet
            ? [
                target.card.energyColor && target.card.energyColor !== 'wild'
                  ? target.card.energyColor
                  : 'red',
              ]
            : [],
        ),
      }
      if (conditionMet) {
        const triggeredEffects = (source.skill?.effects ?? []).flatMap(
          (effect) =>
            'condition' in effect &&
            effect.condition?.kind === 'opponent-cookie-fainted-in-current-battle'
              ? [{ ...effect, condition: undefined } as CardEffect]
              : [],
        )
        state = {
          ...state,
          pendingBattle: {
            ...state.pendingBattle!,
            faintedCookies: [
              {
                playerId: 'player-two',
                energyColor: target.card.energyColor,
                level: target.card.level,
              },
            ],
          },
          pendingAbilityEffect: {
            playerId: 'player-one',
            sourcePlayerId: 'player-one',
            sourceInstanceId: source.instanceId,
            sourceCardName: source.name,
            sourceKind: 'skill',
            effects: triggeredEffects,
            effectIndex: 0,
          },
        }
      }
      return state
    }
    case 'BS4-012':
      putSourceInBattle(conditionMet ? 1 : 2)
      return state
    case 'BS4-014': {
      const source = putSourceInBattle(2)
      const opponent = state.players['player-two']
      const attacker = opponent.battleArea[0]
      const attackerCard = { ...attacker.card, level: conditionMet ? 1 : 2 }
      setPlayer('player-two', {
        battleArea: [
          { ...attacker, card: attackerCard },
          ...opponent.battleArea.slice(1),
        ],
      })
      state = {
        ...state,
        activePlayerId: 'player-two',
        pendingBattle: scenarioPendingBattle(
          'player-two',
          attackerCard.instanceId,
          'player-one',
          source.instanceId,
          [],
          [],
          'damage',
        ),
      }
      return state
    }
    case 'BS4-016':
      setAttackScenario()
      setOpponentTargetRemainingHp(conditionMet ? 1 : 2)
      return state
    case 'BS4-020': {
      if (conditionMet) {
        const target = scenarioCookie('BS4-020-red-lv3', 3, 5, 'red')
        setPlayer('player-one', {
          battleArea: [cardCheckBattleEntry(target.cookie, target.hpCards, 90)],
          breakArea: [
            scenarioCookie('BS4-020-break-1', 3, 5, 'red').cookie,
            scenarioCookie('BS4-020-break-2', 3, 5, 'red').cookie,
          ],
        })
      } else {
        setPlayer('player-one', {
          breakArea: state.players['player-one'].breakArea.filter(
            (card) => card.level < 3,
          ),
        })
      }
      return state
    }
    case 'BS4-023':
      setAttackScenario()
      if (conditionMet) {
        setPlayer('player-one', {
          breakArea: [
            scenarioCookie('BS4-023-break-lv3', 3, 5, 'yellow').cookie,
            ...state.players['player-one'].breakArea,
          ],
        })
      } else {
        setPlayer('player-one', {
          breakArea: state.players['player-one'].breakArea.filter(
            (card) =>
              !(
                card.type === 'cookie' &&
                card.level === 3 &&
                card.energyColor === 'yellow'
              ),
          ),
        })
      }
      return state
    case 'BS4-024': {
      putSourceInBattle(1)
      if (conditionMet) addBattleAlly(3, 'yellow', 'BS4-024-yellow-lv3')
      setPlayer('player-two', {
        battleArea: state.players['player-two'].battleArea.slice(0, 1),
      })
      return { ...state, activePlayerId: 'player-two', phase: 'main' }
    }
    case 'BS4-039':
      setAttackScenario(conditionMet ? 2 : 1)
      return state
    case 'BS4-040': {
      const sacrifice = scenarioCookie(
        'BS4-040-sacrifice',
        conditionMet ? 2 : 1,
        4,
        'yellow',
      )
      setPlayer('player-one', {
        battleArea: [cardCheckBattleEntry(sacrifice.cookie, sacrifice.hpCards, 90)],
        breakArea: conditionMet
          ? [scenarioCookie('BS4-040-revive', 3, 5, 'yellow').cookie]
          : state.players['player-one'].breakArea.filter((card) => card.level !== 3),
      })
      return state
    }
    case 'BS4-048':
      putSourceInBattle(2)
      setPlayer('player-one', {
        supportArea: scenarioSupports('BS4-048-support', conditionMet ? 7 : 6, 'green', true),
      })
      return { ...state, phase: 'end', activePlayerId: 'player-one' }
    case 'BS4-049':
      setAttackScenario()
      setPlayer('player-two', {
        supportArea: scenarioSupports('BS4-049-opponent-support', conditionMet ? 7 : 6, 'green'),
      })
      return state
    case 'BS4-052':
      putSourceInBattle(2)
      setPlayer('player-one', {
        supportArea: scenarioSupports('BS4-052-support', conditionMet ? 5 : 4, 'green', true),
      })
      return { ...state, phase: 'end', activePlayerId: 'player-one' }
    case 'BS4-053':
      setAttackScenario()
      setPlayer('player-one', {
        supportArea: scenarioSupports('BS4-053-support', conditionMet ? 7 : 6, 'green'),
      })
      return state
    case 'BS4-059':
      putSourceInBattle(1)
      setPlayer('player-one', {
        supportArea: scenarioSupports('BS4-059-support', conditionMet ? 3 : 4, 'green'),
      })
      return state
    case 'BS4-061':
      setAttackScenario()
      setPlayer('player-one', {
        supportArea: scenarioSupports('BS4-061-support', conditionMet ? 7 : 6, 'green'),
      })
      return state
    case 'BS4-073':
    case 'BS4-083':
      setAttackScenario()
      setPlayer('player-one', {
        hand: Array.from({ length: conditionMet ? 5 : 4 }, (_, index) =>
          testSupportCard(`${cardNumber}-hand-${index + 1}`, 'blue'),
        ),
      })
      return state
    case 'BS4-089':
      setAttackScenario()
      setPlayer('player-two', {
        battleArea: state.players['player-two'].battleArea.slice(0, conditionMet ? 2 : 1),
      })
      setDiscardCount('player-two', conditionMet ? 15 : 14, 'BS4-089-opponent-trash')
      return state
    case 'BS4-090': {
      setAttackScenario()
      const flipEntry = getCardPoolEntry('BS4-102')
      if (!flipEntry) throw new Error('BS4 condition fixture requires BS4-102')
      setPlayer('player-one', {
        discardPile: Array.from({ length: conditionMet ? 3 : 2 }, (_, index) =>
          createCard(flipEntry, 'player-one', 300 + index),
        ),
      })
      return state
    }
    case 'BS4-094':
      putSourceInBattle(2)
      if (conditionMet) addBattleAlly(3, 'purple', 'BS4-094-purple-lv3')
      return state
    case 'BS4-106':
      setDiscardCount('player-two', conditionMet ? 10 : 9, 'BS4-106-opponent-trash')
      return state
    case 'BS4-107':
      setDiscardCount('player-two', conditionMet ? 15 : 14, 'BS4-107-opponent-trash')
      return state
  }
}

/**
 * Builds a browser-only BS3-121 scenario from the real card pool. The five
 * Ancient Cookies intentionally provide the five exact energy colours needed
 * by the stage, while five different Soul Jam cards satisfy its special
 * victory condition. This fixture does not alter any production deck.
 */
export const createBs3SpecialVictoryDemoState = (): GameState => {
  const ancientCardNumbers = [
    'BS3-017',
    'BS3-025',
    'BS3-055',
    'BS3-088',
    'BS3-100',
  ]
  const soulJamCardNumbers = [
    'BS3-019',
    'BS3-043',
    'BS3-066',
    'BS3-091',
    'BS3-115',
  ]
  const cardNumbers = ['BS3-121', ...ancientCardNumbers, ...soulJamCardNumbers]
  const entries = cardNumbers.map((cardNumber) => {
    const entry = getCardPoolEntry(cardNumber)
    if (!entry) throw new Error(`找不到 BS3 特殊勝利測試卡片 ${cardNumber}。`)
    return entry
  })
  const stage = createCard(entries[0], 'player-one', 1)
  const ancientSupports = ancientCardNumbers.map((_, index) => ({
    card: createCard(entries[index + 1], 'player-one', index + 2),
    rested: false,
  }))
  const soulJamSupports = soulJamCardNumbers.map((_, index) => ({
    card: createCard(entries[index + 6], 'player-one', index + 7),
    rested: false,
  }))
  const state = createDemoGame(20260725)

  return {
    ...state,
    activePlayerId: 'player-one',
    phase: 'main',
    status: 'playing',
    result: null,
    players: {
      ...state.players,
      'player-one': {
        ...state.players['player-one'],
        hand: [],
        battleArea: [],
        supportArea: [...ancientSupports, ...soulJamSupports],
        breakArea: [],
        discardPile: [],
        stage: { card: stage, rested: false },
      },
    },
  }
}

export const createSoulJamEquippedDemoState = (
  soulJamCardNumber: string,
  targetCookieCardNumber: string,
): GameState => {
  const sjEntry = getCardPoolEntry(soulJamCardNumber)
  const tcEntry = getCardPoolEntry(targetCookieCardNumber)
  if (!sjEntry || !tcEntry) {
    throw new Error(
      `無法從卡池找到卡片 ${!sjEntry ? soulJamCardNumber : targetCookieCardNumber}。`,
    )
  }
  const soulJam = createCard(sjEntry, 'player-one', 1)
  const targetCookie = createCard(tcEntry, 'player-one', 2) as CookieCard
  const payColor: EnergyColor =
    targetCookie.energyColor && targetCookie.energyColor !== 'wild'
      ? targetCookie.energyColor
      : 'red'

  const hpCards = Array.from({ length: targetCookie.hp }, (_, i) =>
    testSupportCard(`${targetCookie.instanceId}-hp-${i}`, payColor),
  )
  const energySupports = Array.from({ length: 5 }, (_, i) =>
    testSupportCard(`sj-support-${i}`, payColor),
  )
  const deckFiller = Array.from({ length: 10 }, (_, i) =>
    testSupportCard(`sj-deck-${i}`, payColor),
  )
  const oppCookie = cardCheckFillerCookie('sj-opp-lv1', 1, 4, 0, 'red')

  let attackModifiers: GameState['attackModifiers'] = []
  let bonusHpCards: GameCard[] = []

  if (soulJamCardNumber === 'BS3-019') {
    attackModifiers = [
      {
        sourceInstanceId: soulJam.instanceId,
        targetInstanceId: targetCookie.instanceId,
        amount: 1,
        expiresAfterTurn: null,
      },
    ]
  }
  if (soulJamCardNumber === 'BS3-043') {
    bonusHpCards = [
      testSupportCard('sj-gain-hp-1', payColor),
      testSupportCard('sj-gain-hp-2', payColor),
    ]
  }

  return {
    players: {
      'player-one': {
        id: 'player-one',
        name: '玩家',
        ...createTestPlayerState(),
        deck: deckFiller,
        battleArea: [
          {
            card: targetCookie,
            hpCards: [...hpCards, ...bonusHpCards],
            rested: false,
            battleEntryId: `${targetCookie.instanceId}:battle:1`,
            equippedCards: [soulJam],
          },
        ],
        supportArea: energySupports.map((c) => ({ card: c, rested: false })),
      },
      'player-two': {
        id: 'player-two',
        name: 'AI 對手',
        ...createTestPlayerState(),
        deck: deckFiller,
        battleArea: [
          {
            card: oppCookie.cookie,
            hpCards: oppCookie.hpCards,
            rested: false,
            battleEntryId: `${oppCookie.cookie.instanceId}:battle:1`,
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
    attackModifiers,
    damageReceivedModifiers: [],
    flipDisabledUntilTurn: {},
    pendingReplacement: null,
    departedCookieCounts: { 'player-one': 0, 'player-two': 0 },
    pendingOnPlay: null,
    pendingRefresh: null,
    pendingBattle: null,
  }
}

/**
 * 展示 BS3-115 裝載後的對手效果保護：
 * - 對手為 P-030 Sherbet Cookie（4 張藍色能量）。
 * - BS3-100 Dark Cacao（已裝備 BS3-115）HP 全滿，
 *   BS3-088 Pure Vanilla（無保護）HP -1。
 */
export const createSoulJam115ProtectionDemoState = (): GameState => {
  const sj115Entry = getCardPoolEntry('BS3-115')
  const dcEntry = getCardPoolEntry('BS3-100')
  const pvEntry = getCardPoolEntry('BS3-088')
  const p030Entry = getCardPoolEntry('P-030')
  if (!sj115Entry || !dcEntry || !pvEntry || !p030Entry) {
    throw new Error('無法從卡池找到 BS3-115／BS3-100／BS3-088／P-030。')
  }
  const soulJam115 = createCard(sj115Entry, 'player-one', 1)
  const darkCacao = createCard(dcEntry, 'player-one', 2) as CookieCard
  const pureVanilla = createCard(pvEntry, 'player-one', 3) as CookieCard
  const p030 = createCard(p030Entry, 'player-two', 1) as CookieCard

  const dcPayColor: EnergyColor =
    darkCacao.energyColor && darkCacao.energyColor !== 'wild'
      ? darkCacao.energyColor
      : 'purple'

  const dcHpCards = Array.from({ length: darkCacao.hp }, (_, i) =>
    testSupportCard(`dc-hp-${i}`, dcPayColor),
  )
  const pvHpCards = Array.from({ length: pureVanilla.hp - 1 }, (_, i) =>
    testSupportCard(`pv-hp-${i}`, 'blue'),
  )
  const p030HpCards = Array.from({ length: p030.hp }, (_, i) =>
    testSupportCard(`p030-hp-${i}`, 'blue'),
  )
  const energySupports = Array.from({ length: 5 }, (_, i) =>
    testSupportCard(`support-${i}`, dcPayColor),
  )
  const oppSupports = Array.from({ length: 4 }, (_, i) =>
    testSupportCard(`opp-support-${i}`, 'blue'),
  )
  const deckFiller = Array.from({ length: 10 }, (_, i) =>
    testSupportCard(`deck-${i}`, dcPayColor),
  )

  return {
    players: {
      'player-one': {
        id: 'player-one',
        name: '玩家',
        ...createTestPlayerState(),
        deck: deckFiller,
        battleArea: [
          {
            card: darkCacao,
            hpCards: dcHpCards,
            rested: false,
            battleEntryId: `${darkCacao.instanceId}:battle:1`,
            equippedCards: [soulJam115],
          },
          {
            card: pureVanilla,
            hpCards: pvHpCards,
            rested: false,
            battleEntryId: `${pureVanilla.instanceId}:battle:2`,
          },
        ],
        supportArea: energySupports.map((c) => ({ card: c, rested: false })),
      },
      'player-two': {
        id: 'player-two',
        name: 'AI 對手',
        ...createTestPlayerState(),
        deck: deckFiller,
        battleArea: [
          {
            card: p030,
            hpCards: p030HpCards,
            rested: false,
            battleEntryId: `${p030.instanceId}:battle:1`,
          },
        ],
        supportArea: oppSupports.map((c) => ({ card: c, rested: false })),
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
    nextBattleEntrySequence: 4,
    attackModifiers: [],
    damageReceivedModifiers: [],
    flipDisabledUntilTurn: {},
    pendingReplacement: null,
    departedCookieCounts: { 'player-one': 0, 'player-two': 0 },
    pendingOnPlay: null,
    pendingRefresh: null,
    pendingBattle: null,
  }
}
