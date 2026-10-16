/// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it, vi } from 'vitest'
import { applyGameCommand, type GameState } from '../../game'
import { createSt8010PreviewState } from '../../game/st8-010-demo'
import type { BattleUiMatchLike, BattleUiPendingEffectLike } from '../../hooks/battleUiContracts'
import { DamageEffectModals } from './DamageEffectModals'

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true
const owner = 'player-one' as const
const need = <T,>(value: T | undefined | null, label: string): T => {
  if (value === undefined || value === null) throw new Error(`Missing ${label}`)
  return value
}
const setup = (game: GameState, selected: string[] = []) => {
  const faint = need(game.pendingFaintEffects?.[0], 'real faint trigger')
  const source = need(game.players[owner].breakArea.find(card => card.instanceId === faint.sourceInstanceId), 'actual fainted Cookiemals')
  const dispatch = vi.fn(), clear = vi.fn(), toggle = vi.fn()
  // Only the Faint branch is mounted; every field it reads is explicitly typed.
  const fields = {
    game, viewerPlayerId: owner, faintSourceCard: source, faintMin: 0, faintMax: 0,
    selectedFaintTargetIds: [], selectedFaintPaymentIds: [], selectedFaintCostHandIds: [], selectedFaintCostSupportIds: [], selectedFaintCostSupportToHandIds: selected,
    faintCandidates: [], faintCardCandidates: [], faintEnergyCost: {}, faintEnergyCostTotal: 0, faintPaymentCandidates: [], faintPaymentValid: true,
    faintOptional: false, faintCostHandAmount: 0, faintCostDeckToTrashAmount: 0, faintCostSupportAmount: 0,
    faintCostSupportToHandAmount: faint.cost?.supportToHand ?? 0,
    faintCostHandCandidates: [], faintCostSupportCandidates: [],
    faintCostSupportToHandCandidates: faint.cost?.supportToHand ? game.players[owner].supportArea.filter(support => support.card.type === 'item').map(support => support.card) : [],
    setSelectedFaintTargetIds: clear, setSelectedFaintPaymentIds: clear, setSelectedFaintCostHandIds: clear,
    setSelectedFaintCostSupportIds: clear, setSelectedFaintCostSupportToHandIds: clear,
    toggleFaintPayment: toggle, toggleFaintCostHand: toggle, toggleFaintCostSupport: toggle, toggleFaintCostSupportToHand: toggle, dispatch,
  } satisfies Partial<BattleUiMatchLike>
  // Component-unit mock boundary: only faintActive=true/afterDamageActive=false is rendered.
  // Partial satisfies checks every supplied field; this is not a complete match-controller instance.
  const match = fields as unknown as BattleUiMatchLike
  const pending = { faintActive: true, afterDamageActive: false } as BattleUiPendingEffectLike
  return { game, match, pending, dispatch, clear, toggle }
}
const mount = async (state: ReturnType<typeof setup>) => {
  const container = document.createElement('div'), root = createRoot(container)
  document.body.append(container)
  await act(() => root.render(<DamageEffectModals match={state.match} pending={state.pending} />))
  return { container, close: async () => { await act(() => root.unmount()); container.remove() } }
}
const button = (container: HTMLElement, text: string) => need([...container.querySelectorAll<HTMLButtonElement>('button')].find(b => b.textContent?.includes(text)), text)
const paid = () => {
  const start = createSt8010PreviewState('positive')
  const item = need(start.players[owner].supportArea.find(s => s.card.type === 'item'), 'real Item')
  return applyGameCommand(start, { kind: 'resolve-faint-effect', playerId: owner, targetIds: [], supportToHandIds: [item.card.instanceId] })
}

