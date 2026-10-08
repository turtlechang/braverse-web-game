/// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'
import { createBs12MilkyWayDemoState } from '../game/demo'
import { applyGameCommand } from '../game/commands'
import { useMatchController } from './useMatchController'
import { useOnlineMatchController } from './useOnlineMatchController'

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

it.each(['BS12-090', 'BS12-090@1'] as const)('%s retains departed source and own Break LV1 free candidates in local/online UI', async number => {
  vi.useFakeTimers()
  const start = createBs12MilkyWayDemoState(number, 'faint-four')
  const paid = applyGameCommand(start, { kind: 'play-blocker', playerId: 'player-one', sourceInstanceId: 'bs12-090-source', paymentIds: [], discardHandIds: ['bs12-090-cost'] })
  let fainted=paid
  for(let hit=0;hit<4;hit++)fainted=applyGameCommand(fainted,{kind:'resolve-next-damage',playerId:'player-one'})
  let local: ReturnType<typeof useMatchController> | undefined
  let online: ReturnType<typeof useOnlineMatchController> | undefined
  function Harness() {
    local = useMatchController({ testStateConfig: { kind: 'bs12-090', cardNumber: number, scenario: 'faint-four' } })
    online = useOnlineMatchController({ game: fainted, viewerPlayerId: 'player-one', sendCommand: vi.fn() })
    return null
  }
  const root = createRoot(document.createElement('div'))
  try {
    await act(() => root.render(<Harness />))
    await act(() => local!.setGame(paid))
    for(let hit=0;hit<4;hit++)await act(() => vi.advanceTimersByTime(50))
    for (const controller of [local!, online!]) {
      expect(controller.hasFaint).toBe(true)
      expect(controller.faintSourceCard?.instanceId).toBe('bs12-090-source')
      expect(controller.faintSourceCard?.imageUrl).toBe(start.players['player-one'].battleArea[0].card.imageUrl)
      expect(controller.faintCardCandidates.map(card => card.instanceId)).toContain('bs12-090-target')
      expect(controller.faintCandidateLabel).toBe('自己的休息區 LV.1 餅乾')
      expect(controller.faintCostHandAmount).toBe(0)
      expect(controller.faintMin).toBe(0)
      expect(controller.faintMax).toBe(1)
    }
  } finally {
    await act(() => root.unmount())
    vi.useRealTimers()
  }
})
