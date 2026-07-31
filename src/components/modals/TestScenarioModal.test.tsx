/// @vitest-environment jsdom

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it, vi } from 'vitest'
import { TestScenarioModal } from './TestScenarioModal'
import type { GameState } from '../../game'

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

const click = async (element: Element | null) => {
  expect(element).not.toBeNull()
  await act(() => {
    element!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })
}

const changeInput = async (input: HTMLInputElement | null, value: string) => {
  expect(input).not.toBeNull()
  await act(() => {
    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value',
    )?.set
    setter?.call(input, value)
    input!.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

const renderModal = async (onStart: (state: GameState) => void) => {
  const container = document.createElement('div')
  const root = createRoot(container)
  await act(() =>
    root.render(
      <TestScenarioModal onClose={() => undefined} onStart={onStart} />,
    ),
  )
  return { container, root }
}

describe('TestScenarioModal', () => {
  it('exposes all formal-card-pool scenario zones and BS3 quick cases', async () => {
    const onStart = vi.fn()
    const { container, root } = await renderModal(onStart)

    expect(container.textContent).toContain('精確 HP 卡')
    expect(container.textContent).toContain('起始手牌')
    expect(container.textContent).toContain('牌庫')
    expect(container.textContent).toContain('指定支援區卡')
    expect(container.textContent).toContain('補足能量顏色')
    expect(container.textContent).toContain('場景卡')
    expect(container.textContent).toContain('棄牌區卡片')
    expect(
      container.querySelector('[data-testid="scenario-preset-bs3-018-blocker"]'),
    ).not.toBeNull()
    expect(
      container.querySelector('[data-testid="scenario-preset-bs3-020-hp-to-hand"]'),
    ).not.toBeNull()

    await act(() => root.unmount())
  })

  it('passes preset and edited zones into a formal scenario state', async () => {
    const onStart = vi.fn()
    const { container, root } = await renderModal(onStart)

    await click(
      container.querySelector(
        '[data-testid="scenario-preset-bs3-020-hp-to-hand"]',
      ),
    )
    await changeInput(
      container.querySelector<HTMLInputElement>(
        '[data-testid="scenario-player-hp-cards-0"]',
      ),
      'BS3-018,BS3-020',
    )
    await changeInput(
      container.querySelector<HTMLInputElement>('[data-testid="scenario-player-stage"]'),
      'BS3-096',
    )
    await changeInput(
      container.querySelector<HTMLInputElement>(
        '[data-testid="scenario-player-discard-pile"]',
      ),
      'BS3-019',
    )
    await click(container.querySelector('[data-testid="scenario-start-button"]'))

    expect(onStart).toHaveBeenCalledTimes(1)
    const state = onStart.mock.calls[0][0] as GameState
    const player = state.players['player-one']
    expect(player.hand.map((card) => card.id)).toEqual(['BS3-020'])
    expect(player.battleArea[0].hpCards.map((card) => card.id)).toEqual([
      'BS3-018',
      'BS3-020',
    ])
    expect(player.supportArea.map(({ card }) => card.id)).toEqual([
      'BS3-018',
      'scenario-energy-token',
    ])
    expect(player.stage?.card.id).toBe('BS3-096')
    expect(player.discardPile.map((card) => card.id)).toEqual(['BS3-019'])

    await act(() => root.unmount())
  })
})
