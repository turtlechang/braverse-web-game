/// @vitest-environment jsdom

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it, vi } from 'vitest'
import { MainMenu, type AiDeckChoice } from './MainMenu'
import type { AiLevel } from '../game'
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
    onSelectAiDeck: (choice: AiDeckChoice) => void
    onSelectAiLevel: (level: AiLevel) => void
  }> = {},
  aiOptions: { aiDeckChoice?: AiDeckChoice; aiLevel?: AiLevel } = {},
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
        aiDeckChoice={aiOptions.aiDeckChoice ?? 'random'}
        aiLevel={aiOptions.aiLevel ?? 2}
        onSelectAiDeck={handlers.onSelectAiDeck ?? (() => undefined)}
        onSelectAiLevel={handlers.onSelectAiLevel ?? (() => undefined)}
        onSelectDeck={() => undefined}
        onStartBattle={() => undefined}
        onOpenTestScenario={() => undefined}
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

describe('MainMenu AI opponent options', () => {
  it('renders deck and level selectors with current values', async () => {
    const { container, root } = await renderMenu([validDeck], {}, {
      aiDeckChoice: 'blue',
      aiLevel: 1,
    })

    const selects = container.querySelectorAll<HTMLSelectElement>(
      '.main-menu-ai-options select',
    )
    expect(selects).toHaveLength(2)
    expect(selects[0].value).toBe('blue')
    expect(selects[1].value).toBe('1')
    expect(container.textContent).toContain('不主動使用技能')

    await act(() => root.unmount())
  })

  it('invokes onSelectAiDeck and onSelectAiLevel on change', async () => {
    const onSelectAiDeck = vi.fn()
    const onSelectAiLevel = vi.fn()
    const { container, root } = await renderMenu([validDeck], {
      onSelectAiDeck,
      onSelectAiLevel,
    })

    const selects = container.querySelectorAll<HTMLSelectElement>(
      '.main-menu-ai-options select',
    )
    await act(() => {
      selects[0].value = 'purple'
      selects[0].dispatchEvent(new Event('change', { bubbles: true }))
    })
    await act(() => {
      selects[1].value = '3'
      selects[1].dispatchEvent(new Event('change', { bubbles: true }))
    })

    expect(onSelectAiDeck).toHaveBeenCalledWith('purple')
    expect(onSelectAiLevel).toHaveBeenCalledWith(3)

    await act(() => root.unmount())
  })

  it('offers Lv.3 as a selectable option', async () => {
    const { container, root } = await renderMenu([validDeck], {}, {
      aiLevel: 3,
    })

    const levelSelect = container.querySelectorAll<HTMLSelectElement>(
      '.main-menu-ai-options select',
    )[1]
    expect(levelSelect.value).toBe('3')
    expect(container.textContent).toContain('評估戰局')

    await act(() => root.unmount())
  })
})
