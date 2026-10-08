/// @vitest-environment jsdom

import { act, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'
import { createBs12BlueberryDemoState } from '../../game/demo'
import { getTrashBattleCookieCostCandidates } from '../../game/skills'
import { SpecialPlayModal } from './GameModals'

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

it('095 Special Play shows its own printed cost rather than the independent FLIP, with reversible exact-one selection', async () => {
  const state = createBs12BlueberryDemoState('special-two-candidates')
  const card = state.players['player-one'].hand[0]
  const onCancel = vi.fn(), onConfirm = vi.fn()
  const candidates = getTrashBattleCookieCostCandidates(card.skill!.specialPlayCost!, state.players['player-one'].battleArea)
  function Harness() {
    const [selected, setSelected] = useState<string[]>([])
    return <SpecialPlayModal sourceCard={card} candidates={candidates} selectedCandidateIds={selected}
      onToggleCandidate={id => setSelected(previous => previous.includes(id) ? [] : [id])}
      onCancel={onCancel} onConfirm={() => onConfirm(selected)} />
  }
  const container = document.createElement('div'), root = createRoot(container)
  document.body.appendChild(container)
  try {
    await act(() => root.render(<Harness />))
    const printed = container.querySelector('.special-play-source > div > p')!
    expect(printed.textContent).toBe(card.skill!.text)
    expect(printed.textContent).toContain('【Special Play】 Place 1 {K} LV.1 Cookie')
    expect(printed.textContent).not.toContain('Discard 1 card')
    const choices = [...container.querySelectorAll<HTMLButtonElement>('.special-play-candidate')]
    expect(choices).toHaveLength(2)
    const confirm = [...container.querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent === '確認特殊登場')!
    expect(confirm.disabled).toBe(true)
    await act(() => choices[0].click())
    expect(confirm.disabled).toBe(false)
    expect(choices[0].getAttribute('aria-pressed')).toBe('true')
    await act(() => choices[0].click())
    expect(confirm.disabled).toBe(true)
    await act(() => choices[1].click())
    await act(() => confirm.click())
    expect(onConfirm).toHaveBeenCalledWith(['bs12-095-other-cost'])
    const cancel = [...container.querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent === '取消')!
    await act(() => cancel.click())
    expect(onCancel).toHaveBeenCalledOnce()
    expect(state.players['player-one'].hand.map(c => c.instanceId)).toEqual(['bs12-095-source'])
  } finally { await act(() => root.unmount()); container.remove() }
})
