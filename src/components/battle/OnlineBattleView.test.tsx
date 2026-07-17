/** @vitest-environment jsdom */

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it, vi } from 'vitest'
import { createBattleState, item } from '../../game/test-helpers/battle-helpers'
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

  it('lets the online player click a support card while paying attack energy', async () => {
    const game = createBattleState()
    const attacker = game.players['player-two'].battleArea[0].card
    attacker.id = 'BS1-007'
    attacker.name = 'Melon Bun Cookie'
    attacker.attackCost = 3
    attacker.attackEnergyCost = { neutral: 3 }
    game.players['player-two'].supportArea = [
      { card: item('p2-support-1', 'red'), rested: false },
      { card: item('p2-support-2', 'blue'), rested: false },
      { card: item('p2-support-3', undefined), rested: false },
    ]
    const sendAttackSelection = vi.fn()
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
          sendAttackSelection={sendAttackSelection}
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

    sendAttackSelection.mockClear()
    const attackerButton = container.querySelector<HTMLButtonElement>(
      '.bottom-field .combat-card-wrap button',
    )
    expect(attackerButton).not.toBeNull()

    await act(() => attackerButton!.click())
    sendAttackSelection.mockClear()

    const supportButton = container.querySelector<HTMLButtonElement>(
      '[data-card-instance-id="p2-support-1"] button',
    )
    expect(supportButton).not.toBeNull()
    expect(supportButton!.className).toContain('is-targetable')

    await act(() => supportButton!.click())

    expect(sendAttackSelection).toHaveBeenLastCalledWith({
      attackerInstanceId: 'attacker',
      supportPaymentIds: ['p2-support-1'],
    })

    await act(() => root.unmount())
    container.remove()
  })
})
