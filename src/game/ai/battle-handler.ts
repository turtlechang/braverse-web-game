import {shouldSkipHpFlipForFatalRefresh} from './hp-flip-refresh-safety'
import {selectSafeHandBreakPayment} from './hand-break-payment'
import { executeCardEffect } from '../effects'
import { maskGameStateForViewer } from '../masked-state'
import { getBattleCookiePositionCostCandidates } from '../battle-position-cost'
import {
  getAttackResponseSkillCandidates,
  getTrapCandidates,
  getPlayableTrapCostOption,
  getTrapTargetCandidates,
  getTrapSelfTargetCandidates,
  getBlockerCandidates,
} from '../battle'
import {
  clearDepartedCookieModifiers,
  getReplacementCandidates,
  recordCookieDepartures,
} from '../replacement'
import { applyGameCommand as executeGameCommand } from '../commands'
import {
  getAttackDamageAgainst,
  getBreakToTrashCandidates,
  getEffectSelectionLimits,
  getEffectTargetCandidatesForEffect,
  getEffectSelectionCandidates,
  getPlaceHandHpCandidates,
  getSupportEffectCandidates,
  getTrashToDeckCandidates,
  isEffectConditionMet,
} from '../effects'
import { expandChooseOne, isChooseOneModePlayable } from '../effects/choose-one'
import { selectEnergyPayment } from '../energy'
import { getCookieEffectiveLevel } from '../helpers'
import {
  getDiscardHandCostCandidates,
  payTrashBattleCookieCost,
  getTrashBattleCookieCostCandidates,
  getTrashCookieToBreakAreaCostCandidates,
  getTrashToDeckCostCandidates,
} from '../skills'
import { createPlayerView } from '../player-view'
import { getLegalTurnCommands } from '../legal-actions'
import type { AbilityCost, CardEffect, CookieInBattle, EffectContext, GameState, GameCard, PlayerId } from '../types'
import type { AiDecision, AiLevel } from './types'
import { chooseAiEffectMode } from './choose-one-mode'
import { isRuleEnabled } from './rule-profiles'
import { getCardEffectValue } from './bs2MatchupProfiles'
import {
  createKnowledgeStateFromPlayerView,
  synchronizeKnowledgeWithPlayerView,
  type KnowledgeState,
} from './strategy/knowledge-state'
import {
  createPendingSelectionStrategy,
  type PendingSelectionStrategy,
} from './strategy/pending-selection'
import { chooseSharedEffectTargets } from './shared-selection'
import { getPublicEffectDamageByTarget } from './public-effect-damage'

type SupportEffectCandidate = ReturnType<typeof getSupportEffectCandidates>[number]

const getSupportSelections = (
  supports: SupportEffectCandidate[],
  count: number,
): SupportEffectCandidate[][] => {
  const maximumCombinations = 4096
  const combinations: number[][] = []
  const selection: number[] = []
  let exceededLimit = false
  const visit = (start: number) => {
    if (exceededLimit) return
    if (selection.length === count) {
      combinations.push([...selection])
      exceededLimit = combinations.length > maximumCombinations
      return
    }
    for (let index = start; index <= supports.length - (count - selection.length); index++) {
      selection.push(index)
      visit(index + 1)
      selection.pop()
      if (exceededLimit) return
    }
  }
  visit(0)

  if (exceededLimit) {
    // Avoid combinatorial growth if a future card asks to rest many supports:
    // compare the stable prefix plus every one-support replacement.
    const candidates = new Map<string, number[]>()
    const add = (indices: number[]) => {
      const ordered = [...indices].sort((left, right) => left - right)
      candidates.set(ordered.join(','), ordered)
    }
    const prefix = Array.from({ length: count }, (_, index) => index)
    add(prefix)
    for (let selectedIndex = 0; selectedIndex < count; selectedIndex++) {
      for (let replacement = count; replacement < supports.length; replacement++) {
        const candidate = [...prefix]
        candidate[selectedIndex] = replacement
        add(candidate)
      }
    }
    return [...candidates.values()].map(indices => indices.map(index => supports[index]))
  }

  return combinations.map(indices => indices.map(index => supports[index]))
}

const chooseAttackEffectTargets = (
  state: GameState,
  playerId: PlayerId,
  battle: NonNullable<GameState['pendingBattle']>,
  effect: CardEffect | undefined,
  universal?: PendingSelectionStrategy,
): string[] => {
  if (!effect) return []
  const context: EffectContext = {
    sourcePlayerId: playerId,
    sourceInstanceId: battle.attackerInstanceId,
  }

  if (effect.kind === 'rest-support-and-damage') {
    const supportOwnerId = effect.supportSide === 'opponent'
      ? playerId === 'player-one' ? 'player-two' : 'player-one'
      : playerId
    const candidateIds = new Set(getEffectSelectionCandidates(state, context, effect).map(card => card.instanceId))
    const supports = getSupportEffectCandidates(state, context, { side: effect.supportSide, activeOnly: effect.activeOnly })
      .filter(support => candidateIds.has(support.card.instanceId))
    const targets = getEffectTargetCandidatesForEffect(state, context, effect)
    let best: {
      lethal: number
      breakLevel: number
      damage: number
      followUpAttackCount: number
      count: number
      supports: string[]
      target: string
    } | undefined
    for (let count = 1; count <= Math.min(effect.supportAmount, supports.length); count++) {
      for (const selectedSupports of getSupportSelections(supports, count)) {
        const supportIds = selectedSupports.map(support => support.card.instanceId)
        const selectedIds = new Set(supportIds)
        // Forecast public damage and the attack opportunities left after the
        // current battle. This matters when a fixed support-area prefix would
        // spend an energy color needed by another ready Cookie.
        const projectedState = { ...state, players: { ...state.players, [supportOwnerId]: {
          ...state.players[supportOwnerId], supportArea: state.players[supportOwnerId].supportArea.map(support =>
            selectedIds.has(support.card.instanceId) ? { ...support, rested: true } : support),
        } } }
        const followUpState = supportOwnerId === playerId
          ? { ...projectedState, pendingBattle: undefined, phase: 'main' as const, activePlayerId: playerId }
          : undefined
        const followUpAttackCount = followUpState
          ? getLegalTurnCommands(followUpState, playerId).filter(command => command.kind === 'attack').length
          : 0
        const forecast = getPublicEffectDamageByTarget(projectedState, playerId, context,
          { kind: 'damage', amount: count, target: effect.target }, targets.map(target => target.card.instanceId))
        for (const target of targets) {
          const damage = forecast?.get(target.card.instanceId) ?? 0
          if (damage <= 0) continue
          const lethal = damage >= target.hpCards.length ? 1 : 0
          const choice = { lethal, breakLevel: lethal ? getCookieEffectiveLevel(target) : 0,
            damage: Math.min(damage, target.hpCards.length), followUpAttackCount, count,
            supports: supportIds, target: target.card.instanceId }
          // Prefer a knockout, then useful damage and remaining legal attacks;
          // ties retain the smaller support payment instead of wasting energy.
          if (!best || choice.lethal > best.lethal ||
            (choice.lethal === best.lethal && (choice.breakLevel > best.breakLevel ||
              (choice.breakLevel === best.breakLevel && (choice.damage > best.damage ||
                (choice.damage === best.damage && (choice.followUpAttackCount > best.followUpAttackCount ||
                  (choice.followUpAttackCount === best.followUpAttackCount && choice.count < best.count)))))))) best = choice
        }
      }
    }
    return best ? [...best.supports, best.target] : []
  }

  // Selecting a Cookie also commits to placing a legal hand card in the next
  // step. Decline the optional target when that required card is unavailable.
  if (effect.kind === 'hand-to-hp' && effect.selectTarget && effect.handPlacementRequired &&
    getPlaceHandHpCandidates(state, playerId, effect).length === 0) return []

  // 攻擊後續也可能直接選支援區／棄牌區／手牌的卡。這些效果沒有一般
  // Cookie target selector，不能把空的戰鬥目標陣列交給 executeCardEffect。
  // 與 pending ability 共用同一組合法候選與數量限制。
  const usesCardSelection =
    effect.kind === 'break-to-battle' ||
    effect.kind === 'support-to-battle' ||
    effect.kind === 'trash-to-battle' ||
    effect.kind === 'trash-to-support' ||
    effect.kind === 'trash-to-hand' ||
    effect.kind === 'equipped-to-hp' ||
    effect.kind === 'support-to-trash' ||
    effect.kind === 'hand-to-support' ||
    effect.kind === 'break-to-hand-by-level-sum' ||
    effect.kind === 'prevent-support-active-next-phase' ||
    (effect.kind === 'reveal-hand' && effect.selectCard) ||
    (effect.kind === 'set-active' && effect.selectable) ||
    effect.kind === 'rest-support' ||
    effect.kind === 'hand-to-battle' ||
    effect.kind === 'opponent-trash-to-break' ||
    effect.kind === 'trash-to-break'
  if (usesCardSelection) {
    const limits = getEffectSelectionLimits(effect)
    const candidates = getEffectSelectionCandidates(state, context, effect)
    if (!limits) return []
    const count = Math.min(limits.max, candidates.length)
    if (count < limits.min) return []
    const candidateIds = candidates.map((card) => card.instanceId)
    return universal?.enabled
      ? universal.selectEffectTargetIds(effect, candidateIds, count)
      : candidateIds.slice(0, count)
  }

  // These attack follow-ups select cards outside the battle area (Stage,
  // hand, or break area). Reuse the rules-layer candidate source instead of
  // treating every effect with a `target` selector as a Cookie target.
  if (
    effect.kind === 'field-to-trash' ||
    effect.kind === 'hand-to-break' ||
    effect.kind === 'break-to-hand'
  ) {
    const limits = getEffectSelectionLimits(effect)
    const candidateIds = getEffectSelectionCandidates(state, context, effect)
      .map((card) => card.instanceId)
    if (!limits) return []
    const count = Math.min(limits.max, candidateIds.length)
    if (count < limits.min) return []
    return universal?.enabled
      ? universal.selectEffectTargetIds(effect, candidateIds, count)
      : candidateIds.slice(0, count)
  }

  if (effect.kind === 'break-to-trash') {
    const candidateIds = getBreakToTrashCandidates(state, context, effect)
      .map((card) => card.instanceId)
    return universal?.enabled
      ? universal.selectEffectTargetIds(effect, candidateIds, effect.max)
      : candidateIds.slice(0, effect.max)
  }

  if (effect.kind === 'opponent-battle-to-trash') {
    const candidateIds = getEffectTargetCandidatesForEffect(state, context, effect)
      .sort((left, right) => left.hpCards.length - right.hpCards.length)
      .map((cookie) => cookie.card.instanceId)
    return universal?.enabled
      ? universal.selectEffectTargetIds(effect, candidateIds, 1)
      : candidateIds.slice(0, 1)
  }

  if (effect.kind === 'trash-to-deck') {
    const candidates = getTrashToDeckCandidates(state, context, effect)
    const count = Math.min(effect.max, candidates.length)
    if (count < (effect.min ?? 0)) return []
    const candidateIds = candidates.map((card) => card.instanceId)
    return universal?.enabled
      ? universal.selectEffectTargetIds(effect, candidateIds, count)
      : candidateIds.slice(0, count)
  }

  if (effect.kind === 'support-to-hand') {
    const candidates = getEffectSelectionCandidates(state, context, effect)
    const minimum = effect.optional ? 0 : effect.amount
    const maximum = effect.anyNumber ? candidates.length : effect.amount
    if (candidates.length < minimum) return []
    const candidateIds = candidates.map((card) => card.instanceId)
    return universal?.enabled
      ? universal.selectEffectTargetIds(effect, candidateIds, maximum)
      : candidateIds.slice(0, maximum)
  }

  if (!('target' in effect) || !effect.target) return []

  // Movement effects have legality constraints beyond the selector itself;
  // for example a source-only return-to-hand must not empty its battle area.
  // Keep AI target selection aligned with executeCardEffect's effect-aware
  // candidate helper.
  const candidates = getEffectTargetCandidatesForEffect(state, context, effect)
  const ordered = [...candidates].sort((left, right) => {
    if (effect.kind === 'damage') {
      const leftLethal = left.hpCards.length <= effect.amount ? 0 : 1
      const rightLethal = right.hpCards.length <= effect.amount ? 0 : 1
      return (
        leftLethal - rightLethal ||
        left.hpCards.length - right.hpCards.length
      )
    }
    return left.hpCards.length - right.hpCards.length
  })
  const count = Math.min(effect.target.max, ordered.length)
  if (count < effect.target.min) return []
  const candidateIds = ordered.map((cookie) => cookie.card.instanceId)
  if (!universal?.enabled && effect.target.countPerPlayer !== undefined) {
    const countPerPlayer = effect.target.countPerPlayer
    const groups = (['player-one', 'player-two'] as const).map((ownerId) =>
      candidateIds.filter((id) => state.players[ownerId].battleArea.some(
        (cookie) => cookie.card.instanceId === id)).slice(0, countPerPlayer))
    return groups.every((group) => group.length === countPerPlayer) ? groups.flat() : []
  }
  return universal?.enabled
    ? universal.selectEffectTargetIds(effect, candidateIds, count,
        getPublicEffectDamageByTarget(state, playerId, context, effect, candidateIds))
    : candidateIds.slice(0, count)
}


