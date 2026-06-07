import { GameRuleError } from './errors'
import { getAttackDamageAgainst } from './effects'
import { findCardIndex, getOpponentId, updatePlayer } from './helpers'
import { getRefreshCandidates } from './refresh'
import { canAttack } from './turn'
import type { GameState, PlayerState } from './types'
import { finishWithDefeat, resolveBasicVictory } from './victory'

const assertActiveGame = (state: GameState) => {
  if (state.status !== 'playing') {
    throw new GameRuleError('只有進行中的遊戲可以執行玩家動作。')
  }

  if (state.pendingReplacementPlayerId) {
    throw new GameRuleError('必須先補充戰鬥區餅乾。')
  }

  if (state.pendingRefresh) {
    throw new GameRuleError('必須先完成牌庫 Refresh。')
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

  if (player.deck.length < card.hp) {
    throw new GameRuleError('牌庫張數不足，無法配置餅乾 HP。')
  }

  const updatedState = updatePlayer(state, {
    ...player,
    deck: player.deck.slice(card.hp),
    hand: player.hand.filter((_, index) => index !== cardIndex),
    battleArea: [
      ...player.battleArea,
      {
        card,
        hpCards: player.deck.slice(0, card.hp),
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
    },
    player.id,
  )
}

export const replaceDefeatedCookie = (
  state: GameState,
  instanceId: string,
): GameState => {
  if (state.status !== 'playing' || !state.pendingReplacementPlayerId) {
    throw new GameRuleError('目前不需要補充戰鬥區餅乾。')
  }

  if (state.pendingRefresh) {
    throw new GameRuleError('必須先完成牌庫 Refresh。')
  }

  const playerId = state.pendingReplacementPlayerId
  const player = state.players[playerId]

  if (player.battleArea.length > 0) {
    throw new GameRuleError('戰鬥區仍有餅乾，不需要強制補充。')
  }

  const cardIndex = findCardIndex(player.hand, instanceId)
  const card = player.hand[cardIndex]

  if (!card || card.type !== 'cookie') {
    throw new GameRuleError('必須從手牌選擇一張餅乾補充戰鬥區。')
  }

  if (player.deck.length < card.hp) {
    throw new GameRuleError('牌庫張數不足，無法配置補充餅乾 HP。')
  }

  const updatedState = updatePlayer(state, {
    ...player,
    deck: player.deck.slice(card.hp),
    hand: player.hand.filter((_, index) => index !== cardIndex),
    battleArea: [
      {
        card,
        hpCards: player.deck.slice(0, card.hp),
        rested: false,
        battleEntryId:
          `${card.instanceId}:battle:${state.nextBattleEntrySequence}`,
      },
    ],
  })

  const replacementState = {
    ...updatedState,
    pendingReplacementPlayerId: null,
    nextBattleEntrySequence: state.nextBattleEntrySequence + 1,
  }

  return resolveDeckExhaustion(replacementState, player.id)
}

const receiveDamage = (
  player: PlayerState,
  targetInstanceId: string,
  damage: number,
): PlayerState => {
  const targetIndex = player.battleArea.findIndex(
    (cookie) => cookie.card.instanceId === targetInstanceId,
  )
  const target = player.battleArea[targetIndex]

  if (!target) {
    throw new GameRuleError('找不到攻擊目標。')
  }

  const damageAmount = Math.min(Math.max(damage, 0), target.hpCards.length)
  const remainingHpCount = target.hpCards.length - damageAmount
  const damagedCards = target.hpCards.slice(remainingHpCount)
  const remainingHpCards = target.hpCards.slice(0, remainingHpCount)

  if (remainingHpCards.length === 0) {
    return {
      ...player,
      battleArea: player.battleArea.filter(
        (_, index) => index !== targetIndex,
      ),
      breakArea: [...player.breakArea, target.card],
      discardPile: [...player.discardPile, ...damagedCards],
    }
  }

  return {
    ...player,
    battleArea: player.battleArea.map((cookie, index) =>
      index === targetIndex
        ? {
            ...cookie,
            hpCards: remainingHpCards,
          }
        : cookie,
    ),
    discardPile: [...player.discardPile, ...damagedCards],
  }
}

export const attackCookie = (
  state: GameState,
  attackerInstanceId: string,
  targetInstanceId: string,
  supportPaymentIds: string[],
): GameState => {
  assertActiveGame(state)

  if (!canAttack(state)) {
    throw new GameRuleError('目前不能宣告攻擊。')
  }

  const attackerPlayer = state.players[state.activePlayerId]
  const attackerIndex = attackerPlayer.battleArea.findIndex(
    (cookie) => cookie.card.instanceId === attackerInstanceId,
  )
  const attacker = attackerPlayer.battleArea[attackerIndex]

  if (!attacker) {
    throw new GameRuleError('找不到攻擊餅乾。')
  }

  if (attacker.rested) {
    throw new GameRuleError('休息狀態的餅乾不能攻擊。')
  }

  const uniquePaymentIds = [...new Set(supportPaymentIds)]

  if (uniquePaymentIds.length !== attacker.card.attackCost) {
    throw new GameRuleError(
      `此攻擊需要支付 ${attacker.card.attackCost} 張支援卡。`,
    )
  }

  const paymentIndexes = uniquePaymentIds.map((instanceId) =>
    attackerPlayer.supportArea.findIndex(
      (support) => support.card.instanceId === instanceId,
    ),
  )

  if (
    paymentIndexes.some(
      (index) =>
        index < 0 || attackerPlayer.supportArea[index]?.rested === true,
    )
  ) {
    throw new GameRuleError('只能使用自己的活躍支援卡支付攻擊費用。')
  }

  const defenderId = getOpponentId(state.activePlayerId)
  const defender = state.players[defenderId]
  const updatedAttacker = {
    ...attackerPlayer,
    battleArea: attackerPlayer.battleArea.map((cookie, index) =>
      index === attackerIndex ? { ...cookie, rested: true } : cookie,
    ),
    supportArea: attackerPlayer.supportArea.map((support, index) =>
      paymentIndexes.includes(index) ? { ...support, rested: true } : support,
    ),
  }
  const updatedDefender = receiveDamage(
    defender,
    targetInstanceId,
    getAttackDamageAgainst(state, attackerInstanceId, targetInstanceId),
  )

  let updatedState = resolveBasicVictory({
    ...state,
    players: {
      ...state.players,
      [updatedAttacker.id]: updatedAttacker,
      [updatedDefender.id]: updatedDefender,
    },
  })

  if (
    updatedState.status === 'playing' &&
    updatedDefender.battleArea.length === 0
  ) {
    updatedState = {
      ...updatedState,
      pendingReplacementPlayerId: defenderId,
    }
  }

  return updatedState
}
