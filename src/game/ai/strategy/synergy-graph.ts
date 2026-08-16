import type { CardCapabilityModel, CapabilityEvidence, StrategyTag } from './capability-model'

export interface SynergyNode {
  cardId: string
  cardIndex: number
  capabilityIndex: number
  kind: CapabilityEvidence['kind']
  strategyTags: StrategyTag[]
  conditionKinds: string[]
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
