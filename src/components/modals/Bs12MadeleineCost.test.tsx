/// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'
import { createBs12MadeleineDemoState } from '../../game/demo'
import { applyGameCommand } from '../../game/commands'
import candidateDocument from '../../../data/cards/official-festival-arena-bs12.en.json'
import { convertOfficialCardToGameCard } from '../../cards/official-card-adapter'
import type { OfficialCardRecord } from '../../cards/types'
import { getOptionalCostAttackPrompt } from './optionalCostAttackPrompt'
import { OptionalCostAttackModal } from './PendingDecisionModals'
;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

it('requires one combined cost, masks the paid Cookie from HP targets, and submits separate choices', async () => {
  const before = createBs12MadeleineDemoState()
  const ally = before.players['player-one'].battleArea.find(entry => entry.card.instanceId === 'bs12-034-ally')!
  const record = candidateDocument.cards.find(card => card.cardNumber === 'BS12-024')! as OfficialCardRecord
  const converted = convertOfficialCardToGameCard(record, ally.card.instanceId)
  expect(converted.status).toBe('converted')
  if (converted.status === 'converted') expect(ally.card).toEqual({ ...converted.gameCard, instanceId: ally.card.instanceId })
  let state = applyGameCommand(before, { kind: 'declare-attack', playerId: 'player-one', attackerInstanceId: 'bs12-034-source', targetInstanceId: 'bs12-034-opponent', supportPaymentIds: ['bs12-034-payment-0', 'bs12-034-payment-1'] })
  state = applyGameCommand(state, { kind: 'skip-trap', playerId: 'player-two' })
  while (state.pendingBattle?.stage === 'damage') state = applyGameCommand(state, { kind: 'resolve-next-damage', playerId: 'player-two' })
  state = applyGameCommand(state, { kind: 'resolve-attack-effect', playerId: 'player-one', targetIds: [] })
  const prompt = getOptionalCostAttackPrompt(state, 'player-one')!
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  const onPay = vi.fn()
  const button = (label: string) => [...container.querySelectorAll<HTMLButtonElement>('button')].find(entry => entry.textContent?.trim() === label)!
  await act(() => root.render(<OptionalCostAttackModal {...prompt} onSkip={() => undefined} onPay={onPay} />))
  await act(() => button('支付').click())
  expect(button('下一步').disabled).toBe(true)
  const costs = container.querySelectorAll<HTMLButtonElement>('.optional-cookie-break-cost .modal-card-options > button')
  expect(costs).toHaveLength(3)
  await act(() => costs[1].click())
  await act(() => costs[0].click())
  expect(costs[1].getAttribute('aria-pressed')).toBe('true')
  expect(costs[0].getAttribute('aria-pressed')).toBe('false')
  expect(onPay).not.toHaveBeenCalled()
  await act(() => button('下一步').click())
  expect(container.textContent).not.toContain('戰鬥區・Madeleine Cookie')
  const targets = container.querySelectorAll<HTMLButtonElement>('.optional-cost-col .modal-card-options > button')
  expect(targets).toHaveLength(1)
  expect(targets[0].textContent).toContain('GingerBrave')
  await act(() => targets[0].click())
  await act(() => button('確認').click())
  expect(onPay).toHaveBeenCalledWith([], ['bs12-034-ally'], [], [], [], [], [], [], [], ['bs12-034-source'])
  await act(() => root.unmount())
  container.remove()
})
