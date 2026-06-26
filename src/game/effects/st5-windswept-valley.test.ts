import { describe, expect, it } from 'vitest'
import {
  executeCardEffect,
  applyGameCommand,
  canActivateStage,
  hasBlockingPending,
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

const createWindsweptValley = (): StageCard => ({
  card: {
    id: 'ST5-022',
    instanceId: 'st5-022',
    name: 'Windswept Valley',
    type: 'stage',
    stageAbility: {
      placementCost: { purple: 2 },
      cost: {},
      text: 'When your opponent places a Cookie from their battle area into the trash by effect.',
      effects: [{ kind: 'draw', amount: 1 }],
      restSource: true,
      triggered: true,
    },
  },
  rested: false,
})

const createTestGameState = (
  p1Battle: CookieInBattle[] = [],
  p2Battle: CookieInBattle[] = [],
  p1Stage: StageCard | null = null,
  p1Deck: GameCard[] = [],
): GameState => ({
  players: {
    'player-one': {
      ...createTestPlayer('player-one'),
      battleArea: p1Battle,
      stage: p1Stage,
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
  skipAttackUntilTurn: {},
  pendingReplacement: null,
  departedCookieCounts: { 'player-one': 0, 'player-two': 0 },
  pendingRefresh: null,
  pendingBattle: null,
})

describe('Windswept Valley (ST5-022) trigger', () => {
  const context: EffectContext = {
    sourcePlayerId: 'player-one',
    sourceInstanceId: 'st5-001',
  }

  it('does not trigger when the stage owner sends an opponent cookie to trash', () => {
    const windswept = createWindsweptValley()
    const lv1 = createBattleCookie('opp-lv1', 1, 3, 'purple')
    const deck = [
      { id: 'deck-1', instanceId: 'deck-1', name: 'deck-1', type: 'item' as const },
    ]
    let state = createTestGameState([], [lv1], windswept, deck)

    const effect: CardEffect = {
      kind: 'field-to-trash',
      target: { side: 'opponent', min: 1, max: 1, maxLevel: 1 },
    }
    state = executeCardEffect(state, context, effect, ['opp-lv1'])

    expect(state.pendingStageTrigger).toBeUndefined()
  })

  it('triggers when the opponent effect sends their own cookie to trash', () => {
    const windswept = createWindsweptValley()
    const opponentCookie = createBattleCookie('opp-self-trash', 1, 3, 'purple')
    let state = createTestGameState([], [opponentCookie], windswept, [
      { id: 'deck-1', instanceId: 'deck-1', name: 'deck-1', type: 'item' },
    ])

    state = executeCardEffect(
      state,
      { sourcePlayerId: 'player-two', sourceInstanceId: 'opponent-effect' },
      {
        kind: 'field-to-trash',
        target: { side: 'self', min: 1, max: 1 },
      },
      ['opp-self-trash'],
    )

    expect(state.pendingStageTrigger).toMatchObject({
      playerId: 'player-one',
      sourceInstanceId: 'st5-022',
    })
    expect(hasBlockingPending(state)).toBe(true)
  })

  it('does not trigger when stage is rested', () => {
    const windswept = createWindsweptValley()
    windswept.rested = true
    const lv1 = createBattleCookie('opp-lv1', 1, 3, 'purple')
    let state = createTestGameState([], [lv1], windswept)

    const effect: CardEffect = {
      kind: 'field-to-trash',
      target: { side: 'opponent', min: 1, max: 1, maxLevel: 1 },
    }
    state = executeCardEffect(state, context, effect, ['opp-lv1'])

    expect(state.pendingStageTrigger).toBeUndefined()
  })

  it('does not trigger when stage card is sent to trash', () => {
    const windswept = createWindsweptValley()
    let state = createTestGameState()
    state.players['player-two'].stage = windswept

    const effect: CardEffect = {
      kind: 'field-to-trash',
      target: { side: 'opponent', min: 1, max: 1 },
      allowStage: true,
    }
    state = executeCardEffect(state, context, effect, [windswept.card.instanceId])

    expect(state.pendingStageTrigger).toBeUndefined()
  })

  it('does not trigger when opponent has no stage card', () => {
    const lv1 = createBattleCookie('opp-lv1', 1, 3, 'purple')
    let state = createTestGameState([], [lv1])

    const effect: CardEffect = {
      kind: 'field-to-trash',
      target: { side: 'opponent', min: 1, max: 1, maxLevel: 1 },
    }
    state = executeCardEffect(state, context, effect, ['opp-lv1'])

    expect(state.pendingStageTrigger).toBeUndefined()
  })

  it('activates the stage trigger and draws 1 card', () => {
    const windswept = createWindsweptValley()
    const lv1 = createBattleCookie('opp-lv1', 1, 3, 'purple')
    const deck = [
      { id: 'deck-1', instanceId: 'deck-1', name: 'deck-1', type: 'item' as const },
    ]
    let state = createTestGameState([], [lv1], windswept, deck)

    const effect: CardEffect = {
      kind: 'field-to-trash',
      target: { side: 'self', min: 1, max: 1, maxLevel: 1 },
    }
    state = executeCardEffect(
      state,
      { sourcePlayerId: 'player-two', sourceInstanceId: 'opponent-effect' },
      effect,
      ['opp-lv1'],
    )
    expect(state.pendingStageTrigger).toBeDefined()

    const result = applyGameCommand(state, {
      kind: 'resolve-stage-trigger',
      playerId: 'player-one',
      action: 'activate',
    })

    expect(result.pendingStageTrigger).toBeNull()
    expect(result.players['player-one'].hand).toHaveLength(1)
    expect(result.players['player-one'].hand[0].instanceId).toBe('deck-1')
    expect(result.players['player-one'].stage?.rested).toBe(true)
  })

  it('uses the shared Refresh flow when activating with an empty deck', () => {
    const windswept = createWindsweptValley()
    const lv1 = createBattleCookie('opp-lv1', 1, 3, 'purple')
    let state = createTestGameState([], [lv1], windswept)
    state = {
      ...state,
      players: {
        ...state.players,
        'player-one': {
          ...state.players['player-one'],
          discardPile: [
            createTestCookie('refresh-cookie', 1, 1),
            { id: 'draw-after-refresh', instanceId: 'draw-after-refresh', name: 'draw-after-refresh', type: 'item' },
          ],
        },
      },
    }

    const effect: CardEffect = {
      kind: 'field-to-trash',
      target: { side: 'self', min: 1, max: 1, maxLevel: 1 },
    }
    state = executeCardEffect(
      state,
      { sourcePlayerId: 'player-two', sourceInstanceId: 'opponent-effect' },
      effect,
      ['opp-lv1'],
    )
    expect(state.pendingStageTrigger).toBeDefined()

    const result = applyGameCommand(state, {
      kind: 'resolve-stage-trigger',
      playerId: 'player-one',
      action: 'activate',
    })

    expect(result.pendingStageTrigger).toBeNull()
    expect(result.players['player-one'].hand).toHaveLength(0)
    expect(result.players['player-one'].stage?.rested).toBe(true)
    expect(result.pendingRefresh).toMatchObject({
      playerId: 'player-one',
      remainingDraws: 1,
    })
  })

  it('rejects resolving another player stage trigger', () => {
    const state = {
      ...createTestGameState([], [], createWindsweptValley()),
      pendingStageTrigger: {
        playerId: 'player-one' as const,
        sourceInstanceId: 'st5-022',
        sourceCardName: 'Windswept Valley',
        effectText: 'trigger',
      },
    }

    expect(() =>
      applyGameCommand(state, {
        kind: 'resolve-stage-trigger',
        playerId: 'player-two',
        action: 'skip',
      }),
    ).toThrow('不是目前需要執行決策的玩家')
  })

  it('cannot manually activate a triggered stage ability', () => {
    const state = createTestGameState([], [], createWindsweptValley())
    expect(canActivateStage(state, 'player-one')).toBe(false)
  })
})
