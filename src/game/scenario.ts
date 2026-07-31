import { createCard } from './starter-deck'
import { getCardPoolEntry } from './card-pool'
import type {
  CookieCard,
  CookieInBattle,
  EnergyColor,
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
  /** 指定每張 HP 卡；未指定時以 `hp` 或餅乾原始 HP 產生填充卡。 */
  hpCards?: string[]
}

export interface ScenarioSideConfig {
  battle: ScenarioCookieSlot[]
  /** 測試開始時直接放入手牌的卡號。 */
  hand?: string[]
  /** 牌庫頂端到尾端的指定卡號；未指定的尾端以測試填充卡補足。 */
  deck?: string[]
  breakArea: string[]
  supportCount: number
  /** 支援區能量顏色；未指定或不足的張數以萬用能量補足。 */
  supportColors?: string[]
  /** 指定支援區實際卡片；不足的張數由 `supportColors`／萬用能量補足。 */
  supportCards?: string[]
  /** 測試開始時放置在場景區的卡片。 */
  stageCard?: string
  /** 測試開始時直接放入棄牌區的卡片。 */
  discardPile?: string[]
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

const SCENARIO_ENERGY_NAMES: Record<EnergyColor | 'wild', string> = {
  red: '紅色能量',
  yellow: '黃色能量',
  green: '綠色能量',
  blue: '藍色能量',
  purple: '紫色能量',
  black: '黑色能量',
  pure: '純色能量',
  wild: '萬用能量',
}

const createEnergyToken = (
  playerId: PlayerId,
  index: number,
  energyColor: EnergyColor | 'wild' = 'wild',
): SupportCard => ({
  card: {
    id: 'scenario-energy-token',
    instanceId: `scenario-energy-${playerId}-${index}`,
    name: `${SCENARIO_ENERGY_NAMES[energyColor]}（測試用）`,
    type: 'item',
    officialType: 'item',
    energyColor,
  },
  rested: false,
})

const SCENARIO_SUPPORT_COLOR_ALIASES: Record<
  string,
  EnergyColor | 'wild'
> = {
  r: 'red',
  red: 'red',
  紅: 'red',
  y: 'yellow',
  yellow: 'yellow',
  黃: 'yellow',
  g: 'green',
  green: 'green',
  綠: 'green',
  b: 'blue',
  blue: 'blue',
  藍: 'blue',
  p: 'purple',
  purple: 'purple',
  紫: 'purple',
  k: 'black',
  black: 'black',
  黑: 'black',
  pure: 'pure',
  純: 'pure',
  n: 'wild',
  w: 'wild',
  wild: 'wild',
  any: 'wild',
  neutral: 'wild',
  萬用: 'wild',
}

const resolveScenarioSupportColor = (
  rawColor: string,
): EnergyColor | 'wild' | null =>
  SCENARIO_SUPPORT_COLOR_ALIASES[rawColor.trim().toLowerCase()] ?? null

const buildCardList = (
  cardNumbers: string[] | undefined,
  playerId: PlayerId,
  copyIndexBase: number,
  errors: string[],
): GameCard[] =>
  (cardNumbers ?? [])
    .map((cardNumber, index) =>
      resolveCard(cardNumber, playerId, copyIndexBase + index, errors),
    )
    .filter((card): card is GameCard => card !== null)

const buildSupportArea = (
  playerId: PlayerId,
  count: number,
  rawColors: string[] | undefined,
  explicitCardNumbers: string[] | undefined,
  errors: string[],
): SupportCard[] => {
  const supportCount = Math.max(0, Math.floor(count))
  const explicitEntries = (explicitCardNumbers ?? [])
    .map((cardNumber, index) => ({
      rawCardNumber: cardNumber.trim(),
      card: resolveCard(cardNumber, playerId, 300 + index, errors),
    }))
    .filter(
      (entry): entry is { rawCardNumber: string; card: GameCard } =>
        entry.card !== null,
    )
  const explicitCards = explicitEntries.map(({ card }) => card)

  if (explicitCards.length > supportCount) {
    errors.push('支援區指定卡片數量不可超過支援區張數。')
  }

  explicitEntries.forEach(({ card, rawCardNumber }) => {
    if (!card.energyColor) {
      errors.push(`支援區卡片「${rawCardNumber}」沒有可支付的能量顏色。`)
    }
  })

  const colors: Array<EnergyColor | 'wild'> = []
  for (const rawColor of rawColors ?? []) {
    const trimmedColor = rawColor.trim()
    if (!trimmedColor) continue

    const color = resolveScenarioSupportColor(trimmedColor)
    if (!color) {
      errors.push(`無法辨識支援區能量顏色「${trimmedColor}」。`)
      continue
    }
    colors.push(color)
  }

  const generatedCount = Math.max(0, supportCount - explicitCards.length)
  if (colors.length > generatedCount) {
    errors.push('支援區能量顏色數量不可超過未指定卡片的張數。')
  }

  return [
    ...explicitCards.slice(0, supportCount).map((card) => ({
      card,
      rested: false,
    })),
    ...Array.from({ length: generatedCount }, (_, index) =>
      createEnergyToken(
        playerId,
        explicitCards.length + index,
        colors[index] ?? 'wild',
      ),
    ),
  ]
}

const createFillerDeckCard = (playerId: PlayerId, index: number): GameCard => ({
  id: 'scenario-filler-deck-card',
  instanceId: `scenario-filler-deck-${playerId}-${index}`,
  name: '測試牌庫卡',
  type: 'item',
  officialType: 'item',
})

const buildDeck = (
  deckNumbers: string[] | undefined,
  playerId: PlayerId,
  errors: string[],
): GameCard[] => {
  const configuredCards = buildCardList(deckNumbers, playerId, 100, errors)
  if (configuredCards.length > FILLER_DECK_SIZE) {
    errors.push(`牌庫指定卡片數量不可超過 ${FILLER_DECK_SIZE} 張。`)
  }

  const cards = configuredCards.slice(0, FILLER_DECK_SIZE)
  return [
    ...cards,
    ...Array.from(
      { length: Math.max(0, FILLER_DECK_SIZE - cards.length) },
      (_, index) => createFillerDeckCard(playerId, cards.length + index),
    ),
  ]
}

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
    const hpCards = slot.hpCards !== undefined
      ? buildCardList(
          slot.hpCards,
          playerId,
          1200 + index * 100,
          errors,
        )
      : Array.from({ length: hp }, (_, hpIndex) =>
          createFillerHpCard(cookieCard.instanceId, hpIndex),
        )

