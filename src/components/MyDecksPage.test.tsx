/// @vitest-environment jsdom

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it, vi } from 'vitest'
import { MyDecksPage } from './MyDecksPage'
import type { CustomDeck } from '../game/custom-deck'
import { OFFICIAL_RED_STARTER_DECK } from '../game/starter-deck'

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

const validDeck: CustomDeck = {
  id: 'my-decks-test',
  name: '測試牌組',
  entries: OFFICIAL_RED_STARTER_DECK,
  createdAt: '2026-09-14T00:00:00.000Z',
  updatedAt: '2026-09-14T00:00:00.000Z',
}

const renderPage = async (handlers: {
  onSelectDeck?: (deckId: string) => void
  onCreateDeck?: () => void
  onDeleteDecks?: (deckIds: string[]) => boolean
}) => {
  const container = document.createElement('div')
  const root = createRoot(container)
  await act(() =>
    root.render(
      <MyDecksPage
        decks={[validDeck]}
        selectedDeckId={validDeck.id}
        onSelectDeck={handlers.onSelectDeck ?? (() => undefined)}
        onBack={() => undefined}
        onCreateDeck={handlers.onCreateDeck ?? (() => undefined)}
        onCreateStarterDeck={() => undefined}
        onImportDeck={() => undefined}
        onEditDeck={() => undefined}
        onDuplicateDeck={() => undefined}
        onDeleteDecks={handlers.onDeleteDecks ?? (() => true)}
      />,
    ),
  )
  return { container, root }
}

const click = async (element: Element | null) => {
  expect(element).not.toBeNull()
  await act(() => {
    element!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })
}

describe('MyDecksPage', () => {
  it('renders the formal page and opens the existing deck editor entry point', async () => {
    const onCreateDeck = vi.fn()
    const { container, root } = await renderPage({ onCreateDeck })

    expect(container.querySelector('[data-testid="my-decks-page"]')).not.toBeNull()
    expect(container.querySelector('.my-decks-title')?.textContent).toBe('我的牌組')

    await click(container.querySelector('[data-testid="my-decks-create"]'))

    expect(onCreateDeck).toHaveBeenCalledTimes(1)
    await act(() => root.unmount())
  })

  it('selects a deck and sends checked decks to batch deletion', async () => {
    const onSelectDeck = vi.fn()
    const onDeleteDecks = vi.fn(() => true)
    const { container, root } = await renderPage({ onSelectDeck, onDeleteDecks })

    await click(container.querySelector(`[data-testid="my-decks-tile-${validDeck.id}"]`))
    expect(onSelectDeck).toHaveBeenCalledWith(validDeck.id)

    await click(container.querySelector('[data-testid="my-decks-bulk-toggle"]'))
    await click(container.querySelector(`[data-testid="my-decks-tile-${validDeck.id}"]`))
    await click(container.querySelector('[data-testid="my-decks-delete-selected"]'))

    expect(onDeleteDecks).toHaveBeenCalledWith([validDeck.id])
    await act(() => root.unmount())
  })
})
