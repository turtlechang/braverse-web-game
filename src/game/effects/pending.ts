import { GameRuleError } from '../errors'
import { continuePendingReplacements } from '../replacement'
import type { GameState, PlayerId } from '../types'

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
  const updatedPlayer = {
    ...player,
    hand: player.hand.filter((card) => !selectedSet.has(card.instanceId)),
    discardPile: [
      ...player.discardPile,
      ...player.hand.filter((card) => selectedSet.has(card.instanceId)),
    ],
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

export const resolveInspectDeck = (
  state: GameState,
  playerId: PlayerId,
  pickedCardId: string | null,
  restOrder: string[],
): GameState => {
  const pending = state.pendingInspectDeck
  if (!pending || pending.playerId !== playerId) {
    throw new GameRuleError('目前沒有待處理的牌庫檢視效果。')
  }
  const revealedIds = pending.revealedCards.map((c) => c.instanceId)

  if (pickedCardId === null) {
    if (restOrder.length !== revealedIds.length) {
      throw new GameRuleError('必須涵蓋所有檢視的卡牌。')
    }
    const restSet = new Set(restOrder)
    const hasAll = revealedIds.every((id) => restSet.has(id))
    if (!hasAll || restOrder.length !== revealedIds.length) {
      throw new GameRuleError('剩餘牌順序必須包含所有檢視的卡牌。')
    }
    const restCards = restOrder.map((id) => pending.revealedCards.find((c) => c.instanceId === id)!)
    const player = state.players[playerId]
    return {
      ...state,
      pendingInspectDeck: null,
      players: {
        ...state.players,
        [playerId]: {
          ...player,
          deck: [...player.deck, ...restCards],
        },
      },
    }
  }

  const pickedCard = pending.revealedCards.find((c) => c.instanceId === pickedCardId)
  if (!pickedCard) {
    throw new GameRuleError('選取的卡牌不在檢視清單中。')
  }
  if (pending.filterColor && pickedCard.energyColor !== pending.filterColor) {
    throw new GameRuleError(`只能選擇顏色為 ${pending.filterColor} 的卡牌。`)
  }
  const allIds = [pickedCardId, ...restOrder]
  if (new Set(allIds).size !== allIds.length) {
    throw new GameRuleError('不能重複選取同一張卡牌。')
  }
  const expectedRest = revealedIds.filter((id) => id !== pickedCardId)
  const restSet = new Set(restOrder)
  const hasAllRest = expectedRest.every((id) => restSet.has(id))
  if (!hasAllRest || restOrder.length !== expectedRest.length) {
    throw new GameRuleError('剩餘牌順序必須包含所有未選取的檢視卡牌。')
  }
  if (allIds.length !== revealedIds.length) {
    throw new GameRuleError('必須涵蓋所有檢視的卡牌。')
  }
  const restCards = restOrder.map((id) => pending.revealedCards.find((c) => c.instanceId === id)!)
  const player = state.players[playerId]
  return {
    ...state,
    pendingInspectDeck: null,
    players: {
      ...state.players,
      [playerId]: {
        ...player,
        hand: [...player.hand, pickedCard],
        deck: [...player.deck, ...restCards],
      },
    },
  }
}
