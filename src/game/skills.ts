import { GameRuleError } from './errors'
import {
  selectEnergyPayment,
  validateEnergyPayment,
} from './energy'
import type {
  AbilityCost,
  CardSkill,
  GameState,
  PlayerId,
  SkillTrigger,
  SupportCard,
} from './types'
import { continuePendingReplacements } from './replacement'

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

  const energyPayment = selectEnergyPayment(
    skill.cost.energy,
    player.supportArea,
  )
  if (!energyPayment) return false

  return canPaySupportToTrashCost(
    skill.cost,
    player.supportArea,
    new Set(energyPayment),
  )
}

export const activateCookieSkill = (
  state: GameState,
  playerId: PlayerId,
  sourceInstanceId: string,
  trigger: SkillTrigger,
  paymentIds: string[],
  costSupportToTrashIds: string[] = [],
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

  const paymentSet = new Set(paymentIds)
  const costSupportSet = new Set(uniqueCostSupportToTrashIds)

  if (
    paymentIds.some((id) => costSupportSet.has(id)) ||
    uniqueCostSupportToTrashIds.some((id) => paymentSet.has(id))
  ) {
    throw new GameRuleError('同一張支援卡不能同時支付兩種費用。')
  }

  const trashedCards = player.supportArea.filter((support) =>
    costSupportSet.has(support.card.instanceId),
  )

  return {
    ...state,
    pendingOnPlay: trigger === 'on-play' ? null : state.pendingOnPlay,
    players: {
      ...state.players,
      [playerId]: {
        ...player,
        battleArea: player.battleArea.map((cookie) =>
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
        discardPile: [
          ...player.discardPile,
          ...trashedCards.map((support) => support.card),
        ],
      },
    },
    skillUsesThisTurn: source.card.skill.oncePerTurn
      ? [...state.skillUsesThisTurn, getSkillUseKey(source)]
      : state.skillUsesThisTurn,
  }
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
