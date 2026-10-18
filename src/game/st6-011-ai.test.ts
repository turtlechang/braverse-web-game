import { describe, expect, it } from 'vitest'
import { createSt6011PreviewState } from './st6-011-demo'
import { takeAiStep } from './ai'
import { applyGameCommand as apply } from './commands'

describe('ST6-011 AI actual neutral-one lethal attack', () => {
  it.each([4, 5] as const)('Lv.%s spends one support to faint the one-HP opponent', level => {
    const state = createSt6011PreviewState('low'), before = structuredClone(state)
    const own = state.players['player-one'], targetId = state.players['player-two'].battleArea[0].card.instanceId
    const decision = takeAiStep(state, 'player-one', { level, seed: 2026101111, searchNow: () => 0 })
    const command = decision.state.commandLog?.slice(state.commandLog?.length ?? 0)
      .find(entry => entry.commandKind === 'declare-attack')?.payload
    expect(decision.action).toBe('attack')
    if (command?.kind !== 'declare-attack') throw new Error('Expected actual paid attack command')
    expect(command.attackerInstanceId).toBe(own.battleArea[0].card.instanceId)
    expect(command.targetInstanceId).toBe(targetId)
    expect(command.supportPaymentIds).toHaveLength(1)
    let next = apply(apply(decision.state, { kind: 'skip-trap', playerId: 'player-two' }),
      { kind: 'resolve-battle', playerId: 'player-one' })
    if (next.pendingReplacement) next = apply(next, { kind: 'skip-replacement', playerId: 'player-two' })
    expect(next.players['player-two'].breakArea.map(c => c.instanceId)).toContain(targetId)
    expect(next.pendingBattle).toBeNull()
    expect(next.pendingReplacement).toBeNull()
    expect(state).toEqual(before)
  })
})
