/// @vitest-environment jsdom
import { act, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { applyGameCommand, type GameCommand, type GameState } from '../game'
import { maskGameStateForViewer } from '../game/masked-state'
import { createEndPhaseCostState } from '../game/test-helpers/end-phase-helpers'
import type { DispatchGameCommand } from './useBattleActions'
import { usePendingEffect } from './usePendingEffect'
import { useOnlinePendingEffect } from './useOnlinePendingEffect'

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true
afterEach(() => vi.useRealTimers())

const end = (state: GameState) => applyGameCommand(state, { kind: 'advance-phase', playerId: 'player-one' })

describe('end-phase cost prompts', () => {
  it.each(['P-058', 'P-145'])('local %s waits for payment, rejects missing costs, and allows declining', async (id) => {
    vi.useFakeTimers()
    const initial = end(createEndPhaseCostState(id))
    let current = initial
    let captured: ReturnType<typeof usePendingEffect> | null = null
    function Harness() {
      const [game, setGame] = useState(initial)
      current = game
      const dispatch: DispatchGameCommand = (input, _message, onSuccess) => {
        const next = (Array.isArray(input) ? input : [input]).reduce((state, cmd) => applyGameCommand(state, cmd), game)
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
    await act(() => root.render(<Harness />))
    await act(() => vi.runAllTimers())
    expect(captured!.pendingEffect).toMatchObject({ skillActivated: false, optional: true, triggerLabel: '回合結束效果' })
    expect(captured!.pendingEffect!.skill.cost).toEqual(initial.players['player-one'].battleArea[0].card.skill!.cost)
    await act(() => captured!.confirmEffect())
    expect(current).toBe(initial)
    await act(() => captured!.skipOptionalSkill())
    expect(current.pendingAbilityEffect).toBeUndefined()
    expect(current.players).toEqual(initial.players)
    expect(end(current).activePlayerId).toBe('player-two')
    await act(() => root.unmount())
  })

  it.each(['P-058', 'P-145'])('online %s exposes the actual cost and requires payment before changing cards', async (id) => {
    vi.useFakeTimers()
    let game = end(createEndPhaseCostState(id, ['BS8-103', 'BS8-020']))
    const initial = game
    let captured: ReturnType<typeof useOnlinePendingEffect> | null = null
    const commands: GameCommand[] = []
    const dispatch: DispatchGameCommand = (command) => {
      if (Array.isArray(command)) throw new Error('Expected one command')
      commands.push(command)
      game = applyGameCommand(game, command)
    }
    function Harness() {
      captured = useOnlinePendingEffect({ game: maskGameStateForViewer(game, 'player-one'), viewerPlayerId: 'player-one', dispatch, hasFaint: false, hasAfterDamage: false })
      return null
    }
    const root = createRoot(document.createElement('div'))
    await act(() => root.render(<Harness />))
    await act(() => vi.runAllTimers())
    expect(captured!.pendingEffect).toMatchObject({ trigger: 'passive', skillActivated: false, triggerLabel: '回合結束效果' })
    await act(() => captured!.confirmEffect())
    expect(commands).toHaveLength(0)
    expect(game).toBe(initial)
    if (id === 'P-058') {
      await act(() => captured!.toggleDraftCostSupport('pay-0'))
      await act(() => captured!.confirmEffect())
      expect(commands).toHaveLength(0)
      await act(() => captured!.toggleDraftCostSupport('pay-1'))
    } else {
      await act(() => captured!.toggleDraftPayment('pay-1'))
      await act(() => captured!.confirmEffect())
      expect(commands).toHaveLength(0)
      await act(() => captured!.toggleDraftPayment('pay-1'))
      await act(() => captured!.toggleDraftPayment('pay-0'))
    }
    await act(() => captured!.confirmEffect())
    expect(commands[0]).toMatchObject({ kind: 'begin-activate-skill', trigger: 'passive' })
    await act(() => root.render(<Harness />))
    if (game.pendingAbilityEffect) await act(() => captured!.confirmEffect())
    expect(game.pendingAbilityEffect).toBeUndefined()
    if (id === 'P-058') {
      expect(game.players['player-one'].supportArea.map((entry) => entry.card.instanceId)).toEqual(['deck-0', 'deck-1'])
      expect(game.players['player-one'].discardPile.map((card) => card.instanceId)).toEqual(['pay-0', 'pay-1'])
    } else {
      expect(game.players['player-one'].deck).toHaveLength(9)
      expect(game.players['player-one'].supportArea.map((entry) => entry.rested)).toEqual([true, false])
    }
    await act(() => root.unmount())
  })

  it('online insufficient resources can be declined through the authoritative command', async () => {
    vi.useFakeTimers()
    let game = end(createEndPhaseCostState('P-145'))
    let captured: ReturnType<typeof useOnlinePendingEffect> | null = null
    const dispatch = vi.fn<DispatchGameCommand>((command) => {
      if (Array.isArray(command)) throw new Error('Expected one command')
      game = applyGameCommand(game, command)
    })
    function Harness() {
      captured = useOnlinePendingEffect({ game, viewerPlayerId: 'player-one', dispatch, hasFaint: false, hasAfterDamage: false })
      return null
    }
    const root = createRoot(document.createElement('div'))
    await act(() => root.render(<Harness />))
    await act(() => vi.runAllTimers())
    await act(() => captured!.cancelAbilityCostDraft())
    expect(dispatch).toHaveBeenCalledWith({ kind: 'skip-end-phase-skill', playerId: 'player-one', sourceInstanceId: 'end-source' }, expect.any(String))
    expect(game.pendingAbilityEffect).toBeUndefined()
    expect(end(game).activePlayerId).toBe('player-two')
    await act(() => root.unmount())
  })
})
