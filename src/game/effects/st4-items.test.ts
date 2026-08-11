import { describe, expect, it } from 'vitest'
import {
  canPlayItem,
  executeCardEffect,
  getEffectTargetCandidates,
  resolveDrawUpTo,
  takeAiStep,
  type CardEffect,
  type CookieCard,
  type CookieInBattle,
  type EffectContext,
  type GameCard,
  type GameState,
  type PlayerState,
} from '..'
import { GameRuleError } from '../errors'
import { getEffectTargetCandidatesForEffect } from './targeting'

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

const createTestCookie = (
  instanceId: string,
  level: number,
  hp: number,
  energyColor: GameCard['energyColor'] = 'red',
): CookieCard => ({
  id: instanceId,
  instanceId,
  name: instanceId,
  type: 'cookie',
  officialType: 'cookie',
  level,
  hp,
  attack: 1,
  attackCost: 1,
  attackEnergyCost: { red: 1 },
  energyColor,
})

const createHpCards = (
  prefix: string,
  count: number,
  energyColor: GameCard['energyColor'] = 'red',
): GameCard[] =>
  Array.from({ length: count }, (_, i) => ({
    id: `${prefix}-${i}`,
    instanceId: `${prefix}-${i}`,
    name: `${prefix}-${i}`,
    type: 'item' as const,
    energyColor,
  }))

const createBattleCookie = (
  instanceId: string,
  level: number,
  hp: number,
  energyColor: GameCard['energyColor'] = 'red',
): CookieInBattle => ({
  card: createTestCookie(instanceId, level, hp, energyColor),
  hpCards: createHpCards(`${instanceId}-hp`, hp, energyColor),
  rested: false,
  battleEntryId: `${instanceId}:battle:1`,
})

