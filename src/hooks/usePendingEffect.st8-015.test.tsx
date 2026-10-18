/// @vitest-environment jsdom
import { act, useState, type Dispatch, type SetStateAction } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it } from 'vitest'
import { createSt8015PreviewState } from '../game/st8-015-demo'
import { applyGameCommand, type GameCommand, type GameState } from '../game'
import { usePendingEffect } from './usePendingEffect'
import type { DispatchGameCommand } from './useBattleActions'

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

const createDispatch = (
  getGame: () => GameState,
  setGame: Dispatch<SetStateAction<GameState>>,
): DispatchGameCommand => (command, _message, onSuccess) => {
  const commands: GameCommand[] = Array.isArray(command) ? command : [command]
  const nextGame = commands.reduce((state, current) => applyGameCommand(state, current), getGame())
  setGame(nextGame)
  onSuccess?.(nextGame)
}

describe('usePendingEffect ST8-015 conditional Then', () => {
  it.each([0, 1])('preserves the independent Then without Wind Archer when mode %i is selected', async modeIndex => {
    const initial = createSt8015PreviewState('no-wind')
    const before = structuredClone(initial)
    const originalPlayer = initial.players['player-one']
    const item = originalPlayer.hand.find(card => card.id === 'ST8-015')
    const thenTarget = originalPlayer.supportArea.find(support => support.card.id === 'ST1-016')
    if (item?.type !== 'item' || !item.item || !thenTarget) {
      throw new Error('ST8-015 no-Wind fixture must include its Item and an existing Then target')
    }

    let currentGame = initial
    let captured: ReturnType<typeof usePendingEffect> | null = null
    function TestHarness() {
      const [game, setGameState] = useState(initial)
      currentGame = game
      const setGame: Dispatch<SetStateAction<GameState>> = next => setGameState(next)
      captured = usePendingEffect({
        game,
        setGame,
        dispatch: createDispatch(() => currentGame, setGame),
        viewerPlayerId: 'player-one',
        setMessage: () => undefined,
        clearAttacker: () => undefined,
        setInspectedHpPile: () => undefined,
        hasFaint: false,
        faintTargetIds: new Set(),
        selectedFaintTargetIds: [],
        faintMinMax: { min: 0, max: 0 },
        setSelectedFaintTargetIds: () => undefined,
        hasAfterDamage: false,
        afterDamageTargetIds: new Set(),
        selectedAfterDamageTargetIds: [],
        afterDamageMinMax: { min: 0, max: 0 },
        setSelectedAfterDamageTargetIds: () => undefined,
      })
      return null
    }

    const root = createRoot(document.createElement('div'))
    try {
      await act(() => root.render(<TestHarness />))
      await act(() => captured!.beginCardAbility(item, item.item!, 'item', '使用物品'))
      for (const support of originalPlayer.supportArea.slice(0, 2)) {
        await act(() => captured!.toggleSkillPayment(support.card.instanceId))
      }
      await act(() => captured!.chooseEffectMode(modeIndex))
      await act(() => captured!.confirmEffect())

      const pending = currentGame.pendingAbilityEffect
      expect(currentGame.commandLog?.map(entry => entry.commandKind)).toEqual(['begin-play-item'])
      expect(pending?.effects[pending.effectIndex]).toMatchObject({ kind: 'support-to-hand', amount: 1, optional: true })
      expect(captured!.currentEffect?.kind).toBe('support-to-hand')
      expect(captured!.pendingEffect?.skillActivated).toBe(true)
      expect(currentGame.players['player-one'].deck).toEqual(originalPlayer.deck)
      expect(currentGame.players['player-one'].supportArea).toEqual(originalPlayer.supportArea.map((support, index) =>
        index < 2 ? { ...support, rested: true } : support,
      ))
      expect(currentGame.players['player-one'].discardPile).toContainEqual(item)
      expect(currentGame.players['player-one'].hand).not.toContainEqual(thenTarget.card)
      expect(initial).toEqual(before)

      await act(() => captured!.toggleEffectTarget(thenTarget.card.instanceId))
      await act(() => captured!.confirmEffect())

      expect(currentGame.players['player-one'].hand).toContainEqual(thenTarget.card)
      expect(currentGame.players['player-one'].supportArea.some(support => support.card.instanceId === thenTarget.card.instanceId))
        .toBe(false)
      expect(currentGame.players['player-one'].deck).toEqual(originalPlayer.deck)
      expect(currentGame.commandLog?.map(entry => entry.commandKind)).toEqual([
        'begin-play-item', 'resolve-ability-effect',
      ])
      expect(currentGame.commandLog?.at(-1)?.payload).toMatchObject({ targetIds: [thenTarget.card.instanceId] })
    } finally {
      await act(() => root.unmount())
    }
  })
})
