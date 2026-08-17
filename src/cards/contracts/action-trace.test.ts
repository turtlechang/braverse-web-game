import { describe, expect, it } from 'vitest'
import { buildCardContractActionTrace, traceContainsCommandKinds } from './action-trace'
import type { CommandLogEntry } from '../../game'

describe('card contract action trace', () => {
  it('keeps public steps while excluding raw payload data', () => {
    const entries: CommandLogEntry[] = [
      {
        id: 1,
        turnNumber: 1,
        phase: 'main',
        playerId: 'player-one',
        commandKind: 'activate-skill',
        payload: { handCardIds: ['private-card'] },
        card: { id: 'BS6-101', instanceId: 'x', name: 'fixture', type: 'cookie', level: 1, hp: 2, attack: 1, attackCost: 0, attackEnergyCost: {} },
        steps: [{ text: '支付紫色能量' }],
      },
      {
        id: 2,
        turnNumber: 1,
        phase: 'main',
        playerId: 'player-one',
        commandKind: 'resolve-faint-effect',
        payload: { selectedIds: ['private-card'] },
        card: { id: 'BS6-101', instanceId: 'x', name: 'fixture', type: 'cookie', level: 1, hp: 2, attack: 1, attackCost: 0, attackEnergyCost: {} },
        steps: [{ text: '選擇棄牌區餅乾登場' }],
      },
    ]
    const trace = buildCardContractActionTrace(entries, 'BS6-101')
    expect(trace).toHaveLength(2)
    expect(trace[0]).not.toHaveProperty('payload')
    expect(trace.map((entry) => entry.steps)).toEqual([['支付紫色能量'], ['選擇棄牌區餅乾登場']])
    expect(traceContainsCommandKinds(trace, ['activate-skill', 'resolve-faint-effect'])).toBe(true)
  })
})
