import { GameRuleError } from './errors'
import { findCardIndex, updatePlayer } from './helpers'
import { getRefreshCandidates } from './refresh'
import type { GameState } from './types'
import { finishWithDefeat } from './victory'
import { beginAttack, resolveBattleAutomatically } from './battle'
import {
  consumeReplacementTask,
  continuePendingReplacements,
  clearDepartedCookieModifiers,
  getCurrentReplacementTask,
  getReplacementCandidates,
  recordCookieDepartures,
} from './replacement'
import {
  canPayTrashBattleCookieCost,
  payTrashBattleCookieCost,
} from './skills'

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

  if (
    state.pendingAbilityEffect ||
    (state.pendingFaintEffects && state.pendingFaintEffects.length > 0) ||
    (state.pendingAfterDamageEffects &&
      state.pendingAfterDamageEffects.length > 0) ||
    state.pendingEffectOrder
  ) {
    throw new GameRuleError('必須先完成目前的卡牌效果。')
  }

  if (state.pendingRefresh) {
    throw new GameRuleError('必須先完成牌庫 Refresh。')
  }

  if (state.pendingBattle) {
    throw new GameRuleError('必須先完成目前的戰鬥。')
  }

  if (state.pendingOpponentHandDiscard) {
    throw new GameRuleError('必須先處理對手棄牌。')
  }

  if (state.pendingStageTrigger) {
    throw new GameRuleError('必須先處理場景觸發效果。')
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

export const canSpecialPlayCookie = (
  state: GameState,
  playerId: GameState['activePlayerId'],
  instanceId: string,
): boolean => {
  try {
    assertActiveGame(state)
    if (
      state.activePlayerId !== playerId ||
      state.phase !== 'main' ||
      state.players[playerId].battleArea.length >= 2
    ) {
      return false
    }
    const card = state.players[playerId].hand.find(
      (candidate) => candidate.instanceId === instanceId,
    )
    const cost = card?.type === 'cookie' ? card.skill?.specialPlayCost : undefined
    return Boolean(
      card &&
        card.type === 'cookie' &&
        cost &&
        canPayTrashBattleCookieCost(cost, state.players[playerId].battleArea),
    )
  } catch {
    return false
  }
}

export const deployCookie = (
  state: GameState,
  instanceId: string,
  specialPlayCookieInstanceId?: string,
): GameState => {
  assertActiveGame(state)

  if (state.phase !== 'main') {
    throw new GameRuleError('只能在主要階段登場餅乾。')
  }

  let deploymentState = state
  let player = deploymentState.players[deploymentState.activePlayerId]

  if (player.battleArea.length >= 2) {
    throw new GameRuleError('戰鬥區最多只能有兩隻餅乾。')
  }

  const cardIndex = findCardIndex(player.hand, instanceId)
  const card = player.hand[cardIndex]

  if (!card || card.type !== 'cookie') {
    throw new GameRuleError('只能從手牌登場餅乾卡。')
  }

  if (specialPlayCookieInstanceId !== undefined) {
    const specialPlayCost = card.skill?.specialPlayCost
    if (!specialPlayCost) {
      throw new GameRuleError('This Cookie does not have a Special Play cost.')
    }

    const specialPayment = payTrashBattleCookieCost(
      player,
      specialPlayCost,
      [specialPlayCookieInstanceId],
    )
    deploymentState = recordCookieDepartures(
      clearDepartedCookieModifiers(
        updatePlayer(deploymentState, specialPayment.player),
      ),
      player.id,
      specialPayment.departedCount,
    )
    player = deploymentState.players[deploymentState.activePlayerId]
  }

  const deploymentCardIndex = findCardIndex(player.hand, instanceId)
  const deploymentCard = player.hand[deploymentCardIndex]
  /*
  if (!deploymentCard || deploymentCard.type !== 'cookie') {
    throw new GameRuleError('?芾敺???湧?銋曉??)
  }

  */
  if (!deploymentCard || deploymentCard.type !== 'cookie') {
    throw new GameRuleError('Invalid Cookie deployment.')
  }

  const availableHpCards = player.deck.slice(0, deploymentCard.hp)
  const updatedState = updatePlayer(deploymentState, {
    ...player,
    deck: player.deck.slice(deploymentCard.hp),
    hand: player.hand.filter((_, index) => index !== deploymentCardIndex),
    battleArea: [
      ...player.battleArea,
      {
        card: deploymentCard,
        hpCards: availableHpCards,
        rested: false,
        battleEntryId:
          `${deploymentCard.instanceId}:battle:${deploymentState.nextBattleEntrySequence}`,
      },
    ],
  })

  return resolveDeckExhaustion(
    {
      ...updatedState,
      nextBattleEntrySequence: deploymentState.nextBattleEntrySequence + 1,
      pendingOnPlay:
        deploymentCard.skill?.trigger === 'on-play'
          ? {
              playerId: player.id,
              sourceInstanceId: deploymentCard.instanceId,
              origin: 'hand',
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

  if (
    state.pendingAbilityEffect ||
    (state.pendingFaintEffects && state.pendingFaintEffects.length > 0) ||
    (state.pendingAfterDamageEffects &&
      state.pendingAfterDamageEffects.length > 0) ||
    state.pendingEffectOrder
  ) {
    throw new GameRuleError('必須先完成目前的卡牌效果。')
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
            origin: 'hand',
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

  if (
    state.pendingAbilityEffect ||
    (state.pendingFaintEffects && state.pendingFaintEffects.length > 0) ||
    (state.pendingAfterDamageEffects &&
      state.pendingAfterDamageEffects.length > 0) ||
    state.pendingEffectOrder
  ) {
    throw new GameRuleError('必須先完成目前的卡牌效果。')
  }

  if (state.pendingOpponentHandDiscard) {
    throw new GameRuleError('必須先處理對手棄牌。')
  }

  const playerId = currentTask.playerId
  if (
    state.players[playerId].battleArea.length === 0 &&
    getReplacementCandidates(state, playerId).length > 0
  ) {
    throw new GameRuleError('戰鬥區沒有餅乾時必須先補位。')
  }
  const replacementState = consumeReplacementTask(state, playerId)

  if (state.players[playerId].battleArea.length === 0) {
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
