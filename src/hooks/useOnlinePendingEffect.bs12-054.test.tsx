/// @vitest-environment jsdom
import { act, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it } from 'vitest'
import { createBs12MintChocoDemoState } from '../game/demo'
import { applyGameCommand, type GameCommand } from '../game'
import { useOnlinePendingEffect } from './useOnlinePendingEffect'

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

it.each(['BS12-054', 'BS12-054@1'] as const)('%s online pays support once before presenting the server post-cost trash candidate', async number => {
  const initial = createBs12MintChocoDemoState('empty-trash', number)
  let current = initial
  let captured: ReturnType<typeof useOnlinePendingEffect> | null = null
  const commands: GameCommand[] = []
  function Harness() {
    const [game, setGame] = useState(initial)
    current = game
    captured = useOnlinePendingEffect({ game, viewerPlayerId: 'player-one', hasFaint: false, hasAfterDamage: false, dispatch: command => {
      const batch = Array.isArray(command) ? command : [command]
      commands.push(...batch)
      setGame(batch.reduce((state, cmd) => applyGameCommand(state, cmd), game))
    } })
    return null
  }
  const root = createRoot(document.createElement('div'))
  try {
    await act(() => root.render(<Harness />))
    await act(() => captured!.beginCookieSkill(initial.players['player-one'].battleArea[0].card, 'activate'))
    expect(captured!.draftCostSupportCandidates.map(c => c.instanceId)).toEqual(initial.players['player-one'].supportArea.map(c => c.card.instanceId))
    await act(() => captured!.confirmEffect())
    expect(commands).toEqual([])
    await act(() => captured!.toggleDraftCostSupport('bs12-054-support-2'))
    expect(current).toBe(initial)
    await act(() => captured!.confirmEffect())
    expect(commands).toHaveLength(1)
    expect(commands[0]).toMatchObject({ kind: 'begin-activate-skill', sourceInstanceId: 'bs12-054-source', costSupportToTrashIds: ['bs12-054-support-2'] })
    expect(current.players['player-one'].supportArea).toHaveLength(4)
    expect(current.players['player-one'].discardPile.map(c => c.instanceId)).toEqual(['bs12-054-support-2'])
    expect(captured!.candidateCards.map(c => c.instanceId)).toEqual(['bs12-054-support-2'])
    await act(() => captured!.toggleTarget('bs12-054-foe-trash'))
    expect(captured!.selectedTargetIds).toEqual([])
    await act(() => captured!.toggleTarget('bs12-054-support-2'))
    await act(() => captured!.confirmEffect())
    expect(commands.map(c => c.kind)).toEqual(['begin-activate-skill', 'resolve-ability-effect'])
    expect(current.players['player-one'].supportArea.at(-1)).toEqual({ card: initial.players['player-one'].supportArea[2].card, rested: true })
    expect(current.players['player-one'].discardPile).toEqual([])
    expect(current.players['player-one'].battleArea).toEqual(initial.players['player-one'].battleArea)
  } finally { await act(() => root.unmount()) }
})
