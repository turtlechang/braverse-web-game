import { GameRuleError } from './errors'
import { getFaintEffectMinMax, resolveFaintEffect } from './battle'
import { resolveOpponentHandDiscard } from './effects'
import type { GameState, PlayerId } from './types'

export interface FaintEffectDecision {
  kind: 'faint-effect'
  playerId: PlayerId
  sourcePlayerId: PlayerId
  sourceInstanceId: string
  min: number
  max: number
}

export interface OpponentHandDiscardDecision {
  kind: 'opponent-hand-discard'
  playerId: PlayerId
  sourcePlayerId: PlayerId
  sourceInstanceId: string
  sourceCardName: string
  effectText: string
  count: number
}

export type PendingDecision = FaintEffectDecision | OpponentHandDiscardDecision

export interface ResolveFaintEffectCommand {
  kind: 'resolve-faint-effect'
  playerId: PlayerId
  targetIds: string[]
}

export interface ResolveOpponentHandDiscardCommand {
  kind: 'resolve-opponent-hand-discard'
  playerId: PlayerId
  cardIds: string[]
}

export type GameCommand =
  | ResolveFaintEffectCommand
  | ResolveOpponentHandDiscardCommand

export const getPendingDecision = (
  state: GameState,
): PendingDecision | null => {
  if (state.pendingFaintEffects && state.pendingFaintEffects.length > 0) {
    const faint = state.pendingFaintEffects[0]
    const { min, max } = getFaintEffectMinMax(faint.effect)
    return {
      kind: 'faint-effect',
      playerId: faint.sourcePlayerId,
      sourcePlayerId: faint.sourcePlayerId,
      sourceInstanceId: faint.sourceInstanceId,
      min,
      max,
    }
  }

  if (state.pendingOpponentHandDiscard) {
    const pending = state.pendingOpponentHandDiscard
    return {
      kind: 'opponent-hand-discard',
      playerId: pending.playerId,
      sourcePlayerId: pending.sourcePlayerId,
      sourceInstanceId: pending.sourceInstanceId,
      sourceCardName: pending.sourceCardName,
      effectText: pending.effectText,
      count: pending.count,
    }
  }

  return null
}

export const applyGameCommand = (
  state: GameState,
  command: GameCommand,
): GameState => {
  const decision = getPendingDecision(state)

  if (!decision) {
    throw new GameRuleError('目前沒有待處理的決策。')
  }

  if (decision.kind !== (command.kind === 'resolve-faint-effect' ? 'faint-effect' : 'opponent-hand-discard')) {
    throw new GameRuleError('指令種類與目前待處理的決策不相符。')
  }

  if (decision.playerId !== command.playerId) {
    throw new GameRuleError('不是目前需要執行決策的玩家。')
  }

  switch (command.kind) {
    case 'resolve-faint-effect':
      return resolveFaintEffect(state, command.targetIds)
    case 'resolve-opponent-hand-discard':
      return resolveOpponentHandDiscard(state, command.playerId, command.cardIds)
  }
}
