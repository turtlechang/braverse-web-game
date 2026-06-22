import { describe, expect, it } from 'vitest'
import {
  executeCardEffect,
  isEffectConditionMet,
  resolveDrawUpTo,
  type CardEffect,
  type EffectContext,
  type GameState,
  type PlayerState,
  type GameCard,
} from '..'

const createTestPlayer = (id: 'player-one' | 'player-two'): PlayerState => ({
  id,
  name: id === 'player-one' ? 'P1' : 'P2',
  deck: [],
  hand: [],
  battleArea: [],
  supportArea: [],
  breakArea: [],
  discardPile: [],
  stage: null,
  hasMulliganed: false,
  startingCookieSelected: true,
})

const createTestGameState = (
  p1Deck: GameCard[] = [],
  p2Trash: GameCard[] = [],
): GameState => ({
  players: {
    'player-one': {
      ...createTestPlayer('player-one'),
      deck: p1Deck,
    },
    'player-two': {
      ...createTestPlayer('player-two'),
      discardPile: p2Trash,
    },
  },
  firstPlayerId: 'player-one',
  activePlayerId: 'player-one',
  turnNumber: 2,
  phase: 'main',
  status: 'playing',
  result: null,
  supportPlacedThisTurn: false,
  skillUsesThisTurn: [],
  nextBattleEntrySequence: 3,
  attackModifiers: [],
  damageReceivedModifiers: [],
  pendingReplacement: null,
  departedCookieCounts: { 'player-one': 0, 'player-two': 0 },
  pendingRefresh: null,
  pendingBattle: null,
})

const makeTrash = (count: number): GameCard[] =>
  Array.from({ length: count }, (_, i) => ({
    id: `t${i}`,
    instanceId: `t${i}`,
    name: `t${i}`,
    type: 'item' as const,
  }))

const makeDeck = (count: number): GameCard[] =>
  Array.from({ length: count }, (_, i) => ({
    id: `d${i}`,
    instanceId: `d${i}`,
    name: `d${i}`,
    type: 'item' as const,
  }))

describe('ST5-016 BONUS Coin conditional draw', () => {
  const context: EffectContext = {
    sourcePlayerId: 'player-one',
    sourceInstanceId: 'st5-016',
  }

  it('draws up to 2 when opponent trash >= 30', () => {
    let state = createTestGameState(makeDeck(5), makeTrash(30))

    const effect: CardEffect = {
      kind: 'draw-up-to',
      max: 2,
      condition: { kind: 'opponent-trash-count-at-least', count: 30 },
    }
    state = executeCardEffect(state, context, effect, [])

    expect(state.pendingDrawUpTo).toBeDefined()
    expect(state.pendingDrawUpTo?.max).toBe(2)
  })

  it('does nothing when opponent trash < 30', () => {
    const state = createTestGameState(makeDeck(5), makeTrash(19))

    const effect: CardEffect = {
      kind: 'draw-up-to',
      max: 2,
      condition: { kind: 'opponent-trash-count-at-least', count: 30 },
    }
    expect(isEffectConditionMet(state, context, effect)).toBe(false)
    expect(() => executeCardEffect(state, context, effect, [])).toThrow(
      '尚未滿足',
    )
  })

  it('does nothing when opponent trash = 29', () => {
    const state = createTestGameState(makeDeck(5), makeTrash(29))

    const effect: CardEffect = {
      kind: 'draw-up-to',
      max: 2,
      condition: { kind: 'opponent-trash-count-at-least', count: 30 },
    }
    expect(isEffectConditionMet(state, context, effect)).toBe(false)
  })

  it('draws up to 2 when opponent trash = 30 exactly', () => {
    let state = createTestGameState(makeDeck(5), makeTrash(30))

    const effect: CardEffect = {
      kind: 'draw-up-to',
      max: 2,
      condition: { kind: 'opponent-trash-count-at-least', count: 30 },
    }
    state = executeCardEffect(state, context, effect, [])

    expect(state.pendingDrawUpTo).toBeDefined()
  })

  it('resolves draw after pending', () => {
    let state = createTestGameState(makeDeck(5), makeTrash(30))

    const effect: CardEffect = {
      kind: 'draw-up-to',
      max: 2,
      condition: { kind: 'opponent-trash-count-at-least', count: 30 },
    }
    state = executeCardEffect(state, context, effect, [])
    const result = resolveDrawUpTo(state, 'player-one', 2)

    expect(result.players['player-one'].hand).toHaveLength(2)
    expect(result.pendingDrawUpTo).toBeNull()
  })

  it('applies the ST5-019 threshold to both damage and optional draw', () => {
    const state = createTestGameState(makeDeck(5), makeTrash(19))
    const condition = { kind: 'opponent-trash-count-at-least' as const, count: 20 }
    const damage: CardEffect = {
      kind: 'damage',
      amount: 1,
      target: { side: 'opponent', min: 0, max: 1 },
      condition,
    }
    const draw: CardEffect = { kind: 'draw-up-to', max: 1, condition }

    expect(isEffectConditionMet(state, context, damage)).toBe(false)
    expect(isEffectConditionMet(state, context, draw)).toBe(false)
  })

  it('keeps remaining hand order after a deterministic random discard', () => {
    const hand = ['a', 'b', 'c'].map((id) => ({
      id,
      instanceId: id,
      name: id,
      type: 'item' as const,
    }))
    const state = {
      ...createTestGameState(),
      players: {
        ...createTestGameState().players,
        'player-two': {
          ...createTestGameState().players['player-two'],
          hand,
        },
      },
    }

    const result = executeCardEffect(
      state,
      context,
      { kind: 'opponent-random-discard', count: 1 },
      [],
      (cards) => [...cards].reverse(),
    )

    expect(result.players['player-two'].discardPile.map((card) => card.instanceId)).toEqual(['c'])
    expect(result.players['player-two'].hand.map((card) => card.instanceId)).toEqual(['a', 'b'])
  })
})
