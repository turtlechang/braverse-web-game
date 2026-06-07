import { GameRuleError } from './errors'
import type {
  CardSkill,
  EnergyColor,
  EnergyCost,
  GameState,
  PlayerId,
  SkillTrigger,
  SupportCard,
} from './types'

const ENERGY_COLORS: EnergyColor[] = [
  'red',
  'yellow',
  'green',
  'blue',
  'purple',
  'black',
]

const getCostTotal = (cost: EnergyCost): number =>
  Object.values(cost).reduce(
    (total, amount) => total + (amount ?? 0),
    0,
  )

const getSkillUseKey = (
  source: GameState['players'][PlayerId]['battleArea'][number],
) => source.battleEntryId ?? source.card.instanceId

export const canPayEnergyCost = (
  cost: EnergyCost,
  supports: SupportCard[],
): boolean => {
  const activeSupports = supports.filter((support) => !support.rested)

  if (activeSupports.length < getCostTotal(cost)) {
    return false
  }

  let wildCount = activeSupports.filter(
    (support) => support.card.energyColor === 'wild',
  ).length

  for (const color of ENERGY_COLORS) {
    const required = cost[color] ?? 0
    const matching = activeSupports.filter(
      (support) => support.card.energyColor === color,
    ).length
    wildCount -= Math.max(0, required - matching)

    if (wildCount < 0) {
      return false
    }
  }

  return true
}

const validatePayment = (
  skill: CardSkill,
  supports: SupportCard[],
  paymentIds: string[],
) => {
  const uniqueIds = [...new Set(paymentIds)]

  if (
    uniqueIds.length !== paymentIds.length ||
    uniqueIds.length !== getCostTotal(skill.cost)
  ) {
    throw new GameRuleError('技能支付的能量數量不正確。')
  }

  const selected = uniqueIds.map((instanceId) =>
    supports.find(
      (support) =>
        support.card.instanceId === instanceId && !support.rested,
    ),
  )

  if (selected.some((support) => !support)) {
    throw new GameRuleError('只能使用自己的活躍支援卡支付技能費用。')
  }

  const remaining = selected as SupportCard[]
  let wildCount = remaining.filter(
    (support) => support.card.energyColor === 'wild',
  ).length

  for (const color of ENERGY_COLORS) {
    const required = skill.cost[color] ?? 0
    const matching = remaining.filter(
      (support) => support.card.energyColor === color,
    ).length
    wildCount -= Math.max(0, required - matching)

    if (wildCount < 0) {
      throw new GameRuleError('技能支付的能量顏色不符合需求。')
    }
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
    state.pendingReplacementPlayerId
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

  return canPayEnergyCost(skill.cost, player.supportArea)
}

export const activateCookieSkill = (
  state: GameState,
  playerId: PlayerId,
  sourceInstanceId: string,
  trigger: SkillTrigger,
  paymentIds: string[],
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
  const paymentSet = new Set(paymentIds)

  return {
    ...state,
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
        supportArea: player.supportArea.map((support) =>
          paymentSet.has(support.card.instanceId)
            ? { ...support, rested: true }
            : support,
        ),
      },
    },
    skillUsesThisTurn: source.card.skill.oncePerTurn
      ? [...state.skillUsesThisTurn, getSkillUseKey(source)]
      : state.skillUsesThisTurn,
  }
}
