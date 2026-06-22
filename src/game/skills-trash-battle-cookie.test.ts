import { describe, expect, it } from 'vitest'
import {
  activateCookieSkill,
  canActivateCookieSkill,
  createDemoGame,
  advancePhase,
  type CardSkill,
  type GameState,
  type CookieInBattle,
} from '.'
import { GameRuleError } from './errors'

const withSkill = (
  state: GameState,
  playerId: 'player-one' | 'player-two',
  skill: CardSkill,
): GameState => {
  const player = state.players[playerId]
  const source = player.battleArea[0]
  if (!source) return state
  return {
    ...state,
    players: {
      ...state.players,
      [playerId]: {
        ...player,
        battleArea: player.battleArea.map((cookie) =>
          cookie.card.instanceId === source.card.instanceId
            ? {
                ...cookie,
                card: { ...cookie.card, skill },
              }
            : cookie,
        ),
      },
    },
  }
}

describe('trashBattleCookie cost', () => {
  it('activates skill with trashBattleCookie cost and removes cookie from battle area', () => {
    let state = createDemoGame()
    const skill: CardSkill = {
      trigger: 'activate',
      oncePerTurn: false,
      yourTurn: false,
      restSource: false,
      cost: {
        energy: {},
        discardHand: 0,
        trashBattleCookie: { count: 1, level: 1, energyColor: 'red' },
      },
      text: 'Trash 1 red LV.1 cookie from battle.',
      effects: [{ kind: 'draw', amount: 1 }],
    }
    state = withSkill(state, 'player-one', skill)
    state = advancePhase(advancePhase(state))
    const sourceId = state.players['player-one'].battleArea[0].card.instanceId
    const trashId = state.players['player-one'].battleArea[1]?.card.instanceId

    if (!trashId) return

    const result = activateCookieSkill(
      state,
      'player-one',
      sourceId,
      'activate',
      [],
      [],
      [],
      [trashId],
    )

    const p1 = result.players['player-one']
    expect(p1.battleArea.some((c) => c.card.instanceId === trashId)).toBe(false)
    expect(p1.discardPile.some((c) => c.instanceId === trashId)).toBe(true)
    expect(result.departedCookieCounts['player-one']).toBe(1)
  })

  it('rejects when no valid battle cookie matches level', () => {
    let state = createDemoGame()
    const skill: CardSkill = {
      trigger: 'activate',
      oncePerTurn: false,
      yourTurn: false,
      restSource: false,
      cost: {
        energy: {},
        discardHand: 0,
        trashBattleCookie: { count: 1, level: 5, energyColor: 'red' },
      },
      text: 'Trash 1 red LV.5 cookie from battle.',
      effects: [{ kind: 'draw', amount: 1 }],
    }
    state = withSkill(state, 'player-one', skill)
    state = advancePhase(advancePhase(state))
    const sourceId = state.players['player-one'].battleArea[0].card.instanceId

    expect(() =>
      activateCookieSkill(
        state,
        'player-one',
        sourceId,
        'activate',
        [],
        [],
        [],
        ['nonexistent'],
      ),
    ).toThrow(GameRuleError)
  })

  it('canActivateCookieSkill returns false when trashBattleCookie cost cannot be paid', () => {
    let state = createDemoGame()
    const skill: CardSkill = {
      trigger: 'activate',
      oncePerTurn: false,
      yourTurn: false,
      restSource: false,
      cost: {
        energy: {},
        discardHand: 0,
        trashBattleCookie: { count: 1, level: 5, energyColor: 'red' },
      },
      text: 'Trash 1 red LV.5 cookie from battle.',
      effects: [{ kind: 'draw', amount: 1 }],
    }
    state = withSkill(state, 'player-one', skill)
    state = advancePhase(advancePhase(state))
    const sourceId = state.players['player-one'].battleArea[0].card.instanceId

    expect(
      canActivateCookieSkill(state, 'player-one', sourceId, 'activate'),
    ).toBe(false)
  })

  it('canActivateCookieSkill returns true when trashBattleCookie cost can be paid', () => {
    let state = createDemoGame()
    const battleCookie = state.players['player-one'].battleArea[0]
    if (!battleCookie) return
    const skill: CardSkill = {
      trigger: 'activate',
      oncePerTurn: false,
      yourTurn: false,
      restSource: false,
      cost: {
        energy: {},
        discardHand: 0,
        trashBattleCookie: { count: 1, level: battleCookie.card.level },
      },
      text: 'Trash 1 cookie from battle.',
      effects: [{ kind: 'draw', amount: 1 }],
    }
    state = withSkill(state, 'player-one', skill)
    state = advancePhase(advancePhase(state))
    const sourceId = state.players['player-one'].battleArea[0].card.instanceId

    expect(
      canActivateCookieSkill(state, 'player-one', sourceId, 'activate'),
    ).toBe(true)
  })

  it('trashBattleCookie cost cookie HP cards go to discard', () => {
    let state = createDemoGame()
    const battleCookie: CookieInBattle = {
      card: {
        id: 'test-cookie',
        instanceId: 'test-cookie',
        name: 'Test Cookie',
        type: 'cookie',
        officialType: 'cookie',
        level: 1,
        hp: 2,
        attack: 1,
        attackCost: 1,
        energyColor: 'red',
      },
      hpCards: [
        { id: 'hp-1', instanceId: 'hp-1', name: 'HP 1', type: 'item' },
        { id: 'hp-2', instanceId: 'hp-2', name: 'HP 2', type: 'item' },
      ],
      rested: false,
      battleEntryId: 'test-cookie:battle:1',
    }

    state = {
      ...state,
      players: {
        ...state.players,
        'player-one': {
          ...state.players['player-one'],
          battleArea: [state.players['player-one'].battleArea[0], battleCookie],
        },
      },
    }

    const skill: CardSkill = {
      trigger: 'activate',
      oncePerTurn: false,
      yourTurn: false,
      restSource: false,
      cost: {
        energy: {},
        discardHand: 0,
        trashBattleCookie: { count: 1, level: 1, energyColor: 'red' },
      },
      text: 'Trash 1 red LV.1 cookie from battle.',
      effects: [{ kind: 'draw', amount: 1 }],
    }
    state = withSkill(state, 'player-one', skill)
    state = advancePhase(advancePhase(state))
    const sourceId = state.players['player-one'].battleArea[0].card.instanceId

    const result = activateCookieSkill(
      state,
      'player-one',
      sourceId,
      'activate',
      [],
      [],
      [],
      ['test-cookie'],
    )

    const p1 = result.players['player-one']
    expect(p1.discardPile.some((c) => c.instanceId === 'test-cookie')).toBe(true)
    expect(p1.discardPile.some((c) => c.instanceId === 'hp-1')).toBe(true)
    expect(p1.discardPile.some((c) => c.instanceId === 'hp-2')).toBe(true)
    expect(result.departedCookieCounts['player-one']).toBe(1)
  })
})
