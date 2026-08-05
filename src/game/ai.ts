import { playItem } from './card-abilities'
import { getForcedAttackTargetId } from './battle'
import { applyGameCommand } from './commands'
import { getActingPlayerId } from './controller'
import { createSeededRandom, createSeededShuffle } from './helpers'
import {
  getBreakToTrashCandidates,
  getCookieOwnerId,
  getEffectSelectionCandidates,
  getEffectSelectionLimits,
  getEffectTargetCandidates,
  getSupportEffectCandidates,
  getTargetPlayerId,
  getTrashCookieCandidates,
  getTrashToBreakCandidates,
  getTrashToDeckCandidates,
  getTrashToSupportCandidates,
  getEffectiveAttack,
  isEffectConditionMet,
  isEffectUntargeted,
} from './effects'
import { getAttackEnergyCostForState, selectEnergyPayment } from './energy'
import { getReplacementCandidates } from './replacement'
import {
  activateCookieSkill,
  canActivateCookieSkill,
  getTrashBattleCookieCostCandidates,
  getTrashToDeckCostCandidates,
  getTrashToDeckBottomCostCandidates,
} from './skills'
import { simulateAbilityEffects } from './ai/ability-effects'
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
  scoreReplacementAdvanced,
  sumBreakLevel,
  scoreAttackTarget,
} from './ai/bs2MatchupProfiles'
import { isRuleEnabled } from './ai/rule-profiles'

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
    effect.kind === 'break-to-battle' ||
    effect.kind === 'support-to-battle' ||
    effect.kind === 'hand-to-break' ||
    effect.kind === 'break-to-hand' ||
    effect.kind === 'hand-to-hp' ||
    effect.kind === 'rest-support' ||
    effect.kind === 'support-to-hp' ||
    effect.kind === 'cycle-hp' ||
    effect.kind === 'rest-support-and-damage' ||
    effect.kind === 'field-to-deck-bottom' ||
    effect.kind === 'hand-to-battle' ||
    effect.kind === 'opponent-trash-to-break' ||
    (effect.kind === 'set-active' && effect.selectable)
  ) {
    if (effect.kind === 'rest-support-and-damage') {
      const candidates = getEffectSelectionCandidates(state, context, effect)
      const targetIds = new Set(
        getEffectTargetCandidates(state, context, effect.target).map(
          (cookie) => cookie.card.instanceId,
        ),
      )
      return [
        ...candidates.filter((card) => !targetIds.has(card.instanceId)).slice(0, effect.supportAmount),
        ...candidates.filter((card) => targetIds.has(card.instanceId)).slice(0, effect.target.max),
      ].map((card) => card.instanceId)
    }
    if (effect.kind === 'support-to-hp' && effect.selectTarget) {
      const candidates = getEffectSelectionCandidates(state, context, effect)
      const targetIds = new Set(
        getEffectTargetCandidates(state, context, effect.target).map(
          (cookie) => cookie.card.instanceId,
        ),
      )
      return [
        candidates.find((card) => !targetIds.has(card.instanceId)),
        candidates.find((card) => targetIds.has(card.instanceId)),
      ].flatMap((card) => (card ? [card.instanceId] : []))
    }
    const max = getEffectSelectionLimits(effect)?.max ?? 0
    return getEffectSelectionCandidates(state, context, effect)
      .slice(0, max)
      .map((card) => card.instanceId)
  }

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
    return getTrashCookieCandidates(state, context, effect)
      .slice(0, effect.amount)
      .map((card) => card.instanceId)
  }

  if (effect.kind === 'trash-to-support') {
    return getTrashToSupportCandidates(state, context)
      .slice(0, effect.amount)
      .map((card) => card.instanceId)
  }

  if (effect.kind === 'hand-to-support') {
    const player = state.players[context.sourcePlayerId]
    return player.hand
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

  if (effect.kind === 'trash-to-break') {
    const candidates = getTrashToBreakCandidates(state, context, effect)
    if (candidates.length < effect.amount) return []
    return candidates
      .slice(0, effect.amount)
      .map((card) => card.instanceId)
  }

  if (effect.kind === 'trash-to-deck') {
    return getTrashToDeckCandidates(state, context, effect)
      .slice(0, effect.max)
      .map((card) => card.instanceId)
  }

  if (
    effect.kind === 'inspect-deck' ||
    effect.kind === 'optional-cost-attack' ||
    effect.kind === 'disable-block' ||
    effect.kind === 'trash-to-hand' ||
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

  if (effect.kind === 'split-damage') {
    const maxTargets = effect.target.max ?? 1
    const configs: CookieInBattle[][] = []
    for (let i = 0; i < candidates.length; i++) {
      configs.push([candidates[i]])
      if (maxTargets >= 2) {
        for (let j = i + 1; j < candidates.length; j++) {
          configs.push([candidates[i], candidates[j]])
          configs.push([candidates[j], candidates[i]])
        }
      }
    }
    configs.sort((a, b) => {
      const faints = (cfg: CookieInBattle[]): number => {
        let count = 0
        for (let k = 0; k < cfg.length; k++) {
          const dmg = k === 0 ? effect.primaryAmount : effect.secondaryAmount
          if (cfg[k].hpCards.length <= dmg) count++
        }
        return count
      }
      const aFaints = faints(a)
      const bFaints = faints(b)
      if (aFaints !== bFaints) return bFaints - aFaints
      const remaining = (cfg: CookieInBattle[]): number =>
        cfg.reduce(
          (sum, c, k) =>
            sum + Math.max(0, c.hpCards.length - (k === 0 ? effect.primaryAmount : effect.secondaryAmount)),
          0,
        )
      return remaining(a) - remaining(b)
    })
    return configs[0].map((c) => c.card.instanceId)
  } else if (effect.kind === 'hp-to-trash') {
    const targetSide = effect.target.side
    if (targetSide === 'self') {
      ordered.sort(
        (left, right) => right.hpCards.length - left.hpCards.length,
      )
    } else {
      ordered.sort((left, right) => {
        const leftFaintable = left.hpCards.length <= effect.amount ? 0 : 1
        const rightFaintable = right.hpCards.length <= effect.amount ? 0 : 1
        if (leftFaintable !== rightFaintable) return leftFaintable - rightFaintable
        return left.hpCards.length - right.hpCards.length
      })
    }
  } else if (effect.kind === 'hp-to-support') {
    ordered.sort(
      (left, right) => right.hpCards.length - left.hpCards.length,
    )
  } else if (effect.kind === 'disable-flip') {
    ordered.sort(
      (left, right) => right.card.level - left.card.level,
    )
  } else if (effect.kind === 'disable-attack') {
    ordered.sort(
      (left, right) =>
        getEffectiveAttack(state, right.card.instanceId) -
        getEffectiveAttack(state, left.card.instanceId),
    )
  } else if (effect.kind === 'battle-to-support') {
    ordered.sort(
      (left, right) => left.hpCards.length - right.hpCards.length,
    )
  } else if (effect.kind === 'prevent-effect-damage') {
    const sourceOnly = ordered.filter(
      (c) => c.card.instanceId === context.sourceInstanceId,
    )
    if (sourceOnly.length === 0) return []
    return sourceOnly.map((c) => c.card.instanceId)
  } else if (effect.kind === 'damage') {
    ordered.sort((left, right) => {
      const leftLethal = left.hpCards.length <= effect.amount ? 0 : 1
      const rightLethal = right.hpCards.length <= effect.amount ? 0 : 1
      return (
        leftLethal - rightLethal ||
        left.hpCards.length - right.hpCards.length
      )
    })
  } else if (effect.kind === 'make-faint') {
    // 昏厥目標（BS5-036 Milk Cookie）：優先挑 HP 最少的，直接送進休息區。
    ordered.sort((left, right) => left.hpCards.length - right.hpCards.length)
  } else if (effect.kind === 'transfer-hp') {
    if (effect.direction === 'to-source') {
      // 供牌方是被選中的我方餅乾，抽乾它等於送對手 break 進度，只挑撐得住的。
      const survivors = ordered.filter(
        (cookie) => cookie.hpCards.length > effect.amount,
      )
      if (survivors.length === 0) return []
      survivors.sort((left, right) => right.hpCards.length - left.hpCards.length)
      return survivors
        .slice(0, Math.min(effect.target.max, survivors.length))
        .map((cookie) => cookie.card.instanceId)
    }
    // from-source：供牌方是來源自己，HP 不夠就別搬，否則來源直接昏厥。
    const source = state.players[context.sourcePlayerId].battleArea.find(
      (cookie) => cookie.card.instanceId === context.sourceInstanceId,
    )
    if (!source || source.hpCards.length <= effect.amount) return []
    ordered.sort((left, right) => left.hpCards.length - right.hpCards.length)
  } else if (
    (effect.kind === 'battle-to-break' ||
      effect.kind === 'battle-to-deck-top') &&
    effect.target.side === 'either'
  ) {
    // 兩者都是把餅乾趕出戰鬥區，只值得對對手用；沒有對手目標時寧可不選。
    const opponentId =
      context.sourcePlayerId === 'player-one' ? 'player-two' : 'player-one'
    const opponentCandidates = ordered.filter(
      (cookie) => getCookieOwnerId(state, cookie.card.instanceId) === opponentId,
    )
    if (opponentCandidates.length === 0) return []
    opponentCandidates.sort(
      (left, right) => right.hpCards.length - left.hpCards.length,
    )
    return opponentCandidates
      .slice(0, Math.min(effect.target.max, opponentCandidates.length))
      .map((cookie) => cookie.card.instanceId)
  } else if (effect.kind === 'set-cookie-active') {
    ordered.sort(
      (left, right) =>
        getEffectiveAttack(state, right.card.instanceId) -
        getEffectiveAttack(state, left.card.instanceId),
    )
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

  const trashBattleCookieIds = cost.trashBattleCookie
    ? getTrashBattleCookieCostCandidates(cost, player.battleArea, sourceInstanceId)
        .slice(0, cost.trashBattleCookie.count)
        .map((cookie) => cookie.card.instanceId)
    : []
  if (
    cost.trashBattleCookie &&
    trashBattleCookieIds.length < cost.trashBattleCookie.count
  ) {
    return null
  }

  const trashToDeckBottomIds = cost.trashToDeckBottom
    ? getTrashToDeckBottomCostCandidates(cost, player.discardPile)
        .slice(0, cost.trashToDeckBottom.count)
        .map((card) => card.instanceId)
    : []
  if (
    cost.trashToDeckBottom &&
    trashToDeckBottomIds.length < cost.trashToDeckBottom.count
  ) {
    return null
  }

  const trashToDeckIds = cost.trashToDeck
    ? getTrashToDeckCostCandidates(cost, player.discardPile)
        .slice(0, cost.trashToDeck.count)
        .map((card) => card.instanceId)
    : []
  if (
    cost.trashToDeck &&
    trashToDeckIds.length < cost.trashToDeck.count
  ) {
    return null
  }

  return {
    paymentIds,
    supportToTrashIds,
    supportToHandIds,
    discardHandIds,
    hpToTrashTargetIds,
    trashBattleCookieIds,
    trashToDeckBottomIds,
    trashToDeckIds,
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
  shuffleSeed?: number,
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
      const attackCost = getAttackEnergyCostForState(state, cookie.card.instanceId)
      return selectEnergyPayment(attackCost, remainingSupportsAfterItem)
    })
    if (!canAttackAfterItem) return null
  }

  const played = playItem(
    state,
    playerId,
    card.instanceId,
    costIds.paymentIds,
    costIds.supportToTrashIds,
    costIds.supportToHandIds,
    costIds.discardHandIds,
    costIds.hpToTrashTargetIds,
    costIds.trashBattleCookieIds,
  )
  const effectShuffleSeed = shuffleSeed ?? [...card.instanceId].reduce(
    (seed, character) => Math.imul(seed ^ character.charCodeAt(0), 16777619),
    state.turnNumber,
  )
  const shuffle = createSeededShuffle(effectShuffleSeed)
  const sim = simulateAbilityEffects(
    played,
    context,
    ability.effects,
    chooseEffectTargets,
    isItemEffectTargetCountSufficient,
    { sourceInstanceId: card.instanceId, paymentIds: costIds.paymentIds },
    shuffle,
  )
  if (sim.aborted) return null

  return {
    state: applyGameCommand(
      state,
      {
        kind: 'play-item',
        playerId,
        instanceId: card.instanceId,
        paymentIds: costIds.paymentIds,
        supportToTrashIds: costIds.supportToTrashIds,
        supportToHandIds: costIds.supportToHandIds,
        discardHandIds: costIds.discardHandIds,
        hpToTrashTargetIds: costIds.hpToTrashTargetIds,
        trashBattleCookieIds: costIds.trashBattleCookieIds,
        effectTargets: sim.effectTargets,
        chooseOneModes: sim.chooseOneModes,
      },
      { shuffleSeed: effectShuffleSeed },
    ),
    action: 'play-item',
    description: `${state.players[playerId].name}使用${card.name}。`,
    revealedCard: card,
    effectSelections: sim.effectSelections,
  }
}

