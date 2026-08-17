import { describe, expect, it } from 'vitest'
import { describePendingDecision } from './decision-descriptor'
import type { PendingDecision } from './commands'

const base = {
  playerId: 'player-one' as const,
  sourcePlayerId: 'player-one' as const,
  sourceInstanceId: 'fixture:1',
  sourceCardName: 'fixture',
}

describe('shared decision descriptor', () => {
  it('exposes target limits and the one legal command for faint effects', () => {
    const decision: PendingDecision = {
      kind: 'faint-effect',
      ...base,
      min: 0,
      max: 1,
    }
    const descriptor = describePendingDecision(decision, ['cookie:1'])
    expect(descriptor?.steps[0]).toMatchObject({
      kind: 'target',
      required: false,
      min: 0,
      max: 1,
      candidateIds: ['cookie:1'],
      commandKinds: ['resolve-faint-effect'],
    })
  })

  it('represents optional payment as a choice instead of forcing a cost', () => {
    const decision: PendingDecision = {
      kind: 'optional-cost-attack',
      ...base,
      cost: { energy: { purple: 1 } },
      effects: [],
      effectText: 'fixture',
    }
    const descriptor = describePendingDecision(decision)
    expect(descriptor?.steps[0]).toMatchObject({
      kind: 'payment',
      required: false,
      commandKinds: ['resolve-optional-cost-attack'],
    })
  })
})
