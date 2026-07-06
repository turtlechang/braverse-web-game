import { describe, expect, it } from 'vitest'
import { applyGameCommand, createGame } from '.'
import { maskGameStateForViewer } from './masked-state'
import type { CookieCard, GameCard } from './types'

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
  it('保留 viewer 自己的手牌/牌庫內容不變', () => {
    const state = createPlayingGame()
    const masked = maskGameStateForViewer(state, 'player-one')

    expect(masked.players['player-one'].hand).toEqual(
      state.players['player-one'].hand,
    )
    expect(masked.players['player-one'].deck).toEqual(
      state.players['player-one'].deck,
    )
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
  })
})
