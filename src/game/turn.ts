import { GameRuleError } from './errors'
import { drawCards, getOpponentId, updatePlayer } from './helpers'
import type { GameState, TurnPhase } from './types'

const assertPlaying = (state: GameState) => {
  if (state.status !== 'playing') {
    throw new GameRuleError('只有進行中的遊戲可以推進回合。')
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
  return updatePlayer(state, drawCards(activePlayer, 2))
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
        activePlayerId: getOpponentId(state.activePlayerId),
        turnNumber: state.turnNumber + 1,
        phase: 'active',
      }
  }
}

export const canAttack = (state: GameState): boolean =>
  state.status === 'playing' &&
  state.phase === 'main' &&
  !(state.turnNumber === 1 && state.activePlayerId === state.firstPlayerId)

export const TURN_PHASES: TurnPhase[] = [
  'active',
  'draw',
  'support',
  'main',
  'end',
]
