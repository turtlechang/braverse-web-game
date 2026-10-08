/// @vitest-environment jsdom
import { act, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it, vi } from 'vitest'
import { createBs12CocoaDemoState } from '../game/demo'
import { applyGameCommand } from '../game'
import { usePendingEffect } from './usePendingEffect'

describe('BS12-052 nested On Play source', () => {
  it.each(['BS12-052', 'BS12-052@1'] as const)('%s resumes the Stage without attaching its Then to Cocoa', async number => {
    vi.useFakeTimers()
    const initial = applyGameCommand(createBs12CocoaDemoState('stage-entry', number), {
      kind: 'activate-stage', playerId: 'player-one', paymentIds: [], effectTargets: [['bs12-052-source']],
    })
    let currentGame = initial
    let captured: ReturnType<typeof usePendingEffect> | null = null
    function Harness() {
      const [game, setGame] = useState(initial)
      currentGame = game
      captured = usePendingEffect({
        game, setGame, dispatch: (command, _message, onSuccess) => {
          const commands = Array.isArray(command) ? command : [command]
          const next = commands.reduce((state, cmd) => applyGameCommand(state, cmd), game)
          setGame(next)
          onSuccess?.(next)
        }, viewerPlayerId: 'player-one', setMessage: vi.fn(),
        clearAttacker: () => {}, setInspectedHpPile: () => {},
        hasFaint: false, faintTargetIds: new Set(), selectedFaintTargetIds: [],
        faintMinMax: { min: 0, max: 0 }, setSelectedFaintTargetIds: () => {},
        hasAfterDamage: false, afterDamageTargetIds: new Set(), selectedAfterDamageTargetIds: [],
        afterDamageMinMax: { min: 0, max: 0 }, setSelectedAfterDamageTargetIds: () => {},
      })
      return null
    }
    const root = createRoot(document.createElement('div'))
    try {
      await act(() => root.render(<Harness />))
      await act(() => captured!.handleOnPlayTrigger(initial))
      await act(() => vi.runAllTimers())
      expect(captured!.pendingEffect?.sourceCard.instanceId).toBe('bs12-052-source')
      await act(() => captured!.toggleSkillDiscardHand('bs12-052-hand-0'))
      await act(() => captured!.confirmEffect())
      expect(currentGame.players['player-one'].hand).toHaveLength(1)
      expect(currentGame.pendingAbilityEffect?.sourceInstanceId).toBe('bs12-052-stage')
      // A zero-target child completes synchronously, so the restored parent is
      // already authoritative during this callback, before hydration timers.
      expect(captured!.pendingEffect?.sourceCard.instanceId).not.toBe('bs12-052-source')
      await act(() => vi.runAllTimers())
      expect(captured!.pendingEffect?.sourceCard.instanceId).toBe('bs12-052-stage')
      expect(captured!.currentEffect?.kind).toBe('optional-cost-attack')
    } finally {
      await act(() => root.unmount())
      vi.useRealTimers()
    }
  })
})
