import { GameRuleError } from './errors'
import { collectBreakEntryCostEffects } from './break-effect-triggers'
import { selectEnergyPayment, validateEnergyPayment } from './energy'
import {
  executeCardEffect,
  getBreakCount,
  getBreakToBattleCandidates,
  getSupportToBattleCandidates,
  getBreakToHandBySumCandidates,
  findBreakToHandBySumSelection,
  getHandToBreakBySumCandidates,
  getEffectSelectionCandidates,
  getEffectTargetCandidates,
  getTargetPlayerId,
  isEffectConditionMet,
  isEffectTargeted,
} from './effects'
import { findCardIndex, getOpponentId, updatePlayer } from './helpers'
import { hasBlockingPending } from './pending'
import {
  clearDepartedCookieModifiers,
  recordCookieDepartures,
} from './replacement'
import {
  getDiscardHandCostCandidates,
  getHandCountAfterFixedSkillCost,
  getHpToTrashCostCandidates,
  getHandToBreakAreaCostCandidates,
  getTrashBattleCookieCostCandidates,
  getTrashToDeckBottomCostCandidates,
  payHandToBreakAreaCost,
  isSupportToHandCostCandidate,
  markSupportAreaDecreased,
  payTrashBattleCookieCost,
  validateBattleCookieCostSelection,
} from './skills'
import { finishWithVictory, isSpecialVictoryConditionMet, resolveBreakLevelVictory } from './victory'
import type {
  AbilityCost,
  CardAbility,
  CardEffect,
  EnergyCost,
  GameCard,
  GameState,
  PlayerId,
  PlayerState,
  StageAbility,
} from './types'

const assertMainAction = (state: GameState, playerId: PlayerId) => {
  if (
    state.status !== 'playing' ||
    state.activePlayerId !== playerId ||
    state.phase !== 'main' ||
    hasBlockingPending(state)
  ) {
    throw new GameRuleError('目前無法使用物品或場景卡。')
  }
}

const validateEnergyCostPayment = (
  state: GameState,
  playerId: PlayerId,
  cost: EnergyCost,
  paymentIds: string[],
) => {
  const validation = validateEnergyPayment(
    cost,
    state.players[playerId].supportArea,
    paymentIds,
  )
  if (!validation.valid) {
    throw new GameRuleError(`能量付款不合法：${validation.reason}`)
  }
}

const validateAbilityPayment = (
  state: GameState,
  playerId: PlayerId,
  cost: AbilityCost,
  paymentIds: string[],
) => validateEnergyCostPayment(state, playerId, cost.energy ?? cost, paymentIds)

const restPayments = (
  state: GameState,
  playerId: PlayerId,
  paymentIds: string[],
) => {
  const paymentSet = new Set(paymentIds)
  const player = state.players[playerId]
  return updatePlayer(state, {
    ...player,
    supportArea: player.supportArea.map((support) =>
      paymentSet.has(support.card.instanceId)
        ? { ...support, rested: true }
        : support,
    ),
  })
}

export interface AbilityPaymentOptions {
  paymentIds: string[]
  handToBreakAreaIds?: string[]
  supportToTrashIds?: string[]
  supportToHandIds?: string[]
  discardHandIds?: string[]
  hpToTrashTargetIds?: string[]
  trashBattleCookieIds?: string[]
  trashToDeckBottomIds?: string[]
  sourceInstanceId?: string
}

const canPayAbilityCost = (
  state: GameState,
  playerId: PlayerId,
  cost: AbilityCost,
  sourceInstanceId?: string,
): boolean => {
  const player = state.players[playerId]
  const energyPayment = selectEnergyPayment(
    cost.energy ?? cost,
    player.supportArea,
  )
  if (!energyPayment) return false

  const energyPaymentSet = new Set(energyPayment)
  const remainingSupportCount = player.supportArea.filter(
    (support) => !energyPaymentSet.has(support.card.instanceId),
  ).length
  const supportCost =
    (cost.supportToTrash ?? 0) + (cost.supportToHand ?? 0)
  const availableSupportToHandCount = cost.supportToHandType || cost.supportToHandColor || cost.supportToHandKeyword
    ? player.supportArea.filter(
        (support) =>
          !energyPaymentSet.has(support.card.instanceId) &&
          isSupportToHandCostCandidate(cost, support),
      ).length
    : remainingSupportCount

  const availableDiscardCount = getDiscardHandCostCandidates(
    cost,
    player.hand,
    sourceInstanceId,
  ).length

  return (
    (!cost.stageSourceToTrash ||
      player.stage?.card.instanceId === sourceInstanceId) &&
    remainingSupportCount >= supportCost &&
    availableSupportToHandCount >= (cost.supportToHand ?? 0) &&
    availableDiscardCount >= (cost.discardHand ?? 0) &&
    getTrashToDeckBottomCostCandidates(cost, player.discardPile).length >= (cost.trashToDeckBottom?.count ?? 0) &&
    getTrashBattleCookieCostCandidates(cost, player.battleArea, sourceInstanceId).length >= (cost.trashBattleCookie?.count ?? 0) &&
    getHandToBreakAreaCostCandidates(cost, player.hand, sourceInstanceId).length >= (cost.handToBreakArea?.count ?? 0) &&
    (!cost.discardAllHand || player.hand.length > 0) &&
    (!cost.hpToTrash ||
      getHpToTrashCostCandidates(
        cost,
        player.battleArea,
        sourceInstanceId,
      ).length > 0)
  )
}

