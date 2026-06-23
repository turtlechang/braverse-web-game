import { GameRuleError } from './errors'
import {
  selectEnergyPayment,
  validateEnergyPayment,
} from './energy'
import type {
  AbilityCost,
  CardSkill,
  CookieInBattle,
  GameState,
  PlayerId,
  PlayerState,
  SkillTrigger,
  SupportCard,
} from './types'
import {
  clearDepartedCookieModifiers,
  continuePendingReplacements,
  recordCookieDepartures,
} from './replacement'

const getSkillUseKey = (
  source: GameState['players'][PlayerId]['battleArea'][number],
) => source.battleEntryId ?? source.card.instanceId

export const canPayEnergyCost = (
  cost: AbilityCost,
  supports: SupportCard[],
): boolean => selectEnergyPayment(cost.energy, supports) !== null

export const canPaySupportToTrashCost = (
  cost: AbilityCost,
  supports: SupportCard[],
  excludedSupportIds: ReadonlySet<string> = new Set(),
): boolean => {
  if (!cost.supportToTrash) return true
  return (
    supports.filter(
      (support) => !excludedSupportIds.has(support.card.instanceId),
    ).length >= cost.supportToTrash
  )
}

export const getTrashBattleCookieCostCandidates = (
  cost: AbilityCost,
  battleArea: CookieInBattle[],
): CookieInBattle[] => {
  if (!cost.trashBattleCookie) return []
  const { level, energyColor } = cost.trashBattleCookie
  return battleArea.filter((cookie) => {
    if (level !== undefined && cookie.card.level !== level) return false
    if (energyColor !== undefined && cookie.card.energyColor !== energyColor) return false
    return true
  })
}

export const canPayTrashBattleCookieCost = (
  cost: AbilityCost,
  battleArea: CookieInBattle[],
): boolean =>
  !cost.trashBattleCookie ||
  getTrashBattleCookieCostCandidates(cost, battleArea).length >=
    cost.trashBattleCookie.count

export const payTrashBattleCookieCost = (
  player: PlayerState,
  cost: AbilityCost,
  selectedIds: string[],
): { player: PlayerState; departedCount: number } => {
  const uniqueIds = [...new Set(selectedIds)]
  if (uniqueIds.length !== selectedIds.length) {
    throw new GameRuleError('不能重複選擇同一張戰鬥區餅乾作為代價。')
  }

  if (!cost.trashBattleCookie) {
    if (uniqueIds.length > 0) {
      throw new GameRuleError('此效果不需要支付戰鬥區餅乾代價。')
    }
    return { player, departedCount: 0 }
  }

  if (uniqueIds.length !== cost.trashBattleCookie.count) {
    throw new GameRuleError(
      `必須選擇 ${cost.trashBattleCookie.count} 張戰鬥區餅乾作為代價。`,
    )
  }

  const candidateIds = new Set(
    getTrashBattleCookieCostCandidates(cost, player.battleArea).map(
      (cookie) => cookie.card.instanceId,
    ),
  )
  if (uniqueIds.some((id) => !candidateIds.has(id))) {
    throw new GameRuleError('選擇的餅乾不符合代價條件。')
  }

  const selectedSet = new Set(uniqueIds)
  const trashedCookies = player.battleArea.filter((cookie) =>
    selectedSet.has(cookie.card.instanceId),
  )
  return {
    player: {
      ...player,
      battleArea: player.battleArea.filter(
        (cookie) => !selectedSet.has(cookie.card.instanceId),
      ),
      discardPile: [
        ...player.discardPile,
        ...trashedCookies.map((cookie) => cookie.card),
        ...trashedCookies.flatMap((cookie) => cookie.hpCards),
      ],
    },
    departedCount: trashedCookies.length,
  }
}

const validatePayment = (
  skill: CardSkill,
  supports: SupportCard[],
  paymentIds: string[],
) => {
  const validation = validateEnergyPayment(
    skill.cost.energy,
    supports,
    paymentIds,
  )

  if (!validation.valid) {
    throw new GameRuleError(`技能支付無效：${validation.reason}`)
  }
}

