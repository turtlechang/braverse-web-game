/// @vitest-environment jsdom
import { act, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'
import { createBs12WerewolfDemoState } from '../game/demo'
import type { Bs12WerewolfScenario } from '../game/demo'
import { applyGameCommand } from '../game'
import { usePendingEffect } from './usePendingEffect'
import { useOnlinePendingEffect } from './useOnlinePendingEffect'
import type { DispatchGameCommand } from './useBattleActions'
;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

const attacked = (number: 'BS12-089' | 'BS12-089@1', scenario: Bs12WerewolfScenario) => {
  let state = createBs12WerewolfDemoState(number, scenario)
  state = applyGameCommand(state, { kind: 'declare-attack', playerId: 'player-one', attackerInstanceId: 'bs12-089-attacker',
    targetInstanceId: 'bs12-089-source', supportPaymentIds: Array.from({ length: scenario === 'attacker-all-opponents' ? 4 : 3 }, (_, i) => `bs12-089-enemy-payment-${i}`) })
  state = applyGameCommand(state, { kind: 'skip-trap', playerId: 'player-two' })
  for (let i = 0; state.pendingBattle?.stage === 'damage' && i < 10; i++) state = applyGameCommand(state, { kind: 'resolve-next-damage', playerId: 'player-two' })
  return state
}

for (const number of ['BS12-089', 'BS12-089@1'] as const) {
  for (const scenario of ['attacker-lv3', 'attacker-faints', 'attacker-lv2', 'attacker-all-opponents'] as const) {
    it(`local ${number} ${scenario} uses the engine prevention before opening a cost or target panel`, async () => {
      vi.useFakeTimers()
      const initial = attacked(number, scenario)
      let currentGame = initial
      let current: ReturnType<typeof usePendingEffect> | undefined
      function Harness() {
        const [game, setGame] = useState(initial)
        currentGame = game
        current = usePendingEffect({ game, setGame, viewerPlayerId: 'player-one', dispatch: vi.fn<DispatchGameCommand>(),
          setMessage: () => {}, clearAttacker: () => {}, setInspectedHpPile: () => {},
          hasFaint: false, faintTargetIds: new Set(), selectedFaintTargetIds: [], faintMinMax: { min: 0, max: 0 }, setSelectedFaintTargetIds: () => {},
          hasAfterDamage: false, afterDamageTargetIds: new Set(), selectedAfterDamageTargetIds: [], afterDamageMinMax: { min: 0, max: 0 }, setSelectedAfterDamageTargetIds: () => {},
        })
        return null
      }
      const root = createRoot(document.createElement('div'))
      try {
        await act(() => root.render(<Harness />))
        await act(() => vi.runOnlyPendingTimers())
        if (scenario === 'attacker-lv2') {
          expect(current!.pendingEffect?.sourceCard.name).toBe('Parfait Cookie')
          expect(currentGame.pendingBattle?.stage).toBe('attack-effect')
        } else {
          expect(current!.pendingEffect).toBeNull()
          expect(currentGame.pendingOptionalCostAttack).toBeFalsy()
          expect(currentGame.pendingBattle).toBeNull()
          expect(currentGame.players['player-one'].hand).toEqual(initial.players['player-one'].hand)
          expect(currentGame.commandLog?.filter(entry => entry.commandKind === 'resolve-attack-effect')).toHaveLength(1)
        }
      } finally { await act(() => root.unmount()); vi.useRealTimers() }
    })
    it(`online ${number} ${scenario} suppresses the panel and dispatches one truthful no-op`, async () => {
      const game = attacked(number, scenario)
      const dispatch = vi.fn<DispatchGameCommand>()
      let current: ReturnType<typeof useOnlinePendingEffect> | undefined
      function Harness() { current = useOnlinePendingEffect({ game, viewerPlayerId: 'player-one', dispatch, hasFaint: false, hasAfterDamage: false }); return null }
      const root = createRoot(document.createElement('div'))
      try {
        await act(() => root.render(<Harness />))
        if (scenario === 'attacker-lv2') {
          expect(current!.pendingEffect?.sourceCard.name).toBe('Parfait Cookie')
          expect(dispatch).not.toHaveBeenCalled()
        } else {
          expect(current!.pendingEffect).toBeNull()
          expect(dispatch).toHaveBeenCalledOnce()
          expect(dispatch.mock.calls[0][0]).toEqual({ kind: 'resolve-attack-effect', playerId: 'player-one', targetIds: [] })
          expect(dispatch.mock.calls[0][1]).toMatch(/Werewolf Cookie.*LV\.3.*無法發動/)
        }
      } finally { await act(() => root.unmount()) }
    })
  }
}
