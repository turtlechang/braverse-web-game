/// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'
import { createBs12ChouxDemoState } from '../game/demo'
import { executeCardEffect } from '../game/effects'
import { useMatchController } from './useMatchController'
import { useOnlineMatchController } from './useOnlineMatchController'

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

it.each(['BS12-032', 'BS12-032@1'] as const)('%s retains the public source card after a queued effect moves from Break to trash', async number => {
  const before = createBs12ChouxDemoState('ui-choice', number)
  const moved = executeCardEffect(before, { sourcePlayerId: 'player-one', sourceInstanceId: 'bs12-032-ally' }, { kind: 'break-to-trash', max: 1 }, ['bs12-032-source'])
  expect(moved.pendingAfterDamageEffects).toHaveLength(1)
  expect(moved.players['player-one'].discardPile.at(-1)?.instanceId).toBe('bs12-032-source')
  let controller: ReturnType<typeof useMatchController> | undefined
  let online: ReturnType<typeof useOnlineMatchController> | undefined
  function Harness() {
    controller = useMatchController({ testStateConfig: { kind: 'bs12-032', cardNumber: number, scenario: 'ui-choice' } })
    online = useOnlineMatchController({ game: moved, viewerPlayerId: 'player-one', sendCommand: vi.fn() })
    return null
  }
  const root = createRoot(document.createElement('div'))
  try {
    await act(() => root.render(<Harness />))
    await act(() => controller!.setGame(moved))
    expect(controller!.hasAfterDamage).toBe(true)
    expect(controller!.afterDamageSourceCard?.instanceId).toBe('bs12-032-source')
    expect(controller!.afterDamageCandidates.map(entry => entry.card.instanceId)).toEqual(['bs12-032-ally', 'bs12-032-ally-other'])
    expect(online!.hasAfterDamage).toBe(true)
    expect(online!.afterDamageSourceCard?.instanceId).toBe('bs12-032-source')
    expect(online!.afterDamageCandidates.map(entry => entry.card.instanceId)).toEqual(['bs12-032-ally', 'bs12-032-ally-other'])
  } finally {
    await act(() => root.unmount())
  }
})
