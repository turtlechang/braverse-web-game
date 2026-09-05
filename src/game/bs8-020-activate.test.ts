import { describe, expect, it } from 'vitest'
import { applyGameCommand } from './commands'
import { createCardCheckDemoState, createCardNegativeDemoState } from './demo'
import { getCookieSkillUnavailableReason } from './skills'
import type { GameState } from './types'

const sourceId = (state: GameState) => state.players['player-one'].battleArea[0].card.instanceId
const begin = (state: GameState) => applyGameCommand(state, {
  kind: 'begin-activate-skill', playerId: 'player-one', sourceInstanceId: sourceId(state), trigger: 'activate', paymentIds: [],
})
const resolve = (state: GameState, targetIds: string[]) => applyGameCommand(state, {
  kind: 'resolve-ability-effect', playerId: 'player-one', targetIds,
})

describe('BS8-020 source-only removal at one remaining HP', () => {
  it('explains the unmet HP condition using public remaining HP', () => {
    const state = createCardNegativeDemoState('BS8-020')
    expect(getCookieSkillUnavailableReason(state, 'player-one', sourceId(state), 'activate'))
      .toBe('來源餅乾的剩餘 HP 必須低於 2，目前為 2。')
    const before = structuredClone(state)
    expect(() => begin(state)).toThrow()
    expect(state).toEqual(before)
  })
  it.each([false, true])('moves only the source and its HP without support payment (rested=%s)', (rested) => {
    const state = createCardCheckDemoState('BS8-020')
    const own = state.players['player-one']
    own.battleArea[0].rested = rested
    const source = own.battleArea[0]
    const before = structuredClone(state)
    const next = resolve(begin(state), [source.card.instanceId])
    expect(next.players['player-one'].battleArea).toEqual(own.battleArea.slice(1))
    expect(next.players['player-one'].discardPile).toEqual([...own.discardPile, source.card, ...source.hpCards])
    expect(next.players['player-one'].supportArea).toEqual(own.supportArea)
    expect(next.players['player-one'].breakArea).toEqual(own.breakArea)
    expect(next.players['player-one'].deck).toEqual(own.deck)
    expect(next.pendingFaintEffects).toBeUndefined()
    expect(state).toEqual(before)
  })
  it('auto-selects the source but rejects a teammate, opponent or multiple targets', () => {
    const state = begin(createCardCheckDemoState('BS8-020'))
    const before = structuredClone(state)
    const own = state.players['player-one'].battleArea
    expect(resolve(state, []).players).toEqual(resolve(state, [own[0].card.instanceId]).players)
    for (const ids of [[own[1].card.instanceId], [state.players['player-two'].battleArea[0].card.instanceId], own.map(c => c.card.instanceId)]) {
      expect(() => resolve(state, ids)).toThrow()
    }
    expect(state).toEqual(before)
  })
  it.each(['opponent-turn', 'support-phase'] as const)('rejects activation during %s', (mode) => {
    const state = createCardCheckDemoState('BS8-020')
    if (mode === 'opponent-turn') state.activePlayerId = 'player-two'
    else state.phase = 'support'
    const before = structuredClone(state)
    expect(() => begin(state)).toThrow()
    expect(state).toEqual(before)
  })
})