/**
 * R7: 評估陷阱是否值得使用
 *
 * 分數組成：
 * 1. protectedTargetValue：保護目標價值（Level + HP + 效果價值）
 * 2. preventedKillBonus：防止被擊倒的加分
 * 3. preventedBreakBonus：防止 break area 推進的加分
 * 4. effectValueBonus：陷阱效果本身的價值
 * 5. lowValueWastePenalty：保護低價值目標的懲罰
 * 6. costPenalty：陷阱代價懲罰（能量 + 棄牌）
 */
const EFFECT_VALUE_MAP: Record<string, number> = {
  'prevent-knockout': 30,
  'redirect-attack': 25,
  'modify-attack': 20,
  'damage': 15,
  'field-to-trash': 15,
  'gain-hp': 10,
  'draw': 10,
  'support-to-hand': 5,
}

/**
 * 陷阱值不值得發動的門檻。沿用原本只套用在「Lv.1 且 HP1」目標上的
 * 50 分門檻（已驗證過的數字，見下方 R7 說明），改成對所有目標一律
 * 套用。用小一點的門檻（例如 10）試過：多數「非致命、目標普通」的
 * 陷阱淨值都落在 20–50 之間，門檻太低等於形同虛設（300 局 benchmark
 * 裡幾乎沒有陷阱被跳過），沒有真正過濾到「代價大於保護價值」的案例。
 */
const TRAP_SKIP_THRESHOLD = 50

const hasOnlyUnmetPublicBattleColorCondition = (
  state: GameState,
  playerId: PlayerId,
  trapCard: GameCard,
): boolean => {
  const trap = trapCard.trap
  if (
    !trap ||
    trap.alternativeCosts?.length ||
    trap.conditionalCost ||
    trap.effects.length === 0
  ) return false

  // A trap with another cost may still create a useful zone change. Restrict
  // this guard to energy-only traps whose complete root effect is publicly
  // gated by a battlefield color witness.
  const energyOnly = Object.entries(trap.cost).every(([key, value]) =>
    key === 'energy' || (key === 'discardHand' && value === 0),
  )
  if (!energyOnly) return false

  const context = { sourcePlayerId: playerId, sourceInstanceId: trapCard.instanceId }
  const publicState = maskGameStateForViewer({ ...state, commandLog: undefined }, playerId)
  return trap.effects.every(effect =>
    effect.kind === 'modify-attack' &&
    effect.condition?.kind === 'battle-area-has-color' &&
    !isEffectConditionMet(publicState, context, effect),
  )
}

const selectTrapRescueTargets = (
  effect: CardEffect,
  preferredInstanceId: string,
  candidates: readonly CookieInBattle[],
): string[] | null => {
  if (!('target' in effect) || !effect.target) return null
  const candidateIds = candidates.map(cookie => cookie.card.instanceId)
  if (effect.target.allMatching) {
    return candidateIds.includes(preferredInstanceId) ? candidateIds : null
  }

  const selected = candidateIds.includes(preferredInstanceId)
    ? [preferredInstanceId]
    : []
  for (const candidateId of candidateIds) {
    if (selected.length >= effect.target.min) break
    if (!selected.includes(candidateId)) selected.push(candidateId)
  }
  return selected.length >= effect.target.min && selected.length <= effect.target.max
    ? selected
    : null
}

const hasPositiveTrapPayment = (value: unknown): boolean => {
  if (typeof value === 'number') return value > 0
  if (typeof value === 'boolean') return value
  if (Array.isArray(value)) return value.some(hasPositiveTrapPayment)
  if (value && typeof value === 'object') {
    return Object.values(value).some(hasPositiveTrapPayment)
  }
  return false
}

const selectTrapDiscardHandPaymentIds = (
  state: GameState,
  playerId: PlayerId,
  trapCard: GameCard,
  cost: AbilityCost,
  universal?: PendingSelectionStrategy,
): string[] | null => {
  const requiredCount = cost.discardHand ?? 0
  const candidateIds = getDiscardHandCostCandidates(
    cost,
    state.players[playerId].hand,
    trapCard.instanceId,
  ).map(card => card.instanceId)
  const selected = universal?.enabled
    ? universal.orderCostIds(candidateIds, requiredCount)
    : candidateIds.slice(0, requiredCount)

  return selected.length === requiredCount &&
    new Set(selected).size === selected.length &&
    selected.every(instanceId => candidateIds.includes(instanceId))
    ? selected
    : null
}

const selectTrapBattleCookiePaymentIds = (
  state: GameState,
  playerId: PlayerId,
  trapCard: GameCard,
  cost: AbilityCost,
  universal?: PendingSelectionStrategy,
): string[] => {
  const requiredCount = cost.trashBattleCookie?.count ?? 0
  const candidateIds = getTrashBattleCookieCostCandidates(
    cost,
    state.players[playerId].battleArea,
    trapCard.instanceId,
  ).map(cookie => cookie.card.instanceId)
  const selected = universal?.enabled
    ? universal.orderCostIds(candidateIds, requiredCount)
    : candidateIds.slice(0, requiredCount)

  return selected.length === requiredCount &&
    new Set(selected).size === selected.length &&
    selected.every(instanceId => candidateIds.includes(instanceId))
    ? selected
    : candidateIds.slice(0, requiredCount)
}

/**
 * Build the exact per-effect target plan for a trap that can save the current
 * Cookie from this attack. Simulation uses the same effect executor as playTrap
 * so nested Then clauses, damage modifiers and blocked HP gain are included.
 * The projection rests the energy payment and moves the Trap to its owner's
 * trash before checking effect conditions, matching the activation sequence.
 * `null` entries are non-target effects that retain their normal selection path.
 */
