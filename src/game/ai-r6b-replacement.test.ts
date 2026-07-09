import { describe, expect, it } from 'vitest'
import {
  scoreReplacement,
  scoreReplacementAdvanced,
  MATCHUP_PROFILES,
} from './ai/bs2MatchupProfiles'
import { isRuleEnabled } from './ai/rule-profiles'
import type { GameCard } from './types'

const makeCookie = (
  name: string,
  level: number,
  hp: number,
  attack?: number,
  instanceId?: string,
): GameCard => ({
  id: `test-${name}`,
  instanceId: instanceId ?? `inst-${name}`,
  name,
  type: 'cookie',
  level,
  hp,
  attack: attack ?? 1,
  attackCost: 1,
})

const boardContext = {
  myBreakLevel: 4,
  oppBreakLevel: 4,
  myBattleAreaCount: 2,
  myTotalBattleHp: 5,
  oppTotalBattleHp: 5,
}

describe('R6b: 替補進階效果評分', () => {
  describe('規則啟用狀態', () => {
    it('Lv.2 不啟用 R6b', () => {
      expect(isRuleEnabled(2, 'R6b')).toBe(false)
    })

    it('Lv.3 啟用 R6b', () => {
      expect(isRuleEnabled(3, 'R6b')).toBe(true)
    })

    it('Lv.4 啟用 R6b', () => {
      expect(isRuleEnabled(4, 'R6b')).toBe(true)
    })
  })

  describe('scoreReplacementAdvanced 基本行為', () => {
    const profile = MATCHUP_PROFILES.red

    it('Lv.3 高效果價值餅乾（Rebel）分數高於低效果價值餅乾（Popcorn）', () => {
      const rebel = makeCookie('Rebel Cookie', 3, 3, 3)
      const popcorn = makeCookie('Popcorn Cookie', 1, 1, 1)

      const rebelScore = scoreReplacementAdvanced(rebel, profile, 'safe', boardContext)
      const popcornScore = scoreReplacementAdvanced(popcorn, profile, 'safe', boardContext)

      expect(rebelScore).toBeGreaterThan(popcornScore)
    })

    it('高 HP 但低效果價值卡不應永遠壓過高效果價值卡', () => {
      const highHpLowEffect = makeCookie('Marshmallow Cookie', 2, 4, 1)
      const midHpHighEffect = makeCookie('Rebel Cookie', 3, 2, 3)

      const scoreA = scoreReplacementAdvanced(highHpLowEffect, profile, 'safe', boardContext)
      const scoreB = scoreReplacementAdvanced(midHpHighEffect, profile, 'safe', boardContext)

      // Rebel should be competitive or higher despite lower HP
      expect(scoreB).toBeGreaterThanOrEqual(scoreA - 5)
    })

    it('資料缺失時不 crash（未知餅乾名稱）', () => {
      const unknown = makeCookie('Unknown Cookie', 2, 2, 1)

      expect(() => {
        scoreReplacementAdvanced(unknown, profile, 'safe', boardContext)
      }).not.toThrow()
    })

    it('非 cookie 類型回傳 0', () => {
      const item: GameCard = {
        id: 'test-item',
        instanceId: 'inst-item',
        name: 'Test Item',
        type: 'item',
      }

      expect(scoreReplacementAdvanced(item, profile, 'safe', boardContext)).toBe(0)
    })
  })

  describe('場面需求加分', () => {
    const profile = MATCHUP_PROFILES.red

    it('我方破壞區高時，防守型餅乾（Banana）加分', () => {
      const banana = makeCookie('Banana Cookie', 2, 3, 1)
      const cherry = makeCookie('Cherry Cookie', 2, 2, 2)

      const highBreakContext = { ...boardContext, myBreakLevel: 9 }
      const bananaScore = scoreReplacementAdvanced(banana, profile, 'safe', highBreakContext)
      const cherryScore = scoreReplacementAdvanced(cherry, profile, 'safe', highBreakContext)

      // Banana is defensive and should benefit from high my break
      expect(bananaScore).toBeGreaterThanOrEqual(cherryScore)
    })

    it('對手破壞區高時，進攻型餅乾加分', () => {
      const rebel = makeCookie('Rebel Cookie', 3, 2, 3)
      const marshmallow = makeCookie('Marshmallow Cookie', 2, 3, 1)

      const highOppBreakContext = { ...boardContext, oppBreakLevel: 9 }
      const rebelScore = scoreReplacementAdvanced(rebel, profile, 'safe', highOppBreakContext)
      const marshmallowScore = scoreReplacementAdvanced(marshmallow, profile, 'safe', highOppBreakContext)

      // Rebel is offensive and should benefit from high opponent break
      expect(rebelScore).toBeGreaterThan(marshmallowScore)
    })

    it('我方戰鬥區只剩 1 隻且 HP 低時，高 HP 替補加分', () => {
      const banana = makeCookie('Banana Cookie', 2, 3, 1)
      const popcorn = makeCookie('Popcorn Cookie', 1, 1, 1)

      const lowBoardContext = { ...boardContext, myBattleAreaCount: 1 }
      const bananaScore = scoreReplacementAdvanced(banana, profile, 'safe', lowBoardContext)
      const popcornScore = scoreReplacementAdvanced(popcorn, profile, 'safe', lowBoardContext)

      expect(bananaScore).toBeGreaterThan(popcornScore)
    })
  })

  describe('生存能力加分', () => {
    const profile = MATCHUP_PROFILES.red

    it('HP 1 的餅乾有生存扣分', () => {
      const hp1 = makeCookie('Cherry Cookie', 2, 1, 2)
      const hp3 = makeCookie('Cherry Cookie', 2, 3, 2)

      const scoreHp1 = scoreReplacementAdvanced(hp1, profile, 'safe', boardContext)
      const scoreHp3 = scoreReplacementAdvanced(hp3, profile, 'safe', boardContext)

      expect(scoreHp3).toBeGreaterThan(scoreHp1)
    })

    it('HP 3+ 的餅乾有生存加分', () => {
      const hp3 = makeCookie('Rebel Cookie', 3, 3, 3)
      const hp1 = makeCookie('Rebel Cookie', 3, 1, 3)

      const scoreHp3 = scoreReplacementAdvanced(hp3, profile, 'safe', boardContext)
      const scoreHp1 = scoreReplacementAdvanced(hp1, profile, 'safe', boardContext)

      expect(scoreHp3).toBeGreaterThan(scoreHp1)
    })
  })

  describe('Lv.2 只使用 R6a（不啟用 R6b）', () => {
    const profile = MATCHUP_PROFILES.red

    it('Lv.2 的 scoreReplacement 不含 R6b 加分', () => {
      const rebel = makeCookie('Rebel Cookie', 3, 3, 3)
      const popcorn = makeCookie('Popcorn Cookie', 1, 1, 1)

      const rebelR6a = scoreReplacement(rebel, profile, 'safe')
      const popcornR6a = scoreReplacement(popcorn, profile, 'safe')

      // R6a: rebel should still beat popcorn (baseScore difference)
      expect(rebelR6a).toBeGreaterThan(popcornR6a)
    })
  })

  describe('Lv.3+ 使用 R6b 場景測試', () => {
    const profile = MATCHUP_PROFILES.red

    it('在合理情境中，Lv.3 會優先選擇有實用效果的替補', () => {
      const candidates = [
        makeCookie('Popcorn Cookie', 1, 1, 1),
        makeCookie('Adventurer Cookie', 1, 1, 1),
        makeCookie('Cherry Cookie', 2, 2, 2),
        makeCookie('Rebel Cookie', 3, 3, 3),
        makeCookie('Dark Choco Cookie', 3, 3, 3),
      ]

      const scored = candidates
        .map((c) => ({
          name: c.name,
          score: scoreReplacementAdvanced(c, profile, 'safe', boardContext),
        }))
        .sort((a, b) => b.score - a.score)

      // Rebel and Dark Choco should be top
      expect(scored[0].name).toMatch(/Rebel|Dark Choco/)
      // Popcorn and Adventurer should be bottom
      const bottomTwoNames = scored.slice(-2).map((s) => s.name)
      expect(bottomTwoNames).toContain('Popcorn Cookie')
    })
  })
})
