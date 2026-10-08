/// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'
import { createBs12PeppermintDemoState } from '../../game/demo'
import { FlipResponseModal } from './GameModals'

it.each(['BS12-058', 'BS12-058@1'] as const)('%s filters the actual Arena cost and labels its public deck-bottom destination', async number => {
  const state = createBs12PeppermintDemoState('positive', number)
  const container = document.createElement('div')
  const root = createRoot(container)
  const toggle = vi.fn()
  const activate = vi.fn()
  const render = (selected: string[]) => act(() => root.render(<FlipResponseModal card={state.pendingBattle!.revealedHpCard!} hand={state.players['player-one'].hand} discardCount={1} selectedDiscardIds={selected} onToggleDiscard={toggle} onSkip={() => {}} onActivate={activate} />))
  try {
    await render([])
    expect(container.textContent).toContain('公開 1 張【Arena】手牌並放到自己的牌庫底')
    const choices = container.querySelectorAll<HTMLButtonElement>('.modal-card-options > button')
    expect(choices).toHaveLength(1)
    await act(() => choices[0].click())
    expect(toggle).toHaveBeenCalledWith('bs12-058-hand')
    const button = () => [...container.querySelectorAll<HTMLButtonElement>('button')].find(b => b.textContent === '發動 FLIP')!
    expect(button().disabled).toBe(true)
    await render(['bs12-058-invalid-hand'])
    expect(button().disabled).toBe(true)
    await render(['bs12-058-hand'])
    expect(button().disabled).toBe(false)
    await act(() => button().click())
    expect(activate).toHaveBeenCalledTimes(1)
  } finally { await act(() => root.unmount()) }
})

it('keeps decline available but blocks activation with no eligible Arena hand card', async () => {
  const state = createBs12PeppermintDemoState('non-arena-hand')
  const container = document.createElement('div')
  const root = createRoot(container)
  const skip = vi.fn()
  try {
    await act(() => root.render(<FlipResponseModal card={state.pendingBattle!.revealedHpCard!} hand={state.players['player-one'].hand} discardCount={1} selectedDiscardIds={[]} onToggleDiscard={() => {}} onSkip={skip} onActivate={() => {}} />))
    expect(container.textContent).toContain('符合代價的手牌不足，無法發動。')
    expect(container.querySelectorAll('.modal-card-options > button')).toHaveLength(0)
    const buttons = [...container.querySelectorAll<HTMLButtonElement>('button')]
    expect(buttons.find(b => b.textContent === '發動 FLIP')!.disabled).toBe(true)
    await act(() => buttons.find(b => b.textContent === '不發動')!.click())
    expect(skip).toHaveBeenCalledTimes(1)
  } finally { await act(() => root.unmount()) }
})
