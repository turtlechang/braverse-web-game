import { describe, expect, it } from 'vitest'
import {
  advancePhase,
  processEndPhaseEffects,
  refreshDeck,
  type CookieCard,
  type GameCard,
  type GameState,
} from '.'

const item = (instanceId: string): GameCard => ({
  id: instanceId,
  instanceId,
  name: instanceId,
  type: 'item',
})

const cookie = (instanceId: string): CookieCard => ({
  id: instanceId,
  instanceId,
  name: instanceId,
  type: 'cookie',
  level: 1,
  hp: 1,
  attack: 1,
  attackCost: 1,
})

const createTurnState = (): GameState => {
  const emptyPlayer = (id: 'player-one' | 'player-two') => ({
    id,
    name: id,
    deck: [item('deck-a'), item('deck-b'), item('deck-c')],
    hand: [cookie('dummy')],
    battleArea: [],
    supportArea: [],
    breakArea: [],
    discardPile: [],
    stage: null,
    hasMulliganed: true,
    startingCookieSelected: true,
  })

  return {
    players: {
      'player-one': emptyPlayer('player-one'),
      'player-two': emptyPlayer('player-two'),
    },
    firstPlayerId: 'player-one',
    activePlayerId: 'player-one',
    turnNumber: 1,
    phase: 'end',
    status: 'playing',
    result: null,
    supportPlacedThisTurn: false,
    skillUsesThisTurn: [],
    nextBattleEntrySequence: 1,
    attackModifiers: [],
    damageReceivedModifiers: [],
    flipDisabledUntilTurn: {},
    skipAttackUntilTurn: {},
    pendingReplacement: null,
    departedCookieCounts: {
      'player-one': 0,
      'player-two': 0,
    },
    pendingRefresh: null,
    pendingOnPlay: null,
    pendingBattle: null,
  }
}

