import { describe, expect, it } from 'vitest'
import {
  createDemoGame,
  deployCookie,
  executeCardEffect,
  finalizePendingReplacements,
  refreshDeck,
  replaceDefeatedCookie,
  skipDefeatedCookieReplacement,
  skipCookieOnPlay,
  type CookieCard,
  type GameCard,
  type GameState,
} from '.'

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

const item = (instanceId: string): GameCard => ({
  id: instanceId,
  instanceId,
  name: instanceId,
  type: 'item',
})

const createReplacementState = (): GameState => {
  const state = createDemoGame()
  return {
    ...state,
    activePlayerId: 'player-two',
    pendingBattle: null,
    pendingRefresh: null,
    pendingOnPlay: null,
    pendingReplacement: null,
    departedCookieCounts: {
      'player-one': 0,
      'player-two': 0,
    },
  }
}

describe('replacement sequence', () => {
  it('queues the active player before the non-active player', () => {
    const state = finalizePendingReplacements({
      ...createReplacementState(),
      departedCookieCounts: {
        'player-one': 1,
        'player-two': 1,
      },
    })

    expect(state.pendingReplacement?.tasks).toEqual([
      { playerId: 'player-two', remaining: 1 },
      { playerId: 'player-one', remaining: 1 },
    ])
  })

  it('places as many Cookies as left the battle area', () => {
    let state = createReplacementState()
    state = {
      ...state,
      activePlayerId: 'player-one',
      players: {
        ...state.players,
        'player-one': {
          ...state.players['player-one'],
          deck: [item('hp-a'), item('hp-b'), item('hp-c')],
          hand: [cookie('replacement-a'), cookie('replacement-b')],
          battleArea: [],
        },
      },
      departedCookieCounts: {
        'player-one': 2,
        'player-two': 0,
      },
    }

    state = finalizePendingReplacements(state)
    expect(state.pendingReplacement?.tasks[0]).toEqual({
      playerId: 'player-one',
      remaining: 2,
    })

    state = replaceDefeatedCookie(state, 'replacement-a')
    expect(state.players['player-one'].battleArea).toHaveLength(1)
    expect(state.pendingReplacement?.tasks[0]?.remaining).toBe(1)

    state = replaceDefeatedCookie(state, 'replacement-b')
    expect(state.players['player-one'].battleArea).toHaveLength(2)
    expect(state.pendingReplacement).toBeNull()
  })

  it('replaces a departed Cookie even when another Cookie remains', () => {
    let state = createReplacementState()
    const remainingCookie = state.players['player-one'].battleArea[0]
    state = {
      ...state,
      activePlayerId: 'player-one',
      players: {
        ...state.players,
        'player-one': {
          ...state.players['player-one'],
          deck: [item('hp-a'), item('hp-b')],
          hand: [cookie('replacement')],
          battleArea: [remainingCookie],
        },
      },
      departedCookieCounts: {
        'player-one': 1,
        'player-two': 0,
      },
    }

    state = finalizePendingReplacements(state)
    state = replaceDefeatedCookie(state, 'replacement')

    expect(state.players['player-one'].battleArea).toHaveLength(2)
    expect(state.pendingReplacement).toBeNull()
  })

  it('allows a player to skip a remaining replacement while another Cookie remains', () => {
    let state = createReplacementState()
    state = {
      ...state,
      activePlayerId: 'player-one',
      players: {
        ...state.players,
        'player-one': {
          ...state.players['player-one'],
          deck: [item('hp-a'), item('hp-b')],
          hand: [cookie('only-replacement')],
          battleArea: [],
        },
      },
      departedCookieCounts: {
        'player-one': 2,
        'player-two': 0,
      },
    }

    state = finalizePendingReplacements(state)
    state = replaceDefeatedCookie(state, 'only-replacement')

    expect(state.status).toBe('playing')
    expect(state.pendingReplacement?.tasks[0]?.remaining).toBe(1)

    state = skipDefeatedCookieReplacement(state)

    expect(state.status).toBe('playing')
    expect(state.pendingReplacement).toBeNull()
    expect(state.players['player-one'].battleArea).toHaveLength(1)
  })

  it('requires a legal replacement when declining would leave the battle area empty', () => {
    let state = createReplacementState()
    state = {
      ...state,
      activePlayerId: 'player-one',
      players: {
        ...state.players,
        'player-one': {
          ...state.players['player-one'],
          deck: [item('hp-a'), item('hp-b')],
          hand: [cookie('available-replacement')],
          battleArea: [],
        },
      },
      departedCookieCounts: {
        'player-one': 1,
        'player-two': 0,
      },
    }

    state = finalizePendingReplacements(state)
    expect(() => skipDefeatedCookieReplacement(state)).toThrow(
      '戰鬥區沒有餅乾時必須先補位',
    )
    state = replaceDefeatedCookie(state, 'available-replacement')

    expect(state.status).toBe('playing')
    expect(state.pendingReplacement).toBeNull()
    expect(state.players['player-one'].battleArea).toHaveLength(1)
    expect(state.players['player-one'].battleArea[0].card.instanceId).toBe(
      'available-replacement',
    )
  })

  it('defeats an empty player after confirming there is no legal replacement', () => {
    let state = createReplacementState()
    state = {
      ...state,
      activePlayerId: 'player-one',
      players: {
        ...state.players,
        'player-one': {
          ...state.players['player-one'],
          deck: [item('hp')],
          hand: [item('not-a-cookie')],
          battleArea: [],
        },
      },
      departedCookieCounts: {
        'player-one': 1,
        'player-two': 0,
      },
    }

    state = finalizePendingReplacements(state)
    expect(state.status).toBe('playing')

    state = skipDefeatedCookieReplacement(state)

    expect(state.status).toBe('finished')
    expect(state.result).toEqual({
      winnerId: 'player-two',
      loserId: 'player-one',
      reason: 'no-cookie-available',
    })
  })

  it('pauses the replacement queue for OnPlay resolution', () => {
    let state = createReplacementState()
    const onPlayReplacement: CookieCard = {
      ...cookie('on-play-replacement'),
      skill: {
        trigger: 'on-play',
        oncePerTurn: false,
        yourTurn: false,
        restSource: false,
        cost: { energy: {}, discardHand: 0 },
        text: 'OnPlay',
        effects: [],
      },
    }
    state = {
      ...state,
      activePlayerId: 'player-one',
      players: {
        ...state.players,
        'player-one': {
          ...state.players['player-one'],
          deck: [item('hp-a'), item('hp-b'), item('hp-c')],
          hand: [onPlayReplacement, cookie('next-replacement')],
          battleArea: [],
        },
      },
      departedCookieCounts: {
        'player-one': 2,
        'player-two': 0,
      },
    }

    state = finalizePendingReplacements(state)
    state = replaceDefeatedCookie(state, onPlayReplacement.instanceId)

    expect(state.pendingOnPlay).toEqual({
      playerId: 'player-one',
      sourceInstanceId: onPlayReplacement.instanceId,
    })
    expect(state.pendingReplacement?.tasks[0]?.remaining).toBe(1)

    state = skipCookieOnPlay(
      state,
      'player-one',
      onPlayReplacement.instanceId,
    )

    expect(state.pendingOnPlay).toBeNull()
    expect(state.pendingReplacement?.tasks[0]?.remaining).toBe(1)
  })

  it('resumes remaining replacements after Refresh', () => {
    let state = createReplacementState()
    const refreshCookie = cookie('refresh-cookie')
    state = {
      ...state,
      activePlayerId: 'player-one',
      players: {
        ...state.players,
        'player-one': {
          ...state.players['player-one'],
          deck: [item('first-hp')],
          hand: [cookie('replacement-a'), cookie('replacement-b')],
          battleArea: [],
          discardPile: [refreshCookie, item('recycled-hp')],
        },
      },
      departedCookieCounts: {
        'player-one': 2,
        'player-two': 0,
      },
    }

    state = finalizePendingReplacements(state)
    state = replaceDefeatedCookie(state, 'replacement-a')

    expect(state.pendingRefresh?.playerId).toBe('player-one')
    expect(state.pendingReplacement?.tasks[0]?.remaining).toBe(1)

    state = refreshDeck(
      state,
      'player-one',
      refreshCookie.instanceId,
      (cards) => [...cards],
    )

    expect(state.pendingRefresh).toBeNull()
    expect(state.pendingReplacement?.tasks[0]?.remaining).toBe(1)
  })

  it('does not judge the non-active player before the active player finishes Refresh', () => {
    let state = createReplacementState()
    const refreshCookie = cookie('refresh-cookie')
    state = {
      ...state,
      activePlayerId: 'player-one',
      players: {
        'player-one': {
          ...state.players['player-one'],
          deck: [item('first-hp')],
          hand: [cookie('active-replacement')],
          battleArea: [],
          discardPile: [refreshCookie, item('recycled-card')],
        },
        'player-two': {
          ...state.players['player-two'],
          hand: [],
          battleArea: [],
        },
      },
      departedCookieCounts: {
        'player-one': 1,
        'player-two': 1,
      },
    }

    state = finalizePendingReplacements(state)
    expect(state.status).toBe('playing')
    expect(state.pendingReplacement?.tasks[0]?.playerId).toBe('player-one')

    state = replaceDefeatedCookie(state, 'active-replacement')
    expect(state.pendingRefresh?.playerId).toBe('player-one')
    expect(state.status).toBe('playing')

    state = refreshDeck(
      state,
      'player-one',
      refreshCookie.instanceId,
      (cards) => [...cards],
    )

    expect(state.status).toBe('playing')
    expect(state.pendingReplacement?.tasks[0]?.playerId).toBe('player-two')

    state = skipDefeatedCookieReplacement(state)

    expect(state.status).toBe('finished')
    expect(state.result?.loserId).toBe('player-two')
  })

  it('records effect damage departures until the effect sequence finishes', () => {
    let state = createReplacementState()
    const firstTarget = {
      ...state.players['player-two'].battleArea[0],
      hpCards: [item('target-hp')],
    }
    const secondTarget = {
      ...firstTarget,
      card: cookie('remaining-cookie'),
      battleEntryId: 'remaining-cookie:battle:test',
    }
    state = {
      ...state,
      players: {
        ...state.players,
        'player-two': {
          ...state.players['player-two'],
          battleArea: [firstTarget, secondTarget],
          hand: [cookie('effect-replacement')],
          deck: [item('replacement-hp')],
        },
      },
    }

    state = executeCardEffect(
      state,
      {
        sourcePlayerId: 'player-one',
        sourceInstanceId:
          state.players['player-one'].battleArea[0].card.instanceId,
      },
      {
        kind: 'damage',
        amount: 1,
        target: {
          side: 'opponent',
          min: 1,
          max: 1,
        },
      },
      [firstTarget.card.instanceId],
    )

    expect(state.pendingReplacement).toBeNull()
    expect(state.departedCookieCounts['player-two']).toBe(1)

    state = finalizePendingReplacements(state)
    expect(state.pendingReplacement?.tasks[0]).toEqual({
      playerId: 'player-two',
      remaining: 1,
    })
  })

  it('allows replacement even when deck has fewer cards than cookie HP', () => {
    let state = createReplacementState()
    const replacementCookie: CookieCard = {
      ...cookie('hp3-replacement'),
      hp: 3,
    }
    const refreshCookie = cookie('refresh-cookie')
    state = {
      ...state,
      activePlayerId: 'player-one',
      players: {
        ...state.players,
        'player-one': {
          ...state.players['player-one'],
          deck: [item('partial-hp-a')],
          hand: [replacementCookie],
          battleArea: [],
          discardPile: [refreshCookie, item('recycled-hp-b'), item('recycled-hp-c')],
        },
      },
      departedCookieCounts: {
        'player-one': 1,
        'player-two': 0,
      },
    }

    state = finalizePendingReplacements(state)
    state = replaceDefeatedCookie(state, replacementCookie.instanceId)

    expect(state.players['player-one'].battleArea[0].hpCards).toHaveLength(1)
    expect(state.pendingRefresh?.playerId).toBe('player-one')

    state = refreshDeck(
      state,
      'player-one',
      refreshCookie.instanceId,
      (cards) => [...cards],
    )

    expect(state.pendingRefresh).toBeNull()
    expect(state.players['player-one'].battleArea[0].hpCards).toHaveLength(3)
    expect(state.pendingReplacement).toBeNull()
  })

  it('deploys a cookie from hand even when deck has fewer cards than HP', () => {
    let state = createReplacementState()
    const cookieToDeploy: CookieCard = {
      ...cookie('deploy-hp3'),
      hp: 3,
    }
    const refreshCookie = cookie('refresh-cookie')
    state = {
      ...state,
      activePlayerId: 'player-one',
      phase: 'main',
      players: {
        ...state.players,
        'player-one': {
          ...state.players['player-one'],
          deck: [item('partial-hp-a')],
          hand: [cookieToDeploy],
          battleArea: [],
          discardPile: [refreshCookie, item('recycled-hp-b'), item('recycled-hp-c')],
        },
      },
    }

    state = deployCookie(state, cookieToDeploy.instanceId)

    expect(state.players['player-one'].battleArea[0].hpCards).toHaveLength(1)
    expect(state.pendingRefresh?.playerId).toBe('player-one')

    state = refreshDeck(
      state,
      'player-one',
      refreshCookie.instanceId,
      (cards) => [...cards],
    )

    expect(state.pendingRefresh).toBeNull()
    expect(state.players['player-one'].battleArea[0].hpCards).toHaveLength(3)
  })
})
