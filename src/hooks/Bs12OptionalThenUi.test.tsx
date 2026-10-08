/// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { applyGameCommand, type GameState } from '../game'
import { createBs12BananaRotiDemoState, type Bs12BananaRotiScenario } from '../game/demo'
import { usePendingEffect } from './usePendingEffect'
import { useOnlinePendingEffect } from './useOnlinePendingEffect'

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true
afterEach(() => vi.useRealTimers())
const attackEffect = (scenario: Bs12BananaRotiScenario) => {
  let game = createBs12BananaRotiDemoState(scenario)
  game = applyGameCommand(game, { kind: 'declare-attack', playerId: 'player-one', attackerInstanceId: 'bs12-026-source', targetInstanceId: 'bs12-026-opponent', supportPaymentIds: game.players['player-one'].supportArea.map(s => s.card.instanceId) })
  game = applyGameCommand(game, { kind: 'skip-trap', playerId: 'player-two' })
  while (game.pendingBattle?.stage === 'damage') game = applyGameCommand(game, { kind: 'resolve-next-damage', playerId: 'player-two' })
  if (game.pendingReplacement) game = applyGameCommand(game, { kind: 'skip-replacement', playerId: 'player-two' })
  expect(game.pendingBattle?.stage).toBe('attack-effect')
  return game
}

describe('BS12-026 paid Then remains a decision before condition checking', () => {
  it.each(['four-arena', 'three-arena', 'target-faints'] as const)('offline %s waits for payment without announcing a skip', async scenario => {
    vi.useFakeTimers()
    const game = attackEffect(scenario)
    const setGame = vi.fn()
    const setMessage = vi.fn()
    function Harness() {
      usePendingEffect({ game, setGame, dispatch: vi.fn(), viewerPlayerId: 'player-one', setMessage,
        clearAttacker: vi.fn(), setInspectedHpPile: vi.fn(), hasFaint: false, faintTargetIds: new Set(), selectedFaintTargetIds: [], faintMinMax: { min: 0, max: 0 }, setSelectedFaintTargetIds: vi.fn(),
        hasAfterDamage: false, afterDamageTargetIds: new Set(), selectedAfterDamageTargetIds: [], afterDamageMinMax: { min: 0, max: 0 }, setSelectedAfterDamageTargetIds: vi.fn() })
      return null
    }
    const root = createRoot(document.createElement('div'))
    try {
      await act(() => root.render(<Harness />))
      await act(() => vi.runAllTimers())
      expect(setGame).toHaveBeenCalledTimes(1)
      const update = setGame.mock.calls[0][0] as (state: GameState) => GameState
      const next = update(game)
      expect(next.pendingOptionalCostAttack).toMatchObject({ payBeforeCondition: true, cost: { discardHand: 1 } })
      expect(next.players).toEqual(game.players)
      expect(setMessage).toHaveBeenCalledWith('Banana Roti Cookie等待決定是否支付攻擊後續效果代價。')
      expect(setMessage.mock.calls.flat().join(' ')).not.toContain('已略過')
    } finally { await act(() => root.unmount()) }
  })
  it.each(['four-arena', 'three-arena', 'target-faints'] as const)('online %s does not dispatch a premature skip', async scenario => {
    const game = attackEffect(scenario)
    const dispatch = vi.fn()
    function Harness() {
      useOnlinePendingEffect({ game, viewerPlayerId: 'player-one', dispatch, hasFaint: false, hasAfterDamage: false })
      return null
    }
    const root = createRoot(document.createElement('div'))
    try {
      await act(() => root.render(<Harness />))
      expect(dispatch).not.toHaveBeenCalled()
    } finally { await act(() => root.unmount()) }
  })
})
