import { GameRuleError } from './errors'
import { selectEnergyPayment, validateEnergyPayment } from './energy'
import {
  getBreakCount,
  getBreakToBattleCandidates,
  getSupportToBattleCandidates,
  getBreakToHandBySumCandidates,
  getHandToBreakBySumCandidates,
  getEffectTargetCandidates,
  getTargetPlayerId,
  isEffectConditionMet,
  isEffectTargeted,
} from './effects'
import { findCardIndex, updatePlayer } from './helpers'
import { hasBlockingPending } from './pending'
import {
  clearDepartedCookieModifiers,
  recordCookieDepartures,
} from './replacement'
import {
  markSupportAreaDecreased,
  payTrashBattleCookieCost,
} from './skills'
import { finishWithVictory, isSpecialVictoryConditionMet } from './victory'
import type {
  AbilityCost,
  CardAbility,
  CookieInBattle,
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
  supportToTrashIds?: string[]
  supportToHandIds?: string[]
  discardHandIds?: string[]
  hpToTrashTargetIds?: string[]
  trashBattleCookieIds?: string[]
  sourceInstanceId?: string
}

const getHpToTrashCostCandidates = (
  cost: AbilityCost,
  battleArea: CookieInBattle[],
): CookieInBattle[] => {
  if (!cost.hpToTrash) return []
  return battleArea.filter((cookie) => {
    if (cookie.hpCards.length === 0) return false
    return cost.hpToTrash?.untilRemainingHp === undefined
      ? true
      : cookie.hpCards.length > cost.hpToTrash.untilRemainingHp
  })
}

const canPayAbilityCost = (
  state: GameState,
  playerId: PlayerId,
  cost: AbilityCost,
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

  const availableDiscardCount = cost.discardHandColor
    ? player.hand.filter((card) => card.energyColor === cost.discardHandColor)
        .length
    : player.hand.length

  return (
    remainingSupportCount >= supportCost &&
    availableDiscardCount >= (cost.discardHand ?? 0) &&
    (!cost.hpToTrash ||
      getHpToTrashCostCandidates(cost, player.battleArea).length > 0)
  )
}

