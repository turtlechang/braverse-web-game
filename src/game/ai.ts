import { playItem } from './card-abilities'
import { appendCommandLogEntry } from './commands'
import { getActingPlayerId } from './controller'
import { createSeededRandom, createSeededShuffle } from './helpers'
import {
  executeCardEffect,
  getBreakToTrashCandidates,
  getEffectTargetCandidates,
  getSupportEffectCandidates,
  getTargetPlayerId,
  getTrashCookieCandidates,
  getTrashToSupportCandidates,
  getEffectiveAttack,
  isEffectConditionMet,
  isEffectUntargeted,
} from './effects'
import { getAttackEnergyCost, selectEnergyPayment } from './energy'
import {
  finalizePendingReplacements,
  getReplacementCandidates,
} from './replacement'
import { activateCookieSkill, canActivateCookieSkill } from './skills'
import type {
  AbilityCost,
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
  AiLevel,
  AiMatchMetrics,
  AiMatchResult,
  AiStepOptions,
  SimulateAiMatchOptions,
} from './ai/types'
import { handleAiPendingDecision } from './ai/pending-handler'
import { handleAiPendingBattle } from './ai/battle-handler'
import { dispatchAiStep } from './ai/dispatcher'
import { handleAiRandomTurnState } from './ai/random-turn-handler'
import { handleAiEvaluatedTurnState, handleAiTwoPlyTurnState } from './ai/evaluated-turn-handler'
import {
  handleAiTurnState,
  type AiTurnStrategy,
} from './ai/turn-handler'
import {
  evaluateBreakPressure,
  getMatchupProfile,
  scoreReplacement,
  scoreAttackTarget,
} from './ai/bs2MatchupProfiles'

