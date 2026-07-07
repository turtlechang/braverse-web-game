import {
  getTrapCandidates,
  getTrapTargetCandidates,
  getBlockerCandidates,
  playTrap,
  playBlocker,
  resolveAttackEffect,
  resolveFlip,
  resolveNextDamage,
  skipTrap,
} from '../battle'
import { appendCommandLogEntry } from '../commands'
import {
  getBreakToTrashCandidates,
  getEffectTargetCandidates,
} from '../effects'
import { selectEnergyPayment } from '../energy'
import { getTrashBattleCookieCostCandidates } from '../skills'
import type { CardEffect, EffectContext, GameState, PlayerId } from '../types'
import type { AiDecision } from './types'

const chooseAttackEffectTargets = (
  state: GameState,
  playerId: PlayerId,
  battle: NonNullable<GameState['pendingBattle']>,
  effect: CardEffect | undefined,
): string[] => {
  if (!effect) return []
  const context: EffectContext = {
    sourcePlayerId: playerId,
    sourceInstanceId: battle.attackerInstanceId,
  }

  if (effect.kind === 'break-to-trash') {
    return getBreakToTrashCandidates(state, context, effect)
      .slice(0, effect.max)
      .map((card) => card.instanceId)
  }

  if (effect.kind === 'opponent-battle-to-trash') {
    const opponentId = playerId === 'player-one' ? 'player-two' : 'player-one'
    return state.players[opponentId].battleArea
      .filter((cookie) => {
        if (effect.maxLevel !== undefined && cookie.card.level > effect.maxLevel) return false
        if (effect.minLevel !== undefined && cookie.card.level < effect.minLevel) return false
        if (effect.remainingHp !== undefined && cookie.hpCards.length > effect.remainingHp) return false
        return true
      })
      .sort((left, right) => left.hpCards.length - right.hpCards.length)
      .slice(0, 1)
      .map((cookie) => cookie.card.instanceId)
  }

  if (!('target' in effect) || !effect.target) return []

  const candidates = getEffectTargetCandidates(state, context, effect.target)
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
  return ordered.slice(0, count).map((cookie) => cookie.card.instanceId)
}

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
    const targetIds = chooseAttackEffectTargets(
      state,
      playerId,
      battle,
      effect,
    )
    return {
      state: appendCommandLogEntry(
        state,
        resolveAttackEffect(state, playerId, targetIds),
        { kind: 'resolve-attack-effect', playerId, targetIds },
      ),
      action: 'resolve-attack-effect',
      description:
        targetIds.length > 0
          ? `${state.players[playerId].name}結算攻擊後續效果。`
          : `${state.players[playerId].name}略過攻擊後續效果。`,
    }
  }

  if (battle.stage === 'damage') {
    const damagePlayerId = battle.damagePlayerId ?? battle.defenderPlayerId
    return {
      state: appendCommandLogEntry(
        state,
        resolveNextDamage(state),
        { kind: 'resolve-next-damage', playerId: damagePlayerId },
      ),
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
      state: appendCommandLogEntry(
        state,
        resolveFlip(state, playerId, {
          activate: canActivate,
          discardHandIds,
        }),
        {
          kind: 'resolve-flip',
          playerId,
          activate: canActivate,
          discardHandIds,
        },
      ),
      action: 'resolve-flip',
      revealedCard: revealed ?? undefined,
      description: canActivate
        ? `${state.players[playerId].name}發動${revealed?.name ?? 'FLIP'}。`
        : `${state.players[playerId].name}略過 FLIP。`,
    }
  }

  if (battle.stage === 'trap' && battle.defenderPlayerId === playerId) {
    const trapCard = getTrapCandidates(state, playerId)[0]
    if (trapCard?.trap) {
      const paymentIds =
        selectEnergyPayment(
          trapCard.trap.cost.energy ?? trapCard.trap.cost,
          state.players[playerId].supportArea,
        ) ?? []
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
      const targetIds = preferredTarget
        ? [preferredTarget.card.instanceId]
        : []
      const supportTrashEffect = trapCard.trap.effects.find(
        (effect) => effect.kind === 'support-to-trash',
      )
      const supportTrashIds =
        supportTrashEffect?.kind === 'support-to-trash'
          ? state.players[playerId].supportArea
              .slice(0, supportTrashEffect.amount)
              .map((support) => support.card.instanceId)
          : []
      const discardHandColor = trapCard.trap.cost.discardHandColor
      const discardHandIds = state.players[playerId].hand
        .filter(
          (card) =>
            card.instanceId !== trapCard.instanceId &&
            (!discardHandColor || card.energyColor === discardHandColor),
        )
        .slice(0, trapCard.trap.cost.discardHand ?? 0)
        .map((card) => card.instanceId)
      const trashBattleCookieIds = getTrashBattleCookieCostCandidates(
        trapCard.trap.cost,
        state.players[playerId].battleArea,
      )
        .slice(0, trapCard.trap.cost.trashBattleCookie?.count ?? 0)
        .map((cookie) => cookie.card.instanceId)

      if (
        supportTrashEffect?.kind === 'support-to-trash' &&
        supportTrashIds.length < supportTrashEffect.amount
      ) {
        return {
          state: appendCommandLogEntry(
            state,
            skipTrap(state, playerId),
            { kind: 'skip-trap', playerId },
          ),
          action: 'play-trap',
          description: `${state.players[playerId].name}無法支付陷阱後續代價。`,
        }
      }

      return {
        state: appendCommandLogEntry(
          state,
          playTrap(state, playerId, {
            trapInstanceId: trapCard.instanceId,
            paymentIds,
            targetIds,
            supportTrashIds,
            discardHandIds,
            trashBattleCookieIds,
          }),
          {
            kind: 'play-trap',
            playerId,
            trapInstanceId: trapCard.instanceId,
            paymentIds,
            targetIds,
            supportTrashIds,
            discardHandIds,
            trashBattleCookieIds,
          },
        ),
        action: 'play-trap',
        revealedCard: trapCard,
        description: `${state.players[playerId].name}發動${trapCard.name}。`,
      }
    }

    const blockerCandidates = getBlockerCandidates(state, playerId)
    if (blockerCandidates.length > 0) {
      const blocker = blockerCandidates[0]
      const skill = blocker.card.skill!
      const paymentIds =
        selectEnergyPayment(
          skill.cost.energy ?? skill.cost,
          state.players[playerId].supportArea,
        ) ?? []
      return {
        state: appendCommandLogEntry(
          state,
          playBlocker(state, playerId, {
            sourceInstanceId: blocker.card.instanceId,
            paymentIds,
          }),
          {
            kind: 'play-blocker',
            playerId,
            sourceInstanceId: blocker.card.instanceId,
            paymentIds,
          },
        ),
        action: 'play-blocker',
        description: `${state.players[playerId].name}使用${blocker.card.name}阻擋攻擊。`,
      }
    }

    return {
      state: appendCommandLogEntry(
        state,
        skipTrap(state, playerId),
        { kind: 'skip-trap', playerId },
      ),
      action: 'play-trap',
      description: `${state.players[playerId].name}未發動陷阱。`,
    }
  }

  return {
    state,
    action: 'idle',
    description: `${state.players[battle.defenderPlayerId].name}等待戰鬥回應。`,
  }
}
