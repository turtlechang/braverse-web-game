/// @vitest-environment jsdom
import { act, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it } from 'vitest'
import { applyGameCommand, maskGameStateForViewer, type GameCommand } from '../game'
import { createBs12GuitarStringDemoState } from '../game/demo'
import { usePendingEffect } from './usePendingEffect'
import { useOnlinePendingEffect } from './useOnlinePendingEffect'

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

it.each(['pay', 'cancel'] as const)('local 083 selects newly discarded Blocker after DJ payment: %s', async action => {
  const initial = createBs12GuitarStringDemoState('dj-new-target')
  let current = initial
  let captured: ReturnType<typeof usePendingEffect> | null = null
  let send: (command: GameCommand) => void = () => {}
  function Harness() {
    const [game, setGame] = useState(initial)
    current = game
    send = command => setGame(applyGameCommand(game, command))
    captured = usePendingEffect({ game, setGame, dispatch: command => setGame((Array.isArray(command) ? command : [command]).reduce((state, cmd) => applyGameCommand(state, cmd), game)),
      viewerPlayerId: 'player-one', setMessage: () => {}, clearAttacker: () => {}, setInspectedHpPile: () => {},
      hasFaint: false, faintTargetIds: new Set(), selectedFaintTargetIds: [], faintMinMax: { min: 0, max: 0 }, setSelectedFaintTargetIds: () => {},
      hasAfterDamage: false, afterDamageTargetIds: new Set(), selectedAfterDamageTargetIds: [], afterDamageMinMax: { min: 0, max: 0 }, setSelectedAfterDamageTargetIds: () => {},
    })
    return null
  }
  const root = createRoot(document.createElement('div'))
  try {
    await act(() => root.render(<Harness />))
    const item = initial.players['player-one'].hand[0]
    await act(() => captured!.beginCardAbility(item, item.item!, 'item', '使用道具'))
    expect(captured!.breakAreaCostSelectionPending).toBe(true)
    await act(() => captured!.toggleSkillPayment('bs12-083-payment'))
    await act(() => captured!.confirmEffect())
    expect(current.players).toEqual(initial.players)
    expect(current.pendingOpponentHandDiscard?.itemActivation?.targetIds).toBeUndefined()
    expect(captured!.pendingEffect).toBeNull()
    if (action === 'cancel') {
      await act(() => send({ kind: 'cancel-item-activation', playerId: 'player-one' }))
      expect(current.players).toEqual(initial.players)
      expect(captured!.pendingEffect).toBeNull()
      return
    }
    await act(() => send({ kind: 'resolve-opponent-hand-discard', playerId: 'player-one', cardIds: ['bs12-083-hand-blocker'] }))
    // The local view reconstructs an authoritative continuation on its zero-delay UI timer.
    await act(() => new Promise<void>(resolve => window.setTimeout(resolve, 0)))
    expect(current.pendingAbilityEffect?.effects[0].kind).toBe('trash-to-battle')
    expect(captured!.pendingEffect?.skillActivated).toBe(true)
    expect(captured!.trashCookieCandidates.map(card => card.instanceId)).toEqual(['bs12-083-hand-blocker'])
    await act(() => captured!.toggleEffectTarget('bs12-083-hand-blocker'))
    await act(() => captured!.confirmEffect())
    expect(current.players['player-one'].battleArea[1].card.instanceId).toBe('bs12-083-hand-blocker')
    expect(current.players['player-one'].battleArea[1].hpCards).toHaveLength(2)
    expect(current.players['player-one'].deck).toHaveLength(10)
    expect(current.players['player-one'].discardPile.map(card => card.instanceId)).toEqual(['bs12-083-non-blocker', 'bs12-083-non-cookie', 'bs12-083-item'])
    expect(current.pendingAbilityEffect).toBeFalsy()
  } finally { await act(() => root.unmount()) }
})

it.each(['pay', 'cancel'] as const)('online 083 defers trash target until authoritative DJ cost: %s', async action => {
  const initial = createBs12GuitarStringDemoState('dj-new-target')
  let current = initial
  let captured: ReturnType<typeof useOnlinePendingEffect> | null = null
  let send: (command: GameCommand) => void = () => {}
  function Harness() {
    const [game, setGame] = useState(initial)
    current = game
    send = command => setGame(applyGameCommand(game, command))
    captured = useOnlinePendingEffect({ game: maskGameStateForViewer(game, 'player-one'), viewerPlayerId: 'player-one', hasFaint: false, hasAfterDamage: false,
      dispatch: command => setGame((Array.isArray(command) ? command : [command]).reduce((state, cmd) => applyGameCommand(state, cmd), game)),
    })
    return null
  }
  const root = createRoot(document.createElement('div'))
  try {
    await act(() => root.render(<Harness />))
    await act(() => captured!.beginPlayItem(initial.players['player-one'].hand[0]))
    expect(captured!.draftRequiresPaymentBeforeTargets).toBe(true)
    await act(() => captured!.toggleDraftPayment('bs12-083-payment'))
    await act(() => captured!.confirmEffect())
    expect(current.players).toEqual(initial.players)
    expect(current.pendingOpponentHandDiscard?.itemActivation?.targetIds).toBeUndefined()
    if (action === 'cancel') {
      await act(() => send({ kind: 'cancel-item-activation', playerId: 'player-one' }))
      expect(current.players).toEqual(initial.players)
      expect(captured!.pendingEffect).toBeNull()
      return
    }
    await act(() => send({ kind: 'resolve-opponent-hand-discard', playerId: 'player-one', cardIds: ['bs12-083-hand-blocker'] }))
    expect(current.pendingAbilityEffect?.effects[0].kind).toBe('trash-to-battle')
    await act(() => captured!.toggleTarget('bs12-083-hand-blocker'))
    await act(() => captured!.confirmEffect())
    expect(current.players['player-one'].battleArea[1].card.instanceId).toBe('bs12-083-hand-blocker')
    expect(current.players['player-one'].battleArea[1].hpCards).toHaveLength(2)
    expect(current.pendingAbilityEffect).toBeFalsy()
  } finally { await act(() => root.unmount()) }
})