const getTrapRescueEffectTargets = (
  state: GameState,
  playerId: PlayerId,
  trapCard: GameCard,
  battle: NonNullable<GameState['pendingBattle']>,
  selectedPaymentIds?: string[],
  universal?: PendingSelectionStrategy,
  selectedDiscardHandIds?: string[],
  selectedTrashBattleCookieIds?: string[],
): Array<string[] | null> | null => {
  if (!trapCard.trap || battle.defenderPlayerId !== playerId) return null
  const defender = state.players[playerId].battleArea.find(
    cookie => cookie.card.instanceId === battle.targetInstanceId,
  )
  if (!defender) return null

  const masked = maskGameStateForViewer({ ...state, commandLog: undefined }, playerId)
  const initialDamage = getAttackDamageAgainst(
    masked,
    battle.attackerInstanceId,
    battle.targetInstanceId,
  )
  if (initialDamage < defender.hpCards.length) return null

  const playableCost = getPlayableTrapCostOption(
    state,
    playerId,
    trapCard.trap,
    trapCard.instanceId,
  )
  if (!playableCost) return null
  const discardHandPaymentIds = selectedDiscardHandIds ??
    selectTrapDiscardHandPaymentIds(
      state,
      playerId,
      trapCard,
      playableCost.cost,
      universal,
    )
  if (!discardHandPaymentIds) return null
  const energyKeys = new Set([
    'energy', 'red', 'yellow', 'green', 'blue', 'purple', 'black', 'pure', 'neutral',
  ])
  const supportToTrashCostIsModeled =
    hasPositiveTrapPayment(playableCost.cost.supportToTrash) &&
    trapCard.trap.effects.some(
      effect => effect.kind === 'support-to-trash' && effect.side !== 'opponent',
    )
  const trashBattleCookieCost = playableCost.cost.trashBattleCookie
  const trashBattleCookieCostIsModeled = Boolean(trashBattleCookieCost) &&
    !trashBattleCookieCost?.faint &&
    !trashBattleCookieCost?.toBreakArea
  if (Object.entries(playableCost.cost).some(([key, value]) =>
    !energyKeys.has(key) &&
    hasPositiveTrapPayment(value) &&
    !(key === 'supportToTrash' && supportToTrashCostIsModeled) &&
    !(key === 'trashBattleCookie' && trashBattleCookieCostIsModeled) &&
    !(key === 'discardHand' && discardHandPaymentIds.length === playableCost.cost.discardHand),
  )) {
    // Other costs can change zones or targets. Do not forecast through a cost
    // that this projection does not pay. A supportToTrash field paired with a
    // self support-to-trash effect is modeled at that effect's actual point in
    // the sequence below. Faint and Break-area Cookie costs need additional
    // event/victory handling, so only direct-to-trash Cookie costs are modeled.
    return null
  }
  const energyPaymentIds = selectedPaymentIds ?? selectEnergyPayment(
    playableCost.cost.energy ?? playableCost.cost,
    state.players[playerId].supportArea,
  )
  if (!energyPaymentIds) return null

  const context: EffectContext = {
    sourcePlayerId: playerId,
    sourceInstanceId: trapCard.instanceId,
  }
  const projectedOwner = masked.players[playerId]
  const trapHandIndex = projectedOwner.hand.findIndex(
    card => card.instanceId === trapCard.instanceId,
  )
  if (trapHandIndex < 0) return null
  const projectedTrap = projectedOwner.hand[trapHandIndex]!
  const discardHandPaymentSet = new Set(discardHandPaymentIds)
  const discardHandCandidates = getDiscardHandCostCandidates(
    playableCost.cost,
    projectedOwner.hand,
    trapCard.instanceId,
  )
  const discardHandCandidateIds = new Set(
    discardHandCandidates.map(card => card.instanceId),
  )
  const discardedHandCards = projectedOwner.hand.filter(card =>
    discardHandPaymentSet.has(card.instanceId),
  )
  if (
    discardHandPaymentIds.length !== (playableCost.cost.discardHand ?? 0) ||
    discardedHandCards.length !== discardHandPaymentIds.length ||
    discardHandPaymentIds.some(instanceId => !discardHandCandidateIds.has(instanceId))
  ) {
    return null
  }
  const paymentSet = new Set(energyPaymentIds)
  let projected: GameState = {
    ...masked,
    players: {
      ...masked.players,
      [playerId]: {
        ...projectedOwner,
        hand: projectedOwner.hand.filter((card, index) =>
          index !== trapHandIndex && !discardHandPaymentSet.has(card.instanceId),
        ),
        supportArea: projectedOwner.supportArea.map(support =>
          paymentSet.has(support.card.instanceId)
            ? { ...support, rested: true }
            : support,
        ),
        discardPile: [...projectedOwner.discardPile, projectedTrap, ...discardedHandCards],
      },
    },
  }
  const trashBattleCookieIds = selectedTrashBattleCookieIds ??
    selectTrapBattleCookiePaymentIds(
      state,
      playerId,
      trapCard,
      playableCost.cost,
      universal,
    )
  if (trashBattleCookieIds.length !== (trashBattleCookieCost?.count ?? 0)) {
    return null
  }
  if (trashBattleCookieCost && trashBattleCookieCost.count > 0) {
    const trashPayment = payTrashBattleCookieCost(
      projected.players[playerId],
      playableCost.cost,
      trashBattleCookieIds,
      trapCard.instanceId,
    )
    projected = recordCookieDepartures(
      clearDepartedCookieModifiers({
        ...projected,
        players: {
          ...projected.players,
          [playerId]: trashPayment.player,
        },
      }),
      playerId,
      trashPayment.departedCount,
    )
  }
  let preventsKnockout = false
  let projectedSupportTrashAmount = 0
  const plannedTargets: Array<string[] | null> = []

  for (const [effectIndex, effect] of trapCard.trap.effects.entries()) {
    if (effect.kind === 'support-to-trash') {
      if (!isEffectConditionMet(projected, context, effect)) {
        plannedTargets.push([])
        continue
      }
      const limits = getEffectSelectionLimits(effect)
      if (!limits) return null
      const candidates = getEffectSelectionCandidates(projected, context, effect)
      const count = Math.min(limits.max, candidates.length)
      if (count < limits.min) return null
      const candidateIds = candidates.map(candidate => candidate.instanceId)
      const targets = universal?.enabled
        ? universal.selectEffectTargetIds(effect, candidateIds, count)
        : candidateIds.slice(0, count)
      if (
        targets.length < limits.min ||
        targets.length > limits.max ||
        new Set(targets).size !== targets.length ||
        targets.some(targetId => !candidateIds.includes(targetId))
      ) {
        return null
      }
      projectedSupportTrashAmount += targets.length
      plannedTargets.push(targets)
      projected = executeCardEffect(projected, context, effect, targets)
      if (projected.status !== 'playing' || projected.pendingRefresh) {
        return null
      }
      continue
    }

    if (!('target' in effect) || !effect.target) {
      if (
        effect.kind === 'trash-to-deck' &&
        trapCard.trap.effects.at(-1) === effect
      ) {
        // Returning cards to the deck cannot change whether this battle target
        // survives. Confirm the printed minimum is legal, then leave this
        // final side effect to its normal selector; simulating its shuffle here
        // would add randomness to a forecast that only needs combat state.
        if (
          getTrashToDeckCandidates(state, context, effect).length <
          (effect.min ?? 0)
        ) {
          return null
        }
        plannedTargets.push(null)
        continue
      }
      if (
        effect.kind === 'trash-to-support' &&
        effect.optional &&
        effectIndex === trapCard.trap.effects.length - 1
      ) {
        // This final optional recovery cannot change the current attack's
        // damage. Keep its target on the ordinary AI selection path.
        plannedTargets.push(null)
        continue
      }
      if (
        effect.kind === 'trash-to-hand' &&
        effectIndex === trapCard.trap.effects.length - 1
      ) {
        // Recovery is "up to" its printed maximum, so zero targets is legal.
        // This final hand change cannot affect whether the current defender
        // survives; leave it to the ordinary selector without rejecting the
        // earlier attack mitigation when no recovery target exists.
        const limits = getEffectSelectionLimits(effect)
        if (!limits || limits.min !== 0) return null
        plannedTargets.push(null)
        continue
      }
      if (
        effect.kind === 'draw-up-to' &&
        effectIndex === trapCard.trap.effects.length - 1
      ) {
        // A final optional draw cannot improve or invalidate the current
        // battle rescue. Leave its count to the ordinary effect resolver.
        plannedTargets.push(null)
        continue
      }
      if (effect.kind === 'optional-cost-attack') {
        // The player can decline an optional Then without undoing the trap's
        // already-applied attack modifier. Its later effects do not need to be
        // assumed in order to prove this defense route is available.
        plannedTargets.push(null)
        continue
      }
      if (effect.kind === 'support-to-hand') {
        plannedTargets.push(null)
        continue
      }
      return null
    }

    if (!isEffectConditionMet(projected, context, effect)) {
      plannedTargets.push([])
      continue
    }

    const targetSide = effect.target.side
    const canReduceAttack = effect.kind === 'modify-attack' &&
      effect.amount < 0 && targetSide === 'opponent'
    const canAddHp = effect.kind === 'gain-hp' &&
      effect.amount > 0 && targetSide === 'self'
    const canReduceReceivedDamage = effect.kind === 'modify-damage-received' &&
      targetSide === 'self'
    const canPreventKnockout = effect.kind === 'prevent-knockout' &&
      targetSide === 'self'

    if (!canReduceAttack && !canAddHp && !canReduceReceivedDamage && !canPreventKnockout) {
      // Do not claim a rescue plan whose execution depends on a different
      // target choice or an effect this forecast does not model.
      return null
    }

    const preferredInstanceId = canReduceAttack
      ? battle.attackerInstanceId
      : battle.targetInstanceId
    const candidates = getEffectTargetCandidatesForEffect(projected, context, effect)
    const targets = selectTrapRescueTargets(effect, preferredInstanceId, candidates)
    if (!targets) return null
    plannedTargets.push(targets)

    if (canPreventKnockout && targets.includes(battle.targetInstanceId)) {
      preventsKnockout = true
      const pendingBattle = projected.pendingBattle
      if (!pendingBattle) return null
      projected = {
        ...projected,
        pendingBattle: {
          ...pendingBattle,
          preventKnockoutTargetIds: [
            ...pendingBattle.preventKnockoutTargetIds,
            battle.targetInstanceId,
          ],
        },
      }
      continue
    }

    if (canReduceAttack || canAddHp || canReduceReceivedDamage) {
      projected = executeCardEffect(projected, context, effect, targets)
      if (projected.status !== 'playing' || projected.pendingRefresh) {
        return null
      }
    }
  }

  const requiredSupportTrash = playableCost.cost.supportToTrash ?? 0
  if (projectedSupportTrashAmount < requiredSupportTrash) return null

  const projectedDefender = projected.players[playerId].battleArea.find(
    cookie => cookie.card.instanceId === battle.targetInstanceId,
  )
  if (!projectedDefender) return null
  const projectedAttacker = projected.players[battle.attackerPlayerId].battleArea.find(
    cookie => cookie.card.instanceId === battle.attackerInstanceId,
  )
  // A legal Then can remove the attacker and cancel the pending battle. In
  // that route the target survives, so don't calculate damage for a missing
  // Cookie.
  if (!projectedAttacker) return plannedTargets
  const projectedDamage = getAttackDamageAgainst(
    projected,
    battle.attackerInstanceId,
    battle.targetInstanceId,
  )
  return projectedDamage < projectedDefender.hpCards.length || preventsKnockout
    ? plannedTargets
    : null
}

const getTrapDamageTradeValue = (
  state: GameState,
  playerId: PlayerId,
  trapCard: GameCard,
): number => {
  if (!trapCard.trap) return 0
  const context: EffectContext = {
    sourcePlayerId: playerId,
    sourceInstanceId: trapCard.instanceId,
  }
  const opponentId: PlayerId = playerId === 'player-one' ? 'player-two' : 'player-one'
  let score = 0

  for (const effect of trapCard.trap.effects) {
    // Damage-all has a deterministic public recipient set. Account for the
    // actual friendly-fire trade so an offensive Trap can still be worthwhile
    // when it does not rescue the Cookie currently under attack.
    if (effect.kind !== 'damage-all' || !effect.target) continue
    if (!isEffectConditionMet(state, context, effect)) continue

    const targets = getEffectTargetCandidatesForEffect(state, context, effect)
    const count = effect.sequential ? targets.length : Math.min(effect.target.max, targets.length)
    if (count < effect.target.min) continue
    const selected = targets.slice(0, count)
    const damageByTarget = getPublicEffectDamageByTarget(
      state,
      playerId,
      context,
      effect,
      selected.map(target => target.card.instanceId),
    )

    for (const target of selected) {
      const ownerId = (['player-one', 'player-two'] as const).find(candidatePlayerId =>
        state.players[candidatePlayerId].battleArea.some(
          cookie => cookie.card.instanceId === target.card.instanceId,
        ),
      )
      if (!ownerId) continue
      const damage = damageByTarget?.get(target.card.instanceId) ?? 0
      if (damage <= 0) continue

      const appliedDamage = Math.min(damage, target.hpCards.length)
      const knockoutBonus = damage >= target.hpCards.length
        ? 20 + getCookieEffectiveLevel(target) * 10
        : 0
      const targetValue = appliedDamage * 20 + knockoutBonus
      score += ownerId === opponentId ? targetValue : -targetValue
    }
  }

  return score
}

