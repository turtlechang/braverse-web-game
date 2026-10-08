/// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'
import { createBs12WorkshopDemoState } from '../game/demo'
import { applyGameCommand } from '../game'
import { usePendingEffect } from './usePendingEffect'
import { useOnlinePendingEffect } from './useOnlinePendingEffect'
import type { DispatchGameCommand } from './useBattleActions'

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true
const playerId = 'player-one' as const
const placed = (condition: boolean) => applyGameCommand(createBs12WorkshopDemoState(condition ? 'positive' : 'old-break'), { kind: 'play-stage', playerId, instanceId: 'bs12-030-stage', paymentIds: ['bs12-030-payment-0'] })

it.each([false, true])('offline cost-first Stage highlights targets only when condition is %s', async condition => {
  const game = placed(condition)
  let captured: ReturnType<typeof usePendingEffect> | null = null
  let finalGame = game
  const dispatch: DispatchGameCommand = (command, _message, onSuccess) => {
    const commands = Array.isArray(command) ? command : [command]
    finalGame = commands.reduce((s, c) => applyGameCommand(s, c), finalGame)
    onSuccess?.(finalGame)
  }
  function Harness() {
    captured = usePendingEffect({ game, viewerPlayerId: playerId, dispatch,
      clearAttacker: () => {}, setInspectedHpPile: () => {},
      setGame: next => { finalGame = typeof next === 'function' ? next(finalGame) : next }, setMessage: () => {},
      hasFaint: false, faintTargetIds: new Set(), selectedFaintTargetIds: [], faintMinMax: { min: 0, max: 0 }, setSelectedFaintTargetIds: () => {},
      hasAfterDamage: false, afterDamageTargetIds: new Set(), selectedAfterDamageTargetIds: [], afterDamageMinMax: { min: 0, max: 0 }, setSelectedAfterDamageTargetIds: () => {},
    })
    return null
  }
  const root = createRoot(document.createElement('div'))
  try {
    await act(() => root.render(<Harness />))
    const stage = game.players[playerId].stage!.card
    await act(() => captured!.beginCardAbility(stage, stage.stageAbility!, 'stage', '啟動場景'))
    expect(captured!.effectTargetCandidates.map(c => c.card.instanceId)).toEqual(condition ? ['bs12-030-target', 'bs12-030-other'] : [])
    expect(captured!.pendingEffect?.skill.cost.energy).toEqual({ yellow: 1 })
    if (!condition) {
      await act(() => captured!.toggleSkillPayment('bs12-030-payment-1'))
      await act(() => captured!.confirmEffect())
      expect(finalGame.players[playerId].stage?.rested).toBe(true)
      expect(finalGame.players[playerId].deck).toHaveLength(12)
      expect(finalGame.pendingAbilityEffect).toBeFalsy()
    }
  } finally { await act(() => root.unmount()) }
})

it.each([false, true])('online Stage draft exposes targets only when condition is %s and keeps manual cost', async condition => {
  const game = placed(condition)
  let captured: ReturnType<typeof useOnlinePendingEffect> | null = null
  const dispatch = vi.fn<DispatchGameCommand>()
  function Harness() {
    captured = useOnlinePendingEffect({ game, viewerPlayerId: playerId, dispatch, hasFaint: false, hasAfterDamage: false })
    return null
  }
  const root = createRoot(document.createElement('div'))
  try {
    await act(() => root.render(<Harness />))
    await act(() => captured!.beginActivateStage())
    expect(captured!.candidateCards.map(c => c.instanceId)).toEqual(condition ? ['bs12-030-target', 'bs12-030-other'] : [])
    expect(dispatch).not.toHaveBeenCalled()
    if (!condition) {
      await act(() => captured!.toggleDraftPayment('bs12-030-payment-1'))
      await act(() => captured!.confirmEffect())
      expect(dispatch).toHaveBeenCalledOnce()
      const command = dispatch.mock.calls[0][0]
      expect(command).toMatchObject({ kind: 'begin-activate-stage', paymentIds: ['bs12-030-payment-1'] })
      expect(applyGameCommand(game, Array.isArray(command) ? command[0] : command).players[playerId].deck).toHaveLength(12)
    }
  } finally { await act(() => root.unmount()) }
})