const payAbilityCost = (
  state: GameState,
  playerId: PlayerId,
  cost: AbilityCost,
  options: AbilityPaymentOptions,
): GameState => {
  validateAbilityPayment(state, playerId, cost, options.paymentIds)

  if (cost.battleCookiePosition) {
    throw new GameRuleError('此狀態代價尚未支援於物品或場景能力。')
  }
  if (cost.trashToDeck) {
    // BS3-098 目前只出現在餅乾 OnPlay 技能；避免未來 item／stage
    // 沿用 AbilityCost 時把洗回牌庫成本靜默忽略。
    throw new GameRuleError('此代價尚未支援於物品或場景能力。')
  }

  const player = state.players[playerId]
  const trashToDeckBottomIds = options.trashToDeckBottomIds ?? []
  const trashToDeckBottomSet = new Set(trashToDeckBottomIds)
  if (trashToDeckBottomSet.size !== trashToDeckBottomIds.length) {
    throw new GameRuleError('棄牌區放到牌庫底的代價不能重複選同一張卡。')
  }
  if (trashToDeckBottomIds.length !== (cost.trashToDeckBottom?.count ?? 0)) {
    throw new GameRuleError(`必須選擇 ${cost.trashToDeckBottom?.count ?? 0} 張棄牌區卡牌放到牌庫底作為代價。`)
  }
  const bottomCandidates = getTrashToDeckBottomCostCandidates(cost, player.discardPile)
  const bottomCards = trashToDeckBottomIds.map(id => {
    const card = bottomCandidates.find(candidate => candidate.instanceId === id)
    if (!card) throw new GameRuleError('選擇的棄牌區放到牌庫底代價不合法。')
    return card
  })
  if (
    cost.stageSourceToTrash &&
    player.stage?.card.instanceId !== options.sourceInstanceId
  ) {
    throw new GameRuleError('來源場景卡不在場景區中。')
  }
  const supportToTrashIds = [...new Set(options.supportToTrashIds ?? [])]
  const supportToHandIds = [...new Set(options.supportToHandIds ?? [])]
  const discardHandIds = [...new Set(options.discardHandIds ?? [])]
  const hpToTrashTargetIds = [...new Set(options.hpToTrashTargetIds ?? [])]
  const handToBreakAreaIds = options.handToBreakAreaIds ?? []
  const handBreakPaidPlayer = payHandToBreakAreaCost(player, cost, handToBreakAreaIds, options.sourceInstanceId ?? '')
  if (handToBreakAreaIds.some(id => discardHandIds.includes(id)) || (cost.discardAllHand && handToBreakAreaIds.length > 0)) {
    throw new GameRuleError('同一張卡不能同時支付兩種費用。')
  }

  if (supportToTrashIds.length !== (options.supportToTrashIds ?? []).length) {
    throw new GameRuleError('支援區垃圾桶費用不能重複選同一張卡。')
  }
  if (supportToHandIds.length !== (options.supportToHandIds ?? []).length) {
    throw new GameRuleError('支援區回手費用不能重複選同一張卡。')
  }
  if (discardHandIds.length !== (options.discardHandIds ?? []).length) {
    throw new GameRuleError('棄手牌費用不能重複選同一張卡。')
  }
  if (hpToTrashTargetIds.length !== (options.hpToTrashTargetIds ?? []).length) {
    throw new GameRuleError('HP 費用不能重複選同一張餅乾。')
  }
  if (supportToTrashIds.length !== (cost.supportToTrash ?? 0)) {
    throw new GameRuleError(`必須將 ${cost.supportToTrash ?? 0} 張支援區卡放入垃圾桶。`)
  }
  if (supportToHandIds.length !== (cost.supportToHand ?? 0)) {
    throw new GameRuleError(`必須將 ${cost.supportToHand ?? 0} 張支援區卡返回手牌。`)
  }
  if (cost.discardAllHand) {
    if (discardHandIds.length > 0) {
      throw new GameRuleError('此代價直接棄置整副手牌，不需要選牌。')
    }
  } else if (
    cost.discardHandAtLeast
      ? discardHandIds.length < (cost.discardHand ?? 0)
      : discardHandIds.length !== (cost.discardHand ?? 0)
  ) {
    throw new GameRuleError(
      cost.discardHandAtLeast
        ? `必須至少棄掉 ${cost.discardHand ?? 0} 張手牌。`
        : `必須棄掉 ${cost.discardHand ?? 0} 張手牌。`,
    )
  }

  const paymentSet = new Set(options.paymentIds)
  const supportToTrashSet = new Set(supportToTrashIds)
  const supportToHandSet = new Set(supportToHandIds)
  if (
    options.paymentIds.some(
      (id) => supportToTrashSet.has(id) || supportToHandSet.has(id),
    ) ||
    supportToTrashIds.some((id) => supportToHandSet.has(id))
  ) {
    throw new GameRuleError('同一張支援區卡不能同時支付多種費用。')
  }

  const selectedSupportToTrash = player.supportArea.filter((support) =>
    supportToTrashSet.has(support.card.instanceId),
  )
  const selectedSupportToHand = player.supportArea.filter((support) =>
    supportToHandSet.has(support.card.instanceId),
  )
  if (selectedSupportToTrash.length !== supportToTrashIds.length) {
    throw new GameRuleError('選擇的支援區垃圾桶費用不合法。')
  }
  if (selectedSupportToHand.length !== supportToHandIds.length) {
    throw new GameRuleError('選擇的支援區回手費用不合法。')
  }
  if (cost.supportToHandType || cost.supportToHandColor || cost.supportToHandKeyword) {
    const invalidSupport = selectedSupportToHand.find(
      (support) => !isSupportToHandCostCandidate(cost, support),
    )
    if (invalidSupport) {
      throw new GameRuleError(
        cost.supportToHandKeyword
          ? `支援區回手費用必須選擇 ${cost.supportToHandKeyword} 卡牌。`
          : cost.supportToHandColor
          ? `支援區回手費用必須選擇 ${cost.supportToHandColor} 能量顏色的卡牌。`
          : `支援區回手費用必須選擇 ${cost.supportToHandType}。`,
      )
    }
  }

  const discardedHandCards = cost.discardAllHand
    ? player.hand
    : player.hand.filter((card) => discardHandIds.includes(card.instanceId))
  if (discardedHandCards.length !== (cost.discardAllHand ? player.hand.length : discardHandIds.length)) {
    throw new GameRuleError('選擇的棄手牌費用不合法。')
  }
  if (cost.discardHandColor) {
    const invalidDiscard = discardedHandCards.find(
      (card) => card.energyColor !== cost.discardHandColor,
    )
    if (invalidDiscard) {
      throw new GameRuleError(
        `棄手牌費用必須選擇 ${cost.discardHandColor} 能量顏色的手牌。`,
      )
    }
  }
  if (cost.discardHandType) {
    const invalidDiscard = discardedHandCards.find(
      (card) => card.type !== cost.discardHandType,
    )
    if (invalidDiscard) {
      throw new GameRuleError(
        `棄手牌費用必須選擇 ${cost.discardHandType} 類型的手牌。`,
      )
    }
  }
  if (cost.discardHandNonCookie) {
    const invalidDiscard = discardedHandCards.find((card) => card.type === 'cookie')
    if (invalidDiscard) {
      throw new GameRuleError('棄手牌費用必須選擇非 Cookie 卡牌。')
    }
  }
  if (cost.hpToTrash && hpToTrashTargetIds.length !== 1) {
    throw new GameRuleError('必須選擇 1 張餅乾支付 HP 費用。')
  }
  if (!cost.hpToTrash && hpToTrashTargetIds.length > 0) {
    throw new GameRuleError('此能力不需要支付 HP 費用。')
  }

  let updatedPlayer: PlayerState = {
    ...player,
    deck: [...player.deck, ...bottomCards],
    supportArea: player.supportArea
      .filter(
        (support) =>
          !supportToTrashSet.has(support.card.instanceId) &&
          !supportToHandSet.has(support.card.instanceId),
      )
      .map((support) =>
        paymentSet.has(support.card.instanceId)
          ? { ...support, rested: true }
          : support,
      ),
    hand: cost.discardAllHand
      ? selectedSupportToHand.map((support) => support.card)
      : [
          ...player.hand.filter(
            (card) => !discardHandIds.includes(card.instanceId) && !handToBreakAreaIds.includes(card.instanceId),
          ),
          ...selectedSupportToHand.map((support) => support.card),
        ],
    discardPile: [
      ...player.discardPile.filter(card => !trashToDeckBottomSet.has(card.instanceId)),
      ...selectedSupportToTrash.map((support) => support.card),
      ...discardedHandCards,
      ...(cost.stageSourceToTrash && player.stage
        ? [player.stage.card]
        : []),
    ],
    ...(cost.stageSourceToTrash ? { stage: null } : {}),
    breakArea: handBreakPaidPlayer.breakArea,
  }

  let departedCount = 0
  let costRecord: GameState['costRecord']
  if (cost.hpToTrash) {
    const target = getHpToTrashCostCandidates(
      cost,
      updatedPlayer.battleArea,
      options.sourceInstanceId,
    ).find((cookie) => cookie.card.instanceId === hpToTrashTargetIds[0])
    if (!target) {
      throw new GameRuleError('選擇的 HP 費用餅乾不合法。')
    }

    const targetIndex = updatedPlayer.battleArea.findIndex(
      (cookie) => cookie.card.instanceId === target.card.instanceId,
    )
    const removeCount = Math.max(
      0,
      cost.hpToTrash.untilRemainingHp !== undefined
        ? target.hpCards.length - cost.hpToTrash.untilRemainingHp
        : (cost.hpToTrash.amount ?? 1),
    )

    // removeCount 為 0（例如 untilRemainingHp 剛好等於目前剩餘 HP）時必須
    // 提前結束：JS 的 slice(-0) 等同 slice(0)，會把整疊 HP 卡當成「被移除」，
    // 導致同一張卡同時留在 hpCards 又被複製進棄牌區。
    if (removeCount === 0) {
      departedCount = 0
      costRecord = {
        hpTrashCookieInstanceId: target.card.instanceId,
        hpTrashTopCardType: undefined,
      }
    } else {
      const removedHpCards = target.hpCards.slice(-removeCount)
      const remainingHpCards = target.hpCards.slice(
        0,
        Math.max(0, target.hpCards.length - removeCount),
      )
      costRecord = {
        hpTrashCookieInstanceId: target.card.instanceId,
        hpTrashTopCardInstanceId:
          removedHpCards[removedHpCards.length - 1]?.instanceId,
        hpTrashTopCardType: removedHpCards[removedHpCards.length - 1]?.type,
      }

      if (remainingHpCards.length === 0) {
        departedCount = 1
        updatedPlayer = {
          ...updatedPlayer,
          battleArea: updatedPlayer.battleArea.filter(
            (_, index) => index !== targetIndex,
          ),
          breakArea: [...updatedPlayer.breakArea, target.card],
          discardPile: [...updatedPlayer.discardPile, ...removedHpCards],
        }
      } else {
        updatedPlayer = {
          ...updatedPlayer,
          battleArea: updatedPlayer.battleArea.map((cookie, index) =>
            index === targetIndex
              ? { ...cookie, hpCards: remainingHpCards }
              : cookie,
          ),
          discardPile: [...updatedPlayer.discardPile, ...removedHpCards],
        }
      }
    }
  }

  const faintCostCookies = cost.trashBattleCookie?.faint
    ? validateBattleCookieCostSelection(updatedPlayer, cost, options.trashBattleCookieIds ?? [], options.sourceInstanceId)
    : []
  const trashBattleCookiePayment = payTrashBattleCookieCost(
    updatedPlayer,
    cost.trashBattleCookie?.faint ? { ...cost, trashBattleCookie: undefined } : cost,
    cost.trashBattleCookie?.faint ? [] : options.trashBattleCookieIds ?? [],
    options.sourceInstanceId,
  )
  updatedPlayer = trashBattleCookiePayment.player
  departedCount += trashBattleCookiePayment.departedCount

  let nextState: GameState = updatePlayer({
    ...state,
    ...(costRecord ? { costRecord } : {}),
  }, updatedPlayer)

  if (supportToTrashIds.length > 0 || supportToHandIds.length > 0) {
    nextState = markSupportAreaDecreased(nextState, playerId, {
      triggerSkill: supportToTrashIds.length > 0,
      trashedCount: supportToTrashIds.length,
    })
  }

  if (departedCount > 0) {
    nextState = recordCookieDepartures(
        clearDepartedCookieModifiers(nextState),
        playerId,
        departedCount,
      )
  }
  if (faintCostCookies.length > 0) {
    nextState = executeCardEffect(nextState, {
      sourcePlayerId: playerId,
      sourceInstanceId: options.sourceInstanceId ?? '',
    }, { kind: 'make-faint', target: { side: 'self', min: faintCostCookies.length, max: faintCostCookies.length } },
    faintCostCookies.map(cookie => cookie.card.instanceId))
  }
  return collectBreakEntryCostEffects(state, nextState, {
    sourcePlayerId: playerId, sourceInstanceId: options.sourceInstanceId ?? '',
  }, cost, options)
}

