/// @vitest-environment jsdom

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it, vi } from 'vitest'
import { DeckEditorPage } from './DeckEditorPage'

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

describe('DeckEditorPage', () => {
  it('renders the deck editor as a full page instead of a modal', async () => {
    const container = document.createElement('div')
    const root = createRoot(container)

    await act(() =>
      root.render(
        <DeckEditorPage onSave={vi.fn()} onClose={vi.fn()} />,
      ),
    )

    expect(container.querySelector('[data-testid="deck-editor-page"]')).not.toBeNull()
    expect(container.querySelector('.modal-backdrop')).toBeNull()
    expect(container.querySelector('[role="dialog"]')).toBeNull()
    expect(container.querySelector('[aria-label="卡牌詳細資料"]')).not.toBeNull()
    expect(container.querySelector('.deck-editor-page-pool')).not.toBeNull()

    await act(() => root.unmount())
  })

  it('supports selecting and adding a card from the full-page card list', async () => {
    const container = document.createElement('div')
    const root = createRoot(container)

    await act(() =>
      root.render(
        <DeckEditorPage onSave={vi.fn()} onClose={vi.fn()} />,
      ),
    )

    const firstCard = container.querySelector<HTMLButtonElement>(
      '.deck-editor-page-pool-card-button:not(:disabled)',
    )
    expect(firstCard).not.toBeNull()

    await act(() => {
      firstCard!.click()
    })

    expect(container.querySelector('.deck-editor-page-deck-card')).not.toBeNull()
    expect(container.querySelector('.deck-editor-page-counter')?.textContent).toContain('1')

    await act(() => root.unmount())
  })
})
