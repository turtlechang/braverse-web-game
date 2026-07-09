import { getEffectTargetCandidates } from './effects/targeting'
import type { GameState, PlayerId } from './types'

export type DamageSource = 'battle' | 'effect'

export const collectAfterDamageEffectsFromIds = (
  state: GameState,
  damagedInstanceIds: string[],
  damageSource?: DamageSource,
): GameState => {
  if (damagedInstanceIds.length === 0) return state
  if (damageSource !== undefined && damageSource !== 'battle') return state

  let result = state
  const uniqueDamagedIds = [...new Set(damagedInstanceIds)]

  for (const instanceId of uniqueDamagedIds) {
    for (const playerId of ['player-one', 'player-two'] as PlayerId[]) {
      const player = result.players[playerId]
      const cookie = player.battleArea.find(
        (c) => c.card.instanceId === instanceId,
      )
      if (!cookie) continue
      const skill = cookie.card.skill
      if (!skill || !skill.afterDamage) continue
      if (
        skill.oncePerTurn &&
        result.skillUsesThisTurn.includes(cookie.battleEntryId ?? cookie.card.instanceId)
      ) {
        continue
      }

      const context = {
        sourcePlayerId: playerId,
        sourceInstanceId: cookie.card.instanceId,
        sourceCardName: cookie.card.name,
      }

      for (const effect of skill.effects) {
        if (effect.kind === 'damage' || effect.kind === 'modify-attack' || effect.kind === 'modify-damage-received') {
          const candidates = getEffectTargetCandidates(result, context, effect.target)
          if (candidates.length > 0) {
            result = {
              ...result,
              pendingAfterDamageEffects: [
                ...(result.pendingAfterDamageEffects ?? []),
                {
                  sourcePlayerId: playerId,
                  sourceInstanceId: cookie.card.instanceId,
                  sourceCardName: cookie.card.name,
                  effect,
                  context,
                },
              ],
            }
          }
        } else {
          result = {
            ...result,
            pendingAfterDamageEffects: [
              ...(result.pendingAfterDamageEffects ?? []),
              {
                sourcePlayerId: playerId,
                sourceInstanceId: cookie.card.instanceId,
                sourceCardName: cookie.card.name,
                effect,
                context,
              },
            ],
          }
        }

        if (skill.oncePerTurn) {
          const useKey = cookie.battleEntryId ?? cookie.card.instanceId
          if (!result.skillUsesThisTurn.includes(useKey)) {
            result = {
              ...result,
              skillUsesThisTurn: [...result.skillUsesThisTurn, useKey],
            }
          }
        }
      }
    }
  }

  return result
}
