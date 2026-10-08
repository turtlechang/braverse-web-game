/// @vitest-environment jsdom
import { act, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it } from 'vitest'
import { createBs12BaguetteDemoState } from '../game/demo'
import { applyGameCommand } from '../game'
import { usePendingEffect } from './usePendingEffect'

it.each(['returned-arena', 'positive', 'non-arena-cost'] as const)('040 previews only legal post-cost hand cards without paying early: %s', async scenario => {
  const initial = createBs12BaguetteDemoState(scenario)
  let current = initial
  let captured: ReturnType<typeof usePendingEffect> | null = null
  function Harness() {
    const [game, setGame] = useState(initial)
    current = game
    captured = usePendingEffect({
      game, setGame, dispatch: (command, _message, onSuccess) => {
        const commands = Array.isArray(command) ? command : [command]
        const next = commands.reduce((state, cmd) => applyGameCommand(state, cmd), game)
        setGame(next)
        onSuccess?.(next)
      }, viewerPlayerId: 'player-one', setMessage: () => {},
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
    await act(() => captured!.beginCookieSkill(initial, initial.players['player-one'].battleArea[0].card, 'player-one', 'activate', 'Activate'))
    await act(() => captured!.toggleSkillCostSupport('bs12-040-payment-0'))
    const expected = scenario === 'returned-arena' ? ['bs12-040-payment-0'] : scenario === 'non-arena-cost' ? ['bs12-040-hand'] : ['bs12-040-hand', 'bs12-040-payment-0']
    expect(captured!.genericEffectCandidateCards.map(c => c.instanceId)).toEqual(expected)
    expect(current).toBe(initial)
    await act(() => captured!.toggleEffectTarget('bs12-040-payment-3'))
    expect(captured!.pendingEffect?.selectedTargetIds).toEqual([])
    await act(() => captured!.toggleEffectTarget(expected[0]))
    if (scenario === 'positive') {
      await act(() => captured!.toggleSkillCostSupport('bs12-040-payment-0'))
      await act(() => captured!.toggleSkillCostSupport('bs12-040-payment-2'))
      expect(captured!.pendingEffect?.selectedTargetIds).toEqual([])
      expect(captured!.genericEffectCandidateCards.map(c => c.instanceId)).toEqual(['bs12-040-hand'])
      expect(current).toBe(initial)
      await act(() => captured!.toggleSkillCostSupport('bs12-040-payment-2'))
      await act(() => captured!.toggleSkillCostSupport('bs12-040-payment-0'))
      await act(() => captured!.toggleEffectTarget(expected[0]))
    }
    await act(() => captured!.confirmEffect())
    expect(current.players['player-one'].supportArea).toHaveLength(4)
    expect(current.players['player-one'].supportArea.at(-1)).toMatchObject({ card: { instanceId: expected[0] }, rested: true })
    expect(current.players['player-one'].battleArea).toEqual(initial.players['player-one'].battleArea)
  } finally { await act(() => root.unmount()) }
})
