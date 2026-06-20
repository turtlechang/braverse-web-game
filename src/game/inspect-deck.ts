import type { GameState } from './types'
import { finishWithDefeat } from './victory'

const hasLv1CookieInDiscard = (state: GameState, playerId: GameState['players'][keyof GameState['players']]['id']): boolean =>
  state.players[playerId].discardPile.some(
    (card) => card.type === 'cookie' && card.level >= 1,
  )

export const continueInspectDeckAfterRefresh = (state: GameState): GameState => {
  const pending = state.pendingInspectDeck
  if (!pending || state.pendingRefresh) return state
  if (state.status !== 'playing') return state

  const player = state.players[pending.playerId]
  const alreadyRevealed = pending.revealedCards
  const needed = pending.lookCount - alreadyRevealed.length

  if (needed <= 0) {
    return state
  }

  const newCards = player.deck.slice(0, needed)
  if (newCards.length < needed) {
    const updatedPlayer = { ...player, deck: player.deck.slice(newCards.length) }
    const nextState = {
      ...state,
      players: { ...state.players, [pending.playerId]: updatedPlayer },
      pendingInspectDeck: {
        ...pending,
        revealedCards: [...alreadyRevealed, ...newCards],
      },
    }
    if (!hasLv1CookieInDiscard(nextState, pending.playerId)) {
      return finishWithDefeat(nextState, pending.playerId, 'refresh-unavailable')
    }
    return {
      ...nextState,
      pendingRefresh: { playerId: pending.playerId, remainingDraws: 0 },
    }
  }

  const updatedPlayer = { ...player, deck: player.deck.slice(needed) }
  return {
    ...state,
    players: { ...state.players, [pending.playerId]: updatedPlayer },
    pendingInspectDeck: {
      ...pending,
      revealedCards: [...alreadyRevealed, ...newCards],
    },
  }
}
