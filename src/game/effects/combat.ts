import { GameRuleError } from '../errors'
import { getOpponentId } from '../helpers'
import type {
  CookieInBattle,
  GameCard,
  GameState,
  ModifyAttackEffect,
  ModifyDamageReceivedEffect,
  PlayerState,
} from '../types'
import { isBlockedByOpponentEffectProtection, isEffectConditionMet } from './targeting'

/**
 * `modify-all-attack` 掛在 `trigger: 'passive'` 技能上時（例如 BS3-006「若這張
 * 餅乾在戰鬥區，你的紅色 LV.2 以上餅乾 +1 攻擊力」），是持續依附在來源餅乾
 * 是否仍在戰鬥區的條件式光環，不會像一般觸發效果那樣被 `executeAbilityEffects`
 * 執行、寫進 `state.attackModifiers`——被動技能從未走過那條指令派送路徑。
 * 所以這裡要在計算即時攻擊力時，額外掃描雙方戰鬥區所有被動技能來源，
 * 找出套用在這個目標身上的光環加成。
 */
const getAuraAttackBonus = (
  state: GameState,
  target: CookieInBattle,
  owner: PlayerState,
): number =>
  Object.values(state.players).reduce((total, sourcePlayer) => {
    const auraTotal = sourcePlayer.battleArea.reduce((subtotal, source) => {
      const skill = source.card.skill
      if (skill?.trigger !== 'passive') return subtotal
      if (skill.yourTurn && state.activePlayerId !== sourcePlayer.id) {
        return subtotal
      }
      const context = {
        sourcePlayerId: sourcePlayer.id,
        sourceInstanceId: source.card.instanceId,
      }
      return subtotal + skill.effects.reduce((sum, effect) => {
        if (effect.kind !== 'modify-all-attack') return sum
        const auraPlayerId =
          effect.side === 'self'
            ? sourcePlayer.id
            : getOpponentId(sourcePlayer.id)
        if (auraPlayerId !== owner.id) return sum
        if (effect.energyColor && target.card.energyColor !== effect.energyColor) {
          return sum
        }
        if (effect.minLevel && target.card.level < effect.minLevel) return sum
        if (
          isBlockedByOpponentEffectProtection(target, owner.id, sourcePlayer.id)
        ) {
          return sum
        }
        if (!isEffectConditionMet(state, context, effect)) return sum
        return sum + effect.amount
      }, 0)
    }, 0)
    return total + auraTotal
  }, 0)

export const getEffectiveAttack = (
  state: GameState,
  targetInstanceId: string,
  attackTargetInstanceId?: string,
): number => {
  const owner = Object.values(state.players).find((player) =>
    player.battleArea.some(
      (cookie) => cookie.card.instanceId === targetInstanceId,
    ),
  )
  const target = owner?.battleArea.find(
    (cookie) => cookie.card.instanceId === targetInstanceId,
  )

  if (!target || !owner) {
    throw new GameRuleError('找不到要計算攻擊力的餅乾。')
  }

  const modifierTotal = state.attackModifiers
    .filter((modifier) => modifier.targetInstanceId === targetInstanceId)
    .reduce((total, modifier) => total + modifier.amount, 0)
  const passiveModifierTotal =
    target.card.skill?.trigger === 'passive' &&
    (!target.card.skill.yourTurn ||
      state.activePlayerId === owner.id)
      ? target.card.skill.effects
          .filter(
            (effect) =>
              effect.kind === 'modify-attack' &&
              effect.target.sourceOnly &&
              isEffectConditionMet(
                state,
                {
                  sourcePlayerId: owner.id,
                  sourceInstanceId: targetInstanceId,
                  attackTargetInstanceId,
                },
                effect,
              ),
          )
          .reduce((total, effect) => total + (effect as ModifyAttackEffect).amount, 0)
      : 0
  const auraModifierTotal = getAuraAttackBonus(state, target, owner)

  return Math.max(
    0,
    target.card.attack + modifierTotal + passiveModifierTotal + auraModifierTotal,
  )
}

/** 在雙方場上／支援區／棄牌區／休息區／手牌／場景卡裡找一張卡的名稱，供顯示攻擊力修正來源用。 */
const findCardNameByInstanceId = (
  state: GameState,
  instanceId: string,
): string | undefined => {
  for (const player of Object.values(state.players)) {
    const zones: GameCard[][] = [
      player.battleArea.map((cookie) => cookie.card),
      player.battleArea.flatMap((cookie) => cookie.equippedCards ?? []),
      player.supportArea.map((support) => support.card),
      player.discardPile,
      player.breakArea,
      player.hand,
      player.stage ? [player.stage.card] : [],
    ]
    for (const zone of zones) {
      const found = zone.find((card) => card.instanceId === instanceId)
      if (found) return found.name
    }
  }
  return undefined
}

export interface AttackModifierBreakdownEntry {
  sourceCardName: string
  amount: number
}

/**
 * 跟 `getEffectiveAttack` 算法一致，但額外回傳「是哪張卡造成的」明細，
 * 給 UI 顯示提示用（原本只有結果數字，看不出扣分/加分的來源）。
 */
