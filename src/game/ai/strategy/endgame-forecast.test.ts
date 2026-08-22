import { describe, expect, it } from 'vitest'
import { createPlayerView } from '../../player-view'
import { createBattleState, cookie } from '../../test-helpers/battle-helpers'
import { forecastOpponentEndgame } from './endgame-forecast'

const attackIdentity = {
  kind: 'attack',
  sourceInstanceId: 'attacker',
  targetInstanceId: 'defender',
}

describe('Lv.5 對手終局預測', () => {
  it('公開手牌為 0 且可擊倒最後一隻餅乾時，辨識無法補位敗北路徑', () => {
    const state = createBattleState()
    state.players['player-one'].hand = []
    const forecast = forecastOpponentEndgame(
      createPlayerView(state, 'player-two'),
      attackIdentity,
      3,
    )

    expect(forecast).toMatchObject({
      publicLethal: true,
      targetsLastBattleCookie: true,
      noReplacementProbability: 1,
    })
    expect(forecast.score).toBeGreaterThanOrEqual(180)
  })

  it('牌庫不足以設置預估補位 HP 時，納入公開棄牌的 Refresh 洗傷', () => {
    const state = createBattleState()
    state.players['player-one'].deck = []
    state.players['player-one'].discardPile = [
      { ...cookie('refresh-cookie', 1, 2), level: 2 },
    ]
    state.players['player-one'].breakArea = [
      { ...cookie('break-cookie', 1, 2), level: 8 },
    ]
    const forecast = forecastOpponentEndgame(
      createPlayerView(state, 'player-two'),
      attackIdentity,
      3,
    )

    expect(forecast.refreshProbability).toBeGreaterThan(0)
    expect(forecast.refreshDefeatProbability).toBe(forecast.refreshProbability)
    expect(forecast.expectedRefreshBreakLevel).toBeGreaterThan(0)
    expect(forecast.detail).toContain('Refresh')
  })

  it('只依 PlayerView 計算，相同公開資訊必須得到相同預測', () => {
    const state = createBattleState()
    const first = createPlayerView(state, 'player-two')
    const second = {
      ...first,
      opponent: { ...first.opponent },
    }
    expect(forecastOpponentEndgame(first, attackIdentity, 3)).toEqual(
      forecastOpponentEndgame(second, attackIdentity, 3),
    )
  })
})
