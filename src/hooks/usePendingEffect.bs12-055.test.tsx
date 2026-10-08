/// @vitest-environment jsdom
import { act, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it } from 'vitest'
import { createBs12HerbDemoState } from '../game/demo'
import { applyGameCommand } from '../game'
import { usePendingEffect } from './usePendingEffect'

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

it.each(['BS12-055', 'BS12-055@1'] as const)('%s keeps costs as a draft and completes paid zero and one after source leaves', async number => {
  for (const mode of [0, 1]) {
    const initial = createBs12HerbDemoState('positive', number)
    let current = initial
    let captured: ReturnType<typeof usePendingEffect> | null = null
    function Harness() {
      const [game, setGame] = useState(initial)
      current = game
      captured = usePendingEffect({ game, setGame, dispatch: (command, _message, onSuccess) => {
        const next = (Array.isArray(command) ? command : [command]).reduce((state, cmd) => applyGameCommand(state, cmd), game)
        setGame(next); onSuccess?.(next)
      }, viewerPlayerId: 'player-one', setMessage: () => {}, clearAttacker: () => {}, setInspectedHpPile: () => {},
      hasFaint: false, faintTargetIds: new Set(), selectedFaintTargetIds: [], faintMinMax: { min: 0, max: 0 }, setSelectedFaintTargetIds: () => {},
      hasAfterDamage: false, afterDamageTargetIds: new Set(), selectedAfterDamageTargetIds: [], afterDamageMinMax: { min: 0, max: 0 }, setSelectedAfterDamageTargetIds: () => {},
      })
      return null
    }
    const root = createRoot(document.createElement('div'))
    try {
      await act(() => root.render(<Harness />))
      const start = () => captured!.beginCookieSkill(current, current.players['player-one'].battleArea[1].card, 'player-one', 'activate', 'Activate')
      await act(start)
      await act(() => captured!.toggleSkillDiscardHand('bs12-055-hand-0'))
      await act(() => captured!.chooseEffectMode(mode))
      expect(current).toBe(initial)
      await act(() => captured!.cancelPendingSkill())
      expect(current).toBe(initial)
      await act(start)
      await act(() => captured!.toggleSkillDiscardHand('bs12-055-hand-1'))
      await act(() => captured!.chooseEffectMode(mode))
      await act(() => captured!.confirmEffect())
      expect(current.players['player-one'].battleArea.map(c => c.card.instanceId)).toEqual(['bs12-055-ally'])
      expect(current.players['player-one'].discardPile.map(c => c.instanceId)).toEqual(['bs12-055-hand-1', 'bs12-055-source', 'bs12-055-deck-0', 'bs12-055-deck-1'])
      expect(current.players['player-one'].supportArea).toHaveLength(mode === 0 ? 5 : 4)
      expect(current.players['player-one'].deck).toHaveLength(mode === 0 ? 11 : 12)
      if (mode === 0) expect(current.players['player-one'].supportArea.at(-1)).toEqual({ card: initial.players['player-one'].deck[0], rested: true })
      expect(current.commandLog!.map(e => e.commandKind)).toEqual(['begin-activate-skill', 'resolve-ability-effect'])
      expect(captured!.pendingEffect).toBeNull()
    } finally { await act(() => root.unmount()) }
  }
})
