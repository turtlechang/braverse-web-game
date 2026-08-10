import { describe, expect, it } from 'vitest'
import {
  applyGameCommand,
  canSpecialPlayCookie,
  deployCookie,
  type CookieCard,
  type GameCard,
} from '.'
import { cookie, createBattleState, item } from './test-helpers/battle-helpers'

const licoriceCookie = (): CookieCard => ({
  id: 'P-147',
  instanceId: 'p-147-in-hand',
  name: 'Licorice Cookie',
  type: 'cookie',
  level: 2,
  hp: 4,
  attack: 3,
  attackCost: 3,
  attackEnergyCost: { black: 3 },
  energyColor: 'black',
  skill: {
    trigger: 'on-play',
    oncePerTurn: false,
    yourTurn: false,
    restSource: false,
    cost: { energy: {}, discardHand: 0 },
    specialPlayCost: {
      energy: {},
      trashBattleCookie: { count: 1, level: 1, energyColor: 'black' },
    },
    text: 'Special Play: place a black LV.1 Cookie from your battle area into the trash.',
    effects: [],
  },
})

const blackLv1Cookie = (): CookieCard => ({
  ...cookie('p-147-sacrifice', 1, 1),
  energyColor: 'black',
  level: 1,
})

const specialPlayState = () => {
  const state = createBattleState()
  const specialCookie = licoriceCookie()
  const sacrificedCookie = blackLv1Cookie()
  state.players['player-two'].hand = [specialCookie]
  state.players['player-two'].battleArea = [
    {
      card: sacrificedCookie,
      hpCards: [item('p-147-sacrifice-hp')],
      rested: false,
      battleEntryId: 'p-147-sacrifice:battle:2',
    },
  ]
  state.players['player-two'].deck = [
    item('p-147-hp-a'),
    item('p-147-hp-b'),
    item('p-147-hp-c'),
    item('p-147-hp-d'),
  ]
  return { state, specialCookie, sacrificedCookie }
}

describe('Special Play deployment', () => {
  it('pays P-147 Special Play with a black LV.1 Cookie and queues On Play', () => {
    const { state, specialCookie, sacrificedCookie } = specialPlayState()

    expect(
      canSpecialPlayCookie(state, 'player-two', specialCookie.instanceId),
    ).toBe(true)

    const next = applyGameCommand(state, {
      kind: 'deploy-cookie',
      playerId: 'player-two',
      instanceId: specialCookie.instanceId,
      specialPlayCookieInstanceId: sacrificedCookie.instanceId,
    })
    const player = next.players['player-two']

    expect(player.battleArea.map((entry) => entry.card.instanceId)).toEqual([
      specialCookie.instanceId,
    ])
    expect(player.discardPile.map((card) => card.instanceId)).toEqual(
      expect.arrayContaining([
        sacrificedCookie.instanceId,
        'p-147-sacrifice-hp',
      ]),
    )
    expect(next.departedCookieCounts['player-two']).toBe(1)
    expect(next.pendingOnPlay).toEqual({
      playerId: 'player-two',
      sourceInstanceId: specialCookie.instanceId,
      origin: 'hand',
    })
  })

  it('does not expose Special Play when no eligible black LV.1 Cookie is available', () => {
    const { state, specialCookie } = specialPlayState()
    const invalidCookie: GameCard = {
      ...blackLv1Cookie(),
      instanceId: 'p-147-wrong-color',
      energyColor: 'red',
    }
    state.players['player-two'].battleArea[0] = {
      ...state.players['player-two'].battleArea[0],
      card: invalidCookie as CookieCard,
    }

    expect(
      canSpecialPlayCookie(state, 'player-two', specialCookie.instanceId),
    ).toBe(false)
    expect(() =>
      deployCookie(state, specialCookie.instanceId, invalidCookie.instanceId),
    ).toThrow()
  })
})
