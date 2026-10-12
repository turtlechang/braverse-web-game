import { getLegalTurnCommands } from '../legal-actions'
import { getAttackDamageAgainst } from '../effects'
import { getCookieEffectiveLevel, getOpponentId } from '../helpers'
import { maskGameStateForViewer } from '../masked-state'
import type { AttackCommand, PlayerActionCommand } from '../commands'
import type { GameState, PlayerId } from '../types'

interface Potential { value: number; attacks: number }
const commandKey = (command: AttackCommand) => JSON.stringify([
  command.attackerInstanceId, command.targetInstanceId, [...command.supportPaymentIds].sort(),
])
const attackCommands = (state: GameState, playerId: PlayerId) =>
  getLegalTurnCommands(state, playerId).filter((c): c is AttackCommand => c.kind === 'attack')

/** Conditional normal-damage allocation, never a settlement or a guaranteed win.
 * Unknown FLIP/Trap/Then/faint outcomes are not executed. The real response window
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
          const damage = Math.min(target.hpCards.length, Math.max(0,
            getAttackDamageAgainst(current, attack.attackerInstanceId, attack.targetInstanceId)))
          const knockedOut = damage > 0 && damage === target.hpCards.length
          const paid = new Set(attack.supportPaymentIds)
          const next: GameState = { ...current, players: { ...current.players,
            [playerId]: { ...current.players[playerId],
              supportArea: current.players[playerId].supportArea.map(s => paid.has(s.card.instanceId) ? { ...s, rested: true } : s),
              battleArea: current.players[playerId].battleArea.map(c => c.card.instanceId === attack.attackerInstanceId ? { ...c, rested: true } : c),
            },
            [opponentId]: { ...current.players[opponentId],
              battleArea: current.players[opponentId].battleArea.flatMap(c => c.card.instanceId !== target.card.instanceId ? [c]
                : knockedOut ? [] : [{ ...c, hpCards: c.hpCards.slice(0, c.hpCards.length - damage) }]),
              breakArea: knockedOut ? [...current.players[opponentId].breakArea, target.card] : current.players[opponentId].breakArea,
            },
          } }
          // Ordinary damage is already scored by the existing target/risk model.
          // Allocation only compares knockout opportunity; equal knockouts must
          // not reward a more fragile sequence merely for removing more HP.
          return { state: next, damage, value: knockedOut ? 80 + getCookieEffectiveLevel(target) * 20 : 0 }
        }
        const bestRemaining = (current: GameState, depth: number): Potential => {
          if (options.shouldStop?.()) { truncated = true; return { value: 0, attacks: 0 } }
          if (depth >= 3 || !current.players[opponentId].battleArea.length) return { value: 0, attacks: 0 }
          const key = JSON.stringify([
            current.players[playerId].battleArea.map(c => [c.card.instanceId, c.rested]),
            current.players[playerId].supportArea.map(s => [s.card.instanceId, s.rested]),
            current.players[opponentId].battleArea.map(c => [c.card.instanceId, c.hpCards.length]),
          ])
          const found = memo.get(key)
          if (found) return found
          if (++nodes > (options.nodeBudget ?? 256)) { truncated = true; return { value: 0, attacks: 0 } }
          let best: Potential = { value: 0, attacks: 0 }
          for (const attack of attackCommands(current, playerId)) {
            const next = applyNormalPotential(current, attack)
            if (next.damage === 0) continue
            const rest = bestRemaining(next.state, depth + 1)
            const result = { value: next.value + rest.value, attacks: 1 + rest.attacks }
            if (result.value > best.value || (result.value === best.value && result.attacks > best.attacks)) best = result
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
          results.push({ key: commandKey(attack), value: first.value + rest.value, attacks: 1 + rest.attacks })
          if (truncated) break
        }
        const best = Math.max(...results.map(r => r.value))
        cache.set(playerId, truncated || !results.some(r => r.attacks >= 2) ? null
          : new Map(results.map(r => [r.key, Math.max(-240, r.value - best)])))
      }
    }
    const amount = cache.get(playerId)?.get(commandKey(command)) ?? 0
    return amount === 0 ? null : { id: 'attack-allocation' as const, amount,
      detail: '公開普通傷害的條件式擊倒分配：避免溢傷造成擊倒損失；同等擊倒收益交回既有風險評估，不重複獎勵HP傷害；未假設未知FLIP／陷阱／Then結算。' }
  }
}
