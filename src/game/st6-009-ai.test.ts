import { describe, expect, it } from 'vitest'
import { createSt6009PreviewState } from './st6-009-demo'
import { takeAiStep } from './ai'

describe('ST6-009 actual AI paid lethal Activate', () => {
  it.each([4, 5] as const)('Lv.%s uses R plus one discard to faint a one-HP opponent', level => {
    const state = createSt6009PreviewState('low'), before = structuredClone(state)
    const targetId = state.players['player-two'].battleArea[0].card.instanceId
    expect(state.players['player-one'].supportArea.filter(s => !s.rested)).toHaveLength(2)
    const decision = takeAiStep(state, 'player-one', { level, seed: 2026101109, searchNow: () => 0 })
    const command = decision.state.commandLog?.slice(state.commandLog?.length ?? 0)
      .find(entry => entry.commandKind === 'activate-skill')?.payload
    expect(command?.kind).toBe('activate-skill')
    if (command?.kind !== 'activate-skill') throw new Error('Expected actual paid Activate command')
    expect(command.sourceInstanceId).toBe(state.players['player-one'].battleArea[0].card.instanceId)
    expect(command.paymentIds).toHaveLength(1)
    expect(command.discardHandIds).toEqual([state.players['player-one'].hand[0].instanceId])
    expect(command.effectTargets).toEqual([[targetId]])
    expect(decision.state.players['player-two'].breakArea.map(c => c.instanceId)).toContain(targetId)
    expect(decision.state.players['player-one'].hand).toEqual([])
    expect(state).toEqual(before)
  })
})
