/// @vitest-environment jsdom

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it, vi } from 'vitest'
import { createDemoGame } from '../../game'
import type {
  BattleUiMatchLike,
  BattleUiPendingEffectLike,
} from '../../hooks/battleUiContracts'
import { PendingDecisionModals } from './PendingDecisionModals'

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

const createReplacementView = (viewerPlayerId: 'player-one' | 'player-two') => {
  const baseGame = createDemoGame()
  const replacementTask = { playerId: 'player-two' as const, remaining: 1 }
  const game = {
    ...baseGame,
    pendingReplacement: { tasks: [replacementTask] },
  }
  const dispatch = vi.fn()
  const match = {
    game,
    viewerPlayerId,
    opponentId: viewerPlayerId === 'player-one' ? 'player-two' : 'player-one',
    dispatch,
    pendingPlayer: game.players['player-two'],
    pendingOptions: [game.players['player-two'].hand[0]],
    replacementTask,
  } as unknown as BattleUiMatchLike
  const pending = {
    pendingEffect: null,
    faintActive: false,
    afterDamageActive: false,
    handleOnPlayTrigger: vi.fn(),
  } satisfies BattleUiPendingEffectLike

  return { match, pending, dispatch }
}

const renderModals = async (viewerPlayerId: 'player-one' | 'player-two') => {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  const view = createReplacementView(viewerPlayerId)

  await act(() =>
    root.render(<PendingDecisionModals match={view.match} pending={view.pending} />),
  )

  return { container, root, ...view }
}

describe('PendingDecisionModals online replacement ownership', () => {
  it('shows the replacement decision to player two when player two must replace a Cookie', async () => {
    const { container, root, dispatch } = await renderModals('player-two')

    const option = container.querySelector<HTMLButtonElement>(
      '.modal-card-options button',
    )
    expect(option).toBeTruthy()

    await act(() => {
      option!.click()
    })

    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'replace-cookie',
        playerId: 'player-two',
      }),
      expect.any(String),
      expect.any(Function),
    )
    await act(() => root.unmount())
  })

  it('does not show player two replacement controls to player one', async () => {
    const { container, root } = await renderModals('player-one')

    expect(container.querySelector('.decision-modal')).toBeNull()
    await act(() => root.unmount())
  })
})

/**
 * 翻牌是公開資訊，兩邊都看得到同一張卡，但只有擁有者能確認。非擁有者若拿到
 * 一顆看起來可按的按鈕，按下去只會靜靜地什麼都不發生。
 */
describe('RevealTopDeckModal 的確認權', () => {
  const renderReveal = async (
    viewerPlayerId: 'player-one' | 'player-two',
  ) => {
    const baseGame = createDemoGame()
    const game = {
      ...baseGame,
      pendingRevealTopDeck: {
        playerId: 'player-two' as const,
        sourceInstanceId: 'source-1',
        sourceCardName: '測試卡',
        revealedCard: baseGame.players['player-two'].hand[0],
        matched: false,
        nestedEffects: [],
      },
    }
    const dispatch = vi.fn()
    const match = {
      game,
      viewerPlayerId,
      opponentId: viewerPlayerId === 'player-one' ? 'player-two' : 'player-one',
      dispatch,
    } as unknown as BattleUiMatchLike
    const pending = {
      pendingEffect: null,
      faintActive: false,
      afterDamageActive: false,
      handleOnPlayTrigger: vi.fn(),
    } satisfies BattleUiPendingEffectLike

    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    await act(() =>
      root.render(<PendingDecisionModals match={match} pending={pending} />),
    )
    return { container, root, dispatch }
  }

  it('讓擁有者按下確認並送出指令', async () => {
    const { container, root, dispatch } = await renderReveal('player-two')

    const confirm = container.querySelector<HTMLButtonElement>('.reveal-confirm')
    expect(confirm).toBeTruthy()
    expect(confirm!.disabled).toBe(false)

    await act(() => {
      confirm!.click()
    })

    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'resolve-reveal-top-deck',
        playerId: 'player-two',
      }),
      expect.any(String),
    )
    await act(() => root.unmount())
  })

  it('對手看得到翻開的卡，但確認鍵是停用的等待狀態', async () => {
    const { container, root, dispatch } = await renderReveal('player-one')

    const confirm = container.querySelector<HTMLButtonElement>('.reveal-confirm')
    expect(confirm).toBeTruthy()
    expect(confirm!.disabled).toBe(true)
    expect(confirm!.textContent).toContain('等待對手確認')

    await act(() => {
      confirm!.click()
    })

    expect(dispatch).not.toHaveBeenCalled()
    await act(() => root.unmount())
  })
})
