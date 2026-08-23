import { describe, expect, it } from 'vitest'
import { createPlayerView } from '../../player-view'
import {
  cookie,
  createBattleState,
  item,
} from '../../test-helpers/battle-helpers'
import { forecastOpponentEndgame } from './endgame-forecast'

const attackIdentity = {
  kind: 'attack' as const,
  sourceInstanceId: 'attacker',
  targetInstanceId: 'defender',
}

const makeForecast = (
  configure: (state: ReturnType<typeof createBattleState>) => void,
  effectiveDamage = 3,
) => {
  const state = createBattleState()
  configure(state)
  // The forecast is intentionally evaluated only from the attacking player's
  // public PlayerView. The fixture setup is not part of the information input.
  return forecastOpponentEndgame(
    createPlayerView(state, 'player-two'),
    attackIdentity,
    effectiveDamage,
  )
}

const opponent = (state: ReturnType<typeof createBattleState>) =>
  state.players['player-one']

describe('終局預測 deterministic corpus', () => {
  it('非致命攻擊不建立終局預測', () => {
    const forecast = makeForecast(() => undefined, 2)

    expect(forecast).toMatchObject({
      publicLethal: false,
      targetsLastBattleCookie: false,
      refreshProbability: 0,
    })
  })

  it('仍有兩隻戰鬥餅乾時，致命攻擊只標示公開擊倒', () => {
    const forecast = makeForecast((state) => {
      const defender = opponent(state)
      const second = cookie('second-defender', 2, 2)
      defender.battleArea.push({
        card: second,
        hpCards: [item('second-hp-a'), item('second-hp-b')],
        rested: false,
        battleEntryId: 'second-defender:battle:3',
      })
    })

    expect(forecast).toMatchObject({
      publicLethal: true,
      targetsLastBattleCookie: false,
      noReplacementProbability: 0,
      refreshProbability: 0,
    })
  })

  it('手牌 0 的空戰鬥區路徑視為確定補位敗北', () => {
    const forecast = makeForecast((state) => {
      opponent(state).hand = []
    })

    expect(forecast.noReplacementProbability).toBe(1)
    expect(forecast.score).toBeGreaterThanOrEqual(180)
  })

  it('手牌張數越多，公開餅乾率估計下的無補位機率越低', () => {
    const oneCard = makeForecast((state) => {
      opponent(state).hand = [item('one-card')]
    })
    const manyCards = makeForecast((state) => {
      opponent(state).hand = [
        item('many-a'),
        item('many-b'),
        item('many-c'),
        item('many-d'),
      ]
    })

    expect(manyCards.noReplacementProbability).toBeLessThan(
      oneCard.noReplacementProbability,
    )
    expect(manyCards.detail).toContain('無可登場餅乾機率')
  })

  it('牌庫恰好等於設置預估 HP 時，依規則仍進入邊界 Refresh 風險', () => {
    const forecast = makeForecast((state) => {
      const defender = opponent(state)
      // Public cookies have average HP 3. The engine deliberately treats
      // deckCount <= estimated HP as the Refresh boundary.
      defender.deck = [item('deck-a'), item('deck-b'), item('deck-c')]
      defender.discardPile = [
        { ...cookie('public-cookie', 1, 3), level: 2 },
      ]
      defender.hand = [cookie('replacement-visible', 1, 3)]
    })

    expect(forecast.expectedReplacementHp).toBe(3)
    expect(forecast.refreshProbability).toBeGreaterThan(0)
    expect(forecast.detail).toContain('會進入 Refresh 風險')
  })

  it('牌庫少於設置預估 HP 時形成 Refresh 風險', () => {
    const forecast = makeForecast((state) => {
      const defender = opponent(state)
      defender.deck = [item('deck-a'), item('deck-b')]
      defender.discardPile = [
        { ...cookie('public-cookie', 1, 3), level: 2 },
      ]
      defender.hand = [cookie('replacement-visible', 1, 3)]
    })

    expect(forecast.expectedReplacementHp).toBe(3)
    expect(forecast.refreshProbability).toBeGreaterThan(0)
    expect(forecast.detail).toContain('會進入 Refresh 風險')
  })

  it('公開棄牌有餅乾時，Refresh 敗北機率依最低 LV 候選判定', () => {
    const forecast = makeForecast((state) => {
      const defender = opponent(state)
      defender.deck = []
      defender.hand = [cookie('replacement-visible')]
      defender.discardPile = [
        { ...cookie('high-cookie', 1, 3), level: 3 },
        { ...cookie('low-cookie', 1, 3), level: 1 },
      ]
    })

    expect(forecast.refreshProbability).toBeGreaterThan(0)
    expect(forecast.expectedRefreshBreakLevel).toBe(
      forecast.refreshProbability,
    )
  })

  it('Refresh 選最低 LV 餅乾，不使用較高 LV 公開候選', () => {
    const forecast = makeForecast((state) => {
      const defender = opponent(state)
      defender.deck = []
      defender.hand = [cookie('replacement-visible')]
      defender.breakArea = [{ ...cookie('already-broken', 1, 2), level: 4 }]
      defender.discardPile = [
        { ...cookie('lv-four', 1, 3), level: 4 },
        { ...cookie('lv-two', 1, 3), level: 2 },
      ]
    })

    expect(forecast.expectedRefreshBreakLevel).toBe(
      forecast.refreshProbability * 2,
    )
    expect(forecast.expectedRefreshBreakLevel).not.toBe(
      forecast.refreshProbability * 4,
    )
  })

  it('公開棄牌沒有餅乾時，Refresh 仍保留無候選餅乾的估計敗北路徑', () => {
    const forecast = makeForecast((state) => {
      const defender = opponent(state)
      defender.deck = []
      defender.hand = [cookie('replacement-visible')]
      defender.discardPile = [item('public-item-a'), item('public-item-b')]
    })

    expect(forecast.refreshProbability).toBeGreaterThan(0)
    expect(forecast.refreshDefeatProbability).toBeGreaterThan(0)
    expect(forecast.detail).toContain('Refresh 敗北機率')
  })

  it('Refresh 沒有公開可選餅乾時，保留隱藏翻牌造成的敗北估計', () => {
    const forecast = makeForecast((state) => {
      const defender = opponent(state)
      defender.deck = []
      defender.hand = [cookie('replacement-visible')]
      defender.discardPile = []
    })

    expect(forecast.refreshDefeatProbability).toBeGreaterThan(0)
    expect(forecast.refreshDefeatProbability).toBeLessThan(
      forecast.refreshProbability,
    )
    expect(forecast.score).toBeGreaterThan(0)
  })

  it('休息區 LV 9 遇到 LV 1 Refresh 候選時，預估達到敗北門檻', () => {
    const forecast = makeForecast((state) => {
      const defender = opponent(state)
      defender.deck = []
      defender.hand = [cookie('replacement-visible')]
      defender.breakArea = [{ ...cookie('break-lv9', 1, 2), level: 9 }]
      defender.discardPile = [{ ...cookie('refresh-lv1', 1, 2), level: 1 }]
    })

    expect(forecast.refreshDefeatProbability).toBe(forecast.refreshProbability)
  })

  it('休息區 LV 10 遇到任何公開 Refresh 餅乾都維持敗北', () => {
    const forecast = makeForecast((state) => {
      const defender = opponent(state)
      defender.deck = []
      defender.hand = [cookie('replacement-visible')]
      defender.breakArea = [{ ...cookie('break-lv10', 1, 2), level: 10 }]
      defender.discardPile = [{ ...cookie('refresh-lv3', 1, 2), level: 3 }]
    })

    expect(forecast.refreshDefeatProbability).toBe(forecast.refreshProbability)
  })

  it('公開資訊相同時，隱藏牌面變化不會改變預測', () => {
    const first = makeForecast((state) => {
      opponent(state).hand = [item('hidden-item')]
      opponent(state).deck = [item('hidden-deck-a')]
    })
    const second = makeForecast((state) => {
      opponent(state).hand = [cookie('hidden-cookie')]
      opponent(state).deck = [cookie('hidden-deck-cookie')]
    })

    // Only counts are exposed by PlayerView; the forecast must not inspect
    // the hidden card faces, so equal public counts yield equal output.
    expect(second).toEqual(first)
  })
})