    if (slot.hpCards !== undefined && slot.hpCards.length > cookieCard.hp) {
      errors.push(`餅乾「${cookieCard.name}」的指定 HP 卡不可超過 ${cookieCard.hp} 張。`)
    }

    battle.push({
      card: cookieCard,
      hpCards,
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

const buildStage = (
  cardNumber: string | undefined,
  playerId: PlayerId,
  errors: string[],
): PlayerState['stage'] => {
  if (!cardNumber?.trim()) return null

  const card = resolveCard(cardNumber, playerId, 1100, errors)
  if (!card) return null
  if (card.type !== 'stage') {
    errors.push(`場景區卡片「${card.name}」不是場景卡。`)
    return null
  }

  return { card, rested: false }
}

const FILLER_DECK_SIZE = 40

const buildPlayerState = (
  playerId: PlayerId,
  name: string,
  side: ScenarioSideConfig,
  errors: string[],
): PlayerState => {
  const hand = buildCardList(side.hand, playerId, 500, errors)
  const discardPile = buildCardList(side.discardPile, playerId, 600, errors)

  return {
    id: playerId,
    name,
    deck: buildDeck(side.deck, playerId, errors),
    hand,
    battleArea: buildBattleArea(side.battle, playerId, errors),
    supportArea: buildSupportArea(
      playerId,
      side.supportCount,
      side.supportColors,
      side.supportCards,
      errors,
    ),
    breakArea: buildBreakArea(side.breakArea, playerId, errors),
    discardPile,
    stage: buildStage(side.stageCard, playerId, errors),
    hasMulliganed: true,
    startingCookieSelected: true,
    freeMulliganDecided: true,
    forcedMulliganCount: 0,
  }
}

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
