import { describe, expect, it } from 'vitest'
import { createBattleState } from '../../game/test-helpers/battle-helpers'
import { getOptionalCostAttackPrompt } from './optionalCostAttackPrompt'

describe('getOptionalCostAttackPrompt', () => {
  it('names the energy colour so the player knows which support cards to rest', () => {
    const state = createBattleState()
    state.pendingOptionalCostAttack = {
      playerId: 'player-two',
      sourceInstanceId: 'attacker',
      sourceCardName: 'Source Cookie',
      cost: { energy: { blue: 1 } },
      effects: [
        {
          kind: 'damage',
          amount: 1,
          target: { side: 'opponent', min: 1, max: 1 },
        },
      ],
      effectText: '<can be used as {B}.> Deals 2 damage.',
    }

    const prompt = getOptionalCostAttackPrompt(state, 'player-two')

    expect(prompt?.energyCostTotal).toBe(1)
    expect(prompt?.costText).toBe('支付支援區 1 點藍色能量')
  })

  it('describes multi-colour energy and hand discard together', () => {
    const state = createBattleState()
    state.pendingOptionalCostAttack = {
      playerId: 'player-two',
      sourceInstanceId: 'attacker',
      sourceCardName: 'Source Cookie',
      cost: { energy: { red: 2, neutral: 1 }, discardHand: 1 },
      effects: [
        {
          kind: 'damage',
          amount: 1,
          target: { side: 'opponent', min: 1, max: 1 },
        },
      ],
      effectText: 'Pay energy.',
    }

    const prompt = getOptionalCostAttackPrompt(state, 'player-two')

    expect(prompt?.energyCostTotal).toBe(3)
    expect(prompt?.costText).toBe(
      '支付支援區 2 點紅色能量、1 點無色能量、棄置 1 張手牌',
    )
  })

  it('falls back to 無 when the effect genuinely has no cost', () => {
    const state = createBattleState()
    state.pendingOptionalCostAttack = {
      playerId: 'player-two',
      sourceInstanceId: 'attacker',
      sourceCardName: 'Source Cookie',
      cost: { energy: {} },
      effects: [
        {
          kind: 'damage',
          amount: 1,
          target: { side: 'opponent', min: 1, max: 1 },
        },
      ],
      effectText: 'No cost.',
    }

    expect(getOptionalCostAttackPrompt(state, 'player-two')?.costText).toBe('無')
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
