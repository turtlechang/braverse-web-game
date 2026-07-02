import { GameRuleError } from './errors'
import {
  getAfterDamageEffectMinMax,
  getFaintEffectMinMax,
  resolveFaintEffect,
  resolveNextAfterDamageEffect,
  resolveOptionalCostAttack,
} from './battle'
import {
  executeCardEffect,
  resolveDrawUpTo,
  resolveInspectDeck,
  resolveOpponentHandDiscard,
} from './effects'
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

export interface DrawUpToDecision {
  kind: 'draw-up-to'
  playerId: PlayerId
  sourcePlayerId: PlayerId
  sourceInstanceId: string
  sourceCardName: string
  max: number
}

export interface StageTriggerDecision {
  kind: 'stage-trigger'
  playerId: PlayerId
  sourcePlayerId: PlayerId
  sourceInstanceId: string
  sourceCardName: string
  effectText: string
}

export interface AfterDamageEffectDecision {
  kind: 'after-damage-effect'
  playerId: PlayerId
  sourcePlayerId: PlayerId
  sourceInstanceId: string
  min: number
  max: number
}

export type PendingDecision =
  | FaintEffectDecision
  | OpponentHandDiscardDecision
  | InspectDeckDecision
  | OptionalCostAttackDecision
  | DrawUpToDecision
  | StageTriggerDecision
  | AfterDamageEffectDecision

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

export interface ResolveDrawUpToCommand {
  kind: 'resolve-draw-up-to'
  playerId: PlayerId
  drawCount: number
}

export interface ResolveStageTriggerCommand {
  kind: 'resolve-stage-trigger'
  playerId: PlayerId
  action: 'activate' | 'skip'
}

export interface ResolveAfterDamageEffectCommand {
  kind: 'resolve-after-damage-effect'
  playerId: PlayerId
  targetIds: string[]
}

export type GameCommand =
  | ResolveFaintEffectCommand
  | ResolveOpponentHandDiscardCommand
  | ResolveInspectDeckCommand
  | ResolveOptionalCostAttackCommand
  | ResolveDrawUpToCommand
  | ResolveStageTriggerCommand
  | ResolveAfterDamageEffectCommand

export const getPendingDecision = (
  state: GameState,
): PendingDecision | null => {
  if (state.status !== 'playing') {
    return null
  }

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

  if (state.pendingAfterDamageEffects && state.pendingAfterDamageEffects.length > 0) {
    const pending = state.pendingAfterDamageEffects[0]
    const { min, max } = getAfterDamageEffectMinMax(pending.effect)
    return {
      kind: 'after-damage-effect',
      playerId: pending.sourcePlayerId,
      sourcePlayerId: pending.sourcePlayerId,
      sourceInstanceId: pending.sourceInstanceId,
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

  if (state.pendingDrawUpTo && !state.pendingRefresh) {
    const pending = state.pendingDrawUpTo
    return {
      kind: 'draw-up-to',
      playerId: pending.playerId,
      sourcePlayerId: pending.sourcePlayerId,
      sourceInstanceId: pending.sourceInstanceId,
      sourceCardName: pending.sourceCardName,
      max: pending.max,
    }
  }

  if (state.pendingStageTrigger) {
    const pending = state.pendingStageTrigger
    return {
      kind: 'stage-trigger',
      playerId: pending.playerId,
      sourcePlayerId: pending.playerId,
      sourceInstanceId: pending.sourceInstanceId,
      sourceCardName: pending.sourceCardName,
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
  'resolve-draw-up-to': 'draw-up-to',
  'resolve-stage-trigger': 'stage-trigger',
  'resolve-after-damage-effect': 'after-damage-effect',
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
    case 'resolve-draw-up-to':
      return resolveDrawUpTo(state, command.playerId, command.drawCount)
    case 'resolve-stage-trigger': {
      const pending = state.pendingStageTrigger
      if (!pending) throw new GameRuleError('沒有待處理的場景觸發。')
      if (pending.playerId !== command.playerId) {
        throw new GameRuleError('不是目前需要執行場景觸發的玩家。')
      }
      if (command.action === 'skip') {
        return { ...state, pendingStageTrigger: null }
      }
      const playerId = pending.playerId
      const player = state.players[playerId]
      const stage = player.stage
      const ability = stage?.card.stageAbility
      if (
        !stage ||
        stage.card.instanceId !== pending.sourceInstanceId ||
        !ability?.triggered
      ) {
        throw new GameRuleError('觸發來源場景已不存在或不相符。')
      }

      let nextState: GameState = {
        ...state,
        pendingStageTrigger: null,
        players: {
          ...state.players,
          [playerId]: {
            ...player,
            stage: {
              ...stage,
              rested: ability.restSource ? true : stage.rested,
            },
          },
        },
      }
      const context = {
        sourcePlayerId: playerId,
        sourceInstanceId: stage.card.instanceId,
      }
      for (const effect of ability.effects) {
        nextState = executeCardEffect(nextState, context, effect, [])
      }
      return nextState
    }
    case 'resolve-after-damage-effect':
      return resolveNextAfterDamageEffect(state, command.targetIds)
  }
}
