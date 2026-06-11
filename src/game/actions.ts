import { GameRuleError } from './errors'
import { findCardIndex, updatePlayer } from './helpers'
import { getRefreshCandidates } from './refresh'
import type { GameState } from './types'
import { finishWithDefeat } from './victory'
import { beginAttack, resolveBattleAutomatically } from './battle'
import {
  consumeReplacementTask,
  continuePendingReplacements,
  getCurrentReplacementTask,
  getReplacementCandidates,
} from './replacement'

const assertActiveGame = (state: GameState) => {
  if (state.status !== 'playing') {
    throw new GameRuleError('只有進行中的遊戲可以執行玩家動作。')
  }

  if (state.pendingReplacement) {
    throw new GameRuleError('必須先補充戰鬥區餅乾。')
  }

  if (state.pendingOnPlay) {
    throw new GameRuleError('必須先處理餅乾的登場效果。')
  }

  if (state.pendingRefresh) {
    throw new GameRuleError('必須先完成牌庫 Refresh。')
  }

  if (state.pendingBattle) {
    throw new GameRuleError('必須先完成目前的戰鬥。')
  }

  if (state.pendingFaintEffects && state.pendingFaintEffects.length > 0) {
    throw new GameRuleError('必須先處理昏厥效果。')
  }

  if (state.pendingOpponentHandDiscard) {
    throw new GameRuleError('必須先處理對手棄牌。')
  }
}

const resolveDeckExhaustion = (
  state: GameState,
  playerId: GameState['activePlayerId'],
): GameState => {
  if (state.players[playerId].deck.length > 0) {
    return state
  }

  if (getRefreshCandidates(state, playerId).length === 0) {
    return finishWithDefeat(state, playerId, 'refresh-unavailable')
  }

  return {
    ...state,
    pendingRefresh: {
      playerId,
      remainingDraws: 0,
    },
  }
}

export const placeSupportCard = (
  state: GameState,
  instanceId: string,
): GameState => {
  assertActiveGame(state)

  if (state.phase !== 'support') {
    throw new GameRuleError('只能在支援階段放置支援卡。')
  }

  if (state.supportPlacedThisTurn) {
    throw new GameRuleError('每回合只能放置一張支援卡。')
  }

  const player = state.players[state.activePlayerId]
  const cardIndex = findCardIndex(player.hand, instanceId)
  const card = player.hand[cardIndex]

  if (!card) {
    throw new GameRuleError('找不到要放入支援區的手牌。')
  }

  const updatedState = updatePlayer(state, {
    ...player,
    hand: player.hand.filter((_, index) => index !== cardIndex),
    supportArea: [...player.supportArea, { card, rested: false }],
  })

  return {
    ...updatedState,
    supportPlacedThisTurn: true,
  }
}

export const deployCookie = (
  state: GameState,
  instanceId: string,
): GameState => {
  assertActiveGame(state)

  if (state.phase !== 'main') {
    throw new GameRuleError('只能在主要階段登場餅乾。')
  }

  const player = state.players[state.activePlayerId]

  if (player.battleArea.length >= 2) {
    throw new GameRuleError('戰鬥區最多只能有兩隻餅乾。')
  }

  const cardIndex = findCardIndex(player.hand, instanceId)
  const card = player.hand[cardIndex]

  if (!card || card.type !== 'cookie') {
    throw new GameRuleError('只能從手牌登場餅乾卡。')
  }

  const availableHpCards = player.deck.slice(0, card.hp)
  const updatedState = updatePlayer(state, {
    ...player,
    deck: player.deck.slice(card.hp),
    hand: player.hand.filter((_, index) => index !== cardIndex),
    battleArea: [
      ...player.battleArea,
      {
        card,
        hpCards: availableHpCards,
        rested: false,
        battleEntryId:
          `${card.instanceId}:battle:${state.nextBattleEntrySequence}`,
      },
    ],
  })

  return resolveDeckExhaustion(
    {
      ...updatedState,
      nextBattleEntrySequence: state.nextBattleEntrySequence + 1,
      pendingOnPlay:
        card.skill?.trigger === 'on-play'
          ? {
              playerId: player.id,
              sourceInstanceId: card.instanceId,
            }
          : null,
    },
    player.id,
  )
}