export const evaluateTrapWorth = (
  state: GameState,
  playerId: PlayerId,
  trapCard: GameCard,
  battle: NonNullable<GameState['pendingBattle']>,
  selectedPaymentIds?: string[],
  universal?: PendingSelectionStrategy,
  selectedDiscardHandIds?: string[],
  selectedTrashBattleCookieIds?: string[],
): number => {
  if (!trapCard.trap) return 0
  if (hasOnlyUnmetPublicBattleColorCondition(state, playerId, trapCard)) return 0

  const attacker = state.players[battle.attackerPlayerId].battleArea.find(
    (c) => c.card.instanceId === battle.attackerInstanceId,
  )
  const defender = state.players[battle.defenderPlayerId].battleArea.find(
    (c) => c.card.instanceId === battle.targetInstanceId,
  )

  if (!attacker || !defender) return 0

  let score = 0

  // 1. protectedTargetValue：保護目標價值
  const targetLevel = getCookieEffectiveLevel(defender)
  const targetHp = defender.hpCards.length
  // A lethal hit only grants rescue value when the complete projected trap
  // sequence actually leaves the Cookie alive. A partial damage reduction can
  // still matter when the target survives either way, but it cannot count as
  // protecting a Cookie that is still knocked out.
  const attackerDamage = getAttackDamageAgainst(
    state,
    battle.attackerInstanceId,
    battle.targetInstanceId,
  )
  const wouldBeKilled = targetHp <= attackerDamage
  const rescueTargets = wouldBeKilled
    ? getTrapRescueEffectTargets(
        state,
        playerId,
        trapCard,
        battle,
        selectedPaymentIds,
        universal,
        selectedDiscardHandIds,
        selectedTrashBattleCookieIds,
      )
    : null
  const preventsKnockout = rescueTargets !== null

  if (!wouldBeKilled || preventsKnockout) {
    score += targetLevel * 15
    score += targetHp * 10

    // 高效果價值餅乾加分——原本是寫死的卡名子字串清單，只涵蓋 BS1／BS2 少數
    // 幾張卡，且用 `name.includes(...)` 比對；同名跨彈重印卡（例如 BS1-012／
    // BS3-009 都叫 Wildberry Cookie）會被誤套，BS3 卡片不管技能多強都拿不到
    // 這個加分。改用 getCardEffectValue：已收錄的卡沿用調校過的數字，查無
    // 資料的新卡改讀 card.skill.effects 直接推算，門檻 >= 5 對應原本清單裡
    // 那些卡在 EFFECT_VALUE_BONUS 的實際分數（Rebel/Dark Choco 8、Red
    // Bean/Sea Fairy/Wind Archer 7、Black Raisin/Banana/Vampire 6、Cream
    // Unicorn 5）。
    if (getCardEffectValue(defender.card) >= 5) {
      score += 20
    }
  }

  // 2. preventedKillBonus：只有投影後實際存活才算防止被擊倒（依目標等級縮放）
  // Use the damage this target would actually receive. Attack and damage
  // received modifiers can make printed/effective attack differ from damage.
  if (wouldBeKilled && preventsKnockout) {
    if (targetLevel >= 3) {
      score += 60
    } else if (targetLevel === 2) {
      score += 35
    } else {
      score += 15
    }
  }

  // 3. preventedBreakBonus：防止 break area 推進
  const myBreakLevel = state.players[playerId].breakArea.reduce(
    (sum, c) => sum + c.level, 0,
  )
  if (wouldBeKilled && preventsKnockout && myBreakLevel >= 8) {
    score += 40
  } else if (wouldBeKilled && preventsKnockout && myBreakLevel >= 6) {
    score += 20
  }

  // 4. effectValueBonus：陷阱效果價值
  for (const effect of trapCard.trap.effects) {
    score += EFFECT_VALUE_MAP[effect.kind] ?? 5
  }
  score += getTrapDamageTradeValue(state, playerId, trapCard)

  // 5. lowValueWastePenalty：保護低價值目標（核心 R7 邏輯）
  // 只在目標明顯無價值時才扣分
  if (targetLevel <= 1 && targetHp <= 1) {
    score -= 30
  }

  // 6. costPenalty：陷阱代價
  const energyCost = Object.values(trapCard.trap.cost.energy ?? {}).reduce(
    (sum, n) => sum + n, 0,
  )
  score -= energyCost * 8
  const discardCost = trapCard.trap.cost.discardHand ?? 0
  score -= discardCost * 12
  const trashCost = trapCard.trap.cost.trashBattleCookie?.count ?? 0
  score -= trashCost * 20

  // Losing the last Cookie is terminal when there is no replacement in hand.
  // Apply this safeguard after all conservation penalties so low printed
  // level/HP cannot make a playable saving trap fall below the skip threshold.
  if (
    rescueTargets &&
    state.players[playerId].battleArea.length === 1 &&
    getReplacementCandidates(state, playerId).length === 0
  ) {
    score = Math.max(score, TRAP_SKIP_THRESHOLD + 1)
  }

  return score
}

/**
 * Block 值不值得使用的門檻。跟陷阱不同，「不擋」的基準行為本來就是
 * 讓原目標正常受傷，沒有陷阱那種「暴露資訊」的隱性代價，所以直接用 0：
 * 只要 evaluateBlockWorth 算出來的淨值為正（救到的價值 > 犧牲的價值 +
 * 代價），才值得把攻擊導到 Blocker 身上。
 */
const BLOCK_SKIP_THRESHOLD = 0

/**
 * 單張戰鬥區餅乾的靜態價值，供 evaluateBlockWorth 比較「保住原目標」
 * 跟「犧牲 Blocker」何者划算。公式跟 evaluateTrapWorth 的
 * protectedTargetValue 一致（Level*15 + HP*10 + 高效果價值 +20），
 * 兩者評的都是「這隻餅乾值多少」，沒有理由用不同尺度。
 */
const cookieValue = (cookie: CookieInBattle): number => {
  let value = getCookieEffectiveLevel(cookie) * 15 + cookie.hpCards.length * 10
  if (getCardEffectValue(cookie.card) >= 5) value += 20
  return value
}

/**
 * 評估用某隻 Blocker 把攻擊導過去值不值得。
 *
 * 原本 AI 直接取 getBlockerCandidates()[0]，完全沒比較「擋下來省了
 * 多少」跟「Blocker 頂上去可能賠掉多少」，導致用高價值餅乾去擋一次
 * 對方明顯打不死原目標的攻擊、或是白白犧牲一隻能打死的 Blocker 去救
 * 一隻其實扛得住的雜牌。
 *
 * 分數組成（只用公開資訊：雙方戰鬥區、HP 張數、卡面攻擊力／技能）：
 * 1. preventedTargetLoss：原目標會被打死時，救下來的價值
 * 2. sacrificeCost：Blocker 頂上去會死時，賠掉的價值
 * 3. extraEffectBonus：block 技能除了 redirect-attack 以外的額外效果
 * 4. costPenalty：技能發動的能量代價
 */
export const evaluateBlockWorth = (
  state: GameState,
  playerId: PlayerId,
  blocker: CookieInBattle,
  battle: NonNullable<GameState['pendingBattle']>,
): number => {
  const originalTarget = state.players[battle.defenderPlayerId].battleArea.find(
    (c) => c.card.instanceId === battle.targetInstanceId,
  )
  const skill = blocker.card.skill
  if (!originalTarget || !skill) return -Infinity

  const originalDamage = getAttackDamageAgainst(
    state,
    battle.attackerInstanceId,
    originalTarget.card.instanceId,
  )
  const originalWouldDie = originalTarget.hpCards.length <= originalDamage

  const redirectedDamage = getAttackDamageAgainst(
    state,
    battle.attackerInstanceId,
    blocker.card.instanceId,
  )
  const blockerWouldDie = blocker.hpCards.length <= redirectedDamage

  let score = 0

  // 1. preventedTargetLoss：原目標本來會死，擋下來就是救到這份價值
  if (originalWouldDie) {
    score += cookieValue(originalTarget)
  }

  // 2. sacrificeCost：Blocker 頂上去反而會死，扣掉它的價值
  if (blockerWouldDie) {
    score -= cookieValue(blocker)
  } else if (!originalWouldDie) {
    // 雙方都不會死：純粹是把傷害從原目標轉移到 Blocker 身上，
    // 值不值得看兩邊的價值差——把傷害轉去更便宜的餅乾上才划算，
    // 轉去更貴的餅乾上（負值）會被這裡自然壓低分數。
    score += (cookieValue(originalTarget) - cookieValue(blocker)) * 0.3
  }

  // 3. extraEffectBonus：block 技能本身若還帶其他效果（redirect-attack
  // 以外），一併計分，讓「這張 Blocker 卡本身多划算」也影響選擇。
  for (const effect of skill.effects) {
    if (effect.kind === 'redirect-attack') continue
    score += EFFECT_VALUE_MAP[effect.kind] ?? 5
  }

  // 4. costPenalty：技能發動代價
  const energyCost = Object.values(skill.cost.energy ?? {}).reduce(
    (sum, n) => sum + n, 0,
  )
  score -= energyCost * 8

  return score
}

/**
 * 手牌卡片被拿去付 FLIP 棄牌代價時的「捨得丟」程度：分數越低越該優先
 * 棄。餅乾用跟 cookieValue 一致的量尺（level*15，用卡面滿版 HP 而非
 * 戰鬥區剩餘 HP，故權重減半避免虛高）；道具／陷阱／舞台卡沒有
 * level/HP，改讀各自的 effects（跟 skill.effects 同一種 CardEffect[]
 * 結構）套用 EFFECT_VALUE_MAP 估效果強度。
 *
 * 只處理「棄哪張」，不判斷「值不值得發動 FLIP」：FLIP 的棄牌代價是
 * 拿到傷害已經發生後才付，不像陷阱有「提前暴露資訊」的隱性成本，
 * 用跟陷阱同一套 EFFECT_VALUE_MAP 門檻硬套會系統性低估（試過用同一
 * 套邏輯擋下發動，300 局 benchmark 顯示連 Lv.4 vs Lv.1 都從 100% 掉到
 * 95%，代表原本「有效果就發動」才是符合設計的正確預設，這裡不重新
 * 發明一個沒有校準基準的門檻）。
 */
const handCardDiscardValue = (card: GameCard): number => {
  if (card.type === 'cookie') {
    let value = card.level * 15 + card.hp * 5
    if (getCardEffectValue(card) >= 5) value += 20
    return value
  }
  const effects = card.trap?.effects ?? card.item?.effects ?? card.stageAbility?.effects
  if (!effects || effects.length === 0) return 5
  return effects.reduce((sum, effect) => sum + (EFFECT_VALUE_MAP[effect.kind] ?? 5), 0)
}


