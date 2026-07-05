import { createCard } from './starter-deck'
import { getCardPoolEntry } from './card-pool'
import type {
  CookieCard,
  CookieInBattle,
  GameCard,
  GameState,
  PlayerId,
  PlayerState,
  SupportCard,
} from './types'

export const SCENARIO_MAX_BATTLE_SLOTS = 2

export interface ScenarioCookieSlot {
  cardNumber: string
  hp?: number
}

export interface ScenarioSideConfig {
  battle: ScenarioCookieSlot[]
  breakArea: string[]
  supportCount: number
}

export interface ScenarioConfig {
  player: ScenarioSideConfig
  ai: ScenarioSideConfig
}

export interface ScenarioBuildResult {
  state: GameState | null
  errors: string[]
}

const resolveCard = (
  cardNumber: string,
  playerId: PlayerId,
  copyIndex: number,
  errors: string[],
): GameCard | null => {
  const trimmed = cardNumber.trim()
  if (!trimmed) return null

  const entry = getCardPoolEntry(trimmed)
  if (!entry) {
    errors.push(`找不到卡號「${trimmed}」。`)
    return null
  }

  return createCard(entry, playerId, copyIndex)
}

const createFillerHpCard = (
  ownerInstanceId: string,
  index: number,
): GameCard => ({
  id: 'scenario-filler-hp',
  instanceId: `scenario-filler-hp-${ownerInstanceId}-${index}`,
  name: 'HP',
  type: 'item',
  officialType: 'item',
})

const createEnergyToken = (
  playerId: PlayerId,
  index: number,
): SupportCard => ({
  card: {
    id: 'scenario-energy-token',
    instanceId: `scenario-energy-${playerId}-${index}`,
    name: '萬能能量（測試用）',
    type: 'item',
    officialType: 'item',
    energyColor: 'wild',
  },
  rested: false,
})

const createFillerDeckCard = (playerId: PlayerId, index: number): GameCard => ({
  id: 'scenario-filler-deck-card',
  instanceId: `scenario-filler-deck-${playerId}-${index}`,
  name: '測試牌庫卡',
  type: 'item',
  officialType: 'item',
})

const buildBattleArea = (
  slots: ScenarioCookieSlot[],
  playerId: PlayerId,
  errors: string[],
): CookieInBattle[] => {
  const battle: CookieInBattle[] = []

  slots.slice(0, SCENARIO_MAX_BATTLE_SLOTS).forEach((slot, index) => {
    const card = resolveCard(slot.cardNumber, playerId, 900 + index, errors)
    if (!card) return

    if (card.type !== 'cookie') {
      errors.push(`「${card.name}」不是餅乾卡，無法放入戰鬥區。`)
      return
    }

    const cookieCard = card as CookieCard
    const hp = Math.max(
      0,
      Math.min(slot.hp ?? cookieCard.hp, cookieCard.hp),
    )

    battle.push({
      card: cookieCard,
      hpCards: Array.from({ length: hp }, (_, hpIndex) =>
        createFillerHpCard(cookieCard.instanceId, hpIndex),
      ),
      rested: false,
      battleEntryId: `${cookieCard.instanceId}:battle:${index + 1}`,
    })
  })

  return battle
}

const buildBreakArea = (
  cardNumbers: string[],
  playerId: PlayerId,
  errors: string[],
): CookieCard[] => {
  const cards: CookieCard[] = []

  cardNumbers.forEach((cardNumber, index) => {
    const card = resolveCard(cardNumber, playerId, 700 + index, errors)
    if (!card) return

    if (card.type !== 'cookie') {
      errors.push(`「${card.name}」不是餅乾卡，無法放入破損區。`)
      return
    }

    cards.push(card as CookieCard)
  })

  return cards
}

const FILLER_DECK_SIZE = 40

const buildPlayerState = (
  playerId: PlayerId,
  name: string,
  side: ScenarioSideConfig,
  errors: string[],
): PlayerState => ({
  id: playerId,
  name,
  deck: Array.from({ length: FILLER_DECK_SIZE }, (_, index) =>
    createFillerDeckCard(playerId, index),
  ),
  hand: [],
  battleArea: buildBattleArea(side.battle, playerId, errors),
  supportArea: Array.from(
    { length: Math.max(0, Math.floor(side.supportCount)) },
    (_, index) => createEnergyToken(playerId, index),
  ),
  breakArea: buildBreakArea(side.breakArea, playerId, errors),
  discardPile: [],
  stage: null,
  hasMulliganed: true,
  startingCookieSelected: true,
  freeMulliganDecided: true,
  forcedMulliganCount: 0,
})

export const getBreakAreaLevelPreview = (
  cardNumbers: string[],
): { level: number; unknown: string[] } => {
  let level = 0
  const unknown: string[] = []

  cardNumbers.forEach((cardNumber) => {
    const trimmed = cardNumber.trim()
    if (!trimmed) return
    const entry = getCardPoolEntry(trimmed)
    if (!entry || entry.type === 'item' || entry.type === 'trap' || entry.type === 'stage') {
      unknown.push(trimmed)
      return
    }
    level += entry.level ?? 0
  })

  return { level, unknown }
}

export const buildScenarioState = (
  config: ScenarioConfig,
): ScenarioBuildResult => {
  const errors: string[] = []

  const playerState = buildPlayerState(
    'player-one',
    '玩家',
    config.player,
    errors,
  )
  const aiState = buildPlayerState('player-two', 'AI 對手', config.ai, errors)

  if (playerState.battleArea.length === 0) {
    errors.push('玩家戰鬥區至少需要放置 1 張餅乾卡。')
  }

  if (errors.length > 0) {
    return { state: null, errors }
  }

  const state: GameState = {
    players: {
      'player-one': playerState,
      'player-two': aiState,
    },
    firstPlayerId: 'player-one',
    activePlayerId: 'player-one',
    // turnNumber starts at 2: the first player cannot attack on turn 1, and
    // a test scenario should let the tester attack immediately.
    turnNumber: 2,
    phase: 'main',
    status: 'playing',
    result: null,
    supportPlacedThisTurn: false,
    skillUsesThisTurn: [],
    nextBattleEntrySequence: 100,
    attackModifiers: [],
    damageReceivedModifiers: [],
    flipDisabledUntilTurn: {},
    attackDisabledUntilTurn: {},
    pendingReplacement: null,
    departedCookieCounts: {
      'player-one': 0,
      'player-two': 0,
    },
    pendingOnPlay: null,
    pendingRefresh: null,
    pendingBattle: null,
  }

  return { state, errors: [] }
}