export const getItemAbility = (card: GameCard): CardAbility | null =>
  card.type === 'item' ? card.item ?? null : null

export const getItemActivateDiscardRequirement = (state: GameState, playerId: PlayerId) => {
  const opponentId = getOpponentId(playerId)
  const requirements = state.players[opponentId].battleArea.flatMap(source => {
    const skill = source.card.skill
    if (!skill || (skill.yourTurn && state.activePlayerId !== opponentId)) return []
    const effects = [...(skill.trigger === 'passive' ? skill.effects : []), ...(skill.passiveEffects ?? [])]
    return effects.filter(effect => effect.kind === 'require-item-activate-discard-hand' && effect.count > 0)
      .map(effect => ({ count: effect.kind === 'require-item-activate-discard-hand' ? effect.count : 0,
        sourcePlayerId: opponentId, sourceInstanceId: source.card.instanceId, sourceCardName: source.card.name }))
  })
  if (requirements.length === 0) return undefined
  // Each opposing printed source contributes its own additional discard.
  return { ...requirements[0], count: requirements.reduce((sum, requirement) => sum + requirement.count, 0), needsRuling: false }
}

export const getEffectiveCardAbilityCost = (
  state: GameState,
  playerId: PlayerId,
  ability: CardAbility,
): AbilityCost => {
  const override = ability.activationCostOverride
  if (
    override?.condition === 'friendly-cookie-fainted-this-turn' &&
    (state.cookiesFaintedThisTurn?.[playerId] ?? 0) > 0
  ) {
    return override.cost
  }
  return ability.cost
}

