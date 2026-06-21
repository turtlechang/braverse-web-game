import {
  getTrapCandidates,
  getTrapTargetCandidates,
  playTrap,
  resolveAttackEffect,
  resolveFlip,
  resolveNextDamage,
  skipTrap,
} from '../battle'
import { getBreakToTrashCandidates } from '../effects'
import { selectEnergyPayment } from '../energy'
import type { GameState, PlayerId } from '../types'
import type { AiDecision } from './types'

export const handleAiPendingBattle = (
  state: GameState,
  playerId: PlayerId,
): AiDecision | null => {
  if (
    !state.pendingBattle ||
    state.pendingRefresh ||
    state.pendingReplacement
  ) {
    return null
  }

  const battle = state.pendingBattle
  if (
    battle.stage === 'attack-effect' &&
    battle.attackerPlayerId === playerId
  ) {
    const effect = battle.attackEffects[battle.attackEffectIndex]
    const targetIds =
      effect?.kind === 'break-to-trash'
        ? getBreakToTrashCandidates(
            state,
            {
              sourcePlayerId: playerId,
              sourceInstanceId: battle.attackerInstanceId,
            },
            effect,
          )
            .slice(0, effect.max)
            .map((card) => card.instanceId)
        : []
    return {
      state: resolveAttackEffect(state, playerId, targetIds),
      action: 'resolve-attack-effect',
      description:
        targetIds.length > 0
          ? `${state.players[playerId].name}結算攻擊後續效果。`
          : `${state.players[playerId].name}略過攻擊後續效果。`,
    }
  }

  if (battle.stage === 'damage') {
    return {
      state: resolveNextDamage(state),
      action: 'resolve-damage',
      description: '依序翻開並結算下一張 HP 卡。',
    }
  }

  if (
    battle.stage === 'flip' &&
    (battle.damagePlayerId ?? battle.defenderPlayerId) === playerId
  ) {
    const revealed = battle.revealedHpCard
    const discardCount = revealed?.flip?.cost.discardHand ?? 0
    const discardHandIds = state.players[playerId].hand
      .slice(0, discardCount)
      .map((card) => card.instanceId)
    const canActivate =
      Boolean(revealed?.flip) && discardHandIds.length === discardCount
    return {
      state: resolveFlip(state, playerId, {
        activate: canActivate,
        discardHandIds,
      }),
      action: 'resolve-flip',
      revealedCard: revealed ?? undefined,
      description: canActivate
        ? `${state.players[playerId].name}發動${revealed?.name ?? 'FLIP'}。`
        : `${state.players[playerId].name}略過 FLIP。`,
    }
  }

  if (battle.stage === 'trap' && battle.defenderPlayerId === playerId) {
    const trapCard = getTrapCandidates(state, playerId)[0]
    if (!trapCard?.trap) {
      return {
        state: skipTrap(state, playerId),
        action: 'play-trap',
        description: `${state.players[playerId].name}未發動陷阱。`,
      }
    }
    const paymentIds =
      selectEnergyPayment(
        trapCard.trap.cost.energy,
        state.players[playerId].supportArea,
      ) ?? []
    const targetIds = getTrapTargetCandidates(
      state,
      playerId,
      trapCard.instanceId,
    )
      .slice(0, 1)
      .map((target) => target.card.instanceId)
    const supportTrashEffect = trapCard.trap.effects.find(
      (effect) => effect.kind === 'support-to-trash',
    )
    const supportTrashIds =
      supportTrashEffect?.kind === 'support-to-trash'
        ? state.players[playerId].supportArea
            .slice(0, supportTrashEffect.amount)
            .map((support) => support.card.instanceId)
        : []
    const discardHandIds = state.players[playerId].hand
      .filter((card) => card.instanceId !== trapCard.instanceId)
      .slice(0, trapCard.trap.cost.discardHand)
      .map((card) => card.instanceId)

    if (
      supportTrashEffect?.kind === 'support-to-trash' &&
      supportTrashIds.length < supportTrashEffect.amount
    ) {
      return {
        state: skipTrap(state, playerId),
        action: 'play-trap',
        description: `${state.players[playerId].name}無法支付陷阱後續代價。`,
      }
    }

    return {
      state: playTrap(state, playerId, {
        trapInstanceId: trapCard.instanceId,
        paymentIds,
        targetIds,
        supportTrashIds,
        discardHandIds,
      }),
      action: 'play-trap',
      revealedCard: trapCard,
      description: `${state.players[playerId].name}發動${trapCard.name}。`,
    }
  }

  return {
    state,
    action: 'idle',
    description: `${state.players[battle.defenderPlayerId].name}等待戰鬥回應。`,
  }
}
