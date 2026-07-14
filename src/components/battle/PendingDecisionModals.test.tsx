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
