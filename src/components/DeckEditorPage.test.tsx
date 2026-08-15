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
    expect(container.querySelector('[data-testid="deck-editor-card-facts"]')).not.toBeNull()
    expect(container.querySelector('.deck-editor-page-detail-copy .energy-icon')).not.toBeNull()
    expect(container.querySelector('.deck-editor-page-header-actions [data-testid="deck-format-select"]')).not.toBeNull()
    expect(container.querySelector('.deck-editor-page-deck-meta [data-testid="deck-format-select"]')).toBeNull()
    expect(container.querySelector('.deck-editor-page-header .deck-editor-page-validation')).not.toBeNull()
    expect(container.querySelector('.deck-editor-page-current .deck-editor-page-validation')).toBeNull()
    expect(container.querySelector('.deck-editor-page-header .deck-editor-page-pool-tools')).not.toBeNull()
    expect(container.querySelector('.deck-editor-page-pool .deck-editor-page-pool-tools')).toBeNull()

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
    expect(container.querySelectorAll('[data-testid^="deck-editor-deck-section-"]')).toHaveLength(5)
    expect(container.querySelector('[data-testid="deck-editor-extra-deck"]')).not.toBeNull()

    await act(() => root.unmount())
  })

  it('opens JSON import in a modal without adding it to the deck workspace layout', async () => {
    const container = document.createElement('div')
    const root = createRoot(container)

    await act(() =>
      root.render(
        <DeckEditorPage onSave={vi.fn()} onClose={vi.fn()} />,
      ),
    )

    const importButton = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find((button) =>
      button.textContent?.includes('匯入 JSON'),
    )
    expect(importButton).not.toBeNull()

    await act(() => importButton!.click())

    const importModal = container.querySelector<HTMLElement>('[data-testid="deck-editor-import-modal"]')
    expect(importModal).not.toBeNull()
    expect(importModal?.getAttribute('role')).toBe('dialog')
    expect(importModal?.getAttribute('aria-modal')).toBe('true')
    expect(container.querySelector('.deck-editor-page-current .deck-editor-page-import')).toBeNull()

    const cancelButton = Array.from(importModal!.querySelectorAll<HTMLButtonElement>('button')).find((button) =>
      button.textContent?.includes('取消'),
    )
    expect(cancelButton).not.toBeNull()
    await act(() => cancelButton!.click())
    expect(container.querySelector('[data-testid="deck-editor-import-modal"]')).toBeNull()

    await act(() => importButton!.click())
    await act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })))
    expect(container.querySelector('[data-testid="deck-editor-import-modal"]')).toBeNull()

    await act(() => root.unmount())
  })

  it('collapses optional card-pool filters until the player needs them', async () => {
    const container = document.createElement('div')
    const root = createRoot(container)

    await act(() =>
      root.render(
        <DeckEditorPage onSave={vi.fn()} onClose={vi.fn()} />,
      ),
    )

    const filterToggle = container.querySelector<HTMLButtonElement>('[data-testid="deck-editor-filter-toggle"]')
    expect(filterToggle).not.toBeNull()
    expect(filterToggle?.getAttribute('aria-expanded')).toBe('false')
    expect(container.querySelector('#deck-editor-pool-filters')).toBeNull()

    await act(() => filterToggle!.click())
    expect(filterToggle?.getAttribute('aria-expanded')).toBe('true')
    expect(container.querySelectorAll('#deck-editor-pool-filters select')).toHaveLength(4)

    await act(() => root.unmount())
  })

  it('shows BS6 cards when the BS6 series filter is selected', async () => {
    const container = document.createElement('div')
    const root = createRoot(container)

    await act(() =>
      root.render(
        <DeckEditorPage onSave={vi.fn()} onClose={vi.fn()} />,
      ),
    )

    const filterToggle = container.querySelector<HTMLButtonElement>('[data-testid="deck-editor-filter-toggle"]')
    await act(() => filterToggle!.click())

    const seriesSelect = Array.from(
      container.querySelectorAll<HTMLSelectElement>('#deck-editor-pool-filters select'),
    ).find((select) =>
      Array.from(select.options).some((option) => option.value === 'BS6'),
    )
    expect(seriesSelect).toBeTruthy()

    const nativeSetter = Object.getOwnPropertyDescriptor(
      window.HTMLSelectElement.prototype,
      'value',
    )!.set!
    await act(() => {
      nativeSetter.call(seriesSelect, 'BS6')
      seriesSelect!.dispatchEvent(new Event('change', { bubbles: true }))
    })

    const bs6CardNumbers = Array.from(
      container.querySelectorAll<HTMLButtonElement>('.deck-editor-page-pool-card-button'),
    ).map((button) => button.title)
    expect(bs6CardNumbers.length).toBeGreaterThan(0)
    expect(bs6CardNumbers.every((cardNumber) => cardNumber.startsWith('BS6-'))).toBe(true)

    await act(() => root.unmount())
  })

  it('shows Cookie records with FLIP text in the FLIP filter', async () => {
    const container = document.createElement('div')
    const root = createRoot(container)

    await act(() =>
      root.render(
        <DeckEditorPage onSave={vi.fn()} onClose={vi.fn()} />,
      ),
    )

    const filterToggle = container.querySelector<HTMLButtonElement>('[data-testid="deck-editor-filter-toggle"]')
    await act(() => filterToggle!.click())

    const typeSelect = Array.from(
      container.querySelectorAll<HTMLSelectElement>('#deck-editor-pool-filters select'),
    ).find((select) =>
      Array.from(select.options).some((option) => option.value === 'flip'),
    )
    expect(typeSelect).toBeTruthy()

    const nativeSetter = Object.getOwnPropertyDescriptor(
      window.HTMLSelectElement.prototype,
      'value',
    )!.set!
    await act(() => {
      nativeSetter.call(typeSelect, 'flip')
      typeSelect!.dispatchEvent(new Event('change', { bubbles: true }))
    })

    const cardNumbers = Array.from(
      container.querySelectorAll<HTMLButtonElement>('.deck-editor-page-pool-card-select'),
    ).map((button) => button.textContent ?? '')
    expect(cardNumbers.some((text) => text.includes('BS5-073'))).toBe(true)
    expect(cardNumbers.some((text) => text.includes('BS5-074'))).toBe(true)

    await act(() => root.unmount())
  })

  it('shows BS5-073 as FLIP in the selected-card details', async () => {
    const container = document.createElement('div')
    const root = createRoot(container)

    await act(() =>
      root.render(
        <DeckEditorPage onSave={vi.fn()} onClose={vi.fn()} />,
      ),
    )

    const cardButton = Array.from(
      container.querySelectorAll<HTMLButtonElement>('.deck-editor-page-pool-card-select'),
    ).find((button) => button.textContent?.includes('BS5-073'))
    expect(cardButton).toBeDefined()

    await act(() => cardButton!.click())

    const detailCopy = container.querySelector('.deck-editor-page-detail-copy')
    expect(detailCopy?.textContent).toContain('FLIP')
    expect(detailCopy?.textContent).toContain('Draw up to 1 card from your deck.')
    expect(detailCopy?.textContent).not.toContain('卡牌效果')

    await act(() => root.unmount())
  })
})
