import { GameRuleError } from '../errors'
import { getRefreshCandidates } from '../refresh'
import { continuePendingReplacements } from '../replacement'
import type { GameCard, GameState, PlayerId, PlayerState } from '../types'
import { finishWithDefeat } from '../victory'

export const resolveOpponentHandDiscard = (
  state: GameState,
  playerId: PlayerId,
  selectedCardIds: string[],
): GameState => {
  const pending = state.pendingOpponentHandDiscard
  if (!pending) {
    throw new GameRuleError('目前沒有等待對手棄牌的決策。')
  }

  if (pending.playerId !== playerId) {
    throw new GameRuleError('不是目前需要棄牌的玩家。')
  }

  const uniqueIds = [...new Set(selectedCardIds)]
  if (uniqueIds.length !== pending.count) {
    throw new GameRuleError(`必須選擇 ${pending.count} 張手牌棄置。`)
  }

  const player = state.players[playerId]
  if (uniqueIds.length !== selectedCardIds.length) {
    throw new GameRuleError('不能重複選擇同一張手牌。')
  }

  for (const instanceId of uniqueIds) {
    if (!player.hand.some((card) => card.instanceId === instanceId)) {
      throw new GameRuleError('選擇的卡片不在你的手牌中。')
    }
  }

  const selectedSet = new Set(uniqueIds)
  // uniqueIds 的順序就是玩家的選擇順序，放回牌庫頂時必須沿用。
  const selectedCards = uniqueIds.map(
    (id) => player.hand.find((card) => card.instanceId === id)!,
  )
  const remainingHand = player.hand.filter(
    (card) => !selectedSet.has(card.instanceId),
  )
  const updatedPlayer =
    pending.destination === 'deck-top'
      ? {
          ...player,
          hand: remainingHand,
          deck: [...selectedCards, ...player.deck],
        }
      : pending.destination === 'deck-bottom'
        ? {
            ...player,
            hand: remainingHand,
            deck: [...player.deck, ...selectedCards],
          }
        : {
            ...player,
            hand: remainingHand,
            discardPile: [...player.discardPile, ...selectedCards],
          }

  return continuePendingReplacements({
    ...state,
    players: {
      ...state.players,
      [playerId]: updatedPlayer,
    },
    pendingOpponentHandDiscard: null,
  })
}

export const resolveOpponentRestSupport = (
  state: GameState,
  playerId: PlayerId,
  selectedCardIds: string[],
): GameState => {
  const pending = state.pendingOpponentRestSupport
  if (!pending) {
    throw new GameRuleError('目前沒有等待對手橫置支援卡的決策。')
  }

  if (pending.playerId !== playerId) {
    throw new GameRuleError('不是目前需要橫置支援卡的玩家。')
  }

  const uniqueIds = [...new Set(selectedCardIds)]
  if (uniqueIds.length !== pending.count) {
    throw new GameRuleError(`必須選擇 ${pending.count} 張支援卡橫置。`)
  }

  if (uniqueIds.length !== selectedCardIds.length) {
    throw new GameRuleError('不能重複選擇同一張支援卡。')
  }

  const player = state.players[playerId]
  const selectedSet = new Set(uniqueIds)
  for (const instanceId of uniqueIds) {
    const support = player.supportArea.find(
      (entry) => entry.card.instanceId === instanceId,
    )
    if (!support) {
      throw new GameRuleError('選擇的卡片不在你的支援區中。')
    }
    if (pending.activeOnly && support.rested) {
      throw new GameRuleError('只能選擇活躍狀態的支援卡。')
    }
  }

  const updatedPlayer: PlayerState = {
    ...player,
    supportArea: player.supportArea.map((entry) =>
      selectedSet.has(entry.card.instanceId)
        ? { ...entry, rested: true }
        : entry,
    ),
  }

  return continuePendingReplacements({
    ...state,
    players: {
      ...state.players,
      [playerId]: updatedPlayer,
    },
    pendingOpponentRestSupport: null,
  })
}

