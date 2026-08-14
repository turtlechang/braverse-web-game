/// @vitest-environment jsdom

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it } from 'vitest'
import { DeckEditorModal } from './DeckEditorModal'
import type { CustomDeck } from '../../game/custom-deck'

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

const render = async (initialDeck?: CustomDeck) => {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  await act(() =>
    root.render(
      <DeckEditorModal
        initialDeck={initialDeck}
        onSave={() => undefined}
        onClose={() => undefined}
      />,
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

  it('shows item, trap, and stage card counts in the stats bar', async () => {
    const { container, cleanup } = await render()

    const stats = container.querySelectorAll('.deck-editor-stats span')
    const labels = Array.from(stats).map((node) => node.textContent ?? '')
    expect(labels).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^FLIP：\d+ \/ 16$/),
        expect.stringMatching(/^餅乾卡：\d+$/),
        expect.stringMatching(/^物品卡：\d+$/),
        expect.stringMatching(/^陷阱卡：\d+$/),
        expect.stringMatching(/^場景卡：\d+$/),
      ]),
    )

    await cleanup()
  })

  it('separates the BS3, BS4, and BS6 series filters by card number', async () => {
    const { container, cleanup } = await render()
    const seriesSelect = Array.from(
      container.querySelectorAll<HTMLSelectElement>('.deck-editor-filters select'),
    ).find((select) =>
      Array.from(select.options).some((option) => option.value === 'BS4'),
    )
    expect(seriesSelect).toBeTruthy()

    const setSeries = async (value: string) => {
      const nativeSetter = Object.getOwnPropertyDescriptor(
        window.HTMLSelectElement.prototype,
        'value',
      )!.set!
      await act(() => {
        nativeSetter.call(seriesSelect, value)
        seriesSelect!.dispatchEvent(new Event('change', { bubbles: true }))
      })
    }

    await setSeries('BS3')
    const bs3Titles = Array.from(
      container.querySelectorAll<HTMLButtonElement>('.deck-editor-pool-card-btn'),
    ).map((button) => button.title)
    expect(bs3Titles.length).toBeGreaterThan(0)
    expect(bs3Titles.every((title) => title.startsWith('BS3-'))).toBe(true)

    await setSeries('BS4')
    const bs4Titles = Array.from(
      container.querySelectorAll<HTMLButtonElement>('.deck-editor-pool-card-btn'),
    ).map((button) => button.title)
    expect(bs4Titles.length).toBeGreaterThan(0)
    expect(bs4Titles.every((title) => title.startsWith('BS4-'))).toBe(true)

    await setSeries('BS6')
    const bs6Titles = Array.from(
      container.querySelectorAll<HTMLButtonElement>('.deck-editor-pool-card-btn'),
    ).map((button) => button.title)
    expect(bs6Titles.length).toBeGreaterThan(0)
    expect(bs6Titles.every((title) => title.startsWith('BS6-'))).toBe(true)

    await cleanup()
  })

  it('disables both base and @1 variant pool cards once the base reaches four copies', async () => {
    const initialDeck: CustomDeck = {
      id: 'legacy-deck',
      name: 'legacy',
      entries: [
        { cardNumber: 'BS2-031', count: 2 },
        { cardNumber: 'BS2-031@1', count: 2 },
      ],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    }

    const { container, cleanup } = await render(initialDeck)

    const atMaxCards = container.querySelectorAll('.deck-editor-pool-card.at-max')
    expect(atMaxCards.length).toBeGreaterThanOrEqual(2)
    atMaxCards.forEach((card) => {
      const btn = card.querySelector<HTMLButtonElement>(
        '.deck-editor-pool-card-btn',
      )
      expect(btn?.disabled).toBe(true)
    })

    const deckNumbers = Array.from(
      container.querySelectorAll('.deck-editor-deck-entry-number'),
    ).map((node) => node.textContent ?? '')
    expect(deckNumbers.sort()).toEqual(['BS2-031', 'BS2-031'])
    expect(deckNumbers.every((text) => !text.includes('@'))).toBe(true)

    const deckCounts = Array.from(
      container.querySelectorAll('.deck-editor-deck-entry-count'),
    ).map((node) => node.textContent ?? '')
    expect(deckCounts.sort()).toEqual(['2', '2'])

    await cleanup()
  })
})
