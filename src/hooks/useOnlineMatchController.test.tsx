/// @vitest-environment jsdom

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { skipTrap, type GameCard, type GameCommand } from '../game'
import {
  createBattleState,
  declareAttack,
  item,
} from '../game/test-helpers/battle-helpers'
import { useOnlineMatchController } from './useOnlineMatchController'

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

describe('useOnlineMatchController', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('automatically resolves each pending damage step for the defending player', async () => {
    vi.useFakeTimers()
    const game = skipTrap(declareAttack(createBattleState()), 'player-one')
    const sendCommand = vi.fn<(command: GameCommand) => void>()

    function TestHarness() {
      useOnlineMatchController({
        game,
        viewerPlayerId: 'player-one',
        sendCommand,
      })
      return null
    }

    const container = document.createElement('div')
    const root = createRoot(container)
    await act(() => root.render(<TestHarness />))
    await act(() => vi.advanceTimersByTime(500))

    expect(sendCommand).toHaveBeenCalledWith({
      kind: 'resolve-next-damage',
      playerId: 'player-one',
    })
    await act(() => root.unmount())
  })

  it('exposes legal online BS2-079 payment and trash-to-deck selections', async () => {
    const trap: GameCard = {
      id: 'BS2-079',
      instanceId: 'bs2-079-online',
      name: 'Yew Village Scroll',
      type: 'trap',
      trap: {
        text: 'Choose up to 5 non-FLIP cards in your trash and shuffle them into your deck.',
        cost: { energy: { purple: 1 }, discardHand: 0 },
        effects: [
          {
            kind: 'modify-attack',
            amount: -1,
            duration: 'this-turn',
            target: { side: 'opponent', min: 0, max: 1 },
          },
          { kind: 'trash-to-deck', max: 5, excludeFlip: true },
        ],
      },
    }
    let game = createBattleState()
    game.players['player-one'].hand = [trap, ...game.players['player-one'].hand]
    game.players['player-one'].supportArea = [
      { card: item('purple-support', 'purple'), rested: false },
      { card: item('red-support', 'red'), rested: false },
    ]
    const trashCards = Array.from({ length: 6 }, (_, index) =>
      item(`trash-${index + 1}`),
    )
    const flipTrash: GameCard = {
      ...item('flip-trash'),
      flip: { text: 'FLIP', cost: { energy: {} }, effects: [] },
    }
    game.players['player-one'].discardPile = [...trashCards, flipTrash]
    game = declareAttack(game)

    const sendCommand = vi.fn<(command: GameCommand) => void>()
    let latest: ReturnType<typeof useOnlineMatchController> | undefined

    function TestHarness() {
      latest = useOnlineMatchController({
        game,
        viewerPlayerId: 'player-one',
        sendCommand,
      })
      return null
    }

    const container = document.createElement('div')
    const root = createRoot(container)
    await act(() => root.render(<TestHarness />))
    await act(() => latest!.setSelectedTrapId(trap.instanceId))

    expect(latest!.trapEnergyCostTotal).toBe(1)
    expect(
      latest!.trapPaymentCandidates.map((support) => support.card.instanceId),
    ).toEqual(['purple-support'])
    expect(latest!.trapTrashToDeckAmount).toBe(5)
    expect(latest!.trapTrashToDeckCandidates.map((card) => card.instanceId)).toEqual(
      trashCards.map((card) => card.instanceId),
    )

    await act(() => latest!.toggleTrapPayment('red-support'))
    expect(latest!.selectedTrapPaymentIds).toEqual([])
    await act(() => latest!.toggleTrapPayment('purple-support'))
    expect(latest!.selectedTrapPaymentIds).toEqual(['purple-support'])
    expect(latest!.trapPaymentValid).toBe(true)

    for (const card of trashCards) {
      await act(() => latest!.toggleTrapTrashToDeck(card.instanceId))
    }
    expect(latest!.selectedTrapTrashToDeckIds).toEqual(
      trashCards.slice(0, 5).map((card) => card.instanceId),
    )
    await act(() => latest!.toggleTrapTrashToDeck(flipTrash.instanceId))
    expect(latest!.selectedTrapTrashToDeckIds).toEqual(
      trashCards.slice(0, 5).map((card) => card.instanceId),
    )

    await act(() => root.unmount())
  })

  it('offers BS2-021-style support-to-hand and hand-to-support follow-up selections online', async () => {
    const trap: GameCard = {
      id: 'BS2-021',
      instanceId: 'bs2-021-online',
      name: 'Carrot Farm Scarecrow',
      type: 'trap',
      trap: {
        text:
          "Select up to 1 of your opponent's Cookies. During this turn, that Cookie deals -1 attack damage. Then, return 1 card from your support area to your hand. If you did, place 1 card from your hand into your support area as rested.",
        cost: { energy: { green: 1 } },
        effects: [
          {
            kind: 'modify-attack',
            amount: -1,
            duration: 'this-turn',
            target: { side: 'opponent', min: 0, max: 1 },
          },
          { kind: 'support-to-hand', amount: 1 },
          { kind: 'hand-to-support', amount: 1 },
        ],
      },
    }
    let game = createBattleState()
    game.players['player-one'].hand = [trap, ...game.players['player-one'].hand]
    game.players['player-one'].supportArea = [
      { card: item('green-support', 'green'), rested: false },
      { card: item('returnable-support', 'red'), rested: false },
    ]
    game = declareAttack(game)

    const sendCommand = vi.fn<(command: GameCommand) => void>()
    let latest: ReturnType<typeof useOnlineMatchController> | undefined

    function TestHarness() {
      latest = useOnlineMatchController({
        game,
        viewerPlayerId: 'player-one',
        sendCommand,
      })
      return null
    }

    const container = document.createElement('div')
    const root = createRoot(container)
    await act(() => root.render(<TestHarness />))
    await act(() => latest!.setSelectedTrapId(trap.instanceId))

    expect(latest!.trapSupportToHandAmount).toBe(1)
    expect(
      latest!.trapSupportToHandCandidates.map((card) => card.instanceId),
    ).toEqual(['green-support', 'returnable-support'])
    expect(latest!.trapHandToSupportAmount).toBe(1)

    await act(() => latest!.toggleTrapSupportToHand('returnable-support'))
    expect(latest!.selectedTrapSupportToHandIds).toEqual(['returnable-support'])

    expect(
      latest!.trapHandToSupportCandidates.map((card) => card.instanceId),
    ).toEqual(
      expect.arrayContaining(
        game.players['player-one'].hand
          .filter((card) => card.instanceId !== trap.instanceId)
          .map((card) => card.instanceId),
      ),
    )

    const handToSupportTarget = latest!.trapHandToSupportCandidates[0]
    await act(() => latest!.toggleTrapHandToSupport(handToSupportTarget.instanceId))
    expect(latest!.selectedTrapHandToSupportIds).toEqual([
      handToSupportTarget.instanceId,
    ])

    await act(() => root.unmount())
  })
})
