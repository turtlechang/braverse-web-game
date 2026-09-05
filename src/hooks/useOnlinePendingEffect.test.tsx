/// @vitest-environment jsdom

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createItemUsageDemoState,
  applyGameCommand,
  type GameState,
} from '../game'
import { createCardCheckDemoState } from '../game/demo'
import type { DispatchGameCommand } from './useBattleActions'
import { useOnlinePendingEffect } from './useOnlinePendingEffect'

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

describe('useOnlinePendingEffect', () => {
  it.each([0, 1])('BS8-047 requires the real LV3 reveal cost, then summons %i and moves the same revealed card to Break', async (summonCount) => {
    const initial = createCardCheckDemoState('BS8-047')
    const owner = initial.players['player-one']
    const source = owner.hand.find((card) => card.id === 'BS8-047')!
    const revealed = owner.hand.find((card) => card.id === 'BS8-030')!
    expect(revealed).toMatchObject({ id: 'BS8-030', type: 'cookie', level: 3 })
    const golden = owner.breakArea.find((card) => card.name === 'Golden Cheese Cookie')!
    const support = owner.supportArea.find((entry) => !entry.rested && entry.card.energyColor === 'yellow')!
    let game = initial
    const dispatch = vi.fn<DispatchGameCommand>((command) => {
      if (Array.isArray(command)) throw new Error('Expected one authoritative command')
      game = applyGameCommand(game, command)
    })
    let captured: ReturnType<typeof useOnlinePendingEffect> | null = null
    function TestHarness() {
      captured = useOnlinePendingEffect({ game, viewerPlayerId: 'player-one', dispatch, hasFaint: false, hasAfterDamage: false })
      return null
    }
    const root = createRoot(document.createElement('div'))
    await act(() => root.render(<TestHarness />))
    await act(() => captured!.beginPlayItem(source))
    expect(captured!.currentEffect).toMatchObject({ kind: 'reveal-hand', asCost: true })
    expect(captured!.candidateCards).toEqual([revealed])
    await act(() => captured!.toggleDraftPayment(support.card.instanceId))
    await act(() => captured!.confirmEffect())
    expect(dispatch).not.toHaveBeenCalled()
    expect(game).toBe(initial)
    await act(() => captured!.toggleTarget(source.instanceId))
    expect(captured!.selectedTargetIds).toEqual([])
    await act(() => captured!.toggleTarget(revealed.instanceId))
    await act(() => captured!.confirmEffect())
    expect(dispatch).toHaveBeenLastCalledWith(expect.objectContaining({
      kind: 'begin-play-item', instanceId: source.instanceId,
      paymentIds: [support.card.instanceId], targetIds: [revealed.instanceId],
    }), expect.any(String))
    expect(game.pendingAbilityEffect?.effectIndex).toBe(1)
    expect(game.costRecord?.revealedHandCardInstanceIds).toEqual([revealed.instanceId])
    expect(game.players['player-one'].hand).toContainEqual(revealed)
    expect(game.players['player-one'].discardPile).toContainEqual(source)
    expect(game.players['player-one'].supportArea.find((entry) => entry.card.instanceId === support.card.instanceId)?.rested).toBe(true)
    await act(() => root.render(<TestHarness />))
    expect(captured!.currentEffect?.kind).toBe('break-to-battle')
    expect(captured!.candidateCards).toEqual([golden])
    if (summonCount === 1) await act(() => captured!.toggleTarget(golden.instanceId))
    await act(() => captured!.confirmEffect())
    expect(game.pendingAbilityEffect?.effectIndex).toBe(2)
    await act(() => root.render(<TestHarness />))
    expect(captured!.currentEffect).toMatchObject({ kind: 'hand-to-break', revealedCardOnly: true })
    // The Then step consumes the locked reveal; it must not offer a new choice.
    expect(captured!.candidateCards).toEqual([])
    await act(() => captured!.toggleTarget(revealed.instanceId))
    expect(captured!.selectedTargetIds).toEqual([])
    await act(() => captured!.confirmEffect())
    expect(dispatch).toHaveBeenLastCalledWith(expect.objectContaining({ kind: 'resolve-ability-effect', targetIds: [] }), expect.any(String))
    expect(game.players['player-one'].hand).not.toContainEqual(revealed)
    expect(game.players['player-one'].breakArea).toContainEqual(revealed)
    expect(game.players['player-one'].battleArea.some((entry) => entry.card.instanceId === golden.instanceId)).toBe(summonCount === 1)
    expect(game.players['player-one'].breakArea.some((card) => card.instanceId === golden.instanceId)).toBe(summonCount === 0)
    expect(game.pendingAbilityEffect).toBeFalsy()
    expect(dispatch).toHaveBeenCalledTimes(3)
    await act(() => root.unmount())
  })

  it.each([0, 1])('BS8-042 offers both opponent supports and submits %i selected target', async (count) => {
    vi.useFakeTimers()
    const initial = createCardCheckDemoState('BS8-042')
    const source = initial.players['player-one'].battleArea.find((entry) => entry.card.id === 'BS8-042')!.card
    const targets = initial.players['player-two'].supportArea.map((support) => support.card.instanceId)
    const ownSupport = initial.players['player-one'].supportArea[0].card.instanceId
    let game = initial
    const dispatch = vi.fn<DispatchGameCommand>((command) => {
      if (Array.isArray(command)) throw new Error('Expected a single command')
      game = applyGameCommand(game, command)
    })
    let captured: ReturnType<typeof useOnlinePendingEffect> | null = null
    function TestHarness() {
      captured = useOnlinePendingEffect({ game, viewerPlayerId: 'player-one', dispatch, hasFaint: false, hasAfterDamage: false })
      return null
    }
    const root = createRoot(document.createElement('div'))
    await act(() => root.render(<TestHarness />))
    await act(() => captured!.beginCookieSkill(source, 'on-play'))
    expect(targets).toHaveLength(2)
    expect(captured!.candidateCards.map((card) => card.instanceId)).toEqual(targets)
    await act(() => captured!.toggleTarget(ownSupport))
    expect(captured!.selectedTargetIds).toEqual([])
    if (count === 1) await act(() => captured!.toggleTarget(targets[0]))
    await act(() => captured!.confirmEffect())
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'begin-activate-skill', sourceInstanceId: source.instanceId,
      targetIds: targets.slice(0, count),
    }), expect.any(String))
    expect(game.preventSupportActiveNextPhase?.['player-two'] ?? []).toEqual(targets.slice(0, count))
    expect(game.players['player-one'].supportArea).toEqual(initial.players['player-one'].supportArea)
    expect(game.players['player-two'].supportArea.map((support) => support.rested)).toEqual([true, false])
    expect(game.pendingOnPlay).toBeNull()
    expect(game.pendingAbilityEffect).toBeFalsy()
    await act(() => root.unmount())
  })

  it.each(['BS8-031', 'BS8-031@1'])('%s submits its legal trash cost before selecting the two Break effect targets', async (cardNumber) => {
    vi.useFakeTimers()
    const initial = createCardCheckDemoState(cardNumber)
    const sourceCard = initial.players['player-one'].hand.find((card) => card.id === 'BS8-031')!
    let game = applyGameCommand(initial, { kind: 'deploy-cookie', playerId: 'player-one', instanceId: sourceCard.instanceId })
    const player = game.players['player-one']
    const costCard = player.discardPile.find((card) => card.id === 'BS8-030')!
    const wrongLevelCard = player.discardPile.find((card) => card.instanceId !== costCard.instanceId)!
    const targets = player.breakArea.map((card) => card.instanceId)
    const dispatch = vi.fn<DispatchGameCommand>((command) => {
      if (Array.isArray(command)) throw new Error('Expected one authoritative command')
      game = applyGameCommand(game, command)
    })
    let captured: ReturnType<typeof useOnlinePendingEffect> | null = null
    function TestHarness() {
      captured = useOnlinePendingEffect({ game, viewerPlayerId: 'player-one', dispatch, hasFaint: false, hasAfterDamage: false })
      return null
    }
    const root = createRoot(document.createElement('div'))
    await act(() => root.render(<TestHarness />))
    await act(() => captured!.beginCookieSkill(sourceCard, 'on-play'))
    expect(captured!.draftTrashCookieToBreakAreaCandidates).toEqual([costCard])
    expect(captured!.draftRequiresPaymentBeforeTargets).toBe(true)
    await act(() => captured!.toggleDraftPayment(player.supportArea[0].card.instanceId))
    await act(() => captured!.toggleDraftTrashCookieToBreakArea(wrongLevelCard.instanceId))
    await act(() => captured!.confirmEffect())
    expect(captured!.selectedDraftTrashCookieToBreakAreaIds.size).toBe(0)
    expect(dispatch).not.toHaveBeenCalled()
    await act(() => captured!.toggleDraftTrashCookieToBreakArea(costCard.instanceId))
    await act(() => captured!.toggleTarget(targets[0]))
    expect(captured!.selectedTargetIds).toEqual([])
    await act(() => captured!.confirmEffect())
    expect(dispatch).toHaveBeenCalledTimes(1)
    expect(dispatch).toHaveBeenLastCalledWith(expect.objectContaining({
      kind: 'begin-activate-skill',
      trashCookieToBreakAreaIds: [costCard.instanceId],
    }), expect.any(String))
    expect(dispatch.mock.calls[0][0]).not.toHaveProperty('targetIds')
    expect(game.players['player-one'].breakArea).toContainEqual(costCard)
    expect(game.players['player-one'].supportArea[0].rested).toBe(true)
    expect(game.players['player-one'].hand).toHaveLength(player.hand.length)
    await act(() => root.render(<TestHarness />))
    expect(captured!.draftRequiresPaymentBeforeTargets).toBe(false)
    expect(captured!.pendingEffect?.skillActivated).toBe(true)
    expect(captured!.candidateCards.map((card) => card.instanceId)).toEqual([...targets, costCard.instanceId])
    expect(captured!.effectSelectionError).toBe('必須選擇 2 張休息區餅乾。')
    await act(() => captured!.confirmEffect())
    expect(dispatch).toHaveBeenCalledTimes(1)
    await act(() => captured!.toggleTarget(targets[0]))
    expect(captured!.effectSelectionValid).toBe(false)
    await act(() => captured!.confirmEffect())
    expect(dispatch).toHaveBeenCalledTimes(1)
    await act(() => captured!.toggleTarget(costCard.instanceId))
    expect(captured!.effectSelectionError).toBe('選擇的餅乾等級總和不得超過 3。')
    await act(() => captured!.confirmEffect())
    expect(dispatch).toHaveBeenCalledTimes(1)
    await act(() => captured!.toggleTarget(costCard.instanceId))
    await act(() => captured!.toggleTarget(targets[1]))
    expect(captured!.effectSelectionError).toBeNull()
    await act(() => captured!.confirmEffect())
    expect(dispatch).toHaveBeenLastCalledWith(expect.objectContaining({ kind: 'resolve-ability-effect', targetIds: targets }), expect.any(String))
    expect(game.players['player-one'].breakArea).toEqual([costCard])
    expect(game.players['player-one'].hand).toHaveLength(player.hand.length + 2)
    await act(() => root.unmount())
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it.each(['BS8-035', 'BS8-038'])('%s exposes only post-cost legal Break-to-trash candidates', async (cardNumber) => {
    const initial = createCardCheckDemoState(cardNumber)
    const source = initial.players['player-one'].hand.find((card) => card.id === cardNumber)!
    const deployed = applyGameCommand(initial, { kind: 'deploy-cookie', playerId: 'player-one', instanceId: source.instanceId })
    const owner = deployed.players['player-one']
    const cost = cardNumber === 'BS8-035'
      ? owner.discardPile.find((card) => card.type === 'cookie' && card.level === 2)!
      : owner.hand.find((card) => card.type === 'cookie' && card.level === 3)!
    let game = applyGameCommand(deployed, {
      kind: 'begin-activate-skill', playerId: 'player-one', sourceInstanceId: source.instanceId,
      trigger: 'on-play', paymentIds: [],
      ...(cardNumber === 'BS8-035' ? { trashCookieToBreakAreaIds: [cost.instanceId] } : { handToBreakAreaIds: [cost.instanceId] }),
    })
    const level = cardNumber === 'BS8-035' ? 2 : 1
    const expectedCandidates = game.players['player-one'].breakArea.filter((card) => card.level === level)
    const illegal = game.players['player-one'].breakArea.find((card) => card.level !== level)!
    const target = expectedCandidates[0]
    const dispatch = vi.fn<DispatchGameCommand>((command) => {
      if (Array.isArray(command)) throw new Error('Expected a single command')
      game = applyGameCommand(game, command)
    })
    let captured: ReturnType<typeof useOnlinePendingEffect> | null = null
    function TestHarness() {
      captured = useOnlinePendingEffect({ game, viewerPlayerId: 'player-one', dispatch, hasFaint: false, hasAfterDamage: false })
      return null
    }
    const root = createRoot(document.createElement('div'))
    await act(() => root.render(<TestHarness />))
    expect(expectedCandidates).toHaveLength(2)
    expect(captured!.candidateCards).toEqual(expectedCandidates)
    expect(captured!.effectSelectionValid).toBe(true)
    await act(() => captured!.toggleTarget(illegal.instanceId))
    expect(captured!.selectedTargetIds).toEqual([])
    await act(() => captured!.toggleTarget(target.instanceId))
    expect(captured!.selectedTargetIds).toEqual([target.instanceId])
    await act(() => captured!.confirmEffect())
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ kind: 'resolve-ability-effect', targetIds: [target.instanceId] }), expect.any(String))
    expect(game.players['player-one'].discardPile).toContainEqual(target)
    expect(game.players['player-one'].breakArea).toContainEqual(illegal)
    await act(() => root.unmount())
  })

  it('uses core hand-to-Break candidates and submits that cost separately from discard costs', async () => {
    vi.useFakeTimers()
    const initial = createCardCheckDemoState('BS8-031')
    const sourceCard = initial.players['player-one'].hand.find((card) => card.id === 'BS8-031')!
    const deployed = applyGameCommand(initial, { kind: 'deploy-cookie', playerId: 'player-one', instanceId: sourceCard.instanceId })
    const original = deployed.players['player-one'].battleArea.find((cookie) => cookie.card.instanceId === sourceCard.instanceId)!
    const costCard = deployed.players['player-one'].discardPile.find((card) => card.id === 'BS8-030')!
    const wrongLevelCard = deployed.players['player-one'].discardPile.find((card) => card.instanceId !== costCard.instanceId)!
    const source = { ...original.card, skill: { ...original.card.skill!, cost: { energy: {}, handToBreakArea: { count: 1, minLevel: 3, maxLevel: 3 } }, effects: [{ kind: 'draw' as const, amount: 1 }] } }
    let game: GameState = { ...deployed, players: { ...deployed.players, 'player-one': {
      ...deployed.players['player-one'], hand: [wrongLevelCard, costCard], discardPile: [],
      battleArea: [{ ...original, card: source }],
    } } }
    const dispatch = vi.fn<DispatchGameCommand>((command) => {
      if (Array.isArray(command)) throw new Error('Expected one authoritative command')
      game = applyGameCommand(game, command)
    })
    let captured: ReturnType<typeof useOnlinePendingEffect> | null = null
    function TestHarness() {
      captured = useOnlinePendingEffect({ game, viewerPlayerId: 'player-one', dispatch, hasFaint: false, hasAfterDamage: false })
      return null
    }
    const root = createRoot(document.createElement('div'))
    await act(() => root.render(<TestHarness />))
    await act(() => captured!.beginCookieSkill(source, 'on-play'))
    expect(captured!.draftHandToBreakAreaCandidates).toEqual([costCard])
    await act(() => captured!.toggleDraftHandToBreakArea(wrongLevelCard.instanceId))
    await act(() => captured!.confirmEffect())
    expect(dispatch).not.toHaveBeenCalled()
    await act(() => captured!.toggleDraftHandToBreakArea(costCard.instanceId))
    await act(() => captured!.confirmEffect())
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'begin-activate-skill', handToBreakAreaIds: [costCard.instanceId], discardHandIds: [],
    }), expect.any(String))
    expect(game.players['player-one'].hand).toEqual([wrongLevelCard])
    expect(game.players['player-one'].breakArea).toContainEqual(costCard)
    expect(game.players['player-one'].discardPile).toEqual([])
    await act(() => root.unmount())
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