const isItemEffectTargetCountSufficient = (
  effect: CardEffect,
  targetIds: string[],
): boolean => {
  if (
    effect.kind === 'hand-to-break' ||
    effect.kind === 'break-to-hand' ||
    effect.kind === 'hand-to-hp' ||
    effect.kind === 'rest-support' ||
    effect.kind === 'support-to-hp' ||
    (effect.kind === 'set-active' && effect.selectable)
  ) {
    return targetIds.length >= (getEffectSelectionLimits(effect)?.min ?? 0)
  }
  if (
    (effect.kind === 'support-to-trash' ||
      effect.kind === 'support-to-hand' ||
      effect.kind === 'hand-to-support' ||
      effect.kind === 'trash-to-battle' ||
      effect.kind === 'trash-to-support' ||
      effect.kind === 'trash-to-break') &&
    targetIds.length < effect.amount
  ) {
    return false
  }
  if (
    !isEffectUntargeted(effect) &&
    effect.kind !== 'break-to-trash' &&
    effect.kind !== 'support-to-trash' &&
    effect.kind !== 'support-to-hand' &&
    effect.kind !== 'hand-to-support' &&
    effect.kind !== 'trash-to-battle' &&
    effect.kind !== 'trash-to-support' &&
    effect.kind !== 'trash-to-break' &&
    effect.kind !== 'inspect-deck' &&
    effect.kind !== 'optional-cost-attack' &&
    effect.kind !== 'disable-block' &&
    effect.kind !== 'trash-to-hand' &&
    effect.kind !== 'trash-to-deck' &&
    effect.kind !== 'flip-to-support' &&
    effect.kind !== 'hand-to-battle' &&
    effect.kind !== 'opponent-trash-to-break' &&
    effect.kind !== 'opponent-battle-to-trash' &&
    'target' in effect &&
    effect.target &&
    targetIds.length < effect.target.min
  ) {
    return false
  }
  return true
}

