/// @vitest-environment jsdom
import { act, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it } from 'vitest'
import { createBs12ChouxDemoState } from '../game/demo'
import { applyGameCommand } from '../game'
import { usePendingEffect } from './usePendingEffect'

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

it.each(['BS12-032', 'BS12-032@1'] as const)('%s R001 excludes a fainted HP-cost recipient without exposing or committing HP cards', async number => {
  const initial = createBs12ChouxDemoState('hp-cost', number)
  let current = initial
  let captured: ReturnType<typeof usePendingEffect> | null = null
  function Harness() {
    const [game, setGame] = useState(initial)
    current = game
    captured = usePendingEffect({ game, setGame, dispatch: (command, _message, onSuccess) => {
      const commands = Array.isArray(command) ? command : [command]
      const next = commands.reduce((state, cmd) => applyGameCommand(state, cmd), game)
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

    const parent = current.players['player-one'].battleArea.find(c => c.card.instanceId === 'r001-earl-grey')!.card
    await act(() => captured!.beginCookieSkill(current, parent, 'player-one', 'on-play', 'OnPlay'))
    expect(captured!.effectTargetCandidates.map(c => c.card.instanceId)).toEqual(['bs12-032-source', 'r001-earl-grey'])
    await act(() => captured!.toggleEffectTarget('bs12-032-source'))
    await act(() => captured!.toggleSkillHpToTrash('bs12-032-source'))
    expect(captured!.pendingEffect?.selectedTargetIds).toEqual([])
    expect(captured!.effectTargetCandidates.map(c => c.card.instanceId)).toEqual(['r001-earl-grey'])
    expect(current).toBe(initial)
    expect(current.players['player-one'].battleArea[0].hpCards).toHaveLength(1)
    expect(current.players['player-one'].discardPile).toEqual(initial.players['player-one'].discardPile)
    await act(() => captured!.toggleSkillHpToTrash('bs12-032-source'))
    expect(captured!.effectTargetCandidates.map(c => c.card.instanceId)).toEqual(['bs12-032-source', 'r001-earl-grey'])
    await act(() => captured!.toggleSkillHpToTrash('r001-earl-grey'))
    expect(captured!.effectTargetCandidates.map(c => c.card.instanceId)).toEqual(['bs12-032-source', 'r001-earl-grey'])
    await act(() => captured!.cancelPendingSkill())
    expect(current).toBe(initial)
  } finally { await act(() => root.unmount()) }
})
