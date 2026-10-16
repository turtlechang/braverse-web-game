import { describe, expect, it } from 'vitest'
import { createCardCheckDemoState, createCardNegativeDemoState, parseTestStateConfig } from './demo'
import { createSt8017PreviewState, rawSt8017 } from './st8-017-demo'

describe('ST8-017 candidate Browser routes', () => {
  it('routes positive and negative URLs to the physical Trap response fixtures', () => {
    expect(parseTestStateConfig('?test-state=card:ST8-017', 'localhost'))
      .toEqual({ kind: 'card-check', cardNumber: 'ST8-017' })
    expect(parseTestStateConfig('?test-state=card-negative:ST8-017', 'localhost'))
      .toEqual({ kind: 'card-negative', cardNumber: 'ST8-017' })
    expect(createCardCheckDemoState('ST8-017')).toEqual(createSt8017PreviewState('positive'))
    expect(createCardNegativeDemoState('ST8-017')).toEqual(createSt8017PreviewState('unequal-supports'))
  })

  it('shows the original Trap in a real battle response window with legal GG payment', () => {
    const state = createCardCheckDemoState('ST8-017')
    const trap = state.players['player-one'].hand[0]
    expect(trap && [trap.id, trap.name, trap.type, trap.imageUrl])
      .toEqual(['ST8-017', 'Hindering Darkness', 'trap', rawSt8017.imageUrl])
    expect(state.pendingBattle).toMatchObject({
      attackerPlayerId: 'player-two', defenderPlayerId: 'player-one', stage: 'trap',
    })
    expect(state.players['player-one'].supportArea.filter(support =>
      !support.rested && support.card.energyColor === 'green',
    )).toHaveLength(2)
  })

  it('keeps the Trap response legal but makes only the equality-gated draw unavailable', () => {
    const state = createCardNegativeDemoState('ST8-017')
    expect(state.players['player-one'].hand[0]?.id).toBe('ST8-017')
    expect(state.players['player-one'].supportArea).toHaveLength(3)
    expect(state.players['player-two'].supportArea).toHaveLength(4)
    expect(state.players['player-one'].supportArea.filter(support =>
      !support.rested && support.card.energyColor === 'green',
    )).toHaveLength(2)
    expect(state.pendingBattle?.stage).toBe('trap')
  })
})
