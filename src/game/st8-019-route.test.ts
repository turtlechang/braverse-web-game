import { describe, expect, it } from 'vitest'
import { getTrapCandidates } from './battle'
import { createCardCheckDemoState, createCardNegativeDemoState, parseTestStateConfig } from './demo'
import { createSt8019PreviewState, rawSt8019 } from './st8-019-demo'

describe('ST8-019 candidate Browser routes', () => {
  it('routes positive and negative URLs to original Trap response windows', () => {
    expect(parseTestStateConfig('?test-state=card:ST8-019', 'localhost'))
      .toEqual({ kind: 'card-check', cardNumber: 'ST8-019' })
    expect(parseTestStateConfig('?test-state=card-negative:ST8-019', 'localhost'))
      .toEqual({ kind: 'card-negative', cardNumber: 'ST8-019' })
    expect(createCardCheckDemoState('ST8-019')).toEqual(createSt8019PreviewState('equal-supports'))
    expect(createCardNegativeDemoState('ST8-019'))
      .toEqual(createSt8019PreviewState('unequal-supports'))
  })

  it('uses the printed Trap against an actual four-damage Pudding Cookie attack', () => {
    const equal = createCardCheckDemoState('ST8-019')
    expect(equal.players['player-one'].hand[0]).toMatchObject({
      id: 'ST8-019', name: 'Bad Omen', type: 'trap', imageUrl: rawSt8019.imageUrl,
    })
    expect(equal.pendingBattle).toMatchObject({
      attackerPlayerId: 'player-two', defenderPlayerId: 'player-one', stage: 'trap', declaredDamage: 4,
    })
    expect(equal.players['player-two'].battleArea[0]?.card).toMatchObject({
      id: 'BS1-072', name: 'Pudding Cookie', attack: 4,
    })
    expect(equal.players['player-one'].supportArea).toHaveLength(3)
    expect(equal.players['player-two'].supportArea).toHaveLength(3)
    expect(equal.players['player-one'].supportArea.filter(support =>
      !support.rested && support.card.energyColor === 'green',
    )).toHaveLength(2)

    const unequal = createCardNegativeDemoState('ST8-019')
    expect(unequal.pendingBattle?.stage).toBe('trap')
    expect(unequal.players['player-one'].supportArea).toHaveLength(3)
    expect(unequal.players['player-two'].supportArea).toHaveLength(4)
    expect(getTrapCandidates(unequal, 'player-one').some(card => card.id === 'ST8-019')).toBe(true)

    const noGreen = createSt8019PreviewState('no-green-payment')
    expect(noGreen.pendingBattle?.stage).toBe('trap')
    expect(getTrapCandidates(noGreen, 'player-one').some(card => card.id === 'ST8-019')).toBe(false)
  })
})
