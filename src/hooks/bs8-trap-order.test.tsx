/// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it, vi } from 'vitest'
import { createCardCheckDemoState } from '../game/demo'
import { useMatchController } from './useMatchController'
import { useOnlineMatchController } from './useOnlineMatchController'

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

describe('BS8-023 ordered trap selection', () => {
  it.each(['local', 'online'])('%s requires all eligible Cookies and preserves click order', async mode => {
    const game = createCardCheckDemoState('BS8-023')
    const trap = game.players['player-one'].hand.find(card => card.id === 'BS8-023')!
    let local: ReturnType<typeof useMatchController> | undefined
    let online: ReturnType<typeof useOnlineMatchController> | undefined
    function Local() {
      local = useMatchController({ testStateConfig: null })
      return null
    }
    function Online() {
      online = useOnlineMatchController({ game, viewerPlayerId: 'player-one', sendCommand: vi.fn() })
      return null
    }
    const container = document.createElement('div')
    const root = createRoot(container)
    try {
      await act(() => root.render(mode === 'local' ? <Local /> : <Online />))
      if (local) await act(() => local!.setGame(game))
      const controller = () => (mode === 'local' ? local! : online!)
      await act(() => controller().setSelectedTrapId(trap.instanceId))
      expect(controller().trapEffectTargetSteps).toHaveLength(1)
      const step = controller().trapEffectTargetSteps[0]
      expect(step).toMatchObject({ ordered: true, min: 2, max: 2, allowEmpty: false })
      const ids = step.candidates.map(cookie => cookie.card.instanceId).reverse()
      for (const id of ids) await act(() => controller().selectTrapEffectTarget(0, id))
      expect(controller().trapEffectTargetSteps[0].selectedTargetIds).toEqual(ids)
      await act(() => controller().selectTrapEffectTarget(0, ids[0]))
      expect(controller().trapEffectTargetSteps[0].selectedTargetIds).toEqual([ids[1]])
    } finally {
      await act(() => root.unmount())
    }
  })
})
