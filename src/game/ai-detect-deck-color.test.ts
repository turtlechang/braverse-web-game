import { describe, expect, it } from 'vitest'
import { getMatchupProfile } from './ai/bs2MatchupProfiles'
import { cookie, createBattleState, item } from './test-helpers/battle-helpers'

type PlayerOne = ReturnType<typeof createBattleState>['players']['player-one']

const createEmptyPlayerOneState = () => {
  const base = createBattleState()
  return {
    ...base,
    players: {
      ...base.players,
      'player-one': {
        ...base.players['player-one'],
        deck: [],
        extraDeck: [],
        hand: [],
        battleArea: [],
        supportArea: [],
        breakArea: [],
        discardPile: [],
        stage: null,
      },
    },
  }
}

const withPlayerOne = (
  state: ReturnType<typeof createBattleState>,
  overrides: Partial<PlayerOne>,
) => ({
  ...state,
  players: {
    ...state.players,
    'player-one': { ...state.players['player-one'], ...overrides },
  },
})

/**
 * 舊版 detectDeckColor 只認得 ST2-5、BS2 特定號碼區間的 id 前綴，或少數
 * 卡名子字串；純 BS3 或純 BS1 牌組一個都碰不到，colorCounts 全部掛零，
 * 迴圈 tie-break 又預設回 'red'——等於誤判成紅色配置表，不是「查無資料」
 * 那種安全退化。改用 card.energyColor 後才會對每個色系都正確分類。
 */