/** Numeric public forecast only; no actual payment or hidden HP settlement. */
const savingTrapTarget = (state: GameState, playerId: PlayerId, sourceInstanceId: string,
  effect: CardEffect, candidateIds: readonly string[], max: number): string[] | null => {
  const battle = state.pendingBattle
  if (!battle || max !== 1 || battle.defenderPlayerId !== playerId ||
      effect.kind !== 'modify-attack' || effect.amount >= 0 ||
      !candidateIds.includes(battle.attackerInstanceId)) return null
  // Do not forecast unrelated Then resources or hidden reveals.
  if (effect.thenEffects?.some(child => child.kind !== 'modify-attack' || child.amount >= 0)) return null
  const masked = maskGameStateForViewer({ ...state, commandLog: undefined }, playerId)
  const context = { sourcePlayerId: playerId, sourceInstanceId }
  if (!isEffectConditionMet(masked, context, effect)) return null
  const defender = masked.players[playerId].battleArea.find(c => c.card.instanceId === battle.targetInstanceId)
  if (!defender) return null
  const prior = getAttackDamageAgainst(masked, battle.attackerInstanceId, battle.targetInstanceId)
  const nonLethal = prior < defender.hpCards.length
  if (nonLethal) {
    // Prefer a proven current reduction over an uncertain later attack. Do not
    // project through printed attack follow-ups or another blocking decision.
    if (effect.duration !== 'this-turn' || effect.target.side !== 'opponent' ||
        effect.target.min !== 0 || effect.target.max !== 1 || effect.target.allMatching ||
        battle.stage !== 'trap' || battle.attackEffects.length > 0 ||
        state.phase !== 'main' || state.activePlayerId !== battle.attackerPlayerId) return null
    const laterTargets = masked.players[battle.attackerPlayerId].battleArea.filter(cookie =>
      cookie.card.instanceId !== battle.attackerInstanceId &&
      candidateIds.includes(cookie.card.instanceId))
    // This priority handles ready targets with no directly playable attack;
    // rested targets can depend on unmodeled reactivation, so keep their policy.
    if (laterTargets.length === 0 || laterTargets.some(cookie => cookie.rested)) return null
    const ordinaryCommands = getLegalTurnCommands(
      { ...masked, pendingBattle: undefined }, battle.attackerPlayerId,
    )
    if (!ordinaryCommands.some(command => command.kind === 'advance-phase')) return null
    if (ordinaryCommands.some(command =>
      (command.kind === 'attack' || command.kind === 'declare-attack') &&
      command.attackerInstanceId !== battle.attackerInstanceId &&
      candidateIds.includes(command.attackerInstanceId))) return null
  }
  const after = executeCardEffect(masked, context, effect, [battle.attackerInstanceId])
  if (after.pendingRefresh || after.pendingDrawUpTo) return null
  const reduced = getAttackDamageAgainst(after, battle.attackerInstanceId, battle.targetInstanceId)
  const useful = nonLethal ? reduced < prior : reduced < defender.hpCards.length
  return useful ? [battle.attackerInstanceId] : null
}

const selectTrapEffectTargets = (
  state: GameState,
  playerId: PlayerId,
  trapInstanceId: string,
  effect: CardEffect,
  universal: PendingSelectionStrategy,
): string[] => {
  if (
    effect.kind === 'support-to-hand' ||
    effect.kind === 'hand-to-support'
  ) {
    // These effects have dedicated fields in PlayTrapOptions and are handled
    // before the trap effect queue is entered.
    return []
  }

  const cardSelection =
    effect.kind === 'support-to-trash' ||
    effect.kind === 'break-to-battle' ||
    effect.kind === 'support-to-battle' ||
    effect.kind === 'trash-to-battle' ||
    effect.kind === 'trash-to-support' ||
    effect.kind === 'trash-to-hand' ||
    effect.kind === 'equipped-to-hp' ||
    effect.kind === 'break-to-hand-by-level-sum' ||
    effect.kind === 'trash-to-deck' ||
    effect.kind === 'prevent-support-active-next-phase' ||
    (effect.kind === 'reveal-hand' && effect.selectCard) ||
    (effect.kind === 'set-active' && effect.selectable) ||
    effect.kind === 'rest-support' ||
    effect.kind === 'hand-to-battle' ||
    effect.kind === 'opponent-trash-to-break' ||
    effect.kind === 'trash-to-break'
  if (cardSelection) {
    const limits = getEffectSelectionLimits(effect)
    const candidates = getEffectSelectionCandidates(
      state,
      { sourcePlayerId: playerId, sourceInstanceId: trapInstanceId },
      effect,
    )
    if (!limits) return []
    const count = Math.min(limits.max, candidates.length)
    if (count < limits.min) return []
    const candidateIds = candidates.map((card) => card.instanceId)
    return universal.enabled
      ? universal.selectEffectTargetIds(effect, candidateIds, count)
      : candidateIds.slice(0, count)
  }

  if (!('target' in effect) || !effect.target) return []
  const candidates = getEffectTargetCandidatesForEffect(
    state,
    { sourcePlayerId: playerId, sourceInstanceId: trapInstanceId },
    effect,
  )
  const count = effect.kind === 'damage-all' && effect.sequential
    ? candidates.length
    : Math.min(effect.target.max, candidates.length)
  if (count < effect.target.min) return []
  const candidateIds = candidates.map((cookie) => cookie.card.instanceId)
  // Printed "all" recipients are mandatory; optional target scoring must not
  // drop a full-HP Cookie or turn the group into a partial selection.
  if (effect.target.allMatching) return candidateIds
  const saving = universal.enabled ? savingTrapTarget(state, playerId, trapInstanceId, effect, candidateIds, count) : null
  if (saving) return saving
  return universal.enabled
    ? universal.selectEffectTargetIds(effect, candidateIds, count,
        getPublicEffectDamageByTarget(state, playerId,
          { sourcePlayerId: playerId, sourceInstanceId: trapInstanceId }, effect, candidateIds))
    : candidateIds.slice(0, count)
}