export type {
  AiActionType,
  AiDecision,
  AiDecisionReason,
  AiEffectSelection,
  AiLevel,
  AiMatchMetrics,
  AiMatchResult,
  AiStepOptions,
  SimulateAiMatchOptions,
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
    const candidates = getSupportEffectCandidates(state, context)
    // support-to-hand may have maxLevel filter; apply it during selection
    const filtered =
      effect.kind === 'support-to-hand' && effect.maxLevel !== undefined
        ? candidates.filter(
            (support) =>
              support.card.type !== 'cookie' ||
              support.card.level <= effect.maxLevel!,
          )
        : candidates
    return filtered
      .slice(0, effect.amount)
      .map((support) => support.card.instanceId)
  }

  if (effect.kind === 'trash-to-battle') {
    return getTrashCookieCandidates(state, context)
      .slice(0, effect.amount)
      .map((card) => card.instanceId)
  }

  if (effect.kind === 'trash-to-support') {
    return getTrashToSupportCandidates(state, context)
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

  if (effect.kind === 'return-to-hand') {
    const targetPlayerId = getTargetPlayerId(context, effect.target)
    const targetPlayer = state.players[targetPlayerId]
    const candidates = getEffectTargetCandidates(state, context, effect.target)
    const maxReturn = Math.min(effect.target.max, candidates.length, targetPlayer.battleArea.length - 1)
    if (maxReturn < effect.target.min) return []
    const ordered = [...candidates].sort(
      (left, right) => left.hpCards.length - right.hpCards.length,
    )
    return ordered.slice(0, maxReturn).map((cookie) => cookie.card.instanceId)
  }

  if (effect.kind === 'return-to-deck-bottom') {
    const targetPlayerId = getTargetPlayerId(context, effect.target)
    const targetPlayer = state.players[targetPlayerId]
    const candidates = getEffectTargetCandidates(state, context, effect.target)
    const maxReturn = Math.min(effect.target.max, candidates.length, targetPlayer.battleArea.length - 1)
    if (maxReturn < effect.target.min) return []
    const ordered = [...candidates].sort(
      (left, right) => left.hpCards.length - right.hpCards.length,
    )
    return ordered.slice(0, maxReturn).map((cookie) => cookie.card.instanceId)
  }

  if (effect.kind === 'gain-hp' && effect.target) {
    if (effect.target.sourceOnly) return []
    return getEffectTargetCandidates(state, context, effect.target)
      .slice(0, effect.target.max)
      .map((cookie) => cookie.card.instanceId)
  }

  if (effect.kind === 'opponent-battle-to-trash') {
    const opponentId =
      context.sourcePlayerId === 'player-one' ? 'player-two' : 'player-one'
    const candidates = state.players[opponentId].battleArea.filter((cookie) => {
      if (effect.maxLevel !== undefined && cookie.card.level > effect.maxLevel) return false
      if (effect.minLevel !== undefined && cookie.card.level < effect.minLevel) return false
      if (effect.remainingHp !== undefined && cookie.hpCards.length > effect.remainingHp) return false
      return true
    })
    return candidates
      .sort((left, right) => right.hpCards.length - left.hpCards.length)
      .slice(0, 1)
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
    effect.kind === 'optional-cost-attack' ||
    effect.kind === 'disable-block' ||
    effect.kind === 'trash-to-hand' ||
    effect.kind === 'trash-to-deck' ||
    effect.kind === 'flip-to-support'
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

const chooseAbilityCostIds = (
  state: GameState,
  playerId: PlayerId,
  cost: AbilityCost,
  sourceInstanceId: string,
) => {
  const player = state.players[playerId]
  const paymentIds = selectEnergyPayment(
    cost.energy ?? cost,
    player.supportArea,
  )
  if (!paymentIds) return null

  const paymentSet = new Set(paymentIds)
  const remainingSupports = player.supportArea.filter(
    (support) => !paymentSet.has(support.card.instanceId),
  )
  const supportToTrashIds = remainingSupports
    .slice(0, cost.supportToTrash ?? 0)
    .map((support) => support.card.instanceId)
  if (supportToTrashIds.length < (cost.supportToTrash ?? 0)) return null

  const supportToTrashSet = new Set(supportToTrashIds)
  const supportToHandIds = remainingSupports
    .filter((support) => !supportToTrashSet.has(support.card.instanceId))
    .slice(0, cost.supportToHand ?? 0)
    .map((support) => support.card.instanceId)
  if (supportToHandIds.length < (cost.supportToHand ?? 0)) return null

  const discardHandIds = player.hand
    .filter(
      (card) =>
        card.instanceId !== sourceInstanceId &&
        (!cost.discardHandColor || card.energyColor === cost.discardHandColor),
    )
    .slice(0, cost.discardHand ?? 0)
    .map((card) => card.instanceId)
  if (discardHandIds.length < (cost.discardHand ?? 0)) return null

  const hpToTrashTargetIds = cost.hpToTrash
    ? player.battleArea
        .filter((cookie) =>
          cost.hpToTrash?.untilRemainingHp === undefined
            ? cookie.hpCards.length > 0
            : cookie.hpCards.length > cost.hpToTrash.untilRemainingHp,
        )
        .slice(0, 1)
        .map((cookie) => cookie.card.instanceId)
    : []
  if (cost.hpToTrash && hpToTrashTargetIds.length === 0) return null

  return {
    paymentIds,
    supportToTrashIds,
    supportToHandIds,
    discardHandIds,
    hpToTrashTargetIds,
  }
}

const hasEnoughHandAfterAbilityCost = (
  state: GameState,
  playerId: PlayerId,
  sourceInstanceId: string,
  costDiscardIds: string[],
  effects: CardEffect[],
) => {
  const requiredDiscardCount = effects.reduce(
    (count, effect) =>
      effect.kind === 'discard-hand' ? count + effect.count : count,
    0,
  )
  if (requiredDiscardCount === 0) return true

  const remainingHandCount = state.players[playerId].hand.filter(
    (card) =>
      card.instanceId !== sourceInstanceId &&
      !costDiscardIds.includes(card.instanceId),
  ).length
  return remainingHandCount >= requiredDiscardCount
}

const resolveAiCardAbility = (
  state: GameState,
  playerId: PlayerId,
  card: GameState['players'][PlayerId]['hand'][number],
): AiDecision | null => {
  const ability = card.item
  if (!ability) return null
  const costIds = chooseAbilityCostIds(
    state,
    playerId,
    ability.cost,
    card.instanceId,
  )
  if (!costIds) return null

  const context = {
    sourcePlayerId: playerId,
    sourceInstanceId: card.instanceId,
  }
  const effects = ability.effects.filter((effect) =>
    isEffectConditionMet(state, context, effect),
  )
  if (effects.length === 0) return null
  if (
    !hasEnoughHandAfterAbilityCost(
      state,
      playerId,
      card.instanceId,
      costIds.discardHandIds,
      effects,
    )
  ) {
    return null
  }

  const hasModifyAttack = effects.some(
    (effect) => effect.kind === 'modify-attack',
  )
  if (hasModifyAttack) {
    const player = state.players[playerId]
    const remainingSupportsAfterItem = player.supportArea.filter(
      (support) => !costIds.paymentIds.includes(support.card.instanceId),
    )
    const canAttackAfterItem = player.battleArea.some((cookie) => {
      const attackCost = getAttackEnergyCost(cookie.card)
      return selectEnergyPayment(attackCost, remainingSupportsAfterItem)
    })
    if (!canAttackAfterItem) return null
  }

  let nextState = appendCommandLogEntry(
    state,
    playItem(
      state,
      playerId,
      card.instanceId,
      costIds.paymentIds,
      costIds.supportToTrashIds,
      costIds.supportToHandIds,
      costIds.discardHandIds,
      costIds.hpToTrashTargetIds,
    ),
    {
      kind: 'play-item',
      playerId,
      instanceId: card.instanceId,
      paymentIds: costIds.paymentIds,
    },
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
        effect.kind === 'trash-to-battle' ||
        effect.kind === 'trash-to-support') &&
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
      effect.kind !== 'trash-to-support' &&
      effect.kind !== 'inspect-deck' &&
      effect.kind !== 'optional-cost-attack' &&
      effect.kind !== 'disable-block' &&
      effect.kind !== 'trash-to-hand' &&
      effect.kind !== 'trash-to-deck' &&
      effect.kind !== 'flip-to-support' &&
      effect.kind !== 'opponent-battle-to-trash' &&
      effect.target &&
      targetIds.length < effect.target.min
    ) {
      return null
    }
    nextState = executeCardEffect(nextState, context, effect, targetIds, shuffle)
    effectSelections.push({
      sourceInstanceId: card.instanceId,
      paymentIds: costIds.paymentIds,
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

  let nextState = appendCommandLogEntry(
    state,
    activateCookieSkill(
      state,
      playerId,
      source.card.instanceId,
      trigger,
      paymentIds,
      costSupportToTrashIds,
      discardHandIds,
      trashBattleCookieIds,
    ),
    {
      kind: 'activate-skill',
      playerId,
      sourceInstanceId: source.card.instanceId,
      trigger,
      paymentIds,
      costSupportToTrashIds,
      discardHandIds,
      trashBattleCookieIds,
    },
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

    if (effect.kind === 'opponent-battle-to-trash') {
      const targetIds = chooseEffectTargets(nextState, context, effect)
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
        effect.kind === 'trash-to-battle' ||
        effect.kind === 'trash-to-support') &&
      targetIds.length < effect.amount
    ) {
      return null
    }
    if (
      effect.kind !== 'break-to-trash' &&
      effect.kind !== 'support-to-trash' &&
      effect.kind !== 'support-to-hand' &&
      effect.kind !== 'trash-to-battle' &&
      effect.kind !== 'trash-to-support' &&
      effect.kind !== 'inspect-deck' &&
      effect.kind !== 'optional-cost-attack' &&
      effect.kind !== 'field-to-trash' &&
      effect.kind !== 'disable-block' &&
      effect.kind !== 'trash-to-hand' &&
      effect.kind !== 'trash-to-deck' &&
      effect.kind !== 'flip-to-support' &&
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

const chooseReplacement = (state: GameState, playerId: PlayerId) => {
  const candidates = getReplacementCandidates(state, playerId)
  if (candidates.length === 0) return undefined

  const profile = getMatchupProfile(state, playerId)
  const breakPressure = evaluateBreakPressure(
    state.players[playerId].breakArea,
  )

  return candidates
    .filter((c) => c.type === 'cookie')
    .sort((left, right) => {
      const leftScore = scoreReplacement(left, profile, breakPressure)
      const rightScore = scoreReplacement(right, profile, breakPressure)
      return rightScore - leftScore
    })[0]
}

const chooseAttackTarget = (
  state: GameState,
  playerId: PlayerId,
) => {
  const opponentId =
    playerId === 'player-one' ? 'player-two' : 'player-one'
  const profile = getMatchupProfile(state, playerId)

  return [...state.players[opponentId].battleArea].sort((left, right) => {
    const leftScore = scoreAttackTarget(left, profile, state, playerId)
    const rightScore = scoreAttackTarget(right, profile, state, playerId)
    return rightScore - leftScore
  })[0]
}

const aiTurnStrategy: AiTurnStrategy = {
  chooseEffectTargets,
  resolveCardAbility: resolveAiCardAbility,
  resolveSkill: resolveAiSkill,
  chooseReplacement,
  chooseAttackTarget,
}

const createStepRandom = (
  seed: number,
  state: GameState,
): (() => number) => {
  const entropy =
    ((state.commandLog?.length ?? 0) * 2654435761) ^
    (state.turnNumber * 97) ^
    (state.players['player-one'].hand.length * 13) ^
    (state.players['player-two'].hand.length * 31) ^
    (state.players['player-one'].deck.length * 7) ^
    (state.players['player-two'].deck.length * 3)
  return createSeededRandom((seed ^ entropy) >>> 0)
}

export const takeAiStep = (
  state: GameState,
  playerId: PlayerId = 'player-two',
  options: AiStepOptions = {},
): AiDecision => {
  const level: AiLevel = options.level ?? 2
  try {
    if (state.status !== 'playing') {
      return {
        state,
        action: 'idle',
        description: '對局已結束。',
      }
    }

    const turnHandler =
      level === 1
        ? (current: GameState, currentPlayerId: PlayerId) =>
            handleAiRandomTurnState(
              current,
              currentPlayerId,
              createStepRandom(options.seed ?? 1, current),
            )
        : level === 3
          ? (current: GameState, currentPlayerId: PlayerId) =>
              handleAiEvaluatedTurnState(current, currentPlayerId, aiTurnStrategy)
          : level === 4
            ? (current: GameState, currentPlayerId: PlayerId) =>
                handleAiTwoPlyTurnState(current, currentPlayerId, aiTurnStrategy)
            : (current: GameState, currentPlayerId: PlayerId) =>
                handleAiTurnState(current, currentPlayerId, aiTurnStrategy)

    const decision =
      dispatchAiStep(state, playerId, [
        handleAiPendingDecision,
        handleAiPendingBattle,
        turnHandler,
      ]) ?? {
        state,
        action: 'idle' as const,
        description: `${state.players[playerId].name}等待行動。`,
      }

    return decision.reason ? decision : { ...decision, reason: { level } }
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
  options: SimulateAiMatchOptions = {},
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

    const controller = getActingPlayerId(state)
    const decision = takeAiStep(state, controller, {
      level: options.levels?.[controller] ?? 2,
      seed: options.seed,
    })
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
