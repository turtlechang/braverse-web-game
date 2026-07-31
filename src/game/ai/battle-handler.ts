import {
  getTrapCandidates,
  getTrapTargetCandidates,
  getTrapSelfTargetCandidates,
  getBlockerCandidates,
} from '../battle'
import { applyGameCommand } from '../commands'
import {
  getBreakToTrashCandidates,
  getEffectTargetCandidates,
  getEffectiveAttack,
  getTrashToDeckCandidates,
  isEffectConditionMet,
} from '../effects'
import { selectEnergyPayment } from '../energy'
import { getTrashBattleCookieCostCandidates } from '../skills'
import type { CardEffect, EffectContext, GameState, GameCard, PlayerId } from '../types'
import type { AiDecision, AiLevel } from './types'
import { isRuleEnabled } from './rule-profiles'
import { getCardEffectValue } from './bs2MatchupProfiles'

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

export const evaluateTrapWorth = (
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

  // 高效果價值餅乾加分——原本是寫死的卡名子字串清單，只涵蓋 BS1／BS2 少數
  // 幾張卡，且用 `name.includes(...)` 比對；同名跨彈重印卡（例如 BS1-012／
  // BS3-009 都叫 Wildberry Cookie）會被誤套，BS3 卡片不管技能多強都拿不到
  // 這個加分。改用 getCardEffectValue：已收錄的卡沿用調校過的數字，查無
  // 資料的新卡改讀 card.skill.effects 直接推算，門檻 >= 5 對應原本清單裡
  // 那些卡在 EFFECT_VALUE_BONUS 的實際分數（Rebel/Dark Choco 8、Red
  // Bean/Sea Fairy/Wind Archer 7、Black Raisin/Banana/Vampire 6、Cream
  // Unicorn 5）。
  if (getCardEffectValue(defender.card) >= 5) {
    score += 20
  }

  // 2. preventedKillBonus：防止被擊倒（依目標等級縮放）
  // 用 getEffectiveAttack 而非 card.attack：場上只要有加攻／減攻效果（物品、
  // 技能、先前的陷阱），卡面攻擊力就不等於這次戰鬥的實際傷害，會讓「這張陷阱
  // 能不能救下這隻餅乾」整個判斷反過來——該擋的沒擋、不需要擋的卻把陷阱花掉。
  const attackerDamage = getEffectiveAttack(state, battle.attackerInstanceId)
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
    state.pendingReplacement ||
    state.pendingOnPlay
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
      state: applyGameCommand(state, {
        kind: 'resolve-attack-effect',
        playerId,
        targetIds,
      }),
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
      state: applyGameCommand(state, {
        kind: 'resolve-next-damage',
        playerId: damagePlayerId,
      }),
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
      state: applyGameCommand(state, {
        kind: 'resolve-flip',
        playerId,
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
      const selfTargetCandidates = getTrapSelfTargetCandidates(
        state,
        playerId,
        trapCard.instanceId,
      )
      const selfTargetIds =
        selfTargetCandidates.length > 0
          ? [selfTargetCandidates[0].card.instanceId]
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
      const handToBreakCost = trapCard.trap.cost.handToBreakArea
      const handToBreakIds = state.players[playerId].hand
        .filter(
          (card) =>
            card.instanceId !== trapCard.instanceId &&
            !discardHandIds.includes(card.instanceId) &&
            card.type === 'cookie' &&
            (!handToBreakCost?.energyColor ||
              card.energyColor === handToBreakCost.energyColor),
        )
        // 進休息區等於送對手 break 進度，優先付等級最低的。
        .sort(
          (left, right) =>
            (left.type === 'cookie' ? left.level : 0) -
            (right.type === 'cookie' ? right.level : 0),
        )
        .slice(0, handToBreakCost?.count ?? 0)
        .map((card) => card.instanceId)
      if (handToBreakCost && handToBreakIds.length < handToBreakCost.count) {
        return {
          state: applyGameCommand(state, { kind: 'skip-trap', playerId }),
          action: 'play-trap',
          description: `${state.players[playerId].name}無法支付陷阱代價。`,
        }
      }

      const trashBattleCookieIds = getTrashBattleCookieCostCandidates(
        trapCard.trap.cost,
        state.players[playerId].battleArea,
      )
        .slice(0, trapCard.trap.cost.trashBattleCookie?.count ?? 0)
        .map((cookie) => cookie.card.instanceId)
      const trashToDeckEffect = trapCard.trap.effects.find(
        (effect) => effect.kind === 'trash-to-deck',
      )
      const trashToDeckIds =
        trashToDeckEffect?.kind === 'trash-to-deck'
          ? getTrashToDeckCandidates(
              state,
              { sourcePlayerId: playerId, sourceInstanceId: trapCard.instanceId },
              trashToDeckEffect,
            )
              .slice(0, trashToDeckEffect.max)
              .map((card) => card.instanceId)
          : []

      if (
        supportTrashEffect?.kind === 'support-to-trash' &&
        supportTrashIds.length < supportTrashEffect.amount
      ) {
        return {
          state: applyGameCommand(state, { kind: 'skip-trap', playerId }),
          action: 'play-trap',
          description: `${state.players[playerId].name}無法支付陷阱後續代價。`,
        }
      }

      if (
        supportToHandEffect?.kind === 'support-to-hand' &&
        supportToHandIds.length < supportToHandEffect.amount
      ) {
        return {
          state: applyGameCommand(state, { kind: 'skip-trap', playerId }),
          action: 'play-trap',
          description: `${state.players[playerId].name}無法支付陷阱後續代價。`,
        }
      }

      return {
        state: applyGameCommand(state, {
          kind: 'play-trap',
          playerId,
          trapInstanceId: trapCard.instanceId,
          paymentIds,
          targetIds,
          selfTargetIds,
          supportTrashIds,
          supportToHandIds,
          handToSupportIds,
          discardHandIds,
          handToBreakIds,
          trashBattleCookieIds,
          trashToDeckIds,
        }),
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
        state: applyGameCommand(state, {
          kind: 'play-blocker',
          playerId,
          sourceInstanceId: blocker.card.instanceId,
          paymentIds,
        }),
        action: 'play-blocker',
        description: `${state.players[playerId].name}使用${blocker.card.name}阻擋攻擊。`,
      }
    }

    return {
      state: applyGameCommand(state, { kind: 'skip-trap', playerId }),
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
