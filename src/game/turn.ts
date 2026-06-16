import { GameRuleError } from './errors'
import { drawCards, getOpponentId, updatePlayer } from './helpers'
import { getRefreshCandidates } from './refresh'
import { executeCardEffect, isEffectUntargeted } from './effects'
import { hasBlockingPending } from './pending'
import type { CookieCard, GameState, PlayerId, TurnPhase } from './types'
import { finishWithDefeat } from './victory'

const assertPlaying = (state: GameState) => {
  if (state.status !== 'playing') {
    throw new GameRuleError('只有進行中的遊戲可以推進回合。')
  }

  if (state.pendingReplacement) {
    throw new GameRuleError('必須先補充戰鬥區餅乾。')
  }

  if (state.pendingOnPlay) {
    throw new GameRuleError('必須先處理餅乾的登場效果。')
  }

  if (state.pendingRefresh) {
    throw new GameRuleError('必須先完成牌庫 Refresh。')
  }

  if (state.pendingBattle) {
    throw new GameRuleError('必須先完成目前的戰鬥。')
  }

  if (state.pendingOpponentHandDiscard) {
    throw new GameRuleError('必須先處理對手棄牌。')
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
    stage: player.stage ? { ...player.stage, rested: false } : null,
  })
}

const getEndPhaseSkills = (
  state: GameState,
  playerId: PlayerId,
): { cookie: CookieCard; index: number }[] =>
  state.players[playerId].battleArea
    .map((cookie, index) => ({ cookie: cookie.card, index }))
    .filter(
      (item) =>
        item.cookie.skill?.endPhase &&
        !state.skillUsesThisTurn.includes(item.cookie.instanceId),
    )

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

export const processEndPhaseEffects = (state: GameState): GameState => {
  if (hasBlockingPending(state)) {
    return state
  }

  const players = [
    state.activePlayerId,
    getOpponentId(state.activePlayerId),
  ]

  let nextState = state

  for (const playerId of players) {
    const skills = getEndPhaseSkills(nextState, playerId)
    for (const { cookie } of skills) {
      const skill = cookie.skill!
      for (const effect of skill.effects) {
        const context = {
          sourcePlayerId: playerId,
          sourceInstanceId: cookie.instanceId,
        }
        if (isEffectUntargeted(effect)) {
          nextState = executeCardEffect(nextState, context, effect, [])
          if (nextState.status !== 'playing') {
            return nextState
          }
          if (hasBlockingPending(nextState)) {
            return {
              ...nextState,
              skillUsesThisTurn: [
                ...nextState.skillUsesThisTurn,
                cookie.instanceId,
              ],
            }
          }
        }
      }
      nextState = {
        ...nextState,
        skillUsesThisTurn: [
          ...nextState.skillUsesThisTurn,
          cookie.instanceId,
        ],
      }
    }
  }

  return nextState
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
    case 'end': {
      const endPhaseState = processEndPhaseEffects(state)
      if (hasBlockingPending(endPhaseState)) {
        return endPhaseState
      }
      return {
        ...endPhaseState,
        attackModifiers: endPhaseState.attackModifiers.filter(
          (modifier) =>
            modifier.expiresAfterTurn === null ||
            modifier.expiresAfterTurn > state.turnNumber,
        ),
        damageReceivedModifiers: endPhaseState.damageReceivedModifiers.filter(
          (modifier) =>
            modifier.expiresAfterTurn === null ||
            modifier.expiresAfterTurn > state.turnNumber,
        ),
        flipDisabledUntilTurn: Object.fromEntries(
          Object.entries(endPhaseState.flipDisabledUntilTurn ?? {}).filter(
            ([, turn]) => turn > state.turnNumber,
          ),
        ),
        activePlayerId: getOpponentId(state.activePlayerId),
        turnNumber: state.turnNumber + 1,
        phase: 'active',
        supportPlacedThisTurn: false,
        skillUsesThisTurn: [],
      }
    }
  }
}

export const canAttack = (state: GameState): boolean =>
  state.status === 'playing' &&
  !hasBlockingPending(state) &&
  state.phase === 'main' &&
  !(state.turnNumber === 1 && state.activePlayerId === state.firstPlayerId)

export const TURN_PHASES: TurnPhase[] = [
  'active',
  'draw',
  'support',
  'main',
  'end',
]
