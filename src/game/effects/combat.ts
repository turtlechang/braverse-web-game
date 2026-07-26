import { GameRuleError } from '../errors'
import type {
  GameState,
  ModifyAttackEffect,
  ModifyDamageReceivedEffect,
} from '../types'
import { isEffectConditionMet } from './targeting'

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

  return Math.max(
    0,
    target.card.attack + modifierTotal + passiveModifierTotal,
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
