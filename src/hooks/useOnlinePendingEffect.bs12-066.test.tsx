/// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'
import { createBs12EndingPoseDemoState } from '../game/demo'
import { applyGameCommand } from '../game'
import { useOnlinePendingEffect } from './useOnlinePendingEffect'
;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

it('online target UI uses the public Trap receipt after Refresh without reading hidden deck cards', async () => {
  let initial = applyGameCommand(createBs12EndingPoseDemoState('short-deck'), { kind: 'play-trap', playerId: 'player-one', trapInstanceId: 'bs12-066-trap', paymentIds: ['bs12-066-payment'], targetIds: [] })
  initial = applyGameCommand(initial, { kind: 'resolve-reveal-top-deck', playerId: 'player-one' })
  initial = applyGameCommand(initial, { kind: 'refresh-deck', playerId: 'player-one', cookieInstanceId: 'bs12-066-refresh-cookie', shuffleSeed: 1 })
  initial.players['player-one'] = { ...initial.players['player-one'], deck: initial.players['player-one'].deck.map(c => ({ id: 'hidden', instanceId: c.instanceId, type: 'item', name: 'Hidden card' })) }
  let captured: ReturnType<typeof useOnlinePendingEffect> | null = null
  const root = createRoot(document.createElement('div'))
  function Harness() {
    captured = useOnlinePendingEffect({ game: initial, viewerPlayerId: 'player-one', hasFaint: false, hasAfterDamage: false, dispatch: vi.fn() })
    return null
  }
  try {
    await act(() => root.render(<Harness />))
    expect(captured!.pendingEffect?.sourceCard).toMatchObject({ id: 'BS12-066', type: 'trap', imageUrl: 'https://cookierunbraverse.com/data/en_storage/PbwDhvQgH1K0aHBbd20V0A.webp' })
    expect(captured!.currentEffect).toMatchObject({ kind: 'modify-attack', amount: -2 })
  } finally { await act(() => root.unmount()) }
})
