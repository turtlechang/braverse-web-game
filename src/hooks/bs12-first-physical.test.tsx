/// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'
import { applyGameCommand } from '../game/commands'
import { parseTestStateConfig } from '../game/demo'
import { useMatchController } from './useMatchController'
import { useAiTurn } from './useAiTurn'

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

it.each(['positive', 'blocked', 'paid'] as const)('physical FLIP preview %s keeps its resources and turn stable while the user inspects them', async scenario => {
  vi.useFakeTimers()
  let match: ReturnType<typeof useMatchController> | undefined
  const config = parseTestStateConfig(scenario === 'blocked' ? '?test-state=card-negative:BS12-004' : '?test-state=card:BS12-002', 'localhost')!
  function Harness() {
    match = useMatchController({ testStateConfig: config })
    useAiTurn({ game: match.game, setGame: match.setGame, setMessage: match.setMessage,
      showPause: match.animations.isPlaying, aiControlsCurrentState: match.aiControlsCurrentState,
      pendingEffect: null, faintActive: false, afterDamageActive: false, deckConfig: match.deckConfig })
    return null
  }
  const root = createRoot(document.createElement('div'))
  try {
    await act(() => root.render(<Harness />))
    if (scenario === 'paid') await act(() => match!.setGame(current => applyGameCommand(current, {
      kind: 'resolve-flip', playerId: 'player-one', activate: true, discardHandIds: ['bs12-flip-hand-cost'], targetIds: ['bs12-flip-bearer'],
    })))
    for (let step = 0; step < 20; step++) await act(() => vi.advanceTimersByTime(500))
    expect(match!.game.turnNumber).toBe(2)
    expect(match!.game.activePlayerId).toBe('player-two')
    expect(match!.game.players['player-one'].deck).toHaveLength(scenario === 'paid' ? 9 : 10)
    expect(match!.game.players['player-one'].hand).toHaveLength(scenario === 'paid' ? 0 : 1)
    expect(match!.game.players['player-one'].battleArea[0].hpCards).toHaveLength(scenario === 'paid' ? 2 : 1)
    if (scenario === 'positive') expect(match!.game.pendingBattle?.stage).toBe('flip')
    const before = structuredClone(match!.game.players)
    for (let step = 0; step < 20; step++) await act(() => vi.advanceTimersByTime(500))
    expect(match!.game.players).toEqual(before)
  } finally { await act(() => root.unmount()); vi.useRealTimers() }
})
