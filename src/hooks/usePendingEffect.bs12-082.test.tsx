/// @vitest-environment jsdom
import { act, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it } from 'vitest'
import { createBs12DjDemoState } from '../game/demo'
import { applyGameCommand, type GameCommand } from '../game'
import { usePendingEffect } from './usePendingEffect'

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

it.each(['cancel', 'pay', 'threshold-cancel', 'threshold-pay'] as const)('DJ Item tax keeps the UI unpaid and resumes only authoritative state: %s', async action => {
  const threshold = action.startsWith('threshold')
  const initial = createBs12DjDemoState(threshold ? 'hand-threshold' : 'positive')
  let current = initial
  let message = ''
  let captured: ReturnType<typeof usePendingEffect> | null = null
  let send: (command: GameCommand) => void = () => {}
  function Harness() {
    const [game, setGame] = useState(initial)
    current = game
    send = command => setGame(applyGameCommand(game, command))
    captured = usePendingEffect({ game, setGame, dispatch: command => {
      setGame((Array.isArray(command) ? command : [command]).reduce((state, cmd) => applyGameCommand(state, cmd), game))
    }, viewerPlayerId: 'player-one', setMessage: text => { message = text }, clearAttacker: () => {}, setInspectedHpPile: () => {},
      hasFaint: false, faintTargetIds: new Set(), selectedFaintTargetIds: [], faintMinMax: { min: 0, max: 0 }, setSelectedFaintTargetIds: () => {},
      hasAfterDamage: false, afterDamageTargetIds: new Set(), selectedAfterDamageTargetIds: [], afterDamageMinMax: { min: 0, max: 0 }, setSelectedAfterDamageTargetIds: () => {},
    })
    return null
  }
  const root = createRoot(document.createElement('div'))
  try {
    await act(() => root.render(<Harness />))
    const item = initial.players['player-one'].hand[0]
    await act(() => captured!.beginCardAbility(item, item.item!, 'item', '使用物品'))
    expect(captured!.pendingEffect?.sourceCard.instanceId).toBe(item.instanceId)
    await act(() => captured!.toggleSkillPayment('bs12-082-payment-0'))
    if (threshold) await act(() => captured!.toggleSkillPayment('bs12-082-payment-1'))
    else await act(() => captured!.toggleEffectTarget('bs12-082-receiver'))
    await act(() => captured!.confirmEffect())
    expect(current.pendingOpponentHandDiscard?.itemActivation?.instanceId).toBe(item.instanceId)
    expect(current.players).toEqual(initial.players)
    expect(captured!.pendingEffect).toBeNull()
    expect(captured!.suspendedEffect).toBeNull()
    expect(message).toContain('道具費用尚未支付')
    if (action.endsWith('cancel')) {
      await act(() => send({ kind: 'cancel-item-activation', playerId: 'player-one' }))
      expect(current.players).toEqual(initial.players)
      expect(captured!.pendingEffect).toBeNull()
      expect(captured!.suspendedEffect).toBeNull()
    } else {
      await act(() => send({ kind: 'resolve-opponent-hand-discard', playerId: 'player-one', cardIds: ['bs12-082-tax'] }))
      expect(current.players['player-one'].hand).toHaveLength(threshold ? 2 : 0)
      if (threshold) expect(current.pendingDrawUpTo?.max).toBe(4)
      else expect(current.players['player-one'].battleArea[0].rested).toBe(false)
      expect(current.players['player-one'].discardPile).toHaveLength(2)
      expect(current.pendingAbilityEffect).toBeFalsy()
      expect(captured!.pendingEffect).toBeNull()
    }
  } finally { await act(() => root.unmount()) }
})
