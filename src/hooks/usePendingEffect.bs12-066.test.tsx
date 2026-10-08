/// @vitest-environment jsdom
import { act, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'
import { createBs12EndingPoseDemoState } from '../game/demo'
import { applyGameCommand } from '../game'
import { usePendingEffect } from './usePendingEffect'
;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

it('local target UI retains the publicly played Trap after Refresh hides it in the deck', async () => {
  vi.useFakeTimers()
  let initial = applyGameCommand(createBs12EndingPoseDemoState('short-deck'), { kind: 'play-trap', playerId: 'player-one', trapInstanceId: 'bs12-066-trap', paymentIds: ['bs12-066-payment'], targetIds: [] })
  initial = applyGameCommand(initial, { kind: 'resolve-reveal-top-deck', playerId: 'player-one' })
  initial = applyGameCommand(initial, { kind: 'refresh-deck', playerId: 'player-one', cookieInstanceId: 'bs12-066-refresh-cookie', shuffleSeed: 1 })
  initial.players['player-one'] = { ...initial.players['player-one'], deck: initial.players['player-one'].deck.map(c => ({ id: 'hidden', instanceId: c.instanceId, type: 'item', name: 'Hidden card' })) }
  let captured: ReturnType<typeof usePendingEffect> | null = null
  function Harness() {
    const [game, setGame] = useState(initial)
    captured = usePendingEffect({ game, setGame, dispatch: vi.fn(), viewerPlayerId: 'player-one', setMessage: vi.fn(), clearAttacker: vi.fn(), setInspectedHpPile: vi.fn(),
      hasFaint: false, faintTargetIds: new Set(), selectedFaintTargetIds: [], faintMinMax: { min: 0, max: 0 }, setSelectedFaintTargetIds: vi.fn(),
      hasAfterDamage: false, afterDamageTargetIds: new Set(), selectedAfterDamageTargetIds: [], afterDamageMinMax: { min: 0, max: 0 }, setSelectedAfterDamageTargetIds: vi.fn() })
    return null
  }
  const root = createRoot(document.createElement('div'))
  try {
    await act(() => root.render(<Harness />))
    await act(() => vi.runAllTimers())
    expect(captured!.pendingEffect?.sourceCard).toMatchObject({ id: 'BS12-066', type: 'trap', imageUrl: 'https://cookierunbraverse.com/data/en_storage/PbwDhvQgH1K0aHBbd20V0A.webp' })
    expect(captured!.pendingEffect?.triggerLabel).toBe('陷阱效果')
    expect(captured!.currentEffect).toMatchObject({ kind: 'modify-attack', amount: -2 })
  } finally { await act(() => root.unmount()); vi.useRealTimers() }
})
