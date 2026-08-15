import { describe, expect, it } from 'vitest'
import {
  activateCookieSkill,
  canActivateCookieSkill,
  createDemoGame,
  createSeededShuffle,
  advancePhase,
  type CardSkill,
  type GameCard,
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

  it('requires and pays BS6-073 battle Cookie return cost before resolving On Play', () => {
    let state = createDemoGame()
    const player = state.players['player-one']
    const source = player.battleArea[0]
    const returned = player.battleArea[1]
    if (!source || !returned) return

    const skill: CardSkill = {
      trigger: 'on-play',
      oncePerTurn: false,
      yourTurn: false,
      restSource: false,
      cost: {
        energy: { blue: 1 },
        discardHand: 0,
        battleCookieToHand: {
          count: 1,
          maxLevel: 1,
          energyColor: 'blue',
        },
      },
      text: 'Return 1 blue LV.1 Cookie from your battle area to your hand.',
      effects: [
        {
          kind: 'damage',
          amount: 1,
          target: { side: 'opponent', min: 0, max: 1 },
        },
      ],
    }
    const hpCard: GameCard = {
      id: 'returned-hp',
      instanceId: 'returned-hp',
      name: 'Returned HP',
      type: 'item',
    }
    const sourceId = 'schneeball-source'
    const returnedId = 'blue-lv1-to-hand'
    const blueEnergyId = 'blue-energy'
    state = {
      ...state,
      pendingOnPlay: {
        playerId: 'player-one',
        sourceInstanceId: sourceId,
      },
      players: {
        ...state.players,
        'player-one': {
          ...player,
          battleArea: [
            {
              ...source,
              card: {
                ...source.card,
                id: sourceId,
                instanceId: sourceId,
                name: 'Schneeball Cookie',
                level: 2,
                energyColor: 'blue',
                skill,
              },
            },
            {
              ...returned,
              card: {
                ...returned.card,
                id: returnedId,
                instanceId: returnedId,
                name: 'Blue LV.1 Cookie',
                level: 1,
                energyColor: 'blue',
              },
              hpCards: [hpCard],
            },
          ],
          supportArea: [
            {
              card: {
                id: blueEnergyId,
                instanceId: blueEnergyId,
                name: 'Blue Energy',
                type: 'item',
                energyColor: 'blue',
              },
              rested: false,
            },
          ],
        },
      },
    }

    expect(
      canActivateCookieSkill(state, 'player-one', sourceId, 'on-play'),
    ).toBe(true)
    expect(() =>
      activateCookieSkill(
        state,
        'player-one',
        sourceId,
        'on-play',
        [blueEnergyId],
      ),
    ).toThrow(GameRuleError)

    const result = activateCookieSkill(
      state,
      'player-one',
      sourceId,
      'on-play',
      [blueEnergyId],
      [],
      [],
      [],
      [],
      [],
      createSeededShuffle(1),
      [],
      [],
      [returnedId],
    )
    const resultPlayer = result.players['player-one']

    expect(result.pendingOnPlay).toBeNull()
    expect(resultPlayer.battleArea.map((cookie) => cookie.card.instanceId)).toEqual([
      sourceId,
    ])
    expect(resultPlayer.hand.some((card) => card.instanceId === returnedId)).toBe(
      true,
    )
    expect(resultPlayer.discardPile.some((card) => card.instanceId === hpCard.instanceId)).toBe(
      true,
    )
    expect(resultPlayer.supportArea[0]?.rested).toBe(true)
  })
})