export const canActivateCookieSkill = (
  state: GameState,
  playerId: PlayerId,
  sourceInstanceId: string,
  trigger: SkillTrigger,
): boolean => {
  const player = state.players[playerId]
  const source = player.battleArea.find(
    (cookie) => cookie.card.instanceId === sourceInstanceId,
  )
  const skill = source?.card.skill

  if (!source || !skill || skill.trigger !== trigger) {
    return false
  }

  if (
    state.status !== 'playing' ||
    state.pendingRefresh ||
    state.pendingBattle ||
    state.pendingOpponentHandDiscard ||
    state.pendingOpponentRandomDiscard ||
    state.pendingInspectDeck ||
    state.pendingOptionalCostAttack ||
    state.pendingStageTrigger ||
    (state.pendingFaintEffects && state.pendingFaintEffects.length > 0)
  ) {
    return false
  }

  if (state.pendingReplacement && trigger !== 'on-play') {
    return false
  }

  if (
    state.pendingOnPlay
      ? trigger !== 'on-play' ||
        state.pendingOnPlay.playerId !== playerId ||
        state.pendingOnPlay.sourceInstanceId !== sourceInstanceId
      : trigger === 'on-play'
  ) {
    return false
  }

  if (
    trigger === 'activate' &&
    (state.phase !== 'main' || state.activePlayerId !== playerId)
  ) {
    return false
  }

  if (skill.yourTurn && state.activePlayerId !== playerId) {
    return false
  }

  if (
    skill.oncePerTurn &&
    state.skillUsesThisTurn.includes(getSkillUseKey(source))
  ) {
    return false
  }

  if (skill.restSource && source.rested) {
    return false
  }

  if (skill.cost.discardHand > 0 && player.hand.length < skill.cost.discardHand) {
    return false
  }

  const energyPayment = selectEnergyPayment(
    skill.cost.energy,
    player.supportArea,
  )
  if (!energyPayment) return false

  if (!canPaySupportToTrashCost(
    skill.cost,
    player.supportArea,
    new Set(energyPayment),
  )) {
    return false
  }

  if (!canPayTrashBattleCookieCost(skill.cost, player.battleArea)) {
    return false
  }

  return true
}

