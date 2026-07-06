import { getOpponentId } from './helpers'
import type { GameCard, GameState, PlayerId, PlayerState } from './types'

/**
 * 線上對戰的遮罩版 GameState:型別上仍是完整 GameState,讓既有戰場 UI/規則函式
 * （BattleRow、EffectPanel、useMatchController 系列 hook）不用改就能吃。
 * 只把「對手」的手牌/牌庫內容、以及每隻戰鬥區餅乾隱藏中的 HP 卡換成等長度的
 * 佔位卡物件——實際隱藏的資訊量與 PlayerView 完全一樣,只是線上傳輸的格式改變。
 * 戰鬥區餅乾本體、支援區、破損區、棄牌區、場景區維持原樣(含真實 instanceId)。
 */

const createHiddenCard = (label: string, index: number): GameCard => ({
  id: 'hidden',
  instanceId: `${label}-${index}`,
  name: '???',
  type: 'item',
})

const maskCards = (cards: GameCard[], label: string): GameCard[] =>
  cards.map((_, index) => createHiddenCard(label, index))

const maskPlayerState = (player: PlayerState): PlayerState => ({
  ...player,
  hand: maskCards(player.hand, `${player.id}-hidden-hand`),
  deck: maskCards(player.deck, `${player.id}-hidden-deck`),
  battleArea: player.battleArea.map((entry) => ({
    ...entry,
    hpCards: maskCards(
      entry.hpCards,
      `${player.id}-hidden-hp-${entry.card.instanceId}`,
    ),
  })),
})

export const maskGameStateForViewer = (
  state: GameState,
  viewerId: PlayerId,
): GameState => {
  const opponentId = getOpponentId(viewerId)

  const maskedInspect =
    state.pendingInspectDeck && state.pendingInspectDeck.playerId !== viewerId
      ? {
          ...state.pendingInspectDeck,
          revealedCards: maskCards(
            state.pendingInspectDeck.revealedCards,
            `${state.pendingInspectDeck.playerId}-hidden-inspect`,
          ),
        }
      : state.pendingInspectDeck

  return {
    ...state,
    players: {
      ...state.players,
      [opponentId]: maskPlayerState(state.players[opponentId]),
    },
    pendingInspectDeck: maskedInspect,
  }
}
