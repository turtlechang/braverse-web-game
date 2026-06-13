import { describe, expect, it } from 'vitest'
import {
  createDemoGame,
  takeAiStep,
  type CardEffect,
  type CardSkill,
  type GameCard,
  type GameState,
} from '.'

describe('AI break-to-trash target selection', () => {
  const bttEffect: CardEffect = {
    kind: 'break-to-trash',
    max: 1,
    exactLevel: 1,
  }

  const bttSkill: CardSkill = {
    trigger: 'activate',
    oncePerTurn: false,
    yourTurn: false,
    restSource: false,
    cost: {},
    text: 'Test break-to-trash',
    effects: [bttEffect],
  }

  it('selects 1 break area target when candidates exist', () => {
    let state = createDemoGame()
    const aiCookie = {
      ...state.players['player-two'].battleArea[0].card,
      skill: bttSkill,
      effects: [bttEffect],
    }
    const lv1Card = {
      ...state.players['player-two'].battleArea[0].card,
      instanceId: 'ai-break-lv1',
      level: 1,
    }

    state = {
      ...state,
      activePlayerId: 'player-two',
      phase: 'main',
      players: {
        ...state.players,
        'player-two': {
          ...state.players['player-two'],
          battleArea: [{ ...state.players['player-two'].battleArea[0], card: aiCookie }],
          breakArea: [lv1Card],
          hand: state.players['player-two'].hand.filter(
            (c) => c.type !== 'cookie',
          ),
        },
      },
    }

    const decision = takeAiStep(state, 'player-two')

    expect(decision.action).toBe('activate-skill')
    expect(decision.effectSelections).toBeDefined()
    expect(decision.effectSelections![0].targetIds).toEqual([lv1Card.instanceId])
    expect(decision.state.players['player-two'].breakArea).toHaveLength(0)
    expect(decision.state.players['player-two'].discardPile).toHaveLength(
      state.players['player-two'].discardPile.length + 1,
    )
  })

  it('resolves faint effect by selecting lowest HP opponent target', () => {
    const base = createDemoGame()
    const targetCookie = base.players['player-one'].battleArea[0]
    const faintCookie: GameCard & { skill: CardSkill } = {
      ...base.players['player-two'].battleArea[0].card,
      skill: {
        trigger: 'passive',
        oncePerTurn: false,
        yourTurn: false,
        restSource: false,
        cost: {},
        text: 'When this Cookie faints, select up to 1 of your opponent\'s Cookies. That Cookie receives 1 damage.',
        effects: [
          {
            kind: 'damage',
            amount: 1,
            target: { side: 'opponent', min: 0, max: 1 },
          },
        ],
        faint: true,
      },
    }
    const state: GameState = {
      ...base,
      activePlayerId: 'player-two',
      phase: 'main',
      pendingFaintEffects: [
        {
          sourcePlayerId: 'player-two',
          sourceInstanceId: faintCookie.instanceId,
          effect: {
            kind: 'damage',
            amount: 1,
            target: { side: 'opponent', min: 0, max: 1 },
          },
          context: {
            sourcePlayerId: 'player-two',
            sourceInstanceId: faintCookie.instanceId,
          },
        },
      ],
      players: {
        ...base.players,
        'player-two': {
          ...base.players['player-two'],
          battleArea: [],
          breakArea: [faintCookie],
          hand: base.players['player-two'].hand.filter(
            (c) => c.type !== 'cookie',
          ),
        },
      },
    }

    const decision = takeAiStep(state, 'player-two')

    expect(decision.action).toBe('resolve-faint')
    expect(
      decision.state.players['player-one'].battleArea[0].hpCards.length,
    ).toBe(targetCookie.hpCards.length - 1)
  })

  it('skips faint effect when target min is 0 and no candidates wanted', () => {
    const base = createDemoGame()
    const state: GameState = {
      ...base,
      activePlayerId: 'player-two',
      phase: 'main',
      pendingFaintEffects: [
        {
          sourcePlayerId: 'player-two',
          sourceInstanceId: 'faint-cookie',
          effect: {
            kind: 'damage',
            amount: 1,
            target: { side: 'opponent', min: 0, max: 1 },
          },
          context: {
            sourcePlayerId: 'player-two',
            sourceInstanceId: 'faint-cookie',
          },
        },
      ],
      players: {
        ...base.players,
        'player-two': {
          ...base.players['player-two'],
          battleArea: [],
          breakArea: [],
          hand: base.players['player-two'].hand.filter(
            (c) => c.type !== 'cookie',
          ),
        },
        'player-one': {
          ...base.players['player-one'],
          battleArea: [],
        },
      },
    }

    const decision = takeAiStep(state, 'player-two')

    expect(decision.action).toBe('resolve-faint')
    expect(decision.state.pendingFaintEffects).toBeUndefined()
  })

  it('waits for the correct player to resolve faint effect', () => {
    const base = createDemoGame()
    const state: GameState = {
      ...base,
      activePlayerId: 'player-two',
      phase: 'main',
      pendingFaintEffects: [
        {
          sourcePlayerId: 'player-one',
          sourceInstanceId: 'p1-cookie',
          effect: {
            kind: 'damage',
            amount: 1,
            target: { side: 'opponent', min: 0, max: 1 },
          },
          context: {
            sourcePlayerId: 'player-one',
            sourceInstanceId: 'p1-cookie',
          },
        },
      ],
    }

    const decision = takeAiStep(state, 'player-two')

    expect(decision.action).toBe('idle')
    expect(decision.description).toContain('等待')
  })

  it('selects 0 break area targets when no candidates exist', () => {
    let state = createDemoGame()
    const aiCookie = {
      ...state.players['player-two'].battleArea[0].card,
      skill: bttSkill,
      effects: [bttEffect],
    }

    state = {
      ...state,
      activePlayerId: 'player-two',
      phase: 'main',
      players: {
        ...state.players,
        'player-two': {
          ...state.players['player-two'],
          battleArea: [{ ...state.players['player-two'].battleArea[0], card: aiCookie }],
          breakArea: [],
          hand: state.players['player-two'].hand.filter(
            (c) => c.type !== 'cookie',
          ),
        },
      },
    }

    const decision = takeAiStep(state, 'player-two')

    expect(decision.action).toBe('activate-skill')
    expect(decision.effectSelections![0].targetIds).toHaveLength(0)
  })
})