const resolveAiSkill = (
  state: GameState,
  playerId: PlayerId,
  source: CookieInBattle,
  trigger: 'activate' | 'on-play',
  shuffleSeed?: number,
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

  // cycle-hp（BS4-030）：整個效果依賴「我方其他黃色餅乾」，沒有合法目標時
  // 發動只會白付代價，直接視為不可發動（與 UI 的發動權詢問門檻一致）。
  if (
    skill.effects.some(
      (effect) =>
        effect.kind === 'cycle-hp' &&
        getEffectTargetCandidates(state, {
          sourcePlayerId: playerId,
          sourceInstanceId: source.card.instanceId,
        }, effect.target).length === 0,
    )
  ) {
    return null
  }

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

  const hpToTrashTargetIds = skill.cost.hpToTrash
    ? player.battleArea
        .filter((cookie) =>
          skill.cost.hpToTrash?.untilRemainingHp === undefined
            ? cookie.hpCards.length > 0
            : cookie.hpCards.length > skill.cost.hpToTrash.untilRemainingHp,
        )
        .slice(0, 1)
        .map((cookie) => cookie.card.instanceId)
    : []
  if (skill.cost.hpToTrash && hpToTrashTargetIds.length === 0) {
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
      const attackCost = getAttackEnergyCostForState(state, cookie.card.instanceId)
      return selectEnergyPayment(attackCost, remainingSupportAfterSkillCost)
    })
    if (!canStillAttackAfterSkill) {
      return null
    }
  }

  const trashToDeckBottomIds = skill.cost.trashToDeckBottom
    ? getTrashToDeckBottomCostCandidates(skill.cost, player.discardPile)
        .slice(0, skill.cost.trashToDeckBottom.count)
        .map((card) => card.instanceId)
    : []
  if (
    skill.cost.trashToDeckBottom &&
    trashToDeckBottomIds.length < skill.cost.trashToDeckBottom.count
  ) {
    return null
  }

  const trashToDeckIds = skill.cost.trashToDeck
    ? getTrashToDeckCostCandidates(skill.cost, player.discardPile)
        .slice(0, skill.cost.trashToDeck.count)
        .map((card) => card.instanceId)
    : []
  if (
    skill.cost.trashToDeck &&
    trashToDeckIds.length < skill.cost.trashToDeck.count
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

  const effectShuffleSeed = shuffleSeed ?? state.turnNumber
  const effectShuffle = createSeededShuffle(effectShuffleSeed)
  const activated = activateCookieSkill(
    state,
    playerId,
    source.card.instanceId,
    trigger,
    paymentIds,
    costSupportToTrashIds,
    discardHandIds,
    trashBattleCookieIds,
    trashToDeckBottomIds,
    trashToDeckIds,
    effectShuffle,
    hpToTrashTargetIds,
  )
  const sim = simulateAbilityEffects(
    activated,
    context,
    skill.effects,
    chooseEffectTargets,
    isSkillEffectTargetCountSufficient,
    { sourceInstanceId: source.card.instanceId, paymentIds },
    effectShuffle,
  )
  if (sim.aborted) return null

  return {
    state: applyGameCommand(
      state,
      {
        kind: 'activate-skill',
        playerId,
        sourceInstanceId: source.card.instanceId,
        trigger,
        paymentIds,
        costSupportToTrashIds,
        discardHandIds,
        hpToTrashTargetIds,
        trashBattleCookieIds,
        trashToDeckBottomIds,
        trashToDeckIds,
        effectTargets: sim.effectTargets,
        chooseOneModes: sim.chooseOneModes,
      },
      { shuffleSeed: effectShuffleSeed },
    ),
    action: 'activate-skill',
    description: `${state.players[playerId].name}發動${source.card.name}的技能。`,
    effectSelections: sim.effectSelections,
  }
}

