import { describe, expect, it } from 'vitest'
import { createCardCheckDemoState, parseTestStateConfig } from './demo'
import { applyGameCommand } from './commands'

describe('ST8-004 hand deployment test entry', () => {
  it('starts the generic card URL in hand and deploys with five original HP', () => {
    const config = parseTestStateConfig('?test-state=card:ST8-004', 'localhost')
    expect(config).toEqual({ kind: 'card-check', cardNumber: 'ST8-004' })
    const state = createCardCheckDemoState('ST8-004')
    const source = state.players['player-one'].hand.find(card => card.id === 'ST8-004')
    expect(source).toBeDefined()
    if (!source) throw Error('ST8-004 must start in hand')
    expect(state.players['player-one'].battleArea.some(cookie => cookie.card.id === 'ST8-004')).toBe(false)
    const before = structuredClone(state)
    const next = applyGameCommand(state, { kind: 'deploy-cookie', playerId: 'player-one', instanceId: source.instanceId })
    expect(next.players['player-one'].battleArea.find(cookie => cookie.card.id === 'ST8-004')?.hpCards).toHaveLength(5)
    expect(next.players['player-one'].hand.some(card => card.instanceId === source.instanceId)).toBe(false)
    expect(next.players['player-one'].deck).toHaveLength(before.players['player-one'].deck.length - 5)
    expect(state).toEqual(before)
  })
})
