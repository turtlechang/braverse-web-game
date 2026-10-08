/// @vitest-environment jsdom
import { act, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it } from 'vitest'
import { applyGameCommand, maskGameStateForViewer } from '../game'
import { createBs12SummerSodaDemoState } from '../game/demo'
import { usePendingEffect } from './usePendingEffect'
import { useOnlinePendingEffect } from './useOnlinePendingEffect'

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true
const actor = 'player-one' as const
const selected = ['bs12-084-red-blocker', 'bs12-084-blocker']

it.each(['positive', 'five', 'cancel'] as const)('local 084 retains ordered trash cost and pays only on confirmation: %s', async scenario => {
  const initial = createBs12SummerSodaDemoState(scenario === 'five' ? 'five' : 'positive')
  let current = initial
  let captured: ReturnType<typeof usePendingEffect> | null = null
  function Harness() {
    const [game, setGame] = useState(initial)
    current = game
    captured = usePendingEffect({ game, setGame, viewerPlayerId: actor, dispatch: command => setGame((Array.isArray(command) ? command : [command]).reduce((state, cmd) => applyGameCommand(state, cmd), game)),
      setMessage: () => {}, clearAttacker: () => {}, setInspectedHpPile: () => {},
      hasFaint: false, faintTargetIds: new Set(), selectedFaintTargetIds: [], faintMinMax: { min: 0, max: 0 }, setSelectedFaintTargetIds: () => {},
      hasAfterDamage: false, afterDamageTargetIds: new Set(), selectedAfterDamageTargetIds: [], afterDamageMinMax: { min: 0, max: 0 }, setSelectedAfterDamageTargetIds: () => {},
    })
    return null
  }
  const root = createRoot(document.createElement('div'))
  try {
    await act(() => root.render(<Harness />))
    const stage = initial.players[actor].stage!.card
    await act(() => captured!.beginCardAbility(stage, stage.stageAbility!, 'stage', '啟動場景'))
    expect(captured!.skillTrashToDeckBottomCandidates.map(card => card.instanceId)).toEqual([...selected].reverse())
    await act(() => captured!.toggleSkillPayment('bs12-084-payment-0'))
    for (const id of selected) await act(() => captured!.toggleSkillTrashToDeckBottom(id))
    await act(() => captured!.toggleSkillTrashToDeckBottom('bs12-084-non-blocker'))
    expect(captured!.pendingEffect?.selectedTrashToDeckBottomIds).toEqual(selected)
    expect(current).toEqual(initial)
    if (scenario === 'cancel') {
      await act(() => captured!.cancelPendingSkill())
      expect(current).toEqual(initial)
      expect(captured!.pendingEffect).toBeNull()
      return
    }
    await act(() => captured!.toggleSkillTrashToDeckBottom(selected[0]))
    await act(() => captured!.toggleSkillTrashToDeckBottom(selected[0]))
    expect(captured!.pendingEffect?.selectedTrashToDeckBottomIds).toEqual([...selected].reverse())
    await act(() => captured!.confirmEffect())
    expect(current.players[actor].deck.slice(-2).map(card => card.instanceId)).toEqual([...selected].reverse())
    expect(current.players[actor].stage?.rested).toBe(true)
    expect(current.players[actor].supportArea[0].rested).toBe(true)
    expect(current.pendingOpponentHandDiscard?.playerId).toBe(scenario === 'five' ? undefined : 'player-two')
  } finally { await act(() => root.unmount()) }
})

it.each(['positive', 'five', 'cancel', 'incomplete'] as const)('online 084 draft uses own public trash, ordered IDs and explicit payment: %s', async scenario => {
  const initial = createBs12SummerSodaDemoState(scenario === 'five' ? 'five' : 'positive')
  let current = initial
  let captured: ReturnType<typeof useOnlinePendingEffect> | null = null
  function Harness() {
    const [game, setGame] = useState(initial)
    current = game
    captured = useOnlinePendingEffect({ game: maskGameStateForViewer(game, actor), viewerPlayerId: actor, hasFaint: false, hasAfterDamage: false,
      dispatch: command => setGame((Array.isArray(command) ? command : [command]).reduce((state, cmd) => applyGameCommand(state, cmd), game)),
    })
    return null
  }
  const root = createRoot(document.createElement('div'))
  try {
    await act(() => root.render(<Harness />))
    await act(() => captured!.beginActivateStage())
    expect(captured!.draftTrashToDeckBottomCandidates.map(card => card.instanceId)).toEqual([...selected].reverse())
    expect(captured!.draftTrashToDeckBottomCost).toBe(2)
    await act(() => captured!.toggleDraftPayment('bs12-084-payment-0'))
    await act(() => captured!.toggleDraftTrashToDeckBottom(selected[0]))
    if (scenario === 'incomplete') {
      await act(() => captured!.confirmEffect())
      expect(current).toEqual(initial)
      expect(captured!.abilityCostDraft).not.toBeNull()
      return
    }
    await act(() => captured!.toggleDraftTrashToDeckBottom(selected[1]))
    await act(() => captured!.toggleDraftTrashToDeckBottom('bs12-084-opponent-blocker'))
    expect(captured!.pendingEffect?.selectedTrashToDeckBottomIds).toEqual(selected)
    expect(current).toEqual(initial)
    if (scenario === 'cancel') {
      await act(() => captured!.cancelAbilityCostDraft())
      expect(current).toEqual(initial)
      expect(captured!.abilityCostDraft).toBeNull()
      return
    }
    await act(() => captured!.confirmEffect())
    expect(current.players[actor].deck.slice(-2).map(card => card.instanceId)).toEqual(selected)
    expect(current.players[actor].stage?.rested).toBe(true)
    expect(current.pendingOpponentHandDiscard?.playerId).toBe(scenario === 'five' ? undefined : 'player-two')
  } finally { await act(() => root.unmount()) }
})
