/// @vitest-environment jsdom

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GameErrorBoundary } from './GameErrorBoundary'
import {
  registerIssueBundleProvider,
  resetIssueBundleProviderForTest,
} from '../../hooks/issueBundleSource'
import { buildReplayIssueBundle } from '../../game'
import { createBattleState } from '../../game/test-helpers/battle-helpers'

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

afterEach(() => {
  vi.restoreAllMocks()
  resetIssueBundleProviderForTest()
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

  it('offers 複製問題包 when a provider is registered, embedding the crash message', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText } })

    registerIssueBundleProvider((errorSummary) =>
      buildReplayIssueBundle({
        state: createBattleState(),
        mode: 'offline',
        viewerId: 'player-one',
        decks: { playerOne: 'test', playerTwo: 'test' },
        errorSummary,
      }),
    )

    function BrokenGame(): never {
      throw new Error('boom from battle render')
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

    const copyButton = [...container.querySelectorAll('button')].find(
      (button) => button.textContent === '複製問題包',
    )
    expect(copyButton).toBeDefined()

    await act(() => {
      copyButton!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    // 等 clipboard promise resolve 後的 setState
    await act(async () => {})

    expect(writeText).toHaveBeenCalledTimes(1)
    const copiedJson = writeText.mock.calls[0][0] as string
    const parsed = JSON.parse(copiedJson) as {
      bundleVersion: number
      errorSummary: string
    }
    expect(parsed.bundleVersion).toBe(1)
    // 崩潰訊息要進到問題包的 errorSummary
    expect(parsed.errorSummary).toBe('boom from battle render')
    expect(container.textContent).toContain('已複製問題包')

    await act(() => root.unmount())
  })

  it('hides the copy button when no provider is registered (e.g. menu crash)', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})

    function BrokenMenu(): never {
      throw new Error('menu render failed')
    }

    const container = document.createElement('div')
    const root = createRoot(container)
    await act(() =>
      root.render(
        <GameErrorBoundary>
          <BrokenMenu />
        </GameErrorBoundary>,
      ),
    )

    expect(container.textContent).toContain('遊戲畫面發生錯誤')
    expect(
      [...container.querySelectorAll('button')].some(
        (button) => button.textContent === '複製問題包',
      ),
    ).toBe(false)

    await act(() => root.unmount())
  })
})
