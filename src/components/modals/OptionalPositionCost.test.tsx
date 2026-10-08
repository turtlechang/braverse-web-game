/// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'
import { OptionalCostAttackModal } from './PendingDecisionModals'
import { createBs12OptionalTrapDemoState } from '../../game/demo'
;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

it('selects exactly two Cookie costs, deselects, returns without paying, and confirms concrete ids', async () => {
  const onPay = vi.fn()
  const onSkip = vi.fn()
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  const candidates = createBs12OptionalTrapDemoState().players['player-one'].battleArea.map(c => ({ card: c.card, instanceId: c.card.instanceId }))
  await act(() => root.render(<OptionalCostAttackModal sourceCardName="A Moment of Misunderstanding" effectText="Draw up to 1 card" resolution="ability"
    discardHandCost={0} energyCostTotal={0} playerHand={[]} supportCandidates={[]} targetCandidates={[]} needsTarget={false} targetMin={0} targetMax={0} targetLabel="對手餅乾"
    positionCost={{ count: 2, position: 'rested', keyword: 'arena' }} positionCostCandidates={candidates} onPay={onPay} onSkip={onSkip} />))
  const button = (text: string) => [...host.querySelectorAll<HTMLButtonElement>('button')].find(b => b.textContent?.trim() === text)!
  await act(() => button('支付').click())
  const costs = () => host.querySelectorAll<HTMLButtonElement>('.optional-position-cost .modal-card-options > button')
  const confirm = () => button('確認')
  expect(confirm().disabled).toBe(true)
  await act(() => costs()[0].click())
  expect(confirm().disabled).toBe(true)
  await act(() => costs()[1].click())
  expect(confirm().disabled).toBe(false)
  await act(() => costs()[0].click())
  expect(confirm().disabled).toBe(true)
  await act(() => button('返回').click())
  expect(onPay).not.toHaveBeenCalled()
  await act(() => button('支付').click())
  expect(costs()[1].getAttribute('aria-pressed')).toBe('false')
  await act(() => { costs()[0].click(); costs()[1].click() })
  await act(() => confirm().click())
  expect(onPay).toHaveBeenCalledWith([], [], [], [], [], [], [], [], candidates.map(c => c.instanceId))
  expect(onSkip).not.toHaveBeenCalled()
  await act(() => root.unmount())
  host.remove()
})

it('offers skip and disables optional payment with insufficient Cookie candidates', async () => {
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  const onSkip = vi.fn()
  await act(() => root.render(<OptionalCostAttackModal sourceCardName="A Moment of Misunderstanding" effectText="Draw up to 1 card" resolution="ability"
    discardHandCost={0} energyCostTotal={0} playerHand={[]} supportCandidates={[]} targetCandidates={[]} needsTarget={false} targetMin={0} targetMax={0} targetLabel="對手餅乾"
    positionCost={{ count: 2, position: 'rested', keyword: 'arena' }} positionCostCandidates={[]} onPay={vi.fn()} onSkip={onSkip} />))
  const buttons = [...host.querySelectorAll<HTMLButtonElement>('button')]
  expect(buttons.find(b => b.textContent?.trim() === '支付')?.disabled).toBe(true)
  await act(() => buttons.find(b => b.textContent?.trim() === '略過')!.click())
  expect(onSkip).toHaveBeenCalledOnce()
  await act(() => root.unmount())
  host.remove()
})