const payAbilityCost = (
  state: GameState,
  playerId: PlayerId,
  cost: AbilityCost,
  options: AbilityPaymentOptions,
): GameState => {
  validateAbilityPayment(state, playerId, cost, options.paymentIds)

  if (cost.trashToDeckBottom) {
    // 只有餅乾技能路徑實作這個代價；item／stage 若之後用到必須先補上支付流程。
    throw new GameRuleError('此代價尚未支援於物品或場景能力。')
  }
  if (cost.trashToDeck) {
    // BS3-098 目前只出現在餅乾 OnPlay 技能；避免未來 item／stage
    // 沿用 AbilityCost 時把洗回牌庫成本靜默忽略。
    throw new GameRuleError('此代價尚未支援於物品或場景能力。')
  }

  const player = state.players[playerId]
  const supportToTrashIds = [...new Set(options.supportToTrashIds ?? [])]
  const supportToHandIds = [...new Set(options.supportToHandIds ?? [])]
  const discardHandIds = [...new Set(options.discardHandIds ?? [])]
  const hpToTrashTargetIds = [...new Set(options.hpToTrashTargetIds ?? [])]

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
  if (discardHandIds.length !== (cost.discardHand ?? 0)) {
    throw new GameRuleError(`必須棄掉 ${cost.discardHand ?? 0} 張手牌。`)
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

  const discardedHandCards = player.hand.filter((card) =>
    discardHandIds.includes(card.instanceId),
  )
  if (discardedHandCards.length !== discardHandIds.length) {
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
  if (cost.hpToTrash && hpToTrashTargetIds.length !== 1) {
    throw new GameRuleError('必須選擇 1 張餅乾支付 HP 費用。')
  }
  if (!cost.hpToTrash && hpToTrashTargetIds.length > 0) {
    throw new GameRuleError('此能力不需要支付 HP 費用。')
  }

  let updatedPlayer: PlayerState = {
    ...player,
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
    hand: [
      ...player.hand.filter(
        (card) => !discardHandIds.includes(card.instanceId),
      ),
      ...selectedSupportToHand.map((support) => support.card),
    ],
    discardPile: [
      ...player.discardPile,
      ...selectedSupportToTrash.map((support) => support.card),
      ...discardedHandCards,
    ],
  }

  let departedCount = 0
  if (cost.hpToTrash) {
    const target = getHpToTrashCostCandidates(
      cost,
      updatedPlayer.battleArea,
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
    } else {
      const removedHpCards = target.hpCards.slice(-removeCount)
      const remainingHpCards = target.hpCards.slice(
        0,
        Math.max(0, target.hpCards.length - removeCount),
      )

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

  const trashBattleCookiePayment = payTrashBattleCookieCost(
    updatedPlayer,
    cost,
    options.trashBattleCookieIds ?? [],
    options.sourceInstanceId,
  )
  updatedPlayer = trashBattleCookiePayment.player
  departedCount += trashBattleCookiePayment.departedCount

  let nextState: GameState = {
    ...state,
    players: {
      ...state.players,
      [playerId]: updatedPlayer,
    },
  }

  if (supportToTrashIds.length > 0 || supportToHandIds.length > 0) {
    nextState = markSupportAreaDecreased(nextState, playerId, {
      triggerSkill: supportToTrashIds.length > 0,
    })
  }

  return departedCount > 0
    ? recordCookieDepartures(
        clearDepartedCookieModifiers(nextState),
        playerId,
        departedCount,
      )
    : nextState
}

export const getItemAbility = (card: GameCard): CardAbility | null =>
  card.type === 'item' ? card.item ?? null : null

export const getStageAbility = (
  card: GameCard,
): StageAbility | null =>
  card.type === 'stage' ? card.stageAbility ?? null : null

const hasUsableEffect = (
  state: GameState,
  playerId: PlayerId,
  sourceInstanceId: string,
  ability: CardAbility,
): boolean => {
  const context = {
    sourcePlayerId: playerId,
    sourceInstanceId,
  }

  return ability.effects.some((effect) => {
    if (!isEffectConditionMet(state, context, effect)) return false
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
      return getSupportToBattleCandidates(state, context, effect).length > 0
    }
    if (effect.kind === 'break-to-hand-by-level-sum') {
      return getBreakToHandBySumCandidates(state, context, effect).length > 0
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
    return Boolean(
      card &&
        ability &&
        canPayAbilityCost(state, playerId, ability.cost) &&
        hasUsableEffect(state, playerId, instanceId, ability),
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

  const paidState = payAbilityCost(state, playerId, ability.cost, {
    paymentIds,
    supportToTrashIds,
    supportToHandIds,
    discardHandIds,
    hpToTrashTargetIds,
    trashBattleCookieIds,
    sourceInstanceId: instanceId,
  })
  const paidPlayer = paidState.players[playerId]

  return updatePlayer(paidState, {
    ...paidPlayer,
    hand: paidPlayer.hand.filter((cardInHand) => cardInHand.instanceId !== instanceId),
    discardPile: paidPlayer.discardPile.some(
      (discarded) => discarded.instanceId === card.instanceId,
    )
      ? paidPlayer.discardPile
      : [...paidPlayer.discardPile, card],
  })
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
    const stage = state.players[playerId].stage
    const ability = stage?.card.stageAbility
    if (!stage || stage.rested || !ability || ability.triggered) return false
    return (
      canPayAbilityCost(state, playerId, ability.cost) &&
      (
        hasUsableEffect(state, playerId, stage.card.instanceId, ability) ||
        (ability.specialVictory !== undefined &&
          isSpecialVictoryConditionMet(
            state,
            playerId,
            ability.specialVictory,
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
): GameState => {
  if (!canActivateStage(state, playerId)) {
    throw new GameRuleError('目前無法啟動場景卡。')
  }
  const player = state.players[playerId]
  const stage = player.stage!
  const ability = stage.card.stageAbility!
  const paidState = payAbilityCost(state, playerId, ability.cost, {
    paymentIds,
    supportToTrashIds,
    supportToHandIds,
    discardHandIds,
    hpToTrashTargetIds,
    trashBattleCookieIds,
  })
  const paidPlayer = paidState.players[playerId]
  const activatedState = updatePlayer(paidState, {
    ...paidPlayer,
    stage: {
      ...stage,
      rested: ability.restSource ? true : stage.rested,
    },
  })

  return ability.specialVictory &&
    isSpecialVictoryConditionMet(activatedState, playerId, ability.specialVictory)
    ? finishWithVictory(activatedState, playerId, 'special-victory')
    : activatedState
}
