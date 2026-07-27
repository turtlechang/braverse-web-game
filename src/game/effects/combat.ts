import { GameRuleError } from '../errors'
import { getOpponentId } from '../helpers'
import type {
  CookieInBattle,
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

export const getAttackDamageAgainst = (
  state: GameState,
  attackerInstanceId: string,
  targetInstanceId: string,
): number => {
  const baseDamage = getEffectiveAttack(state, attackerInstanceId)

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
  if (!defender || !defenderOwner || defender.card.skill?.trigger !== 'passive') {
    return modifiedDamage
  }
  const passiveDamageModifiers = defender.card.skill.effects.filter(
      (effect): effect is ModifyDamageReceivedEffect =>
        effect.kind === 'modify-damage-received' &&
        effect.target.sourceOnly === true &&
        isEffectConditionMet(state, {
          sourcePlayerId: defenderOwner.id,
          sourceInstanceId: targetInstanceId,
        }, effect),
    )
  return passiveDamageModifiers.reduce((damage, effect) => {
      if (
        effect.minimumDamage !== undefined &&
        effect.setDamageTo !== undefined &&
        damage >= effect.minimumDamage
      ) {
        return effect.setDamageTo
      }
      return Math.max(0, damage + effect.amount)
    }, modifiedDamage)
}
