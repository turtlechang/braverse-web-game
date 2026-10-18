import { getLegalTurnCommands } from '../legal-actions'
import { getAttackDamageAgainst, isEffectConditionMet, isOpponentDamagePrevented } from '../effects'
import { getEffectTargetCandidates } from '../effects/targeting'
import { getCookieEffectiveHp, getCookieEffectiveLevel, getOpponentId } from '../helpers'
import { maskGameStateForViewer } from '../masked-state'
import type { AttackCommand, PlayerActionCommand } from '../commands'
import type { GameState, PlayerId } from '../types'
import { getBreakAreaLevel } from '../victory'
import { getPublicEffectDamageByTarget } from './public-effect-damage'

interface Potential { value: number; attacks: number; breakLimit: boolean }
// Lv.4/5's legacy single-knockout bonus alone exceeds 350. Losing a public
// Break-limit line needs its own bounded penalty, above that ordinary reward;
// it is still a relative estimate and never sets terminalOutcome to 'win'.
const MISSED_BREAK_LIMIT_PENALTY = 600
const commandKey = (command: AttackCommand) => JSON.stringify([
  command.attackerInstanceId, command.targetInstanceId, [...command.supportPaymentIds].sort(),
])
const attackCommands = (state: GameState, playerId: PlayerId) =>
  getLegalTurnCommands(state, playerId).filter((c): c is AttackCommand => c.kind === 'attack')

/** Conditional public damage allocation, never a settlement or a guaranteed win.
 * Only one static, original-target Then with a public battle condition is projected.
 * Unknown FLIP/Trap/other Then/faint outcomes are not executed. The real response window
 * remains authoritative. Budget exhaustion declines the complete assessment.
 */
