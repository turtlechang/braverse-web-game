/// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'
import { createBs12GlitterDemoState } from '../../game/demo'
import { applyGameCommand } from '../../game'
import { getOptionalCostAttackPrompt } from './optionalCostAttackPrompt'
import { EffectPanel } from '../effects/EffectPanel'
;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

it.each(['BS12-018', 'BS12-018@1'] as const)('%s presents a mandatory EXTRA entry cost and preserves draft on return', async number => {
  const before = createBs12GlitterDemoState('item-hand', number)
  const begun = applyGameCommand(before, { kind: 'play-extra-deck-cookie', playerId: 'player-one', instanceId: 'bs12-018-source' })
  const prompt = getOptionalCostAttackPrompt(begun, 'player-one')!
  expect(prompt).toMatchObject({ mandatory: true, extraDeckEntry: true, costText: '棄置 1 張【Arena】手牌' })
  expect(prompt.discardHandCandidates.map(c => c.instanceId)).toEqual(['bs12-018-hand'])
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  const onPay = vi.fn()
  const onSkip = vi.fn()
  const button = (text: string) => [...host.querySelectorAll<HTMLButtonElement>('button')].find(b => b.textContent?.trim() === text)!
  try {
    await act(() => root.render(<EffectPanel pendingEffect={null} currentEffect={null} effectHistory={[]} onConfirm={vi.fn()} onSkip={vi.fn()}
      optionalCostAttack={{ ...prompt, onPay, onSkip }} />))
    expect(host.textContent).toContain('EXTRA 登場代價（必須支付）')
    expect(host.textContent).not.toContain('Then 可選效果')
    expect(button('略過')).toBeUndefined()
    await act(() => button('支付代價').click())
    expect(button('確認').disabled).toBe(true)
    await act(() => host.querySelector<HTMLButtonElement>('.modal-card-options > button')!.click())
    expect(button('確認').disabled).toBe(false)
    await act(() => button('返回').click())
    expect(onPay).not.toHaveBeenCalled()
    expect(onSkip).not.toHaveBeenCalled()
    expect(begun.players).toEqual(before.players)
    await act(() => button('支付代價').click())
    expect(button('確認').disabled).toBe(true)
    await act(() => host.querySelector<HTMLButtonElement>('.modal-card-options > button')!.click())
    await act(() => button('確認').click())
    expect(onPay).toHaveBeenCalledTimes(1)
    expect(onPay.mock.calls[0][0]).toEqual(['bs12-018-hand'])
  } finally {
    await act(() => root.unmount())
    host.remove()
  }
})
