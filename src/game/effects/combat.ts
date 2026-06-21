import { GameRuleError } from '../errors'
import type { GameState, ModifyAttackEffect } from '../types'
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
  const receivedModifierTotal = state.damageReceivedModifiers
    .filter((modifier) => modifier.targetInstanceId === targetInstanceId)
    .reduce((total, modifier) => total + modifier.amount, 0)

  return Math.max(
    0,
    getEffectiveAttack(state, attackerInstanceId) + receivedModifierTotal,
  )
}
