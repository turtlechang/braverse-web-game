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

  const revealedIds = pending.revealedCards.map((card) => card.instanceId)

  let pickedCard: GameCard | null = null
  if (pickedCardId !== null) {
    pickedCard =
      pending.revealedCards.find((card) => card.instanceId === pickedCardId) ??
      null
    if (!pickedCard) {
      throw new GameRuleError('選取的卡牌不在檢視清單中。')
    }
    if (pending.filterColor && pickedCard.energyColor !== pending.filterColor) {
      throw new GameRuleError(`只能選擇顏色為 ${pending.filterColor} 的卡牌。`)
    }
    if (pending.filterType && pickedCard.type !== pending.filterType) {
      throw new GameRuleError('選取的卡牌類型不符合此效果。')
    }
  }

  if (pickedCardId !== null && restOrder.includes(pickedCardId)) {
    throw new GameRuleError('不能重複選取同一張卡牌。')
  }

  // 未被選走的卡必須剛好被 restOrder 完整涵蓋一次，順序才是玩家決定的結果。
  const expectedRest = revealedIds.filter((id) => id !== pickedCardId)
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
  let playedCookie: GameCard | null = null

  if (pickedCard) {
    if (pending.pickDestination === 'battle') {
      if (pickedCard.type !== 'cookie') {
        throw new GameRuleError('只有 Cookie 可以直接登場。')
      }
      // 官方順序是先登場（HP 取自剩餘牌庫頂）再處理其餘檢視卡。
      const hpCards = player.deck.slice(0, pickedCard.hp)
      playedCookie = pickedCard
      player = {
        ...player,
        deck: player.deck.slice(hpCards.length),
        battleArea: [
          ...player.battleArea,
          {
            card: pickedCard,
            hpCards,
            rested: false,
            battleEntryId: `${pickedCard.instanceId}:battle:${state.nextBattleEntrySequence}`,
          },
        ],
      }
    } else {
      player = { ...player, hand: [...player.hand, pickedCard] }
    }
  }

  player =
    pending.restDestination === 'trash'
      ? { ...player, discardPile: [...player.discardPile, ...restCards] }
      : pending.restDestination === 'top'
        ? { ...player, deck: [...restCards, ...player.deck] }
        : { ...player, deck: [...player.deck, ...restCards] }

  const nextState: GameState = {
    ...state,
    pendingInspectDeck: null,
    players: { ...state.players, [playerId]: player },
    ...(playedCookie
      ? {
          nextBattleEntrySequence: state.nextBattleEntrySequence + 1,
          pendingOnPlay:
            playedCookie.skill?.trigger === 'on-play'
              ? { playerId, sourceInstanceId: playedCookie.instanceId }
              : null,
        }
      : {}),
  }

  // 只有登場會從牌庫抽走 HP 卡；其餘去向都不消耗牌庫，維持既有行為不另外觸發 Refresh。
  if (!playedCookie || player.deck.length > 0 || nextState.pendingRefresh) {
    return nextState
  }

  return getRefreshCandidates(nextState, playerId).length === 0
    ? finishWithDefeat(nextState, playerId, 'refresh-unavailable')
    : { ...nextState, pendingRefresh: { playerId, remainingDraws: 0 } }
}
