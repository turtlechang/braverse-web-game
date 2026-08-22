import type { AbilityCost } from '../../types'
import type {
  CapabilityCertainty,
  CapabilityTiming,
  CardCapabilityModel,
  CapabilityEvidence,
  StrategyTag,
  StrategyZone,
} from './capability-model'

export interface SynergyNode {
  cardId: string
  cardIndex: number
  capabilityIndex: number
  kind: CapabilityEvidence['kind']
  strategyTags: StrategyTag[]
  conditionKinds: string[]
  timing: CapabilityTiming
  cost: AbilityCost | null
  certainty: CapabilityCertainty
  sourceZone?: StrategyZone
  destinationZone?: StrategyZone
  effectPath: number[]
}

export interface SynergyEdge {
  setup: SynergyNode
  payoff: SynergyNode
  sharedTags: StrategyTag[]
}

export interface SynergyGraph {
  nodes: SynergyNode[]
  edges: SynergyEdge[]
  unresolvedPayoffs: SynergyNode[]
}

const toNode = (
  card: CardCapabilityModel,
  capability: CapabilityEvidence,
  capabilityIndex: number,
): SynergyNode => ({
  cardId: card.cardId,
  cardIndex: card.cardIndex,
  capabilityIndex,
  kind: capability.kind,
  strategyTags: capability.strategyTags,
  conditionKinds: capability.conditionKinds,
  timing: capability.timing,
  cost: capability.cost,
  certainty: capability.certainty,
  sourceZone: capability.sourceZone,
  destinationZone: capability.destinationZone,
  effectPath: capability.effectPath,
})

const isSetup = (node: SynergyNode): boolean =>
  node.kind === 'conditional-setup'

const isPayoff = (node: SynergyNode): boolean =>
  node.kind === 'conditional-payoff'

export const buildSynergyGraph = (
  cards: readonly CardCapabilityModel[],
): SynergyGraph => {
  const nodes = cards.flatMap((card) =>
    card.capabilities.map((capability, capabilityIndex) =>
      toNode(card, capability, capabilityIndex),
    ),
  )
  const setups = nodes.filter(isSetup)
  const payoffs = nodes.filter(isPayoff)
  const edges: SynergyEdge[] = []
  const resolvedPayoffs = new Set<number>()
  for (const payoff of payoffs) {
    for (const setup of setups) {
      const sharedTags = setup.strategyTags.filter((tag) => payoff.strategyTags.includes(tag))
      if (sharedTags.length === 0) continue
      // 同一卡片同一效果同時產生 setup/payoff evidence 時，不代表它能在
      // 條件檢查前先完成自己的前置。排除這種自我循環，避免假 Combo。
      if (
        setup.cardIndex === payoff.cardIndex &&
        setup.effectPath.join('.') === payoff.effectPath.join('.')
      ) continue
      edges.push({ setup, payoff, sharedTags })
      resolvedPayoffs.add(nodes.indexOf(payoff))
    }
  }
  return {
    nodes,
    edges,
    unresolvedPayoffs: payoffs.filter((payoff) => !resolvedPayoffs.has(nodes.indexOf(payoff))),
  }
}
