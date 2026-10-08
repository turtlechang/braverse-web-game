/// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
import { FlipResponseModal } from './GameModals'
import { createBs12StrategistDemoState } from '../../game/demo'
import { getTrashToHandCandidates } from '../../game/effects'

const fixture = () => {
  const state = createBs12StrategistDemoState('flip-two-targets'), card = state.pendingBattle!.revealedHpCard!
  const effect = card.flip!.effects[0]
  if (effect.kind !== 'trash-to-hand') throw new Error('Missing Strategist recovery')
  return { card, candidates: getTrashToHandCandidates(state, { sourcePlayerId: 'player-one', sourceInstanceId: card.instanceId }, effect) }
}
const click = async (button: HTMLButtonElement) => act(() => button.dispatchEvent(new MouseEvent('click', { bubbles: true })))

it('100 labels recovery as own trash selection instead of hand placement', () => {
  const { card, candidates } = fixture()
  const html = renderToStaticMarkup(<FlipResponseModal card={card} hand={[]} discardCount={0} selectedDiscardIds={[]}
    onToggleDiscard={() => undefined} onActivate={() => undefined} onSkip={() => undefined}
    cardSelectionCandidates={candidates} cardSelectionKind="trash-to-hand" cardSelectionMin={0} cardSelectionMax={1} />)
  expect(html).toContain('選擇從棄牌區返回手牌的卡牌')
})
it('100 selects at most one, permits deselection and forwards recovery through actual targetIds', async () => {
  const { card, candidates } = fixture(), onActivate = vi.fn(), container = document.createElement('div'), root = createRoot(container)
  await act(() => root.render(<FlipResponseModal card={card} hand={[]} discardCount={0} selectedDiscardIds={[]}
    onToggleDiscard={() => undefined} onActivate={onActivate} onSkip={() => undefined}
    cardSelectionCandidates={candidates} cardSelectionKind="trash-to-hand" cardSelectionMin={0} cardSelectionMax={1} />))
  const buttons = () => [...container.querySelectorAll<HTMLButtonElement>('[aria-label="FLIP 效果卡片選擇"] > button')]
  const confirm = () => [...container.querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent === '發動 FLIP')!
  await click(buttons()[1]); await click(buttons()[0])
  expect(buttons().map(button => button.getAttribute('aria-pressed'))).toEqual(['false', 'true'])
  await click(confirm())
  expect(onActivate).toHaveBeenLastCalledWith(undefined, [candidates[1].instanceId])
  await click(buttons()[1]); await click(confirm())
  expect(onActivate).toHaveBeenLastCalledWith(undefined, [])
  await act(() => root.unmount())
})
