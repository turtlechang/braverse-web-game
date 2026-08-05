import { describe, expect, it } from 'vitest'
import {
  executeCardEffect,
  hasBlockingPending,
  isEffectConditionMet,
  processEndPhaseEffects,
  resolveOpponentRestSupport,
  type CardEffect,
  type EffectContext,
  type GameState,
  type PlayerState,
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

const makeCard = (id: string) => ({
  id,
  instanceId: id,
  name: id,
  type: 'item' as const,
})

const createTestCookie = (instanceId: string) => ({
  id: instanceId,
  instanceId,
  name: instanceId,
  type: 'cookie' as const,
  officialType: 'cookie' as const,
  level: 1,
  hp: 5,
  attack: 1,
  attackCost: 1,
  attackEnergyCost: { green: 1 },
  energyColor: 'green' as const,
})

const createTestGameState = (
  overrides: Partial<GameState> = {},
): GameState => ({
  players: {
    'player-one': createTestPlayer('player-one'),
    'player-two': createTestPlayer('player-two'),
  },
  firstPlayerId: 'player-one',
  activePlayerId: 'player-one',
  turnNumber: 2,
  phase: 'end',
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
  ...overrides,
})

describe('BS5 GREEN deferred-end-of-turn（Then, when your turn ends）', () => {
  const context: EffectContext = {
    sourcePlayerId: 'player-one',
    sourceInstanceId: 'bs5-056',
    sourceCardName: 'Longan Dragon Cookie',
  }

  it('BS5-056：攻擊結算時只把效果排進 pendingEndOfTurnEffects', () => {
    const state = createTestGameState()
    const result = executeCardEffect(
      state,
      context,
      {
        kind: 'deferred-end-of-turn',
        effects: [{ kind: 'set-active', supportCount: 1 }],
      },
      [],
    )

    expect(result.pendingEndOfTurnEffects).toHaveLength(1)
    expect(result.pendingEndOfTurnEffects?.[0]).toMatchObject({
      playerId: 'player-one',
      sourcePlayerId: 'player-one',
      sourceInstanceId: 'bs5-056',
      sourceCardName: 'Longan Dragon Cookie',
      effectIndex: 0,
      effects: [{ kind: 'set-active', supportCount: 1 }],
    })
  })

  it('延遲效果佇列不阻塞流程：processEndPhaseEffects 重入時會排空', () => {
    const state = executeCardEffect(
      createTestGameState({
        players: {
          'player-one': {
            ...createTestPlayer('player-one'),
            supportArea: [
              { card: makeCard('s1'), rested: true },
              { card: makeCard('s2'), rested: true },
            ],
          },
          'player-two': createTestPlayer('player-two'),
        },
      }),
      context,
      {
        kind: 'deferred-end-of-turn',
        effects: [{ kind: 'set-active', supportCount: 1 }],
      },
      [],
    )
    expect(hasBlockingPending(state)).toBe(false)

    const drained = processEndPhaseEffects(state)
    expect(drained.pendingEndOfTurnEffects ?? []).toHaveLength(0)
    expect(
      drained.players['player-one'].supportArea.some((entry) => !entry.rested),
    ).toBe(true)
  })

  it('回合結束流程排空佇列：需選擇的效果執行後以 effectIndex 書籤續跑', () => {
    let state = executeCardEffect(
      createTestGameState({
        players: {
          'player-one': {
            ...createTestPlayer('player-one'),
            hand: [makeCard('h1')],
          },
          'player-two': createTestPlayer('player-two'),
        },
      }),
      context,
      {
        kind: 'deferred-end-of-turn',
        effects: [{ kind: 'discard-hand', count: 1 }],
      },
      [],
    )

    state = processEndPhaseEffects(state)
    expect(state.pendingOpponentHandDiscard).toMatchObject({
      playerId: 'player-one',
      count: 1,
    })
    expect(state.pendingEndOfTurnEffects?.[0].effectIndex).toBe(1)
  })

  it('不需要選擇的效果直接執行：set-active 立即生效且佇列清空', () => {
    let state = executeCardEffect(
      createTestGameState({
        players: {
          'player-one': {
            ...createTestPlayer('player-one'),
            supportArea: [
              { card: makeCard('s1'), rested: true },
              { card: makeCard('s2'), rested: true },
            ],
          },
          'player-two': createTestPlayer('player-two'),
        },
      }),
      context,
      {
        kind: 'deferred-end-of-turn',
        effects: [{ kind: 'set-active', supportCount: 1 }],
      },
      [],
    )

    state = processEndPhaseEffects(state)
    expect(state.pendingEndOfTurnEffects ?? []).toHaveLength(0)
    expect(
      state.players['player-one'].supportArea.some((entry) => !entry.rested),
    ).toBe(true)
  })
})

describe('BS5-066 場景卡被動回合結束觸發（endPhase）', () => {
  it('回合結束流程把效果鏈交給 pendingAbilityEffect 並記 skillUsesThisTurn', () => {
    const state = createTestGameState({
      players: {
        'player-one': {
          ...createTestPlayer('player-one'),
          stage: {
            card: {
              id: 'bs5-066',
              instanceId: 'bs5-066-inst',
              name: 'Longan Palace',
              type: 'stage',
              stageAbility: {
                placementCost: { green: 1 },
                cost: {},
                text: 'When your turn ends, discard 1 card...',
                restSource: false,
                endPhase: true,
                effects: [{ kind: 'discard-hand', count: 1 }],
              },
            },
            rested: false,
          },
        },
        'player-two': createTestPlayer('player-two'),
      },
    })

    const result = processEndPhaseEffects(state)
    expect(result.pendingAbilityEffect).toMatchObject({
      playerId: 'player-one',
      sourceInstanceId: 'bs5-066-inst',
      sourceKind: 'stage',
      effects: [{ kind: 'discard-hand', count: 1 }],
    })
    expect(result.skillUsesThisTurn).toContain('bs5-066-inst')
  })

  it('條件不成立時只記已觸發，不進入 pendingAbilityEffect', () => {
    const state = createTestGameState({
      players: {
        'player-one': {
          ...createTestPlayer('player-one'),
          stage: {
            card: {
              id: 'bs5-066',
              instanceId: 'bs5-066-inst',
              name: 'Longan Palace',
              type: 'stage',
              stageAbility: {
                placementCost: { green: 1 },
                cost: {},
                text: '...',
                restSource: false,
                endPhase: true,
                effects: [
                  {
                    kind: 'draw-up-to',
                    max: 1,
                    condition: {
                      kind: 'battle-area-has-named-cookie',
                      side: 'self',
                      name: 'Longan Dragon Cookie',
                    },
                  },
                ],
              },
            },
            rested: false,
          },
        },
        'player-two': createTestPlayer('player-two'),
      },
    })

    const result = processEndPhaseEffects(state)
    expect(result.pendingAbilityEffect).toBeUndefined()
    expect(result.skillUsesThisTurn).toContain('bs5-066-inst')
  })

  it('endPhase 場景不允許手動啟動', async () => {
    const { canActivateStage } = await import('../card-abilities')
    const state = createTestGameState({
      players: {
        'player-one': {
          ...createTestPlayer('player-one'),
          stage: {
            card: {
              id: 'bs5-066',
              instanceId: 'bs5-066-inst',
              name: 'Longan Palace',
              type: 'stage',
              stageAbility: {
                placementCost: { green: 1 },
                cost: {},
                text: '...',
                restSource: false,
                endPhase: true,
                effects: [{ kind: 'discard-hand', count: 1 }],
              },
            },
            rested: false,
          },
        },
        'player-two': createTestPlayer('player-two'),
      },
    })
    expect(canActivateStage(state, 'player-one')).toBe(false)
  })
})

describe('BS5-065 opponent-rests-support（對手選擇橫置支援卡）', () => {
  const context: EffectContext = {
    sourcePlayerId: 'player-one',
    sourceInstanceId: 'bs5-065',
    sourceCardName: 'Petrification',
  }

  const supportCards = (ids: string[]) =>
    ids.map((id) => ({
      card: makeCard(id),
      rested: false,
    }))

  it('建立 pendingOpponentRestSupport 讓對手選擇', () => {
    const state = createTestGameState({
      players: {
        'player-one': createTestPlayer('player-one'),
        'player-two': {
          ...createTestPlayer('player-two'),
          supportArea: supportCards(['s1', 's2']),
        },
      },
    })

    const result = executeCardEffect(
      state,
      context,
      { kind: 'opponent-rests-support', amount: 1 },
      [],
    )
    expect(result.pendingOpponentRestSupport).toMatchObject({
      playerId: 'player-two',
      count: 1,
      sourcePlayerId: 'player-one',
      sourceInstanceId: 'bs5-065',
    })
    expect(hasBlockingPending(result)).toBe(true)
  })

  it('activeOnly 時只把啟動中的卡納入選擇', () => {
    const state = createTestGameState({
      players: {
        'player-one': createTestPlayer('player-one'),
        'player-two': {
          ...createTestPlayer('player-two'),
          supportArea: [
            { card: makeCard('s1'), rested: true },
            { card: makeCard('s2'), rested: false },
            { card: makeCard('s3'), rested: false },
          ],
        },
      },
    })

    const result = executeCardEffect(
      state,
      context,
      { kind: 'opponent-rests-support', amount: 1, activeOnly: true },
      [],
    )
    expect(result.pendingOpponentRestSupport).toMatchObject({
      playerId: 'player-two',
      count: 1,
      activeOnly: true,
    })
  })

  it('activeOnly 且沒有啟動中的支援卡時直接略過', () => {
    const state = createTestGameState({
      players: {
        'player-one': createTestPlayer('player-one'),
        'player-two': {
          ...createTestPlayer('player-two'),
          supportArea: [{ card: makeCard('s1'), rested: true }],
        },
      },
    })

    const result = executeCardEffect(
      state,
      context,
      { kind: 'opponent-rests-support', amount: 1, activeOnly: true },
      [],
    )
    expect(result.pendingOpponentRestSupport).toBeUndefined()
  })

  it('候選張數不足時直接略過', () => {
    const state = createTestGameState({
      players: {
        'player-one': createTestPlayer('player-one'),
        'player-two': {
          ...createTestPlayer('player-two'),
          supportArea: supportCards(['s1']),
        },
      },
    })

    const result = executeCardEffect(
      state,
      context,
      { kind: 'opponent-rests-support', amount: 2 },
      [],
    )
    expect(result.pendingOpponentRestSupport).toBeUndefined()
  })

  it('resolveOpponentRestSupport 橫置選定卡並清空 pending', () => {
    const state = createTestGameState({
      players: {
        'player-one': createTestPlayer('player-one'),
        'player-two': {
          ...createTestPlayer('player-two'),
          supportArea: supportCards(['s1', 's2']),
        },
      },
    })

    const withPending = executeCardEffect(
      state,
      context,
      { kind: 'opponent-rests-support', amount: 1 },
      [],
    )
    const result = resolveOpponentRestSupport(withPending, 'player-two', ['s2'])
    expect(result.pendingOpponentRestSupport).toBeNull()
    expect(
      result.players['player-two'].supportArea.find(
        (entry) => entry.card.instanceId === 's1',
      )?.rested,
    ).toBe(false)
    expect(
      result.players['player-two'].supportArea.find(
        (entry) => entry.card.instanceId === 's2',
      )?.rested,
    ).toBe(true)
  })

  it('resolve 必須是 pending 的目標玩家且張數相符', () => {
    const state = createTestGameState({
      players: {
        'player-one': createTestPlayer('player-one'),
        'player-two': {
          ...createTestPlayer('player-two'),
          supportArea: supportCards(['s1', 's2']),
        },
      },
    })

    const withPending = executeCardEffect(
      state,
      context,
      { kind: 'opponent-rests-support', amount: 1 },
      [],
    )
    expect(() =>
      resolveOpponentRestSupport(withPending, 'player-one', ['s1']),
    ).toThrow()
    expect(() =>
      resolveOpponentRestSupport(withPending, 'player-two', []),
    ).toThrow()
  })

  it('支援區 7 張以上的條件（BS5-065 Then 子句，計效果來源方支援區）', () => {
    const condition: CardEffect = {
      kind: 'opponent-rests-support',
      amount: 1,
      activeOnly: true,
      condition: { kind: 'support-count-at-least', count: 7 },
    }
    const fewState = createTestGameState({
      players: {
        'player-one': {
          ...createTestPlayer('player-one'),
          supportArea: supportCards(['s1']),
        },
        'player-two': createTestPlayer('player-two'),
      },
    })
    expect(isEffectConditionMet(fewState, context, condition)).toBe(false)

    const manyState = createTestGameState({
      players: {
        'player-one': {
          ...createTestPlayer('player-one'),
          supportArea: supportCards([
            's1', 's2', 's3', 's4', 's5', 's6', 's7',
          ]),
        },
        'player-two': createTestPlayer('player-two'),
      },
    })
    expect(isEffectConditionMet(manyState, context, condition)).toBe(true)
  })
})

describe('BS5-051 Beet 回合結束回牌庫底', () => {
  const context: EffectContext = {
    sourcePlayerId: 'player-one',
    sourceInstanceId: 'bs5-051',
  }

  it('啟動卡 2 張以上的條件', () => {
    const effect: CardEffect = {
      kind: 'return-to-deck-bottom',
      target: { side: 'self', min: 1, max: 1, sourceOnly: true },
      condition: { kind: 'active-support-count-at-least', count: 2 },
    }
    const fewState = createTestGameState()
    expect(isEffectConditionMet(fewState, context, effect)).toBe(false)

    const manyState = createTestGameState({
      players: {
        'player-one': {
          ...createTestPlayer('player-one'),
          supportArea: [
            { card: makeCard('s1'), rested: false },
            { card: makeCard('s2'), rested: false },
          ],
        },
        'player-two': createTestPlayer('player-two'),
      },
    })
    expect(isEffectConditionMet(manyState, context, effect)).toBe(true)
  })

  it('自己是戰鬥區唯一餅乾時略過而不是拋錯', () => {
    const state = createTestGameState({
      players: {
        'player-one': {
          ...createTestPlayer('player-one'),
          battleArea: [
            {
              card: createTestCookie('bs5-051'),
              rested: false,
              hpCards: [],
            },
          ],
          deck: [],
        },
        'player-two': createTestPlayer('player-two'),
      },
    })

    const result = executeCardEffect(
      state,
      context,
      {
        kind: 'return-to-deck-bottom',
        target: { side: 'self', min: 1, max: 1, sourceOnly: true },
      },
      ['bs5-051'],
    )
    expect(result.players['player-one'].battleArea).toHaveLength(1)
  })
})
