/// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { applyGameCommand } from '../game/commands'
import { maskGameStateForViewer } from '../game/masked-state'
import { createBattleState } from '../game/test-helpers/battle-helpers'
import { useOnlinePendingEffect } from './useOnlinePendingEffect'
import type { DispatchGameCommand } from './useBattleActions'
import type { PlayerId } from '../game'

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true
afterEach(() => vi.useRealTimers())

describe('online private HP inspection', () => {
  it('opens only after the server result, never from a concealed pile or a rejected submission', async () => {
    vi.useFakeTimers()
    const state = createBattleState()
    state.activePlayerId = 'player-one'
    state.pendingAbilityEffect = {
      playerId: 'player-one', sourcePlayerId: 'player-one', sourceInstanceId: 'defender',
      sourceKind: 'skill', effects: [{ kind: 'view-hp', target: { side: 'self', min: 0, max: 1 } }], effectIndex: 0,
    }
    let viewer: PlayerId = 'player-one'
    let game = maskGameStateForViewer(state, viewer)
    const inspected = vi.fn()
    const dispatch = vi.fn<DispatchGameCommand>()
    let captured: ReturnType<typeof useOnlinePendingEffect> | null = null
    function Harness() {
      captured = useOnlinePendingEffect({ game, viewerPlayerId: viewer, dispatch, hasFaint: false, hasAfterDamage: false, setInspectedHpPile: inspected })
      return null
    }
    const root = createRoot(document.createElement('div'))
    await act(() => root.render(<Harness />))
    await act(() => vi.advanceTimersByTime(0))
    await act(() => captured!.toggleTarget('defender'))
    await act(() => captured!.confirmEffect())
    expect(dispatch).toHaveBeenCalledWith({ kind: 'resolve-ability-effect', playerId: 'player-one', targetIds: ['defender'] }, expect.any(String))
    await act(() => vi.advanceTimersByTime(2000))
    expect(inspected).not.toHaveBeenCalled()
    const acknowledged = applyGameCommand(state, { kind: 'resolve-ability-effect', playerId: 'player-one', targetIds: ['defender'] })
    game = maskGameStateForViewer(acknowledged, viewer)
    await act(() => root.render(<Harness />))
    await act(() => vi.advanceTimersByTime(0))
    expect(inspected).toHaveBeenCalledExactlyOnceWith({ title: 'defender的 HP 卡', cards: state.players['player-one'].battleArea[0].hpCards })
    game = structuredClone(game)
    await act(() => root.render(<Harness />))
    await act(() => vi.advanceTimersByTime(0))
    expect(inspected).toHaveBeenCalledTimes(1)
    viewer = 'player-two'
    game = maskGameStateForViewer(acknowledged, viewer)
    await act(() => root.render(<Harness />))
    await act(() => vi.advanceTimersByTime(0))
    expect(inspected).toHaveBeenCalledTimes(1)
    await act(() => root.unmount())
  })
})
