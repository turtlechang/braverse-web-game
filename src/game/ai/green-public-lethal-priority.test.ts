import { describe, expect, it } from 'vitest'
import { takeAiStep, type AiStrategyMemory } from '../ai'
import type { GameState } from '../types'
import fixture from './fixtures/public-lethal-over-followup-203970800.json'

type CardDefinition = Record<string, unknown>
const cardDefinitions = fixture.cardDefinitions as Record<string, CardDefinition>

const restore = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(restore)
  if (!value || typeof value !== 'object') return value

  const record = value as Record<string, unknown>
  if (typeof record.cardRef === 'string') {
    const definition = cardDefinitions[record.cardRef]
    if (!definition) throw new Error(`Missing card definition: ${record.cardRef}`)
    return {
      ...structuredClone(definition),
      instanceId: record.instanceId,
      ...(typeof record.level === 'number' ? { level: record.level } : {}),
    }
  }

  return Object.fromEntries(Object.entries(record).map(([key, child]) => [key, restore(child)]))
}

describe('Lv.3 public lethal priority', () => {
  it('does not let a forecast support-cost follow-up overrule a public knockout', () => {
    const state = restore(fixture.state) as GameState
    const decision = takeAiStep(state, 'player-two', {
      level: 3,
      searchNow: () => 0,
      memory: structuredClone(fixture.strategyMemory) as unknown as AiStrategyMemory,
    })

    expect(decision.action).toBe('attack')
    expect(decision.state.pendingBattle).toMatchObject({
      attackerInstanceId: 'player-two-BS7-059-1',
      targetInstanceId: 'player-one-BS12-071-1',
    })
    expect(decision.reason?.actionScore?.calibrated.publicLethal).toBe(true)
  })
})
