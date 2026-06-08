import {
  attackCookie,
  deployCookie,
  placeSupportCard,
  replaceDefeatedCookie,
} from './actions'
import {
  executeCardEffect,
  getEffectTargetCandidates,
  getEffectiveAttack,
  isEffectConditionMet,
} from './effects'
import {
  getAttackEnergyCost,
  selectEnergyPayment,
} from './energy'
import { getRefreshCandidates, refreshDeck } from './refresh'
import {
  activateCookieSkill,
  canActivateCookieSkill,
} from './skills'
import { advancePhase, canAttack } from './turn'
import type {
  CardEffect,
  CardSkill,
  CookieInBattle,
  EffectContext,
  GameState,
  PlayerId,
  SupportCard,
} from './types'

export type AiActionType =
  | 'idle'
  | 'refresh'
  | 'replace-cookie'
  | 'advance-phase'
  | 'place-support'
  | 'deploy-cookie'
  | 'activate-skill'
  | 'attack'
  | 'error'

export interface AiEffectSelection {
  sourceInstanceId: string
  paymentIds: string[]
  targetIds: string[]
  effect: CardEffect
}

export interface AiDecision {
  state: GameState
  action: AiActionType
  description: string
  effectSelections?: AiEffectSelection[]
  error?: string
}

export interface AiMatchMetrics {
  skillActivations: number
  refreshes: number
  replacements: number
}

export interface AiMatchResult {
  state: GameState
  actions: number
  logs: string[]
  metrics: AiMatchMetrics
  stuck: boolean
  error: string | null
}

export const selectAiEnergyPayment = (
  skill: CardSkill,
  supportArea: SupportCard[],
): string[] | null => selectEnergyPayment(skill.cost, supportArea)

const chooseEffectTargets = (
  state: GameState,
  context: EffectContext,
  effect: CardEffect,
): string[] => {
  const candidates = getEffectTargetCandidates(
    state,
    context,
    effect.target,
  )
  const ordered = [...candidates]

  if (effect.kind === 'damage') {
    ordered.sort((left, right) => {
      const leftLethal = left.hpCards.length <= effect.amount ? 0 : 1
      const rightLethal = right.hpCards.length <= effect.amount ? 0 : 1
      return (
        leftLethal - rightLethal ||
        left.hpCards.length - right.hpCards.length
      )
    })
  } else if (effect.amount > 0) {
    ordered.sort(
      (left, right) =>
        getEffectiveAttack(state, right.card.instanceId) -
        getEffectiveAttack(state, left.card.instanceId),
    )
  } else {
    ordered.sort(
      (left, right) => left.hpCards.length - right.hpCards.length,
    )
  }

  const count = Math.min(effect.target.max, ordered.length)
  if (count < effect.target.min) {
    return []
  }

  return ordered
    .slice(0, count)
    .map((cookie) => cookie.card.instanceId)
}

const resolveAiSkill = (
  state: GameState,
  playerId: PlayerId,
  source: CookieInBattle,
  trigger: 'activate' | 'on-play',
): AiDecision | null => {
  const skill = source.card.skill
  if (
    !skill ||
    skill.trigger !== trigger ||
    !canActivateCookieSkill(
      state,
      playerId,
      source.card.instanceId,
      trigger,
    )
  ) {
    return null
  }

  const paymentIds = selectAiEnergyPayment(
    skill,
    state.players[playerId].supportArea,
  )
  if (!paymentIds) return null

  const context = {
    sourcePlayerId: playerId,
    sourceInstanceId: source.card.instanceId,
  }
  const effects = skill.effects.filter((effect) =>
    isEffectConditionMet(state, context, effect),
  )
  if (effects.length === 0) return null

  let nextState = activateCookieSkill(
    state,
    playerId,
    source.card.instanceId,
    trigger,
    paymentIds,
  )
  const effectSelections: AiEffectSelection[] = []

  for (const effect of effects) {
    const targetIds = chooseEffectTargets(nextState, context, effect)
    if (targetIds.length < effect.target.min) {
      return null
    }
    nextState = executeCardEffect(
      nextState,
      context,
      effect,
      targetIds,
    )
    effectSelections.push({
      sourceInstanceId: source.card.instanceId,
      paymentIds,
      targetIds,
      effect,
    })
  }

  return {
    state: nextState,
    action: 'activate-skill',
    description: `${state.players[playerId].name}發動${source.card.name}的技能。`,
    effectSelections,
  }
}

const chooseReplacement = (state: GameState, playerId: PlayerId) =>
  state.players[playerId].hand
    .filter(
      (card) =>
        card.type === 'cookie' &&
        state.players[playerId].deck.length >= card.hp,
    )
    .sort((left, right) =>
      left.type === 'cookie' && right.type === 'cookie'
        ? left.hp - right.hp
        : 0,
    )[0]

const chooseAttackTarget = (
  state: GameState,
  playerId: PlayerId,
) => {
  const opponentId =
    playerId === 'player-one' ? 'player-two' : 'player-one'
  return [...state.players[opponentId].battleArea].sort(
    (left, right) => left.hpCards.length - right.hpCards.length,
  )[0]
}

