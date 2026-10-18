import { describe, expect, it } from 'vitest'
import { getBlockerCandidates } from './battle'
import { createCardCheckDemoState, createCardNegativeDemoState } from './demo'

describe('ST9-004–006 physical demo routes', () => {
  it('routes ST9-004 to the real FLIP HP and exposes a distinct insufficient-BBB path', () => {
    const positive = createCardCheckDemoState('ST9-004')
    expect(positive.players['player-one'].battleArea[0]?.card.id).toBe('ST9-004')
    expect(positive.players['player-two'].battleArea[0]?.hpCards.map(card => card.id)).toContain('ST9-004')

    const negative = createCardNegativeDemoState('ST9-004')
    expect(negative.players['player-one'].supportArea).toHaveLength(2)
    expect(createCardCheckDemoState('ST9-004', { normalAttack: 'blocked' }).players['player-one'].supportArea)
      .toHaveLength(2)
  })

  it('routes ST9-005 to an actual attack response with legal and illegal blue payment', () => {
    const positive = createCardCheckDemoState('ST9-005')
    expect(positive.pendingBattle?.stage).toBe('trap')
    expect(getBlockerCandidates(positive, 'player-one').map(cookie => cookie.card.id)).toEqual(['ST9-005'])

    const negative = createCardNegativeDemoState('ST9-005')
    expect(negative.pendingBattle?.stage).toBe('trap')
    expect(getBlockerCandidates(negative, 'player-one')).toEqual([])
  })

  it('routes ST9-006 through its hand threshold and attack payment cases', () => {
    const positive = createCardCheckDemoState('ST9-006')
    expect(positive.players['player-one'].hand).toHaveLength(5)
    expect(positive.players['player-one'].battleArea[0]?.card.id).toBe('ST9-006')
    expect(positive.players['player-one'].supportArea).toHaveLength(3)

    const highHand = createCardNegativeDemoState('ST9-006')
    expect(highHand.players['player-one'].hand).toHaveLength(6)
    const attackNegative = createCardNegativeDemoState('ST9-006', { normalAttack: 'blocked' })
    expect(attackNegative.players['player-one'].hand).toHaveLength(5)
    expect(attackNegative.players['player-one'].supportArea).toHaveLength(2)
    const insufficientEnergy = createCardCheckDemoState('ST9-006', { normalAttack: 'blocked' })
    expect(insufficientEnergy.players['player-one'].supportArea).toHaveLength(2)
  })
})
