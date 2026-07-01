import { playItem } from './card-abilities'
import { getPendingDecision } from './commands'
import { createSeededShuffle } from './helpers'
import {
  executeCardEffect,
  getBreakToTrashCandidates,
  getEffectTargetCandidates,
  getSupportEffectCandidates,
  getTargetPlayerId,
  getTrashCookieCandidates,
  getEffectiveAttack,
  isEffectConditionMet,
  isEffectUntargeted,
} from './effects'
import { getAttackEnergyCost, selectEnergyPayment } from './energy'
import {
  finalizePendingReplacements,
  getCurrentReplacementTask,
  getReplacementCandidates,
} from './replacement'
import { activateCookieSkill, canActivateCookieSkill } from './skills'
import type {
  CardEffect,
  CardSkill,
  CookieInBattle,
  EffectContext,
  GameState,
  PlayerId,
  SupportCard,
} from './types'
import type {
  AiDecision,
  AiEffectSelection,
  AiMatchMetrics,
  AiMatchResult,
} from './ai/types'
import { handleAiPendingDecision } from './ai/pending-handler'
import { handleAiPendingBattle } from './ai/battle-handler'
import { dispatchAiStep } from './ai/dispatcher'
import {
  handleAiTurnState,
  type AiTurnStrategy,
} from './ai/turn-handler'

export type {
  AiActionType,
  AiDecision,
  AiEffectSelection,
  AiMatchMetrics,
  AiMatchResult,
} from './ai/types'

export const selectAiEnergyPayment = (
  skill: CardSkill,
  supportArea: SupportCard[],
): string[] | null =>
  selectEnergyPayment(skill.cost.energy ?? skill.cost, supportArea)

const chooseEffectTargets = (
  state: GameState,
  context: EffectContext,
  effect: CardEffect,
): string[] => {
  if (
    effect.kind === 'support-to-trash' ||
    effect.kind === 'support-to-hand'
  ) {
    return getSupportEffectCandidates(state, context)
      .slice(0, effect.amount)
      .map((support) => support.card.instanceId)
  }

  if (effect.kind === 'trash-to-battle') {
    return getTrashCookieCandidates(state, context)
      .slice(0, effect.amount)
      .map((card) => card.instanceId)
  }

  if (effect.kind === 'field-to-trash') {
    const targetPlayerId = getTargetPlayerId(context, effect.target)
    const targetPlayer = state.players[targetPlayerId]
    const stageOnly = effect.stageOnly ?? false
    if (stageOnly) {
      if (targetPlayer.stage) {
        return [targetPlayer.stage.card.instanceId]
      }
      return []
    }
    const battleCandidates = targetPlayer.battleArea.filter((cookie) => {
      if (effect.target.maxLevel !== undefined && cookie.card.level > effect.target.maxLevel) return false
      if (effect.target.minLevel !== undefined && cookie.card.level < effect.target.minLevel) return false
      if (effect.target.remainingHp !== undefined && cookie.hpCards.length > effect.target.remainingHp) return false
      return true
    })
    if (battleCandidates.length > 0) {
      const ordered = [...battleCandidates].sort(
        (left, right) => left.hpCards.length - right.hpCards.length,
      )
      return [ordered[0].card.instanceId]
    }
    if (effect.allowStage && targetPlayer.stage) {
      return [targetPlayer.stage.card.instanceId]
    }
    return []
  }

  if (effect.kind === 'gain-hp' && effect.target) {
    if (effect.target.sourceOnly) return []
    return getEffectTargetCandidates(state, context, effect.target)
      .slice(0, effect.target.max)
      .map((cookie) => cookie.card.instanceId)
  }

  if (isEffectUntargeted(effect)) {
    return []
  }

  if (effect.kind === 'break-to-trash') {
    const candidates = getBreakToTrashCandidates(state, context, effect)
    const count = Math.min(effect.max, candidates.length)
    return candidates
      .slice(0, count)
      .map((card) => card.instanceId)
  }

  if (
    effect.kind === 'inspect-deck' ||
    effect.kind === 'optional-cost-attack'
  ) {
    return []
  }

  if (!effect.target) return []

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
  } else if (
    (effect.kind === 'modify-attack' ||
      effect.kind === 'modify-damage-received') &&
    effect.amount > 0
  ) {
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

  if (!effect.target) return []

  const count = Math.min(effect.target.max, ordered.length)
  if (count < effect.target.min) {
    return []
  }

  return ordered
    .slice(0, count)
    .map((cookie) => cookie.card.instanceId)
}