const isSkillEffectTargetCountSufficient = (
  effect: CardEffect,
  targetIds: string[],
): boolean => {
  if (
    effect.kind === 'hand-to-break' ||
    effect.kind === 'break-to-hand' ||
    effect.kind === 'hand-to-hp' ||
    effect.kind === 'rest-support' ||
    effect.kind === 'support-to-hp' ||
    (effect.kind === 'set-active' && effect.selectable)
  ) {
    return targetIds.length >= (getEffectSelectionLimits(effect)?.min ?? 0)
  }
  if (effect.kind === 'gain-hp' && effect.target && !effect.target.sourceOnly) {
    return targetIds.length >= effect.target.min
  }
  if (effect.kind === 'opponent-battle-to-trash') {
    return true
  }
  if (isEffectUntargeted(effect)) {
    return true
  }
  if (
    (effect.kind === 'support-to-trash' ||
      effect.kind === 'support-to-hand' ||
      effect.kind === 'hand-to-support' ||
      effect.kind === 'trash-to-battle' ||
      effect.kind === 'trash-to-support' ||
      effect.kind === 'trash-to-break') &&
    targetIds.length < effect.amount
  ) {
    return false
  }
  if (
    effect.kind !== 'break-to-trash' &&
    effect.kind !== 'support-to-trash' &&
    effect.kind !== 'support-to-hand' &&
    effect.kind !== 'hand-to-support' &&
    effect.kind !== 'trash-to-battle' &&
    effect.kind !== 'trash-to-support' &&
    effect.kind !== 'trash-to-break' &&
    effect.kind !== 'inspect-deck' &&
    effect.kind !== 'optional-cost-attack' &&
    effect.kind !== 'field-to-trash' &&
    effect.kind !== 'disable-block' &&
    effect.kind !== 'trash-to-hand' &&
    effect.kind !== 'trash-to-deck' &&
    effect.kind !== 'flip-to-support' &&
    effect.kind !== 'hand-to-battle' &&
    effect.kind !== 'opponent-trash-to-break' &&
    'target' in effect &&
    effect.target &&
    targetIds.length < effect.target.min
  ) {
    return false
  }
  return true
}