export const getStageAbility = (
  card: GameCard,
): StageAbility | null =>
  card.type === 'stage' ? card.stageAbility ?? null : null

export interface StageActivationSource {
  ownerId: PlayerId
  stage: NonNullable<PlayerState['stage']>
  ability: StageAbility
}

/**
 * Resolve the Stage card whose Activate effect is being used.  Most Stages
 * belong to the activating player; BS9-118 explicitly allows either player
 * to activate the effect, so the opponent's owner-independent Stage is also
 * considered.  The returned owner is kept separate from the activator so the
 * Stage itself is rested/trashed in the correct player's zone.
 */
export const getStageActivationSource = (
  state: GameState,
  playerId: PlayerId,
): StageActivationSource | null => {
  const candidateOwnerIds: PlayerId[] = [playerId, getOpponentId(playerId)]
  for (const ownerId of candidateOwnerIds) {
    const stage = state.players[ownerId].stage
    const ability = stage?.card.stageAbility
    if (
      !stage ||
      stage.rested ||
      !ability ||
      ability.triggered ||
      ability.endPhase ||
      (ability.oncePerTurn && state.skillUsesThisTurn.includes(stage.card.instanceId)) ||
      (ownerId !== playerId && !ability.ownerIndependent)
    ) {
      continue
    }
    return { ownerId, stage, ability }
  }
  return null
}

