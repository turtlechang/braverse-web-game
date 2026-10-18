/// @vitest-environment jsdom

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { getCustomDeckStorageKey, type CustomDeck } from '../../game/custom-deck'
import { COMMUNITY_DECK_PRESETS } from '../../game/community-deck-recipes'
import type { MenuScreenProps } from './MenuScreen'
import { AI_DECK_OPTIONS } from '../gameUiLabels'
import { MenuScreen } from './MenuScreen'

vi.mock('../DeckEditorPage', async () => {
  const React = await import('react')
  return {
    DeckEditorPage: ({ initialDeck, onClose }: {
      initialDeck?: CustomDeck
      onClose: () => void
    }) => React.createElement(
      'section',
      {
        'data-testid': 'starter-draft',
        'data-name': initialDeck?.name,
        'data-entries': JSON.stringify(initialDeck?.entries),
        'data-extra-entries': JSON.stringify(initialDeck?.extraDeckEntries ?? null),
      },
      React.createElement('button', { type: 'button', onClick: onClose }, 'Close draft'),
    ),
  }
})

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

const existingDeck: CustomDeck = {
  id: 'existing-deck',
  name: '已保存的牌組',
  entries: [{ cardNumber: 'ST1-001', count: 4 }],
  createdAt: '2026-10-01T00:00:00Z',
  updatedAt: '2026-10-01T00:00:00Z',
}

const menuProps = (): MenuScreenProps => ({
  aiLevel: 3,
  onSelectAiLevel: vi.fn(),
  dialogs: {} as MenuScreenProps['dialogs'],
  pending: {} as MenuScreenProps['pending'],
  ai: {} as MenuScreenProps['ai'],
  match: {} as MenuScreenProps['match'],
  setSelectedHandCardId: vi.fn(),
  onEnterBattle: vi.fn(),
})

beforeEach(() => {
  localStorage.clear()
  Storage.prototype.setItem.call(
    localStorage,
    getCustomDeckStorageKey(),
    JSON.stringify({ version: 1, decks: [existingDeck] }),
  )
})

afterEach(() => vi.restoreAllMocks())

it('localStorage 寫入失敗時仍能使用選單並開啟完整社群牌組草稿', async () => {
  const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new DOMException('Quota exceeded', 'QuotaExceededError')
  })
  const container = document.createElement('div')
  const root = createRoot(container)
  document.body.append(container)

  try {
    await act(async () => root.render(<MenuScreen {...menuProps()} />))

    expect(container.textContent).toContain(existingDeck.name)
    expect(setItem).toHaveBeenCalled()

    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-testid="open-my-decks"]')!.click()
    })
    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-testid="my-decks-starter"]')!.click()
    })

    const choice = 'cookierift-506'
    const recipe = COMMUNITY_DECK_PRESETS[choice]
    const label = AI_DECK_OPTIONS.find((option) => option.value === choice)!.label
    const option = [...container.querySelectorAll('button')]
      .find((button) => button.textContent?.includes(label))!
    await act(async () => option.click())

    const draft = container.querySelector<HTMLElement>('[data-testid="starter-draft"]')!
    expect(draft.dataset.name).toBe(recipe.name)
    expect(JSON.parse(draft.dataset.entries!)).toEqual(recipe.entries)
    expect(JSON.parse(draft.dataset.extraEntries!)).toEqual(recipe.extraDeckEntries)

    await act(async () => {
      [...container.querySelectorAll('button')]
        .find((button) => button.textContent === 'Close draft')!.click()
    })
    expect(container.querySelector('[data-testid="my-decks-starter"]')).not.toBeNull()
  } finally {
    await act(async () => root.unmount())
    container.remove()
  }
})
