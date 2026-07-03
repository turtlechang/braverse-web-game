import { describe, expect, it } from 'vitest'
import {
  executeCardEffect,
  finalizePendingReplacements,
  type CardEffect,
  type EffectContext,
  type GameState,
  type PlayerState,
  type CookieInBattle,
  type GameCard,
  type StageCard,
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

const createTestCookie = (
  instanceId: string,
  level: number,
  hp: number,
  energyColor: GameCard['energyColor'] = 'purple',
): import('../types').CookieCard => ({
  id: instanceId,
  instanceId,
  name: instanceId,
  type: 'cookie',
  officialType: 'cookie',
  level,
  hp,
  attack: 1,
  attackCost: 1,
  attackEnergyCost: { purple: 1 },
  energyColor,
})

const createHpCards = (prefix: string, count: number): GameCard[] =>
  Array.from({ length: count }, (_, i) => ({
    id: `${prefix}-${i}`,
    instanceId: `${prefix}-${i}`,
    name: `${prefix}-${i}`,
    type: 'item' as const,
  }))

const createBattleCookie = (
  instanceId: string,
  level: number,
  hp: number,
  energyColor: GameCard['energyColor'] = 'purple',
): CookieInBattle => ({
  card: createTestCookie(instanceId, level, hp, energyColor),
  hpCards: createHpCards(`${instanceId}-hp`, hp),
  rested: false,
  battleEntryId: `${instanceId}:battle:1`,
})

const createTestGameState = (
  p1Battle: CookieInBattle[] = [],
  p2Battle: CookieInBattle[] = [],
  p2Stage: StageCard | null = null,
): GameState => ({
  players: {
    'player-one': {
      ...createTestPlayer('player-one'),
      battleArea: p1Battle,
    },
    'player-two': {
      ...createTestPlayer('player-two'),
      battleArea: p2Battle,
      stage: p2Stage,
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

describe('field-to-trash', () => {
  const context: EffectContext = {
    sourcePlayerId: 'player-one',
    sourceInstanceId: 'st5-001',
  }

  it('removes opponent LV.1 cookie to trash', () => {
    const lv1 = createBattleCookie('opp-lv1', 1, 3, 'purple')
    const lv2 = createBattleCookie('opp-lv2', 2, 4, 'purple')
    let state = createTestGameState([], [lv1, lv2])

    const effect: CardEffect = {
      kind: 'field-to-trash',
      target: { side: 'opponent', min: 1, max: 1, maxLevel: 1 },
    }
    state = executeCardEffect(state, context, effect, ['opp-lv1'])

    const p2 = state.players['player-two']
    expect(p2.battleArea).toHaveLength(1)
    expect(p2.battleArea[0].card.instanceId).toBe('opp-lv2')
    expect(p2.discardPile.some((c) => c.instanceId === 'opp-lv1')).toBe(true)
  })

  it('removes opponent LV.2 or lower cookie', () => {
    const lv1 = createBattleCookie('opp-lv1', 1, 2, 'purple')
    const lv2 = createBattleCookie('opp-lv2', 2, 3, 'purple')
    const lv3 = createBattleCookie('opp-lv3', 3, 5, 'purple')
    let state = createTestGameState([], [lv1, lv2, lv3])

    const effect: CardEffect = {
      kind: 'field-to-trash',
      target: { side: 'opponent', min: 1, max: 1, maxLevel: 2 },
    }
    state = executeCardEffect(state, context, effect, ['opp-lv2'])

    const p2 = state.players['player-two']
    expect(p2.battleArea).toHaveLength(2)
    expect(p2.battleArea.some((c) => c.card.instanceId === 'opp-lv3')).toBe(true)
    expect(p2.discardPile.some((c) => c.instanceId === 'opp-lv2')).toBe(true)
  })

  it('removes opponent cookie with remaining HP constraint', () => {
    const lowHp = createBattleCookie('opp-low', 2, 1, 'purple')
    const highHp = createBattleCookie('opp-high', 2, 4, 'purple')
    let state = createTestGameState([], [lowHp, highHp])

    const effect: CardEffect = {
      kind: 'field-to-trash',
      target: { side: 'opponent', min: 1, max: 1, remainingHp: 2 },
    }
    state = executeCardEffect(state, context, effect, ['opp-low'])

    const p2 = state.players['player-two']
    expect(p2.battleArea).toHaveLength(1)
    expect(p2.battleArea[0].card.instanceId).toBe('opp-high')
  })

  it('returns unchanged when selected cookie does not meet level constraint', () => {
    const lv2 = createBattleCookie('opp-lv2', 2, 3, 'purple')
    const state = createTestGameState([], [lv2])

    const effect: CardEffect = {
      kind: 'field-to-trash',
      target: { side: 'opponent', min: 1, max: 1, maxLevel: 1 },
    }
    expect(() =>
      executeCardEffect(state, context, effect, ['opp-lv2']),
    ).toThrow('合法目標')
  })

  it('removes opponent stage card when allowStage', () => {
    const stageCard: GameCard = {
      id: 'stage-1',
      instanceId: 'stage-1',
      name: 'Test Stage',
      type: 'stage',
    }
    let state = createTestGameState([], [], { card: stageCard, rested: false })

    const effect: CardEffect = {
      kind: 'field-to-trash',
      target: { side: 'opponent', min: 1, max: 1 },
      allowStage: true,
    }
    state = executeCardEffect(state, context, effect, ['stage-1'])

    expect(state.players['player-two'].stage).toBeNull()
    expect(
      state.players['player-two'].discardPile.some(
        (c) => c.instanceId === 'stage-1',
      ),
    ).toBe(true)
  })

  it('rejects a missing stage target', () => {
    const state = createTestGameState([], [])
    const effect: CardEffect = {
      kind: 'field-to-trash',
      target: { side: 'opponent', min: 1, max: 1 },
      allowStage: true,
    }
    expect(() =>
      executeCardEffect(state, context, effect, ['missing-stage']),
    ).toThrow('合法目標')
  })

  it('removes only stage card when stageOnly (BS2-046)', () => {
    const stageCard: GameCard = {
      id: 'stage-1',
      instanceId: 'stage-1',
      name: 'Test Stage',
      type: 'stage',
    }
    const lv1 = createBattleCookie('opp-lv1', 1, 3, 'blue')
    let state = createTestGameState([], [lv1], { card: stageCard, rested: false })

    const effect: CardEffect = {
      kind: 'field-to-trash',
      target: { side: 'opponent', min: 0, max: 1 },
      stageOnly: true,
    }
    state = executeCardEffect(state, context, effect, ['stage-1'])

    expect(state.players['player-two'].stage).toBeNull()
    expect(state.players['player-two'].battleArea).toHaveLength(1)
    expect(
      state.players['player-two'].discardPile.some(
        (c) => c.instanceId === 'stage-1',
      ),
    ).toBe(true)
  })

  it('rejects battle cookie target when stageOnly', () => {
    const stageCard: GameCard = {
      id: 'stage-1',
      instanceId: 'stage-1',
      name: 'Test Stage',
      type: 'stage',
    }
    const lv1 = createBattleCookie('opp-lv1', 1, 3, 'blue')
    const state = createTestGameState([], [lv1], { card: stageCard, rested: false })

    const effect: CardEffect = {
      kind: 'field-to-trash',
      target: { side: 'opponent', min: 0, max: 1 },
      stageOnly: true,
    }
    expect(() =>
      executeCardEffect(state, context, effect, ['opp-lv1']),
    ).toThrow('場景卡')
  })

  it('returns unchanged when no valid targets', () => {
    const lv2 = createBattleCookie('opp-lv2', 2, 4, 'purple')
    let state = createTestGameState([], [lv2])
    const effect: CardEffect = {
      kind: 'field-to-trash',
      target: { side: 'opponent', min: 1, max: 1, maxLevel: 1 },
    }
    state = executeCardEffect(state, context, effect, [])
    expect(state.players['player-two'].battleArea).toHaveLength(1)
  })

  it('HP cards move to discard pile with the cookie', () => {
    const lv1 = createBattleCookie('opp-lv1', 1, 3, 'purple')
    let state = createTestGameState([], [lv1])

    const effect: CardEffect = {
      kind: 'field-to-trash',
      target: { side: 'opponent', min: 1, max: 1, maxLevel: 1 },
    }
    state = executeCardEffect(state, context, effect, ['opp-lv1'])

    const p2 = state.players['player-two']
    expect(p2.discardPile.some((c) => c.instanceId === 'opp-lv1')).toBe(true)
    expect(p2.discardPile.some((c) => c.instanceId === 'opp-lv1-hp-0')).toBe(true)
    expect(p2.discardPile.some((c) => c.instanceId === 'opp-lv1-hp-1')).toBe(true)
    expect(p2.discardPile.some((c) => c.instanceId === 'opp-lv1-hp-2')).toBe(true)
  })

  it('handles no-condition field-to-trash (ST5-015 Rye Cookie)', () => {
    const anyCookie = createBattleCookie('opp-any', 3, 5, 'purple')
    let state = createTestGameState([], [anyCookie])

    const effect: CardEffect = {
      kind: 'field-to-trash',
      target: { side: 'opponent', min: 1, max: 1 },
    }
    state = executeCardEffect(state, context, effect, ['opp-any'])

    expect(state.players['player-two'].battleArea).toHaveLength(0)
    expect(
      state.players['player-two'].discardPile.some(
        (c) => c.instanceId === 'opp-any',
      ),
    ).toBe(true)
  })

  it('rejects selecting more targets than the effect allows', () => {
    const first = createBattleCookie('opp-first', 1, 2)
    const second = createBattleCookie('opp-second', 1, 2)
    const state = createTestGameState([], [first, second])
    const effect: CardEffect = {
      kind: 'field-to-trash',
      target: { side: 'opponent', min: 1, max: 1 },
    }

    expect(() =>
      executeCardEffect(state, context, effect, ['opp-first', 'opp-second']),
    ).toThrow('目標數量')
  })

  it('records a non-faint departure and waits until effect completion to replace it', () => {
    const replacement = createTestCookie('replacement', 1, 1)
    const faintEffect: CardEffect = { kind: 'opponent-discard-hand', count: 1 }
    const target = createBattleCookie('opp-faint-text', 1, 2)
    target.card.skill = {
      trigger: 'passive',
      oncePerTurn: false,
      yourTurn: false,
      restSource: false,
      cost: { energy: {}, discardHand: 0 },
      text: 'When this Cookie faints, your opponent discards 1 card.',
      effects: [faintEffect],
      faint: true,
    }
    let state = createTestGameState([], [target])
    state = {
      ...state,
      players: {
        ...state.players,
        'player-two': {
          ...state.players['player-two'],
          hand: [replacement],
        },
      },
    }

    const result = executeCardEffect(
      state,
      context,
      { kind: 'field-to-trash', target: { side: 'opponent', min: 1, max: 1 } },
      ['opp-faint-text'],
    )

    expect(result.pendingOpponentHandDiscard).toBeFalsy()
    expect(result.pendingFaintEffects).toBeFalsy()
    expect(result.departedCookieCounts['player-two']).toBe(1)
    expect(finalizePendingReplacements(result).pendingReplacement).toMatchObject({
      tasks: [{ playerId: 'player-two', remaining: 1 }],
    })
  })
})

describe('return-to-deck-bottom', () => {
  const context: EffectContext = {
    sourcePlayerId: 'player-one',
    sourceInstanceId: 'bs2-036',
  }

  it('returns LV.1 cookie to deck bottom and keeps it in deck', () => {
    const lv1 = createBattleCookie('self-lv1', 1, 3, 'blue')
    const lv2 = createBattleCookie('self-lv2', 2, 4, 'blue')
    const deckCard = createTestCookie('deck-1', 1, 3, 'blue')
    let state = createTestGameState([lv1, lv2], [])
    state = {
      ...state,
      players: {
        ...state.players,
        'player-one': {
          ...state.players['player-one'],
          deck: [deckCard],
        },
      },
    }

    const effect: CardEffect = {
      kind: 'return-to-deck-bottom',
      target: { side: 'self', min: 1, max: 1, maxLevel: 1 },
    }
    state = executeCardEffect(state, context, effect, ['self-lv1'])

    const p1 = state.players['player-one']
    expect(p1.battleArea).toHaveLength(1)
    expect(p1.battleArea[0].card.instanceId).toBe('self-lv2')
    expect(p1.deck).toHaveLength(2)
    expect(p1.deck[0].instanceId).toBe('deck-1')
    expect(p1.deck[1].instanceId).toBe('self-lv1')
  })

  it('discards HP cards to discard pile', () => {
    const lv1 = createBattleCookie('self-lv1', 1, 3, 'blue')
    const lv2 = createBattleCookie('self-lv2', 2, 4, 'blue')
    let state = createTestGameState([lv1, lv2], [])

    const effect: CardEffect = {
      kind: 'return-to-deck-bottom',
      target: { side: 'self', min: 1, max: 1, maxLevel: 1 },
    }
    state = executeCardEffect(state, context, effect, ['self-lv1'])

    const p1 = state.players['player-one']
    expect(p1.discardPile.some((c) => c.instanceId === 'self-lv1-hp-0')).toBe(true)
    expect(p1.discardPile.some((c) => c.instanceId === 'self-lv1-hp-1')).toBe(true)
    expect(p1.discardPile.some((c) => c.instanceId === 'self-lv1-hp-2')).toBe(true)
  })

  it('returns unchanged when no valid targets', () => {
    const lv2 = createBattleCookie('self-lv2', 2, 4, 'blue')
    const state = createTestGameState([lv2], [])

    const effect: CardEffect = {
      kind: 'return-to-deck-bottom',
      target: { side: 'self', min: 1, max: 1, maxLevel: 1 },
    }
    const result = executeCardEffect(state, context, effect, [])
    expect(result.players['player-one'].battleArea).toHaveLength(1)
  })

  it('rejects when return would leave battle area empty', () => {
    const lv1 = createBattleCookie('self-lv1', 1, 3, 'blue')
    const state = createTestGameState([lv1], [])

    const effect: CardEffect = {
      kind: 'return-to-deck-bottom',
      target: { side: 'self', min: 1, max: 1, maxLevel: 1 },
    }
    expect(() =>
      executeCardEffect(state, context, effect, ['self-lv1']),
    ).toThrow('戰鬥區必須至少保留')
  })
})
