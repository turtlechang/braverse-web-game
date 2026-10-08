// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'
import { createBs12SpotlightDemoState } from '../game/demo'
import { applyGameCommand } from '../game'
import { usePendingEffect } from './usePendingEffect'
import { useOnlinePendingEffect } from './useOnlinePendingEffect'
import type { DispatchGameCommand } from './useBattleActions'
;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true
const playerId = 'player-one' as const

it.each(['positive', 'two-costs'] as const)('offline item %s sends manual YY and the actual battle cost before draw', async scenario => {
  const game = createBs12SpotlightDemoState(scenario)
  let captured: ReturnType<typeof usePendingEffect> | null = null
  let finalGame = game
  const dispatch = vi.fn<DispatchGameCommand>((command, _message, onSuccess) => {
    finalGame = (Array.isArray(command) ? command : [command]).reduce((s, c) => applyGameCommand(s, c), finalGame)
    onSuccess?.(finalGame)
  })
  function Harness() {
    captured = usePendingEffect({ game, viewerPlayerId: playerId, dispatch,
      clearAttacker: () => {}, setInspectedHpPile: () => {}, setGame: next => { finalGame = typeof next === 'function' ? next(finalGame) : next }, setMessage: () => {},
      hasFaint: false, faintTargetIds: new Set(), selectedFaintTargetIds: [], faintMinMax: { min: 0, max: 0 }, setSelectedFaintTargetIds: () => {},
      hasAfterDamage: false, afterDamageTargetIds: new Set(), selectedAfterDamageTargetIds: [], afterDamageMinMax: { min: 0, max: 0 }, setSelectedAfterDamageTargetIds: () => {},
    })
    return null
  }
  const root = createRoot(document.createElement('div'))
  try {
    await act(() => root.render(<Harness />))
    const card = game.players[playerId].hand[0]
    await act(() => captured!.beginCardAbility(card, card.item!, 'item', '使用物品'))
    expect(captured!.skillTrashBattleCookieCandidates.map(c => c.instanceId)).toEqual(scenario === 'two-costs' ? ['bs12-031-cost', 'bs12-031-other'] : ['bs12-031-cost'])
    const selected = scenario === 'two-costs' ? 'bs12-031-other' : 'bs12-031-cost'
    await act(() => captured!.toggleSkillPayment('bs12-031-payment-0'))
    await act(() => captured!.toggleSkillPayment('bs12-031-payment-1'))
    await act(() => captured!.toggleSkillTrashBattleCookie(selected))
    expect(dispatch).not.toHaveBeenCalled()
    expect(finalGame).toBe(game)
    await act(() => captured!.confirmEffect())
    expect(finalGame.commandLog?.map(entry => entry.commandKind)).toEqual(['begin-play-item', 'resolve-ability-effect'])
    expect(finalGame.pendingDrawUpTo?.max).toBe(1)
    expect(finalGame.players[playerId].breakArea[0].instanceId).toBe(selected)
    expect(finalGame.players[playerId].deck).toHaveLength(12)
  } finally { await act(() => root.unmount()) }
})

it.each(['positive', 'two-costs'] as const)('online item %s keeps the same manual cost draft and command', async scenario => {
  const game = createBs12SpotlightDemoState(scenario)
  let captured: ReturnType<typeof useOnlinePendingEffect> | null = null
  const dispatch = vi.fn<DispatchGameCommand>()
  function Harness() {
    captured = useOnlinePendingEffect({ game, viewerPlayerId: playerId, dispatch, hasFaint: false, hasAfterDamage: false })
    return null
  }
  const root = createRoot(document.createElement('div'))
  try {
    await act(() => root.render(<Harness />))
    await act(() => captured!.beginPlayItem(game.players[playerId].hand[0]))
    expect(captured!.draftTrashBattleCookieCandidates.map(c => c.instanceId)).toEqual(scenario === 'two-costs' ? ['bs12-031-cost', 'bs12-031-other'] : ['bs12-031-cost'])
    const selected = scenario === 'two-costs' ? 'bs12-031-other' : 'bs12-031-cost'
    await act(() => captured!.toggleDraftPayment('bs12-031-payment-0'))
    await act(() => captured!.toggleDraftPayment('bs12-031-payment-1'))
    await act(() => captured!.toggleDraftTrashBattleCookie(selected))
    expect(dispatch).not.toHaveBeenCalled()
    await act(() => captured!.confirmEffect())
    const command = dispatch.mock.calls[0][0]
    expect(command).toMatchObject({ kind: 'begin-play-item', trashBattleCookieIds: [selected], paymentIds: ['bs12-031-payment-0', 'bs12-031-payment-1'] })
    expect(applyGameCommand(game, Array.isArray(command) ? command[0] : command).players[playerId].breakArea[0].instanceId).toBe(selected)
  } finally { await act(() => root.unmount()) }
})
