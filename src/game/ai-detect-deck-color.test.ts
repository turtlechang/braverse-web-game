import { describe, expect, it } from 'vitest'
import { getMatchupProfile } from './ai/bs2MatchupProfiles'
import { cookie, createBattleState, item } from './test-helpers/battle-helpers'

/**
 * 舊版 detectDeckColor 只認得 ST2-5、BS2 特定號碼區間的 id 前綴，或少數
 * 卡名子字串；純 BS3 或純 BS1 牌組一個都碰不到，colorCounts 全部掛零，
 * 迴圈 tie-break 又預設回 'red'——等於誤判成紅色配置表，不是「查無資料」
 * 那種安全退化。改用 card.energyColor 後才會對每個色系都正確分類。
 */
describe('getMatchupProfile 牌組顏色偵測', () => {
  it('純 BS3 藍色手牌正確判定為藍色（舊版會誤判成紅色）', () => {
    const base = createBattleState()
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
    const base = createBattleState()
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
    const base = createBattleState()
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
})
