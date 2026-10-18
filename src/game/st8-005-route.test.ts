import { describe, expect, it } from 'vitest'
import { createCardCheckDemoState, parseTestStateConfig } from './demo'
import { activate, fixture } from './st8-005-demo'
import { applyGameCommand } from './commands'
import { canActivateCookieSkill } from './skills'

describe('ST8-005 public card test URL', () => {
  it.each(['st8-005', 'ST8-005', 'St8-005', ' ST8-005 '])('resolves %s to the official card number', number => {
    expect(parseTestStateConfig(`?test-state=${encodeURIComponent(`card:${number}`)}`, 'localhost'))
      .toEqual({ kind: 'card-check', cardNumber: 'ST8-005' })
  })

  it('opens an unplayed real Item in hand after promotion', () => {
    expect(createCardCheckDemoState('ST8-005')).toEqual(fixture('manual'))
  })

  it('requires actual Item payment before the free draw skill becomes usable', () => {
    const state = createCardCheckDemoState('ST8-005')
    const own = state.players['player-one']
    const source = own.battleArea[0]
    expect(state.itemsActivatedThisTurn?.['player-one'] ?? 0).toBe(0)
    expect(own.hand.map(card => card.id)).toEqual(['ST1-016'])
    expect(canActivateCookieSkill(state, 'player-one', source.card.instanceId, 'activate')).toBe(false)
    const paid = applyGameCommand(state, { kind: 'play-item', playerId: 'player-one', instanceId: own.hand[0].instanceId,
      paymentIds: own.supportArea.slice(3, 5).map(support => support.card.instanceId), effectTargets: [[]] })
    expect(paid.itemsActivatedThisTurn?.['player-one']).toBe(1)
    expect(canActivateCookieSkill(paid, 'player-one', source.card.instanceId, 'activate')).toBe(true)
    expect(activate(paid).players['player-one'].hand).toHaveLength(1)
  })

  it('opens the real Item activation fixture for the skill surface', () => {
    expect(createCardCheckDemoState('ST8-005', { preferSkillSurface: true })).toEqual(fixture('skill'))
  })
})
