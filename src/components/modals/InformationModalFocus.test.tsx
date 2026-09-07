/// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it, vi } from 'vitest'
import { CardDetailModal, PauseModal } from './GameModals'

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

describe('dismissible information dialog keyboard interaction', () => {
  it.each([false, true])('focuses Continue, wraps Tab, and restores the toolbar (menu removed: %s)', async (menuRemoved) => {
    const host = document.createElement('div')
    const trigger = document.createElement('button')
    trigger.textContent = '暫停'
    trigger.className = 'match-toolbar-trigger'
    const content = document.createElement('div')
    host.append(trigger, content)
    document.body.append(host)
    trigger.focus()
    if (menuRemoved) {
      const menuItem = document.createElement('button')
      host.append(menuItem)
      menuItem.focus()
      menuItem.remove()
    }
    const root = createRoot(content)
    const resume = vi.fn()
    await act(() => root.render(<PauseModal turnNumber={2} phaseLabel="主要階段" deckConfig={{ player: 'red', ai: 'red' }} aiActionCount={0} onRunSimulation={() => {}} onResume={resume} />))
    const buttons = Array.from(content.querySelectorAll('button'))
    expect(document.activeElement?.textContent).toBe('繼續對戰')
    expect(trigger.inert).toBe(true)
    document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }))
    expect(document.activeElement).toBe(buttons[0])
    document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true }))
    expect(document.activeElement).toBe(buttons.at(-1))
    await act(() => document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })))
    expect(resume).toHaveBeenCalledTimes(1)
    await act(() => root.unmount())
    expect(trigger.inert).not.toBe(true)
    expect(document.activeElement).toBe(trigger)
    host.remove()
  })

  it('gives card details a name and closes with Escape without firing its card action', async () => {
    const content = document.createElement('div')
    document.body.append(content)
    const root = createRoot(content)
    const close = vi.fn()
    await act(() => root.render(<CardDetailModal card={{ id: 'BS8-001', instanceId: 'detail', name: 'Licorice Cookie', type: 'cookie', level: 2, hp: 2, attack: 2, attackCost: 2 }} onClose={close} />))
    expect(content.querySelector('[role="dialog"]')?.getAttribute('aria-label')).toBe('Licorice Cookie 卡牌詳情')
    expect(document.activeElement?.getAttribute('title')).toBe('關閉')
    await act(() => document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })))
    expect(close).toHaveBeenCalledTimes(1)
    await act(() => root.unmount())
    content.remove()
  })
})