/**
 * Some ability conditions are evaluated only after paying the ability cost.
 * In particular, BS6-084 discards one-or-more hand cards before checking
 * whether the remaining hand has five cards or less.
 */
export const isCardAbilityEffectConditionDeferredUntilCost = (
  ability: Pick<CardAbility, 'cost'>,
  effect: CardEffect,
): boolean => {
  const condition = 'condition' in effect ? effect.condition : undefined
  return (
    ability.cost.discardHandAtLeast === true &&
    condition?.kind === 'hand-count-at-most'
  )
}

/** The opposing Item tax is paid before the Item leaves the hand and resolves. */
export const isItemEffectConditionSatisfiedAfterAdditionalCost = (
  state: GameState,
  playerId: PlayerId,
  ability: CardAbility,
  effect: CardEffect,
): boolean => {
  const condition = 'condition' in effect ? effect.condition : undefined
  if (condition?.kind !== 'hand-count-at-most') return false
  const restriction = getItemActivateDiscardRequirement(state, playerId)
  if (!restriction || restriction.needsRuling) return false
  const afterFixedCost = getHandCountAfterFixedSkillCost(
    state.players[playerId], getEffectiveCardAbilityCost(state, playerId, ability),
  )
  return afterFixedCost !== undefined &&
    Math.max(0, afterFixedCost - restriction.count - 1) <= condition.count
}

