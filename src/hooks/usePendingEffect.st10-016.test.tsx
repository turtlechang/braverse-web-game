/// @vitest-environment jsdom
import { act, useState, type Dispatch, type SetStateAction } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it } from 'vitest'
import { createSt1014To016ItemPreviewState } from '../game/st10-014-016-demo'
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

describe('usePendingEffect ST10-016 Item condition after its own discard', () => {
  it('opens the target choice when the Item itself raises trash from 14 to the printed threshold of 15', async () => {
    const initial = createSt1014To016ItemPreviewState('ST10-016', 'fourteen-trash')
    const original = structuredClone(initial)
    const own = initial.players['player-one']
    const item = own.hand.find(card => card.id === 'ST10-016')
    const payment = own.supportArea[0]?.card
    const opponent = initial.players['player-two'].battleArea[0]
    if (item?.type !== 'item' || !item.item || !payment || !opponent) {
      throw new Error('ST10-016 physical fixture must include its Item, purple payment, and opponent Cookie')
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
      await act(() => captured!.toggleSkillPayment(payment.instanceId))
      expect(captured!.currentEffect?.kind).toBe('damage')
      await act(() => captured!.confirmEffect())

      expect(currentGame.commandLog?.map(entry => entry.commandKind)).toEqual(['begin-play-item'])
      expect(currentGame.players['player-one'].discardPile).toHaveLength(15)
      expect(currentGame.pendingAbilityEffect?.effects[currentGame.pendingAbilityEffect.effectIndex]).toMatchObject({
        kind: 'damage', amount: 1,
      })
      expect(captured!.pendingEffect?.skillActivated).toBe(true)
      expect(initial).toEqual(original)

      await act(() => captured!.toggleEffectTarget(opponent.card.instanceId))
      await act(() => captured!.confirmEffect())

      expect(currentGame.commandLog?.map(entry => entry.commandKind)).toEqual([
        'begin-play-item', 'resolve-ability-effect',
      ])
      expect(currentGame.commandLog?.at(-1)?.payload).toMatchObject({ targetIds: [opponent.card.instanceId] })
      expect(currentGame.players['player-two'].battleArea[0]?.hpCards).toHaveLength(opponent.hpCards.length - 1)
      expect(currentGame.players['player-two'].discardPile).toHaveLength(1)
    } finally {
      await act(() => root.unmount())
    }
  })
})