describe('getMatchupProfile 牌組顏色偵測', () => {
  it('純 BS3 藍色手牌正確判定為藍色（舊版會誤判成紅色）', () => {
    const base = createEmptyPlayerOneState()
    const state = {
      ...base,
      players: {
        ...base.players,
        'player-one': {
          ...base.players['player-one'],
          hand: [
            item('BS3-085', 'blue'),
            item('BS3-093', 'blue'),
            item('BS3-076', 'blue'),
          ],
          breakArea: [],
          discardPile: [],
        },
      },
    }

    expect(getMatchupProfile(state, 'player-one').color).toBe('blue')
  })

  it('純 BS1 紅色手牌正確判定為紅色（舊版靠卡名子字串，涵蓋不到純 BS1 卡）', () => {
    const base = createEmptyPlayerOneState()
    const state = {
      ...base,
      players: {
        ...base.players,
        'player-one': {
          ...base.players['player-one'],
          hand: [
            item('BS1-009', 'red'),
            item('BS1-021', 'red'),
          ],
          breakArea: [],
          discardPile: [],
        },
      },
    }

    expect(getMatchupProfile(state, 'player-one').color).toBe('red')
  })

  it('依 energyColor 出現次數最多的顏色判定，不受彈數影響', () => {
    const base = createEmptyPlayerOneState()
    const state = {
      ...base,
      players: {
        ...base.players,
        'player-one': {
          ...base.players['player-one'],
          hand: [item('a', 'purple')],
          breakArea: [
            { ...cookie('b'), energyColor: 'purple' as const },
            { ...cookie('c'), energyColor: 'purple' as const },
          ],
          discardPile: [item('d', 'blue')],
        },
      },
    }

    expect(getMatchupProfile(state, 'player-one').color).toBe('purple')
  })

  it('黑色 Cookie 牌組使用通用黑色 profile，不套用紅色卡表', () => {
    const base = createEmptyPlayerOneState()
    const state = {
      ...base,
      players: {
        ...base.players,
        'player-one': {
          ...base.players['player-one'],
          deck: [{ ...cookie('BS11-092'), energyColor: 'black' as const }],
        },
      },
    }

    const profile = getMatchupProfile(state, 'player-one')
    expect(profile.color).toBe('black')
    expect(profile.replacementScores).toEqual({})
    expect(profile.attackThreatValues).toEqual({})
  })

  it('Cookie 顏色優先於數量更多的異色非 Cookie', () => {
    const base = createEmptyPlayerOneState()
    const state = withPlayerOne(base, {
      deck: [
        item('red-item-a', 'red'),
        item('red-item-b', 'red'),
        item('red-item-c', 'red'),
      ],
      battleArea: [{
        card: { ...cookie('black-cookie'), energyColor: 'black' },
        hpCards: [],
        rested: false,
      }],
    })

    expect(getMatchupProfile(state, 'player-one').color).toBe('black')
  })

  it('Cookie 色彩平手時不讓大量異色非 Cookie 打破平手', () => {
    const base = createEmptyPlayerOneState()
    const state = withPlayerOne(base, {
      deck: [
        item('red-item-a', 'red'),
        item('red-item-b', 'red'),
        item('red-item-c', 'red'),
      ],
      hand: [{ ...cookie('green-cookie'), energyColor: 'green' }],
      discardPile: [{ ...cookie('blue-cookie'), energyColor: 'blue' }],
    })

    expect(getMatchupProfile(state, 'player-one').color).toBe('unknown')
  })

  it('沒有主牌區 Cookie 時仍可從 EXTRA 牌組判定顏色', () => {
    const base = createEmptyPlayerOneState()
    const state = withPlayerOne(base, {
      extraDeck: [{
        id: 'BS8-extra-black',
        instanceId: 'BS8-extra-black:1',
        name: 'Black EXTRA',
        type: 'extra',
        energyColor: 'black',
      }],
    })

    expect(getMatchupProfile(state, 'player-one').color).toBe('black')
  })

  it('HP 堆中的 Cookie 顏色會參與判定', () => {
    const base = createEmptyPlayerOneState()
    const state = withPlayerOne(base, {
      battleArea: [{
        card: { ...cookie('black-anchor'), energyColor: 'black' },
        hpCards: [
          { ...cookie('green-hp-a'), energyColor: 'green' },
          { ...cookie('green-hp-b'), energyColor: 'green' },
        ],
        rested: false,
      }],
    })

    expect(getMatchupProfile(state, 'player-one').color).toBe('green')
  })

  it('Awakened Cookie 下方的 Cookie 仍會參與牌組顏色判定', () => {
    const base = createEmptyPlayerOneState()
    const state = withPlayerOne(base, {
      battleArea: [{
        card: { ...cookie('black-awakened-cookie'), energyColor: 'black' },
        hpCards: [],
        rested: false,
        awakenedUnderlay: [{ ...cookie('green-underlay-cookie'), energyColor: 'green' }],
      }],
    })

    expect(getMatchupProfile(state, 'player-one').color).toBe('unknown')
  })

  it('Cookie 在主要持有區域間移動時判色不變', () => {
    const base = createEmptyPlayerOneState()
    const greenCookie = { ...cookie('moving-green-cookie'), energyColor: 'green' as const }
    const placements: Array<{ area: string; overrides: Partial<PlayerOne> }> = [
      { area: '牌庫', overrides: { deck: [greenCookie] } },
      { area: '手牌', overrides: { hand: [greenCookie] } },
      {
        area: '戰鬥區',
        overrides: { battleArea: [{ card: greenCookie, hpCards: [], rested: false }] },
      },
      { area: '破壞區', overrides: { breakArea: [greenCookie] } },
      { area: '棄牌區', overrides: { discardPile: [greenCookie] } },
    ]

    for (const { area, overrides } of placements) {
      expect(
        getMatchupProfile(withPlayerOne(base, overrides), 'player-one').color,
        area,
      ).toBe('green')
    }
  })

  it('PURE 牌組有獨立通用 profile', () => {
    const base = createEmptyPlayerOneState()
    const state = {
      ...base,
      players: {
        ...base.players,
        'player-one': {
          ...base.players['player-one'],
          stage: {
            card: { ...item('BS3-121@1', 'pure'), type: 'stage' as const },
            rested: false,
          },
        },
      },
    }

    expect(getMatchupProfile(state, 'player-one').color).toBe('pure')
  })

  it('顏色平手或沒有可判定顏色時使用通用 unknown profile', () => {
    const base = createEmptyPlayerOneState()
    const tiedState = {
      ...base,
      players: {
        ...base.players,
        'player-one': {
          ...base.players['player-one'],
          deck: [item('red-card', 'red'), item('blue-card', 'blue')],
        },
      },
    }

    expect(getMatchupProfile(tiedState, 'player-one').color).toBe('unknown')
    expect(getMatchupProfile(base, 'player-one').color).toBe('unknown')
  })
})
