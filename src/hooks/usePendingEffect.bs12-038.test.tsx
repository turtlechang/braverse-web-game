/// @vitest-environment jsdom
import { act, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it, vi } from 'vitest'
import { createBs12GreenbellDemoState } from '../game/demo'
import { applyGameCommand, type GameState } from '../game'
import { usePendingEffect } from './usePendingEffect'

describe('BS12-038 On Play waits for setup Refresh', () => {
  it.each(['BS12-038', 'BS12-038@1'] as const)('%s preserves pending On Play and resumes after Refresh', async number => {
    vi.useFakeTimers()
    const initial = applyGameCommand(createBs12GreenbellDemoState('short-deck', number), {
      kind: 'activate-skill', playerId: 'player-one', sourceInstanceId: 'bs12-038-deployer',
      trigger: 'activate', paymentIds: [], effectTargets: [['bs12-038-source']],
    })
    expect(initial.pendingRefresh).toBeTruthy()
    expect(initial.pendingOnPlay).toMatchObject({ sourceInstanceId: 'bs12-038-source', origin: 'support' })
    let currentGame = initial
    let captured: ReturnType<typeof usePendingEffect> | null = null
    let updateGame: (state: GameState) => void = () => {}
    const message = vi.fn()
    function Harness() {
      const [game, setGame] = useState(initial)
      currentGame = game
      updateGame = setGame
      captured = usePendingEffect({
        game, setGame, dispatch: (command, _message, onSuccess) => {
          const commands = Array.isArray(command) ? command : [command]
          const next = commands.reduce((state, cmd) => applyGameCommand(state, cmd), game)
          setGame(next)
          onSuccess?.(next)
        }, viewerPlayerId: 'player-one', setMessage: message,
        clearAttacker: () => {}, setInspectedHpPile: () => {},
        hasFaint: false, faintTargetIds: new Set(), selectedFaintTargetIds: [],
        faintMinMax: { min: 0, max: 0 }, setSelectedFaintTargetIds: () => {},
        hasAfterDamage: false, afterDamageTargetIds: new Set(), selectedAfterDamageTargetIds: [],
        afterDamageMinMax: { min: 0, max: 0 }, setSelectedAfterDamageTargetIds: () => {},
      })
      return null
    }
    const root = createRoot(document.createElement('div'))
    try {
      await act(() => root.render(<Harness />))
      const card = initial.players['player-one'].battleArea[1].card
      await act(() => captured!.handleOnPlayTrigger(initial))
      await act(() => captured!.beginCookieSkill(initial, card, 'player-one', 'on-play', 'OnPlay', true))
      await act(() => vi.runAllTimers())
      expect(currentGame).toBe(initial)
      expect(captured!.pendingEffect).toBeNull()
      expect(message).not.toHaveBeenCalled()
      const refreshed = applyGameCommand(currentGame, { kind: 'refresh-deck', playerId: 'player-one', cookieInstanceId: 'bs12-038-refresh', shuffleSeed: 38 })
      await act(() => updateGame(refreshed))
      await act(() => vi.runAllTimers())
      expect(captured!.pendingEffect?.sourceCard.instanceId).toBe('bs12-038-source')
      expect(captured!.pendingEffect?.effects).toContainEqual(expect.objectContaining({ kind: 'deck-to-support', rested: true }))
      const top = refreshed.players['player-one'].deck[0]
      await act(() => captured!.confirmEffect())
      expect(currentGame.players['player-one'].supportArea.at(-1)).toEqual({ card: top, rested: true })
      expect(currentGame.players['player-one'].deck).toHaveLength(4)
      expect(currentGame.players['player-one'].battleArea[1].hpCards).toHaveLength(2)
      expect(currentGame.pendingOnPlay).toBeNull()
      expect(currentGame.commandLog?.some(entry => entry.commandKind === 'skip-on-play')).toBe(false)
    } finally {
      await act(() => root.unmount())
      vi.useRealTimers()
    }
  })
})