export const takeAiStep = (
  state: GameState,
  playerId: PlayerId = 'player-two',
): AiDecision => {
  try {
    if (state.status !== 'playing') {
      return {
        state,
        action: 'idle',
        description: '對局已結束。',
      }
    }

    if (state.pendingRefresh?.playerId === playerId) {
      const candidate = getRefreshCandidates(state, playerId)[0]
      if (!candidate) {
        return {
          state,
          action: 'error',
          description: 'AI 找不到可用的 Refresh 餅乾。',
          error: 'refresh-candidate-unavailable',
        }
      }
      return {
        state: refreshDeck(state, playerId, candidate.instanceId),
        action: 'refresh',
        description: `${state.players[playerId].name}使用${candidate.name}完成 Refresh。`,
      }
    }

    if (state.pendingReplacementPlayerId === playerId) {
      const replacement = chooseReplacement(state, playerId)
      if (!replacement) {
        return {
          state,
          action: 'error',
          description: 'AI 找不到可補充的餅乾。',
          error: 'replacement-unavailable',
        }
      }
      return {
        state: replaceDefeatedCookie(state, replacement.instanceId),
        action: 'replace-cookie',
        description: `${state.players[playerId].name}補充${replacement.name}到戰鬥區。`,
      }
    }

    if (
      state.pendingRefresh ||
      state.pendingReplacementPlayerId ||
      state.activePlayerId !== playerId
    ) {
      return {
        state,
        action: 'idle',
        description: `${state.players[playerId].name}等待行動。`,
      }
    }

    if (state.phase === 'active' || state.phase === 'draw') {
      return {
        state: advancePhase(state),
        action: 'advance-phase',
        description: `${state.players[playerId].name}推進回合階段。`,
      }
    }

    const player = state.players[playerId]
    if (state.phase === 'support') {
      if (!state.supportPlacedThisTurn && player.hand.length > 0) {
        const supportCard =
          player.hand.find((card) => card.type !== 'cookie') ??
          player.hand[0]
        return {
          state: placeSupportCard(state, supportCard.instanceId),
          action: 'place-support',
          description: `${player.name}將${supportCard.name}配置到支援區。`,
        }
      }
      return {
        state: advancePhase(state),
        action: 'advance-phase',
        description: `${player.name}進入主要階段。`,
      }
    }

    if (state.phase === 'main') {
      if (player.battleArea.length < 2) {
        const deployable = player.hand.find(
          (card) =>
            card.type === 'cookie' && player.deck.length >= card.hp,
        )
        if (deployable) {
          const deployedState = deployCookie(
            state,
            deployable.instanceId,
          )
          const deployed = deployedState.players[playerId].battleArea.find(
            (cookie) =>
              cookie.card.instanceId === deployable.instanceId,
          )
          const onPlay = deployed
            ? resolveAiSkill(
                deployedState,
                playerId,
                deployed,
                'on-play',
              )
            : null
          return {
            state: onPlay?.state ?? deployedState,
            action: 'deploy-cookie',
            description: onPlay
              ? `${player.name}讓${deployable.name}登場並發動 OnPlay。`
              : `${player.name}讓${deployable.name}登場。`,
            effectSelections: onPlay?.effectSelections,
          }
        }
      }

      for (const source of player.battleArea) {
        const skillDecision = resolveAiSkill(
          state,
          playerId,
          source,
          'activate',
        )
        if (skillDecision) return skillDecision
      }

      if (canAttack(state)) {
        const target = chooseAttackTarget(state, playerId)
        for (const attacker of player.battleArea) {
          const paymentIds = selectEnergyPayment(
            getAttackEnergyCost(attacker.card),
            player.supportArea,
          )
          if (
            target &&
            !attacker.rested &&
            paymentIds
          ) {
            return {
              state: attackCookie(
                state,
                attacker.card.instanceId,
                target.card.instanceId,
                paymentIds,
              ),
              action: 'attack',
              description: `${player.name}以${attacker.card.name}攻擊${target.card.name}。`,
            }
          }
        }
      }

      return {
        state: advancePhase(state),
        action: 'advance-phase',
        description: `${player.name}結束主要階段。`,
      }
    }

    return {
      state: advancePhase(state),
      action: 'advance-phase',
      description: `${player.name}結束回合。`,
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'AI 執行失敗。'
    return {
      state,
      action: 'error',
      description: message,
      error: message,
    }
  }
}

export const simulateAiMatch = (
  initialState: GameState,
  maxActions = 500,
): AiMatchResult => {
  let state = initialState
  const logs: string[] = []
  const metrics: AiMatchMetrics = {
    skillActivations: 0,
    refreshes: 0,
    replacements: 0,
  }
  let error: string | null = null

  for (let actionCount = 0; actionCount < maxActions; actionCount += 1) {
    if (state.status === 'finished') {
      return {
        state,
        actions: actionCount,
        logs,
        metrics,
        stuck: false,
        error,
      }
    }

    const controller =
      state.pendingRefresh?.playerId ??
      state.pendingReplacementPlayerId ??
      state.activePlayerId
    const decision = takeAiStep(state, controller)
    logs.push(
      `#${actionCount + 1} T${state.turnNumber} ${decision.description}`,
    )
    if (decision.action === 'activate-skill') {
      metrics.skillActivations += 1
    } else if (decision.action === 'refresh') {
      metrics.refreshes += 1
    } else if (decision.action === 'replace-cookie') {
      metrics.replacements += 1
    }

    if (decision.action === 'error' || decision.state === state) {
      error =
        decision.error ??
        `AI 未推進狀態：${decision.description}`
      return {
        state,
        actions: actionCount + 1,
        logs: logs.slice(-20),
        metrics,
        stuck: true,
        error,
      }
    }
    state = decision.state
  }

  return {
    state,
    actions: maxActions,
    logs: logs.slice(-20),
    metrics,
    stuck: true,
    error: `超過最大行動數 ${maxActions}。`,
  }
}