describe('end phase effects', () => {
  it('triggers end-of-turn draw for active player cookie', () => {
    let state = createTurnState()
    const endPhaseCookie: CookieCard = {
      ...cookie('end-phase-cookie'),
      skill: {
        trigger: 'passive',
        oncePerTurn: false,
        yourTurn: false,
        restSource: false,
        cost: { energy: {}, discardHand: 0 },
        text: 'At the end of your turn, draw 1 card.',
        effects: [{ kind: 'draw', amount: 1 }],
        endPhase: true,
      },
    }
    state.players['player-one'].battleArea = [
      {
        card: endPhaseCookie,
        hpCards: [item('hp')],
        rested: false,
      },
    ]
    state.players['player-one'].deck = [item('draw-card'), item('deck-2')]

    const beforeDraw = state.players['player-one'].hand.length
    state = processEndPhaseEffects(state)

    expect(state.players['player-one'].hand.length).toBe(beforeDraw + 1)
    expect(state.players['player-one'].hand).toContainEqual(
      expect.objectContaining({ instanceId: 'draw-card' }),
    )
    expect(state.skillUsesThisTurn).toContain(endPhaseCookie.instanceId)
  })

  it('triggers end-of-turn effect for opponent cookie after active player', () => {
    let state = createTurnState()
    const activeCookie: CookieCard = {
      ...cookie('active-end'),
      skill: {
        trigger: 'passive',
        oncePerTurn: false,
        yourTurn: false,
        restSource: false,
        cost: { energy: {}, discardHand: 0 },
        text: 'At the end of your turn, draw 1 card.',
        effects: [{ kind: 'draw', amount: 1 }],
        endPhase: true,
      },
    }
    const opponentCookie: CookieCard = {
      ...cookie('opponent-end'),
      skill: {
        trigger: 'passive',
        oncePerTurn: false,
        yourTurn: false,
        restSource: false,
        cost: { energy: {}, discardHand: 0 },
        text: 'At the end of your turn, draw 1 card.',
        effects: [{ kind: 'draw', amount: 1 }],
        endPhase: true,
      },
    }
    state.players['player-one'].battleArea = [
      {
        card: activeCookie,
        hpCards: [item('hp-a')],
        rested: false,
      },
    ]
    state.players['player-two'].battleArea = [
      {
        card: opponentCookie,
        hpCards: [item('hp-b')],
        rested: false,
      },
    ]
    state.players['player-one'].deck = [item('draw-1'), item('draw-extra')]
    state.players['player-one'].discardPile = [cookie('refresh-cookie')]
    state.players['player-two'].deck = [item('draw-2'), item('draw-extra-2')]
    state.players['player-two'].discardPile = [cookie('refresh-cookie')]

    state = processEndPhaseEffects(state)

    expect(state.status).toBe('playing')
    expect(state.pendingRefresh).toBeNull()
    expect(state.players['player-one'].hand).toContainEqual(
      expect.objectContaining({ instanceId: 'draw-1' }),
    )
    expect(state.players['player-two'].hand).toContainEqual(
      expect.objectContaining({ instanceId: 'draw-2' }),
    )
    expect(state.skillUsesThisTurn).toContain(activeCookie.instanceId)
    expect(state.skillUsesThisTurn).toContain(opponentCookie.instanceId)
  })

  it('does not trigger end-of-turn effect twice in the same turn', () => {
    let state = createTurnState()
    const endPhaseCookie: CookieCard = {
      ...cookie('end-phase-cookie'),
      skill: {
        trigger: 'passive',
        oncePerTurn: false,
        yourTurn: false,
        restSource: false,
        cost: { energy: {}, discardHand: 0 },
        text: 'At the end of your turn, draw 1 card.',
        effects: [{ kind: 'draw', amount: 1 }],
        endPhase: true,
      },
    }
    state.players['player-one'].battleArea = [
      {
        card: endPhaseCookie,
        hpCards: [item('hp')],
        rested: false,
      },
    ]
    state.players['player-one'].deck = [item('draw-1')]
    state.players['player-one'].discardPile = [cookie('refresh-cookie')]

    state = processEndPhaseEffects(state)
    const afterFirst = state.players['player-one'].hand.length

    state = processEndPhaseEffects(state)
    expect(state.players['player-one'].hand.length).toBe(afterFirst)
  })

  it('pauses end phase when draw triggers deck refresh', () => {
    let state = createTurnState()
    const endPhaseCookie: CookieCard = {
      ...cookie('end-phase-cookie'),
      skill: {
        trigger: 'passive',
        oncePerTurn: false,
        yourTurn: false,
        restSource: false,
        cost: { energy: {}, discardHand: 0 },
        text: 'At the end of your turn, draw 1 card.',
        effects: [{ kind: 'draw', amount: 1 }],
        endPhase: true,
      },
    }
    const refreshCookie = cookie('refresh-cookie')
    state.players['player-one'].battleArea = [
      {
        card: endPhaseCookie,
        hpCards: [item('hp')],
        rested: false,
      },
    ]
    state.players['player-one'].deck = []
    state.players['player-one'].discardPile = [
      refreshCookie,
      item('recycled'),
    ]

    state = processEndPhaseEffects(state)

    expect(state.pendingRefresh?.playerId).toBe('player-one')
    expect(state.skillUsesThisTurn).toContain(endPhaseCookie.instanceId)
  })

  it('advances to next turn after end phase effects complete', () => {
    let state = createTurnState()
    const endPhaseCookie: CookieCard = {
      ...cookie('end-phase-cookie'),
      skill: {
        trigger: 'passive',
        oncePerTurn: false,
        yourTurn: false,
        restSource: false,
        cost: { energy: {}, discardHand: 0 },
        text: 'At the end of your turn, draw 1 card.',
        effects: [{ kind: 'draw', amount: 1 }],
        endPhase: true,
      },
    }
    state.players['player-one'].battleArea = [
      {
        card: endPhaseCookie,
        hpCards: [item('hp')],
        rested: false,
      },
    ]
    state.players['player-one'].deck = [item('draw-1')]

    state = advancePhase(state)

    expect(state.phase).toBe('active')
    expect(state.turnNumber).toBe(2)
    expect(state.activePlayerId).toBe('player-two')
    expect(state.skillUsesThisTurn).toHaveLength(0)
    expect(state.players['player-one'].hand).toContainEqual(
      expect.objectContaining({ instanceId: 'draw-1' }),
    )
  })

  it('resumes end phase after refresh is completed', () => {
    let state = createTurnState()
    const endPhaseCookie: CookieCard = {
      ...cookie('end-phase-cookie'),
      skill: {
        trigger: 'passive',
        oncePerTurn: false,
        yourTurn: false,
        restSource: false,
        cost: { energy: {}, discardHand: 0 },
        text: 'At the end of your turn, draw 1 card.',
        effects: [{ kind: 'draw', amount: 1 }],
        endPhase: true,
      },
    }
    const refreshCookie = cookie('refresh-cookie')
    state.players['player-one'].battleArea = [
      {
        card: endPhaseCookie,
        hpCards: [item('hp')],
        rested: false,
      },
    ]
    state.players['player-one'].deck = []
    state.players['player-one'].discardPile = [
      refreshCookie,
      item('recycled'),
    ]
    state.players['player-two'].battleArea = [
      {
        card: cookie('opponent-cookie'),
        hpCards: [item('opponent-hp')],
        rested: false,
      },
    ]

    state = advancePhase(state)
    expect(state.pendingRefresh?.playerId).toBe('player-one')
    expect(state.phase).toBe('end')

    state = refreshDeck(
      state,
      'player-one',
      refreshCookie.instanceId,
      (cards) => [...cards],
    )

    expect(state.players['player-one'].discardPile.length).toBe(0)
    expect(state.players['player-one'].breakArea.length).toBe(1)
    expect(state.pendingRefresh).toBeNull()
    expect(state.result).toBeNull()
    expect(state.status).toBe('playing')
    expect(state.phase).toBe('end')

    state = advancePhase(state)
    expect(state.phase).toBe('active')
    expect(state.turnNumber).toBe(2)
  })
})
