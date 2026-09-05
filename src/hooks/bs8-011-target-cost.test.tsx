/// @vitest-environment jsdom
import { act, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it } from 'vitest'
import { applyGameCommand, type GameState } from '../game'
import { createBs8011DoubleSkillDemoState } from '../game/demo'
import { maskGameStateForViewer } from '../game/masked-state'
import type { DispatchGameCommand } from './useBattleActions'
import { usePendingEffect } from './usePendingEffect'
import { useOnlinePendingEffect } from './useOnlinePendingEffect'

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

describe('BS8-011 UI target declaration cost', () => {
  it.each(['pay', 'cancel'])('local %s preserves resources until both owners are selected', async (mode) => {
    const initial = createBs8011DoubleSkillDemoState()
    let current = initial
    let captured: ReturnType<typeof usePendingEffect> | null = null
    function Harness() {
      const [game, setGame] = useState(initial)
      current = game
      const dispatch: DispatchGameCommand = (input) => setGame(
        (Array.isArray(input) ? input : [input]).reduce((state, command) => applyGameCommand(state, command), game),
      )
      captured = usePendingEffect({
        game, setGame, dispatch, viewerPlayerId: 'player-one', setMessage: () => {},
        clearAttacker: () => {}, setInspectedHpPile: () => {}, hasFaint: false,
        faintTargetIds: new Set(), selectedFaintTargetIds: [], faintMinMax: { min: 0, max: 0 },
        setSelectedFaintTargetIds: () => {}, hasAfterDamage: false,
        afterDamageTargetIds: new Set(), selectedAfterDamageTargetIds: [],
        afterDamageMinMax: { min: 0, max: 0 }, setSelectedAfterDamageTargetIds: () => {},
      })
      return null
    }
    const root = createRoot(document.createElement('div'))
    await act(() => root.render(<Harness />))
    const own = initial.players['player-one']
    const opponent = initial.players['player-two'].battleArea[0]
    await act(() => captured!.beginCookieSkill(initial, own.battleArea[0].card, 'player-one', 'activate', 'Activate 主動發動'))
    await act(() => captured!.toggleSkillPayment(own.supportArea[0].card.instanceId))
    await act(() => captured!.toggleEffectTarget(own.battleArea[0].card.instanceId))
    await act(() => captured!.confirmEffect())
    expect(current).toBe(initial)
    await act(() => captured!.toggleEffectTarget(own.battleArea[1].card.instanceId))
    expect(captured!.effectSelectionError).toBe('必須從雙方各選 1 張餅乾。')
    await act(() => captured!.confirmEffect())
    expect(current).toBe(initial)
    await act(() => captured!.toggleEffectTarget(own.battleArea[1].card.instanceId))
    await act(() => captured!.toggleEffectTarget(opponent.card.instanceId))
    expect(captured!.effectSelectionError).toBeNull()
    await act(() => mode === 'pay' ? captured!.confirmEffect() : captured!.cancelPendingSkill())
    expect(captured!.pendingEffect).toBeNull()
    expect(current.players['player-two'].battleArea[0].hpCards).toHaveLength(opponent.hpCards.length - Number(mode === 'pay'))
    expect(current.players['player-one'].supportArea.filter((support) => support.rested)).toHaveLength(Number(mode === 'pay'))
    if (mode === 'cancel') expect(current).toBe(initial)
    await act(() => root.unmount())
  })

  it.each(['pay', 'cancel'])('online %s uses the same complete selection before any command', async (mode) => {
    const initial = createBs8011DoubleSkillDemoState()
    let game: GameState = initial
    let captured: ReturnType<typeof useOnlinePendingEffect> | null = null
    let commandCount = 0
    const dispatch: DispatchGameCommand = (input) => {
      if (Array.isArray(input)) throw new Error('Expected one atomic command')
      commandCount += 1
      game = applyGameCommand(game, input)
    }
    function Harness() {
      captured = useOnlinePendingEffect({ game: maskGameStateForViewer(game, 'player-one'),
        viewerPlayerId: 'player-one', dispatch, hasFaint: false, hasAfterDamage: false })
      return null
    }
    const root = createRoot(document.createElement('div'))
    await act(() => root.render(<Harness />))
    const own = initial.players['player-one']
    const opponent = initial.players['player-two'].battleArea[0]
    await act(() => captured!.beginCookieSkill(own.battleArea[0].card, 'activate'))
    await act(() => captured!.toggleDraftPayment(own.supportArea[0].card.instanceId))
    await act(() => captured!.toggleTarget(own.battleArea[0].card.instanceId))
    await act(() => captured!.confirmEffect())
    expect(commandCount).toBe(0)
    await act(() => captured!.toggleTarget(own.battleArea[1].card.instanceId))
    expect(captured!.effectSelectionError).toBe('必須從雙方各選 1 張餅乾。')
    await act(() => captured!.confirmEffect())
    expect(game).toBe(initial)
    await act(() => captured!.toggleTarget(own.battleArea[1].card.instanceId))
    await act(() => captured!.toggleTarget(opponent.card.instanceId))
    expect(captured!.effectSelectionError).toBeNull()
    await act(() => mode === 'pay' ? captured!.confirmEffect() : captured!.cancelAbilityCostDraft())
    expect(commandCount).toBe(Number(mode === 'pay'))
    expect(game.players['player-two'].battleArea[0].hpCards).toHaveLength(opponent.hpCards.length - Number(mode === 'pay'))
    expect(game.pendingAbilityEffect).toBeUndefined()
    await act(() => root.unmount())
  })
})
