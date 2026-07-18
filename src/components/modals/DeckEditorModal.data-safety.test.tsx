/// @vitest-environment jsdom

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { DeckEditorModal } from './DeckEditorModal'
import type { CustomDeck } from '../../game/custom-deck'
import { OFFICIAL_RED_STARTER_DECK } from '../../game/starter-deck'

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

const render = async (
  initialDeck: CustomDeck | undefined,
  onSave: (deck: CustomDeck) => void,
  onClose: () => void,
) => {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  await act(() =>
    root.render(
      <DeckEditorModal
        initialDeck={initialDeck}
        onSave={onSave}
        onClose={onClose}
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

const setTextareaValue = async (
  textarea: HTMLTextAreaElement | null | undefined,
  value: string,
) => {
  expect(textarea).toBeTruthy()
  const nativeSetter = Object.getOwnPropertyDescriptor(
    window.HTMLTextAreaElement.prototype,
    'value',
  )!.set!
  await act(() => {
    nativeSetter.call(textarea, value)
    textarea!.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

let confirmSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  confirmSpy = vi.spyOn(window, 'confirm')
})

afterEach(() => {
  confirmSpy.mockRestore()
})

describe('DeckEditorModal data safety', () => {
  it('keeps the save button disabled while the deck is empty', async () => {
    const { container, cleanup } = await render(undefined, () => undefined, () => undefined)

    const saveBtn = container.querySelector<HTMLButtonElement>(
      '.deck-editor-save-btn',
    )
    expect(saveBtn?.disabled).toBe(true)

    await cleanup()
  })

  it('allows saving an incomplete deck as a draft once it has at least one card', async () => {
    const savedDecks: CustomDeck[] = []
    const { container, cleanup } = await render(
      undefined,
      (deck) => savedDecks.push(deck),
      () => undefined,
    )

    await click(container.querySelector('.deck-editor-pool-card-btn'))

    const saveBtn = container.querySelector<HTMLButtonElement>(
      '.deck-editor-save-btn',
    )
    expect(saveBtn?.disabled).toBe(false)
    expect(saveBtn?.classList.contains('is-draft')).toBe(true)
    expect(saveBtn?.textContent).toContain('儲存草稿')

    await click(saveBtn)
    expect(savedDecks).toHaveLength(1)
    expect(savedDecks[0].entries.reduce((sum, e) => sum + e.count, 0)).toBe(1)

    await cleanup()
  })

  it('closes without a confirmation prompt when nothing changed', async () => {
    let closed = false
    const { container, cleanup } = await render(
      undefined,
      () => undefined,
      () => {
        closed = true
      },
    )

    await click(container.querySelector('.close-modal'))

    expect(confirmSpy).not.toHaveBeenCalled()
    expect(closed).toBe(true)

    await cleanup()
  })

  it('asks for confirmation before closing with unsaved changes, and respects cancel', async () => {
    let closed = false
    const { container, cleanup } = await render(
      undefined,
      () => undefined,
      () => {
        closed = true
      },
    )

    await click(container.querySelector('.deck-editor-pool-card-btn'))

    confirmSpy.mockReturnValue(false)
    await click(container.querySelector('.close-modal'))
    expect(confirmSpy).toHaveBeenCalledTimes(1)
    expect(closed).toBe(false)

    confirmSpy.mockReturnValue(true)
    await click(container.querySelector('.close-modal'))
    expect(closed).toBe(true)

    await cleanup()
  })

  it('asks for confirmation before clearing a deck with unsaved changes', async () => {
    const { container, cleanup } = await render(
      undefined,
      () => undefined,
      () => undefined,
    )

    await click(container.querySelector('.deck-editor-pool-card-btn'))
    expect(container.querySelectorAll('.deck-editor-deck-entry')).toHaveLength(1)

    confirmSpy.mockReturnValue(false)
    await click(container.querySelector('.deck-editor-clear-btn'))
    expect(confirmSpy).toHaveBeenCalledTimes(1)
    expect(container.querySelectorAll('.deck-editor-deck-entry')).toHaveLength(1)

    confirmSpy.mockReturnValue(true)
    await click(container.querySelector('.deck-editor-clear-btn'))
    expect(container.querySelectorAll('.deck-editor-deck-entry')).toHaveLength(0)

    await cleanup()
  })

  it('asks for confirmation before an import overwrites unsaved changes', async () => {
    const { container, cleanup } = await render(
      undefined,
      () => undefined,
      () => undefined,
    )

    await click(container.querySelector('.deck-editor-pool-card-btn'))
    expect(container.querySelectorAll('.deck-editor-deck-entry')).toHaveLength(1)

    const ioButtons = Array.from(
      container.querySelectorAll('.deck-editor-io-btn'),
    )
    const importOpenBtn = ioButtons.find((btn) =>
      btn.textContent?.includes('匯入'),
    )
    await click(importOpenBtn)

    const importJson = JSON.stringify({
      name: '紅色 Starter 匯入',
      entries: OFFICIAL_RED_STARTER_DECK,
    })
    await setTextareaValue(
      container.querySelector('.deck-editor-import-textarea'),
      importJson,
    )

    confirmSpy.mockReturnValue(false)
    await click(container.querySelector('.deck-editor-import-confirm'))
    expect(confirmSpy).toHaveBeenCalledTimes(1)
    expect(container.querySelector('.deck-editor-import-overlay')).not.toBeNull()
    expect(container.querySelectorAll('.deck-editor-deck-entry')).toHaveLength(1)

    confirmSpy.mockReturnValue(true)
    await click(container.querySelector('.deck-editor-import-confirm'))
    expect(container.querySelector('.deck-editor-import-overlay')).toBeNull()
    expect(
      container.querySelectorAll('.deck-editor-deck-entry').length,
    ).toBe(OFFICIAL_RED_STARTER_DECK.length)

    await cleanup()
  })
})
