/** @vitest-environment jsdom */

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it, vi } from 'vitest'
import { createBattleState } from '../../game/test-helpers/battle-helpers'
import { OnlineBattleView } from './OnlineBattleView'

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

describe('OnlineBattleView resource inspection', () => {
  it('shows deck, stage, break, and discard information in online matches', async () => {
    const baseGame = createBattleState()
    const discardedCard = baseGame.players['player-two'].hand[0]
    const game = {
      ...baseGame,
      players: {
        ...baseGame.players,
        'player-two': {
          ...baseGame.players['player-two'],
          discardPile: [discardedCard],
        },
      },
    }
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)

    await act(() =>
      root.render(
        <OnlineBattleView
          game={game}
          viewerPlayerId="player-two"
          roomCode="TEST"
          sendCommand={vi.fn()}
          sendAttackSelection={vi.fn()}
          opponentAttackSelection={{
            attackerInstanceId: null,
            supportPaymentIds: [],
          }}
          openingSnapshot={null}
          commandRejectedReason={null}
          sendOpeningAction={vi.fn()}
          onLeave={vi.fn()}
        />,
      ),
    )

    const bottomRow = container.querySelector('.bottom-field')!
    const deckButton = bottomRow.querySelector<HTMLButtonElement>(
      '.deck-zone > .resource-summary',
    )!
    const stageButton = bottomRow.querySelector<HTMLButtonElement>(
      '.stage-zone > .resource-summary',
    )!
    const breakButton = bottomRow.querySelector<HTMLButtonElement>(
      '.break-zone > .resource-summary',
    )!
    const discardButton = bottomRow.querySelector<HTMLButtonElement>(
      '.discard-zone',
    )!

    await act(() => deckButton.click())
    expect(bottomRow.querySelector('.deck-zone .resource-popover')).not.toBeNull()

    await act(() => stageButton.click())
    expect(bottomRow.querySelector('.stage-zone .resource-popover')).not.toBeNull()

    await act(() => breakButton.click())
    expect(bottomRow.querySelector('.break-zone .resource-popover')).not.toBeNull()

    await act(() => discardButton.click())
    expect(container.querySelector('.card-pile-modal')).not.toBeNull()

    await act(() => root.unmount())
    container.remove()
  })
})
