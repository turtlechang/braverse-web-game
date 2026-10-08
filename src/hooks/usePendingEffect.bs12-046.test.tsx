/// @vitest-environment jsdom
import { act, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it } from 'vitest'
import { createBs12CameraDemoState } from '../game/demo'
import { applyGameCommand } from '../game'
import { usePendingEffect } from './usePendingEffect'

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

it('046 offers real G payment and then closes without a draw decision when its event is false', async () => {
  const initial = createBs12CameraDemoState('no-event')
  let current = initial
  let message = ''
  let captured: ReturnType<typeof usePendingEffect> | null = null
  function Harness() {
    const [game, setGame] = useState(initial)
    current = game
    captured = usePendingEffect({ game, setGame, dispatch: (command, _message, onSuccess) => {
      const commands = Array.isArray(command) ? command : [command]
      const next = commands.reduce((state, cmd) => applyGameCommand(state, cmd), game)
      setGame(next)
      onSuccess?.(next)
    }, viewerPlayerId: 'player-one', setMessage: value => { message = value }, clearAttacker: () => {}, setInspectedHpPile: () => {},
    hasFaint: false, faintTargetIds: new Set(), selectedFaintTargetIds: [], faintMinMax: { min: 0, max: 0 }, setSelectedFaintTargetIds: () => {},
    hasAfterDamage: false, afterDamageTargetIds: new Set(), selectedAfterDamageTargetIds: [], afterDamageMinMax: { min: 0, max: 0 }, setSelectedAfterDamageTargetIds: () => {}, })
    return null
  }
  const root = createRoot(document.createElement('div'))
  try {
    await act(() => root.render(<Harness />))
    const item = initial.players['player-one'].hand[0]
    await act(() => captured!.beginCardAbility(item, item.item!, 'item', '使用道具'))
    expect(captured!.pendingEffect?.sourceCard.instanceId).toBe('bs12-046-item')
    expect(current).toBe(initial)
    await act(() => captured!.toggleSkillPayment('bs12-044-support-1'))
    await act(() => captured!.confirmEffect())
    expect(current.players['player-one'].hand, message).toEqual([])
    expect(current.players['player-one'].deck).toHaveLength(12)
    expect(current.players['player-one'].supportArea[1].rested).toBe(true)
    expect(current.players['player-one'].discardPile.map(c => c.instanceId)).toEqual(['bs12-046-item'])
    expect(current.pendingDrawUpTo).toBeFalsy()
    expect(captured!.pendingEffect).toBeNull()
  } finally { await act(() => root.unmount()) }
})
