import { describe, expect, it } from 'vitest'
import {
  activateCookieSkill,
  advancePhase,
  canActivateCookieSkill,
  createDemoGame,
  getHpToTrashCostCandidates,
  type CardSkill,
  type GameCard,
  type GameState,
} from '.'

const hpCard = (instanceId: string): GameCard => ({
  id: instanceId,
  instanceId,
  name: instanceId,
  type: 'item',
})

const makeCookie = (
  base: GameState['players']['player-one']['battleArea'][number],
  instanceId: string,
  energyColor: GameCard['energyColor'],
  hpCount: number,
  skill?: CardSkill,
) => ({
  ...base,
  card: {
    ...base.card,
    id: instanceId,
    instanceId,
    name: instanceId,
    energyColor,
    skill,
  },
  hpCards: Array.from({ length: hpCount }, (_, index) =>
    hpCard(`${instanceId}-hp-${index + 1}`),
  ),
})

const crossCookieSkill: CardSkill = {
  trigger: 'activate',
  oncePerTurn: true,
  yourTurn: false,
  restSource: false,
  cost: {
    energy: {},
    discardHand: 0,
    hpToTrash: { amount: 2, energyColor: 'red', totalAcrossCookies: true },
  },
  text: 'Place a total of 2 cards from the top of your red Cookies\' HP into the trash.',
  effects: [{ kind: 'damage-all', amount: 1, side: 'opponent' }],
}

const createCrossCookieState = (redHpCounts: number[]): GameState => {
  let state = createDemoGame()
  const base = state.players['player-one'].battleArea[0]
  const redCookies = redHpCounts.map((hpCount, index) =>
    makeCookie(base, `red-${index + 1}`, 'red', hpCount, index === 0 ? crossCookieSkill : undefined),
  )
  const blueCookie = makeCookie(base, 'blue-cookie', 'blue', 2)
  state = {
    ...state,
    players: {
      ...state.players,
      'player-one': {
        ...state.players['player-one'],
        battleArea: [...redCookies, blueCookie],
      },
    },
  }
  return advancePhase(advancePhase(state))
}

describe('BS11-016 cross-Cookie HP cost', () => {
  it('offers each matching Cookie with at least one HP and checks the total', () => {
    const state = createCrossCookieState([1, 1])
    const player = state.players['player-one']
    const sourceId = 'red-1'

    expect(
      getHpToTrashCostCandidates(
        crossCookieSkill.cost,
        player.battleArea,
        sourceId,
      ).map((cookie) => cookie.card.instanceId),
    ).toEqual(['red-1', 'red-2'])
    expect(canActivateCookieSkill(state, 'player-one', sourceId, 'activate')).toBe(true)
  })

  it('rejects an incomplete split and pays one HP from each selected Cookie', () => {
    const state = createCrossCookieState([1, 1])
    expect(() =>
      activateCookieSkill(
        state,
        'player-one',
        'red-1',
        'activate',
        [],
        [],
        [],
        [],
        [],
        [],
        undefined,
        ['red-1'],
      ),
    ).toThrow('選取的餅乾 HP 不足以支付合計 HP 費用。')

    const paid = activateCookieSkill(
      state,
      'player-one',
      'red-1',
      'activate',
      [],
      [],
      [],
      [],
      [],
      [],
      undefined,
      ['red-1', 'red-2'],
    )
    const player = paid.players['player-one']
    expect(player.battleArea.map((cookie) => cookie.card.instanceId)).toEqual(['blue-cookie'])
    expect(player.breakArea.map((card) => card.instanceId)).toEqual(['red-1', 'red-2'])
    expect(player.discardPile.filter((card) => card.instanceId.startsWith('red-')).length).toBe(2)
    expect(paid.costRecord?.hpTrashCookieInstanceIds).toEqual(['red-1', 'red-2'])
    expect(paid.players['player-two'].battleArea[0]?.hpCards).toHaveLength(1)
  })

  it('does not activate when matching Cookies have less than two total HP', () => {
    const state = createCrossCookieState([1])
    expect(canActivateCookieSkill(state, 'player-one', 'red-1', 'activate')).toBe(false)
  })
})
