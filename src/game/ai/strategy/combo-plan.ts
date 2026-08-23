import { getEnergyCostTotal } from '../../energy'
import type { EffectCondition, EnergyCost } from '../../types'
import type { CapabilityKind, StrategyTag } from './capability-model'
import type { SynergyGraph, SynergyNode } from './synergy-graph'

export type ComboPlanValidity = 'same-turn' | 'persistent'

export interface ComboPlan {
  id: string
  setup: SynergyNode
  payoff: SynergyNode
  sharedTags: readonly StrategyTag[]
  payoffEnergyCost: Readonly<EnergyCost>
  payoffCondition?: EffectCondition
  requiredActiveSupport: number
  expectedValue: number
  validity: ComboPlanValidity
}

const ENERGY_KEYS = [
  'red',
  'yellow',
  'green',
  'blue',
  'purple',
  'black',
  'pure',
  'neutral',
] as const

const toEnergyCost = (node: SynergyNode): EnergyCost => {
  const source = node.cost?.energy ?? node.cost
  if (!source) return {}
  return Object.fromEntries(
    ENERGY_KEYS.flatMap((key) => {
      const amount = source[key]
      return typeof amount === 'number' && amount > 0 ? [[key, amount]] : []
    }),
  ) as EnergyCost
}

const capabilityValue: Partial<Record<CapabilityKind, number>> = {
  damage: 24,
  draw: 14,
  discard: 13,
  'gain-hp': 14,
  'attack-modification': 16,
  'effect-damage-modification': 15,
  deploy: 18,
  move: 12,
  'inspect-deck': 10,
  'inspect-hand': 9,
  rest: 11,
  'set-active': 12,
  block: 14,
  trap: 14,
  flip: 12,
  control: 16,
}

const sameEffectBranch = (left: SynergyNode, right: SynergyNode): boolean => {
  if (left.cardIndex !== right.cardIndex) return false
  const minimum = Math.min(left.effectPath.length, right.effectPath.length)
  return left.effectPath.slice(0, minimum).every(
    (segment, index) => segment === right.effectPath[index],
  )
}

const payoffValue = (graph: SynergyGraph, payoff: SynergyNode): number => {
  const payload = graph.nodes.filter((node) =>
    node.kind !== 'conditional-payoff' &&
    node.kind !== 'conditional-setup' &&
    sameEffectBranch(node, payoff),
  )
  return Math.max(
    8,
    payload.reduce((total, node) => total + (capabilityValue[node.kind] ?? 4), 0),
  )
}

const planValidity = (payoff: SynergyNode): ComboPlanValidity =>
  payoff.timing === 'opponent-attack' ||
  payoff.timing === 'faint' ||
  payoff.timing === 'after-damage' ||
  payoff.timing === 'end-phase' ||
  payoff.timing === 'flip' ||
  payoff.timing === 'block' ||
  payoff.timing === 'passive'
    ? 'persistent'
    : 'same-turn'

const planId = (
  setup: SynergyNode,
  payoff: SynergyNode,
  sharedTags: readonly StrategyTag[],
): string => [
  setup.cardId,
  setup.effectPath.join('.'),
  payoff.cardId,
  payoff.effectPath.join('.'),
  [...sharedTags].sort().join('+'),
].join('>')

/**
 * 將 capability graph 轉成與系列、卡號無關的 Combo plan。相同印刷卡的
 * 重複實體會去重；新增卡只要能轉成既有 capability 就會自動參與。
 */
export const buildComboPlans = (graph: SynergyGraph): ComboPlan[] => {
  const plans = new Map<string, ComboPlan>()
  for (const edge of graph.edges) {
    const sharedTags = [...new Set(edge.sharedTags)].sort()
    const id = planId(edge.setup, edge.payoff, sharedTags)
    if (plans.has(id)) continue
    const payoffEnergyCost = toEnergyCost(edge.payoff)
    plans.set(id, {
      id,
      setup: edge.setup,
      payoff: edge.payoff,
      sharedTags,
      payoffEnergyCost,
      payoffCondition: edge.payoff.condition,
      requiredActiveSupport: getEnergyCostTotal(payoffEnergyCost),
      expectedValue: payoffValue(graph, edge.payoff),
      validity: planValidity(edge.payoff),
    })
  }
  return [...plans.values()].sort((left, right) => left.id.localeCompare(right.id))
}