const hasUsableEffect = (
  state: GameState,
  playerId: PlayerId,
  sourceInstanceId: string,
  ability: CardAbility,
  options: {
    deferHandCountConditionUntilAfterDiscard?: boolean
    deferItemAdditionalCostCondition?: boolean
    allowInactiveConditionalEffects?: boolean
  } = {},
): boolean => {
  const context = {
    sourcePlayerId: playerId,
    sourceInstanceId,
  }

  if (ability.effects.some(effect => effect.kind === 'reveal-bottom-deck' && effect.requireCard) &&
    state.players[playerId].deck.length === 0) return false

  const mandatoryRevealEffects = ability.effects.filter(
    (effect): effect is Extract<CardEffect, { kind: 'reveal-hand' }> =>
      effect.kind === 'reveal-hand' && effect.selectCard === true,
  )
  if (
    mandatoryRevealEffects.some(
      (effect) =>
        getEffectSelectionCandidates(state, context, effect).length < effect.amount,
    )
  ) {
    return false
  }

  return ability.effects.some((effect) => {
    const conditionMet = isEffectConditionMet(state, context, effect)
    const conditionDeferred =
      !conditionMet &&
      (
        (options.deferHandCountConditionUntilAfterDiscard === true &&
          isCardAbilityEffectConditionDeferredUntilCost(ability, effect)) ||
        (options.deferItemAdditionalCostCondition === true &&
          isItemEffectConditionSatisfiedAfterAdditionalCost(state, playerId, ability, effect))
      )
    // Some item costs can reduce the hand before the effect condition is
    // checked.  BS6-084 must therefore be allowed to open its discard-cost
    // flow even while the pre-payment hand is still above the threshold.
    // Selected Stage abilities use the same cost-first semantics as items: a
    // conditional effect may be paid and then resolve to no effect when its
    // condition is false (for example BS11-083 before the player has
    // Refreshed).
    if (!conditionMet && !conditionDeferred) {
      if (
        options.allowInactiveConditionalEffects === true &&
        'condition' in effect &&
        effect.condition !== undefined
      ) {
        return true
      }
      return false
    }
    if (isEffectTargeted(effect) && effect.target?.costSelected) {
      // The Cookie selected for an HP cost is not written to costRecord until
      // the ability is finally confirmed. Availability checks must still see
      // a legal LV-filtered HP-cost Cookie before opening the UI flow.
      return Boolean(
        ability.cost.hpToTrash &&
          getHpToTrashCostCandidates(
            ability.cost,
            state.players[playerId].battleArea,
            sourceInstanceId,
          ).length >= effect.target.min,
      )
    }
    if (effect.kind === 'return-to-hand') {
      const targetPlayer = state.players[
        getTargetPlayerId(context, effect.target)
      ]
      return (
        targetPlayer.battleArea.length >= effect.target.min &&
        getEffectTargetCandidates(state, context, effect.target).length >=
          effect.target.min
      )
    }
    if (effect.kind === 'return-to-deck-bottom') {
      const targetPlayer = state.players[
        getTargetPlayerId(context, effect.target)
      ]
      return (
        targetPlayer.battleArea.length >= effect.target.min &&
        getEffectTargetCandidates(state, context, effect.target).length >=
          effect.target.min
      )
    }
    if (effect.kind === 'gain-hp' && effect.target) {
      if (effect.target.sourceOnly || effect.target.min === 0) return true
      return (
        getEffectTargetCandidates(state, context, effect.target).length >=
        effect.target.min
      )
    }
    if (
      effect.kind === 'damage-by-break-count' ||
      effect.kind === 'modify-attack-by-break-count'
    ) {
      if (getBreakCount(state, playerId, effect) <= 0) return false
      if (effect.target.min === 0) return true
      return (
        getEffectTargetCandidates(state, context, effect.target).length >=
        effect.target.min
      )
    }
    if (effect.kind === 'break-to-battle') {
      return getBreakToBattleCandidates(state, context, effect).length > 0
    }
    if (effect.kind === 'support-to-battle') {
      return effect.optional === true || getSupportToBattleCandidates(state, context, effect).length > 0
    }
    if (effect.kind === 'break-to-hand-by-level-sum') {
      return effect.cardCount === undefined
        ? getBreakToHandBySumCandidates(state, context, effect).length > 0
        : findBreakToHandBySumSelection(state, context, effect) !== null
    }
    if (effect.kind === 'hand-to-break-by-level-sum') {
      return getHandToBreakBySumCandidates(state, context, effect).length > 0
    }
    if (
      !isEffectTargeted(effect) ||
      !effect.target ||
      effect.target.min === 0
    ) return true
    return (
      getEffectTargetCandidates(state, context, effect.target).length >=
      effect.target.min
    )
  })
}

