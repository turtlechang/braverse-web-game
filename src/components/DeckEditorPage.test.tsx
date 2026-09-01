/// @vitest-environment jsdom

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it, vi } from 'vitest'
import { DeckEditorPage } from './DeckEditorPage'
import { getCardPoolEntry } from '../game/card-pool'
import { OFFICIAL_RED_STARTER_DECK } from '../game/starter-deck'
import { getCardAttackPower } from '../hooks/useDeckEditor'

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
    expect(
      container.querySelector('.deck-editor-page-deck-grid > [data-testid="deck-editor-extra-deck"]'),
    ).not.toBeNull()

    await act(() => root.unmount())
  })

  it('orders the card pool by card number starting at BS1-001', async () => {
    const container = document.createElement('div')
    const root = createRoot(container)

    await act(() => root.render(<DeckEditorPage onSave={vi.fn()} onClose={vi.fn()} />))

    const cardNumbers = Array.from(
      container.querySelectorAll<HTMLButtonElement>('.deck-editor-page-pool-card-select'),
    )
      .slice(0, 4)
      .map((button) => button.querySelector('span')?.textContent)

    expect(cardNumbers).toEqual(['BS1-001', 'BS1-002', 'BS1-002@1', 'BS1-003'])

    await act(() => root.unmount())
  })

  it('only exposes the six-slot candidate EXTRA editor when explicitly opened in BS8 staging mode', async () => {
    const standardContainer = document.createElement('div')
    const standardRoot = createRoot(standardContainer)
    await act(() => standardRoot.render(<DeckEditorPage onSave={vi.fn()} onClose={vi.fn()} />))
    expect(standardContainer.querySelector('[data-testid="candidate-extra-add-BS8-005"]')).toBeNull()
    await act(() => standardRoot.unmount())

    const container = document.createElement('div')
    const root = createRoot(container)
    const onSave = vi.fn()
    await act(() => root.render(
      <DeckEditorPage
        mode="bs8-candidate-staging"
        onSave={onSave}
        onClose={vi.fn()}
      />,
    ))

    const filterToggle = container.querySelector<HTMLButtonElement>('[data-testid="deck-editor-filter-toggle"]')
    await act(() => filterToggle!.click())
    const typeSelect = container.querySelector<HTMLSelectElement>('[aria-label="卡牌類型"]')
    expect(typeSelect).not.toBeNull()
    const selectSetter = Object.getOwnPropertyDescriptor(
      window.HTMLSelectElement.prototype,
      'value',
    )!.set!
    await act(() => {
      selectSetter.call(typeSelect, 'extra')
      typeSelect!.dispatchEvent(new Event('change', { bubbles: true }))
    })
    const avatar = container.querySelector<HTMLButtonElement>('.deck-editor-page-pool-card-button[title^="BS8-005"]')
    const golden = container.querySelector<HTMLButtonElement>('.deck-editor-page-pool-card-button[title^="BS8-027"]')
    expect(avatar).not.toBeNull()
    expect(golden).not.toBeNull()

    for (let index = 0; index < 4; index += 1) await act(() => avatar!.click())
    for (let index = 0; index < 2; index += 1) await act(() => golden!.click())

    expect(container.querySelector('[data-testid="deck-editor-extra-count"]')?.textContent).toContain('6')
    expect(avatar?.disabled).toBe(true)
    expect(golden?.disabled).toBe(true)

    await act(() => {
      selectSetter.call(typeSelect, '')
      typeSelect!.dispatchEvent(new Event('change', { bubbles: true }))
    })
    const mainDeckCard = container.querySelector<HTMLButtonElement>(
      '.deck-editor-page-pool-card-button:not(:disabled)',
    )
    await act(() => mainDeckCard!.click())
    const save = container.querySelector<HTMLButtonElement>('[data-testid="deck-editor-page-save"]')
    await act(() => save!.click())
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      candidateStaging: {
        kind: 'bs8-candidate-staging',
        extraDeckEntries: [
          { cardNumber: 'BS8-005', count: 4 },
          { cardNumber: 'BS8-027', count: 2 },
        ],
      },
    }))

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
    expect(container.querySelectorAll('#deck-editor-pool-filters select')).toHaveLength(7)
    expect(container.querySelector('[data-testid="deck-editor-filter-level"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="deck-editor-filter-hp"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="deck-editor-filter-attack-power"]')).not.toBeNull()

    await act(() => root.unmount())
  })

  it('filters the card pool by LV, HP, and attack power', async () => {
    const container = document.createElement('div')
    const root = createRoot(container)

    await act(() =>
      root.render(
        <DeckEditorPage onSave={vi.fn()} onClose={vi.fn()} />,
      ),
    )

    const filterToggle = container.querySelector<HTMLButtonElement>('[data-testid="deck-editor-filter-toggle"]')
    await act(() => filterToggle!.click())

    const nativeSetter = Object.getOwnPropertyDescriptor(
      window.HTMLSelectElement.prototype,
      'value',
    )!.set!
    const setFilter = async (testId: string, value: string) => {
      const select = container.querySelector<HTMLSelectElement>(`[data-testid="${testId}"]`)
      expect(select).not.toBeNull()
      await act(() => {
        nativeSetter.call(select, value)
        select!.dispatchEvent(new Event('change', { bubbles: true }))
      })
    }
    const visibleEntries = () =>
      Array.from(
        container.querySelectorAll<HTMLButtonElement>('.deck-editor-page-pool-card-select'),
      )
        .map((button) => button.querySelector('span')?.textContent ?? '')
        .map((cardNumber) => getCardPoolEntry(cardNumber))

    await setFilter('deck-editor-filter-level', '2')
    const levelEntries = visibleEntries()
    expect(levelEntries.length).toBeGreaterThan(0)
    expect(levelEntries.every((entry) => entry?.level === 2)).toBe(true)

    await setFilter('deck-editor-filter-hp', '4')
    const hpEntries = visibleEntries()
    expect(hpEntries.length).toBeGreaterThan(0)
    expect(hpEntries.every((entry) => entry?.level === 2 && entry.hp === 4)).toBe(true)

    await setFilter('deck-editor-filter-attack-power', '2')
    const attackEntries = visibleEntries()
    expect(attackEntries.length).toBeGreaterThan(0)
    expect(
      attackEntries.every(
        (entry) => entry?.level === 2 && entry.hp === 4 && getCardAttackPower(entry.attackText) === 2,
      ),
    ).toBe(true)

    await act(() => root.unmount())
  })

  it('shows BS7 cards when the BS7 series filter is selected and lets them join a Standard deck', async () => {
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
      Array.from(select.options).some((option) => option.value === 'BS7'),
    )
    expect(seriesSelect).toBeTruthy()
    expect(Array.from(seriesSelect!.options).some((option) => option.value === 'BS8')).toBe(true)

    const nativeSetter = Object.getOwnPropertyDescriptor(
      window.HTMLSelectElement.prototype,
      'value',
    )!.set!
    await act(() => {
      nativeSetter.call(seriesSelect, 'BS7')
      seriesSelect!.dispatchEvent(new Event('change', { bubbles: true }))
    })

    const bs7CardNumbers = Array.from(
      container.querySelectorAll<HTMLButtonElement>('.deck-editor-page-pool-card-button'),
    ).map((button) => button.title)
    expect(bs7CardNumbers.length).toBeGreaterThan(0)
    expect(bs7CardNumbers.every((cardNumber) => cardNumber.startsWith('BS7-'))).toBe(true)

    const firstCard = container.querySelector<HTMLButtonElement>(
      '.deck-editor-page-pool-card-button:not(:disabled)',
    )
    expect(firstCard).not.toBeNull()
    await act(() => firstCard!.click())
    expect(container.querySelector('.deck-editor-page-deck-card')?.textContent).toContain('BS7-')

    await act(() => root.unmount())
  })

  it('matches BS7 and BS8 by card-number text search in Standard', async () => {
    const container = document.createElement('div')
    const root = createRoot(container)

    await act(() => root.render(<DeckEditorPage onSave={vi.fn()} onClose={vi.fn()} />))

    const search = container.querySelector<HTMLInputElement>('[data-testid="deck-editor-search"]')
    expect(search).not.toBeNull()
    const nativeSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      'value',
    )!.set!
    await act(() => {
      nativeSetter.call(search, 'BS7-001')
      search!.dispatchEvent(new Event('input', { bubbles: true }))
    })
    expect(
      Array.from(container.querySelectorAll<HTMLButtonElement>('.deck-editor-page-pool-card-button'))
        .map((button) => button.title),
    ).toEqual([expect.stringMatching(/^BS7-001\b/)])

    await act(() => {
      nativeSetter.call(search, 'BS8')
      search!.dispatchEvent(new Event('input', { bubbles: true }))
    })
    const bs8CardNumbers = Array.from(
      container.querySelectorAll<HTMLButtonElement>('.deck-editor-page-pool-card-button'),
    ).map((button) => button.title)
    expect(bs8CardNumbers).toHaveLength(156)
    expect(bs8CardNumbers.every((cardNumber) => cardNumber.startsWith('BS8-'))).toBe(true)

    await act(() => root.unmount())
  })

  it('shows BS8 in Standard and labels the isolated staging filter for candidates', async () => {
    const standardContainer = document.createElement('div')
    const standardRoot = createRoot(standardContainer)
    await act(() => standardRoot.render(<DeckEditorPage onSave={vi.fn()} onClose={vi.fn()} />))
    const standardToggle = standardContainer.querySelector<HTMLButtonElement>('[data-testid="deck-editor-filter-toggle"]')
    await act(() => standardToggle!.click())
    const standardSeries = Array.from(
      standardContainer.querySelectorAll<HTMLSelectElement>('#deck-editor-pool-filters select'),
    ).find((select) => Array.from(select.options).some((option) => option.value === 'BS7'))
    expect(standardSeries).toBeTruthy()
    expect(
      Array.from(standardSeries!.options).find((option) => option.value === 'BS8')?.textContent,
    ).toBe('BS8')
    expect(standardContainer.textContent).toContain('BS8 候選 EXTRA 驗收')
    await act(() => standardRoot.unmount())

    const candidateContainer = document.createElement('div')
    const candidateRoot = createRoot(candidateContainer)
    await act(() => candidateRoot.render(
      <DeckEditorPage mode="bs8-candidate-staging" onSave={vi.fn()} onClose={vi.fn()} />,
    ))
    const candidateToggle = candidateContainer.querySelector<HTMLButtonElement>('[data-testid="deck-editor-filter-toggle"]')
    await act(() => candidateToggle!.click())
    const candidateSeries = Array.from(
      candidateContainer.querySelectorAll<HTMLSelectElement>('#deck-editor-pool-filters select'),
    ).find((select) => Array.from(select.options).some((option) => option.value === 'BS8'))
    expect(candidateSeries).toBeTruthy()
    expect(
      Array.from(candidateSeries!.options).find((option) => option.value === 'BS8')?.textContent,
    ).toContain('候選驗收')
    expect(candidateContainer.textContent).toContain('點擊卡面即可加入')

    await act(() => candidateRoot.unmount())
  })

  it('shows BS8 EXTRA cards in the candidate pool and adds them to the separate six-slot deck', async () => {
    const standardContainer = document.createElement('div')
    const standardRoot = createRoot(standardContainer)
    await act(() => standardRoot.render(<DeckEditorPage onSave={vi.fn()} onClose={vi.fn()} />))

    const standardToggle = standardContainer.querySelector<HTMLButtonElement>('[data-testid="deck-editor-filter-toggle"]')
    await act(() => standardToggle!.click())
    const standardType = standardContainer.querySelector<HTMLSelectElement>('[aria-label="卡牌類型"]')
    expect(standardType).toBeTruthy()
    expect(Array.from(standardType!.options).some((option) => option.value === 'extra')).toBe(false)
    const standardSearch = standardContainer.querySelector<HTMLInputElement>('[data-testid="deck-editor-search"]')
    const inputSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      'value',
    )!.set!
    await act(() => {
      inputSetter.call(standardSearch, 'BS8-005')
      standardSearch!.dispatchEvent(new Event('input', { bubbles: true }))
    })
    expect(standardContainer.querySelector('.deck-editor-page-pool-card-button')).toBeNull()
    await act(() => standardRoot.unmount())

    const container = document.createElement('div')
    const root = createRoot(container)
    await act(() => root.render(
      <DeckEditorPage mode="bs8-candidate-staging" onSave={vi.fn()} onClose={vi.fn()} />,
    ))

    const filterToggle = container.querySelector<HTMLButtonElement>('[data-testid="deck-editor-filter-toggle"]')
    await act(() => filterToggle!.click())
    const typeSelect = container.querySelector<HTMLSelectElement>('[aria-label="卡牌類型"]')
    expect(typeSelect).toBeTruthy()
    expect(Array.from(typeSelect!.options).some((option) => option.value === 'extra')).toBe(true)

    const selectSetter = Object.getOwnPropertyDescriptor(
      window.HTMLSelectElement.prototype,
      'value',
    )!.set!
    await act(() => {
      selectSetter.call(typeSelect, 'extra')
      typeSelect!.dispatchEvent(new Event('change', { bubbles: true }))
    })

    const search = container.querySelector<HTMLInputElement>('[data-testid="deck-editor-search"]')
    await act(() => {
      inputSetter.call(search, 'BS8-005')
      search!.dispatchEvent(new Event('input', { bubbles: true }))
    })
    expect(
      Array.from(container.querySelectorAll<HTMLButtonElement>('.deck-editor-page-pool-card-button')),
    ).toHaveLength(1)
    expect(
      container.querySelector<HTMLButtonElement>('.deck-editor-page-pool-card-button')?.title,
    ).toMatch(/^BS8-005\b/)
    await act(() => {
      inputSetter.call(search, '')
      search!.dispatchEvent(new Event('input', { bubbles: true }))
    })

    const extraCards = Array.from(
      container.querySelectorAll<HTMLButtonElement>('.deck-editor-page-pool-card-button'),
    )
    expect(extraCards).toHaveLength(5)
    expect(extraCards.every((button) => button.title.startsWith('BS8-'))).toBe(true)
    const avatar = extraCards.find((button) => button.title.startsWith('BS8-005'))
    expect(avatar).toBeTruthy()

    await act(() => avatar!.click())
    expect(container.querySelector('[data-testid="deck-editor-extra-count"]')?.textContent).toContain('1 / 6')
    expect(
      container.querySelector('[data-testid^="deck-editor-deck-section-"] .deck-editor-page-deck-card'),
    ).toBeNull()
    const extraCard = container.querySelector<HTMLElement>('[data-testid="deck-editor-extra-card-BS8-005"]')
    expect(extraCard).not.toBeNull()
    expect(
      container.querySelector('.deck-editor-page-deck-grid > [data-testid="deck-editor-extra-deck"]'),
    ).not.toBeNull()
    expect(extraCard?.querySelector('.deck-editor-page-deck-card-face')).not.toBeNull()
    expect(extraCard?.querySelector('.deck-page-card-image, .deck-page-card-fallback')).not.toBeNull()
    expect(extraCard?.textContent).toContain('BS8-005')

    const detailAdd = container.querySelector<HTMLButtonElement>('[aria-label="加入一張到額外牌組"]')
    expect(detailAdd).not.toBeNull()
    await act(() => detailAdd!.click())
    expect(container.querySelector('[data-testid="deck-editor-extra-count"]')?.textContent).toContain('2 / 6')

    await act(() => root.unmount())
  })

  it('filters and imports strict-verified BS8 cards with the isolated six-slot EXTRA payload', async () => {
    const container = document.createElement('div')
    const root = createRoot(container)
    const clipboardWrite = vi.fn().mockResolvedValue(undefined)
    const previousClipboard = Object.getOwnPropertyDescriptor(window.navigator, 'clipboard')
    Object.defineProperty(window.navigator, 'clipboard', {
      configurable: true,
      value: { writeText: clipboardWrite },
    })

    try {
      await act(() => root.render(
        <DeckEditorPage mode="bs8-candidate-staging" onSave={vi.fn()} onClose={vi.fn()} />,
      ))

      const filterToggle = container.querySelector<HTMLButtonElement>('[data-testid="deck-editor-filter-toggle"]')
      await act(() => filterToggle!.click())
      const seriesSelect = Array.from(
        container.querySelectorAll<HTMLSelectElement>('#deck-editor-pool-filters select'),
      ).find((select) => Array.from(select.options).some((option) => option.value === 'BS8'))
      expect(seriesSelect).toBeTruthy()

      const selectSetter = Object.getOwnPropertyDescriptor(
        window.HTMLSelectElement.prototype,
        'value',
      )!.set!
      await act(() => {
        selectSetter.call(seriesSelect, 'BS8')
        seriesSelect!.dispatchEvent(new Event('change', { bubbles: true }))
      })

      const filteredNumbers = Array.from(
        container.querySelectorAll<HTMLButtonElement>('.deck-editor-page-pool-card-button'),
      ).map((button) => button.title)
      expect(filteredNumbers.some((cardNumber) => cardNumber.startsWith('BS8-002'))).toBe(true)
      expect(filteredNumbers.every((cardNumber) => cardNumber.startsWith('BS8-'))).toBe(true)
      expect(filteredNumbers.some((cardNumber) => cardNumber.startsWith('BS8-043'))).toBe(true)

      const importButton = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find((button) =>
        button.textContent?.includes('匯入 JSON'),
      )
      await act(() => importButton!.click())

      const payload = {
        id: 'candidate-import',
        name: 'BS8 候選匯入',
        entries: OFFICIAL_RED_STARTER_DECK.map((entry, index) =>
          index === 0 ? { cardNumber: 'BS8-002', count: entry.count } : entry,
        ),
        candidateStaging: {
          kind: 'bs8-candidate-staging',
          extraDeckEntries: [
            { cardNumber: 'BS8-005', count: 4 },
            { cardNumber: 'BS8-027', count: 2 },
          ],
        },
      }
      const textarea = container.querySelector<HTMLTextAreaElement>('[aria-label="牌組 JSON"]')
      const textareaSetter = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype,
        'value',
      )!.set!
      await act(() => {
        textareaSetter.call(textarea, JSON.stringify(payload))
        textarea!.dispatchEvent(new Event('input', { bubbles: true }))
      })
      const confirmImport = Array.from(
        container.querySelectorAll<HTMLButtonElement>('[data-testid="deck-editor-import-modal"] button'),
      ).find((button) => button.textContent?.includes('確認匯入'))
      await act(() => confirmImport!.click())

      expect(container.querySelector('[data-testid="deck-editor-extra-count"]')?.textContent).toContain('6')
    expect(
      Array.from(container.querySelectorAll('.deck-editor-page-deck-card')).find(
        (element) => element.textContent?.includes('BS8-002'),
      )?.textContent,
    ).toContain('BS8-002')

      const exportButton = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find((button) =>
        button.textContent?.includes('匯出 JSON'),
      )
      await act(async () => exportButton!.click())
      expect(clipboardWrite).toHaveBeenCalledTimes(1)
      expect(JSON.parse(clipboardWrite.mock.calls[0][0])).toMatchObject({
        name: 'BS8 候選匯入',
        candidateStaging: {
          kind: 'bs8-candidate-staging',
          extraDeckEntries: [
            { cardNumber: 'BS8-005', count: 4 },
            { cardNumber: 'BS8-027', count: 2 },
          ],
        },
      })
    } finally {
      if (previousClipboard) {
        Object.defineProperty(window.navigator, 'clipboard', previousClipboard)
      } else {
        Reflect.deleteProperty(window.navigator, 'clipboard')
      }
      await act(() => root.unmount())
    }
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
