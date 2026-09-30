/** @vitest-environment jsdom */
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'
import { MatchToolbar } from './MatchToolbar'
;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

it('supports keyboard navigation, dismissal and both toolbar actions', async () => {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  const pause = vi.fn()
  const reset = vi.fn()
  await act(() => root.render(<MatchToolbar onPause={pause} onReset={reset} />))
  const trigger = container.querySelector<HTMLButtonElement>('.match-toolbar-trigger')!
  const open = () => act(() => trigger.click())
  const key = (value: string) => act(() => document.activeElement?.dispatchEvent(new KeyboardEvent('keydown',{key:value,bubbles:true,cancelable:true})))
  await open()
  expect(document.activeElement?.getAttribute('aria-label')).toBe('暫停資訊')
  await key('ArrowDown')
  expect(document.activeElement?.getAttribute('aria-label')).toBe('重新開始')
  await key('Escape')
  expect(container.querySelector('[role="menu"]')).toBeNull()
  expect(document.activeElement).toBe(trigger)
  await open()
  await act(() => document.body.dispatchEvent(new MouseEvent('pointerdown',{bubbles:true})))
  expect(container.querySelector('[role="menu"]')).toBeNull()
  await open()
  await act(() => container.querySelector<HTMLButtonElement>('[aria-label="暫停資訊"]')!.click())
  expect(pause).toHaveBeenCalledTimes(1)
  await open()
  await act(() => container.querySelector<HTMLButtonElement>('[aria-label="重新開始"]')!.click())
  expect(reset).toHaveBeenCalledTimes(1)
  await act(() => root.unmount())
  container.remove()
})