const chooseReplacement = (state: GameState, playerId: PlayerId, level?: number) => {
  const candidates = getReplacementCandidates(state, playerId)
  if (candidates.length === 0) return undefined

  const profile = getMatchupProfile(state, playerId)
  const breakPressure = evaluateBreakPressure(
    state.players[playerId].breakArea,
  )

  const useR6b = level !== undefined && isRuleEnabled(level as 1 | 2 | 3 | 4, 'R6b')

  if (useR6b) {
    const opponentId = playerId === 'player-one' ? 'player-two' : 'player-one'
    const myBreakLevel = sumBreakLevel(state.players[playerId].breakArea)
    const oppBreakLevel = sumBreakLevel(state.players[opponentId].breakArea)
    const myBattleAreaCount = state.players[playerId].battleArea.length
    const myTotalBattleHp = state.players[playerId].battleArea.reduce(
      (sum, c) => sum + c.hpCards.length, 0,
    )
    const oppTotalBattleHp = state.players[opponentId].battleArea.reduce(
      (sum, c) => sum + c.hpCards.length, 0,
    )

    return candidates
      .filter((c) => c.type === 'cookie')
      .sort((left, right) => {
        const leftScore = scoreReplacementAdvanced(left, profile, breakPressure, {
          myBreakLevel, oppBreakLevel, myBattleAreaCount, myTotalBattleHp, oppTotalBattleHp,
        })
        const rightScore = scoreReplacementAdvanced(right, profile, breakPressure, {
          myBreakLevel, oppBreakLevel, myBattleAreaCount, myTotalBattleHp, oppTotalBattleHp,
        })
        return rightScore - leftScore
      })[0]
  }

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
  const forcedTargetId = getForcedAttackTargetId(state, playerId)
  if (forcedTargetId) {
    return state.players[opponentId].battleArea.find(
      (cookie) => cookie.card.instanceId === forcedTargetId,
    )
  }
  const profile = getMatchupProfile(state, playerId)

  return [...state.players[opponentId].battleArea].sort((left, right) => {
    const leftScore = scoreAttackTarget(left, profile, state, playerId)
    const rightScore = scoreAttackTarget(right, profile, state, playerId)
    return rightScore - leftScore
  })[0]
}