export const replaceDefeatedCookie = (
  state: GameState,
  instanceId: string,
): GameState => {
  const currentTask = getCurrentReplacementTask(state)
  if (state.status !== 'playing' || !currentTask) {
    throw new GameRuleError('目前不需要補充戰鬥區餅乾。')
  }

  if (state.pendingRefresh) {
    throw new GameRuleError('必須先完成牌庫 Refresh。')
  }

  if (state.pendingOnPlay) {
    throw new GameRuleError('必須先處理餅乾的登場效果。')
  }

  if (state.pendingFaintEffects && state.pendingFaintEffects.length > 0) {
    throw new GameRuleError('必須先處理昏厥效果。')
  }

  if (state.pendingOpponentHandDiscard) {
    throw new GameRuleError('必須先處理對手棄牌。')
  }

  const playerId = currentTask.playerId
  const player = state.players[playerId]

  if (player.battleArea.length >= 2) {
    throw new GameRuleError('戰鬥區已滿，無法放置補充餅乾。')
  }

  const cardIndex = findCardIndex(player.hand, instanceId)
  const card = player.hand[cardIndex]

  if (!card || card.type !== 'cookie') {
    throw new GameRuleError('必須從手牌選擇一張餅乾補充戰鬥區。')
  }

  const availableHpCards = player.deck.slice(0, card.hp)
  const updatedState = updatePlayer(state, {
    ...player,
    deck: player.deck.slice(card.hp),
    hand: player.hand.filter((_, index) => index !== cardIndex),
    battleArea: [
      ...player.battleArea,
      {
        card,
        hpCards: availableHpCards,
        rested: false,
        battleEntryId:
          `${card.instanceId}:battle:${state.nextBattleEntrySequence}`,
      },
    ],
  })

  const replacementState = consumeReplacementTask({
    ...updatedState,
    pendingOnPlay:
      card.skill?.trigger === 'on-play'
        ? {
            playerId,
            sourceInstanceId: card.instanceId,
          }
        : null,
    nextBattleEntrySequence: state.nextBattleEntrySequence + 1,
  }, playerId)

  const exhaustedState = resolveDeckExhaustion(
    replacementState,
    player.id,
  )

  return continuePendingReplacements(exhaustedState)
}

export const skipDefeatedCookieReplacement = (
  state: GameState,
): GameState => {
  const currentTask = getCurrentReplacementTask(state)
  if (state.status !== 'playing' || !currentTask) {
    throw new GameRuleError('目前沒有可略過的補位選擇。')
  }

  if (state.pendingRefresh) {
    throw new GameRuleError('必須先完成牌庫 Refresh。')
  }

  if (state.pendingOnPlay) {
    throw new GameRuleError('必須先處理餅乾的登場效果。')
  }

  if (state.pendingFaintEffects && state.pendingFaintEffects.length > 0) {
    throw new GameRuleError('必須先處理昏厥效果。')
  }

  if (state.pendingOpponentHandDiscard) {
    throw new GameRuleError('必須先處理對手棄牌。')
  }

  const playerId = currentTask.playerId
  const hasLegalReplacement =
    getReplacementCandidates(state, playerId).length > 0
  const replacementState = consumeReplacementTask(state, playerId)

  if (
    state.players[playerId].battleArea.length === 0 &&
    !hasLegalReplacement
  ) {
    return finishWithDefeat(
      replacementState,
      playerId,
      'no-cookie-available',
    )
  }

  return continuePendingReplacements(replacementState)
}

export const attackCookie = (
  state: GameState,
  attackerInstanceId: string,
  targetInstanceId: string,
  supportPaymentIds: string[],
): GameState => {
  assertActiveGame(state)
  return resolveBattleAutomatically(
    beginAttack(
      state,
      attackerInstanceId,
      targetInstanceId,
      supportPaymentIds,
    ),
  )
}
