/// @vitest-environment jsdom

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GameErrorBoundary } from './GameErrorBoundary'

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

afterEach(() => {
  vi.restoreAllMocks()
})

describe('GameErrorBoundary', () => {
  it('renders its children when no render error occurs', async () => {
    const container = document.createElement('div')
    const root = createRoot(container)

    await act(() =>
      root.render(
        <GameErrorBoundary>
          <span>遊戲正常</span>
        </GameErrorBoundary>,
      ),
    )

    expect(container.textContent).toContain('遊戲正常')
    await act(() => root.unmount())
  })

  it('shows a recovery message when a child throws during render', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})

    function BrokenGame(): never {
      throw new Error('render failed')
    }

    const container = document.createElement('div')
    const root = createRoot(container)
    await act(() =>
      root.render(
        <GameErrorBoundary>
          <BrokenGame />
        </GameErrorBoundary>,
      ),
    )

    expect(container.textContent).toContain('遊戲畫面發生錯誤')
    expect(container.querySelector('button')?.textContent).toBe('重新載入遊戲')
    await act(() => root.unmount())
  })
})
