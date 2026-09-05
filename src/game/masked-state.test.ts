import { describe, expect, it } from 'vitest'
import { applyGameCommand, createGame, OFFICIAL_RED_STARTER_DECK } from '.'
import { maskGameStateForViewer } from './masked-state'
import type { CookieCard, GameCard, GameState } from './types'
import { RoomStore, maskedStateFor, openingSnapshotFor } from '../../server/src/rooms'
import { getCookieEffectiveHp } from './helpers'

const identityShuffle = (cards: GameCard[]) => [...cards]

const createCookie = (instanceId: string): CookieCard => ({
  id: `cookie-${instanceId}`,
  instanceId,
  name: `餅乾 ${instanceId}`,
  type: 'cookie',
  level: 1,
  hp: 3,
  attack: 1,
  attackCost: 0,
})

const createItem = (instanceId: string): GameCard => ({
  id: `item-${instanceId}`,
  instanceId,
  name: `道具 ${instanceId}`,
  type: 'item',
})

const createDeck = (prefix: string, starter: CookieCard): GameCard[] => [
  starter,
  ...Array.from({ length: 59 }, (_, index) =>
    index % 10 === 0
      ? createCookie(`${prefix}-cookie-${index}`)
      : createItem(`${prefix}-item-${index}`),
  ),
]

const createPlayingGame = () => {
  let state = createGame(
    {
      id: 'player-one',
      name: '玩家一',
      deck: createDeck('one', createCookie('one-starter')),
    },
    {
      id: 'player-two',
      name: '玩家二',
      deck: createDeck('two', createCookie('two-starter')),
    },
    'player-one',
    identityShuffle,
  )
  state = applyGameCommand(state, {
    kind: 'select-starting-cookie',
    playerId: 'player-one',
    instanceId: 'one-starter',
  })
  state = applyGameCommand(state, {
    kind: 'select-starting-cookie',
    playerId: 'player-two',
    instanceId: 'two-starter',
  })
  return state
}

