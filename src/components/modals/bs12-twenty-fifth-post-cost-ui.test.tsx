// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'
import { createBs12FinalPhysicalDemoState } from '../../game/demo'
import { applyGameCommand, getEffectSelectionCandidates } from '../../game'
import { getOptionalCostAttackPrompt } from './optionalCostAttackPrompt'
import { OptionalCostAttackModal } from './PendingDecisionModals'
import { EffectPanel } from '../effects/EffectPanel'
import type { PendingEffect } from '../effects/effectUiTypes'
;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true
Element.prototype.scrollIntoView = vi.fn()

for (const number of ['BS12-112', 'BS12-112@1'] as const) for (const choice of ['zero', 'one', 'two', 'cancel', 'toggle', 'limit']) it(number + ' pays before revealing newly trashed HP: ' + choice, async () => {
  let state = createBs12FinalPhysicalDemoState(number, 'new-hp-target')
  state = applyGameCommand(state, { kind: 'declare-attack', playerId: 'player-one', attackerInstanceId: 'final-source', targetInstanceId: 'final-enemy', supportPaymentIds: ['final-payment-0', 'final-payment-1', 'final-payment-2'] })
  state = applyGameCommand(state, { kind: 'skip-trap', playerId: 'player-two' })
  while (state.pendingBattle?.stage === 'damage') state = applyGameCommand(state, { kind: 'resolve-next-damage', playerId: 'player-two' })
  state = applyGameCommand(state, { kind: 'resolve-attack-effect', playerId: 'player-one', targetIds: [] })
  const before = structuredClone(state), prompt = getOptionalCostAttackPrompt(state, 'player-one')!
  expect(prompt.targetCandidates).toEqual([]); expect(prompt.needsTarget).toBe(false)
  const host = document.createElement('div'); document.body.append(host); const root = createRoot(host), onPay = vi.fn(), onSkip = vi.fn()
  const button = (label: string) => { const b = [...host.querySelectorAll<HTMLButtonElement>('button')].find(b => b.textContent?.trim() === label); expect(b, label).toBeDefined(); return b! }
  try {
    await act(() => root.render(createElement(OptionalCostAttackModal, { ...prompt, onPay, onSkip })))
    await act(() => button('支付').click())
    expect(host.querySelectorAll('.modal-card-options > button')).toHaveLength(0)
    expect(host.textContent).not.toContain('Peach Cookie'); expect(host.textContent).not.toContain('Schwarzwalder')
    if (choice === 'cancel') {
      await act(() => button('返回').click()); expect(onPay).not.toHaveBeenCalled(); expect(state).toEqual(before); return
    }
    await act(() => button('確認').click()); expect(onPay).toHaveBeenCalledOnce()
    const [discardCardIds, targetIds, paymentIds] = onPay.mock.calls[0]
    expect(targetIds).toEqual([])
    const paid = applyGameCommand(state, { kind: 'resolve-optional-cost-attack', playerId: 'player-one', action: 'pay', discardCardIds, targetIds, paymentIds })
    const pending = paid.pendingAbilityEffect!, sourceCard = paid.players['player-one'].discardPile.find(c => c.instanceId === pending.sourceInstanceId)!
    expect(paid.players['player-one'].battleArea.map(c => c.card.instanceId)).toEqual(['final-companion'])
    const candidates = getEffectSelectionCandidates(paid, { sourcePlayerId: 'player-one', sourceInstanceId: pending.sourceInstanceId }, pending.effects[0])
    expect(candidates.map(c => c.instanceId)).toEqual(['final-special-cost', 'final-own-deck-0', 'final-own-deck-1', 'final-own-deck-2'])
    const view: PendingEffect = { sourceCard, context: { sourcePlayerId: 'player-one', sourceInstanceId: pending.sourceInstanceId }, skill: { trigger: 'activate', oncePerTurn: false, yourTurn: false, restSource: false, cost: {}, text: '', effects: pending.effects }, trigger: 'activate', effects: pending.effects, effectIndex: 0, selectedTargetIds: [], selectedPaymentIds: [], selectedCostSupportToTrashIds: [], selectedDiscardHandIds: [], selectedHpToTrashTargetIds: [], selectedTrashBattleCookieIds: [], skillActivated: true, optional: false, triggerLabel: '攻擊後續效果', sourceKind: 'cookie' }
    const onConfirm = vi.fn(), render = () => root.render(createElement(EffectPanel, { pendingEffect: { ...view }, currentEffect: pending.effects[0], effectHistory: [], candidateCards: candidates, showTargetSelection: true, onConfirm, onSkip, onToggleCandidate: id => { view.selectedTargetIds = view.selectedTargetIds.includes(id) ? view.selectedTargetIds.filter(x => x !== id) : view.selectedTargetIds.length < 2 ? [...view.selectedTargetIds, id] : view.selectedTargetIds; render() } }))
    await act(render)
    expect([...host.querySelectorAll('button')].some(b => ['返回', '取消技能'].includes(b.textContent?.trim() ?? ''))).toBe(false)
    const target = (id: string) => host.querySelectorAll<HTMLButtonElement>('.effect-candidates-target button')[candidates.findIndex(c => c.instanceId === id)]
    const ids = ['final-own-deck-0', 'final-own-deck-1', 'final-own-deck-2']
    if (choice !== 'zero') await act(() => target(ids[0]).click())
    if (['two', 'limit'].includes(choice)) await act(() => target(ids[1]).click())
    if (choice === 'toggle') await act(() => target(ids[0]).click())
    if (choice === 'limit') { await act(() => target(ids[2]).click()); expect(host.querySelectorAll('.effect-candidates-target button.is-selected')).toHaveLength(2) }
    await act(() => button('確認發動').click()); expect(onConfirm).toHaveBeenCalledOnce()
    const expected = ['two', 'limit'].includes(choice) ? ids.slice(0, 2) : choice === 'one' ? [ids[0]] : []
    expect(view.selectedTargetIds).toEqual(expected)
    const done = applyGameCommand(paid, { kind: 'resolve-ability-effect', playerId: 'player-one', targetIds: view.selectedTargetIds })
    expect(done.players['player-one'].hand.map(c => c.instanceId)).toEqual(expected)
    expect(done.players['player-one'].breakArea).toEqual(before.players['player-one'].breakArea); expect(state).toEqual(before)
  } finally { await act(() => root.unmount()); host.remove() }
})
