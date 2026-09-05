import { getOpponentId, updatePlayer } from '../helpers'
import { getRefreshCandidates } from '../refresh'
import { finishWithDefeat } from '../victory'
import type { DeckToTrashEffect, EffectContext, GameCard, GameState } from '../types'

/** Preserve exactly this effect's moved cards across an intervening Refresh. */
export const executeDeckToTrash = (
  state: GameState,
  context: EffectContext,
  effect: DeckToTrashEffect,
  previousCards: GameCard[] = [],
): GameState => {
  const playerId = effect.side === 'self' ? context.sourcePlayerId : getOpponentId(context.sourcePlayerId)
  const player = state.players[playerId]
  const moved = player.deck.slice(0, effect.amount)
  const movedCards = [...previousCards, ...moved]
  const next: GameState = {
    ...updatePlayer(state, { ...player, deck: player.deck.slice(moved.length), discardPile: [...player.discardPile, ...moved] }),
    deckTrashResolution: { sourcePlayerId: context.sourcePlayerId, sourceInstanceId: context.sourceInstanceId, cards: movedCards },
  }
  if (next.players[playerId].deck.length > 0) return next
  if (getRefreshCandidates(next, playerId).length === 0) return finishWithDefeat(next, playerId, 'refresh-unavailable')
  return { ...next, pendingRefresh: {
    playerId, remainingDraws: 0,
    remainingDeckToTrash: { context, effect: {...effect, amount: effect.amount - moved.length}, movedCards },
  } }
}