describe('maskGameStateForViewer', () => {
  it('does not expose unrevealed FLIP effects through the public HP total', () => {
    const state = createPlayingGame()
    const target = state.players['player-one'].battleArea[0]
    target.hpCards[1] = {
      ...createItem('private-bonus'),
      flip: { text: 'Private attached bonus', cost: { energy: {}, discardHand: 0 }, effects: [], attachedHpBonus: 1 },
    }
    expect(getCookieEffectiveHp(target)).toBe(3)
    for (const viewer of ['player-one', 'player-two'] as const) {
      const view = maskGameStateForViewer(state, viewer)
      const masked = view.players['player-one'].battleArea[0]
      expect(getCookieEffectiveHp(masked)).toBe(3)
      expect(masked.hpCards).toHaveLength(3)
      expect(masked.hpCards.every((card) => card.flip === undefined && card.id === 'hidden')).toBe(true)
      expect(JSON.stringify(view)).not.toContain('private-bonus')
      expect(getCookieEffectiveHp(maskGameStateForViewer(view, viewer).players['player-one'].battleArea[0])).toBe(3)
    }
  })
  it('保留 viewer 自己的手牌，但自己牌庫與 HP 也只提供張數', () => {
    const state = createPlayingGame()
    const masked = maskGameStateForViewer(state, 'player-one')

    expect(masked.players['player-one'].hand).toEqual(
      state.players['player-one'].hand,
    )
    expect(masked.players['player-one'].deck).toHaveLength(state.players['player-one'].deck.length)
    expect(masked.players['player-one'].deck.every((card) => card.id === 'hidden')).toBe(true)
    expect(masked.players['player-one'].battleArea[0].hpCards.every((card) => card.id === 'hidden')).toBe(true)
    expect(state.players['player-one'].deck.every((card) => card.id !== 'hidden')).toBe(true)
  })

  it('遮罩對手的手牌/牌庫內容,但長度不變', () => {
    const state = createPlayingGame()
    const masked = maskGameStateForViewer(state, 'player-one')
    const opponentHand = masked.players['player-two'].hand
    const realOpponentHand = state.players['player-two'].hand

    expect(opponentHand).toHaveLength(realOpponentHand.length)
    expect(opponentHand.every((card) => card.name === '???')).toBe(true)
    expect(
      opponentHand.some((card, index) =>
        realOpponentHand[index] &&
        card.instanceId === realOpponentHand[index].instanceId,
      ),
    ).toBe(false)

    const opponentDeck = masked.players['player-two'].deck
    const realOpponentDeck = state.players['player-two'].deck
    expect(opponentDeck).toHaveLength(realOpponentDeck.length)
    expect(opponentDeck.every((card) => card.name === '???')).toBe(true)
  })

  it('戰鬥區餅乾本體維持原樣(含真實 instanceId),但隱藏中的 HP 卡被遮罩', () => {
    const state = createPlayingGame()
    const masked = maskGameStateForViewer(state, 'player-one')

    const realOpponentCookie = state.players['player-two'].battleArea[0]
    const maskedOpponentCookie = masked.players['player-two'].battleArea[0]

    expect(maskedOpponentCookie.card).toEqual(realOpponentCookie.card)
    expect(maskedOpponentCookie.hpCards).toHaveLength(
      realOpponentCookie.hpCards.length,
    )
    expect(maskedOpponentCookie.hpCards.every((c) => c.name === '???')).toBe(
      true,
    )
  })

  it('支援區/破損區/棄牌區/場景區維持原樣', () => {
    const state = createPlayingGame()
    const masked = maskGameStateForViewer(state, 'player-one')

    expect(masked.players['player-two'].supportArea).toEqual(
      state.players['player-two'].supportArea,
    )
    expect(masked.players['player-two'].breakArea).toEqual(
      state.players['player-two'].breakArea,
    )
    expect(masked.players['player-two'].discardPile).toEqual(
      state.players['player-two'].discardPile,
    )
    expect(masked.players['player-two'].stage).toEqual(
      state.players['player-two'].stage,
    )
  })

  it('pendingInspectDeck 屬於對手時遮罩 revealedCards,屬於 viewer 自己時保留原樣', () => {
    const state = createPlayingGame()
    const revealed = [createItem('revealed-1'), createItem('revealed-2')]

    const stateWithOpponentInspect = {
      ...state,
      pendingInspectDeck: {
        playerId: 'player-two' as const,
        sourceInstanceId: 'two-starter',
        sourceCardName: '餅乾 two-starter',
        revealedCards: revealed,
        lookCount: 2,
        pickCount: 1,
      },
    }
    const maskedForOpponentInspect = maskGameStateForViewer(
      stateWithOpponentInspect,
      'player-one',
    )
    expect(
      maskedForOpponentInspect.pendingInspectDeck?.revealedCards.every(
        (c) => c.name === '???',
      ),
    ).toBe(true)

    const stateWithOwnInspect = {
      ...state,
      pendingInspectDeck: {
        playerId: 'player-one' as const,
        sourceInstanceId: 'one-starter',
        sourceCardName: '餅乾 one-starter',
        revealedCards: revealed,
        lookCount: 2,
        pickCount: 1,
      },
    }
    const maskedForOwnInspect = maskGameStateForViewer(
      stateWithOwnInspect,
      'player-one',
    )
    expect(maskedForOwnInspect.pendingInspectDeck?.revealedCards).toEqual(
      revealed,
    )
    expect(maskedForOwnInspect.players['player-one'].deck.every((card) => card.id === 'hidden')).toBe(true)
  })

  it('HP 重排只授權決策玩家查看已選定的卡堆，完成後恢復遮罩', () => {
    const state = createPlayingGame()
    const target = state.players['player-one'].battleArea[0]
    state.players['player-one'].battleArea.push({
      ...target,
      card: createCookie('unselected-cookie'),
      hpCards: [createItem('unselected-private-hp')],
    })
    state.pendingAbilityEffect = {
      playerId: 'player-one', sourcePlayerId: 'player-one',
      sourceInstanceId: target.card.instanceId, sourceKind: 'skill',
      effects: [{ kind: 'reorder-hp', target: { side: 'self', min: 0, max: 1 } }],
      effectIndex: 0,
    }
    const awaiting = applyGameCommand(state, {
      kind: 'resolve-ability-effect', playerId: 'player-one', targetIds: [target.card.instanceId],
    })
    const ownView = maskGameStateForViewer(awaiting, 'player-one')
    const otherView = maskGameStateForViewer(awaiting, 'player-two')
    expect(ownView.players['player-one'].battleArea[0].hpCards).toEqual(target.hpCards)
    expect(ownView.players['player-one'].battleArea[1].hpCards[0].id).toBe('hidden')
    expect(otherView.players['player-one'].battleArea[0].hpCards.every((card) => card.id === 'hidden')).toBe(true)
    const finished = applyGameCommand(awaiting, {
      kind: 'resolve-reorder-hp', playerId: 'player-one', orderedCardIds: target.hpCards.map((card) => card.instanceId).reverse(),
    })
    expect(maskGameStateForViewer(finished, 'player-one').players['player-one'].battleArea[0].hpCards.every((card) => card.id === 'hidden')).toBe(true)
    expect(maskGameStateForViewer(finished, 'player-two').commandLog?.at(-1)?.payload).not.toHaveProperty('orderedCardIds')
    expect(finished.commandLog?.at(-1)?.payload).toHaveProperty('orderedCardIds')
  })

  it('真實 RoomStore 開局後的雙方快照均遮罩牌庫及 HP，保留手牌供後續操作', () => {
    const store = new RoomStore()
    const deck = { id: 'mask-room', name: 'Mask Room', entries: OFFICIAL_RED_STARTER_DECK, createdAt: '', updatedAt: '' }
    const room = store.createRoom(deck, () => {})
    store.joinRoom(room.code, deck, () => {}, 42)
    store.submitOpeningAction(room, 'player-one', { kind: 'rps', choice: 'rock' })
    store.submitOpeningAction(room, 'player-two', { kind: 'rps', choice: 'scissors' })
    store.submitOpeningAction(room, 'player-one', { kind: 'choose-order', goFirst: true })
    for (let step = 0; room.status === 'opening' && step < 30; step++) {
      const opening = openingSnapshotFor(room, 'player-one')!
      if (opening.stage === 'mulligan') store.submitOpeningAction(room, opening.actorId!, { kind: 'mulligan', replaceAll: false })
      else if (opening.stage === 'forced-mulligan') store.submitOpeningAction(room, opening.actorId!, { kind: 'force-mulligan' })
      else if (opening.stage === 'compensation') store.submitOpeningAction(room, opening.actorId!, { kind: 'mulligan-compensation', draw: false })
      else if (opening.stage === 'starting-cookie') {
        for (const playerId of ['player-one', 'player-two'] as const) {
          const card = room.state!.players[playerId].hand.find((candidate) => candidate.type === 'cookie')!
          store.submitOpeningAction(room, playerId, { kind: 'starting-cookie', instanceId: card.instanceId })
        }
      } else throw new Error(`Unexpected opening stage: ${opening.stage}`)
    }
    expect(room.status).toBe('in-progress')
    for (const viewerId of ['player-one', 'player-two'] as const) {
      const view = maskedStateFor(room, viewerId)!
      expect(view.players[viewerId].hand).toEqual(room.state!.players[viewerId].hand)
      for (const player of Object.values(view.players)) {
        expect(player.deck.every((card) => card.id === 'hidden')).toBe(true)
        expect(player.battleArea.flatMap((cookie) => cookie.hpCards).every((card) => card.id === 'hidden')).toBe(true)
      }
    }
  })

  it('合法 HP 查看提供私密結果快照；相同來源再次查看有新序號且不開放底層 HP', () => {
    const state = createPlayingGame()
    const target = state.players['player-one'].battleArea[0]
    const beginInspection = (current: GameState): GameState => ({
      ...current,
      pendingAbilityEffect: {
        playerId: 'player-one', sourcePlayerId: 'player-one',
        sourceInstanceId: target.card.instanceId, sourceKind: 'skill',
        effects: [{ kind: 'view-hp', target: { side: 'self', min: 0, max: 1 } }],
        effectIndex: 0,
      },
    })
    const store = new RoomStore()
    const deck = { id: 'inspection-room', name: 'Inspection', entries: OFFICIAL_RED_STARTER_DECK, createdAt: '', updatedAt: '' }
    const room = store.createRoom(deck, () => {})
    room.status = 'in-progress'
    room.state = beginInspection(state)
    const command = { kind: 'resolve-ability-effect', playerId: 'player-one', targetIds: [target.card.instanceId] } as const
    store.applyCommand(room, 'player-one', { ...command, targetIds: [...command.targetIds] })
    const first = maskedStateFor(room, 'player-one')!
    expect(first.hpInspectionResults?.['player-one']).toEqual({
      sequence: 1, sourceInstanceId: target.card.instanceId,
      piles: [{ targetInstanceId: target.card.instanceId, targetCardName: target.card.name, cards: target.hpCards }],
    })
    expect(first.players['player-one'].battleArea[0].hpCards.every((card) => card.id === 'hidden')).toBe(true)
    expect(maskedStateFor(room, 'player-two')).not.toHaveProperty('hpInspectionResults')
    expect(JSON.stringify(maskedStateFor(room, 'player-two'))).not.toContain(target.hpCards[0].instanceId)
    expect(JSON.stringify(first.commandLog)).not.toContain(target.hpCards[0].instanceId)

    store.applyCommand(room, 'player-one', { kind: 'advance-phase', playerId: 'player-one' })
    expect(maskedStateFor(room, 'player-one')!.hpInspectionResults).toEqual(first.hpInspectionResults)
    const changed: GameState = {
      ...room.state!,
      players: {
        ...room.state!.players,
        'player-one': {
          ...room.state!.players['player-one'],
          battleArea: [{ ...target, hpCards: [...target.hpCards, createItem('new-private-hp')] }],
        },
      },
    }
    room.state = changed
    expect(maskedStateFor(room, 'player-one')!.hpInspectionResults?.['player-one']?.piles[0].cards).toEqual(target.hpCards)
    expect(maskedStateFor(room, 'player-one')!.players['player-one'].battleArea[0].hpCards.at(-1)?.id).toBe('hidden')
    room.state = beginInspection(changed)
    store.applyCommand(room, 'player-one', { ...command, targetIds: [...command.targetIds] })
    expect(maskedStateFor(room, 'player-one')!.hpInspectionResults?.['player-one']?.sequence).toBe(2)
    expect(maskedStateFor(room, 'player-two')).not.toHaveProperty('hpInspectionResults')
  })
})
