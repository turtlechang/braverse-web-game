import { GameRuleError } from './errors'
import { getFaintEffectMinMax, resolveFaintEffect, resolveOptionalCostAttack } from './battle'
import { resolveInspectDeck, resolveOpponentHandDiscard } from './effects'
import type { AbilityCost, CardEffect, GameState, PlayerId } from './types'

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

export interface InspectDeckDecision {
  kind: 'inspect-deck'
  playerId: PlayerId
  sourcePlayerId: PlayerId
  sourceInstanceId: string
  sourceCardName: string
  lookCount: number
  pickCount: number
  revealedCardIds: string[]
}

export interface OptionalCostAttackDecision {
  kind: 'optional-cost-attack'
  playerId: PlayerId
  sourcePlayerId: PlayerId
  sourceInstanceId: string
  sourceCardName: string
  cost: AbilityCost
  effects: CardEffect[]
  effectText: string
}

export type PendingDecision =
  | FaintEffectDecision
  | OpponentHandDiscardDecision
  | InspectDeckDecision
  | OptionalCostAttackDecision

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

export interface ResolveInspectDeckCommand {
  kind: 'resolve-inspect-deck'
  playerId: PlayerId
  pickedCardId: string
  restOrder: string[]
}

export interface ResolveOptionalCostAttackCommand {
  kind: 'resolve-optional-cost-attack'
  playerId: PlayerId
  action: 'skip' | 'pay'
  discardCardIds?: string[]
  targetIds?: string[]
}

export type GameCommand =
  | ResolveFaintEffectCommand
  | ResolveOpponentHandDiscardCommand
  | ResolveInspectDeckCommand
  | ResolveOptionalCostAttackCommand

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

  if (state.pendingInspectDeck && !state.pendingRefresh) {
    const pending = state.pendingInspectDeck
    return {
      kind: 'inspect-deck',
      playerId: pending.playerId,
      sourcePlayerId: pending.playerId,
      sourceInstanceId: pending.sourceInstanceId,
      sourceCardName: pending.sourceCardName,
      lookCount: pending.lookCount,
      pickCount: pending.pickCount,
      revealedCardIds: pending.revealedCards.map((c) => c.instanceId),
    }
  }

  if (state.pendingOptionalCostAttack) {
    const pending = state.pendingOptionalCostAttack
    return {
      kind: 'optional-cost-attack',
      playerId: pending.playerId,
      sourcePlayerId: pending.playerId,
      sourceInstanceId: pending.sourceInstanceId,
      sourceCardName: pending.sourceCardName,
      cost: pending.cost,
      effects: pending.effects,
      effectText: pending.effectText,
    }
  }

  return null
}

const cmdToDecisionKind: Record<string, string> = {
  'resolve-faint-effect': 'faint-effect',
  'resolve-opponent-hand-discard': 'opponent-hand-discard',
  'resolve-inspect-deck': 'inspect-deck',
  'resolve-optional-cost-attack': 'optional-cost-attack',
}

export const applyGameCommand = (
  state: GameState,
  command: GameCommand,
): GameState => {
  const decision = getPendingDecision(state)

  if (!decision) {
    throw new GameRuleError('目前沒有待處理的決策。')
  }

  if (decision.kind !== cmdToDecisionKind[command.kind]) {
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
    case 'resolve-inspect-deck':
      return resolveInspectDeck(state, command.playerId, command.pickedCardId, command.restOrder)
    case 'resolve-optional-cost-attack':
      return resolveOptionalCostAttack(
        state, command.playerId, command.action,
        command.discardCardIds ?? [], command.targetIds ?? [],
      )
  }
}
