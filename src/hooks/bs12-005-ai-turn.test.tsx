/// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { applyGameCommand } from '../game/commands'
import { parseTestStateConfig } from '../game/demo'
import { useAiTurn } from './useAiTurn'
import { useMatchController } from './useMatchController'

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

describe('BS12-005 local Browser fixture AI continuation', () => {
  afterEach(() => vi.useRealTimers())

  it('continues from the opponent Active Phase after the player ends the turn', async () => {
    vi.useFakeTimers()
    let match: ReturnType<typeof useMatchController> | undefined
    const config = parseTestStateConfig('?test-state=card:BS12-005', 'localhost')!

    function Harness() {
      match = useMatchController({ testStateConfig: config })
      useAiTurn({
        game: match.game,
        setGame: match.setGame,
        setMessage: match.setMessage,
        showPause: false,
        aiControlsCurrentState: match.aiControlsCurrentState,
        pendingEffect: null,
        faintActive: false,
        afterDamageActive: false,
        deckConfig: match.deckConfig,
      })
      return null
    }

    const root = createRoot(document.createElement('div'))
    try {
      await act(() => root.render(<Harness />))
      await act(() => match!.setGame((current) => {
        const enabled = applyGameCommand(current, {
          kind: 'resolve-ability-effect',
          playerId: 'player-one',
          targetIds: ['bs12-005-source'],
        })
        const healed = applyGameCommand(enabled, {
          kind: 'activate-skill',
          playerId: 'player-one',
          sourceInstanceId: 'bs12-005-source',
          trigger: 'activate',
          paymentIds: [],
          discardHandIds: [],
          effectTargets: [['bs12-005-companion']],
        })
        const end = applyGameCommand(healed, { kind: 'advance-phase', playerId: 'player-one' })
        return applyGameCommand(end, { kind: 'advance-phase', playerId: 'player-one' })
      }))
      expect(match!.game.activePlayerId).toBe('player-two')
      expect(match!.game.phase).toBe('active')
      expect(match!.aiControlsCurrentState).toBe(true)

      for (let step = 0; step < 4 && match!.game.phase === 'active'; step += 1) {
        await act(async () => {
          await vi.advanceTimersByTimeAsync(500)
        })
      }
      expect(match!.game.phase).not.toBe('active')
    } finally {
      await act(() => root.unmount())
    }
  })
})