export const handleAiPendingBattle = (
  state: GameState,
  playerId: PlayerId,
  level?: AiLevel,
  knowledgeState?: KnowledgeState,
  shuffleSeed?: number,
): AiDecision | null => {
  // Every battle continuation, including Trap/FLIP effects, shares the step RNG.
  const applyGameCommand: typeof executeGameCommand = (current, command, options) =>
    executeGameCommand(current, command, { ...options, shuffleSeed })
  if (
    !state.pendingBattle ||
    state.pendingRefresh ||
    state.pendingOnPlay
  ) {
    return null
  }

  const battle = state.pendingBattle
  const useR7 = level !== undefined && isRuleEnabled(level, 'R7')
  const view = createPlayerView(state, playerId)
  const synchronizedKnowledge = knowledgeState?.observerId === playerId
    ? synchronizeKnowledgeWithPlayerView(knowledgeState, view)
    : createKnowledgeStateFromPlayerView(view)
  const universal = createPendingSelectionStrategy(
    view,
    synchronizedKnowledge,
    level,
  )
  const withBattlePendingReason = (
    decision: AiDecision,
    kind: Parameters<typeof universal.telemetry>[0],
    sourceInstanceId?: string,
    effect?: CardEffect,
  ): AiDecision => universal.enabled
    ? {
        ...decision,
        reason: {
          ...(decision.reason ?? { level: level ?? 2 }),
          pendingStrategy: universal.telemetry(kind, sourceInstanceId, effect),
        },
      }
    : decision
  if (
    battle.stage === 'attack-effect' &&
    battle.attackerPlayerId === playerId
  ) {
    const effect = battle.attackEffects[battle.attackEffectIndex]
    if (effect?.kind === 'choose-one') {
      const context: EffectContext = {
        sourcePlayerId: playerId,
        sourceInstanceId: battle.attackerInstanceId,
      }
      if (!effect.modes.some((mode) =>
        isChooseOneModePlayable(state, context, mode.effects),
      )) {
        return withBattlePendingReason({
          state: applyGameCommand(state, {
            kind: 'resolve-attack-effect',
            playerId,
            targetIds: [],
          }),
          action: 'resolve-attack-effect',
          description: `${state.players[playerId].name}略過目前無法執行的攻擊後續效果。`,
        }, 'choose-one', battle.attackerInstanceId, effect)
      }
      const modeIndex = chooseAiEffectMode(
        state,
        context,
        effect,
        universal.enabled
          ? universal.preferredModeIndices(effect, battle.attackerInstanceId)
          : [],
      )
      return withBattlePendingReason({
        state: applyGameCommand(state, {
          kind: 'resolve-choose-one',
          playerId,
          modeIndex,
        }),
        action: 'resolve-attack-effect',
        description: `${state.players[playerId].name}選擇攻擊後續效果模式。`,
      }, 'choose-one', battle.attackerInstanceId, effect)
    }
    const targetIds = chooseAttackEffectTargets(
      state,
      playerId,
      battle,
      effect,
      universal,
    )
    return withBattlePendingReason({
      state: applyGameCommand(state, {
        kind: 'resolve-attack-effect',
        playerId,
        targetIds,
      }, { shuffleSeed }),
      action: 'resolve-attack-effect',
      description:
        targetIds.length > 0
          ? `${state.players[playerId].name}結算攻擊後續效果。`
          : `${state.players[playerId].name}略過攻擊後續效果。`,
    }, 'effect-target', battle.attackerInstanceId, effect)
  }

  if (battle.stage === 'damage') {
    const damagePlayerId = battle.damagePlayerId ?? battle.defenderPlayerId
    return withBattlePendingReason({
      state: applyGameCommand(state, {
        kind: 'resolve-next-damage',
        playerId: damagePlayerId,
      }),
      action: 'resolve-damage',
      description: '依序翻開並結算下一張 HP 卡。',
    }, 'multi-stage', battle.attackerInstanceId)
  }

  if (
    battle.stage === 'flip' &&
    (battle.damagePlayerId ?? battle.defenderPlayerId) === playerId
  ) {
    const revealed = battle.revealedHpCard
    const discardCount = revealed?.flip?.cost.discardHand ?? 0
    const flipCost = { ...revealed?.flip?.cost, handCostDestination: revealed?.flip?.handCostDestination ?? revealed?.flip?.cost.handCostDestination }
    // R7: Lv.3+ 優先棄「捨得丟」的卡（手牌品質最低的），而不是照手牌
    // 順序砍前 N 張——後者等於把要不要丟到關鍵卡交給手牌排列運氣。
    const discardCandidates = useR7
      ? getDiscardHandCostCandidates(
          flipCost,
          state.players[playerId].hand,
          revealed?.instanceId,
        ).sort(
          (a, b) => handCardDiscardValue(a) - handCardDiscardValue(b),
        )
      : getDiscardHandCostCandidates(
          flipCost,
          state.players[playerId].hand,
          revealed?.instanceId,
        )
    const discardHandIds = universal.enabled
      ? universal.orderCostIds(
          discardCandidates.map((card) => card.instanceId),
          discardCount,
        )
      : discardCandidates
          .slice(0, discardCount)
          .map((card) => card.instanceId)
    const flipContext: EffectContext = {
      sourcePlayerId: playerId,
      sourceInstanceId: revealed?.instanceId ?? '',
      sourceCardName: revealed?.name ?? '',
    }
    const chooseOneEffect = revealed?.flip?.effects.find(
      (effect): effect is Extract<CardEffect, { kind: 'choose-one' }> =>
        effect.kind === 'choose-one',
    )
    const chooseOneModeIndex = chooseOneEffect
      ? chooseAiEffectMode(
          state,
          flipContext,
          chooseOneEffect,
          universal.enabled
            ? universal.preferredModeIndices(chooseOneEffect, revealed?.instanceId)
            : [],
        )
      : undefined
    const expandedFlipEffects = revealed?.flip
      ? chooseOneEffect && chooseOneModeIndex !== undefined
        ? expandChooseOne(
            revealed.flip.effects,
            revealed.flip.effects.indexOf(chooseOneEffect),
            chooseOneModeIndex,
          )
        : revealed.flip.effects
      : []
    const hpFlip = revealed?.flip
    // A publicly blocked, pure HP benefit does not justify an ordinary paid discard.
    // Preserve other effects and special costs that may still provide value.
    const blockedPureHpDiscard = Boolean(state.preventHpGainThisTurn?.[playerId]) &&
      hpFlip !== undefined && !battle.detachedFlip && hpFlip.effects.length === 0 &&
      !hpFlip.attachedHpAlternateTarget && !hpFlip.handCostDestination &&
      (hpFlip.cost.discardHand ?? 0) > 0 &&
      Object.entries(hpFlip.cost).every(([key, value]) =>
        value === undefined || key === 'energy' || key === 'discardHand') &&
      Object.values(hpFlip.cost.energy ?? {}).every(value => (value ?? 0) === 0)
    const hasActivatableEffect = Boolean(revealed?.flip) &&
      (((revealed?.flip?.attachedHpBonus ?? 0) > 0 && !blockedPureHpDiscard) ||
        expandedFlipEffects.some((effect) =>
          isEffectConditionMet(state, flipContext, effect),
        ))
    const sharedSelection = revealed?.flip
      ? chooseSharedEffectTargets(
          state,
          flipContext,
          expandedFlipEffects,
          universal,
        )
      : { valid: true as const }
    let effectTargetIds: string[] | undefined
    let thenTargetIds: string[] | undefined
    const chainedSupportToHand = expandedFlipEffects.find(
      (candidate): candidate is Extract<CardEffect, { kind: 'support-to-hand' }> =>
        candidate.kind === 'support-to-hand' &&
        candidate.thenEffects?.some(
          (thenEffect) =>
            thenEffect.kind === 'hand-to-support' &&
            thenEffect.sameAmountAsPreviousEffect,
        ) === true,
    )
    if (chainedSupportToHand) {
      // BS9-053 has two independent selections: first return N supports,
      // then place the same N green hand cards. Choose the first selection
      // only when the post-return hand can satisfy the second one.
      const supportCandidates = getEffectSelectionCandidates(
        state,
        flipContext,
        chainedSupportToHand,
      )
      const supportCandidateIds = supportCandidates.map((card) => card.instanceId)
      const selectionLimits = getEffectSelectionLimits(chainedSupportToHand)
      const thenTemplate = chainedSupportToHand.thenEffects?.find(
        (thenEffect) =>
          thenEffect.kind === 'hand-to-support' &&
          thenEffect.sameAmountAsPreviousEffect,
      )
      if (selectionLimits && thenTemplate?.kind === 'hand-to-support') {
        const minimum = selectionLimits.min
        const maximum = Math.min(selectionLimits.max, supportCandidateIds.length)
        for (let count = maximum; count >= minimum; count -= 1) {
          const selectedSupportIds = universal.enabled
            ? universal.selectEffectTargetIds(
                chainedSupportToHand,
                supportCandidateIds,
                count,
              )
            : supportCandidateIds.slice(0, count)
          const selectedSupportSet = new Set(selectedSupportIds)
          const returnedCards = state.players[playerId].supportArea
            .filter((support) => selectedSupportSet.has(support.card.instanceId))
            .map((support) => support.card)
          if (returnedCards.length !== count) continue
          const stateAfterReturn: GameState = {
            ...state,
            players: {
              ...state.players,
              [playerId]: {
                ...state.players[playerId],
                supportArea: state.players[playerId].supportArea.filter(
                  (support) => !selectedSupportSet.has(support.card.instanceId),
                ),
                hand: [...state.players[playerId].hand, ...returnedCards],
              },
            },
          }
          const resolvedThen = {
            ...thenTemplate,
            amount: count,
            sameAmountAsPreviousEffect: undefined,
          }
          const handCandidates = getEffectSelectionCandidates(
            stateAfterReturn,
            flipContext,
            resolvedThen,
          )
          if (handCandidates.length < count) continue
          const handCandidateIds = handCandidates.map((card) => card.instanceId)
          const selectedHandIds = universal.enabled
            ? universal.selectEffectTargetIds(resolvedThen, handCandidateIds, count)
            : handCandidateIds.slice(0, count)
          if (selectedHandIds.length !== count) continue
          effectTargetIds = selectedSupportIds
          thenTargetIds = selectedHandIds
          break
        }
        if (effectTargetIds === undefined) {
          // The effect is optional; selecting zero is the only legal way to
          // resolve it when no same-sized replacement set exists.
          effectTargetIds = []
          thenTargetIds = []
        }
      }
    }
    const canActivate = hasActivatableEffect &&
      discardHandIds.length === discardCount &&
      sharedSelection.valid &&
      !(useR7 && shouldSkipHpFlipForFatalRefresh(view,battle,discardHandIds,Boolean(state.preventHpGainThisTurn?.[playerId])))
    const targetIds = sharedSelection.targetIds
    return withBattlePendingReason({
      state: applyGameCommand(state, {
        kind: 'resolve-flip',
        playerId,
        activate: canActivate,
        discardHandIds: canActivate ? discardHandIds : [],
        chooseOneModeIndex,
        targetIds,
        effectTargetIds,
        thenTargetIds,
      }),
      action: 'resolve-flip',
      revealedCard: revealed ?? undefined,
      description: canActivate
        ? `${state.players[playerId].name}發動${revealed?.name ?? 'FLIP'}。`
        : `${state.players[playerId].name}略過 FLIP。`,
    }, 'flip', revealed?.instanceId, expandedFlipEffects[0])
  }

  if (battle.stage === 'trap' && battle.defenderPlayerId === playerId) {
    // 對手指攻回應技能（BS5-081 Squid Ink Cookie）優先於陷阱／阻擋者：
    // 陷阱或阻擋者會把回應窗關閉（stage → 'damage'），對手指攻回應不會。
    // AI 只在本張餅乾正是攻擊目標且會被擊昏時使用，避免無意義消耗手牌。
    const attackResponseCandidates = getAttackResponseSkillCandidates(
      state,
      playerId,
    )
    const targetCookie = state.players[playerId].battleArea.find(
      (cookie) => cookie.card.instanceId === battle.targetInstanceId,
    )
    const targetWouldFaint =
      targetCookie && targetCookie.hpCards.length <= battle.remainingDamage
    const attackResponse =
      targetWouldFaint
        ? attackResponseCandidates.find(
            (cookie) => cookie.card.instanceId === battle.targetInstanceId,
          ) ?? attackResponseCandidates[0]
        : undefined
    if (attackResponse) {
      const skill = attackResponse.card.skill!
      const supportCandidates = getSupportEffectCandidates(state, { sourcePlayerId: playerId, sourceInstanceId: attackResponse.card.instanceId }, { side: 'self', keyword: skill.cost.supportToTrashKeyword }).map(entry => entry.card.instanceId)
      const supportToTrashIds = universal.enabled
        ? universal.orderCostIds(supportCandidates, skill.cost.supportToTrash ?? 0)
        : supportCandidates.slice(0, skill.cost.supportToTrash ?? 0)
      const hand = state.players[playerId].hand
      const discardHandIds = universal.enabled
        ? universal.orderCostIds(
            hand.map((card) => card.instanceId),
            skill.cost?.discardHand ?? 0,
          )
        : hand
            .slice(0, skill.cost?.discardHand ?? 0)
            .map((card) => card.instanceId)
      const trashToDeckCandidates = getTrashToDeckCostCandidates(
        skill.cost ?? {},
        state.players[playerId].discardPile,
      )
      const trashToDeckIds = universal.enabled
        ? universal.orderCostIds(
            trashToDeckCandidates.map((card) => card.instanceId),
            skill.cost?.trashToDeck?.count ?? 0,
          )
        : trashToDeckCandidates
            .slice(0, skill.cost?.trashToDeck?.count ?? 0)
            .map((card) => card.instanceId)
      return withBattlePendingReason({
        state: applyGameCommand(state, {
          kind: 'play-attack-response',
          playerId,
          sourceInstanceId: attackResponse.card.instanceId,
          discardHandIds,
          trashToDeckIds,
          supportToTrashIds,
        }),
        action: 'play-attack-response',
        revealedCard: attackResponse.card,
        description: `${state.players[playerId].name}發動${attackResponse.card.name}的對手指攻回應技能。`,
      }, 'attack-response', attackResponse.card.instanceId, skill.effects[0])
    }

    const payableTrapCandidates = getTrapCandidates(state, playerId).filter(candidate=>{
      if(!candidate.trap)return false
      const option=getPlayableTrapCostOption(state,playerId,candidate.trap,candidate.instanceId)
      return option!==null&&selectSafeHandBreakPayment(state,playerId,option.cost,candidate.instanceId,
        state.players[playerId].hand.map(card=>card.instanceId))!==null
    })
    // 公開見證明確不存在時，各等級都應保留可支付的陷阱；低等級的簡化
    // 策略不能把「可發動」誤當成「效果會成立」。此守衛不讀取隱藏資訊，
    // 並只排除所有根效果都會無條件 no-op 的純能量陷阱。
    const trapCandidates = payableTrapCandidates.filter(candidate =>
      candidate.trap !== undefined &&
      !hasOnlyUnmetPublicBattleColorCondition(state, playerId, candidate),
    )

    let trapCard: GameCard | undefined
    let selectedTrapDiscardHandIds: string[] | undefined
    let selectedTrapTrashBattleCookieIds: string[] | undefined
    if (useR7 && trapCandidates.length > 0) {
      // R7: Lv.3+ 評估所有陷阱候選，選最高分
      let bestScore = -Infinity
      let bestCandidate: GameCard | undefined
      let bestCandidateDiscardHandIds: string[] | undefined
      let bestCandidateTrashBattleCookieIds: string[] | undefined
      for (const candidate of trapCandidates) {
        if (!candidate.trap) continue
        const candidateCost = getPlayableTrapCostOption(
          state,
          playerId,
          candidate.trap,
          candidate.instanceId,
        )
        if (!candidateCost) continue
        const candidateSupports = state.players[playerId].supportArea
        const candidateOrderedSupports = universal.enabled
          ? universal.orderPaymentIds(candidateSupports.map(support => support.card.instanceId))
              .map(instanceId => candidateSupports.find(
                support => support.card.instanceId === instanceId,
              )!)
          : candidateSupports
        const candidatePaymentIds = selectEnergyPayment(
          candidateCost.cost.energy ?? candidateCost.cost,
          candidateOrderedSupports,
        ) ?? []
        const candidateDiscardHandIds = selectTrapDiscardHandPaymentIds(
          state,
          playerId,
          candidate,
          candidateCost.cost,
          universal,
        )
        if (!candidateDiscardHandIds) continue
        const candidateTrashBattleCookieIds = selectTrapBattleCookiePaymentIds(
          state,
          playerId,
          candidate,
          candidateCost.cost,
          universal,
        )
        const baseScore = evaluateTrapWorth(
          state,
          playerId,
          candidate,
          battle,
          candidatePaymentIds,
          universal,
          candidateDiscardHandIds,
          candidateTrashBattleCookieIds,
        )
        // R7 仍是陷阱是否值得支付的主要判斷；G5 只用一個有上限的
        // TacticalPlan 加成處理接近候選，避免 setup／payoff 分數取代
        // 規則層的保命與代價評估，也不讓公開策略來源造成硬門檻誤判。
        const planBonus = universal.enabled
          ? Math.min(12, universal.tacticalPlanValue(candidate.instanceId))
          : 0
        const score = baseScore + planBonus
        if (score > bestScore) {
          bestScore = score
          bestCandidate = candidate
          bestCandidateDiscardHandIds = candidateDiscardHandIds
          bestCandidateTrashBattleCookieIds = candidateTrashBattleCookieIds
        }
      }
      // R7: evaluateTrapWorth 的分數已經把代價（能量／棄牌／送battle cookie）
      // 扣進去了，所以「淨值是否為正」本身就是該不該發動的判斷依據。
      // 原本只在目標明顯無價值（Lv.1 且 HP1）時才檢查分數，代表任何非
      // 垃圾目標、就算陷阱代價明顯大於保護到的價值，也會無條件發動——
      // 等於陷阱評分只在「要不要浪費在雜牌上」時有作用，其餘時候形同虛設。
      // 改成統一門檻：分數低於 TRAP_SKIP_THRESHOLD 一律跳過，垃圾目標會
      // 自然因為 lowValueWastePenalty 落在門檻以下，不需要再另外判斷。
      const standaloneDamageValue = bestCandidate?.trap
        ? getTrapDamageTradeValue(state, playerId, bestCandidate)
        : 0
      const skipThreshold = standaloneDamageValue > 0 ? 0 : TRAP_SKIP_THRESHOLD
      if (bestScore < skipThreshold) {
        trapCard = undefined
      } else {
        trapCard = bestCandidate
        selectedTrapDiscardHandIds = bestCandidateDiscardHandIds
        selectedTrapTrashBattleCookieIds = bestCandidateTrashBattleCookieIds
      }
    } else {
      trapCard = trapCandidates[0]
    }

    const r7Skipped = useR7 && payableTrapCandidates.length > 0 && !trapCard

    if (trapCard?.trap) {
      const playableCost = getPlayableTrapCostOption(
        state,
        playerId,
        trapCard.trap,
        trapCard.instanceId,
      )
      if (!playableCost) {
        return withBattlePendingReason({
          state: applyGameCommand(state, { kind: 'skip-trap', playerId }),
          action: 'play-trap',
          description: `${state.players[playerId].name}無法支付陷阱代價。`,
        }, 'trap', trapCard.instanceId, trapCard.trap.effects[0])
      }
      const paidCost = playableCost.cost
      const supports = state.players[playerId].supportArea
      const orderedSupports = universal.enabled
        ? universal.orderPaymentIds(supports.map((support) => support.card.instanceId))
            .map((instanceId) => supports.find(
              (support) => support.card.instanceId === instanceId,
            )!)
        : supports
      const paymentIds = selectEnergyPayment(
        paidCost.energy ?? paidCost,
        orderedSupports,
      ) ?? []
      const discardHandIds = selectedTrapDiscardHandIds ??
        selectTrapDiscardHandPaymentIds(state, playerId, trapCard, paidCost, universal)
      if (!discardHandIds) {
        return withBattlePendingReason({
          state: applyGameCommand(state, { kind: 'skip-trap', playerId }),
          action: 'play-trap',
          description: `${state.players[playerId].name}無法支付陷阱代價。`,
        }, 'trap', trapCard.instanceId, trapCard.trap.effects[0])
      }
      const trashBattleCandidateIds = getTrashBattleCookieCostCandidates(
        paidCost,
        state.players[playerId].battleArea,
        trapCard.instanceId,
      ).map(cookie => cookie.card.instanceId)
      const trashBattleCookieIds = selectedTrapTrashBattleCookieIds ??
        selectTrapBattleCookiePaymentIds(
          state,
          playerId,
          trapCard,
          paidCost,
          universal,
        )
      if (trashBattleCookieIds.length !== (paidCost.trashBattleCookie?.count ?? 0) ||
        trashBattleCookieIds.some(instanceId => !trashBattleCandidateIds.includes(instanceId))) {
        return withBattlePendingReason({
          state: applyGameCommand(state, { kind: 'skip-trap', playerId }),
          action: 'play-trap',
          description: `${state.players[playerId].name}無法選擇合法的戰鬥區餅乾代價。`,
        }, 'trap', trapCard.instanceId, trapCard.trap.effects[0])
      }
      const rescueEffectTargets = useR7
        ? getTrapRescueEffectTargets(
            state,
            playerId,
            trapCard,
            battle,
            paymentIds,
            universal,
            discardHandIds,
            trashBattleCookieIds,
          )
        : null
      // 優先以當前攻擊者作為陷阱目標（減攻擊／防昏厥類陷阱才會作用在實際攻擊者身上）。
      const trapTargets = getTrapTargetCandidates(
        state,
        playerId,
        trapCard.instanceId,
      )
      const preferredTarget =
        trapTargets.find(
          (target) => target.card.instanceId === battle.attackerInstanceId,
        ) ?? trapTargets[0]
      // getTrapTargetCandidates 與 getTrapSelfTargetCandidates 各自依真正有
      // target 的子效果推導合法候選；不可再假設 effects[0] 就是該子效果，
      // 否則多段陷阱會拿錯效果做通用評分。
      const trapTargetEffect = trapCard.trap.effects.find(
        (effect) =>
          'target' in effect && effect.target?.side !== 'self',
      )
      const trapTargetEffectIndex = trapCard.trap.effects.indexOf(trapTargetEffect!)
      const rescueTargetIds = trapTargetEffectIndex >= 0
        ? rescueEffectTargets?.[trapTargetEffectIndex]
        : null
      const targetIds = rescueTargetIds ?? (trapTargetEffect?.kind === 'damage-all' && trapTargetEffect.sequential
        ? getEffectTargetCandidatesForEffect(state, {
            sourcePlayerId: playerId, sourceInstanceId: trapCard.instanceId,
          }, trapTargetEffect).map(cookie => cookie.card.instanceId)
        : universal.enabled
        ? trapTargetEffect && 'target' in trapTargetEffect && trapTargetEffect.target
          ? (() => {
              const candidateIds = trapTargets.map((target) => target.card.instanceId)
              const selected = savingTrapTarget(state, playerId, trapCard.instanceId, trapTargetEffect, candidateIds,
                Math.min(trapTargetEffect.target.max, candidateIds.length)) ?? universal.selectEffectTargetIds(
                trapTargetEffect,
                candidateIds,
                Math.min(trapTargetEffect.target.max, candidateIds.length),
                getPublicEffectDamageByTarget(state, playerId,
                  { sourcePlayerId: playerId, sourceInstanceId: trapCard.instanceId }, trapTargetEffect, candidateIds),
              )
              return selected.length >= trapTargetEffect.target.min ? selected : []
            })()
          : []
        : preferredTarget
          ? [preferredTarget.card.instanceId]
          : [])
      const selfTargetCandidates = getTrapSelfTargetCandidates(
        state,
        playerId,
        trapCard.instanceId,
      )
      const trapSelfTargetEffect = trapCard.trap.effects.find(
        (effect) =>
          ('target' in effect && effect.target?.side === 'self') ||
          (effect.kind === 'transfer-hp' && effect.receiverTarget?.side === 'self'),
      )
      const trapSelfTargetSelector =
        trapSelfTargetEffect?.kind === 'transfer-hp' && trapSelfTargetEffect.receiverTarget
          ? trapSelfTargetEffect.receiverTarget
          : trapSelfTargetEffect && 'target' in trapSelfTargetEffect
            ? trapSelfTargetEffect.target
            : undefined
      const trapSelfTargetEffectIndex = trapCard.trap.effects.indexOf(trapSelfTargetEffect!)
      const rescueSelfTargetIds = trapSelfTargetEffectIndex >= 0
        ? rescueEffectTargets?.[trapSelfTargetEffectIndex]
        : null
      const selfTargetIds = rescueSelfTargetIds ?? (universal.enabled
        ? trapSelfTargetEffect && trapSelfTargetSelector
          ? (() => {
              const candidateIds = selfTargetCandidates.map((target) => target.card.instanceId)
              const selected = universal.selectEffectTargetIds(
                trapSelfTargetEffect,
                candidateIds,
                Math.min(trapSelfTargetSelector.max, candidateIds.length),
              )
              return selected.length >= trapSelfTargetSelector.min ? selected : []
            })()
          : []
        : selfTargetCandidates.length > 0
          ? [selfTargetCandidates[0].card.instanceId]
          : [])
      const supportTrashEffect = trapCard.trap.effects.find(
        (effect) => effect.kind === 'support-to-trash',
      )
      const supportTrashCandidateIds = supportTrashEffect?.kind === 'support-to-trash'
        ? state.players[playerId].supportArea
            .map((support) => support.card.instanceId)
        : []
      const supportTrashIds = supportTrashEffect?.kind === 'support-to-trash'
        ? universal.enabled
          ? universal.orderCostIds(supportTrashCandidateIds, supportTrashEffect.amount)
          : supportTrashCandidateIds.slice(0, supportTrashEffect.amount)
        : []
      const supportToHandEffect = trapCard.trap.effects.find(
        (effect) => effect.kind === 'support-to-hand',
      )
      const supportToHandCandidateIds = supportToHandEffect?.kind === 'support-to-hand'
        ? state.players[playerId].supportArea
              .slice()
              .sort((a, b) => {
                if (a.rested !== b.rested) return a.rested ? -1 : 1
                return 0
              })
              .map((support) => support.card.instanceId)
        : []
      const supportToHandIds = supportToHandEffect?.kind === 'support-to-hand'
        ? universal.enabled
          ? universal.orderCostIds(supportToHandCandidateIds, supportToHandEffect.amount)
          : supportToHandCandidateIds.slice(0, supportToHandEffect.amount)
        : []
      const handToSupportEffect = trapCard.trap.effects.find(
        (effect) => effect.kind === 'hand-to-support',
      )
      const handToSupportCandidateIds = handToSupportEffect?.kind === 'hand-to-support'
        ? state.players[playerId].hand
              .filter((card) => card.instanceId !== trapCard.instanceId)
              .slice()
              .sort((a, b) => {
                const aCookie = a.type === 'cookie' ? 1 : 0
                const bCookie = b.type === 'cookie' ? 1 : 0
                if (aCookie !== bCookie) return aCookie - bCookie
                return 0
              })
              .map((card) => card.instanceId)
        : []
      const handToSupportIds = handToSupportEffect?.kind === 'hand-to-support'
        ? universal.enabled
          ? universal.selectEffectTargetIds(
              handToSupportEffect,
              handToSupportCandidateIds,
              handToSupportEffect.amount,
            )
          : handToSupportCandidateIds.slice(0, handToSupportEffect.amount)
        : []
      const handToBreakCost = paidCost.handToBreakArea
      const handToBreakCandidateIds = state.players[playerId].hand
        .filter(
          (card) =>
            card.instanceId !== trapCard.instanceId &&
            !discardHandIds.includes(card.instanceId) &&
            card.type === 'cookie' &&
            (!handToBreakCost?.energyColor ||
              card.energyColor === handToBreakCost.energyColor),
        )
        // 進休息區等於送對手 break 進度，優先付等級最低的。
        .sort(
          (left, right) =>
            (left.type === 'cookie' ? left.level : 0) -
            (right.type === 'cookie' ? right.level : 0),
        )
        .map((card) => card.instanceId)
      const handToBreakIds = selectSafeHandBreakPayment(
        state,playerId,paidCost,trapCard.instanceId,
        universal.enabled?universal.orderCostIds(handToBreakCandidateIds,handToBreakCandidateIds.length):handToBreakCandidateIds,
      )
      if (handToBreakIds===null) {
        return withBattlePendingReason({
          state: applyGameCommand(state, { kind: 'skip-trap', playerId }),
          action: 'play-trap',
          description: `${state.players[playerId].name}無法支付陷阱代價。`,
        }, 'trap', trapCard.instanceId, trapCard.trap.effects[0])
      }

      const trashCookieToBreakAreaCandidateIds = paidCost.trashCookieToBreakArea
        ? getTrashCookieToBreakAreaCostCandidates(
            paidCost,
            state.players[playerId].discardPile,
          ).map((card) => card.instanceId)
        : []
      const trashCookieToBreakAreaIds = paidCost.trashCookieToBreakArea
        ? universal.enabled
          ? universal.orderCostIds(
              trashCookieToBreakAreaCandidateIds,
              paidCost.trashCookieToBreakArea.count,
            )
          : trashCookieToBreakAreaCandidateIds.slice(
              0,
              paidCost.trashCookieToBreakArea.count,
            )
        : []
      if (
        paidCost.trashCookieToBreakArea &&
        trashCookieToBreakAreaIds.length < paidCost.trashCookieToBreakArea.count
      ) {
        return withBattlePendingReason({
          state: applyGameCommand(state, { kind: 'skip-trap', playerId }),
          action: 'play-trap',
          description: `${state.players[playerId].name}無法支付陷阱替代代價。`,
        }, 'trap', trapCard.instanceId, trapCard.trap.effects[0])
      }
      const trashToDeckEffect = trapCard.trap.effects.find(
        (effect) => effect.kind === 'trash-to-deck',
      )
      const trashToDeckCandidateIds =
        trashToDeckEffect?.kind === 'trash-to-deck'
          ? getTrashToDeckCandidates(
              state,
              { sourcePlayerId: playerId, sourceInstanceId: trapCard.instanceId },
              trashToDeckEffect,
            )
              .map((card) => card.instanceId)
          : []
      const trashToDeckIds = trashToDeckEffect?.kind === 'trash-to-deck'
        ? universal.enabled
          ? universal.orderCostIds(trashToDeckCandidateIds, trashToDeckEffect.max)
          : trashToDeckCandidateIds.slice(0, trashToDeckEffect.max)
        : []

      // 多段陷阱的每個選擇效果各自建立目標欄位。沒有這層時，AI 為第一段
      // modify-attack 選出的對手 Cookie 會被沿用到後段 trash-to-hand／
      // set-active，造成「不在合法範圍」或「Invalid support target」。
      const hasIndependentTrapSelection = trapCard.trap.effects.some(
        (effect) =>
          ('target' in effect && effect.target?.allMatching === true) ||
          (effect.kind === 'modify-attack' && effect.target.side === 'self') ||
          effect.kind === 'support-to-trash' ||
          effect.kind === 'break-to-battle' ||
          effect.kind === 'support-to-battle' ||
          effect.kind === 'trash-to-battle' ||
          effect.kind === 'trash-to-support' ||
          effect.kind === 'trash-to-hand' ||
          effect.kind === 'equipped-to-hp' ||
          effect.kind === 'hand-to-support' ||
          effect.kind === 'break-to-hand-by-level-sum' ||
          effect.kind === 'trash-to-deck' ||
          effect.kind === 'prevent-support-active-next-phase' ||
          (effect.kind === 'reveal-hand' && effect.selectCard) ||
          (effect.kind === 'set-active' && effect.selectable) ||
          effect.kind === 'rest-support' ||
          effect.kind === 'hand-to-battle' ||
          effect.kind === 'opponent-trash-to-break' ||
          effect.kind === 'trash-to-break',
      )
      const targetSides = trapCard.trap.effects.flatMap(effect =>
        'target' in effect && effect.target ? [effect.target.side] : [],
      )
      const hasDifferentTargetSides = new Set(targetSides).size > 1
      const effectTargets = rescueEffectTargets
        ? trapCard.trap.effects.map((effect, index) =>
            rescueEffectTargets[index] ?? selectTrapEffectTargets(
              state,
              playerId,
              trapCard.instanceId,
              effect,
              universal,
            ),
          )
        : hasIndependentTrapSelection || hasDifferentTargetSides
        ? trapCard.trap.effects.map((effect) =>
            selectTrapEffectTargets(
              state,
              playerId,
              trapCard.instanceId,
              effect,
              universal,
            ),
          )
        : undefined

      if (
        supportTrashEffect?.kind === 'support-to-trash' &&
        supportTrashIds.length < supportTrashEffect.amount
      ) {
        return withBattlePendingReason({
          state: applyGameCommand(state, { kind: 'skip-trap', playerId }),
          action: 'play-trap',
          description: `${state.players[playerId].name}無法支付陷阱後續代價。`,
        }, 'trap', trapCard.instanceId, trapCard.trap.effects[0])
      }

      if (
        supportToHandEffect?.kind === 'support-to-hand' &&
        supportToHandIds.length < supportToHandEffect.amount
      ) {
        return withBattlePendingReason({
          state: applyGameCommand(state, { kind: 'skip-trap', playerId }),
          action: 'play-trap',
          description: `${state.players[playerId].name}無法支付陷阱後續代價。`,
        }, 'trap', trapCard.instanceId, trapCard.trap.effects[0])
      }

      return withBattlePendingReason({
        state: applyGameCommand(state, {
          kind: 'play-trap',
          playerId,
          trapInstanceId: trapCard.instanceId,
          costOptionIndex: playableCost.index,
          paymentIds,
          targetIds,
          effectTargets,
          selfTargetIds,
          supportTrashIds,
          supportToHandIds,
          handToSupportIds,
          discardHandIds,
          handToBreakIds,
          positionCostTargetIds: getBattleCookiePositionCostCandidates(playableCost.cost, state.players[playerId].battleArea, trapCard.instanceId).slice(0, playableCost.cost.battleCookiePosition?.count ?? 0).map(cookie => cookie.card.instanceId),
          trashBattleCookieIds,
          trashCookieToBreakAreaIds,
          trashToDeckIds,
        }),
        action: 'play-trap',
        revealedCard: trapCard,
        description: `${state.players[playerId].name}發動${trapCard.name}。`,
      }, 'trap', trapCard.instanceId, trapCard.trap.effects[0])
    }

    const blockerCandidates = getBlockerCandidates(state, playerId)
    if (blockerCandidates.length > 0) {
      let blocker: CookieInBattle | undefined
      if (useR7) {
        // R7: 評估每個候選 Blocker，只在淨值為正時才擋——避免用高價值
        // 餅乾去擋一次原目標其實扛得住的攻擊、或白白犧牲擋得住的
        // Blocker 去救一隻其實會死的雜牌。
        let bestScore = -Infinity
        let bestCandidate: CookieInBattle | undefined
        for (const candidate of blockerCandidates) {
          const baseScore = evaluateBlockWorth(state, playerId, candidate, battle)
          // Blocker 的救援／犧牲淨值優先；TacticalPlan 僅作 bounded tie-break
          // 加成，讓已確認 payoff 的公開餅乾在同等防守價值時優先保留。
          const planBonus = universal.enabled
            ? Math.min(12, universal.tacticalPlanValue(candidate.card.instanceId))
            : 0
          const score = baseScore + planBonus
          if (score > bestScore) {
            bestScore = score
            bestCandidate = candidate
          }
        }
        blocker = bestScore >= BLOCK_SKIP_THRESHOLD ? bestCandidate : undefined
      } else {
        blocker = blockerCandidates[0]
      }

      if (blocker) {
        const skill = blocker.card.skill!
        const supports = state.players[playerId].supportArea
        const orderedSupports = universal.enabled
          ? universal.orderPaymentIds(supports.map((support) => support.card.instanceId))
              .map((instanceId) => supports.find(
                (support) => support.card.instanceId === instanceId,
              )!)
          : supports
        const paymentIds = selectEnergyPayment(
          skill.cost.energy ?? skill.cost,
          orderedSupports,
        ) ?? []
        const handCandidates = getDiscardHandCostCandidates(skill.cost, state.players[playerId].hand, blocker.card.instanceId)
          .map(card => card.instanceId)
        const discardHandIds = universal.enabled
          ? universal.orderCostIds(handCandidates, skill.cost.discardHand ?? 0)
          : handCandidates.slice(0, skill.cost.discardHand ?? 0)
        return withBattlePendingReason({
          state: applyGameCommand(state, {
            kind: 'play-blocker',
            playerId,
            sourceInstanceId: blocker.card.instanceId,
            paymentIds,
            ...(discardHandIds.length > 0 ? { discardHandIds } : {}),
          }),
          action: 'play-blocker',
          revealedCard: blocker.card,
          description: `${state.players[playerId].name}使用${blocker.card.name}阻擋攻擊。`,
        }, 'blocker', blocker.card.instanceId, skill.effects[0])
      }
    }

    return withBattlePendingReason({
      state: applyGameCommand(state, { kind: 'skip-trap', playerId }),
      action: 'play-trap',
      description: `${state.players[playerId].name}未發動陷阱。`,
      r7TrapSkip: r7Skipped,
    }, 'trap', battle.attackerInstanceId)
  }

  return {
    state,
    action: 'idle',
    description: `${state.players[battle.defenderPlayerId].name}等待戰鬥回應。`,
  }
}