describe('ST8-010 faint cost component unit using real parent states (not Browser)', () => {
  it('before payment shows only actual Item costs, no modes, disabled confirmation and whole-trigger decline', async () => {
    const start = createSt8010PreviewState('positive'), state = setup(start), ui = await mount(state)
    try {
      const faint = need(start.pendingFaintEffects?.[0], 'faint')
      if (faint.effect.kind !== 'choose-one') throw new Error('Expected original choose-one')
      expect(ui.container.querySelector('[aria-label="選擇一項昏厥效果"]')).toBeNull()
      for (const mode of faint.effect.modes) expect([...ui.container.querySelectorAll('button')].some(b => b.textContent === mode.label)).toBe(false)
      expect(button(ui.container, '支付代價').disabled).toBe(true)
      const costs = ui.container.querySelectorAll('.faint-cost-support-candidates button')
      expect(costs.length).toBe(state.match.faintCostSupportToHandCandidates.length)
      expect(state.match.faintCostSupportToHandCandidates.every(c => c.type === 'item')).toBe(true)
      await act(() => button(ui.container, '不發動').click())
      expect(state.dispatch).toHaveBeenCalledWith({ kind: 'resolve-faint-effect', playerId: owner, targetIds: [] }, expect.any(String))
      expect(start.players[owner].supportArea).toHaveLength(2)
    } finally { await ui.close() }
  })
  it('selecting actual Item enables cost payment and dispatches its exact instance before mode', async () => {
    const game = createSt8010PreviewState('positive'), item = need(game.players[owner].supportArea.find(s => s.card.type === 'item'), 'Item')
    const state = setup(game, [item.card.instanceId]), ui = await mount(state)
    try {
      expect(button(ui.container, '支付代價').disabled).toBe(false)
      await act(() => button(ui.container, '支付代價').click())
      expect(state.dispatch.mock.calls[0]?.[0]).toEqual({ kind: 'resolve-faint-effect', playerId: owner, targetIds: [], paymentIds: [], discardHandIds: [], supportToTrashIds: [], supportToHandIds: [item.card.instanceId] })
    } finally { await ui.close() }
  })
  it.each([0, 1])('only after actual cost payment renders original runtime mode %s without a second cost', async modeIndex => {
    const game = paid(), faint = need(game.pendingFaintEffects?.[0], 'paid faint')
    if (faint.effect.kind !== 'choose-one') throw new Error('Expected pending choice after real cost')
    const state = setup(game), ui = await mount(state)
    try {
      expect(game.players[owner].hand.at(-1)?.type).toBe('item')
      expect(game.pendingFaintEffects?.[0].cost).toBeUndefined()
      expect(ui.container.querySelector('.faint-cost-support-candidates')).toBeNull()
      expect(ui.container.querySelector('.modal-actions button')).toBeNull()
      for (const mode of faint.effect.modes) expect(button(ui.container, mode.label).disabled).toBe(false)
      const mode = need(faint.effect.modes[modeIndex], 'printed mode')
      await act(() => button(ui.container, mode.label).click())
      expect(state.dispatch).toHaveBeenCalledWith({ kind: 'resolve-choose-one', playerId: owner, modeIndex }, expect.any(String))
    } finally { await ui.close() }
  })
  it.each([0, 1])('actual mode %s expansion exposes normal confirm and resolves the real effect', async modeIndex => {
    const game = applyGameCommand(paid(), { kind: 'resolve-choose-one', playerId: owner, modeIndex })
    const state = setup(game), ui = await mount(state)
    try {
      expect(ui.container.querySelector('[aria-label="選擇一項昏厥效果"]')).toBeNull()
      expect(ui.container.querySelector('.faint-cost-support-candidates')).toBeNull()
      expect(button(ui.container, '確認結算').disabled).toBe(false)
      await act(() => button(ui.container, '確認結算').click())
      expect(state.dispatch.mock.calls[0]?.[0]).toMatchObject({ kind: 'resolve-faint-effect', playerId: owner, targetIds: [], supportToHandIds: [] })
      const final = applyGameCommand(game, { kind: 'resolve-faint-effect', playerId: owner, targetIds: [] })
      expect(final.players[owner].supportArea.length).toBe(modeIndex === 0 ? 2 : 1)
    } finally { await ui.close() }
  })
  it('no Item has no legal payment, disabled confirm and still permits decline', async () => {
    const game = createSt8010PreviewState('no-item'), state = setup(game), ui = await mount(state)
    try {
      expect(state.match.faintCostSupportToHandCandidates).toHaveLength(0)
      expect(button(ui.container, '支付代價').disabled).toBe(true)
      expect(ui.container.querySelector('[aria-label="選擇一項昏厥效果"]')).toBeNull()
      await act(() => button(ui.container, '不發動').click())
      expect(state.dispatch).toHaveBeenCalledWith({ kind: 'resolve-faint-effect', playerId: owner, targetIds: [] }, expect.any(String))
    } finally { await ui.close() }
  })
})
