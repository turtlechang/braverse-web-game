import { describe, expect, it } from 'vitest'
import { createDemoGame, simulateAiMatchDetailed } from '.'

describe('BS7 Lv.4 AI 對戰回歸', () => {
  it('BS7-101 的攻擊後場景移除不會送出 Cookie 目標', () => {
    const seed = 20660822
    const result = simulateAiMatchDetailed(
      createDemoGame(seed, {
        player: 'bs7-purple-arena',
        ai: 'bs6-red-competitive',
      }),
      2500,
      {
        levels: { 'player-one': 4, 'player-two': 4 },
        seed,
      },
    )

    expect(result.error).not.toBe('此效果只能選擇場景卡。')
    expect(result.behavior.invalidActionCount).toBe(0)
    expect(result.stuck, result.error ?? '').toBe(false)
    expect(result.state.status).toBe('finished')
  })

  it('Lv.4 搜尋支付支援區回手費用時遵守 Cookie 卡種限制', () => {
    const seed = 20362822
    const result = simulateAiMatchDetailed(
      createDemoGame(seed, {
        player: 'bs7-yellow-arena',
        ai: 'bs6-green-competitive',
      }),
      2500,
      {
        levels: { 'player-one': 4, 'player-two': 4 },
        seed,
      },
    )

    expect(result.error).not.toBe('支援區回手費用必須選擇 cookie。')
    expect(result.behavior.invalidActionCount).toBe(0)
    expect(result.stuck, result.error ?? '').toBe(false)
    expect(result.state.status).toBe('finished')
  })

  it('BS7-090 檢視牌庫只會選擇具 Arena 關鍵字的揭露卡', () => {
    const seed = 20664822
    const result = simulateAiMatchDetailed(
      createDemoGame(seed, {
        player: 'bs7-purple-arena',
        ai: 'bs6-purple-competitive',
      }),
      2500,
      {
        levels: { 'player-one': 4, 'player-two': 4 },
        seed,
      },
    )

    expect(result.error).not.toBe('選取的卡牌關鍵字不符合此效果。')
    expect(result.behavior.invalidActionCount).toBe(0)
    expect(result.stuck, result.error ?? '').toBe(false)
    expect(result.state.status).toBe('finished')
  })

  it('BS7-051 的 Lv.4 技能只會用 Arena 支援卡支付棄置代價', () => {
    const seed = 20460824
    const result = simulateAiMatchDetailed(
      createDemoGame(seed, {
        player: 'bs7-green-arena',
        ai: 'bs6-red-competitive',
      }),
      2500,
      {
        levels: { 'player-one': 4, 'player-two': 4 },
        seed,
      },
    )

    expect(result.error).not.toBe('支援區代價卡不符合指定關鍵字。')
    expect(result.behavior.invalidActionCount).toBe(0)
    expect(result.stuck, result.error ?? '').toBe(false)
    expect(result.state.status).toBe('finished')
  })

  it('BS7-026 在攻擊者已因 FLIP 離場後不會嘗試支付自身進休息區代價', () => {
    const seed = 20260826
    const result = simulateAiMatchDetailed(
      createDemoGame(seed, {
        player: 'bs7-yellow-arena',
        ai: 'bs6-red-competitive',
      }),
      2500,
      {
        levels: { 'player-one': 4, 'player-two': 4 },
        seed,
      },
    )

    expect(result.error).not.toBe('Invalid battle action.')
    expect(result.behavior.invalidActionCount).toBe(0)
    expect(result.stuck, result.error ?? '').toBe(false)
    expect(result.state.status).toBe('finished')
  })
})
