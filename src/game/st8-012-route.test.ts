import { describe, expect, it } from 'vitest'
import { createCardCheckDemoState, createCardNegativeDemoState, parseTestStateConfig } from './demo'
import { createSt8012PreviewState } from './st8-012-demo'
import { canActivateCookieSkill } from './skills'

describe('ST8-012 candidate preview Browser routes', () => {
  it('routes the standard positive and negative card URLs to isolated original-card fixtures', () => {
    expect(parseTestStateConfig('?test-state=card:ST8-012', 'localhost'))
      .toEqual({ kind: 'card-check', cardNumber: 'ST8-012' })
    expect(parseTestStateConfig('?test-state=card-negative:ST8-012', 'localhost'))
      .toEqual({ kind: 'card-negative', cardNumber: 'ST8-012' })
    expect(createCardCheckDemoState('ST8-012')).toEqual(createSt8012PreviewState('positive'))
    expect(createCardNegativeDemoState('ST8-012')).toEqual(createSt8012PreviewState('no-item'))
  })

  it('keeps the no-Item branch activatable and exposes only the independent Then', () => {
    const state = createCardNegativeDemoState('ST8-012')
    const source = state.players['player-one'].battleArea.find(cookie => cookie.card.id === 'ST8-012')
    expect(source).toBeDefined()
    expect(state.itemsActivatedThisTurn?.['player-one'] ?? 0).toBe(0)
    expect(canActivateCookieSkill(state, 'player-one', source!.card.instanceId, 'activate')).toBe(true)
  })
})
