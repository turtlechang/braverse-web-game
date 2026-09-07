/// @vitest-environment jsdom
import { act, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { applyGameCommand, type GameCommand } from '../game'
import { createBs8ExtraDeckDemoState } from '../game/demo'
import type { DispatchGameCommand } from './useBattleActions'
import { usePendingEffect } from './usePendingEffect'

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true
afterEach(() => vi.useRealTimers())

describe('BS8-069 optional OnPlay choice', () => {
  it.each(['zero', 'skip'] as const)('%s clears the authoritative prompt without moving a card or reopening', async (choice) => {
    vi.useFakeTimers()
    const fixture = createBs8ExtraDeckDemoState(true, 'BS8-069')
    const source = fixture.players['player-one'].extraDeck![0]
    const initial = applyGameCommand(fixture, {
      kind: 'play-extra-deck-cookie', playerId: 'player-one', instanceId: source.instanceId,
    })
    expect(initial.pendingOnPlay).toBeTruthy()
    let current = initial
    let captured: ReturnType<typeof usePendingEffect> | null = null
    const commands: GameCommand[] = []
    function Harness() {
      const [game, setGame] = useState(initial)
      current = game
      const dispatch: DispatchGameCommand = (input, _message, onSuccess) => {
        const batch = Array.isArray(input) ? input : [input]
        commands.push(...batch)
        const next = batch.reduce((state, command) => applyGameCommand(state, command), game)
        setGame(next)
        onSuccess?.(next)
      }
      captured = usePendingEffect({
        game, setGame, dispatch, viewerPlayerId: 'player-one', setMessage: () => {},
        clearAttacker: () => {}, setInspectedHpPile: () => {}, hasFaint: false,
        faintTargetIds: new Set(), selectedFaintTargetIds: [], faintMinMax: { min: 0, max: 0 },
        setSelectedFaintTargetIds: () => {}, hasAfterDamage: false,
        afterDamageTargetIds: new Set(), selectedAfterDamageTargetIds: [],
        afterDamageMinMax: { min: 0, max: 0 }, setSelectedAfterDamageTargetIds: () => {},
      })
      return null
    }
    const root = createRoot(document.createElement('div'))
    try {
      await act(() => root.render(<Harness />))
      await act(() => vi.runAllTimers())
      expect(captured!.pendingEffect).toMatchObject({ optional: true, skillActivated: false, trigger: 'on-play' })
      expect(captured!.currentEffect).toMatchObject({ kind: 'trash-to-support', optional: true })
      if (choice === 'skip') {
        await act(() => captured!.skipOptionalSkill())
        expect(commands).toContainEqual({ kind: 'skip-on-play', playerId: 'player-one', sourceInstanceId: source.instanceId })
      } else {
        await act(() => captured!.confirmEffect())
        if (captured!.pendingEffect) await act(() => captured!.confirmEffect())
      }
      await act(() => vi.runAllTimers())
      expect(current.pendingOnPlay).toBeFalsy()
      expect(current.pendingAbilityEffect).toBeFalsy()
      expect(current.players['player-one'].discardPile).toEqual(initial.players['player-one'].discardPile)
      expect(current.players['player-one'].supportArea).toEqual(initial.players['player-one'].supportArea)
      await act(() => root.render(<Harness />))
      await act(() => vi.runAllTimers())
      expect(captured!.pendingEffect).toBeNull()
    } finally {
      await act(() => root.unmount())
    }
  })
})