export const canPlayItem = (
  state: GameState,
  playerId: PlayerId,
  instanceId: string,
): boolean => {
  try {
    assertMainAction(state, playerId)
    const card = state.players[playerId].hand.find(
      (candidate) => candidate.instanceId === instanceId,
    )
    const ability = card && getItemAbility(card)
    const cost = ability
      ? getEffectiveCardAbilityCost(state, playerId, ability)
      : undefined
    const restriction = getItemActivateDiscardRequirement(state, playerId)
    if (restriction?.needsRuling) return false
    const revealCost = ability?.effects[0]
    const reservedRevealCount = revealCost?.kind === 'reveal-hand' && revealCost.asCost
      ? revealCost.amount
      : 0
    if (restriction && cost && state.players[playerId].hand.filter(card => card.instanceId !== instanceId).length <
      restriction.count + (cost.discardHand ?? 0) + (cost.handToBreakArea?.count ?? 0) + reservedRevealCount) return false
    return Boolean(
      card &&
        ability &&
        cost &&
        canPayAbilityCost(state, playerId, cost, instanceId) &&
        hasUsableEffect(state, playerId, instanceId, ability, {
          deferHandCountConditionUntilAfterDiscard:
            cost.discardHandAtLeast === true,
          deferItemAdditionalCostCondition: Boolean(restriction),
          allowInactiveConditionalEffects: ability.allowInactiveConditionalEffects === true,
        }),
    )
  } catch {
    return false
  }
}

export const playItem = (
  state: GameState,
  playerId: PlayerId,
  instanceId: string,
  paymentIds: string[],
  supportToTrashIds: string[] = [],
  supportToHandIds: string[] = [],
  discardHandIds: string[] = [],
  hpToTrashTargetIds: string[] = [],
  trashBattleCookieIds: string[] = [],
  handToBreakAreaIds: string[] = [],
  itemRestrictionDiscardIds: string[] = [],
): GameState => {
  assertMainAction(state, playerId)
  const player = state.players[playerId]
  const cardIndex = findCardIndex(player.hand, instanceId)
  const card = player.hand[cardIndex]
  const ability = card && getItemAbility(card)
  if (!card || !ability) {
    throw new GameRuleError('這張卡不能作為物品使用。')
  }
  if (discardHandIds.includes(instanceId)) {
    throw new GameRuleError('物品卡本身不能作為自己的棄手牌費用。')
  }

  const restriction = getItemActivateDiscardRequirement(state, playerId)
  if (restriction?.needsRuling) throw new GameRuleError('多個道具額外棄牌來源的支付方式尚待系列末裁定。')
  const uniqueTaxIds = new Set(itemRestrictionDiscardIds)
  if (uniqueTaxIds.size !== itemRestrictionDiscardIds.length || itemRestrictionDiscardIds.length !== (restriction?.count ?? 0) ||
    itemRestrictionDiscardIds.some(id => id === instanceId || discardHandIds.includes(id) || handToBreakAreaIds.includes(id) || !player.hand.some(card => card.instanceId === id))) {
    throw new GameRuleError('發動道具必須另外支付精確數量的合法手牌，不能與原代價共用。')
  }
  const taxedState = updatePlayer(state, { ...player,
    hand: player.hand.filter(card => !uniqueTaxIds.has(card.instanceId)),
    discardPile: [...player.discardPile, ...itemRestrictionDiscardIds.map(id => player.hand.find(card => card.instanceId === id)!)],
  })

  const revealCost = ability.effects[0]
  if (ability.effects.some(effect => effect.kind === 'reveal-bottom-deck' && effect.requireCard) && player.deck.length === 0) {
    throw new GameRuleError('無法支付展示代價：牌庫沒有可展示的底牌。')
  }
  if (revealCost?.kind === 'reveal-hand' && revealCost.asCost &&
    getEffectSelectionCandidates(taxedState, { sourcePlayerId: playerId, sourceInstanceId: instanceId }, revealCost).length < revealCost.amount) {
    throw new GameRuleError('無法支付展示代價：手牌沒有符合等級條件的餅乾。')
  }

  const cost = getEffectiveCardAbilityCost(state, playerId, ability)
  const paidState = payAbilityCost(taxedState, playerId, cost, {
    paymentIds,
    supportToTrashIds,
    supportToHandIds,
    discardHandIds,
    hpToTrashTargetIds,
    trashBattleCookieIds,
    handToBreakAreaIds,
    sourceInstanceId: instanceId,
  })
  const paidStateWithActivation: GameState = {
    ...paidState,
    itemsActivatedThisTurn: {
      ...(paidState.itemsActivatedThisTurn ?? {}),
      [playerId]: (paidState.itemsActivatedThisTurn?.[playerId] ?? 0) + 1,
    },
  }
  const paidPlayer = paidStateWithActivation.players[playerId]

  return resolveBreakLevelVictory(updatePlayer(paidStateWithActivation, {
    ...paidPlayer,
    hand: paidPlayer.hand.filter((cardInHand) => cardInHand.instanceId !== instanceId),
    discardPile: paidPlayer.discardPile.some(
      (discarded) => discarded.instanceId === card.instanceId,
    )
      ? paidPlayer.discardPile
      : [...paidPlayer.discardPile, card],
  }))
}

