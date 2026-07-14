/// @vitest-environment jsdom

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createItemUsageDemoState, type GameState } from '../game'
import type { DispatchGameCommand } from './useBattleActions'
import { useOnlinePendingEffect } from './useOnlinePendingEffect'

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

describe('useOnlinePendingEffect', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('clears completed effect history after the pending effect resolves', async () => {
    vi.useFakeTimers()
    const baseGame = createItemUsageDemoState(true)
    const sourceCard = baseGame.players['player-one'].battleArea[0].card
    const activeGame: GameState = {
      ...baseGame,
      pendingAbilityEffect: {
        playerId: 'player-one',
        sourcePlayerId: 'player-one',
        sourceInstanceId: sourceCard.instanceId,
        sourceCardName: sourceCard.name,
        sourceKind: 'skill',
        effects: [{ kind: 'draw', amount: 1 }],
        effectIndex: 0,
      },
    }
    const dispatch = vi.fn<DispatchGameCommand>()
    let captured: ReturnType<typeof useOnlinePendingEffect> | null = null

    function TestHarness({ game }: { game: GameState }) {
      captured = useOnlinePendingEffect({
        game,
        viewerPlayerId: 'player-one',
        dispatch,
        hasFaint: false,
        hasAfterDamage: false,
      })
      return null
    }

    const container = document.createElement('div')
    const root = createRoot(container)
    await act(() => root.render(<TestHarness game={activeGame} />))

    await act(() => captured!.confirmEffect())
    expect(captured!.effectHistory).toHaveLength(1)

    const resolvedGame: GameState = {
      ...activeGame,
      pendingAbilityEffect: undefined,
    }
    await act(() => root.render(<TestHarness game={resolvedGame} />))
    await act(() => vi.advanceTimersByTime(1000))

    expect(captured!.effectHistory).toEqual([])
    await act(() => root.unmount())
  })

  it('requires and submits a legal target for opponent-battle-to-trash OnPlay effects', async () => {
    const baseGame = createItemUsageDemoState(true)
    const sourceCard = baseGame.players['player-one'].battleArea[0].card
    const targetCard = baseGame.players['player-two'].battleArea[0].card
    const game: GameState = {
      ...baseGame,
      pendingAbilityEffect: {
        playerId: 'player-one',
        sourcePlayerId: 'player-one',
        sourceInstanceId: sourceCard.instanceId,
        sourceCardName: sourceCard.name,
        sourceKind: 'skill',
        trigger: 'on-play',
        effects: [{ kind: 'opponent-battle-to-trash', maxLevel: targetCard.level }],
        effectIndex: 0,
      },
    }
    const dispatch = vi.fn<DispatchGameCommand>()
    let captured: ReturnType<typeof useOnlinePendingEffect> | null = null

    function TestHarness() {
      captured = useOnlinePendingEffect({
        game,
        viewerPlayerId: 'player-one',
        dispatch,
        hasFaint: false,
        hasAfterDamage: false,
      })
      return null
    }

    const container = document.createElement('div')
    const root = createRoot(container)
    await act(() => root.render(<TestHarness />))

    expect(captured!.candidateCards.map((card) => card.instanceId)).toEqual([
      targetCard.instanceId,
    ])
    await act(() => captured!.toggleTarget(targetCard.instanceId))
    await act(() => captured!.confirmEffect())

    expect(dispatch).toHaveBeenCalledWith(
      {
        kind: 'resolve-ability-effect',
        playerId: 'player-one',
        targetIds: [targetCard.instanceId],
      },
      expect.any(String),
    )
    await act(() => root.unmount())
  })

  it('requires the player to choose the OnPlay discard cost before starting BS2-069-style effects', async () => {
    const baseGame = createItemUsageDemoState(true)
    const originalSource = baseGame.players['player-one'].battleArea[0]
    const sourceCard = {
      ...originalSource.card,
      skill: {
        trigger: 'on-play' as const,
        oncePerTurn: false,
        yourTurn: false,
        restSource: false,
        cost: { energy: {}, discardHand: 1 },
        text: 'Discard 1 card. Place up to 1 opponent LV.1 Cookie into trash.',
        effects: [{ kind: 'opponent-battle-to-trash' as const, maxLevel: 1 }],
      },
    }
    const game: GameState = {
      ...baseGame,
      players: {
        ...baseGame.players,
        'player-one': {
          ...baseGame.players['player-one'],
          battleArea: [{ ...originalSource, card: sourceCard }],
        },
      },
      pendingOnPlay: {
        playerId: 'player-one',
        sourceInstanceId: sourceCard.instanceId,
      },
    }
    const discardCard = game.players['player-one'].hand[0]
    const dispatch = vi.fn<DispatchGameCommand>()
    let captured: ReturnType<typeof useOnlinePendingEffect> | null = null

    function TestHarness() {
      captured = useOnlinePendingEffect({
        game,
        viewerPlayerId: 'player-one',
        dispatch,
        hasFaint: false,
        hasAfterDamage: false,
      })
      return null
    }

    const container = document.createElement('div')
    const root = createRoot(container)
    await act(() => root.render(<TestHarness />))
    await act(() => captured!.beginCookieSkill(sourceCard, 'on-play'))

    expect(captured!.abilityCostDraft?.selectedDiscardHandIds).toEqual([])
    expect(captured!.draftDiscardHandCandidates.map((card) => card.instanceId)).toContain(
      discardCard.instanceId,
    )
    expect(dispatch).not.toHaveBeenCalled()

    await act(() => captured!.toggleDraftDiscardHand(discardCard.instanceId))
    await act(() => captured!.confirmEffect())

    expect(dispatch).toHaveBeenCalledWith(
      {
        kind: 'begin-activate-skill',
        playerId: 'player-one',
        sourceInstanceId: sourceCard.instanceId,
        trigger: 'on-play',
        paymentIds: [],
        costSupportToTrashIds: [],
        discardHandIds: [discardCard.instanceId],
        trashBattleCookieIds: [],
      },
      expect.any(String),
    )
    await act(() => root.unmount())
  })

  it('opens an energy payment draft for ST5-007-style Activate skills', async () => {
    const baseGame = createItemUsageDemoState(true)
    const originalSource = baseGame.players['player-one'].battleArea[0]
    const sourceCard = {
      ...originalSource.card,
      energyColor: 'purple' as const,
      skill: {
        trigger: 'activate' as const,
        oncePerTurn: false,
        yourTurn: true,
        restSource: false,
        cost: { energy: { purple: 1 } },
        text: 'Choose 1 opposing Cookie or Stage and place it into trash.',
        effects: [
          {
            kind: 'field-to-trash' as const,
            target: { side: 'opponent' as const, min: 1, max: 1, maxLevel: 1 },
            allowStage: true,
          },
        ],
      },
    }
    const paymentCard = {
      ...baseGame.players['player-one'].supportArea[0].card,
      energyColor: 'purple' as const,
    }
    const game: GameState = {
      ...baseGame,
      players: {
        ...baseGame.players,
        'player-one': {
          ...baseGame.players['player-one'],
          battleArea: [{ ...originalSource, card: sourceCard }],
          supportArea: [{ card: paymentCard, rested: false }],
        },
      },
    }
    const dispatch = vi.fn<DispatchGameCommand>()
    let captured: ReturnType<typeof useOnlinePendingEffect> | null = null
    function TestHarness() {
      captured = useOnlinePendingEffect({
        game,
        viewerPlayerId: 'player-one',
        dispatch,
        hasFaint: false,
        hasAfterDamage: false,
      })
      return null
    }

    const root = createRoot(document.createElement('div'))
    await act(() => root.render(<TestHarness />))
    await act(() => captured!.beginCookieSkill(sourceCard, 'activate'))

    expect(captured!.abilityCostDraft?.card.instanceId).toBe(sourceCard.instanceId)
    expect(captured!.draftPaymentCandidates.map((card) => card.instanceId)).toEqual([
      paymentCard.instanceId,
    ])
    expect(dispatch).not.toHaveBeenCalled()

    await act(() => captured!.toggleDraftPayment(paymentCard.instanceId))
    expect(captured!.draftPaymentValid).toBe(true)
    await act(() => captured!.confirmEffect())

    expect(dispatch).toHaveBeenCalledWith(
      {
        kind: 'begin-activate-skill',
        playerId: 'player-one',
        sourceInstanceId: sourceCard.instanceId,
        trigger: 'activate',
        paymentIds: [paymentCard.instanceId],
        costSupportToTrashIds: [],
        discardHandIds: [],
        trashBattleCookieIds: [],
      },
      expect.any(String),
    )
    await act(() => root.unmount())
  })

  it('does not open BS2-058-style cost UI when no opposing level 3 target exists', async () => {
    const baseGame = createItemUsageDemoState(true)
    const originalSource = baseGame.players['player-one'].battleArea[0]
    const sourceCard = {
      ...originalSource.card,
      skill: {
        trigger: 'activate' as const,
        oncePerTurn: false,
        yourTurn: true,
        restSource: false,
        cost: { energy: { red: 1 } },
        text: 'Place 1 opposing LV.3 Cookie into trash.',
        effects: [
          {
            kind: 'opponent-battle-to-trash' as const,
            minLevel: 3,
            maxLevel: 3,
          },
        ],
      },
    }
    const game: GameState = {
      ...baseGame,
      players: {
        ...baseGame.players,
        'player-one': {
          ...baseGame.players['player-one'],
          battleArea: [{ ...originalSource, card: sourceCard }],
        },
      },
    }
    const dispatch = vi.fn<DispatchGameCommand>()
    let captured: ReturnType<typeof useOnlinePendingEffect> | null = null
    function TestHarness() {
      captured = useOnlinePendingEffect({
        game,
        viewerPlayerId: 'player-one',
        dispatch,
        hasFaint: false,
        hasAfterDamage: false,
      })
      return null
    }

    const root = createRoot(document.createElement('div'))
    await act(() => root.render(<TestHarness />))
    await act(() => captured!.beginCookieSkill(sourceCard, 'activate'))

    expect(captured!.abilityCostDraft).toBeNull()
    expect(dispatch).not.toHaveBeenCalled()
    await act(() => root.unmount())
  })

  it('lets BS2-077-style items select energy and a battle Cookie cost', async () => {
    const baseGame = createItemUsageDemoState(true)
    const originalBattleCookie = baseGame.players['player-one'].battleArea[0]
    const battleCookie = {
      ...originalBattleCookie.card,
      level: 1,
      energyColor: 'purple' as const,
    }
    const baseSupport = baseGame.players['player-one'].supportArea[0].card
    const supportCards = [1, 2].map((index) => ({
      ...baseSupport,
      instanceId: `purple-payment-${index}`,
      energyColor: 'purple' as const,
    }))
    const itemCard = {
      ...baseGame.players['player-one'].hand[0],
      id: 'BS2-077',
      instanceId: 'BS2-077:test',
      name: 'Forbidden Incantation',
      item: {
        cost: {
          energy: { purple: 2 },
          trashBattleCookie: { count: 1, level: 1, energyColor: 'purple' as const },
        },
        text: 'Trash a LV.1 purple Cookie. Deal 2 damage.',
        effects: [
          {
            kind: 'damage' as const,
            amount: 2,
            target: { side: 'opponent' as const, min: 0, max: 1 },
          },
        ],
      },
    }
    const game: GameState = {
      ...baseGame,
      players: {
        ...baseGame.players,
        'player-one': {
          ...baseGame.players['player-one'],
          hand: [itemCard],
          battleArea: [{ ...originalBattleCookie, card: battleCookie }],
          supportArea: supportCards.map((card) => ({ card, rested: false })),
        },
      },
    }
    const dispatch = vi.fn<DispatchGameCommand>()
    let captured: ReturnType<typeof useOnlinePendingEffect> | null = null
    function TestHarness() {
      captured = useOnlinePendingEffect({
        game,
        viewerPlayerId: 'player-one',
        dispatch,
        hasFaint: false,
        hasAfterDamage: false,
      })
      return null
    }

    const root = createRoot(document.createElement('div'))
    await act(() => root.render(<TestHarness />))
    await act(() => captured!.beginPlayItem(itemCard))

    expect(captured!.abilityCostDraft?.card.id).toBe('BS2-077')
    expect(captured!.draftTrashBattleCookieCandidates.map((card) => card.instanceId)).toEqual([
      battleCookie.instanceId,
    ])
    expect(dispatch).not.toHaveBeenCalled()

    for (const support of supportCards) {
      await act(() => captured!.toggleDraftPayment(support.instanceId))
    }
    await act(() => captured!.toggleDraftTrashBattleCookie(battleCookie.instanceId))
    await act(() => captured!.confirmEffect())

    expect(dispatch).toHaveBeenCalledWith(
      {
        kind: 'begin-play-item',
        playerId: 'player-one',
        instanceId: itemCard.instanceId,
        paymentIds: supportCards.map((card) => card.instanceId),
        supportToTrashIds: [],
        discardHandIds: [],
        trashBattleCookieIds: [battleCookie.instanceId],
      },
      expect.any(String),
    )
    await act(() => root.unmount())
  })
})
