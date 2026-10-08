/// @vitest-environment jsdom
import { act, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it } from 'vitest'
import { createBs12MintChocoDemoState } from '../game/demo'
import { applyGameCommand } from '../game'
import { usePendingEffect } from './usePendingEffect'

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

it.each(['BS12-054', 'BS12-054@1'] as const)('%s previews the paid support Cookie without moving real state or committing a cost log', async number => {
  const initial = createBs12MintChocoDemoState('empty-trash', number)
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
    const start = () => captured!.beginCookieSkill(current, current.players['player-one'].battleArea[0].card, 'player-one', 'activate', 'Activate')
    await act(start)
    expect(captured!.trashCookieCandidates).toEqual([])
    await act(() => captured!.toggleSkillCostSupport('bs12-054-foe-support'))
    expect(captured!.pendingEffect?.selectedCostSupportToTrashIds).toEqual([])
    await act(() => captured!.toggleSkillCostSupport('bs12-054-support-0'))
    expect(captured!.trashCookieCandidates.map(c => c.instanceId)).toEqual(['bs12-054-support-0'])
    expect(current).toBe(initial)
    await act(() => captured!.toggleEffectTarget('bs12-054-support-0'))
    expect(captured!.pendingEffect?.selectedTargetIds).toEqual(['bs12-054-support-0'])
    await act(() => captured!.toggleSkillCostSupport('bs12-054-support-0'))
    await act(() => captured!.toggleSkillCostSupport('bs12-054-support-3'))
    expect(captured!.pendingEffect?.selectedTargetIds).toEqual([])
    expect(captured!.trashCookieCandidates).toEqual([])
    expect(current).toBe(initial)
    await act(() => captured!.cancelPendingSkill())
    expect(current).toBe(initial)
    await act(start)
    await act(() => captured!.toggleSkillCostSupport('bs12-054-support-2'))
    expect(captured!.trashCookieCandidates.map(c => c.instanceId)).toEqual(['bs12-054-support-2'])
    await act(() => captured!.toggleEffectTarget('bs12-054-support-2'))
    await act(() => captured!.confirmEffect())
    expect(current.players['player-one'].supportArea.at(-1)).toEqual({ card: initial.players['player-one'].supportArea[2].card, rested: true })
    expect(current.players['player-one'].supportArea).toHaveLength(5)
    expect(current.players['player-one'].discardPile).toEqual([])
    expect(current.players['player-one'].battleArea).toEqual(initial.players['player-one'].battleArea)
    expect(current.commandLog!.map(e => e.commandKind)).toEqual(['begin-activate-skill', 'resolve-ability-effect'])
  } finally { await act(() => root.unmount()) }
})
