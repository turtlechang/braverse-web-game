import { describe, expect, it } from 'vitest'
import type { SynergyGraph, SynergyNode } from './synergy-graph'
import { buildComboPlans } from './combo-plan'

const node = (overrides: Partial<SynergyNode>): SynergyNode => ({
  cardId: 'fixture',
  cardIndex: 0,
  capabilityIndex: 0,
  kind: 'conditional-setup',
  strategyTags: ['support'],
  conditionKinds: [],
  timing: 'activate',
  cost: null,
  certainty: 'confirmed',
  effectPath: [0],
  ...overrides,
})

describe('Lv.5 generic ComboPlan', () => {
  it('以 capability 邊建立穩定 plan、去除重複實體並保留 payoff 費用', () => {
    const setup = node({ cardId: 'setup-card', cardIndex: 0 })
    const payoff = node({
      cardId: 'payoff-card',
      cardIndex: 1,
      kind: 'conditional-payoff',
      conditionKinds: ['support-count-at-least'],
      cost: { energy: { blue: 1, neutral: 1 } },
      certainty: 'conditional',
      effectPath: [1],
    })
    const damage = node({
      cardId: 'payoff-card',
      cardIndex: 1,
      capabilityIndex: 1,
      kind: 'damage',
      strategyTags: ['opponent-board'],
      effectPath: [1],
    })
    const graph: SynergyGraph = {
      nodes: [setup, payoff, damage],
      edges: [
        { setup, payoff, sharedTags: ['support'] },
        { setup, payoff, sharedTags: ['support'] },
      ],
      unresolvedPayoffs: [],
    }

    const plans = buildComboPlans(graph)
    expect(plans).toHaveLength(1)
    expect(plans[0]).toMatchObject({
      setup: { cardId: 'setup-card' },
      payoff: { cardId: 'payoff-card' },
      payoffEnergyCost: { blue: 1, neutral: 1 },
      requiredActiveSupport: 2,
      validity: 'same-turn',
    })
    expect(plans[0]?.expectedValue).toBeGreaterThanOrEqual(24)
  })
})