export const canPlayStage = (
  state: GameState,
  playerId: PlayerId,
  instanceId: string,
): boolean => {
  try {
    assertMainAction(state, playerId)
    const card = state.players[playerId].hand.find(
      (candidate) => candidate.instanceId === instanceId,
    )
    return Boolean(card && getStageAbility(card))
  } catch {
    return false
  }
}

export const playStage = (
  state: GameState,
  playerId: PlayerId,
  instanceId: string,
  paymentIds: string[],
): GameState => {
  assertMainAction(state, playerId)
  const player = state.players[playerId]
  const cardIndex = findCardIndex(player.hand, instanceId)
  const card = player.hand[cardIndex]
  const ability = card && getStageAbility(card)
  if (!card || !ability) {
    throw new GameRuleError('這張卡不能放置為場景。')
  }

  validateEnergyCostPayment(state, playerId, ability.placementCost, paymentIds)
  const paidState = restPayments(state, playerId, paymentIds)
  const paidPlayer = paidState.players[playerId]
  return updatePlayer(paidState, {
    ...paidPlayer,
    hand: paidPlayer.hand.filter((_, index) => index !== cardIndex),
    discardPile: paidPlayer.stage
      ? [...paidPlayer.discardPile, paidPlayer.stage.card]
      : paidPlayer.discardPile,
    stage: { card, rested: false },
  })
}

export const canActivateStage = (
  state: GameState,
  playerId: PlayerId,
): boolean => {
  try {
    assertMainAction(state, playerId)
    const source = getStageActivationSource(state, playerId)
    if (!source) return false
    return (
      canPayAbilityCost(state, playerId, source.ability.cost, source.stage.card.instanceId) &&
      (
        hasUsableEffect(
          state,
          playerId,
          source.stage.card.instanceId,
          source.ability,
          {
            allowInactiveConditionalEffects:
              source.ability.allowInactiveConditionalEffects === true,
          },
        ) ||
        (source.ability.specialVictory !== undefined &&
          isSpecialVictoryConditionMet(
            state,
            playerId,
            source.ability.specialVictory,
          ))
      )
    )
  } catch {
    return false
  }
}

export const activateStage = (
  state: GameState,
  playerId: PlayerId,
  paymentIds: string[],
  supportToTrashIds: string[] = [],
  supportToHandIds: string[] = [],
  discardHandIds: string[] = [],
  hpToTrashTargetIds: string[] = [],
  trashBattleCookieIds: string[] = [],
  trashToDeckBottomIds: string[] = [],
): GameState => {
  if (!canActivateStage(state, playerId)) {
    throw new GameRuleError('目前無法啟動場景卡。')
  }
  const source = getStageActivationSource(state, playerId)
  if (!source) {
    throw new GameRuleError('目前無法啟動場景卡。')
  }
  const ability = source.ability
  const paidState = payAbilityCost(state, playerId, ability.cost, {
    paymentIds,
    supportToTrashIds,
    supportToHandIds,
    discardHandIds,
    hpToTrashTargetIds,
    trashBattleCookieIds,
    trashToDeckBottomIds,
    sourceInstanceId: source.stage.card.instanceId,
  })
  const ownerPlayer = paidState.players[source.ownerId]
  const activatedState = updatePlayer(paidState, {
    ...ownerPlayer,
    stage: ability.cost.stageSourceToTrash
      ? null
      : {
          ...source.stage,
          rested: ability.restSource ? true : source.stage.rested,
        },
  })

  const stateWithUse = ability.oncePerTurn
    ? {
        ...activatedState,
        skillUsesThisTurn: [
          ...activatedState.skillUsesThisTurn,
          source.stage.card.instanceId,
        ],
      }
    : activatedState

  return ability.specialVictory &&
    isSpecialVictoryConditionMet(stateWithUse, playerId, ability.specialVictory)
    ? finishWithVictory(stateWithUse, playerId, 'special-victory')
    : stateWithUse
}
