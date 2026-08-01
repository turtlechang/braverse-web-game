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
        onOpenOnlineMatch={() => undefined}
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
  it('renders the branded main-menu heading as styled text', async () => {
    const { container, root } = await renderMenu([validDeck])

    const title = container.querySelector<HTMLElement>(
      '.main-menu-brand-title',
    )
    expect(title?.getAttribute('aria-label')).toBe('薑餅人對戰卡牌 Braverse')
    expect(
      [...container.querySelectorAll('.main-menu-brand-line')].map(
        (line) => line.textContent,
      ),
    ).toEqual(['薑餅人', '對戰卡牌'])
    expect(container.querySelector('.main-menu-brand-badge')?.textContent).toBe(
      'BRAVERSE',
    )

    await act(() => root.unmount())
  })

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
      aiDeckChoice: 'bs2-blue',
      aiLevel: 1,
    })

    const selects = container.querySelectorAll<HTMLSelectElement>(
      '.main-menu-ai-options select',
    )
    expect(selects).toHaveLength(2)
    expect(selects[0].value).toBe('bs2-blue')
    expect(selects[1].value).toBe('1')
    expect(container.textContent).toContain('不主動使用技能')
    expect([...selects[0].options].map((option) => option.value)).toContain(
      'bs2-purple',
    )
    expect([...selects[0].options].map((option) => option.value)).toContain(
      'bs3-green-lily',
    )
    expect(container.textContent).toContain('第二彈藍色牌組')
    expect(container.textContent).toContain('第三彈綠色・聖百合餅乾')

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
      selects[0].value = 'bs2-purple'
      selects[0].dispatchEvent(new Event('change', { bubbles: true }))
    })
    await act(() => {
      selects[1].value = '3'
      selects[1].dispatchEvent(new Event('change', { bubbles: true }))
    })

    expect(onSelectAiDeck).toHaveBeenCalledWith('bs2-purple')
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

describe('MainMenu empty deck state', () => {
  it('shows 建立第一副牌組 as primary CTA when no decks exist', async () => {
    const onCreateDeck = vi.fn()
    const container = document.createElement('div')
    const root = createRoot(container)
    await act(() =>
      root.render(
        <MainMenu
          decks={[]}
          selectedDeckId={null}
          selectedValidation={null}
          battleError={null}
          aiDeckChoice="random"
          aiLevel={2}
          onSelectAiDeck={() => undefined}
          onSelectAiLevel={() => undefined}
          onSelectDeck={() => undefined}
          onStartBattle={() => undefined}
          onOpenOnlineMatch={() => undefined}
          onOpenTestScenario={() => undefined}
          onCreateDeck={onCreateDeck}
          onEditDeck={() => undefined}
          onDuplicateDeck={() => undefined}
          onDeleteDeck={() => undefined}
          onRefreshDecks={() => undefined}
        />,
      ),
    )

    const createButton = [...container.querySelectorAll('button')].find(
      (btn) => btn.textContent?.includes('建立第一副牌組'),
    )
    expect(createButton).toBeDefined()
    expect(
      createButton!.classList.contains('main-menu-primary'),
    ).toBe(true)

    await act(() => {
      createButton!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(onCreateDeck).toHaveBeenCalledTimes(1)

    await act(() => root.unmount())
  })

  it('disables 對戰入口 and 線上對戰 when no decks exist', async () => {
    const container = document.createElement('div')
    const root = createRoot(container)
    await act(() =>
      root.render(
        <MainMenu
          decks={[]}
          selectedDeckId={null}
          selectedValidation={null}
          battleError={null}
          aiDeckChoice="random"
          aiLevel={2}
          onSelectAiDeck={() => undefined}
          onSelectAiLevel={() => undefined}
          onSelectDeck={() => undefined}
          onStartBattle={() => undefined}
          onOpenOnlineMatch={() => undefined}
          onOpenTestScenario={() => undefined}
          onCreateDeck={() => undefined}
          onEditDeck={() => undefined}
          onDuplicateDeck={() => undefined}
          onDeleteDeck={() => undefined}
          onRefreshDecks={() => undefined}
        />,
      ),
    )

    const battleBtn = [...container.querySelectorAll('button')].find(
      (btn) => btn.textContent?.includes('對戰入口'),
    )
    expect(battleBtn).toBeDefined()
    expect(battleBtn!.disabled).toBe(true)

    const onlineBtn = [...container.querySelectorAll('button')].find(
      (btn) => btn.textContent?.includes('線上對戰'),
    )
    expect(onlineBtn).toBeDefined()
    expect(onlineBtn!.disabled).toBe(true)

    // P2-4：兩個 disabled 按鈕都要有一致風格的原因文字，不能只有對戰入口有。
    const reasons = container.querySelectorAll('.main-menu-disabled-reason')
    expect(reasons).toHaveLength(2)
    expect(reasons[0].textContent).toContain('尚無自訂牌組')
    expect(reasons[1].textContent).toContain('尚無自訂牌組')

    await act(() => root.unmount())
  })

  it('P2-4: keeps developer tools (測試對局設定／重新讀取) out of the main action list, in the footer instead', async () => {
    const { container, root } = await renderMenu([validDeck])

    const actionsList = container.querySelector('.main-menu-actions')
    expect(actionsList?.textContent).not.toContain('測試對局設定')
    expect(actionsList?.textContent).not.toContain('重新讀取')

    const devTools = container.querySelector('.main-menu-dev-tools')
    expect(devTools).toBeTruthy()
    expect(devTools?.closest('footer')).toBeTruthy()
    expect(devTools?.textContent).toContain('測試對局設定')
    expect(devTools?.textContent).toContain('重新讀取')

    await act(() => root.unmount())
  })

  it('shows 對戰入口 as primary CTA when decks exist', async () => {
    const { container, root } = await renderMenu([validDeck])

    const battleButton = [...container.querySelectorAll('button')].find(
      (btn) => btn.textContent?.includes('對戰入口'),
    )
    expect(battleButton).toBeDefined()
    expect(
      battleButton!.classList.contains('main-menu-primary'),
    ).toBe(true)
    expect(battleButton!.disabled).toBe(false)

    expect(
      container.querySelector('.main-menu-disabled-reason'),
    ).toBeNull()

    await act(() => root.unmount())
  })

  it('keeps 線上對戰 enabled when decks exist', async () => {
    const { container, root } = await renderMenu([validDeck])

    const onlineButton = [...container.querySelectorAll('button')].find(
      (btn) => btn.textContent?.includes('線上對戰'),
    )
    expect(onlineButton).toBeDefined()
    expect(onlineButton!.disabled).toBe(false)

    await act(() => root.unmount())
  })
})
