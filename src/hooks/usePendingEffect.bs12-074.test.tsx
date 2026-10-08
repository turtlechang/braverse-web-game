/// @vitest-environment jsdom
import { act, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'
import { createBs12PoppingCandyDemoState } from '../game/demo'
import { applyGameCommand } from '../game'
import { usePendingEffect } from './usePendingEffect'

it.each(['original', 'other', 'last-hp', 'zero'] as const)('074 HP movement result uses the Cookie name and preserves the selected owner: %s', async choice => {
  vi.useFakeTimers()
  let initial = createBs12PoppingCandyDemoState(choice === 'last-hp' ? 'target-last-hp' : 'positive')
  initial = applyGameCommand(initial, { kind: 'declare-attack', playerId: 'player-one', attackerInstanceId: 'bs12-074-source', targetInstanceId: 'bs12-064-opponent', supportPaymentIds: ['bs12-074-payment-1', 'bs12-074-payment-2', 'bs12-074-payment-3'] })
  initial = applyGameCommand(initial, { kind: 'skip-trap', playerId: 'player-two' })
  for (let index = 0; initial.pendingBattle?.stage === 'damage' && index < 6; index++) initial = applyGameCommand(initial, { kind: 'resolve-next-damage', playerId: 'player-two' })
  initial = applyGameCommand(initial, { kind: 'resolve-attack-effect', playerId: 'player-one', targetIds: [] })
  initial = applyGameCommand(initial, { kind: 'resolve-optional-cost-attack', playerId: 'player-one', action: 'pay', paymentIds: [], targetIds: [] })
  initial = applyGameCommand(initial, { kind: 'resolve-reveal-top-deck', playerId: 'player-one' })
  let current = initial
  let captured: ReturnType<typeof usePendingEffect> | null = null
  const messages: string[] = []
  function Harness() {
    const [game, setGame] = useState(initial)
    current = game
    captured = usePendingEffect({ game, setGame, dispatch: (command, _message, onSuccess) => {
      const next = (Array.isArray(command) ? command : [command]).reduce((state, cmd) => applyGameCommand(state, cmd), game)
      setGame(next); onSuccess?.(next)
    }, viewerPlayerId: 'player-one', setMessage: message => { messages.push(message) }, clearAttacker: vi.fn(), setInspectedHpPile: vi.fn(),
    hasFaint: false, faintTargetIds: new Set(), selectedFaintTargetIds: [], faintMinMax: { min: 0, max: 0 }, setSelectedFaintTargetIds: vi.fn(),
    hasAfterDamage: false, afterDamageTargetIds: new Set(), selectedAfterDamageTargetIds: [], afterDamageMinMax: { min: 0, max: 0 }, setSelectedAfterDamageTargetIds: vi.fn() })
    return null
  }
  const root = createRoot(document.createElement('div'))
  try {
    await act(() => root.render(<Harness />)); await act(() => vi.runAllTimers())
    expect(captured!.currentEffect).toMatchObject({ kind: 'field-to-deck-bottom', hpOnly: true })
    if (choice !== 'zero') await act(() => captured!.toggleEffectTarget(choice === 'other' ? 'bs12-064-opponent-other' : 'bs12-064-opponent'))
    await act(() => captured!.confirmEffect())
    expect(messages.at(-1)).toBe(choice === 'zero' ? '未選擇餅乾，未移動 HP 卡。' : `${choice === 'other' ? 'Langue de Chat Cookie' : choice === 'last-hp' ? 'Muscle Cookie' : 'Sugar Swan Cookie'} 的最上方 1 張 HP 卡已放到持有者牌庫底。`)
    expect(current.players['player-two'].battleArea.map(cookie => cookie.hpCards.length)).toEqual(choice === 'zero' ? [3, 4] : choice === 'other' ? [3, 3] : choice === 'last-hp' ? [4] : [2, 4])
  } finally { await act(() => root.unmount()); vi.useRealTimers() }
})
