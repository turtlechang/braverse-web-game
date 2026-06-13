import { describe, expect, it } from 'vitest'
import {
  createDemoGame,
  executeCardEffect,
  getBreakToTrashCandidates,
  isEffectConditionMet,
  isEffectUntargeted,
  validateBreakToTrashTargets,
  type CardEffect,
} from '.'

describe('break-to-trash effect', () => {
  const bttContext = {
    sourcePlayerId: 'player-one' as const,
    sourceInstanceId: 'player-one-btt-source',
  }

  const effect: CardEffect = {
    kind: 'break-to-trash',
    max: 1,
    exactLevel: 1,
  }

  it('moves selected break area card to discard pile', () => {
    let state = createDemoGame()
    const lv1Card = {
      ...state.players['player-one'].battleArea[0].card,
      instanceId: 'break-lv1-test',
      level: 1,
    }
    state = {
      ...state,
      players: {
        ...state.players,
        'player-one': {
          ...state.players['player-one'],
          breakArea: [lv1Card],
        },
      },
    }

    const initialDiscardLen =
      state.players['player-one'].discardPile.length
    const newState = executeCardEffect(state, bttContext, effect, [
      lv1Card.instanceId,
    ])

    expect(newState.players['player-one'].breakArea).toHaveLength(0)
    expect(newState.players['player-one'].discardPile).toHaveLength(
      initialDiscardLen + 1,
    )
    expect(
      newState.players['player-one'].discardPile.find(
        (c) => c.instanceId === lv1Card.instanceId,
      ),
    ).toBeDefined()
  })

  it('allows selecting 0 targets and does nothing', () => {
    let state = createDemoGame()
    const lv1Card = {
      ...state.players['player-one'].battleArea[0].card,
      instanceId: 'break-lv1-test',
      level: 1,
    }
    state = {
      ...state,
      players: {
        ...state.players,
        'player-one': {
          ...state.players['player-one'],
          breakArea: [lv1Card],
        },
      },
    }

    const newState = executeCardEffect(state, bttContext, effect, [])

    expect(newState.players['player-one'].breakArea).toHaveLength(1)
    expect(newState).not.toBe(state)
  })

  it('rejects duplicate target instanceIds', () => {
    let state = createDemoGame()
    const lv1Card = {
      ...state.players['player-one'].battleArea[0].card,
      instanceId: 'break-lv1-dup',
      level: 1,
    }
    state = {
      ...state,
      players: {
        ...state.players,
        'player-one': {
          ...state.players['player-one'],
          breakArea: [lv1Card],
        },
      },
    }

    expect(() =>
      executeCardEffect(state, bttContext, effect, [
        lv1Card.instanceId,
        lv1Card.instanceId,
      ]),
    ).toThrow('目標數量不合法')
  })

  it('rejects targets with level > exactLevel', () => {
    let state = createDemoGame()
    const lv2Card = {
      ...state.players['player-one'].battleArea[0].card,
      instanceId: 'break-lv2-test',
      level: 2,
    }
    state = {
      ...state,
      players: {
        ...state.players,
        'player-one': {
          ...state.players['player-one'],
          breakArea: [lv2Card],
        },
      },
    }

    expect(() =>
      executeCardEffect(state, bttContext, effect, [
        lv2Card.instanceId,
      ]),
    ).toThrow('不是此效果的合法目標')
  })

  it('rejects targets not in own break area', () => {
    const state = createDemoGame()

    expect(() =>
      executeCardEffect(
        state,
        bttContext,
        effect,
        ['non-existent-instance'],
      ),
    ).toThrow('不是此效果的合法目標')
  })

  it('rejects selecting more than max', () => {
    let state = createDemoGame()
    const card1 = {
      ...state.players['player-one'].battleArea[0].card,
      instanceId: 'break-lv1-a',
      level: 1,
    }
    const card2 = {
      ...state.players['player-one'].battleArea[0].card,
      instanceId: 'break-lv1-b',
      level: 1,
    }
    state = {
      ...state,
      players: {
        ...state.players,
        'player-one': {
          ...state.players['player-one'],
          breakArea: [card1, card2],
        },
      },
    }

    expect(() =>
      executeCardEffect(state, bttContext, effect, [
        card1.instanceId,
        card2.instanceId,
      ]),
    ).toThrow('目標數量不合法')
  })

  it('enforces break-level condition when present', () => {
    let state = createDemoGame()
    const lv1Card = {
      ...state.players['player-one'].battleArea[0].card,
      instanceId: 'break-lv1-cond',
      level: 1,
    }
    state = {
      ...state,
      players: {
        ...state.players,
        'player-one': {
          ...state.players['player-one'],
          breakArea: [lv1Card],
        },
      },
    }

    const conditionalEffect: CardEffect = {
      kind: 'break-to-trash',
      max: 1,
      exactLevel: 1,
      condition: {
        kind: 'break-level-at-least',
        level: 6,
      },
    }

    expect(
      isEffectConditionMet(state, bttContext, conditionalEffect),
    ).toBe(false)
    expect(() =>
      executeCardEffect(state, bttContext, conditionalEffect, [
        lv1Card.instanceId,
      ]),
    ).toThrow('尚未滿足')

    state = {
      ...state,
      players: {
        ...state.players,
        'player-one': {
          ...state.players['player-one'],
          breakArea: [
            lv1Card,
            { ...lv1Card, instanceId: 'lv5-card', level: 5 },
          ],
        },
      },
    }

    expect(
      isEffectConditionMet(state, bttContext, conditionalEffect),
    ).toBe(true)
    expect(
      executeCardEffect(state, bttContext, conditionalEffect, [
        lv1Card.instanceId,
      ]).players['player-one'].breakArea,
    ).toHaveLength(1)
  })

  it('resolves victory after moving break area card and reaching level 10', () => {
    let state = createDemoGame()
    const lv1Card = {
      ...state.players['player-one'].battleArea[0].card,
      instanceId: 'break-lv1-v',
      level: 1,
    }
    const lv9Card = {
      ...state.players['player-one'].battleArea[0].card,
      instanceId: 'lv9-card',
      level: 9,
    }
    state = {
      ...state,
      players: {
        ...state.players,
        'player-one': {
          ...state.players['player-one'],
          breakArea: [lv1Card, lv9Card],
        },
      },
    }

    const newState = executeCardEffect(state, bttContext, effect, [
      lv1Card.instanceId,
    ])

    expect(newState.players['player-one'].breakArea).toEqual([lv9Card])
    expect(newState.status).toBe('playing')
  })

  it('does not mutate the input game state', () => {
    let state = createDemoGame()
    const lv1Card = {
      ...state.players['player-one'].battleArea[0].card,
      instanceId: 'break-lv1-imm',
      level: 1,
    }
    state = {
      ...state,
      players: {
        ...state.players,
        'player-one': {
          ...state.players['player-one'],
          breakArea: [lv1Card],
        },
      },
    }

    const initialBreak = [...state.players['player-one'].breakArea]
    const initialDiscard = [...state.players['player-one'].discardPile]

    executeCardEffect(state, bttContext, effect, [lv1Card.instanceId])

    expect(state.players['player-one'].breakArea).toEqual(initialBreak)
    expect(state.players['player-one'].discardPile).toEqual(initialDiscard)
  })

  it('does not finish the game when moving does not reach break level 10', () => {
    let state = createDemoGame()
    const lv1Card = {
      ...state.players['player-one'].battleArea[0].card,
      instanceId: 'break-lv1-safe',
      level: 1,
    }
    state = {
      ...state,
      players: {
        ...state.players,
        'player-one': {
          ...state.players['player-one'],
          breakArea: [lv1Card],
        },
      },
    }

    const newState = executeCardEffect(state, bttContext, effect, [
      lv1Card.instanceId,
    ])

    expect(newState.status).toBe('playing')
  })

  it('does not recover a finished state after effect', () => {
    let state = createDemoGame()
    state = { ...state, status: 'finished' as const }

    expect(() =>
      executeCardEffect(state, bttContext, effect, []),
    ).toThrow('只有進行中的遊戲可以執行卡牌效果')
  })

  it('getBreakToTrashCandidates filters by exactLevel', () => {
    let state = createDemoGame()
    const lv1Card = {
      ...state.players['player-one'].battleArea[0].card,
      instanceId: 'c-lv1',
      level: 1,
    }
    const lv2Card = {
      ...state.players['player-one'].battleArea[0].card,
      instanceId: 'c-lv2',
      level: 2,
    }
    state = {
      ...state,
      players: {
        ...state.players,
        'player-one': {
          ...state.players['player-one'],
          breakArea: [lv1Card, lv2Card],
        },
      },
    }

    const candidates = getBreakToTrashCandidates(
      state,
      bttContext,
      { kind: 'break-to-trash', max: 1, exactLevel: 1 },
    )

    expect(candidates).toHaveLength(1)
    expect(candidates[0].instanceId).toBe('c-lv1')
  })

  it('validateBreakToTrashTargets throws on duplicate ids', () => {
    expect(() =>
      validateBreakToTrashTargets(
        createDemoGame(),
        bttContext,
        { kind: 'break-to-trash', max: 1, exactLevel: 1 },
        ['id', 'id'],
      ),
    ).toThrow('目標數量不合法')
  })

  it('isEffectUntargeted returns false for break-to-trash', () => {
    expect(
      isEffectUntargeted({
        kind: 'break-to-trash',
        max: 1,
        exactLevel: 1,
      }),
    ).toBe(false)
  })
})