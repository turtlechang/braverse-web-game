/// @vitest-environment jsdom
import { act, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'
import { createBs12StardustDemoState } from '../game/demo'
import { applyGameCommand } from '../game'
import { usePendingEffect } from './usePendingEffect'
import { useOnlinePendingEffect } from './useOnlinePendingEffect'
import { getOptionalCostAttackPrompt } from '../components/modals/optionalCostAttackPrompt'
;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true
const playerId = 'player-one' as const
const offered = () => {
  let state = applyGameCommand(createBs12StardustDemoState('short-deck'), { kind: 'declare-attack', playerId, attackerInstanceId: 'bs12-070-source', targetInstanceId: 'bs12-064-opponent', supportPaymentIds: ['bs12-069-payment-0', 'bs12-069-payment-1'] })
  state = applyGameCommand(state, { kind: 'skip-trap', playerId: 'player-two' })
  for (let i = 0; state.pendingBattle?.stage === 'damage' && i < 12; i++) state = applyGameCommand(state, { kind: 'resolve-next-damage', playerId: 'player-two' })
  return applyGameCommand(state, { kind: 'resolve-attack-effect', playerId, targetIds: [] })
}
const returned = () => {
  let state = applyGameCommand(offered(), { kind: 'resolve-optional-cost-attack', playerId, action: 'pay', paymentIds: [], targetIds: [] })
  state = applyGameCommand(state, { kind: 'resolve-reveal-top-deck', playerId })
  return applyGameCommand(state, { kind: 'refresh-deck', playerId, cookieInstanceId: 'bs12-069-refresh-cookie', shuffleSeed: 1 })
}
it('BS12-070 optional Then names the mandatory public bottom reveal as its cost', () => {
  const prompt = getOptionalCostAttackPrompt(offered(), playerId)
  expect(prompt?.costText).toContain('展示 1 張牌庫底卡')
})
it('BS12-070 local nested damage retains attack text and label after Refresh', async () => {
  vi.useFakeTimers()
  const initial = returned()
  let captured: ReturnType<typeof usePendingEffect> | null = null
  const root = createRoot(document.createElement('div'))
  function Harness() {
    const [game, setGame] = useState(initial)
    captured = usePendingEffect({ game, setGame, dispatch: vi.fn(), viewerPlayerId: playerId, setMessage: vi.fn(), clearAttacker: vi.fn(), setInspectedHpPile: vi.fn(), hasFaint: false, faintTargetIds: new Set(), selectedFaintTargetIds: [], faintMinMax: { min: 0, max: 0 }, setSelectedFaintTargetIds: vi.fn(), hasAfterDamage: false, afterDamageTargetIds: new Set(), selectedAfterDamageTargetIds: [], afterDamageMinMax: { min: 0, max: 0 }, setSelectedAfterDamageTargetIds: vi.fn() })
    return null
  }
  try {
    await act(() => root.render(<Harness />))
    await act(() => vi.runAllTimers())
    expect(captured!.currentEffect?.kind).toBe('damage-all')
    expect(captured!.pendingEffect?.triggerLabel).toBe('攻擊後續效果')
    expect(captured!.pendingEffect?.skill.text).toContain('all of your opponent')
    expect(captured!.pendingEffect?.sourceCard.id).toBe('BS12-070')
  } finally { await act(() => root.unmount()); vi.useRealTimers() }
})
it('BS12-070 online nested damage takes priority over the suspended optional attack wrapper', async () => {
  const initial = returned()
  const dispatch = vi.fn()
  let captured: ReturnType<typeof useOnlinePendingEffect> | null = null
  const root = createRoot(document.createElement('div'))
  function Harness() {
    captured = useOnlinePendingEffect({ game: initial, viewerPlayerId: playerId, hasFaint: false, hasAfterDamage: false, dispatch })
    return null
  }
  try {
    await act(() => root.render(<Harness />))
    expect(captured!.currentEffect?.kind).toBe('damage-all')
    expect(captured!.pendingEffect?.triggerLabel).toBe('攻擊後續效果')
    expect(captured!.pendingEffect?.skill.text).toContain('all of your opponent')
    expect(captured!.pendingEffect?.sourceCard.id).toBe('BS12-070')
    expect(dispatch).not.toHaveBeenCalled()
    await act(() => captured!.toggleTarget('bs12-064-opponent-other'))
    await act(() => captured!.toggleTarget('bs12-064-opponent'))
    await act(() => captured!.confirmEffect())
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ kind: 'resolve-ability-effect', targetIds: ['bs12-064-opponent-other', 'bs12-064-opponent'] }), expect.any(String))
  } finally { await act(() => root.unmount()) }
})
