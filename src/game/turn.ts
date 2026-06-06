import { GameRuleError } from './errors'
import { drawCards, getOpponentId, updatePlayer } from './helpers'
import { getRefreshCandidates } from './refresh'
import type { GameState, TurnPhase } from './types'
import { finishWithDefeat } from './victory'

const assertPlaying = (state: GameState) => {
  if (state.status !== 'playing') {
    throw new GameRuleError('只有進行中的遊戲可以推進回合。')
  }

  if (state.pendingReplacementPlayerId) {
    throw new GameRuleError('必須先補充戰鬥區餅乾。')
  }

  if (state.pendingRefresh) {
    throw new GameRuleError('必須先完成牌庫 Refresh。')
  }
}

const activateCurrentPlayer = (state: GameState): GameState => {
  const player = state.players[state.activePlayerId]

  return updatePlayer(state, {
    ...player,
    battleArea: player.battleArea.map((cookie) => ({
      ...cookie,
      rested: false,
    })),
    supportArea: player.supportArea.map((support) => ({
      ...support,
      rested: false,
    })),
  })
}

const enterDrawPhase = (state: GameState): GameState => {
  const activePlayer = state.players[state.activePlayerId]
  const drawAmount = Math.min(activePlayer.deck.length, 2)
  const updatedState = updatePlayer(
    state,
    drawCards(activePlayer, drawAmount),
  )
  const remainingDraws = 2 - drawAmount

  if (updatedState.players[state.activePlayerId].deck.length > 0) {
    return updatedState
  }

  if (getRefreshCandidates(updatedState, state.activePlayerId).length === 0) {
    return finishWithDefeat(
      updatedState,
      state.activePlayerId,
      'refresh-unavailable',
    )
  }

  return {
    ...updatedState,
    pendingRefresh: {
      playerId: state.activePlayerId,
      remainingDraws,
    },
  }
}

export const advancePhase = (state: GameState): GameState => {
  assertPlaying(state)

  switch (state.phase) {
    case 'active': {
      const activatedState = activateCurrentPlayer(state)

      if (activatedState.turnNumber === 1) {
        return { ...activatedState, phase: 'support' }
      }

      return enterDrawPhase({ ...activatedState, phase: 'draw' })
    }
    case 'draw':
      return { ...state, phase: 'support' }
    case 'support':
      return { ...state, phase: 'main' }
    case 'main':
      return { ...state, phase: 'end' }
    case 'end':
      return {
        ...state,
        attackModifiers: state.attackModifiers.filter(
          (modifier) =>
            modifier.expiresAfterTurn === null ||
            modifier.expiresAfterTurn > state.turnNumber,
        ),
        damageReceivedModifiers: state.damageReceivedModifiers.filter(
          (modifier) =>
            modifier.expiresAfterTurn === null ||
            modifier.expiresAfterTurn > state.turnNumber,
        ),
        activePlayerId: getOpponentId(state.activePlayerId),
        turnNumber: state.turnNumber + 1,
        phase: 'active',
        supportPlacedThisTurn: false,
      }
  }
}

export const canAttack = (state: GameState): boolean =>
  state.status === 'playing' &&
  !state.pendingReplacementPlayerId &&
  !state.pendingRefresh &&
  state.phase === 'main' &&
  !(state.turnNumber === 1 && state.activePlayerId === state.firstPlayerId)

export const TURN_PHASES: TurnPhase[] = [
  'active',
  'draw',
  'support',
  'main',
  'end',
]
