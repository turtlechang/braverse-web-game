/// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'
import { createBs12BlackSapphireDemoState } from '../game/demo'
import { applyGameCommand } from '../game/commands'
import { useMatchController } from './useMatchController'
import { useOnlineMatchController } from './useOnlineMatchController'

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

it.each(['BS12-088', 'BS12-088@1'] as const)('%s stops automatic demo damage at the real faint payment and retains the departed source in local/online UI', async number => {
  vi.useFakeTimers()
  const declared = createBs12BlackSapphireDemoState(number, 'faint')
  const paid = applyGameCommand(declared, { kind: 'play-blocker', playerId: 'player-one', sourceInstanceId: 'bs12-088-source', paymentIds: [], discardHandIds: ['bs12-088-block-cost'] })
  let fainted=paid
  for(let hit=0;hit<3;hit++)fainted=applyGameCommand(fainted,{kind:'resolve-next-damage',playerId:'player-one'})
  let controller: ReturnType<typeof useMatchController> | undefined
  let online: ReturnType<typeof useOnlineMatchController> | undefined
  function Harness() {
    controller = useMatchController({ testStateConfig: { kind: 'bs12-088', cardNumber: number, scenario: 'faint' } })
    online = useOnlineMatchController({ game: fainted, viewerPlayerId: 'player-one', sendCommand: vi.fn() })
    return null
  }
  const root = createRoot(document.createElement('div'))
  try {
    await act(() => root.render(<Harness />))
    await act(() => controller!.setGame(paid))
    for(let hit=0;hit<3;hit++)await act(() => vi.advanceTimersByTime(50))
    expect(controller!.hasFaint).toBe(true)
    expect(controller!.pendingFaint?.effect).toEqual({ kind: 'draw-up-to', max: 2 })
    expect(controller!.faintSourceCard?.instanceId).toBe('bs12-088-source')
    expect(controller!.faintCostHandCandidates.map(card => card.instanceId)).toEqual(['bs12-088-faint-cost'])
    expect(controller!.game.players['player-one'].hand).toEqual(paid.players['player-one'].hand)
    expect(online!.hasFaint).toBe(true)
    expect(online!.faintSourceCard?.imageUrl).toBe(controller!.faintSourceCard?.imageUrl)
    expect(online!.faintCostHandCandidates.map(card => card.instanceId)).toEqual(['bs12-088-faint-cost'])
  } finally {
    await act(() => root.unmount())
    vi.useRealTimers()
  }
})
