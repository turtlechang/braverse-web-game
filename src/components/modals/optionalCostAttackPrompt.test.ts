import { describe, expect, it } from 'vitest'
import { createBattleState } from '../../game/test-helpers/battle-helpers'
import { getOptionalCostAttackPrompt } from './optionalCostAttackPrompt'

describe('getOptionalCostAttackPrompt', () => {
  it('does not request support payment when the source covers the full cost', () => {
    const state = createBattleState()
    state.pendingOptionalCostAttack = {
      playerId: 'player-two',
      sourceInstanceId: 'attacker',
      sourceCardName: 'Source Cookie',
      cost: { energy: { blue: 1 } },
      sourceEnergy: { blue: 1 },
      effects: [
        {
          kind: 'damage',
          amount: 1,
          target: { side: 'opponent', min: 1, max: 1 },
        },
      ],
      effectText: 'Use this Cookie as {B}.',
    }

    const prompt = getOptionalCostAttackPrompt(state, 'player-two')

    expect(prompt).toMatchObject({
      energyCostTotal: 0,
      supportCandidates: [],
    })
  })

  it('returns self battle candidates and an optional target minimum', () => {
    const state = createBattleState()
    state.pendingOptionalCostAttack = {
      playerId: 'player-two',
      sourceInstanceId: 'attacker',
      sourceCardName: 'Source Cookie',
      cost: { energy: {}, discardHand: 1 },
      effects: [
        {
          kind: 'gain-hp',
          amount: 1,
          target: { side: 'self', min: 0, max: 1 },
        },
      ],
      effectText: 'Discard 1 card.',
    }

    const prompt = getOptionalCostAttackPrompt(state, 'player-two')

    expect(prompt).toMatchObject({
      needsTarget: true,
      targetMin: 0,
      targetLabel: '己方餅乾',
      targetCandidates: [
        { instanceId: state.players['player-two'].battleArea[0].card.instanceId },
      ],
    })
  })
})