const createTestGameState = (
  p1Battle: CookieInBattle[] = [],
  p2Battle: CookieInBattle[] = [],
  p1Hand: GameCard[] = [],
  p1Deck: GameCard[] = [],
): GameState => ({
  players: {
    'player-one': {
      ...createTestPlayer('player-one'),
      battleArea: p1Battle,
      hand: p1Hand,
      deck: p1Deck,
    },
    'player-two': {
      ...createTestPlayer('player-two'),
      battleArea: p2Battle,
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

describe('ST4-016 Bear Jelly Ice Cream', () => {
  const context: EffectContext = {
    sourcePlayerId: 'player-one',
    sourceInstanceId: 'st4-016',
  }

  const returnToHandEffect: CardEffect = {
    kind: 'return-to-hand',
    target: {
      side: 'self',
      min: 1,
      max: 1,
      energyColor: 'blue',
      minRemainingHp: 3,
    },
  }

  it('returns selected blue cookie with 3+ HP to hand', () => {
    const blueCookie = createBattleCookie('blue-1', 2, 4, 'blue')
    const redCookie = createBattleCookie('red-1', 1, 2, 'red')
    let state = createTestGameState([blueCookie, redCookie])

    state = executeCardEffect(
      state,
      context,
      returnToHandEffect,
      ['blue-1'],
    )

    const p1 = state.players['player-one']
    expect(p1.battleArea).toHaveLength(1)
    expect(p1.battleArea[0].card.instanceId).toBe('red-1')
    expect(p1.hand.some((c) => c.instanceId === 'blue-1')).toBe(true)
    expect(
      p1.deck.some((c) => c.instanceId === 'blue-1'),
    ).toBe(false)
  })

  it('does not offer a return-to-hand target that would empty the battle area', () => {
    const onlyCookie = createBattleCookie('only-cookie', 1, 3, 'blue')
    const state = createTestGameState([onlyCookie])

    expect(
      getEffectTargetCandidatesForEffect(state, context, returnToHandEffect),
    ).toEqual([])
  })

  it('rejects non-blue cookies from candidates', () => {
    const redCookie = createBattleCookie('red-1', 2, 5, 'red')
    const state = createTestGameState([redCookie])

    const candidates = getEffectTargetCandidates(state, context, {
      side: 'self',
      min: 1,
      max: 1,
      energyColor: 'blue',
      minRemainingHp: 3,
    })

    expect(candidates).toHaveLength(0)
  })

  it('rejects blue cookies with HP < 3', () => {
    const blueCookie = createBattleCookie('blue-low', 2, 2, 'blue')
    const state = createTestGameState([blueCookie])

    const candidates = getEffectTargetCandidates(state, context, {
      side: 'self',
      min: 1,
      max: 1,
      energyColor: 'blue',
      minRemainingHp: 3,
    })

    expect(candidates).toHaveLength(0)
  })

  it('returns unchanged state when no valid targets', () => {
    const redCookie = createBattleCookie('red-1', 2, 5, 'red')
    const state = createTestGameState([redCookie])

    const result = executeCardEffect(state, context, returnToHandEffect, [])

    expect(result.players['player-one'].battleArea).toHaveLength(1)
    expect(result.players['player-one'].hand).toHaveLength(0)
  })

  it('moves HP cards to discard without creating a replacement prompt', () => {
    const opponentCookie = createBattleCookie('opp-1', 1, 2, 'red')
    const blueCookie = createBattleCookie('blue-1', 2, 4, 'blue')
    const retainedCookie = createBattleCookie('blue-2', 1, 2, 'blue')
    let state = createTestGameState(
      [blueCookie, retainedCookie],
      [opponentCookie],
    )

    state = executeCardEffect(state, context, returnToHandEffect, ['blue-1'])

    expect(state.status).toBe('playing')
    const p1 = state.players['player-one']
    expect(p1.battleArea).toHaveLength(1)
    expect(p1.hand.some((c) => c.instanceId === 'blue-1')).toBe(true)
    expect(p1.discardPile.some((c) => c.instanceId === 'blue-1-hp-0')).toBe(true)
    expect(p1.discardPile.some((c) => c.instanceId === 'blue-1-hp-1')).toBe(true)
    expect(p1.discardPile.some((c) => c.instanceId === 'blue-1-hp-2')).toBe(true)
    expect(p1.discardPile.some((c) => c.instanceId === 'blue-1-hp-3')).toBe(true)
    expect(state.departedCookieCounts['player-one']).toBe(0)
    expect(state.pendingReplacement).toBeNull()
  })

  it('rejects returning the last cookie in the battle area', () => {
    const blueCookie = createBattleCookie('blue-only', 2, 4, 'blue')
    const item: GameCard = {
      id: 'st4-016',
      instanceId: 'st4-016',
      name: 'Bear Jelly Ice Cream',
      type: 'item',
      item: {
        cost: { blue: 2 },
        text: 'Return 1 blue Cookie to your hand.',
        effects: [returnToHandEffect],
      },
    }
    const state = createTestGameState([blueCookie], [], [item])

    expect(canPlayItem(state, 'player-one', item.instanceId)).toBe(false)
    expect(() =>
      executeCardEffect(state, context, returnToHandEffect, ['blue-only']),
    ).toThrow(GameRuleError)
  })

  it('throws when selectedTargetIds exceeds max (1)', () => {
    const blue1 = createBattleCookie('blue-1', 2, 4, 'blue')
    const blue2 = createBattleCookie('blue-2', 2, 4, 'blue')
    const state = createTestGameState([blue1, blue2])

    expect(() =>
      executeCardEffect(state, context, returnToHandEffect, ['blue-1', 'blue-2']),
    ).toThrow(GameRuleError)
  })
})

describe('ST4-017 Emergency Lifebuoy', () => {
  const context: EffectContext = {
    sourcePlayerId: 'player-one',
    sourceInstanceId: 'st4-017',
  }

  const returnToHandEffect: CardEffect = {
    kind: 'return-to-hand',
    target: {
      side: 'self',
      min: 1,
      max: 1,
      maxLevel: 1,
    },
  }

  it('returns selected LV.1 cookie to hand', () => {
    const lv1Cookie = createBattleCookie('lv1-1', 1, 3, 'red')
    const lv2Cookie = createBattleCookie('lv2-1', 2, 4, 'red')
    let state = createTestGameState([lv1Cookie, lv2Cookie])

    state = executeCardEffect(state, context, returnToHandEffect, ['lv1-1'])

    const p1 = state.players['player-one']
    expect(p1.battleArea).toHaveLength(1)
    expect(p1.battleArea[0].card.instanceId).toBe('lv2-1')
    expect(p1.hand.some((c) => c.instanceId === 'lv1-1')).toBe(true)
  })

  it('rejects LV.2+ cookies from candidates', () => {
    const lv2Cookie = createBattleCookie('lv2-1', 2, 4, 'red')
    const state = createTestGameState([lv2Cookie])

    const candidates = getEffectTargetCandidates(state, context, {
      side: 'self',
      min: 1,
      max: 1,
      maxLevel: 1,
    })

    expect(candidates).toHaveLength(0)
  })

  it('returns unchanged state when no LV.1 cookies', () => {
    const lv2Cookie = createBattleCookie('lv2-1', 2, 4, 'red')
    const state = createTestGameState([lv2Cookie])

    const result = executeCardEffect(state, context, returnToHandEffect, [])

    expect(result.players['player-one'].battleArea).toHaveLength(1)
    expect(result.players['player-one'].hand).toHaveLength(0)
  })
})

describe('ST4-018 Lucky Pearls', () => {
  const context: EffectContext = {
    sourcePlayerId: 'player-one',
    sourceInstanceId: 'st4-018',
  }

  const drawUpToEffect: CardEffect = {
    kind: 'draw-up-to',
    max: 2,
  }

  it('sets pendingDrawUpTo with max=2', () => {
    const state = createTestGameState([], [], [], [
      { id: 'deck-1', instanceId: 'deck-1', name: 'deck-1', type: 'item' },
      { id: 'deck-2', instanceId: 'deck-2', name: 'deck-2', type: 'item' },
      { id: 'deck-3', instanceId: 'deck-3', name: 'deck-3', type: 'item' },
    ])

    const result = executeCardEffect(state, context, drawUpToEffect, [])

    expect(result.pendingDrawUpTo).toBeDefined()
    expect(result.pendingDrawUpTo?.max).toBe(2)
    expect(result.pendingDrawUpTo?.playerId).toBe('player-one')
  })

  it('resolves with 0 cards drawn', () => {
    let state = createTestGameState([], [], [], [
      { id: 'deck-1', instanceId: 'deck-1', name: 'deck-1', type: 'item' },
      { id: 'deck-2', instanceId: 'deck-2', name: 'deck-2', type: 'item' },
    ])
    state = executeCardEffect(state, context, drawUpToEffect, [])

    const result = resolveDrawUpTo(state, 'player-one', 0)

    expect(result.players['player-one'].hand).toHaveLength(0)
    expect(result.players['player-one'].deck).toHaveLength(2)
    expect(result.pendingDrawUpTo).toBeNull()
  })

  it('resolves with 1 card drawn', () => {
    let state = createTestGameState([], [], [], [
      { id: 'deck-1', instanceId: 'deck-1', name: 'deck-1', type: 'item' },
      { id: 'deck-2', instanceId: 'deck-2', name: 'deck-2', type: 'item' },
    ])
    state = executeCardEffect(state, context, drawUpToEffect, [])

    const result = resolveDrawUpTo(state, 'player-one', 1)

    expect(result.players['player-one'].hand).toHaveLength(1)
    expect(result.players['player-one'].deck).toHaveLength(1)
    expect(result.players['player-one'].hand[0].instanceId).toBe('deck-1')
    expect(result.pendingDrawUpTo).toBeNull()
  })

  it('resolves with 2 cards drawn', () => {
    let state = createTestGameState([], [], [], [
      { id: 'deck-1', instanceId: 'deck-1', name: 'deck-1', type: 'item' },
      { id: 'deck-2', instanceId: 'deck-2', name: 'deck-2', type: 'item' },
    ])
    state = executeCardEffect(state, context, drawUpToEffect, [])

    const result = resolveDrawUpTo(state, 'player-one', 2)

    expect(result.players['player-one'].hand).toHaveLength(2)
    expect(result.players['player-one'].deck).toHaveLength(0)
    expect(result.pendingDrawUpTo).toBeNull()
  })

  it('caps at available deck size and triggers Refresh', () => {
    const refreshCookie: GameCard = {
      id: 'refresh-cookie',
      instanceId: 'refresh-cookie',
      name: 'Refresh Cookie',
      type: 'cookie',
      level: 1,
      hp: 2,
      attack: 1,
      attackCost: 1,
    }
    let state = createTestGameState([], [], [], [
      { id: 'deck-1', instanceId: 'deck-1', name: 'deck-1', type: 'item' },
    ])
    state = {
      ...state,
      players: {
        ...state.players,
        'player-one': {
          ...state.players['player-one'],
          discardPile: [refreshCookie],
        },
      },
    }
    state = executeCardEffect(state, context, drawUpToEffect, [])

    const result = resolveDrawUpTo(state, 'player-one', 2)

    expect(result.players['player-one'].hand).toHaveLength(1)
    expect(result.players['player-one'].deck).toHaveLength(0)
    expect(result.pendingRefresh).toBeDefined()
    expect(result.pendingRefresh?.playerId).toBe('player-one')
    expect(result.pendingRefresh?.remainingDraws).toBe(1)
    expect(result.pendingDrawUpTo).toBeNull()
  })

  it('rejects drawCount > max', () => {
    let state = createTestGameState([], [], [], [
      { id: 'deck-1', instanceId: 'deck-1', name: 'deck-1', type: 'item' },
    ])
    state = executeCardEffect(state, context, drawUpToEffect, [])

    expect(() => resolveDrawUpTo(state, 'player-one', 3)).toThrow(
      GameRuleError,
    )
  })

  it('rejects negative drawCount', () => {
    let state = createTestGameState([], [], [], [
      { id: 'deck-1', instanceId: 'deck-1', name: 'deck-1', type: 'item' },
    ])
    state = executeCardEffect(state, context, drawUpToEffect, [])

    expect(() => resolveDrawUpTo(state, 'player-one', -1)).toThrow(
      GameRuleError,
    )
  })

  it('triggers Refresh when drawing exact remaining deck size', () => {
    const refreshCookie: GameCard = {
      id: 'refresh-cookie',
      instanceId: 'refresh-cookie',
      name: 'Refresh Cookie',
      type: 'cookie',
      level: 1,
      hp: 2,
      attack: 1,
      attackCost: 1,
    }
    let state = createTestGameState([], [], [], [
      { id: 'deck-1', instanceId: 'deck-1', name: 'deck-1', type: 'item' },
      { id: 'deck-2', instanceId: 'deck-2', name: 'deck-2', type: 'item' },
    ])
    state = {
      ...state,
      players: {
        ...state.players,
        'player-one': {
          ...state.players['player-one'],
          discardPile: [refreshCookie],
        },
      },
    }
    state = executeCardEffect(state, context, drawUpToEffect, [])

    const result = resolveDrawUpTo(state, 'player-one', 2)

    expect(result.players['player-one'].hand).toHaveLength(2)
    expect(result.players['player-one'].deck).toHaveLength(0)
    expect(result.pendingRefresh).toBeDefined()
    expect(result.pendingRefresh?.playerId).toBe('player-one')
    expect(result.pendingRefresh?.remainingDraws).toBe(0)
    expect(result.pendingDrawUpTo).toBeNull()
  })

  it('resolves sourceCardName from hand for item cards', () => {
    const itemInHand: GameCard = {
      id: 'st4-018',
      instanceId: 'st4-018',
      name: 'Lucky Pearls',
      type: 'item',
    }
    const state = createTestGameState([], [], [itemInHand], [
      { id: 'deck-1', instanceId: 'deck-1', name: 'deck-1', type: 'item' },
    ])

    const result = executeCardEffect(
      state,
      { sourcePlayerId: 'player-one', sourceInstanceId: 'st4-018' },
      drawUpToEffect,
      [],
    )

    expect(result.pendingDrawUpTo?.sourceCardName).toBe('Lucky Pearls')
  })

  it('resolves sourceCardName from discardPile (after playItem moves card there)', () => {
    // 模擬實際流程：playItem 把物品卡移到 discardPile 後再執行效果
    const itemInDiscard: GameCard = {
      id: 'st4-018',
      instanceId: 'st4-018',
      name: 'Lucky Pearls',
      type: 'item',
    }
    let state = createTestGameState([], [], [], [
      { id: 'deck-1', instanceId: 'deck-1', name: 'deck-1', type: 'item' },
    ])
    // 手動把物品卡放入 discardPile，模擬 playItem 結果
    state = {
      ...state,
      players: {
        ...state.players,
        'player-one': {
          ...state.players['player-one'],
          discardPile: [itemInDiscard],
        },
      },
    }

    const result = executeCardEffect(
      state,
      { sourcePlayerId: 'player-one', sourceInstanceId: 'st4-018' },
      drawUpToEffect,
      [],
    )

    expect(result.pendingDrawUpTo?.sourceCardName).toBe('Lucky Pearls')
    expect(result.pendingDrawUpTo?.sourceCardName).not.toBe('Unknown')
  })
})

describe('ST4-019 Sugar Crystal Lamp', () => {
  const context: EffectContext = {
    sourcePlayerId: 'player-one',
    sourceInstanceId: 'st4-019',
  }

  const handToDeckAndDrawEffect: CardEffect = {
    kind: 'hand-to-deck-and-draw',
  }

  it('returns all hand to deck, shuffles, draws same count', () => {
    const handCards: GameCard[] = [
      { id: 'hand-1', instanceId: 'hand-1', name: 'hand-1', type: 'item' },
      { id: 'hand-2', instanceId: 'hand-2', name: 'hand-2', type: 'item' },
      { id: 'hand-3', instanceId: 'hand-3', name: 'hand-3', type: 'item' },
    ]
    const deckCards: GameCard[] = [
      { id: 'deck-1', instanceId: 'deck-1', name: 'deck-1', type: 'item' },
      { id: 'deck-2', instanceId: 'deck-2', name: 'deck-2', type: 'item' },
      { id: 'deck-3', instanceId: 'deck-3', name: 'deck-3', type: 'item' },
      { id: 'deck-4', instanceId: 'deck-4', name: 'deck-4', type: 'item' },
      { id: 'deck-5', instanceId: 'deck-5', name: 'deck-5', type: 'item' },
    ]
    const state = createTestGameState([], [], handCards, deckCards)

    const result = executeCardEffect(
      state,
      context,
      handToDeckAndDrawEffect,
      [],
    )

    const p1 = result.players['player-one']
    expect(p1.hand).toHaveLength(3)
    expect(p1.deck).toHaveLength(5)
    const allCardIds = [
      ...p1.hand.map((c) => c.instanceId),
      ...p1.deck.map((c) => c.instanceId),
    ]
    expect(allCardIds.sort()).toEqual(
      [...handCards, ...deckCards].map((c) => c.instanceId).sort(),
    )
  })

  it('does nothing with empty hand', () => {
    const deckCards: GameCard[] = [
      { id: 'deck-1', instanceId: 'deck-1', name: 'deck-1', type: 'item' },
    ]
    const state = createTestGameState([], [], [], deckCards)

    const result = executeCardEffect(
      state,
      context,
      handToDeckAndDrawEffect,
      [],
    )

    const p1 = result.players['player-one']
    expect(p1.hand).toHaveLength(0)
    expect(p1.deck).toHaveLength(1)
  })

  it('shuffle changes card order', () => {
    const handCards: GameCard[] = [
      { id: 'hand-1', instanceId: 'hand-1', name: 'hand-1', type: 'item' },
    ]
    const deckCards: GameCard[] = [
      { id: 'deck-1', instanceId: 'deck-1', name: 'deck-1', type: 'item' },
      { id: 'deck-2', instanceId: 'deck-2', name: 'deck-2', type: 'item' },
      { id: 'deck-3', instanceId: 'deck-3', name: 'deck-3', type: 'item' },
    ]
    const state = createTestGameState([], [], handCards, deckCards)

    const result = executeCardEffect(
      state,
      context,
      handToDeckAndDrawEffect,
      [],
    )

    const p1 = result.players['player-one']
    expect(p1.hand).toHaveLength(1)
    expect(p1.deck).toHaveLength(3)
    const allCardIds = [
      ...p1.hand.map((c) => c.instanceId),
      ...p1.deck.map((c) => c.instanceId),
    ]
    expect(allCardIds.sort()).toEqual(
      ['hand-1', 'deck-1', 'deck-2', 'deck-3'].sort(),
    )
  })

  it('triggers Refresh when deck empties after draw', () => {
    const refreshCookie: GameCard = {
      id: 'refresh-cookie',
      instanceId: 'refresh-cookie',
      name: 'Refresh Cookie',
      type: 'cookie',
      level: 1,
      hp: 2,
      attack: 1,
      attackCost: 1,
    }
    const handCards: GameCard[] = [
      { id: 'hand-1', instanceId: 'hand-1', name: 'hand-1', type: 'item' },
      { id: 'hand-2', instanceId: 'hand-2', name: 'hand-2', type: 'item' },
    ]
    let state = createTestGameState([], [], handCards, [])
    state = {
      ...state,
      players: {
        ...state.players,
        'player-one': {
          ...state.players['player-one'],
          discardPile: [refreshCookie],
        },
      },
    }

    const result = executeCardEffect(
      state,
      context,
      handToDeckAndDrawEffect,
      [],
    )

    expect(result.pendingRefresh).toBeDefined()
    expect(result.pendingRefresh?.playerId).toBe('player-one')
    expect(result.players['player-one'].hand).toHaveLength(2)
    expect(result.players['player-one'].deck).toHaveLength(0)
  })

  it('preserves card count', () => {
    const handCards: GameCard[] = [
      { id: 'hand-1', instanceId: 'hand-1', name: 'hand-1', type: 'item' },
      { id: 'hand-2', instanceId: 'hand-2', name: 'hand-2', type: 'item' },
    ]
    const deckCards: GameCard[] = [
      { id: 'deck-1', instanceId: 'deck-1', name: 'deck-1', type: 'item' },
      { id: 'deck-2', instanceId: 'deck-2', name: 'deck-2', type: 'item' },
    ]
    const state = createTestGameState([], [], handCards, deckCards)

    const result = executeCardEffect(
      state,
      context,
      handToDeckAndDrawEffect,
      [],
    )

    const p1 = result.players['player-one']
    expect(p1.hand.length + p1.deck.length).toBe(
      handCards.length + deckCards.length,
    )
  })

  it('shuffles and triggers Refresh with empty hand and empty deck', () => {
    const refreshCookie: GameCard = {
      id: 'refresh-cookie',
      instanceId: 'refresh-cookie',
      name: 'Refresh Cookie',
      type: 'cookie',
      level: 1,
      hp: 2,
      attack: 1,
      attackCost: 1,
    }
    let state = createTestGameState([], [], [], [])
    state = {
      ...state,
      players: {
        ...state.players,
        'player-one': {
          ...state.players['player-one'],
          discardPile: [refreshCookie],
        },
      },
    }

    const result = executeCardEffect(
      state,
      context,
      handToDeckAndDrawEffect,
      [],
    )

    expect(result.pendingRefresh).toBeDefined()
    expect(result.pendingRefresh?.playerId).toBe('player-one')
    expect(result.players['player-one'].hand).toHaveLength(0)
    expect(result.players['player-one'].deck).toHaveLength(0)
  })
})

describe('AI dispatch for ST4 effects', () => {
  it('AI selects return-to-hand target by lowest HP', () => {
    const blueLow = createBattleCookie('blue-low', 2, 3, 'blue')
    const blueHigh = createBattleCookie('blue-high', 3, 5, 'blue')
    let state = createTestGameState([blueLow, blueHigh], [], [
      {
        id: 'st4-016',
        instanceId: 'st4-016',
        name: 'Bear Jelly Ice Cream',
        type: 'item',
        energyColor: 'blue',
        item: {
          cost: { blue: 2 },
          text: 'Return 1 {B} Cookie with 3+ HP to hand.',
          effects: [
            {
              kind: 'return-to-hand',
              target: {
                side: 'self',
                min: 1,
                max: 1,
                energyColor: 'blue',
                minRemainingHp: 3,
              },
            },
          ],
        },
      },
    ])
    state = {
      ...state,
      turnNumber: 1,
      players: {
        ...state.players,
        'player-one': {
          ...state.players['player-one'],
          supportArea: [
            { card: { id: 'sup-b1', instanceId: 'sup-b1', name: 'sup-b1', type: 'item', energyColor: 'blue' }, rested: false },
            { card: { id: 'sup-b2', instanceId: 'sup-b2', name: 'sup-b2', type: 'item', energyColor: 'blue' }, rested: false },
          ],
        },
      },
    }

    const decision = takeAiStep(state, 'player-one')

    expect(decision.action).toBe('play-item')
    const effectSelections = decision.effectSelections ?? []
    expect(effectSelections.length).toBeGreaterThan(0)
    const targetIds = effectSelections[0].targetIds
    expect(targetIds).toContain('blue-low')
  })

  it('AI ignores return-to-hand targets that do not satisfy remaining HP requirements', () => {
    const blueTooLow = createBattleCookie('blue-too-low', 2, 2, 'blue')
    const blueValid = createBattleCookie('blue-valid', 3, 4, 'blue')
    let state = createTestGameState([blueTooLow, blueValid], [], [
      {
        id: 'st4-016',
        instanceId: 'st4-016',
        name: 'Bear Jelly Ice Cream',
        type: 'item',
        energyColor: 'blue',
        item: {
          cost: { blue: 2 },
          text: 'Return 1 {B} Cookie with 3+ HP to hand.',
          effects: [
            {
              kind: 'return-to-hand',
              target: {
                side: 'self',
                min: 1,
                max: 1,
                energyColor: 'blue',
                minRemainingHp: 3,
              },
            },
          ],
        },
      },
    ])
    state = {
      ...state,
      turnNumber: 1,
      players: {
        ...state.players,
        'player-one': {
          ...state.players['player-one'],
          supportArea: [
            { card: { id: 'sup-b1', instanceId: 'sup-b1', name: 'sup-b1', type: 'item', energyColor: 'blue' }, rested: false },
            { card: { id: 'sup-b2', instanceId: 'sup-b2', name: 'sup-b2', type: 'item', energyColor: 'blue' }, rested: false },
          ],
        },
      },
    }

    const decision = takeAiStep(state, 'player-one')

    expect(decision.action).toBe('play-item')
    expect(decision.error).toBeUndefined()
    expect(decision.effectSelections?.[0].targetIds).toEqual(['blue-valid'])
  })

  it('AI handles draw-up-to by drawing max available', () => {
    const deckCards: GameCard[] = [
      { id: 'deck-1', instanceId: 'deck-1', name: 'deck-1', type: 'item' },
      { id: 'deck-2', instanceId: 'deck-2', name: 'deck-2', type: 'item' },
      { id: 'deck-3', instanceId: 'deck-3', name: 'deck-3', type: 'item' },
    ]
    let state = createTestGameState([], [], [
      {
        id: 'st4-018',
        instanceId: 'st4-018',
        name: 'Lucky Pearls',
        type: 'item',
        energyColor: 'blue',
        item: {
          cost: { blue: 2 },
          text: 'Draw up to 2 cards.',
          effects: [{ kind: 'draw-up-to', max: 2 }],
        },
      },
    ], deckCards)
    state = {
      ...state,
      turnNumber: 1,
      players: {
        ...state.players,
        'player-one': {
          ...state.players['player-one'],
          supportArea: [
            { card: { id: 'sup-b1', instanceId: 'sup-b1', name: 'sup-b1', type: 'item', energyColor: 'blue' }, rested: false },
            { card: { id: 'sup-b2', instanceId: 'sup-b2', name: 'sup-b2', type: 'item', energyColor: 'blue' }, rested: false },
          ],
        },
      },
    }

    const decision = takeAiStep(state, 'player-one')

    expect(decision.action).toBe('play-item')
    const nextState = decision.state
    expect(nextState.pendingDrawUpTo).toBeDefined()
    expect(nextState.pendingDrawUpTo?.max).toBe(2)
  })
})

describe('draw-up-to-then-discard', () => {
  const context: EffectContext = {
    sourcePlayerId: 'player-one',
    sourceInstanceId: 'bs2-025',
  }

  const effect: CardEffect = {
    kind: 'draw-up-to-then-discard',
    max: 1,
    discardCount: 1,
  }

  it('sets pendingDrawUpTo with afterEffectsRequireDraw', () => {
    const state = createTestGameState([], [], [], [
      { id: 'deck-1', instanceId: 'deck-1', name: 'deck-1', type: 'item' },
    ])

    const result = executeCardEffect(state, context, effect, [])

    expect(result.pendingDrawUpTo).toBeDefined()
    expect(result.pendingDrawUpTo?.max).toBe(1)
    expect(result.pendingDrawUpTo?.afterEffects).toEqual([
      { kind: 'discard-hand', count: 1 },
    ])
    expect(result.pendingDrawUpTo?.afterEffectsRequireDraw).toBe(true)
  })

  it('does not execute afterEffects when 0 cards drawn', () => {
    let state = createTestGameState([], [], [
      { id: 'hand-1', instanceId: 'hand-1', name: 'hand-1', type: 'item' },
    ], [
      { id: 'deck-1', instanceId: 'deck-1', name: 'deck-1', type: 'item' },
    ])
    state = executeCardEffect(state, context, effect, [])

    const result = resolveDrawUpTo(state, 'player-one', 0)

    expect(result.pendingDrawUpTo).toBeNull()
    expect(result.players['player-one'].hand).toHaveLength(1)
    expect(result.players['player-one'].hand[0].instanceId).toBe('hand-1')
    expect(result.players['player-one'].discardPile).toHaveLength(0)
  })

  it('creates pendingOpponentHandDiscard after drawing 1 card', () => {
    const myCookie = createBattleCookie('my-cookie', 1, 1)
    const oppCookie = createBattleCookie('opp-cookie', 1, 1)
    let state = createTestGameState([myCookie], [oppCookie], [
      { id: 'hand-1', instanceId: 'hand-1', name: 'hand-1', type: 'item' },
    ], [
      { id: 'deck-1', instanceId: 'deck-1', name: 'deck-1', type: 'item' },
      { id: 'deck-2', instanceId: 'deck-2', name: 'deck-2', type: 'item' },
    ])
    state = executeCardEffect(state, context, effect, [])

    expect(state.pendingDrawUpTo).toBeDefined()
    expect(state.pendingDrawUpTo?.afterEffects).toEqual([
      { kind: 'discard-hand', count: 1 },
    ])
    expect(state.pendingDrawUpTo?.afterEffectContext).toBeDefined()

    const result = resolveDrawUpTo(state, 'player-one', 1)

    expect(result.pendingDrawUpTo).toBeNull()
    expect(result.players['player-one'].hand).toHaveLength(2)
    expect(result.status).toBe('playing')
    expect(result.pendingOpponentHandDiscard).toMatchObject({
      playerId: 'player-one',
      count: 1,
    })
  })
})
