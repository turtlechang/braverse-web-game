import { GameRuleError } from './errors'
import { selectEnergyPayment, validateEnergyPayment } from './energy'
import {
  getEffectTargetCandidates,
  getTargetPlayerId,
  isEffectConditionMet,
  isEffectTargeted,
} from './effects'
import { findCardIndex, updatePlayer } from './helpers'
import { hasBlockingPending } from './pending'
import type {
  CardAbility,
  GameCard,
  GameState,
  PlayerId,
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

const validateAbilityPayment = (
  state: GameState,
  playerId: PlayerId,
  ability: CardAbility,
  paymentIds: string[],
) => {
  const validation = validateEnergyPayment(
    ability.cost,
    state.players[playerId].supportArea,
    paymentIds,
  )
  if (!validation.valid) {
    throw new GameRuleError(`能量付款不合法：${validation.reason}`)
  }
}

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

export const getItemAbility = (card: GameCard): CardAbility | null =>
  card.type === 'item' ? card.item ?? null : null

export const getStageAbility = (
  card: GameCard,
): StageAbility | null =>
  card.type === 'stage' ? card.stageAbility ?? null : null

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
    if (!card) return false
    const ability = getItemAbility(card)
    if (!ability) return false
    const context = {
      sourcePlayerId: playerId,
      sourceInstanceId: instanceId,
    }
    return ability.effects.some((effect) => {
      if (!isEffectConditionMet(state, context, effect)) return false
      if (effect.kind === 'return-to-hand') {
        const targetPlayer = state.players[
          getTargetPlayerId(context, effect.target)
        ]
        return (
          targetPlayer.battleArea.length > effect.target.min &&
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
      if (!isEffectTargeted(effect) || !effect.target || effect.target.min === 0) return true
      return (
        getEffectTargetCandidates(state, context, effect.target).length >=
        effect.target.min
      )
    })
  } catch {
    return false
  }
}

export const playItem = (
  state: GameState,
  playerId: PlayerId,
  instanceId: string,
  paymentIds: string[],
): GameState => {
  assertMainAction(state, playerId)
  const player = state.players[playerId]
  const cardIndex = findCardIndex(player.hand, instanceId)
  const card = player.hand[cardIndex]
  const ability = card && getItemAbility(card)
  if (!card || !ability) {
    throw new GameRuleError('選擇的卡片不是可使用的物品卡。')
  }
  validateAbilityPayment(state, playerId, ability, paymentIds)
  const paidState = restPayments(state, playerId, paymentIds)
  const paidPlayer = paidState.players[playerId]
  return updatePlayer(paidState, {
    ...paidPlayer,
    hand: paidPlayer.hand.filter((_, index) => index !== cardIndex),
    discardPile: [...paidPlayer.discardPile, card],
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
    throw new GameRuleError('選擇的卡片不是可放置的場景卡。')
  }
  validateAbilityPayment(
    state,
    playerId,
    { ...ability, cost: ability.placementCost },
    paymentIds,
  )
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
    if (
      selectEnergyPayment(
        ability.cost,
        state.players[playerId].supportArea,
      ) === null
    ) {
      return false
    }

    const context = {
      sourcePlayerId: playerId,
      sourceInstanceId: stage.card.instanceId,
    }
    return ability.effects.some((effect) => {
      if (!isEffectConditionMet(state, context, effect)) return false
      if (effect.kind === 'gain-hp' && effect.target) {
        if (effect.target.sourceOnly || effect.target.min === 0) return true
        return (
          getEffectTargetCandidates(state, context, effect.target).length >=
          effect.target.min
        )
      }
      if (!isEffectTargeted(effect) || !effect.target || effect.target.min === 0) return true
      return (
        getEffectTargetCandidates(state, context, effect.target).length >=
        effect.target.min
      )
    })
  } catch {
    return false
  }
}

export const activateStage = (
  state: GameState,
  playerId: PlayerId,
  paymentIds: string[],
): GameState => {
  if (!canActivateStage(state, playerId)) {
    throw new GameRuleError('目前無法啟動場景卡。')
  }
  const player = state.players[playerId]
  const stage = player.stage!
  const ability = stage.card.stageAbility!
  validateAbilityPayment(state, playerId, ability, paymentIds)
  const paidState = restPayments(state, playerId, paymentIds)
  const paidPlayer = paidState.players[playerId]
  return updatePlayer(paidState, {
    ...paidPlayer,
    stage: {
      ...stage,
      rested: ability.restSource ? true : stage.rested,
    },
  })
}
