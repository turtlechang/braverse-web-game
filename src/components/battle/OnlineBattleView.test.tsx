/** @vitest-environment jsdom */

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it, vi } from 'vitest'
import { createBattleState, item } from '../../game/test-helpers/battle-helpers'
import { OnlineBattleView } from './OnlineBattleView'
import { applyGameCommand } from '../../game/commands'
import { createCardCheckDemoState } from '../../game/demo'

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

describe('OnlineBattleView resource inspection', () => {
  it('offers OnPlay decline without a second cancel action and sends no payment when declined', async () => {
    let game = createCardCheckDemoState('BS8-031')
    const source = game.players['player-one'].hand.find(card => card.id === 'BS8-031')!
    game = applyGameCommand(game, { kind: 'deploy-cookie', playerId: 'player-one', instanceId: source.instanceId })
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    const sendCommand = vi.fn()
    try {
      await act(() => root.render(
        <OnlineBattleView game={game} viewerPlayerId="player-one" roomCode="TEST"
          sendCommand={sendCommand} sendAttackSelection={vi.fn()}
          opponentAttackSelection={{ attackerInstanceId: null, supportPaymentIds: [] }}
          openingSnapshot={null} commandRejectedReason={null}
          sendOpeningAction={vi.fn()} onLeave={vi.fn()} />,
      ))
      await act(async () => { await new Promise(resolve => setTimeout(resolve, 10)) })
      const panel = container.querySelector('.effect-panel')!
      expect(panel).not.toBeNull()
      expect(Array.from(panel.querySelectorAll('button')).some(button => button.textContent?.trim() === '取消技能')).toBe(false)
      const decline = panel.querySelector<HTMLButtonElement>('button.skip-effect:has(.effect-skip-label)')!
      expect(decline.textContent).toContain('略過整個登場效果')
      await act(() => decline.click())
      expect(sendCommand).toHaveBeenCalledExactlyOnceWith({ kind: 'skip-on-play', playerId: 'player-one', sourceInstanceId: source.instanceId })
      expect(game.players['player-one'].supportArea.every(support => !support.rested)).toBe(true)
    } finally {
      await act(() => root.unmount())
      container.remove()
    }
  })

  it('blocks phase advancement during an Item Then decision and unlocks after declining', async () => {
    let game = createCardCheckDemoState('BS8-021')
    const card = game.players['player-one'].hand.find(card => card.id === 'BS8-021')!
    game = applyGameCommand(game, { kind: 'begin-play-item', playerId: 'player-one',
      instanceId: card.instanceId, paymentIds: ['support-pay-0', 'support-pay-1'] })
    for (let step = 0; step < 2; step++) {
      game = applyGameCommand(game, { kind: 'resolve-ability-effect', playerId: 'player-one', targetIds: [] })
    }
    expect(game.pendingOptionalCostAttack).toMatchObject({ resolution: 'ability' })
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    const sendCommand = vi.fn()
    const render = () => act(() => root.render(
      <OnlineBattleView game={game} viewerPlayerId="player-one" roomCode="TEST"
        sendCommand={sendCommand} sendAttackSelection={vi.fn()}
        opponentAttackSelection={{ attackerInstanceId: null, supportPaymentIds: [] }}
        openingSnapshot={null} commandRejectedReason={null}
        sendOpeningAction={vi.fn()} onLeave={vi.fn()} />,
    ))
    const phaseButton = () => Array.from(container.querySelectorAll('button')).find(
      button => button.textContent?.trim() === '結束主要階段',
    )!
    try {
      await render()
      expect(phaseButton()).toBeDefined()
      expect(phaseButton().disabled).toBe(true)
      await act(() => phaseButton().click())
      expect(sendCommand).not.toHaveBeenCalled()
      expect(container.textContent).toContain('Then 可選效果')
      expect(container.textContent).not.toContain('技能 Then 可選效果')
      game = applyGameCommand(game, { kind: 'resolve-optional-cost-attack', playerId: 'player-one', action: 'skip' })
      await render()
      expect(phaseButton().disabled).toBe(false)
    } finally {
      await act(() => root.unmount())
      container.remove()
    }
  })

  it('lets an online player review the command log after the match ends', async () => {
    const game = createBattleState()
    game.status = 'finished'
    game.result = {
      winnerId: 'player-two',
      loserId: 'player-one',
      reason: 'special-victory',
    }
    game.commandLog = [
      {
        id: 1,
        turnNumber: 2,
        phase: 'main',
        playerId: 'player-two',
        commandKind: 'attack',
        payload: {},
        summary: '攻擊已完成。',
      },
    ]
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

    const reviewButton = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent?.includes('查看對戰紀錄'),
    )
    expect(reviewButton).not.toBeUndefined()

    await act(() => reviewButton!.click())
    expect(container.querySelector('[data-testid="battle-log-review-modal"]')).not.toBeNull()
    expect(container.textContent).toContain('攻擊已完成。')

    const closeButton = container.querySelector<HTMLButtonElement>(
      '[aria-label="關閉對戰紀錄回顧"]',
    )
    expect(closeButton).not.toBeNull()
    await act(() => closeButton!.click())
    expect(container.querySelector('[data-testid="battle-log-review-modal"]')).toBeNull()
    expect(container.querySelector('.result-modal')).not.toBeNull()

    await act(() => root.unmount())
    container.remove()
  })

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
