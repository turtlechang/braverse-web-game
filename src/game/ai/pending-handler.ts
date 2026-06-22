import { getFaintEffectCandidates } from '../battle'
import { applyGameCommand, getPendingDecision } from '../commands'
import { getRefreshCandidates } from '../refresh'
import type { GameState, PlayerId } from '../types'
import type { AiDecision } from './types'

export const handleAiPendingDecision = (
  state: GameState,
  playerId: PlayerId,
): AiDecision | null => {
  const pendingDecision = getPendingDecision(state)

  if (
    pendingDecision?.kind === 'faint-effect' &&
    !state.pendingRefresh &&
    !state.pendingOnPlay
  ) {
    if (pendingDecision.playerId !== playerId) {
      return {
        state,
        action: 'idle',
        description: `等待 ${state.players[pendingDecision.playerId].name} 選擇昏厥效果目標。`,
      }
    }
    const candidates = getFaintEffectCandidates(state)
    const ordered = [...candidates].sort(
      (left, right) => left.hpCards.length - right.hpCards.length,
    )
    const targetIds =
      candidates.length >= pendingDecision.min
        ? ordered
            .slice(0, pendingDecision.max)
            .map((cookie) => cookie.card.instanceId)
        : []
    return {
      state: applyGameCommand(state, {
        kind: 'resolve-faint-effect',
        playerId,
        targetIds,
      }),
      action: 'resolve-faint',
      description:
        targetIds.length > 0
          ? `${state.players[playerId].name}發動對${ordered[0].card.name}的昏厥效果。`
          : `${state.players[playerId].name}略過昏厥效果。`,
    }
  }

  if (
    pendingDecision?.kind === 'opponent-hand-discard' &&
    !state.pendingRefresh
  ) {
    if (pendingDecision.playerId !== playerId) {
      return {
        state,
        action: 'idle',
        description: `等待 ${state.players[pendingDecision.playerId].name} 選擇棄置手牌。`,
      }
    }
    const discardedCards = state.players[playerId].hand.slice(
      0,
      pendingDecision.count,
    )
    const discardIds = discardedCards.map((card) => card.instanceId)
    return {
      state: applyGameCommand(state, {
        kind: 'resolve-opponent-hand-discard',
        playerId,
        cardIds: discardIds,
      }),
      action: 'idle',
      revealedCards: discardedCards,
      description: `${state.players[playerId].name}棄置 ${pendingDecision.count} 張手牌。`,
    }
  }

  if (pendingDecision?.kind === 'inspect-deck' && !state.pendingRefresh) {
    if (pendingDecision.playerId !== playerId) {
      return {
        state,
        action: 'idle',
        description: `等待 ${state.players[pendingDecision.playerId].name} 處理牌庫檢視。`,
      }
    }
    return {
      state: applyGameCommand(state, {
        kind: 'resolve-inspect-deck',
        playerId,
        pickedCardId: pendingDecision.revealedCardIds[0],
        restOrder: pendingDecision.revealedCardIds.slice(1),
      }),
      action: 'resolve-inspect-deck',
      description: `${state.players[playerId].name}從檢視牌中選取卡片。`,
    }
  }

  if (
    pendingDecision?.kind === 'optional-cost-attack' &&
    !state.pendingRefresh
  ) {
    if (pendingDecision.playerId !== playerId) {
      return {
        state,
        action: 'idle',
        description: `等待 ${state.players[pendingDecision.playerId].name} 決定是否支付代價。`,
      }
    }
    const hand = state.players[playerId].hand
    const canPay = hand.length >= pendingDecision.cost.discardHand
    const opponentId =
      playerId === 'player-one' ? 'player-two' : 'player-one'
    const hasTarget = state.players[opponentId].battleArea.length > 0
    if (canPay && hasTarget) {
      return {
        state: applyGameCommand(state, {
          kind: 'resolve-optional-cost-attack',
          playerId,
          action: 'pay',
          discardCardIds: hand
            .slice(0, pendingDecision.cost.discardHand)
            .map((card) => card.instanceId),
          targetIds: [
            state.players[opponentId].battleArea[0].card.instanceId,
          ],
        }),
        action: 'resolve-optional-cost-attack',
        description: `${state.players[playerId].name}支付棄手牌代價發動攻擊後續效果。`,
      }
    }
    return {
      state: applyGameCommand(state, {
        kind: 'resolve-optional-cost-attack',
        playerId,
        action: 'skip',
      }),
      action: 'resolve-optional-cost-attack',
      description: `${state.players[playerId].name}略過攻擊後續可選代價效果。`,
    }
  }

  if (
    pendingDecision?.kind === 'draw-up-to' &&
    !state.pendingRefresh
  ) {
    if (pendingDecision.playerId !== playerId) {
      return {
        state,
        action: 'idle',
        description: `等待 ${state.players[pendingDecision.playerId].name} 選擇抽牌數量。`,
      }
    }
    const player = state.players[playerId]
    const drawCount = Math.min(pendingDecision.max, player.deck.length)
    return {
      state: applyGameCommand(state, {
        kind: 'resolve-draw-up-to',
        playerId,
        drawCount,
      }),
      action: 'idle',
      description: `${state.players[playerId].name}從牌庫抽取 ${drawCount} 張牌。`,
    }
  }

  if (
    pendingDecision?.kind === 'stage-trigger' &&
    !state.pendingRefresh
  ) {
    if (pendingDecision.playerId !== playerId) {
      return {
        state,
        action: 'idle',
        description: `等待 ${state.players[pendingDecision.playerId].name} 決定是否發動場景效果。`,
      }
    }
    const player = state.players[playerId]
    const canDraw =
      player.deck.length > 0 || getRefreshCandidates(state, playerId).length > 0
    return {
      state: applyGameCommand(state, {
        kind: 'resolve-stage-trigger',
        playerId,
        action: canDraw ? 'activate' : 'skip',
      }),
      action: 'resolve-stage-trigger',
      description: canDraw
        ? `${state.players[playerId].name}發動${pendingDecision.sourceCardName}效果抽 1 張牌。`
        : `${state.players[playerId].name}略過${pendingDecision.sourceCardName}效果。`,
    }
  }

  return null
}
