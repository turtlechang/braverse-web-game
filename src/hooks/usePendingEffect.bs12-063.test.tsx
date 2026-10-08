/// @vitest-environment jsdom
import { act, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'
import { createBs12CakePopsDemoState } from '../game/demo'
import { applyGameCommand } from '../game'
import { usePendingEffect } from './usePendingEffect'

it.each(['effect-positive', 'effect-no-host', 'effect-other-target', 'effect-zero'] as const)('reports actual damage after RR item payment: %s', async scenario => {
  const initial = createBs12CakePopsDemoState(scenario)
  let current = initial
  let captured: ReturnType<typeof usePendingEffect> | null = null
  const messages: string[] = []
  function Harness() {
    const [game, setGame] = useState(initial)
    current = game
    captured = usePendingEffect({
      game, setGame, dispatch: (command, _message, onSuccess) => {
        const next = (Array.isArray(command) ? command : [command]).reduce((state, cmd) => applyGameCommand(state, cmd), game)
        setGame(next)
        onSuccess?.(next)
      }, viewerPlayerId: 'player-one', setMessage: message => { messages.push(message) },
      clearAttacker: vi.fn(), setInspectedHpPile: vi.fn(),
      hasFaint: false, faintTargetIds: new Set(), selectedFaintTargetIds: [],
      faintMinMax: { min: 0, max: 0 }, setSelectedFaintTargetIds: vi.fn(),
      hasAfterDamage: false, afterDamageTargetIds: new Set(), selectedAfterDamageTargetIds: [],
      afterDamageMinMax: { min: 0, max: 0 }, setSelectedAfterDamageTargetIds: vi.fn(),
    })
    return null
  }
  const root = createRoot(document.createElement('div'))
  try {
    await act(() => root.render(<Harness />))
    const card = initial.players['player-one'].hand[0]
    if (card.type !== 'item' || !card.item) throw new Error('Missing real damage item')
    await act(() => captured!.beginCardAbility(card, card.item!, 'item', '使用物品'))
    await act(() => captured!.toggleSkillPayment('bs12-063-payment-0'))
    await act(() => captured!.toggleSkillPayment('bs12-063-payment-1'))
    if (scenario !== 'effect-zero') await act(() => captured!.toggleEffectTarget(scenario === 'effect-other-target' ? 'bs12-063-host' : 'bs12-063-source'))
    await act(() => captured!.confirmEffect())
    expect(messages.at(-1)).toBe(scenario === 'effect-zero' ? '未選擇傷害目標，效果未造成傷害。'
      : scenario === 'effect-other-target' ? 'Popping Candy Cookie 受到 2 傷害。'
      : `CAKE POPs 受到 ${scenario === 'effect-positive' ? 1 : 2} 傷害。`)
    expect(current.players['player-one'].discardPile.map(c => c.id)).toEqual(['BS11-012'])
    expect(current.players['player-two'].battleArea.map(c => c.hpCards.length)).toEqual(scenario === 'effect-zero' ? [2, 2]
      : scenario === 'effect-no-host' ? [] : scenario === 'effect-other-target' ? [2] : [1, 2])
  } finally { await act(() => root.unmount()) }
})
