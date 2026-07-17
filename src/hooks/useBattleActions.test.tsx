/// @vitest-environment jsdom

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it, vi } from 'vitest'
import { applyGameCommand, type GameCommand } from '../game'
import { createBattleState, item } from '../game/test-helpers/battle-helpers'
import { useBattleActions, type DispatchGameCommand } from './useBattleActions'

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

describe('useBattleActions', () => {
  it('declares an attack after selecting a legal attacker and payment', async () => {
    const game = createBattleState()
    const dispatch = vi.fn<DispatchGameCommand>()
    let captured: ReturnType<typeof useBattleActions> | null = null

    function TestHarness() {
      captured = useBattleActions({ game, dispatch })
      return null
    }

    const container = document.createElement('div')
    const root = createRoot(container)
    await act(() => root.render(<TestHarness />))

    await act(() => captured!.setSelectedAttackerId('attacker'))
    await act(() => captured!.toggleAttackPayment('p2-support'))
    expect(captured!.attackPaymentValidation.valid).toBe(true)

    await act(() => captured!.handleAttackTarget('defender'))
    expect(dispatch).toHaveBeenCalledTimes(1)

    const command = dispatch.mock.calls[0][0] as GameCommand
    const next = applyGameCommand(game, command)
    expect(next.pendingBattle?.attackerInstanceId).toBe('attacker')
    expect(next.pendingBattle?.targetInstanceId).toBe('defender')

    await act(() => root.unmount())
  })

  it('only exposes support cards matching the attacker energy color', async () => {
    const game = createBattleState()
    const attacker = game.players['player-two'].battleArea[0].card
    attacker.attackEnergyCost = { green: 2 }
    game.players['player-two'].supportArea = [
      { card: item('red-support', 'red'), rested: false },
      { card: item('green-support-a', 'green'), rested: false },
      { card: item('green-support-b', 'green'), rested: false },
    ]
    const dispatch = vi.fn<DispatchGameCommand>()
    let captured: ReturnType<typeof useBattleActions> | null = null

    function TestHarness() {
      captured = useBattleActions({ game, dispatch })
      return null
    }

    const container = document.createElement('div')
    const root = createRoot(container)
    await act(() => root.render(<TestHarness />))
    await act(() => captured!.setSelectedAttackerId('attacker'))

    expect(captured!.attackPaymentTargetIds).toEqual(
      new Set(['green-support-a', 'green-support-b']),
    )
    await act(() => captured!.toggleAttackPayment('red-support'))
    expect(captured!.selectedAttackPaymentIds).toEqual([])

    await act(() => captured!.toggleAttackPayment('green-support-a'))
    await act(() => captured!.toggleAttackPayment('green-support-b'))
    expect(captured!.attackPaymentValidation.valid).toBe(true)

    await act(() => root.unmount())
  })
})
