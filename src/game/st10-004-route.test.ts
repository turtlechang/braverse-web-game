import { describe, expect, it } from 'vitest'
import { getBlockerCandidates } from './battle'
import { createCardCheckDemoState, createCardNegativeDemoState } from './demo'

describe('ST10-004 local card-check routes', () => {
  it('opens the real opponent attack and exposes Wizard Cookie when purple payment is available', () => {
    const state = createCardCheckDemoState('ST10-004')
    expect(state.pendingBattle?.stage).toBe('trap')
    expect(getBlockerCandidates(state, 'player-one').map(candidate => candidate.card.id)).toEqual(['ST10-004'])
  })

  it('keeps the real attack but hides Wizard Cookie when purple payment is unavailable', () => {
    const state = createCardNegativeDemoState('ST10-004')
    expect(state.pendingBattle?.stage).toBe('trap')
    expect(getBlockerCandidates(state, 'player-one')).toEqual([])
  })

  it('routes card-attack to Wizard Cookie as the active attacker with both printed energy symbols', () => {
    const state = createCardCheckDemoState('ST10-004', { normalAttack: 'payable' })
    expect(state.activePlayerId).toBe('player-one')
    expect(state.pendingBattle).toBeNull()
    expect(state.players['player-one'].battleArea.map(cookie => cookie.card.id)).toEqual(['ST10-004'])
    expect(state.players['player-one'].supportArea.map(support => support.card.id)).toEqual(['BS9-096', 'ST1-011'])
    expect(state.players['player-two'].battleArea.map(cookie => cookie.card.id)).toEqual(['ST6-003'])
  })

  it('routes card-attack-negative to the same attack with the neutral symbol unavailable', () => {
    const state = createCardNegativeDemoState('ST10-004', { normalAttack: 'blocked' })
    expect(state.activePlayerId).toBe('player-one')
    expect(state.pendingBattle).toBeNull()
    expect(state.players['player-one'].battleArea.map(cookie => cookie.card.id)).toEqual(['ST10-004'])
    expect(state.players['player-one'].supportArea.map(support => support.card.id)).toEqual(['BS9-096'])
    expect(state.players['player-two'].battleArea.map(cookie => cookie.card.id)).toEqual(['ST6-003'])
  })
})
