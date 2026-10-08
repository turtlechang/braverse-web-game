/// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'
import { createBs12CoffeeCandyDemoState } from '../../game/demo'
import { FlipResponseModal } from './GameModals'

it.each([true, false])('043 labels opponent support cards and submits the selected card separately: %s', async select => {
  const game = createBs12CoffeeCandyDemoState()
  const card = game.pendingBattle!.revealedHpCard!
  const onActivate = vi.fn()
  const container = document.createElement('div')
  const root = createRoot(container)
  try {
    await act(() => root.render(<FlipResponseModal card={card} hand={[]} discardCount={0} selectedDiscardIds={[]}
      cardSelectionCandidates={game.players['player-two'].supportArea.map(s => s.card)}
      cardSelectionKind="rest-support" cardSelectionMin={0} cardSelectionMax={1}
      onToggleDiscard={() => {}} onSkip={() => {}} onActivate={onActivate} />))
    expect(container.textContent).toContain('選擇對手的支援卡設為疲勞')
    const choices = () => [...container.querySelectorAll<HTMLButtonElement>('[aria-label="FLIP 效果卡片選擇"] > button')]
    expect(choices()).toHaveLength(4)
    if (select) {
      await act(() => choices()[1].click())
      await act(() => choices()[2].click())
      expect(choices().map(b => b.getAttribute('aria-pressed'))).toEqual(['false', 'true', 'false', 'false'])
    }
    const activate = [...container.querySelectorAll<HTMLButtonElement>('button')].find(b => b.textContent === '發動 FLIP')!
    expect(activate.disabled).toBe(false)
    await act(() => activate.click())
    expect(onActivate).toHaveBeenLastCalledWith(undefined, [], select ? ['bs12-043-opponent-support-1'] : [], undefined)
  } finally { await act(() => root.unmount()) }
})

it('keeps a mandatory support-rest selection unavailable until its printed minimum is selected', async () => {
  const game = createBs12CoffeeCandyDemoState()
  const container = document.createElement('div')
  const root = createRoot(container)
  try {
    await act(() => root.render(<FlipResponseModal card={game.pendingBattle!.revealedHpCard!} hand={[]} discardCount={0} selectedDiscardIds={[]}
      cardSelectionCandidates={game.players['player-two'].supportArea.map(s => s.card)}
      cardSelectionKind="rest-support" cardSelectionMin={1} cardSelectionMax={1}
      onToggleDiscard={() => {}} onSkip={() => {}} onActivate={() => {}} />))
    const activate = [...container.querySelectorAll<HTMLButtonElement>('button')].find(b => b.textContent === '發動 FLIP')!
    expect(container.textContent).toContain('至少 1 張')
    expect(activate.disabled).toBe(true)
    await act(() => container.querySelector<HTMLButtonElement>('[aria-label="FLIP 效果卡片選擇"] > button')!.click())
    expect(activate.disabled).toBe(false)
  } finally { await act(() => root.unmount()) }
})
