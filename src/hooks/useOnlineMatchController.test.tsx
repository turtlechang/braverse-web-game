/// @vitest-environment jsdom

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { skipTrap, type GameCommand } from '../game'
import {
  createBattleState,
  declareAttack,
} from '../game/test-helpers/battle-helpers'
import { useOnlineMatchController } from './useOnlineMatchController'

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

describe('useOnlineMatchController', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('automatically resolves each pending damage step for the defending player', async () => {
    vi.useFakeTimers()
    const game = skipTrap(declareAttack(createBattleState()), 'player-one')
    const sendCommand = vi.fn<(command: GameCommand) => void>()

    function TestHarness() {
      useOnlineMatchController({
        game,
        viewerPlayerId: 'player-one',
        sendCommand,
      })
      return null
    }

    const container = document.createElement('div')
    const root = createRoot(container)
    await act(() => root.render(<TestHarness />))
    await act(() => vi.advanceTimersByTime(500))

    expect(sendCommand).toHaveBeenCalledWith({
      kind: 'resolve-next-damage',
      playerId: 'player-one',
    })
    await act(() => root.unmount())
  })
})
