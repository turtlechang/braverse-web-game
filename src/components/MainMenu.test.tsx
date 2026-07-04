/// @vitest-environment jsdom

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it, vi } from 'vitest'
import { MainMenu } from './MainMenu'
import type { CustomDeck } from '../game/custom-deck'
import { OFFICIAL_RED_STARTER_DECK } from '../game/starter-deck'

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

const validDeck: CustomDeck = {
  id: 'deck-valid',
  name: '合法紅色牌組',
  entries: OFFICIAL_RED_STARTER_DECK,
  createdAt: '2026-07-04T00:00:00.000Z',
  updatedAt: '2026-07-04T00:00:00.000Z',
}

const invalidDeck: CustomDeck = {
  id: 'deck-invalid',
  name: '缺牌牌組',
  entries: [{ cardNumber: 'ST1-001', count: 4 }],
  createdAt: '2026-07-04T00:00:00.000Z',
  updatedAt: '2026-07-04T00:00:00.000Z',
}

const renderMenu = async (
  decks: CustomDeck[],
  handlers: Partial<{
    onDuplicateDeck: (deck: CustomDeck) => void
    onDeleteDeck: (deck: CustomDeck) => void
  }> = {},
) => {
  const container = document.createElement('div')
  const root = createRoot(container)
  await act(() =>
    root.render(
      <MainMenu
        decks={decks}
        selectedDeckId={decks[0]?.id ?? null}
        selectedValidation={null}
        battleError={null}
        onSelectDeck={() => undefined}
        onStartBattle={() => undefined}
        onCreateDeck={() => undefined}
        onEditDeck={() => undefined}
        onDuplicateDeck={handlers.onDuplicateDeck ?? (() => undefined)}
        onDeleteDeck={handlers.onDeleteDeck ?? (() => undefined)}
        onRefreshDecks={() => undefined}
      />,
    ),
  )
  return { container, root }
}

const findButton = (container: HTMLElement, label: string) =>
  [...container.querySelectorAll('button')].find((button) =>
    button.textContent?.includes(label),
  )

const click = async (button: HTMLButtonElement | undefined) => {
  expect(button).toBeDefined()
  await act(() => {
    button!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })
}

describe('MainMenu deck management', () => {
  it('invokes onDuplicateDeck with the deck when 複製 is clicked', async () => {
    const onDuplicateDeck = vi.fn()
    const { container, root } = await renderMenu([validDeck], {
      onDuplicateDeck,
    })

    await click(findButton(container, '複製'))

    expect(onDuplicateDeck).toHaveBeenCalledTimes(1)
    expect(onDuplicateDeck).toHaveBeenCalledWith(validDeck)
    await act(() => root.unmount())
  })

  it('invokes onDeleteDeck with the deck when 刪除 is clicked', async () => {
    const onDeleteDeck = vi.fn()
    const { container, root } = await renderMenu([validDeck], {
      onDeleteDeck,
    })

    await click(findButton(container, '刪除'))

    expect(onDeleteDeck).toHaveBeenCalledTimes(1)
    expect(onDeleteDeck).toHaveBeenCalledWith(validDeck)
    await act(() => root.unmount())
  })

  it('shows validation errors as a tooltip on the 需調整 label', async () => {
    const { container, root } = await renderMenu([invalidDeck])

    const label = [...container.querySelectorAll('.main-menu-deck-select span')]
      .find((span) => span.textContent === '需調整')
    expect(label).toBeDefined()
    expect(label!.getAttribute('title')).toContain('牌組必須剛好 60 張')

    await act(() => root.unmount())
  })

  it('does not add a tooltip to a legal deck label', async () => {
    const { container, root } = await renderMenu([validDeck])

    const label = [...container.querySelectorAll('.main-menu-deck-select span')]
      .find((span) => span.textContent === '合法')
    expect(label).toBeDefined()
    expect(label!.getAttribute('title')).toBeNull()

    await act(() => root.unmount())
  })
})