export const getEffectiveAttackBreakdown = (
  state: GameState,
  targetInstanceId: string,
  attackTargetInstanceId?: string,
): {
  base: number
  effective: number
  entries: AttackModifierBreakdownEntry[]
} => {
  const owner = Object.values(state.players).find((player) =>
    player.battleArea.some(
      (cookie) => cookie.card.instanceId === targetInstanceId,
    ),
  )
  const target = owner?.battleArea.find(
    (cookie) => cookie.card.instanceId === targetInstanceId,
  )

  if (!target || !owner) {
    throw new GameRuleError('找不到要計算攻擊力的餅乾。')
  }

  const entries: AttackModifierBreakdownEntry[] = []

  for (const modifier of state.attackModifiers) {
    if (modifier.targetInstanceId !== targetInstanceId) continue
    entries.push({
      sourceCardName:
        findCardNameByInstanceId(state, modifier.sourceInstanceId) ?? '未知效果',
      amount: modifier.amount,
    })
  }

  if (
    target.card.skill?.trigger === 'passive' &&
    (!target.card.skill.yourTurn || state.activePlayerId === owner.id)
  ) {
    const context = {
      sourcePlayerId: owner.id,
      sourceInstanceId: targetInstanceId,
      attackTargetInstanceId,
    }
    for (const effect of target.card.skill.effects) {
      if (effect.kind !== 'modify-attack' || !effect.target.sourceOnly) continue
      if (!isEffectConditionMet(state, context, effect)) continue
      entries.push({ sourceCardName: target.card.name, amount: effect.amount })
    }
  }

  for (const sourcePlayer of Object.values(state.players)) {
    for (const source of sourcePlayer.battleArea) {
      const skill = source.card.skill
      if (skill?.trigger !== 'passive') continue
      if (skill.yourTurn && state.activePlayerId !== sourcePlayer.id) continue
      const context = {
        sourcePlayerId: sourcePlayer.id,
        sourceInstanceId: source.card.instanceId,
      }
      for (const effect of skill.effects) {
        if (effect.kind !== 'modify-all-attack') continue
        const auraPlayerId =
          effect.side === 'self' ? sourcePlayer.id : getOpponentId(sourcePlayer.id)
        if (auraPlayerId !== owner.id) continue
        if (effect.energyColor && target.card.energyColor !== effect.energyColor) {
          continue
        }
        if (effect.minLevel && target.card.level < effect.minLevel) continue
        if (
          isBlockedByOpponentEffectProtection(target, owner.id, sourcePlayer.id)
        ) {
          continue
        }
        if (!isEffectConditionMet(state, context, effect)) continue
        entries.push({ sourceCardName: source.card.name, amount: effect.amount })
      }
    }
  }

  const base = target.card.attack
  const effective = Math.max(
    0,
    base + entries.reduce((sum, entry) => sum + entry.amount, 0),
  )

  return { base, effective, entries }
}

export const getAttackDamageAgainst = (
  state: GameState,
  attackerInstanceId: string,
  targetInstanceId: string,
): number => {
  const baseDamage = getEffectiveAttack(state, attackerInstanceId, targetInstanceId)

  const modifiedDamage = state.damageReceivedModifiers
    .filter((modifier) => modifier.targetInstanceId === targetInstanceId)
    .reduce((damage, modifier) => {
      const adjustedDamage = Math.max(0, damage + modifier.amount)

      return modifier.minimumDamage !== undefined &&
        modifier.setDamageTo !== undefined &&
        adjustedDamage >= modifier.minimumDamage
        ? modifier.setDamageTo
        : adjustedDamage
    }, baseDamage)
  const defenderOwner = Object.values(state.players).find((player) =>
    player.battleArea.some((cookie) => cookie.card.instanceId === targetInstanceId),
  )
  const defender = defenderOwner?.battleArea.find(
    (cookie) => cookie.card.instanceId === targetInstanceId,
  )
  const damageAfterDefenderModifiers =
    !defender || !defenderOwner || defender.card.skill?.trigger !== 'passive'
      ? modifiedDamage
      : defender.card.skill.effects
          .filter(
            (effect): effect is ModifyDamageReceivedEffect =>
              effect.kind === 'modify-damage-received' &&
              effect.target.sourceOnly === true &&
              isEffectConditionMet(
                state,
                {
                  sourcePlayerId: defenderOwner.id,
                  sourceInstanceId: targetInstanceId,
                },
                effect,
              ),
          )
          .reduce((damage, effect) => {
            if (
              effect.minimumDamage !== undefined &&
              effect.setDamageTo !== undefined &&
              damage >= effect.minimumDamage
            ) {
              return effect.setDamageTo
            }
            return Math.max(0, damage + effect.amount)
          }, modifiedDamage)

  const attackerOwner = Object.values(state.players).find((player) =>
    player.battleArea.some(
      (cookie) => cookie.card.instanceId === attackerInstanceId,
    ),
  )
  const attacker = attackerOwner?.battleArea.find(
    (cookie) => cookie.card.instanceId === attackerInstanceId,
  )
  if (
    !attacker ||
    !attackerOwner ||
    attacker.card.skill?.trigger !== 'passive' ||
    (attacker.card.skill.yourTurn && state.activePlayerId !== attackerOwner.id)
  ) {
    return damageAfterDefenderModifiers
  }

  const multiplier = attacker.card.skill.effects.reduce((total, effect) => {
    if (effect.kind !== 'multiply-attack-damage') return total
    return isEffectConditionMet(
      state,
      {
        sourcePlayerId: attackerOwner.id,
        sourceInstanceId: attackerInstanceId,
      },
      effect,
    )
      ? total * effect.multiplier
      : total
  }, 1)

  return Math.max(0, damageAfterDefenderModifiers * multiplier)
}