const resolveAiCardAbility = (
  state: GameState,
  playerId: PlayerId,
  card: GameState['players'][PlayerId]['hand'][number],
): AiDecision | null => {
  const ability = card.item
  if (!ability) return null
  const paymentIds = selectEnergyPayment(
    ability.cost.energy ?? ability.cost,
    state.players[playerId].supportArea,
  )
  if (!paymentIds) return null
  const context = {
    sourcePlayerId: playerId,
    sourceInstanceId: card.instanceId,
  }
  const effects = ability.effects.filter((effect) =>
    isEffectConditionMet(state, context, effect),
  )
  if (effects.length === 0) return null

  let nextState = playItem(
    state,
    playerId,
    card.instanceId,
    paymentIds,
  )
  const effectSelections: AiEffectSelection[] = []
  const shuffleSeed = [...card.instanceId].reduce(
    (seed, character) => Math.imul(seed ^ character.charCodeAt(0), 16777619),
    state.turnNumber,
  )
  const shuffle = createSeededShuffle(shuffleSeed)
  for (const effect of effects) {
    const targetIds = chooseEffectTargets(nextState, context, effect)
    if (
      (effect.kind === 'support-to-trash' ||
        effect.kind === 'support-to-hand' ||
        effect.kind === 'trash-to-battle') &&
      targetIds.length < effect.amount
    ) {
      return null
    }
    if (
      !isEffectUntargeted(effect) &&
      effect.kind !== 'break-to-trash' &&
      effect.kind !== 'support-to-trash' &&
      effect.kind !== 'support-to-hand' &&
      effect.kind !== 'trash-to-battle' &&
      effect.kind !== 'inspect-deck' &&
      effect.kind !== 'optional-cost-attack' &&
      effect.target &&
      targetIds.length < effect.target.min
    ) {
      return null
    }
    nextState = executeCardEffect(nextState, context, effect, targetIds, shuffle)
    effectSelections.push({
      sourceInstanceId: card.instanceId,
      paymentIds,
      targetIds,
      effect,
    })
    if (
      nextState.pendingRefresh ||
      nextState.pendingOnPlay ||
      nextState.status !== 'playing'
    ) {
      break
    }
  }
  return {
    state: finalizePendingReplacements(nextState),
    action: 'play-item',
    description: `${state.players[playerId].name}使用${card.name}。`,
    revealedCard: card,
    effectSelections,
  }
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

  const player = state.players[playerId]
  const paymentIds = selectAiEnergyPayment(skill, player.supportArea)
  if (!paymentIds) return null

  const costSupportToTrashIds = skill.cost.supportToTrash
    ? player.supportArea
        .filter(
          (support) => !paymentIds.includes(support.card.instanceId),
        )
        .slice(0, skill.cost.supportToTrash)
        .map((support) => support.card.instanceId)
    : []

  if (
    skill.cost.supportToTrash &&
    costSupportToTrashIds.length < skill.cost.supportToTrash
  ) {
    return null
  }

  const discardHandCost = skill.cost.discardHand ?? 0
  const discardHandIds = discardHandCost > 0
    ? player.hand.slice(0, discardHandCost).map((card) => card.instanceId)
    : []

  if (
    discardHandCost > 0 &&
    discardHandIds.length < discardHandCost
  ) {
    return null
  }

  const trashBattleCookieIds = skill.cost.trashBattleCookie
    ? player.battleArea
        .filter((cookie) => {
          if (skill.cost.trashBattleCookie!.level !== undefined && cookie.card.level !== skill.cost.trashBattleCookie!.level) return false
          if (skill.cost.trashBattleCookie!.energyColor !== undefined && cookie.card.energyColor !== skill.cost.trashBattleCookie!.energyColor) return false
          return true
        })
        .sort((left, right) => left.hpCards.length - right.hpCards.length)
        .slice(0, skill.cost.trashBattleCookie!.count)
        .map((cookie) => cookie.card.instanceId)
    : []

  if (
    skill.cost.trashBattleCookie &&
    trashBattleCookieIds.length < skill.cost.trashBattleCookie.count
  ) {
    return null
  }

  if (costSupportToTrashIds.length > 0) {
    const remainingSupportAfterSkillCost = player.supportArea.filter(
      (support) =>
        !paymentIds.includes(support.card.instanceId) &&
        !costSupportToTrashIds.includes(support.card.instanceId),
    )
    const canStillAttackAfterSkill = player.battleArea.some((cookie) => {
      const attackCost = getAttackEnergyCost(cookie.card)
      return selectEnergyPayment(attackCost, remainingSupportAfterSkillCost)
    })
    if (!canStillAttackAfterSkill) {
      return null
    }
  }

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
    costSupportToTrashIds,
    discardHandIds,
    trashBattleCookieIds,
  )
  const effectSelections: AiEffectSelection[] = []

  for (const effect of effects) {
    if (nextState.status !== 'playing') {
      break
    }

    if (
      effect.kind === 'gain-hp' &&
      effect.target &&
      !effect.target.sourceOnly
    ) {
      const targetIds = chooseEffectTargets(nextState, context, effect)
      if (targetIds.length < effect.target.min) return null
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
      continue
    }

    if (isEffectUntargeted(effect)) {
      nextState = executeCardEffect(
        nextState,
        context,
        effect,
        [],
      )
      effectSelections.push({
        sourceInstanceId: source.card.instanceId,
        paymentIds,
        targetIds: [],
        effect,
      })
      continue
    }

    const targetIds = chooseEffectTargets(nextState, context, effect)
    if (
      (effect.kind === 'support-to-trash' ||
        effect.kind === 'support-to-hand' ||
        effect.kind === 'trash-to-battle') &&
      targetIds.length < effect.amount
    ) {
      return null
    }
    if (
      effect.kind !== 'break-to-trash' &&
      effect.kind !== 'support-to-trash' &&
      effect.kind !== 'support-to-hand' &&
      effect.kind !== 'trash-to-battle' &&
      effect.kind !== 'inspect-deck' &&
      effect.kind !== 'optional-cost-attack' &&
      effect.kind !== 'field-to-trash' &&
      effect.target &&
      targetIds.length < effect.target.min
    ) {
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
    state: finalizePendingReplacements(nextState),
    action: 'activate-skill',
    description: `${state.players[playerId].name}發動${source.card.name}的技能。`,
    effectSelections,
  }
}

const chooseReplacement = (state: GameState, playerId: PlayerId) =>
  getReplacementCandidates(state, playerId)
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

const aiTurnStrategy: AiTurnStrategy = {
  chooseEffectTargets,
  resolveCardAbility: resolveAiCardAbility,
  resolveSkill: resolveAiSkill,
  chooseReplacement,
  chooseAttackTarget,
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

    return (
      dispatchAiStep(state, playerId, [
        handleAiPendingDecision,
        handleAiPendingBattle,
        (current, currentPlayerId) =>
          handleAiTurnState(current, currentPlayerId, aiTurnStrategy),
      ]) ?? {
        state,
        action: 'idle',
        description: `${state.players[playerId].name}等待行動。`,
      }
    )
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
      getPendingDecision(state)?.playerId ??
      state.pendingRefresh?.playerId ??
      state.pendingOnPlay?.playerId ??
      getCurrentReplacementTask(state)?.playerId ??
      (state.pendingBattle
        ? state.pendingBattle.stage === 'flip'
          ? state.pendingBattle.damagePlayerId ??
            state.pendingBattle.defenderPlayerId
          : state.pendingBattle.stage === 'trap'
            ? state.pendingBattle.defenderPlayerId
            : state.activePlayerId
        : null) ??
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
