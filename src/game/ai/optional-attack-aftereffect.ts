import type { AttackCommand } from '../commands'
import { getAttackDamageAgainst, isOpponentDamagePrevented } from '../effects'
import { getEffectTargetCandidates } from '../effects/targeting'
import { getCookieEffectiveHp, getCookieEffectiveLevel, getOpponentId } from '../helpers'
import { maskGameStateForViewer } from '../masked-state'
import { getEnergyCostTotal } from '../energy'
import { getHpToTrashCostCandidates } from '../skills'
import type { AbilityCost, CardEffect, EffectContext, GameState } from '../types'
import { getPublicEffectDamageByTarget } from './public-effect-damage'

const DAMAGE_VALUE_PER_HP = 22
const KNOCKOUT_BONUS = 100
const HP_COST_VALUE = 25
const LOW_HP_RESERVE_PENALTY = 20
const OPTIONAL_BRANCH_WEIGHT = 0.5

const ENERGY_KEYS = new Set([
  'red', 'yellow', 'green', 'blue', 'purple', 'black', 'pure', 'neutral', 'wild',
])

const hasUnsupportedCost = (cost: AbilityCost): boolean =>
  Object.entries(cost).some(([key, value]) => {
    if (key === 'energy' || key === 'hpToTrash') return false
    if (ENERGY_KEYS.has(key)) return typeof value === 'number' && value > 0
    return value !== undefined && value !== false && value !== 0
  })

const supportedSourceHpCost = (cost: AbilityCost): number | null => {
  const hpCost = cost.hpToTrash
  if (!hpCost) return 0
  if (
    hpCost.sourceOnly !== true || hpCost.excludeSource || hpCost.totalAcrossCookies ||
    hpCost.untilRemainingHp !== undefined || hpCost.energyColor ||
    hpCost.minLevel !== undefined || hpCost.maxLevel !== undefined || hpCost.keyword
  ) return null
  const amount = hpCost.amount ?? 1
  return Number.isInteger(amount) && amount > 0 ? amount : null
}

const getSupportedAttackAftereffect = (
  effect: CardEffect,
): { wrapper: Extract<CardEffect, { kind: 'optional-cost-attack' }>; damage: Extract<CardEffect, { kind: 'damage' }> } | null => {
  if (
    effect.kind !== 'optional-cost-attack' ||
    effect.resolution === 'ability' ||
    effect.mandatory ||
    effect.sourceEnergy !== undefined ||
    effect.payBeforeCondition ||
    effect.effects.length !== 1 ||
    ('condition' in effect && effect.condition)
  ) return null

  const damage = effect.effects[0]
  if (
    !damage ||
    damage.kind !== 'damage' ||
    damage.condition ||
    damage.target.side !== 'opponent' ||
    damage.target.attackTargetOnly !== true ||
    damage.target.min !== 1 ||
    damage.target.max !== 1
  ) return null

  return { wrapper: effect, damage }
}

const projectNormalAttackDamage = (
  publicState: GameState,
  command: AttackCommand,
): GameState | null => {
  const battle = publicState.pendingBattle
  if (!battle) return null
  const defender = publicState.players[battle.defenderPlayerId]
  const target = defender.battleArea.find(
    cookie => cookie.card.instanceId === command.targetInstanceId,
  )
  if (!target) return null

  const damage = isOpponentDamagePrevented(
    publicState,
    target.card.instanceId,
    command.playerId,
  ) ? 0 : Math.max(0, getAttackDamageAgainst(
    publicState,
    command.attackerInstanceId,
    command.targetInstanceId,
  ))
  const hpAfterDamage = Math.max(0, target.hpCards.length - damage)
  const removedHpCards = target.hpCards.slice(hpAfterDamage)
  const remainingHpCards = target.hpCards.slice(0, hpAfterDamage)
  const pendingBattle = {
    ...battle,
    stage: 'attack-effect' as const,
    remainingDamage: 0,
    declaredDamage: damage,
    ...(hpAfterDamage === 0
      ? {
          faintedColors: target.card.energyColor && target.card.energyColor !== 'wild'
            ? [...new Set([...battle.faintedColors, target.card.energyColor])]
            : battle.faintedColors,
          faintedCookies: [
            ...(battle.faintedCookies ?? []),
            {
              playerId: battle.defenderPlayerId,
              energyColor: target.card.energyColor,
              level: getCookieEffectiveLevel(target),
            },
          ],
        }
      : {}),
  }
  const updatedDefender = hpAfterDamage === 0
    ? {
        ...defender,
        battleArea: defender.battleArea.filter(
          cookie => cookie.card.instanceId !== target.card.instanceId,
        ),
        breakArea: [...defender.breakArea, target.card],
        discardPile: [...defender.discardPile, ...removedHpCards],
      }
    : {
        ...defender,
        battleArea: defender.battleArea.map(cookie =>
          cookie.card.instanceId === target.card.instanceId
            ? { ...cookie, hpCards: remainingHpCards, publicHp: hpAfterDamage }
            : cookie,
        ),
        discardPile: [...defender.discardPile, ...removedHpCards],
      }

  return {
    ...publicState,
    players: { ...publicState.players, [battle.defenderPlayerId]: updatedDefender },
    pendingBattle,
  }
}