export const activateCookieSkill = (
  state: GameState,
  playerId: PlayerId,
  sourceInstanceId: string,
  trigger: SkillTrigger,
  paymentIds: string[],
  costSupportToTrashIds: string[] = [],
  discardHandIds: string[] = [],
  trashBattleCookieIds: string[] = [],
): GameState => {
  if (
    !canActivateCookieSkill(state, playerId, sourceInstanceId, trigger)
  ) {
    throw new GameRuleError('目前無法發動這個餅乾技能。')
  }

  const player = state.players[playerId]
  const source = player.battleArea.find(
    (cookie) => cookie.card.instanceId === sourceInstanceId,
  )

  if (!source?.card.skill) {
    throw new GameRuleError('找不到要發動的餅乾技能。')
  }

  validatePayment(source.card.skill, player.supportArea, paymentIds)

  const uniqueDiscardHandIds = [...new Set(discardHandIds)]
  if (uniqueDiscardHandIds.length !== discardHandIds.length) {
    throw new GameRuleError('不能重複選擇同一張手牌作為代價。')
  }

  const cost = source.card.skill.cost
  const uniqueCostSupportToTrashIds = [...new Set(costSupportToTrashIds)]

  if (cost.supportToTrash) {
    if (uniqueCostSupportToTrashIds.length !== cost.supportToTrash) {
      throw new GameRuleError(
        `必須選擇 ${cost.supportToTrash} 張支援卡作為技能代價。`,
      )
    }

    const trashed = player.supportArea.filter((support) =>
      uniqueCostSupportToTrashIds.includes(support.card.instanceId),
    )

    if (trashed.length !== cost.supportToTrash) {
      throw new GameRuleError('只能選擇自己的支援區卡牌作為代價。')
    }
  } else if (uniqueCostSupportToTrashIds.length > 0) {
    throw new GameRuleError('此技能不需要支付支援區卡牌代價。')
  }

  if (cost.discardHand > 0) {
    if (uniqueDiscardHandIds.length !== cost.discardHand) {
      throw new GameRuleError(
        `必須棄置 ${cost.discardHand} 張手牌作為技能代價。`,
      )
    }
    const allInHand = uniqueDiscardHandIds.every((id) =>
      player.hand.some((card) => card.instanceId === id),
    )
    if (!allInHand) {
      throw new GameRuleError('只能選擇自己的手牌作為代價。')
    }
  } else if (uniqueDiscardHandIds.length > 0) {
    throw new GameRuleError('此技能不需要棄手牌代價。')
  }

  const trashBattlePayment = payTrashBattleCookieCost(
    player,
    cost,
    trashBattleCookieIds,
  )
  const uniqueTrashBattleCookieIds = [...new Set(trashBattleCookieIds)]

  const paymentSet = new Set(paymentIds)
  const costSupportSet = new Set(uniqueCostSupportToTrashIds)
  const trashBattleSet = new Set(uniqueTrashBattleCookieIds)

  if (
    paymentIds.some((id) => costSupportSet.has(id) || trashBattleSet.has(id)) ||
    uniqueCostSupportToTrashIds.some((id) => paymentSet.has(id)) ||
    uniqueTrashBattleCookieIds.some((id) => paymentSet.has(id) || costSupportSet.has(id))
  ) {
    throw new GameRuleError('同一張卡不能同時支付兩種費用。')
  }

  const trashedCards = player.supportArea.filter((support) =>
    costSupportSet.has(support.card.instanceId),
  )

  const discardedCards = player.hand.filter((card) =>
    uniqueDiscardHandIds.includes(card.instanceId),
  )

  const activatedState: GameState = {
    ...state,
    pendingOnPlay: trigger === 'on-play' ? null : state.pendingOnPlay,
    players: {
      ...state.players,
      [playerId]: {
        ...trashBattlePayment.player,
        battleArea: trashBattlePayment.player.battleArea
          .map((cookie) =>
            cookie.card.instanceId === sourceInstanceId &&
            source.card.skill?.restSource
              ? { ...cookie, rested: true }
              : cookie,
          ),
        supportArea: player.supportArea
          .filter((support) => !costSupportSet.has(support.card.instanceId))
          .map((support) =>
            paymentSet.has(support.card.instanceId)
              ? { ...support, rested: true }
              : support,
          ),
        hand: player.hand.filter(
          (card) => !uniqueDiscardHandIds.includes(card.instanceId),
        ),
        discardPile: [
          ...trashBattlePayment.player.discardPile,
          ...trashedCards.map((support) => support.card),
          ...discardedCards,
        ],
      },
    },
    skillUsesThisTurn: source.card.skill.oncePerTurn
      ? [...state.skillUsesThisTurn, getSkillUseKey(source)]
      : state.skillUsesThisTurn,
  }

  return trashBattlePayment.departedCount > 0
    ? recordCookieDepartures(
        clearDepartedCookieModifiers(activatedState),
        playerId,
        trashBattlePayment.departedCount,
      )
    : activatedState
}

export const skipCookieOnPlay = (
  state: GameState,
  playerId: PlayerId,
  sourceInstanceId: string,
): GameState => {
  if (
    state.pendingOnPlay?.playerId !== playerId ||
    state.pendingOnPlay.sourceInstanceId !== sourceInstanceId
  ) {
    throw new GameRuleError('目前沒有可略過的登場效果。')
  }

  return continuePendingReplacements({
    ...state,
    pendingOnPlay: null,
  })
}
