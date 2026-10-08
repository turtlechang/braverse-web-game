/// @vitest-environment jsdom
import { act, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it } from 'vitest'
import { createBs12DjDemoState } from '../game/demo'
import { applyGameCommand, maskGameStateForViewer, type GameCommand } from '../game'
import { useOnlinePendingEffect } from './useOnlinePendingEffect'

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

it.each(['cancel', 'pay'] as const)('online Item draft delegates DJ costs to authoritative commands: %s', async action => {
  const initial = createBs12DjDemoState()
  let current = initial
  let captured: ReturnType<typeof useOnlinePendingEffect> | null = null
  let send: (command: GameCommand) => void = () => {}
  const commands: GameCommand[] = []
  function Harness() {
    const [game, setGame] = useState(initial)
    current = game
    send = command => { commands.push(command); setGame(applyGameCommand(game, command)) }
    captured = useOnlinePendingEffect({ game: maskGameStateForViewer(game, 'player-one'), viewerPlayerId: 'player-one', hasFaint: false, hasAfterDamage: false,
      dispatch: command => {
        const batch = Array.isArray(command) ? command : [command]
        commands.push(...batch)
        setGame(batch.reduce((state, cmd) => applyGameCommand(state, cmd), game))
      },
    })
    return null
  }
  const root = createRoot(document.createElement('div'))
  try {
    await act(() => root.render(<Harness />))
    await act(() => captured!.beginPlayItem(initial.players['player-one'].hand[0]))
    await act(() => captured!.toggleDraftPayment('bs12-082-payment-0'))
    await act(() => captured!.toggleTarget('bs12-082-receiver'))
    await act(() => captured!.confirmEffect())
    expect(current.players).toEqual(initial.players)
    expect(current.pendingOpponentHandDiscard?.itemActivation?.instanceId).toBe('bs12-082-item')
    expect(captured!.abilityCostDraft).toBeNull()
    expect(commands.map(command => command.kind)).toEqual(['begin-play-item'])
    if (action === 'cancel') {
      await act(() => send({ kind: 'cancel-item-activation', playerId: 'player-one' }))
      expect(current.players).toEqual(initial.players)
      expect(captured!.pendingEffect).toBeNull()
    } else {
      await act(() => send({ kind: 'resolve-opponent-hand-discard', playerId: 'player-one', cardIds: ['bs12-082-tax'] }))
      expect(current.players['player-one'].hand).toEqual([])
      expect(current.players['player-one'].discardPile.map(card => card.instanceId)).toEqual(['bs12-082-tax', 'bs12-082-item'])
      expect(current.players['player-one'].battleArea[0].rested).toBe(false)
      expect(current.pendingAbilityEffect).toBeFalsy()
      expect(captured!.pendingEffect).toBeNull()
    }
  } finally { await act(() => root.unmount()) }
})
