import { GameRuleError } from './errors'
import {
  selectEnergyPayment,
  validateEnergyPayment,
} from './energy'
import type {
  CardSkill,
  EnergyCost,
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
  cost: EnergyCost,
  supports: SupportCard[],
): boolean => selectEnergyPayment(cost, supports) !== null

const validatePayment = (
  skill: CardSkill,
  supports: SupportCard[],
  paymentIds: string[],
) => {
  const validation = validateEnergyPayment(
    skill.cost,
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
    state.pendingBattle
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