export const resolveInspectDeck = (
  state: GameState,
  playerId: PlayerId,
  pickedCardIds: string[],
  restOrder: string[],
): GameState => {
  const pending = state.pendingInspectDeck
  if (!pending || pending.playerId !== playerId) {
    throw new GameRuleError('目前沒有待處理的牌庫檢視效果。')
  }

  const revealedIds = pending.revealedCards.map((card) => card.instanceId)

  // 去除重複 ID。
  const uniquePicked = [...new Set(pickedCardIds)]
  if (uniquePicked.length !== pickedCardIds.length) {
    throw new GameRuleError('不能重複選取同一張卡牌。')
  }

  // 選取數量不得超過 pickCount。
  if (uniquePicked.length > pending.pickCount) {
    throw new GameRuleError(`最多只能選取 ${pending.pickCount} 張卡牌。`)
  }

  // 若 pickCount 為 0 或未開啟 optionalPick 但有選取，仍以 pickCount 上限為準。
  // 無法一張都不選時（非 optionalPick 且 pickCount > 0 且有可選卡）要求至少選一張。
  const pickableCount = pending.revealedCards.filter(
    (c) =>
      (!pending.filterColor || c.energyColor === pending.filterColor) &&
      (!pending.filterType || c.type === pending.filterType),
  ).length
  if (
    pending.pickCount > 0 &&
    !pending.optionalPick &&
    uniquePicked.length === 0 &&
    pickableCount > 0
  ) {
    throw new GameRuleError('必須至少選取一張卡牌。')
  }

  const pickedCards: GameCard[] = []
  for (const id of uniquePicked) {
    const card = pending.revealedCards.find((c) => c.instanceId === id)
    if (!card) {
      throw new GameRuleError('選取的卡牌不在檢視清單中。')
    }
    if (pending.filterColor && card.energyColor !== pending.filterColor) {
      throw new GameRuleError(`只能選擇顏色為 ${pending.filterColor} 的卡牌。`)
    }
    if (pending.filterType && card.type !== pending.filterType) {
      throw new GameRuleError('選取的卡牌類型不符合此效果。')
    }
    pickedCards.push(card)
  }

  // 未被選走的卡必須剛好被 restOrder 完整涵蓋一次，順序才是玩家決定的結果。
  const pickedSet = new Set(uniquePicked)
  const expectedRest = revealedIds.filter((id) => !pickedSet.has(id))
  const restSet = new Set(restOrder)
  if (
    restOrder.length !== expectedRest.length ||
    restSet.size !== restOrder.length ||
    !expectedRest.every((id) => restSet.has(id))
  ) {
    throw new GameRuleError('剩餘牌順序必須包含所有未選取的檢視卡牌。')
  }

  const restCards = restOrder.map(
    (id) => pending.revealedCards.find((card) => card.instanceId === id)!,
  )

  let player: PlayerState = state.players[playerId]
  const playedCookies: GameCard[] = []

  if (pending.pickDestination === 'battle') {
    for (const pickedCard of pickedCards) {
      if (pickedCard.type !== 'cookie') {
        throw new GameRuleError('只有 Cookie 可以直接登場。')
      }
      const hpCards = player.deck.slice(
        0,
        pickedCard.hp + (pending.extraHp ?? 0),
      )
      playedCookies.push(pickedCard)
      player = {
        ...player,
        deck: player.deck.slice(hpCards.length),
        battleArea: [
          ...player.battleArea,
          {
            card: pickedCard,
            hpCards,
            rested: false,
            battleEntryId: `${pickedCard.instanceId}:battle:${state.nextBattleEntrySequence + playedCookies.length - 1}`,
          },
        ],
      }
    }
  } else if (pickedCards.length > 0) {
    player = { ...player, hand: [...player.hand, ...pickedCards] }
  }

  player =
    pending.restDestination === 'trash'
      ? { ...player, discardPile: [...player.discardPile, ...restCards] }
      : pending.restDestination === 'top'
        ? { ...player, deck: [...restCards, ...player.deck] }
        : { ...player, deck: [...player.deck, ...restCards] }

  const lastPlayedCookie = playedCookies.length > 0 ? playedCookies[playedCookies.length - 1] : null
  const nextState: GameState = {
    ...state,
    pendingInspectDeck: null,
    players: { ...state.players, [playerId]: player },
    ...(lastPlayedCookie
      ? {
          nextBattleEntrySequence: state.nextBattleEntrySequence + playedCookies.length,
          pendingOnPlay:
            lastPlayedCookie.skill?.trigger === 'on-play'
              ? { playerId, sourceInstanceId: lastPlayedCookie.instanceId }
              : null,
        }
      : {}),
  }

  // 只有登場會從牌庫抽走 HP 卡；其餘去向都不消耗牌庫，維持既有行為不另外觸發 Refresh。
  if (playedCookies.length === 0 || player.deck.length > 0 || nextState.pendingRefresh) {
    return nextState
  }

  return getRefreshCandidates(nextState, playerId).length === 0
    ? finishWithDefeat(nextState, playerId, 'refresh-unavailable')
    : { ...nextState, pendingRefresh: { playerId, remainingDraws: 0 } }
}
