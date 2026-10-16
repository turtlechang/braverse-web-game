/// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'
import { fixture } from '../game/st8-004-demo'
import { applyGameCommand } from '../game/commands'
import { takeAiStep } from '../game/ai'
import { useMatchController } from './useMatchController'

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

it('preserves the opponent AI attack Then instead of auto-resolving an empty selection in previews', async () => {
  vi.useFakeTimers()
  let match: ReturnType<typeof useMatchController> | undefined
  function Harness() {
    match = useMatchController({ testStateConfig: { kind: 'deck-addition', cardNumber: 'ST8-003', scenario: 'positive' } })
    return null
  }
  const root = createRoot(document.createElement('div'))
  try {
    await act(() => root.render(<Harness />))
    let state = fixture('ai-positive')
    state = applyGameCommand(state, {
      kind: 'declare-attack', playerId: 'player-two',
      attackerInstanceId: state.players['player-two'].battleArea[0].card.instanceId,
      targetInstanceId: state.players['player-one'].battleArea[0].card.instanceId,
      supportPaymentIds: state.players['player-two'].supportArea.slice(0, 3).map(support => support.card.instanceId),
    })
    state = applyGameCommand(state, { kind: 'skip-trap', playerId: 'player-one' })
    await act(() => match!.setGame(state))
    for (let i = 0; i < 6 && match!.game.pendingBattle?.stage === 'damage'; i++) {
      await act(async () => { await vi.advanceTimersByTimeAsync(20) })
    }
    expect(match!.game.pendingBattle?.stage).toBe('attack-effect')
    expect(match!.game.pendingBattle?.attackerPlayerId).toBe('player-two')
    expect(match!.game.commandLog?.some(entry => entry.commandKind === 'resolve-battle')).toBe(false)
    expect(match!.game.players['player-one'].battleArea[0].hpCards).toHaveLength(1)
    const decision = takeAiStep(match!.game, 'player-two', { level: 5, searchNow: () => 0 })
    expect(decision.action).not.toBe('error')
    expect(decision.state.players['player-two'].supportArea.filter(support => !support.rested)).toHaveLength(1)
  } finally {
    await act(() => root.unmount())
    vi.useRealTimers()
  }
})
