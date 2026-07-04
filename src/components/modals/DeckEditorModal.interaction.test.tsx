/// @vitest-environment jsdom

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it } from 'vitest'
import { DeckEditorModal } from './DeckEditorModal'

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

const render = async () => {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  await act(() =>
    root.render(
      <DeckEditorModal onSave={() => undefined} onClose={() => undefined} />,
    ),
  )
  const cleanup = async () => {
    await act(() => root.unmount())
    container.remove()
  }
  return { container, cleanup }
}

const click = async (element: Element | null | undefined) => {
  expect(element).toBeTruthy()
  await act(() => {
    element!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })
}

describe('DeckEditorModal pool interactions', () => {
  it('adds one copy to the deck when a pool card is clicked', async () => {
    const { container, cleanup } = await render()

    const firstCard = container.querySelector('.deck-editor-pool-card-btn')
    await click(firstCard)

    expect(
      container.querySelectorAll('.deck-editor-deck-entry'),
    ).toHaveLength(1)
    expect(
      container.querySelector('.deck-editor-deck-entry-count')?.textContent,
    ).toBe('1')
    expect(
      container.querySelector('.deck-editor-pool-count')?.textContent,
    ).toBe('1')

    await cleanup()
  })

  it('keeps a card visible but disabled once it reaches four copies', async () => {
    const { container, cleanup } = await render()

    const firstCard = container.querySelector<HTMLButtonElement>(
      '.deck-editor-pool-card-btn',
    )
    for (let i = 0; i < 4; i += 1) {
      await click(firstCard)
    }

    expect(
      container.querySelector('.deck-editor-pool-card.at-max'),
    ).not.toBeNull()
    expect(firstCard?.disabled).toBe(true)
    expect(
      container.querySelector('.deck-editor-pool-count')?.textContent,
    ).toBe('4')

    await click(firstCard)
    expect(
      container.querySelector('.deck-editor-deck-entry-count')?.textContent,
    ).toBe('4')

    await cleanup()
  })

  it('opens the detail tooltip from the info button without adding a card', async () => {
    const { container, cleanup } = await render()

    await click(container.querySelector('.deck-editor-pool-info-btn'))

    expect(container.querySelector('.deck-editor-tooltip')).not.toBeNull()
    expect(
      container.querySelectorAll('.deck-editor-deck-entry'),
    ).toHaveLength(0)

    await cleanup()
  })
})
