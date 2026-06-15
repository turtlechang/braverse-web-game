import {
  deployCookie,
  placeSupportCard,
  replaceDefeatedCookie,
  skipDefeatedCookieReplacement,
} from './actions'
import {
  activateStage,
  canActivateStage,
  playItem,
  playStage,
} from './card-abilities'
import {
  beginAttack,
  getFaintEffectCandidates,
  getTrapCandidates,
  getTrapTargetCandidates,
  playTrap,
  resolveAttackEffect,
  resolveFlip,
  resolveNextDamage,
  skipTrap,
} from './battle'
import {
  applyGameCommand,
  getPendingDecision,
} from './commands'
import {
  executeCardEffect,
  getBreakToTrashCandidates,
  getEffectTargetCandidates,
  getSupportEffectCandidates,
  getTrashCookieCandidates,
  getEffectiveAttack,
  isEffectConditionMet,
  isEffectUntargeted,
} from './effects'
import {
  getAttackEnergyCost,
  selectEnergyPayment,
} from './energy'
import { getRefreshCandidates, refreshDeck } from './refresh'
import {
  finalizePendingReplacements,
  getCurrentReplacementTask,
  getReplacementCandidates,
} from './replacement'
import {
  activateCookieSkill,
  canActivateCookieSkill,
  skipCookieOnPlay,
} from './skills'
import { advancePhase, canAttack } from './turn'
import type {
  CardEffect,
  CardSkill,
  CookieInBattle,
  EffectContext,
  GameCard,
  GameState,
  PlayerId,
  SupportCard,
} from './types'