export const createPublicAttackAllocationForecast = (options: { nodeBudget?: number; shouldStop?: () => boolean } = {}) => {
  const caches = new WeakMap<GameState, Map<PlayerId, Map<string, number> | null>>()
  return (state: GameState, playerId: PlayerId, command: PlayerActionCommand) => {
    if (command.kind !== 'attack') return null
    let cache = caches.get(state)
    if (!cache) { cache = new Map(); caches.set(state, cache) }
    if (!cache.has(playerId)) {
      const publicState = maskGameStateForViewer({ ...state, commandLog: undefined }, playerId)
      const initial = attackCommands(publicState, playerId)
      if (new Set(initial.map(c => c.attackerInstanceId)).size < 2) cache.set(playerId, null)
      else {
        let nodes = 0, truncated = false
        const memo = new Map<string, Potential>()
        const opponentId = getOpponentId(playerId)
        const applyNormalPotential = (current: GameState, attack: AttackCommand): { state: GameState; value: number; damage: number } => {
          const target = current.players[opponentId].battleArea.find(c => c.card.instanceId === attack.targetInstanceId)!
          const attacker = current.players[playerId].battleArea.find(c => c.card.instanceId === attack.attackerInstanceId)!
          let damage = Math.min(getCookieEffectiveHp(target), isOpponentDamagePrevented(current, attack.targetInstanceId, playerId) ? 0 : Math.max(0,
            getAttackDamageAgainst(current, attack.attackerInstanceId, attack.targetInstanceId)))
          let knockedOut = damage > 0 && damage === getCookieEffectiveHp(target)
          const paid = new Set(attack.supportPaymentIds)
          let next: GameState = { ...current, players: { ...current.players,
            [playerId]: { ...current.players[playerId],
              supportArea: current.players[playerId].supportArea.map(s => paid.has(s.card.instanceId) ? { ...s, rested: true } : s),
              battleArea: current.players[playerId].battleArea.map(c => c.card.instanceId === attack.attackerInstanceId ? { ...c, rested: true } : c),
            },
            [opponentId]: { ...current.players[opponentId],
              battleArea: current.players[opponentId].battleArea.flatMap(c => c.card.instanceId !== target.card.instanceId ? [c]
                : knockedOut ? [] : [{ ...c, hpCards: c.hpCards.slice(0, getCookieEffectiveHp(c) - damage), publicHp: getCookieEffectiveHp(c) - damage }]),
              breakArea: knockedOut ? [...current.players[opponentId].breakArea, target.card] : current.players[opponentId].breakArea,
            },
          } }
          const effects = attacker.card.attackEffects ?? []
          const effect = effects.length === 1 ? effects[0] : undefined
          if (!knockedOut && effect?.kind === 'damage' && Number.isInteger(effect.amount) && effect.amount > 0 &&
            effect.target.side === 'opponent' && effect.target.attackTargetOnly === true &&
            effect.target.min === 1 && effect.target.max === 1 &&
            !effect.selectionAsCost &&
            (!effect.condition || effect.condition.kind === 'battle-area-has-keyword') &&
            target.card.skill?.battleOpponentAttackEffectPrevention?.level !== getCookieEffectiveLevel(attacker)) {
            // Bind attackTargetOnly to this original recipient. HP counts and
            // the already rested attackers reflect the preceding public damage.
            const context = { sourcePlayerId: playerId, sourceInstanceId: attacker.card.instanceId }
            const effectState: GameState = { ...next, pendingBattle: {
              attackerPlayerId: playerId, defenderPlayerId: opponentId,
              attackerInstanceId: attacker.card.instanceId, targetInstanceId: target.card.instanceId,
              declaredDamage: damage, remainingDamage: 0, stage: 'attack-effect', trapUsed: false,
              revealedHpCard: null, preventKnockoutTargetIds: [], faintedColors: [],
              attackEffects: effects, attackEffectIndex: 0,
            } }
            if (isEffectConditionMet(effectState, context, effect) &&
              getEffectTargetCandidates(effectState, context, effect.target).some(c => c.card.instanceId === target.card.instanceId)) {
              const remainingHp = getCookieEffectiveHp(target) - damage
              const extra = Math.min(remainingHp, Math.max(0, getPublicEffectDamageByTarget(
                effectState, playerId, context, effect, [target.card.instanceId],
              )?.get(target.card.instanceId) ?? 0))
              damage += extra
              knockedOut = extra > 0 && extra === remainingHp
              next = { ...next, players: { ...next.players, [opponentId]: { ...next.players[opponentId],
                battleArea: next.players[opponentId].battleArea.flatMap(c => c.card.instanceId !== target.card.instanceId ? [c]
                  : knockedOut ? [] : [{ ...c, hpCards: c.hpCards.slice(0, remainingHp - extra), publicHp: remainingHp - extra }]),
                breakArea: knockedOut ? [...next.players[opponentId].breakArea, target.card] : next.players[opponentId].breakArea,
              } } }
            }
          }
          // Ordinary damage is already scored by the existing target/risk model.
          // Allocation only compares knockout opportunity; equal knockouts must
          // not reward a more fragile sequence merely for removing more HP.
          return { state: next, damage, value: knockedOut ? 80 + getCookieEffectiveLevel(target) * 20 : 0 }
        }
        const bestRemaining = (current: GameState, depth: number): Potential => {
          const breakLimit = getBreakAreaLevel(current, opponentId) >= 10
          if (options.shouldStop?.()) { truncated = true; return { value: 0, attacks: 0, breakLimit } }
          if (breakLimit || depth >= 3 || !current.players[opponentId].battleArea.length) return { value: 0, attacks: 0, breakLimit }
          const key = JSON.stringify([
            current.players[playerId].battleArea.map(c => [c.card.instanceId, c.rested]),
            current.players[playerId].supportArea.map(s => [s.card.instanceId, s.rested]),
            current.players[opponentId].battleArea.map(c => [c.card.instanceId, c.hpCards.length]),
            getBreakAreaLevel(current, opponentId),
          ])
          const found = memo.get(key)
          if (found) return found
          if (++nodes > (options.nodeBudget ?? 256)) { truncated = true; return { value: 0, attacks: 0, breakLimit: false } }
          let best: Potential = { value: 0, attacks: 0, breakLimit: false }
          for (const attack of attackCommands(current, playerId)) {
            const next = applyNormalPotential(current, attack)
            const rest = bestRemaining(next.state, depth + 1)
            const result = { value: next.value + rest.value, attacks: 1 + rest.attacks, breakLimit: rest.breakLimit }
            if ((result.breakLimit && !best.breakLimit) || (result.breakLimit === best.breakLimit &&
              (result.value > best.value || (result.value === best.value && result.attacks > best.attacks)))) best = result
            if (truncated) break
          }
          memo.set(key, best)
          return best
        }
        const results = []
        for (const attack of initial) {
          if (options.shouldStop?.()) { truncated = true; break }
          const first = applyNormalPotential(publicState, attack)
          const rest = bestRemaining(first.state, 1)
          results.push({ key: commandKey(attack), value: first.value + rest.value, attacks: 1 + rest.attacks, breakLimit: rest.breakLimit })
          if (truncated) break
        }
        const hasBreakLimit = results.some(r => r.breakLimit)
        const best = Math.max(...results.filter(r => !hasBreakLimit || r.breakLimit).map(r => r.value))
        cache.set(playerId, truncated || !results.some(r => r.attacks >= 2) ? null
          : new Map(results.map(r => [r.key, hasBreakLimit && !r.breakLimit ? -MISSED_BREAK_LIMIT_PENALTY : Math.max(-240, Math.min(0, r.value - best))])))
      }
    }
    const amount = cache.get(playerId)?.get(commandKey(command)) ?? 0
    return amount === 0 ? null : { id: 'attack-allocation' as const, amount,
      detail: '公開普通傷害與單段原攻擊對象Then的條件式擊倒分配：優先保留可達Break上限的順序，同等擊倒收益交回既有風險評估；未結算未知FLIP／陷阱／其他Then。' }
  }
}