const payProjectedSourceHpCost = (
  state: GameState,
  playerId: AttackCommand['playerId'],
  sourceInstanceId: string,
  cost: AbilityCost,
  amount: number,
): GameState | null => {
  if (amount === 0) return state
  const player = state.players[playerId]
  const source = player.battleArea.find(cookie => cookie.card.instanceId === sourceInstanceId)
  // V1 intentionally scores only lines whose source survives payment. The
  // rules may permit paying the final HP; its faint continuation is outside
  // this estimate, so returning null is a scope limit rather than illegality.
  if (!source || source.hpCards.length <= amount) return null
  if (!getHpToTrashCostCandidates(cost, player.battleArea, sourceInstanceId)
    .some(cookie => cookie.card.instanceId === sourceInstanceId)) return null

  const hpAfterCost = source.hpCards.length - amount
  const discardedHpCards = source.hpCards.slice(hpAfterCost)
  return {
    ...state,
    players: {
      ...state.players,
      [playerId]: {
        ...player,
        battleArea: player.battleArea.map(cookie =>
          cookie.card.instanceId === sourceInstanceId
            ? {
                ...cookie,
                hpCards: cookie.hpCards.slice(0, hpAfterCost),
                publicHp: hpAfterCost,
                faceUpHpCardInstanceIds: cookie.faceUpHpCardInstanceIds?.filter(
                  instanceId => !discardedHpCards.some(card => card.instanceId === instanceId),
                ),
              }
            : cookie,
        ),
        discardPile: [...player.discardPile, ...discardedHpCards],
      },
    },
  }
}

/**
 * Values only a simple public optional attack Then that damages the original
 * defender. This is a conditional root-ordering heuristic, not a prediction
 * that traps, FLIPs, or other response branches will allow it to resolve.
 */
export const forecastPublicAttackAftereffectValue = (
  state: GameState,
  declaredState: GameState,
  command: AttackCommand,
): number => {
  const pendingBattle = declaredState.pendingBattle
  const opponentId = getOpponentId(command.playerId)
  const originalSource = state.players[command.playerId].battleArea.find(
    cookie => cookie.card.instanceId === command.attackerInstanceId,
  )
  const originalTarget = state.players[opponentId].battleArea.find(
    cookie => cookie.card.instanceId === command.targetInstanceId,
  )
  if (
    !originalSource || !originalTarget ||
    !pendingBattle ||
    pendingBattle.stage !== 'trap' ||
    pendingBattle.attackerPlayerId !== command.playerId ||
    pendingBattle.defenderPlayerId !== opponentId ||
    pendingBattle.attackerInstanceId !== command.attackerInstanceId ||
    pendingBattle.targetInstanceId !== command.targetInstanceId ||
    pendingBattle.attackEffectIndex !== 0 ||
    pendingBattle.attackEffects.length !== 1
  ) return 0

  const supported = getSupportedAttackAftereffect(pendingBattle.attackEffects[0]!)
  if (!supported) return 0
  const { wrapper, damage } = supported
  const sourceHpCost = supportedSourceHpCost(wrapper.cost)
  if (
    sourceHpCost === null ||
    hasUnsupportedCost(wrapper.cost) ||
    (wrapper.cost.energy !== undefined && getEnergyCostTotal(wrapper.cost.energy) > 0) ||
    Object.entries(wrapper.cost).some(([key, value]) =>
      ENERGY_KEYS.has(key) && typeof value === 'number' && value > 0,
    )
  ) return 0

  const masked = maskGameStateForViewer(
    { ...declaredState, commandLog: undefined },
    command.playerId,
  )
  const projectedSource = masked.players[command.playerId].battleArea.find(
    cookie => cookie.card.instanceId === command.attackerInstanceId,
  )
  const projectedTarget = masked.players[opponentId].battleArea.find(
    cookie => cookie.card.instanceId === command.targetInstanceId,
  )
  if (!projectedSource || !projectedTarget) return 0

  // captureBattleAttackEffectPreventions runs at the normal damage step. Check
  // the public defender restriction now so it is not missed at declaration.
  const attackEffectPrevention = projectedTarget.card.skill?.battleOpponentAttackEffectPrevention
  const attackerLevel = getCookieEffectiveLevel(projectedSource)
  if (
    attackEffectPrevention?.level === attackerLevel ||
    pendingBattle.attackEffectPreventions?.some(
      prevention => prevention.playerId === command.playerId && prevention.level === attackerLevel,
    )
  ) return 0

  const afterNormalDamage = projectNormalAttackDamage(masked, command)
  if (!afterNormalDamage) return 0
  const afterCost = payProjectedSourceHpCost(
    afterNormalDamage,
    command.playerId,
    command.attackerInstanceId,
    wrapper.cost,
    sourceHpCost,
  )
  if (!afterCost) return 0

  const context: EffectContext = {
    sourcePlayerId: command.playerId,
    sourceInstanceId: command.attackerInstanceId,
  }
  const candidates = getEffectTargetCandidates(afterCost, context, damage.target)
  if (candidates.length !== 1) return 0
  const target = candidates[0]!
  const targetHp = getCookieEffectiveHp(target)
  if (targetHp <= 0) return 0
  const damageByTarget = getPublicEffectDamageByTarget(
    afterCost,
    command.playerId,
    context,
    damage,
    [target.card.instanceId],
  )
  const effectDamage = Math.max(0, damageByTarget?.get(target.card.instanceId) ?? 0)
  if (effectDamage <= 0) return 0

  const targetValue =
    Math.min(effectDamage, targetHp) * DAMAGE_VALUE_PER_HP +
    (effectDamage >= targetHp ? KNOCKOUT_BONUS : 0)
  const sourceAfterCost = afterCost.players[command.playerId].battleArea.find(
    cookie => cookie.card.instanceId === command.attackerInstanceId,
  )
  if (!sourceAfterCost) return 0
  const sourceHpAfterCost = getCookieEffectiveHp(sourceAfterCost)
  const sourceRisk = sourceHpAfterCost <= 2 ? LOW_HP_RESERVE_PENALTY : 0
  const netValue = Math.max(0, targetValue - sourceHpCost * HP_COST_VALUE - sourceRisk)
  return Math.round(netValue * OPTIONAL_BRANCH_WEIGHT)
}