export type AiActionType =
  | 'idle'
  | 'refresh'
  | 'replace-cookie'
  | 'skip-replacement'
  | 'advance-phase'
  | 'place-support'
  | 'deploy-cookie'
  | 'activate-skill'
  | 'play-item'
  | 'play-stage'
  | 'activate-stage'
  | 'attack'
  | 'play-trap'
  | 'resolve-damage'
  | 'resolve-attack-effect'
  | 'resolve-flip'
  | 'resolve-faint'
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
  revealedCard?: GameCard
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
): string[] | null => selectEnergyPayment(skill.cost.energy, supportArea)

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
    ability.cost,
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
      targetIds.length < effect.target.min
    ) {
      return null
    }
    nextState = executeCardEffect(nextState, context, effect, targetIds)
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

    const replacementTask = getCurrentReplacementTask(state)
    const pendingDecision = getPendingDecision(state)

    if (
      pendingDecision?.kind === 'faint-effect' &&
      !state.pendingRefresh &&
      !state.pendingOnPlay
    ) {
      if (pendingDecision.playerId !== playerId) {
        return {
          state,
          action: 'idle',
          description: `等待 ${state.players[pendingDecision.playerId].name} 選擇昏厥效果目標。`,
        }
      }
      const candidates = getFaintEffectCandidates(state)
      const ordered = [...candidates].sort(
        (left, right) => left.hpCards.length - right.hpCards.length,
      )
      const targetIds =
        candidates.length >= pendingDecision.min
          ? ordered.slice(0, pendingDecision.max).map((cookie) => cookie.card.instanceId)
          : []
      return {
        state: applyGameCommand(state, {
          kind: 'resolve-faint-effect',
          playerId,
          targetIds,
        }),
        action: 'resolve-faint',
        description:
          targetIds.length > 0
            ? `${state.players[playerId].name}發動對${ordered[0].card.name}的昏厥效果。`
            : `${state.players[playerId].name}略過昏厥效果。`,
      }
    }

    if (
      pendingDecision?.kind === 'opponent-hand-discard' &&
      !state.pendingRefresh &&
      !state.pendingBattle &&
      !state.pendingReplacement
    ) {
      if (pendingDecision.playerId !== playerId) {
        return {
          state,
          action: 'idle',
          description: `等待 ${state.players[pendingDecision.playerId].name} 選擇棄置手牌。`,
        }
      }
      const hand = state.players[playerId].hand
      const discardIds = hand
        .slice(0, pendingDecision.count)
        .map((card) => card.instanceId)
      return {
        state: applyGameCommand(state, {
          kind: 'resolve-opponent-hand-discard',
          playerId,
          cardIds: discardIds,
        }),
        action: 'idle',
        description: `${state.players[playerId].name}棄置 ${pendingDecision.count} 張手牌。`,
      }
    }

    if (
      state.pendingBattle &&
      !state.pendingRefresh &&
      !state.pendingReplacement
    ) {
      const battle = state.pendingBattle
      if (
        battle.stage === 'attack-effect' &&
        battle.attackerPlayerId === playerId
      ) {
        const effect = battle.attackEffects[battle.attackEffectIndex]
        const targetIds =
          effect?.kind === 'break-to-trash'
            ? getBreakToTrashCandidates(
                state,
                {
                  sourcePlayerId: playerId,
                  sourceInstanceId: battle.attackerInstanceId,
                },
                effect,
              )
                .slice(0, effect.max)
                .map((card) => card.instanceId)
            : []
        return {
          state: resolveAttackEffect(state, playerId, targetIds),
          action: 'resolve-attack-effect',
          description:
            targetIds.length > 0
              ? `${state.players[playerId].name}結算攻擊後續效果。`
              : `${state.players[playerId].name}略過攻擊後續效果。`,
        }
      }

      if (battle.stage === 'damage') {
        return {
          state: resolveNextDamage(state),
          action: 'resolve-damage',
          description: '依序翻開並結算下一張 HP 卡。',
        }
      }

      if (
        battle.stage === 'flip' &&
        (battle.damagePlayerId ?? battle.defenderPlayerId) === playerId
      ) {
        const revealed = battle.revealedHpCard
        const discardCount = revealed?.flip?.cost.discardHand ?? 0
        const discardHandIds = state.players[playerId].hand
          .slice(0, discardCount)
          .map((card) => card.instanceId)
        const canActivate =
          Boolean(revealed?.flip) &&
          discardHandIds.length === discardCount
        return {
          state: resolveFlip(state, playerId, {
            activate: canActivate,
            discardHandIds,
          }),
          action: 'resolve-flip',
          revealedCard: revealed ?? undefined,
          description: canActivate
            ? `${state.players[playerId].name}發動${revealed?.name ?? 'FLIP'}。`
            : `${state.players[playerId].name}略過 FLIP。`,
        }
      }

      if (
        battle.stage === 'trap' &&
        battle.defenderPlayerId === playerId
      ) {
        const trapCard = getTrapCandidates(state, playerId)[0]
        if (!trapCard?.trap) {
          return {
            state: skipTrap(state, playerId),
            action: 'play-trap',
            description: `${state.players[playerId].name}未發動陷阱。`,
          }
        }
        const paymentIds =
          selectEnergyPayment(
            trapCard.trap.cost.energy,
            state.players[playerId].supportArea,
          ) ?? []
        const targets = getTrapTargetCandidates(
          state,
          playerId,
          trapCard.instanceId,
        )
        const targetIds = targets
          .slice(0, 1)
          .map((target) => target.card.instanceId)
        const supportTrashEffect = trapCard.trap.effects.find(
          (effect) => effect.kind === 'support-to-trash',
        )
        const supportTrashIds =
          supportTrashEffect?.kind === 'support-to-trash'
            ? state.players[playerId].supportArea
                .slice(0, supportTrashEffect.amount)
                .map((support) => support.card.instanceId)
            : []

        if (
          supportTrashEffect?.kind === 'support-to-trash' &&
          supportTrashIds.length < supportTrashEffect.amount
        ) {
          return {
            state: skipTrap(state, playerId),
            action: 'play-trap',
            description: `${state.players[playerId].name}無法支付陷阱後續代價。`,
          }
        }

        return {
          state: playTrap(state, playerId, {
            trapInstanceId: trapCard.instanceId,
            paymentIds,
            targetIds,
            supportTrashIds,
          }),
          action: 'play-trap',
          revealedCard: trapCard,
          description: `${state.players[playerId].name}發動${trapCard.name}。`,
        }
      }

      return {
        state,
        action: 'idle',
        description: `${state.players[battle.defenderPlayerId].name}等待戰鬥回應。`,
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

    if (
      !state.pendingOnPlay &&
      replacementTask?.playerId === playerId
    ) {
      const replacement = chooseReplacement(state, playerId)
      if (!replacement) {
        return {
          state: skipDefeatedCookieReplacement(state),
          action: 'skip-replacement',
          description: `${state.players[playerId].name}選擇不補餅乾。`,
        }
      }
      const replacedState = replaceDefeatedCookie(
        state,
        replacement.instanceId,
      )
      const replaced = replacedState.players[playerId].battleArea.find(
        (cookie) => cookie.card.instanceId === replacement.instanceId,
      )
      const onPlay =
        replaced && !replacedState.pendingRefresh
          ? resolveAiSkill(replacedState, playerId, replaced, 'on-play')
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
        ? resolveAiSkill(state, playerId, source, 'on-play')
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
      const stageCard = !canAttack(state) ? player.hand.find(
        (card) => card.type === 'stage' && card.stageAbility,
      ) : undefined
      if (stageCard?.stageAbility) {
        const paymentIds = selectEnergyPayment(
          stageCard.stageAbility.placementCost,
          player.supportArea,
        )
        if (paymentIds) {
          return {
            state: playStage(
              state,
              playerId,
              stageCard.instanceId,
              paymentIds,
            ),
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
            const targetIds = chooseEffectTargets(nextState, context, effect)
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
          const itemDecision = resolveAiCardAbility(state, playerId, card)
          if (itemDecision) return itemDecision
        }
      }

      if (player.battleArea.length < 2) {
        const deployable = player.hand.find(
          (card) => card.type === 'cookie',
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
