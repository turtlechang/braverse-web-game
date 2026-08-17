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
  requiresEffectCardSelection,
} from './effects'
import { getAttackEnergyCostForState, selectEnergyPayment } from './energy'
import { getRefreshCandidates } from './refresh'
import { getReplacementCandidates } from './replacement'
import {
  activateCookieSkill,
  canActivateCookieSkill,
  getDiscardAllHandCostCandidates,
  getDiscardHandCostCandidates,
  getBattleCookieToHandCostCandidates,
  getHpToTrashCostCandidates,
  getTrashBattleCookieCostCandidates,
  getTrashToDeckCostCandidates,
  getTrashToDeckBottomCostCandidates,
} from './skills'
import { simulateAbilityEffects } from './ai/ability-effects'
import { chooseAiEffectMode } from './ai/choose-one-mode'
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
import { createPlayerView } from './player-view'
import {
  createKnowledgeStateFromPlayerView,
  synchronizeKnowledgeWithPlayerView,
} from './ai/strategy/knowledge-state'
import type { KnowledgeState } from './ai/strategy/knowledge-state'
import {
  createPendingSelectionStrategy,
  type PendingSelectionStrategy,
  type PendingSelectionKind,
} from './ai/strategy/pending-selection'
import { handleAiRandomTurnState } from './ai/random-turn-handler'
import { handleAiEvaluatedTurnState, handleAiTwoPlyTurnState } from './ai/evaluated-turn-handler'
import {
  handleAiTurnState,
  chooseAiStageCostIds,
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
  if (effect.kind === 'opponent-break-to-trash-then-battle-to-break') {
    return getEffectSelectionCandidates(state, context, effect)
      .slice(0, 1)
      .map((card) => card.instanceId)
  }

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
      .filter((card) => card.instanceId !== context.sourceInstanceId)
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

  // Sequential damage-all is still an explicit target-order decision even
  // though the non-sequential form is untargeted. Composite effects such as
  // BS3-113 carry the same decision on the nested `thenEffects` branch. The
  // rules layer validates that every currently legal target appears exactly
  // once, so the AI must pass the complete deterministic ordering rather than
  // the empty target list used by ordinary untargeted effects.
  const sequentialDamage =
    effect.kind === 'damage-all' && effect.sequential
      ? effect
      : effect.kind === 'trash-to-deck-all'
        ? effect.thenEffects?.find(
            (thenEffect): thenEffect is Extract<CardEffect, { kind: 'damage-all' }> =>
              thenEffect.kind === 'damage-all' && thenEffect.sequential === true,
          )
        : undefined
  if (sequentialDamage?.target) {
    const candidates = getEffectTargetCandidates(
      state,
      context,
      sequentialDamage.target,
    ).filter(
      (cookie) =>
        !sequentialDamage.excludeSource ||
        cookie.card.instanceId !== context.sourceInstanceId,
    )
    return candidates.map((cookie) => cookie.card.instanceId)
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

  if (!('target' in effect) || !effect.target) return []

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

  if (!('target' in effect) || !effect.target) return []

  const count = Math.min(effect.target.max, ordered.length)
  if (count < effect.target.min) {
    return []
  }

  return ordered
    .slice(0, count)
    .map((cookie) => cookie.card.instanceId)
}

// Universal Lv.3/Lv.4 selection delegates unsupported or multi-group effects
// to the long-standing effect-specific selector above. Keep the fallback
// explicit so the descriptor-aware path never calls an undefined symbol.
const legacyChooseEffectTargets = chooseEffectTargets

const chooseAbilityCostIds = (
  state: GameState,
  playerId: PlayerId,
  cost: AbilityCost,
  sourceInstanceId: string,
  effects: CardEffect[] = [],
  universal?: PendingSelectionStrategy,
) => {
  const player = state.players[playerId]
  const orderedSupportCards = universal?.enabled
    ? universal.orderPaymentIds(
        player.supportArea.map((support) => support.card.instanceId),
      ).map((instanceId) =>
        player.supportArea.find(
          (support) => support.card.instanceId === instanceId,
        )!,
      )
    : player.supportArea
  const paymentIds = selectEnergyPayment(
    cost.energy ?? cost,
    orderedSupportCards,
  )
  if (!paymentIds) return null

  const paymentSet = new Set(paymentIds)
  const remainingSupports = player.supportArea.filter(
    (support) => !paymentSet.has(support.card.instanceId),
  )
  const supportToTrashCandidateIds = remainingSupports.map(
    (support) => support.card.instanceId,
  )
  const supportToTrashIds = universal?.enabled
    ? universal.orderCostIds(
        supportToTrashCandidateIds,
        cost.supportToTrash ?? 0,
      )
    : supportToTrashCandidateIds.slice(0, cost.supportToTrash ?? 0)
  if (supportToTrashIds.length < (cost.supportToTrash ?? 0)) return null

  const supportToTrashSet = new Set(supportToTrashIds)
  const supportToHandCandidateIds = remainingSupports
    .filter((support) => !supportToTrashSet.has(support.card.instanceId))
    .map((support) => support.card.instanceId)
  const supportToHandIds = universal?.enabled
    ? universal.orderCostIds(
        supportToHandCandidateIds,
        cost.supportToHand ?? 0,
      )
    : supportToHandCandidateIds.slice(0, cost.supportToHand ?? 0)
  if (supportToHandIds.length < (cost.supportToHand ?? 0)) return null

  const discardCandidates = player.hand.filter(
    (card) =>
      card.instanceId !== sourceInstanceId &&
      (!cost.discardHandColor || card.energyColor === cost.discardHandColor),
  )
  const handLimit = effects
    .map((effect) => ('condition' in effect ? effect.condition : undefined))
    .find((condition) => condition?.kind === 'hand-count-at-most')
  const discardCount =
    cost.discardHandAtLeast && handLimit?.kind === 'hand-count-at-most'
      ? Math.max(
          cost.discardHand ?? 0,
          player.hand.length - 1 - handLimit.count,
        )
      : cost.discardHand ?? 0
  const discardHandIds = universal?.enabled
    ? universal.orderCostIds(
        discardCandidates.map((card) => card.instanceId),
        discardCount,
      )
    : discardCandidates.slice(0, discardCount).map((card) => card.instanceId)
  if (discardHandIds.length < discardCount) return null

  const hpToTrashCandidateIds = cost.hpToTrash
    ? getHpToTrashCostCandidates(cost, player.battleArea, sourceInstanceId)
        .map((cookie) => cookie.card.instanceId)
    : []
  const hpToTrashTargetIds = cost.hpToTrash
    ? universal?.enabled
      ? universal.orderCostIds(hpToTrashCandidateIds, 1)
      : hpToTrashCandidateIds.slice(0, 1)
    : []
  if (cost.hpToTrash && hpToTrashTargetIds.length === 0) return null

  const trashBattleCookieCandidateIds = cost.trashBattleCookie
    ? getTrashBattleCookieCostCandidates(cost, player.battleArea, sourceInstanceId)
        .map((cookie) => cookie.card.instanceId)
    : []
  const trashBattleCookieIds = cost.trashBattleCookie
    ? universal?.enabled
      ? universal.orderCostIds(
          trashBattleCookieCandidateIds,
          cost.trashBattleCookie.count,
        )
      : trashBattleCookieCandidateIds.slice(0, cost.trashBattleCookie.count)
    : []
  if (
    cost.trashBattleCookie &&
    trashBattleCookieIds.length < cost.trashBattleCookie.count
  ) {
    return null
  }

  const trashToDeckBottomCandidateIds = cost.trashToDeckBottom
    ? getTrashToDeckBottomCostCandidates(cost, player.discardPile)
        .map((card) => card.instanceId)
    : []
  const trashToDeckBottomIds = cost.trashToDeckBottom
    ? universal?.enabled
      ? universal.orderCostIds(
          trashToDeckBottomCandidateIds,
          cost.trashToDeckBottom.count,
        )
      : trashToDeckBottomCandidateIds.slice(0, cost.trashToDeckBottom.count)
    : []
  if (
    cost.trashToDeckBottom &&
    trashToDeckBottomIds.length < cost.trashToDeckBottom.count
  ) {
    return null
  }

  const trashToDeckCandidateIds = cost.trashToDeck
    ? getTrashToDeckCostCandidates(cost, player.discardPile)
        .map((card) => card.instanceId)
    : []
  const trashToDeckIds = cost.trashToDeck
    ? universal?.enabled
      ? universal.orderCostIds(
          trashToDeckCandidateIds,
          cost.trashToDeck.count,
        )
      : trashToDeckCandidateIds.slice(0, cost.trashToDeck.count)
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
  const universal = createUniversalPendingStrategy(
    state,
    playerId,
    aiTurnStrategy.currentLevel,
    aiTurnStrategy.knowledgeState,
  )
  const costIds = chooseAbilityCostIds(
    state,
    playerId,
    ability.cost,
    card.instanceId,
    ability.effects,
    universal ?? undefined,
  )
  if (!costIds) return null

  const context = {
    sourcePlayerId: playerId,
    sourceInstanceId: card.instanceId,
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
  // Conditions such as BS6-084's hand limit are checked after the item and
  // its cost cards leave the hand, matching the real command path.
  const effects = ability.effects.filter((effect) =>
    isEffectConditionMet(played, context, effect),
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

  const effectShuffleSeed = shuffleSeed ?? [...card.instanceId].reduce(
    (seed, character) => Math.imul(seed ^ character.charCodeAt(0), 16777619),
    state.turnNumber,
  )
  const shuffle = createSeededShuffle(effectShuffleSeed)
  const sim = simulateAbilityEffects(
    played,
    context,
    ability.effects,
    universalChooseEffectTargets,
    isItemEffectTargetCountSufficient,
    { sourceInstanceId: card.instanceId, paymentIds: costIds.paymentIds },
    shuffle,
    universalChooseEffectMode,
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
    effect.kind === 'hand-to-support' ||
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
      effect.kind === 'trash-to-battle' ||
      effect.kind === 'trash-to-support' ||
      effect.kind === 'trash-to-break') &&
    targetIds.length <
      (effect.kind === 'trash-to-battle' && effect.optional
        ? 0
        : effect.amount)
  ) {
    return false
  }
  if (
    !isEffectUntargeted(effect) &&
    effect.kind !== 'break-to-trash' &&
    effect.kind !== 'support-to-trash' &&
    effect.kind !== 'support-to-hand' &&
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
  const universal = createUniversalPendingStrategy(
    state,
    playerId,
    aiTurnStrategy.currentLevel,
    aiTurnStrategy.knowledgeState,
  )
  const orderedSupportCards = universal?.enabled
    ? universal.orderPaymentIds(
        player.supportArea.map((support) => support.card.instanceId),
      ).map((instanceId) =>
        player.supportArea.find(
          (support) => support.card.instanceId === instanceId,
        )!,
      )
    : player.supportArea
  const paymentIds = selectEnergyPayment(
    skill.cost.energy ?? skill.cost,
    orderedSupportCards,
  )
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

  const remainingSupportsAfterPayment = player.supportArea.filter(
    (support) => !paymentIds.includes(support.card.instanceId),
  )
  const supportToTrashCandidateIds = remainingSupportsAfterPayment.map(
    (support) => support.card.instanceId,
  )
  const costSupportToTrashIds = skill.cost.supportToTrash
    ? universal?.enabled
      ? universal.orderCostIds(
          supportToTrashCandidateIds,
          skill.cost.supportToTrash,
        )
      : supportToTrashCandidateIds.slice(0, skill.cost.supportToTrash)
    : []

  if (
    skill.cost.supportToTrash &&
    costSupportToTrashIds.length < skill.cost.supportToTrash
  ) {
    return null
  }

  const costSupportToTrashSet = new Set(costSupportToTrashIds)
  const supportToHandCandidateIds = remainingSupportsAfterPayment
    .filter((support) => !costSupportToTrashSet.has(support.card.instanceId))
    .map((support) => support.card.instanceId)
  const costSupportToHandIds = skill.cost.supportToHand
    ? universal?.enabled
      ? universal.orderCostIds(
          supportToHandCandidateIds,
          skill.cost.supportToHand,
        )
      : supportToHandCandidateIds.slice(0, skill.cost.supportToHand)
    : []

  if (
    skill.cost.supportToHand &&
    costSupportToHandIds.length < skill.cost.supportToHand
  ) {
    return null
  }

  const discardHandCandidates = skill.cost.discardAllHand
    ? getDiscardAllHandCostCandidates(
        skill.cost,
        player.hand,
        source.card.instanceId,
      )
    : getDiscardHandCostCandidates(skill.cost, player.hand, source.card.instanceId)
  const discardHandCost = skill.cost.discardHand ?? 0
  const discardHandIds = skill.cost.discardAllHand
    ? discardHandCandidates.map((card) => card.instanceId)
    : discardHandCost > 0
      ? universal?.enabled
        ? universal.orderCostIds(
            discardHandCandidates.map((card) => card.instanceId),
            discardHandCost,
          )
        : discardHandCandidates
            .slice(0, discardHandCost)
            .map((card) => card.instanceId)
      : []

  if (
    (skill.cost.discardAllHand && discardHandCandidates.length === 0) ||
    (discardHandCost > 0 && discardHandIds.length < discardHandCost)
  ) {
    return null
  }

  const hpToTrashCandidateIds = skill.cost.hpToTrash
    ? getHpToTrashCostCandidates(
        skill.cost,
        player.battleArea,
        source.card.instanceId,
      ).map((cookie) => cookie.card.instanceId)
    : []
  const hpToTrashTargetIds = skill.cost.hpToTrash
    ? universal?.enabled
      ? universal.orderCostIds(hpToTrashCandidateIds, 1)
      : hpToTrashCandidateIds.slice(0, 1)
    : []
  if (skill.cost.hpToTrash && hpToTrashTargetIds.length === 0) {
    return null
  }

  const trashBattleCookieCandidateIds = skill.cost.trashBattleCookie
    ? player.battleArea
        .filter((cookie) => {
          if (skill.cost.trashBattleCookie!.level !== undefined && cookie.card.level !== skill.cost.trashBattleCookie!.level) return false
          if (skill.cost.trashBattleCookie!.energyColor !== undefined && cookie.card.energyColor !== skill.cost.trashBattleCookie!.energyColor) return false
          return true
        })
        .sort((left, right) => left.hpCards.length - right.hpCards.length)
        .map((cookie) => cookie.card.instanceId)
    : []
  const trashBattleCookieIds = skill.cost.trashBattleCookie
    ? universal?.enabled
      ? universal.orderCostIds(
          trashBattleCookieCandidateIds,
          skill.cost.trashBattleCookie.count,
        )
      : trashBattleCookieCandidateIds.slice(0, skill.cost.trashBattleCookie.count)
    : []

  if (
    skill.cost.trashBattleCookie &&
    trashBattleCookieIds.length < skill.cost.trashBattleCookie.count
  ) {
    return null
  }

  const battleToHandCandidateIds = skill.cost.battleCookieToHand
    ? getBattleCookieToHandCostCandidates(
        skill.cost,
        player.battleArea,
        source.card.instanceId,
      ).map((cookie) => cookie.card.instanceId)
    : []
  const battleToHandIds = skill.cost.battleCookieToHand
    ? universal?.enabled
      ? universal.orderCostIds(
          battleToHandCandidateIds,
          skill.cost.battleCookieToHand.count,
        )
      : battleToHandCandidateIds.slice(0, skill.cost.battleCookieToHand.count)
    : []

  if (
    skill.cost.battleCookieToHand &&
    battleToHandIds.length < skill.cost.battleCookieToHand.count
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

  const trashToDeckBottomCandidateIds = skill.cost.trashToDeckBottom
    ? getTrashToDeckBottomCostCandidates(skill.cost, player.discardPile)
        .map((card) => card.instanceId)
    : []
  const trashToDeckBottomIds = skill.cost.trashToDeckBottom
    ? universal?.enabled
      ? universal.orderCostIds(
          trashToDeckBottomCandidateIds,
          skill.cost.trashToDeckBottom.count,
        )
      : trashToDeckBottomCandidateIds.slice(0, skill.cost.trashToDeckBottom.count)
    : []
  if (
    skill.cost.trashToDeckBottom &&
    trashToDeckBottomIds.length < skill.cost.trashToDeckBottom.count
  ) {
    return null
  }

  const trashToDeckCandidateIds = skill.cost.trashToDeck
    ? getTrashToDeckCostCandidates(skill.cost, player.discardPile)
        .map((card) => card.instanceId)
    : []
  const trashToDeckIds = skill.cost.trashToDeck
    ? universal?.enabled
      ? universal.orderCostIds(
          trashToDeckCandidateIds,
          skill.cost.trashToDeck.count,
        )
      : trashToDeckCandidateIds.slice(0, skill.cost.trashToDeck.count)
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

  // BS3-019 / BS6-039 uses a special two-step effect. The command layer must
  // keep the selected break-cookie level between its mandatory first choice
  // and optional second choice, so it cannot be simulated as an ordinary
  // executeCardEffect call.
  const requiresPendingResolution = effects.some(
    (effect) => effect.kind === 'opponent-break-to-trash-then-battle-to-break',
  )

  if (requiresPendingResolution) {
    return {
      state: applyGameCommand(state, {
        kind: 'begin-activate-skill',
        playerId,
        sourceInstanceId: source.card.instanceId,
        trigger,
        paymentIds,
        costSupportToTrashIds,
        supportToHandIds: costSupportToHandIds,
        discardHandIds,
        hpToTrashTargetIds,
        trashBattleCookieIds,
        battleToHandIds,
        trashToDeckBottomIds,
        trashToDeckIds,
      }),
      action: 'activate-skill',
      description: `${state.players[playerId].name}發動${source.card.name}的技能。`,
    }
  }

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
    costSupportToHandIds,
    battleToHandIds,
  )
  const sim = simulateAbilityEffects(
    activated,
    context,
    skill.effects,
    universalChooseEffectTargets,
    isSkillEffectTargetCountSufficient,
    { sourceInstanceId: source.card.instanceId, paymentIds },
    effectShuffle,
    universalChooseEffectMode,
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
        supportToHandIds: costSupportToHandIds,
        discardHandIds,
        hpToTrashTargetIds,
        trashBattleCookieIds,
        battleToHandIds,
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
    effect.kind === 'hand-to-support' ||
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
      effect.kind === 'trash-to-battle' ||
      effect.kind === 'trash-to-support' ||
      effect.kind === 'trash-to-break') &&
    targetIds.length <
      (effect.kind === 'trash-to-battle' && effect.optional
        ? 0
        : effect.amount)
  ) {
    return false
  }
  if (
    effect.kind !== 'break-to-trash' &&
    effect.kind !== 'support-to-trash' &&
    effect.kind !== 'support-to-hand' &&
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

const createUniversalPendingStrategy = (
  state: GameState,
  playerId: PlayerId,
  level: AiLevel | undefined,
  knowledgeState: KnowledgeState | undefined,
) => {
  if (level !== 3 && level !== 4) return null

  const view = createPlayerView(state, playerId)
  const synchronizedKnowledge = knowledgeState?.observerId === playerId
    ? synchronizeKnowledgeWithPlayerView(knowledgeState, view)
    : createKnowledgeStateFromPlayerView(view)
  return createPendingSelectionStrategy(view, synchronizedKnowledge, level)
}

/**
 * Lv.3／Lv.4 的直接技能／物品模擬也必須使用和 pending 相同的候選排序器。
 * 這裡只把「單一候選集合、單一數量限制」的效果交給通用策略；多區域／多階段
 * 效果仍交回既有 effect-specific fallback，避免把一組 instance id 套到不同
 * selector 而製造非法 command。最終合法性仍由 `applyGameCommand` 驗證。
 */
const universalChooseEffectTargets = (
  state: GameState,
  context: EffectContext,
  effect: CardEffect,
): string[] => {
  const universal = createUniversalPendingStrategy(
    state,
    context.sourcePlayerId,
    aiTurnStrategy.currentLevel,
    aiTurnStrategy.knowledgeState,
  )
  if (!universal?.enabled) {
    return legacyChooseEffectTargets(state, context, effect)
  }

  // These effects have multiple independent target groups or a special
  // command-level continuation. Keep their existing legal fallback until the
  // command contract can carry one target list per group.
  if (
    effect.kind === 'rest-support-and-damage' ||
    (effect.kind === 'support-to-hp' && effect.selectTarget) ||
    effect.kind === 'field-to-trash' ||
    effect.kind === 'field-to-deck-bottom' ||
    effect.kind === 'split-damage' ||
    effect.kind === 'opponent-break-to-trash-then-battle-to-break'
  ) {
    return legacyChooseEffectTargets(state, context, effect)
  }

  if (!requiresEffectCardSelection(effect)) {
    return legacyChooseEffectTargets(state, context, effect)
  }

  const limits = getEffectSelectionLimits(effect)
  if (!limits) return legacyChooseEffectTargets(state, context, effect)

  const candidateIds = getEffectSelectionCandidates(state, context, effect)
    .map((card) => card.instanceId)
  const max = Math.min(limits.max, candidateIds.length)
  const selected = universal.selectEffectTargetIds(effect, candidateIds, max)
  return selected.length >= limits.min
    ? selected
    : legacyChooseEffectTargets(state, context, effect)
}

const universalChooseEffectMode = (
  state: GameState,
  context: EffectContext,
  effect: Extract<CardEffect, { kind: 'choose-one' }>,
): number => {
  const universal = createUniversalPendingStrategy(
    state,
    context.sourcePlayerId,
    aiTurnStrategy.currentLevel,
    aiTurnStrategy.knowledgeState,
  )
  return chooseAiEffectMode(
    state,
    context,
    effect,
    universal?.enabled
      ? universal.preferredModeIndices(effect, context.sourceInstanceId)
      : [],
  )
}

const chooseReplacement = (state: GameState, playerId: PlayerId, level?: AiLevel) => {
  const candidates = getReplacementCandidates(state, playerId)
  if (candidates.length === 0) return undefined

  const pendingStrategy = createUniversalPendingStrategy(
    state,
    playerId,
    level,
    aiTurnStrategy.knowledgeState,
  )
  if (pendingStrategy?.enabled) {
    const selectedId = pendingStrategy.chooseReplacementId(
      candidates.map((candidate) => candidate.instanceId),
    )
    return candidates.find((candidate) => candidate.instanceId === selectedId)
  }

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

const chooseRefresh = (
  state: GameState,
  playerId: PlayerId,
  level?: AiLevel,
) => {
  const candidates = getRefreshCandidates(state, playerId)
  if (candidates.length === 0) return undefined

  const pendingStrategy = createUniversalPendingStrategy(
    state,
    playerId,
    level,
    aiTurnStrategy.knowledgeState,
  )
  if (pendingStrategy?.enabled) {
    const selectedId = pendingStrategy.chooseRefreshId(
      candidates.map((candidate) => candidate.instanceId),
    )
    return candidates.find((candidate) => candidate.instanceId === selectedId)
  }

  return candidates[0]
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
  chooseEffectTargets: universalChooseEffectTargets,
  chooseEffectMode: universalChooseEffectMode,
  chooseStageCostIds: (state, playerId, cost, sourceInstanceId) =>
    chooseAiStageCostIds(
      state,
      playerId,
      cost,
      sourceInstanceId,
      createUniversalPendingStrategy(
        state,
        playerId,
        aiTurnStrategy.currentLevel,
        aiTurnStrategy.knowledgeState,
      ) ?? undefined,
    ),
  resolveCardAbility: (state, playerId, card) =>
    resolveAiCardAbility(state, playerId, card, aiTurnStrategy.shuffleSeed),
  resolveSkill: (state, playerId, source, trigger) =>
    resolveAiSkill(state, playerId, source, trigger, aiTurnStrategy.shuffleSeed),
  chooseReplacement,
  chooseRefresh,
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

const pendingSelectionForState = (
  state: GameState,
  playerId: PlayerId,
  decision: AiDecision,
): { kind: PendingSelectionKind; sourceInstanceId?: string } | null => {
  if (state.pendingRefresh?.playerId === playerId) return { kind: 'refresh' }
  if (state.pendingReplacement?.tasks[0]?.playerId === playerId) {
    return { kind: 'replacement' }
  }
  if (state.pendingBattle) {
    if (state.pendingBattle.stage === 'flip') {
      return {
        kind: 'flip',
        sourceInstanceId: state.pendingBattle.revealedHpCard?.instanceId,
      }
    }
    if (state.pendingBattle.stage === 'trap') {
      return {
        kind: decision.action === 'play-blocker'
          ? 'blocker'
          : decision.action === 'play-attack-response'
            ? 'attack-response'
            : 'trap',
        // 防守卡已由 battle handler 放在 revealedCard；沒有實際出牌時才退回
        // 攻擊者，讓 telemetry 的能力／unsupported 統計對應真正決策來源。
        sourceInstanceId: decision.revealedCard?.instanceId ??
          state.pendingBattle.attackerInstanceId,
      }
    }
    if (state.pendingBattle.stage === 'attack-effect') {
      return {
        kind: 'effect-target',
        sourceInstanceId: state.pendingBattle.attackerInstanceId,
      }
    }
  }
  const pendingAbility = state.pendingAbilityEffect
  if (pendingAbility?.playerId === playerId) {
    return {
      kind: pendingAbility.effects[pendingAbility.effectIndex]?.kind === 'choose-one'
        ? 'choose-one'
        : 'effect-target',
      sourceInstanceId: pendingAbility.sourceInstanceId,
    }
  }
  if (state.pendingOptionalCostAttack?.playerId === playerId) {
    return {
      kind: 'payment',
      sourceInstanceId: state.pendingOptionalCostAttack.sourceInstanceId,
    }
  }
  if (state.pendingOpponentHandDiscard?.playerId === playerId) {
    return {
      kind: 'discard',
      sourceInstanceId: state.pendingOpponentHandDiscard.sourceInstanceId,
    }
  }
  if (state.pendingEffectOrder?.playerId === playerId) {
    return {
      kind: 'effect-order',
      sourceInstanceId: state.pendingEffectOrder.items[0]?.sourceInstanceId,
    }
  }
  return null
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
    aiTurnStrategy.currentLevel = level
    // G3：外部只能提供以 PlayerView／合法事件建立的 KnowledgeState。
    // 每次決策明確覆寫，避免不同對局或玩家共用上一局的短期記憶。
    aiTurnStrategy.knowledgeState = options.knowledgeState

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
        (current, currentPlayerId) => handleAiPendingDecision(
          current,
          currentPlayerId,
          { level, knowledgeState: aiTurnStrategy.knowledgeState },
        ),
        (s, p) => handleAiPendingBattle(
          s,
          p,
          level,
          aiTurnStrategy.knowledgeState,
        ),
        turnHandler,
      ]) ?? {
        state,
        action: 'idle' as const,
        description: `${state.players[playerId].name}等待行動。`,
      }

    const levelledDecision: AiDecision = {
      ...decision,
      reason: {
        ...(decision.reason ?? {}),
        level: decision.reason?.level ?? level,
      },
    }
    // pending／battle handler 已為實際選擇記錄更精確的種類（例如 FLIP、
    // blocker 或多階段）。只有既有 handler 尚未附帶 telemetry 時，才以
    // 入口狀態補上通用分類，避免覆寫真實決策原因。
    const pendingSelection = level >= 3 && !levelledDecision.reason?.pendingStrategy
      ? pendingSelectionForState(state, playerId, levelledDecision)
      : null
    if (!pendingSelection) return levelledDecision

    const view = createPlayerView(state, playerId)
    const knowledgeState = aiTurnStrategy.knowledgeState?.observerId === playerId
      ? synchronizeKnowledgeWithPlayerView(aiTurnStrategy.knowledgeState, view)
      : createKnowledgeStateFromPlayerView(view)
    const selectionStrategy = createPendingSelectionStrategy(
      view,
      knowledgeState,
      level,
    )
    return {
      ...levelledDecision,
      reason: {
        ...levelledDecision.reason,
        level: levelledDecision.reason?.level ?? level,
        pendingStrategy: selectionStrategy.telemetry(
          pendingSelection.kind,
          pendingSelection.sourceInstanceId,
        ),
      },
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