const aiTurnStrategy: AiTurnStrategy = {
  chooseEffectTargets,
  resolveCardAbility: (state, playerId, card) =>
    resolveAiCardAbility(state, playerId, card, aiTurnStrategy.shuffleSeed),
  resolveSkill: (state, playerId, source, trigger) =>
    resolveAiSkill(state, playerId, source, trigger, aiTurnStrategy.shuffleSeed),
  chooseReplacement,
  chooseAttackTarget,
}

const createStepRandom = (
  seed: number,
  state: GameState,
): (() => number) => {
  const entropy =
    (state.turnNumber * 97) ^
    (state.players['player-one'].hand.length * 13) ^
    (state.players['player-two'].hand.length * 31) ^
    (state.players['player-one'].deck.length * 7) ^
    (state.players['player-two'].deck.length * 3)
  return createSeededRandom((seed ^ entropy) >>> 0)
}

const createStepShuffleSeed = (
  seed: number,
  state: GameState,
  playerId: PlayerId,
): number => {
  const entropy =
    (state.turnNumber * 97) ^
    (state.players['player-one'].hand.length * 13) ^
    (state.players['player-two'].hand.length * 31) ^
    (state.players['player-one'].deck.length * 7) ^
    (state.players['player-two'].deck.length * 3) ^
    (playerId === 'player-one' ? 0x13579bdf : 0x2468ace0)
  return (seed ^ entropy) >>> 0
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

    const shuffleSeed = createStepShuffleSeed(options.seed ?? 1, state, playerId)
    aiTurnStrategy.shuffleSeed = shuffleSeed

    const turnHandler =
      level === 1
        ? (current: GameState, currentPlayerId: PlayerId) =>
            handleAiRandomTurnState(
              current,
              currentPlayerId,
              createStepRandom(options.seed ?? 1, current),
              shuffleSeed,
            )
        : level === 3
          ? (current: GameState, currentPlayerId: PlayerId) => {
              aiTurnStrategy.currentLevel = level
              return handleAiEvaluatedTurnState(current, currentPlayerId, aiTurnStrategy)
            }
          : level === 4
            ? (current: GameState, currentPlayerId: PlayerId) => {
                aiTurnStrategy.currentLevel = level
                return handleAiTwoPlyTurnState(current, currentPlayerId, aiTurnStrategy)
              }
            : (current: GameState, currentPlayerId: PlayerId) => {
                aiTurnStrategy.currentLevel = level
                return handleAiTurnState(current, currentPlayerId, aiTurnStrategy)
              }

    const decision =
      dispatchAiStep(state, playerId, [
        handleAiPendingDecision,
        (s, p) => handleAiPendingBattle(s, p, level),
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
