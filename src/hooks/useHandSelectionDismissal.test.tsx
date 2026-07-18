/// @vitest-environment jsdom

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it, vi } from 'vitest'
import { createDemoGame } from '../game'
import { useHandSelectionDismissal } from './useHandSelectionDismissal'

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

const render = async (closeResourcePopover: () => void) => {
  const hand = createDemoGame().players['player-one'].hand
  let captured: ReturnType<typeof useHandSelectionDismissal> | null = null

  function TestHarness() {
    captured = useHandSelectionDismissal(hand, closeResourcePopover)
    return null
  }

  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  await act(() => root.render(<TestHarness />))

  const cleanup = async () => {
    await act(() => root.unmount())
    container.remove()
  }

  return { hand, get: () => captured!, cleanup }
}

const dispatchPointerDown = async (target: Element) => {
  await act(() => {
    target.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }))
  })
}

const dispatchKeyDown = async (key: string) => {
  await act(() => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))
  })
}

describe('useHandSelectionDismissal', () => {
  it('starts with no selection', async () => {
    const { get, cleanup } = await render(() => undefined)

    expect(get().selectedHandCardId).toBeNull()
    expect(get().activeSelectedHandCardId).toBeNull()

    await cleanup()
  })

  it('reflects a selected card that is still in hand', async () => {
    const { hand, get, cleanup } = await render(() => undefined)

    await act(() => get().setSelectedHandCardId(hand[0].instanceId))

    expect(get().selectedHandCardId).toBe(hand[0].instanceId)
    expect(get().activeSelectedHandCardId).toBe(hand[0].instanceId)

    await cleanup()
  })

  it('treats a selected id no longer in hand as unselected', async () => {
    const { get, cleanup } = await render(() => undefined)

    await act(() => get().setSelectedHandCardId('not-in-hand'))

    expect(get().selectedHandCardId).toBe('not-in-hand')
    expect(get().activeSelectedHandCardId).toBeNull()

    await cleanup()
  })

  it('clears selection and closes the resource popover on pointerdown outside hand cards', async () => {
    const closeResourcePopover = vi.fn()
    const { hand, get, cleanup } = await render(closeResourcePopover)
    await act(() => get().setSelectedHandCardId(hand[0].instanceId))

    await dispatchPointerDown(document.body)

    expect(get().selectedHandCardId).toBeNull()
    expect(closeResourcePopover).toHaveBeenCalledTimes(1)

    await cleanup()
  })

  it('keeps selection on pointerdown inside a hand card', async () => {
    const { hand, get, cleanup } = await render(() => undefined)
    await act(() => get().setSelectedHandCardId(hand[0].instanceId))

    const handCard = document.createElement('div')
    handCard.className = 'hand-card-wrap'
    document.body.appendChild(handCard)

    await dispatchPointerDown(handCard)

    expect(get().selectedHandCardId).toBe(hand[0].instanceId)

    handCard.remove()
    await cleanup()
  })

  it('does not close the resource popover on pointerdown inside the resource dock', async () => {
    const closeResourcePopover = vi.fn()
    const { cleanup } = await render(closeResourcePopover)

    const dock = document.createElement('div')
    dock.className = 'resource-dock'
    document.body.appendChild(dock)

    await dispatchPointerDown(dock)

    expect(closeResourcePopover).not.toHaveBeenCalled()

    dock.remove()
    await cleanup()
  })

  it('clears selection and closes the resource popover on Escape', async () => {
    const closeResourcePopover = vi.fn()
    const { hand, get, cleanup } = await render(closeResourcePopover)
    await act(() => get().setSelectedHandCardId(hand[0].instanceId))

    await dispatchKeyDown('Escape')

    expect(get().selectedHandCardId).toBeNull()
    expect(closeResourcePopover).toHaveBeenCalledTimes(1)

    await cleanup()
  })

  it('ignores non-Escape keys', async () => {
    const closeResourcePopover = vi.fn()
    const { hand, get, cleanup } = await render(closeResourcePopover)
    await act(() => get().setSelectedHandCardId(hand[0].instanceId))

    await dispatchKeyDown('Enter')

    expect(get().selectedHandCardId).toBe(hand[0].instanceId)
    expect(closeResourcePopover).not.toHaveBeenCalled()

    await cleanup()
  })
})
