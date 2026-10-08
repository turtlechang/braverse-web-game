/// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'
import { applyGameCommand } from '../game/commands'
import { createBs12ButterRollDemoState } from '../game/demo'
import { useMatchController } from './useMatchController'
import { useOnlineMatchController } from './useOnlineMatchController'

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

it('094 local ordinary last-HP FLIP belongs to the defender without changing online ownership', async () => {
  vi.useFakeTimers()
  let revealed = applyGameCommand(createBs12ButterRollDemoState('target-flip'), {
    kind: 'declare-attack', playerId: 'player-one', attackerInstanceId: 'bs12-094-source', targetInstanceId: 'bs12-094-opponent',
    supportPaymentIds: ['bs12-094-payment-0', 'bs12-094-payment-1', 'bs12-094-payment-2'],
  })
  revealed = applyGameCommand(revealed, { kind: 'skip-trap', playerId: 'player-two' })
  for (let i = 0; revealed.pendingBattle?.stage === 'damage' && i < 4; i++) {
    revealed = applyGameCommand(revealed, { kind: 'resolve-next-damage', playerId: 'player-two' })
  }
  expect(revealed.pendingBattle?.stage).toBe('flip')
  expect(revealed.pendingBattle?.damagePlayerId).toBeUndefined()
  expect(revealed.pendingBattle?.defenderPlayerId).toBe('player-two')
  const snapshot = structuredClone(revealed)
  let local: ReturnType<typeof useMatchController> | undefined
  let online: ReturnType<typeof useOnlineMatchController> | undefined
  function Harness() {
    local = useMatchController({ testStateConfig: { kind: 'bs12-094', scenario: 'target-flip' } })
    online = useOnlineMatchController({ game: revealed, viewerPlayerId: 'player-one', sendCommand: vi.fn() })
    return null
  }
  const root = createRoot(document.createElement('div'))
  try {
    await act(() => root.render(<Harness />))
    await act(() => local!.setGame(revealed))
    expect(local!.viewerPlayerId).toBe('player-two')
    expect(online!.viewerPlayerId).toBe('player-one')
    await act(() => vi.advanceTimersByTime(2000))
    expect(local!.game).toEqual(snapshot)
    expect(local!.game.players['player-two'].hand).toHaveLength(1)
    expect(local!.game.players['player-two'].breakArea).toEqual([])
  } finally { await act(() => root.unmount()); vi.useRealTimers() }
})
