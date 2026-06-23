import {
  deployCookie,
  placeSupportCard,
} from '../actions'
import {
  activateStage,
  canActivateStage,
  playStage,
} from '../card-abilities'
import { beginAttack } from '../battle'
import { applyGameCommand } from '../commands'
import { executeCardEffect } from '../effects'
import { getAttackEnergyCost, selectEnergyPayment } from '../energy'
import { getRefreshCandidates, refreshDeck } from '../refresh'
import {
  finalizePendingReplacements,
  getCurrentReplacementTask,
} from '../replacement'
import { skipCookieOnPlay } from '../skills'
import { advancePhase, canAttack } from '../turn'
import type {
  CardEffect,
  CookieInBattle,
  EffectContext,
  GameCard,
  GameState,
  PlayerId,
} from '../types'
import type { AiDecision } from './types'

export interface AiTurnStrategy {
  chooseEffectTargets: (
    state: GameState,
    context: EffectContext,
    effect: CardEffect,
  ) => string[]
  resolveCardAbility: (
    state: GameState,
    playerId: PlayerId,
    card: GameCard,
  ) => AiDecision | null
  resolveSkill: (
    state: GameState,
    playerId: PlayerId,
    source: CookieInBattle,
    trigger: 'activate' | 'on-play',
  ) => AiDecision | null
  chooseReplacement: (
    state: GameState,
    playerId: PlayerId,
  ) => GameCard | undefined
  chooseAttackTarget: (
    state: GameState,
    playerId: PlayerId,
  ) => CookieInBattle | undefined
}

export const handleAiTurnState = (
  state: GameState,
  playerId: PlayerId,
  strategy: AiTurnStrategy,
): AiDecision => {
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

  const replacementTask = getCurrentReplacementTask(state)
  if (!state.pendingOnPlay && replacementTask?.playerId === playerId) {
    const replacement = strategy.chooseReplacement(state, playerId)
    if (!replacement) {
      return {
        state: applyGameCommand(state, {
          kind: 'resolve-replacement',
          playerId,
          action: 'skip',
        }),
        action: 'skip-replacement',
        description: `${state.players[playerId].name}選擇不補餅乾。`,
      }
    }
    const replacedState = applyGameCommand(state, {
      kind: 'resolve-replacement',
      playerId,
      action: 'replace',
      cookieInstanceId: replacement.instanceId,
    })
    const replaced = replacedState.players[playerId].battleArea.find(
      (cookie) => cookie.card.instanceId === replacement.instanceId,
    )
    const onPlay =
      replaced && !replacedState.pendingRefresh
        ? strategy.resolveSkill(replacedState, playerId, replaced, 'on-play')
        : null
    return {
      state:
        onPlay?.state ??
        (replacedState.pendingOnPlay && !replacedState.pendingRefresh
          ? skipCookieOnPlay(
              replacedState,
              playerId,
              replacement.instanceId,
            )
          : replacedState),
      action: 'replace-cookie',
      effectSelections: onPlay?.effectSelections,
      description: `${state.players[playerId].name}補充${replacement.name}到戰鬥區。`,
    }
  }

  if (state.pendingOnPlay?.playerId === playerId) {
    const source = state.players[playerId].battleArea.find(
      (cookie) =>
        cookie.card.instanceId === state.pendingOnPlay?.sourceInstanceId,
    )
    const onPlay = source
      ? strategy.resolveSkill(state, playerId, source, 'on-play')
      : null
    return (
      onPlay ?? {
        state: skipCookieOnPlay(
          state,
          playerId,
          state.pendingOnPlay.sourceInstanceId,
        ),
        action: 'idle',
        description: `${state.players[playerId].name}未發動登場效果。`,
      }
    )
  }

  if (
    state.pendingRefresh ||
    state.pendingReplacement ||
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
        player.hand.find((card) => card.type !== 'cookie') ?? player.hand[0]
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
    const stageCard = !canAttack(state)
      ? player.hand.find((card) => card.type === 'stage' && card.stageAbility)
      : undefined
    if (stageCard?.stageAbility) {
      const paymentIds = selectEnergyPayment(
        stageCard.stageAbility.placementCost,
        player.supportArea,
      )
      if (paymentIds) {
        return {
          state: playStage(state, playerId, stageCard.instanceId, paymentIds),
          action: 'play-stage',
          description: `${player.name}放置${stageCard.name}。`,
        }
      }
    }

    if (!canAttack(state) && canActivateStage(state, playerId)) {
      const stage = player.stage!
      const ability = stage.card.stageAbility!
      const paymentIds = selectEnergyPayment(
        ability.cost,
        player.supportArea,
      )
      if (paymentIds) {
        const context = {
          sourcePlayerId: playerId,
          sourceInstanceId: stage.card.instanceId,
        }
        let nextState = activateStage(state, playerId, paymentIds)
        for (const effect of ability.effects) {
          const targetIds = strategy.chooseEffectTargets(
            nextState,
            context,
            effect,
          )
          if (
            (effect.kind === 'support-to-hand' ||
              effect.kind === 'support-to-trash') &&
            targetIds.length < effect.amount
          ) {
            break
          }
          nextState = executeCardEffect(
            nextState,
            context,
            effect,
            targetIds,
          )
          if (nextState.pendingRefresh) break
        }
        return {
          state: finalizePendingReplacements(nextState),
          action: 'activate-stage',
          description: `${player.name}啟動${stage.card.name}。`,
        }
      }
    }

    if (!canAttack(state)) {
      for (const card of player.hand) {
        const itemDecision = strategy.resolveCardAbility(
          state,
          playerId,
          card,
        )
        if (itemDecision) return itemDecision
      }
    }

    if (player.battleArea.length < 2) {
      const deployable = player.hand.find((card) => card.type === 'cookie')
      if (deployable) {
        const deployedState = deployCookie(state, deployable.instanceId)
        const deployed = deployedState.players[playerId].battleArea.find(
          (cookie) => cookie.card.instanceId === deployable.instanceId,
        )
        const onPlay = deployed
          ? strategy.resolveSkill(
              deployedState,
              playerId,
              deployed,
              'on-play',
            )
          : null
        return {
          state:
            onPlay?.state ??
            (deployedState.pendingOnPlay
              ? skipCookieOnPlay(
                  deployedState,
                  playerId,
                  deployable.instanceId,
                )
              : deployedState),
          action: 'deploy-cookie',
          description: onPlay
            ? `${player.name}讓${deployable.name}登場並發動 OnPlay。`
            : `${player.name}讓${deployable.name}登場。`,
          effectSelections: onPlay?.effectSelections,
        }
      }
    }

    for (const source of player.battleArea) {
      const skillDecision = strategy.resolveSkill(
        state,
        playerId,
        source,
        'activate',
      )
      if (skillDecision) return skillDecision
    }

    if (canAttack(state)) {
      const target = strategy.chooseAttackTarget(state, playerId)
      for (const attacker of player.battleArea) {
        const paymentIds = selectEnergyPayment(
          getAttackEnergyCost(attacker.card),
          player.supportArea,
        )
        if (target && !attacker.rested && paymentIds) {
          return {
            state: beginAttack(
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
}
