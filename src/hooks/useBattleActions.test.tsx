/// @vitest-environment jsdom

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it, vi } from 'vitest'
import { applyGameCommand, type GameCommand } from '../game'
import { createBattleState } from '../game/test-helpers/battle-helpers'
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
})
