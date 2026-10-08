/// @vitest-environment jsdom
import { act, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it } from 'vitest'
import { createBs12HerbDemoState } from '../game/demo'
import { applyGameCommand, type GameCommand } from '../game'
import { useOnlinePendingEffect } from './useOnlinePendingEffect'

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

it.each(['BS12-055', 'BS12-055@1'] as const)('%s online sends paid zero and one with source history validated by authority', async number => {
  for (const mode of [0, 1]) {
    const initial = createBs12HerbDemoState('positive', number)
    let current = initial
    let captured: ReturnType<typeof useOnlinePendingEffect> | null = null
    const commands: GameCommand[] = []
    function Harness() {
      const [game, setGame] = useState(initial)
      current = game
      captured = useOnlinePendingEffect({ game, viewerPlayerId: 'player-one', dispatch: (command, _message, onSuccess) => {
        const batch = Array.isArray(command) ? command : [command]
        commands.push(...batch)
        const next = batch.reduce((state, cmd) => applyGameCommand(state, cmd), game)
        setGame(next); onSuccess?.(next)
      }, hasFaint: false, hasAfterDamage: false })
      return null
    }
    const root = createRoot(document.createElement('div'))
    try {
      await act(() => root.render(<Harness />))
      await act(() => captured!.beginCookieSkill(initial.players['player-one'].battleArea[1].card, 'activate'))
      await act(() => captured!.confirmEffect())
      expect(commands).toEqual([])
      await act(() => captured!.toggleDraftDiscardHand('bs12-055-hand-1'))
      await act(() => captured!.chooseEffectMode(mode))
      expect(current).toBe(initial)
      await act(() => captured!.confirmEffect())
      expect(commands[0]).toMatchObject({ kind: 'begin-activate-skill', sourceInstanceId: 'bs12-055-source', discardHandIds: ['bs12-055-hand-1'], chooseOneModes: [mode] })
      expect(current.players['player-one'].battleArea.map(c => c.card.instanceId)).toEqual(['bs12-055-ally'])
      expect(current.players['player-one'].discardPile.map(c => c.instanceId)).toEqual(['bs12-055-hand-1', 'bs12-055-source', 'bs12-055-deck-0', 'bs12-055-deck-1'])
      expect(current.players['player-one'].supportArea).toHaveLength(mode === 0 ? 5 : 4)
      expect(current.players['player-one'].deck).toHaveLength(mode === 0 ? 11 : 12)
    } finally { await act(() => root.unmount()) }
  }
})
