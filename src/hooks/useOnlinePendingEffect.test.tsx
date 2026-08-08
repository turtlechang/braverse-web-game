/// @vitest-environment jsdom

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createItemUsageDemoState,
  type GameState,
} from '../game'
import { createCardCheckDemoState } from '../game/demo'
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

  it('keeps the ST4-017 source card image after the item moves to discard and ignores duplicate confirms', async () => {
    const baseGame = createItemUsageDemoState(true)
    const targetCard = baseGame.players['player-one'].battleArea[0].card
    const sourceCard = {
      ...baseGame.players['player-one'].hand[0],
      id: 'ST4-017',
      instanceId: 'ST4-017:test',
      name: 'Emergency Lifebuoy',
      imageUrl: '/cards/ST4-017.webp',
      item: {
        cost: {},
        text: 'Return 1 LV.1 Cookie from your battle area to your hand.',
        effects: [
          {
            kind: 'return-to-hand' as const,
            target: { side: 'self' as const, min: 1, max: 1, maxLevel: 1 },
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
          hand: baseGame.players['player-one'].hand.filter(
            (card) => card.instanceId !== sourceCard.instanceId,
          ),
          discardPile: [sourceCard],
        },
      },
      pendingAbilityEffect: {
        playerId: 'player-one',
        sourcePlayerId: 'player-one',
        sourceInstanceId: sourceCard.instanceId,
        sourceCardName: sourceCard.name,
        sourceKind: 'item',
        effects: sourceCard.item.effects,
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

    const root = createRoot(document.createElement('div'))
    await act(() => root.render(<TestHarness />))

    expect(captured!.pendingEffect?.sourceCard).toMatchObject({
      id: 'ST4-017',
      name: 'Emergency Lifebuoy',
      imageUrl: '/cards/ST4-017.webp',
    })

    await act(() => captured!.toggleTarget(targetCard.instanceId))
    await act(() => {
      captured!.confirmEffect()
      captured!.confirmEffect()
    })

    expect(dispatch).toHaveBeenCalledTimes(1)
    expect(dispatch).toHaveBeenCalledWith(
      {
        kind: 'resolve-ability-effect',
        playerId: 'player-one',
        targetIds: [targetCard.instanceId],
      },
      expect.any(String),
    )
    expect(captured!.effectHistory).toHaveLength(1)
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
    const targetCard = game.players['player-two'].battleArea[0].card
    expect(captured!.candidateCards.map((card) => card.instanceId)).toContain(
      targetCard.instanceId,
    )
    await act(() => captured!.toggleTarget(targetCard.instanceId))
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
        targetIds: [targetCard.instanceId],
      },
      expect.any(String),
    )
    await act(() => root.unmount())
  })

  it('opens a cancelable confirmation draft for no-cost OnPlay Cookie skills', async () => {
    vi.useFakeTimers()
    const baseGame = createItemUsageDemoState(true)
    const originalSource = baseGame.players['player-one'].battleArea[0]
    const sourceCard = {
      ...originalSource.card,
      id: 'BS2-061',
      name: 'Hydrangea Cookie',
      skill: {
        trigger: 'on-play' as const,
        oncePerTurn: false,
        yourTurn: false,
        restSource: false,
        cost: { energy: {} },
        text: 'Return up to 3 non-FLIP cards from trash to the deck.',
        effects: [{ kind: 'trash-to-deck' as const, max: 3, excludeFlip: true }],
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
    await act(() => captured!.beginCookieSkill(sourceCard, 'on-play'))

    expect(captured!.abilityCostDraft?.trigger).toBe('on-play')
    expect(captured!.draftPaymentValid).toBe(true)
    expect(dispatch).not.toHaveBeenCalled()

    await act(() => captured!.skipOnPlay(sourceCard.instanceId))
    expect(captured!.abilityCostDraft).toBeNull()
    expect(dispatch).toHaveBeenCalledWith(
      {
        kind: 'skip-on-play',
        playerId: 'player-one',
        sourceInstanceId: sourceCard.instanceId,
      },
      expect.any(String),
    )

    dispatch.mockClear()
    await act(() => captured!.beginCookieSkill(sourceCard, 'on-play'))
    await act(() => captured!.confirmEffect())
    expect(dispatch).toHaveBeenCalledWith(
      {
        kind: 'begin-activate-skill',
        playerId: 'player-one',
        sourceInstanceId: sourceCard.instanceId,
        trigger: 'on-play',
        paymentIds: [],
        costSupportToTrashIds: [],
        discardHandIds: [],
        trashBattleCookieIds: [],
        targetIds: [],
      },
      expect.any(String),
    )
    await act(() => root.unmount())
  })

  it('lets BS2-061 select up to 3 non-FLIP cards from trash online', async () => {
    const baseGame = createItemUsageDemoState(true)
    const sourceCard = baseGame.players['player-one'].battleArea[0].card
    const baseDiscardCard = baseGame.players['player-one'].hand[0]
    const candidates = [1, 2, 3, 4].map((index) => ({
      ...baseDiscardCard,
      instanceId: `trash-card-${index}`,
      name: `Trash Card ${index}`,
    }))
    const flipCard = {
      ...baseDiscardCard,
      instanceId: 'trash-flip-card',
      name: 'Trash FLIP Card',
      officialType: 'flip' as const,
      flip: {
        text: 'Draw 1 card.',
        cost: { energy: {} },
        effects: [{ kind: 'draw' as const, amount: 1 }],
      },
    }
    const game: GameState = {
      ...baseGame,
      players: {
        ...baseGame.players,
        'player-one': {
          ...baseGame.players['player-one'],
          discardPile: [...candidates, flipCard],
        },
      },
      pendingAbilityEffect: {
        playerId: 'player-one',
        sourcePlayerId: 'player-one',
        sourceInstanceId: sourceCard.instanceId,
        sourceCardName: 'Hydrangea Cookie',
        sourceKind: 'skill',
        trigger: 'on-play',
        effects: [{ kind: 'trash-to-deck', max: 3, excludeFlip: true }],
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

    const root = createRoot(document.createElement('div'))
    await act(() => root.render(<TestHarness />))

    expect(captured!.candidateCards.map((card) => card.instanceId)).toEqual(
      candidates.map((card) => card.instanceId),
    )
    for (const card of candidates) {
      await act(() => captured!.toggleTarget(card.instanceId))
    }
    expect(captured!.selectedTargetIds).toEqual(
      candidates.slice(0, 3).map((card) => card.instanceId),
    )

    await act(() => captured!.confirmEffect())
    expect(dispatch).toHaveBeenCalledWith(
      {
        kind: 'resolve-ability-effect',
        playerId: 'player-one',
        targetIds: candidates.slice(0, 3).map((card) => card.instanceId),
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
    const targetCard = captured!.candidateCards[0]
    expect(targetCard).toBeDefined()
    await act(() => captured!.toggleTarget(targetCard.instanceId))
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
        targetIds: [targetCard.instanceId],
      },
      expect.any(String),
    )
    await act(() => root.unmount())
  })

  it('offers a target picker for BS1-052-style Activate skills that gain HP on a chosen Cookie', async () => {
    const baseGame = createItemUsageDemoState(true)
    const originalSource = baseGame.players['player-one'].battleArea[0]
    const sourceCard = {
      ...originalSource.card,
      energyColor: 'yellow' as const,
      skill: {
        trigger: 'activate' as const,
        oncePerTurn: false,
        yourTurn: true,
        restSource: true,
        cost: { energy: { yellow: 2 } },
        text: 'Select 1 of your Cookies. That Cookie gains +1 HP.',
        effects: [
          {
            kind: 'gain-hp' as const,
            amount: 1,
            target: { side: 'self' as const, min: 1, max: 1 },
          },
        ],
      },
    }
    const basePaymentCard = baseGame.players['player-one'].supportArea[0].card
    const paymentCards = [
      { ...basePaymentCard, energyColor: 'yellow' as const },
      {
        ...basePaymentCard,
        instanceId: 'pay-2',
        id: 'pay-2',
        energyColor: 'yellow' as const,
      },
    ]
    const game: GameState = {
      ...baseGame,
      players: {
        ...baseGame.players,
        'player-one': {
          ...baseGame.players['player-one'],
          battleArea: [{ ...originalSource, card: sourceCard }],
          supportArea: paymentCards.map((card) => ({ card, rested: false })),
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
    await act(() =>
      paymentCards.forEach((card) => captured!.toggleDraftPayment(card.instanceId)),
    )
    expect(captured!.draftPaymentValid).toBe(true)

    expect(captured!.candidateCards.map((card) => card.instanceId)).toEqual([
      sourceCard.instanceId,
    ])

    await act(() => captured!.toggleTarget(sourceCard.instanceId))
    await act(() => captured!.confirmEffect())

    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'begin-activate-skill',
        sourceInstanceId: sourceCard.instanceId,
        targetIds: [sourceCard.instanceId],
      }),
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
        targetIds: [],
      },
      expect.any(String),
    )
    await act(() => root.unmount())
  })

  it('keeps BS4-062 payment, extra supports, and opponent target in separate groups', async () => {
    const baseGame = createCardCheckDemoState('BS4-062')
    const baseSupport = baseGame.players['player-one'].supportArea[0].card
    const supports = Array.from({ length: 8 }, (_, index) => ({
      ...baseSupport,
      instanceId: `wind-gems-online-support-${index + 1}`,
      energyColor: 'green' as const,
    }))
    const game: GameState = {
      ...baseGame,
      players: {
        ...baseGame.players,
        'player-one': {
          ...baseGame.players['player-one'],
          supportArea: supports.map((card) => ({ card, rested: false })),
        },
      },
    }
    const itemCard = game.players['player-one'].hand.find(
      (card) => card.id === 'BS4-062',
    )!
    const targetId =
      game.players['player-two'].battleArea[0].card.instanceId
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

    for (const support of supports.slice(0, 2)) {
      await act(() => captured!.toggleDraftPayment(support.instanceId))
    }
    expect(captured!.draftPaymentValid).toBe(true)
    expect(
      captured!.restSupportAndDamageSupportCandidates.map(
        (card) => card.instanceId,
      ),
    ).toEqual(supports.slice(2).map((card) => card.instanceId))
    expect(
      captured!.restSupportAndDamageTargetCandidates.map(
        (card) => card.instanceId,
      ),
    ).toContain(targetId)

    for (const support of supports.slice(2, 7)) {
      await act(() => captured!.toggleTarget(support.instanceId))
    }
    await act(() => captured!.toggleTarget(targetId))
    expect(captured!.selectedTargetIds).toEqual([
      ...supports.slice(2, 6).map((card) => card.instanceId),
      targetId,
    ])

    await act(() => captured!.confirmEffect())
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'begin-play-item',
        instanceId: itemCard.instanceId,
        paymentIds: supports.slice(0, 2).map((card) => card.instanceId),
        targetIds: [
          ...supports.slice(2, 6).map((card) => card.instanceId),
          targetId,
        ],
      }),
      expect.any(String),
    )

    await act(() => root.unmount())
  })
})
