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
  isEffectConditionMet,
} from '../effects'
import { selectEnergyPayment } from '../energy'
import { getTrashBattleCookieCostCandidates } from '../skills'
import type { CardEffect, EffectContext, GameState, GameCard, PlayerId } from '../types'
import type { AiDecision, AiLevel } from './types'
import { isRuleEnabled } from './rule-profiles'

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

const evaluateTrapWorth = (
  state: GameState,
  playerId: PlayerId,
  trapCard: GameCard,
  battle: NonNullable<GameState['pendingBattle']>,
): number => {
  if (!trapCard.trap) return 0

  const attacker = state.players[battle.attackerPlayerId].battleArea.find(
    (c) => c.card.instanceId === battle.attackerInstanceId,
  )
  const defender = state.players[battle.defenderPlayerId].battleArea.find(
    (c) => c.card.instanceId === battle.targetInstanceId,
  )

  if (!attacker || !defender) return 0

  let score = 0

  // 1. protectedTargetValue：保護目標價值
  const targetLevel = defender.card.level
  const targetHp = defender.hpCards.length
  score += targetLevel * 15
  score += targetHp * 10

  // 高效果價值餅乾加分
  const highEffectNames = [
    'Rebel', 'Dark Choco', 'Sea Fairy', 'Wind Archer', 'Banana',
    'Vampire', 'Red Bean', 'Cream Unicorn', 'Black Raisin',
  ]
  if (highEffectNames.some((n) => defender.card.name.includes(n))) {
    score += 20
  }

  // 2. preventedKillBonus：防止被擊倒（依目標等級縮放）
  const attackerDamage = attacker.card.attack ?? 0
  const wouldBeKilled = targetHp <= attackerDamage
  if (wouldBeKilled) {
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
  if (wouldBeKilled && myBreakLevel >= 8) {
    score += 40
  } else if (wouldBeKilled && myBreakLevel >= 6) {
    score += 20
  }

  // 4. effectValueBonus：陷阱效果價值
  for (const effect of trapCard.trap.effects) {
    score += EFFECT_VALUE_MAP[effect.kind] ?? 5
  }

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

  return score
}

export const handleAiPendingBattle = (
  state: GameState,
  playerId: PlayerId,
  level?: AiLevel,
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
    const flipContext = {
      sourcePlayerId: playerId,
      sourceInstanceId: revealed?.instanceId ?? '',
      sourceCardName: revealed?.name ?? '',
    }
    const hasActivatableEffect = Boolean(revealed?.flip) &&
      revealed!.flip!.effects.some((effect) =>
        isEffectConditionMet(state, flipContext, effect),
      )
    const canActivate = hasActivatableEffect &&
      discardHandIds.length === discardCount
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
    const trapCandidates = getTrapCandidates(state, playerId)
    const useR7 = level !== undefined && isRuleEnabled(level, 'R7')

    let trapCard: GameCard | undefined
    if (useR7 && trapCandidates.length > 0) {
      // R7: Lv.3+ 評估所有陷阱候選，選最高分
      let bestScore = -Infinity
      let bestCandidate: GameCard | undefined
      for (const candidate of trapCandidates) {
        if (!candidate.trap) continue
        const score = evaluateTrapWorth(state, playerId, candidate, battle)
        if (score > bestScore) {
          bestScore = score
          bestCandidate = candidate
        }
      }
      // R7: 只在目標明顯無價值（Lv.1 HP1）且分數偏低時跳過
      const target = state.players[battle.defenderPlayerId].battleArea.find(
        (c) => c.card.instanceId === battle.targetInstanceId,
      )
      const isExpendable = (target?.card.level ?? 0) <= 1 && (target?.hpCards.length ?? 0) <= 1
      if (isExpendable && bestScore < 50) {
        trapCard = undefined
      } else {
        trapCard = bestCandidate
      }
    } else {
      trapCard = trapCandidates[0]
    }

    const r7Skipped = useR7 && trapCandidates.length > 0 && !trapCard

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
      const supportToHandEffect = trapCard.trap.effects.find(
        (effect) => effect.kind === 'support-to-hand',
      )
      const supportToHandIds =
        supportToHandEffect?.kind === 'support-to-hand'
          ? state.players[playerId].supportArea
              .slice()
              .sort((a, b) => {
                if (a.rested !== b.rested) return a.rested ? -1 : 1
                return 0
              })
              .slice(0, supportToHandEffect.amount)
              .map((support) => support.card.instanceId)
          : []
      const handToSupportEffect = trapCard.trap.effects.find(
        (effect) => effect.kind === 'hand-to-support',
      )
      const handToSupportIds =
        handToSupportEffect?.kind === 'hand-to-support'
          ? state.players[playerId].hand
              .filter((card) => card.instanceId !== trapCard.instanceId)
              .slice()
              .sort((a, b) => {
                const aCookie = a.type === 'cookie' ? 1 : 0
                const bCookie = b.type === 'cookie' ? 1 : 0
                if (aCookie !== bCookie) return aCookie - bCookie
                return 0
              })
              .slice(0, handToSupportEffect.amount)
              .map((card) => card.instanceId)
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

      if (
        supportToHandEffect?.kind === 'support-to-hand' &&
        supportToHandIds.length < supportToHandEffect.amount
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
            supportToHandIds,
            handToSupportIds,
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
            supportToHandIds,
            handToSupportIds,
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
      r7TrapSkip: r7Skipped,
    }
  }

  return {
    state,
    action: 'idle',
    description: `${state.players[battle.defenderPlayerId].name}等待戰鬥回應。`,
  }
}
