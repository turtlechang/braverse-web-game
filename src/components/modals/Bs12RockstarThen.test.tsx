/// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'
import { createBs12RockstarDemoState } from '../../game/demo'
import { getOptionalCostAttackPrompt } from './optionalCostAttackPrompt'
import { OptionalCostAttackModal } from './PendingDecisionModals'
;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

it.each(['BS12-093', 'BS12-093@1'] as const)('%s shows bottom order, two-cost gate, return clearing and optional zero damage', async number => {
  const state = createBs12RockstarDemoState(number)
  const source = state.players['player-one'].battleArea[0].card
  const then = source.attackEffects![0]
  if (then.kind !== 'optional-cost-attack') throw new Error('Missing Rockstar Then')
  state.pendingOptionalCostAttack = { playerId: 'player-one', sourceInstanceId: source.instanceId, sourceCardName: source.name, ...then }
  const prompt = getOptionalCostAttackPrompt(state, 'player-one')!
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  const onPay = vi.fn(), onSkip = vi.fn()
  const button = (text: string) => [...host.querySelectorAll<HTMLButtonElement>('button')].find(b => b.textContent?.trim() === text)!
  const cardButton = (name: string) => [...host.querySelectorAll<HTMLButtonElement>('.modal-card-options > button')].find(b => b.textContent?.includes(name))!
  try {
    await act(() => root.render(<OptionalCostAttackModal {...prompt} onPay={onPay} onSkip={onSkip} />))
    expect(host.textContent).toContain('牌庫底')
    expect(host.textContent).not.toContain('洗回牌庫')
    await act(() => button('支付').click())
    expect(button('下一步').disabled).toBe(true)
    await act(() => cardButton('Peperoncino Cookie').click())
    expect(cardButton('Peperoncino Cookie').textContent).toContain('牌庫底順序 1')
    expect(button('下一步').disabled).toBe(true)
    await act(() => cardButton('Pudding Cookie').click())
    expect(cardButton('Pudding Cookie').textContent).toContain('牌庫底順序 2')
    expect(button('下一步').disabled).toBe(false)
    await act(() => button('返回').click())
    await act(() => button('支付').click())
    expect(button('下一步').disabled).toBe(true)
    await act(() => cardButton('Peperoncino Cookie').click())
    await act(() => cardButton('Pudding Cookie').click())
    await act(() => button('下一步').click())
    expect(button('確認').disabled).toBe(false)
    await act(() => button('確認').click())
    expect(onPay.mock.calls[0][1]).toEqual([])
    expect(onPay.mock.calls[0][5]).toEqual(['bs12-093-red-blocker', 'bs12-093-blocker'])
    expect(onSkip).not.toHaveBeenCalled()
  } finally { await act(() => root.unmount()); host.remove() }
})
