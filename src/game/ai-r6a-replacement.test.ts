import { describe, expect, it } from 'vitest'
import {
  calculateReplacementBaseScore,
  scoreReplacement,
  MATCHUP_PROFILES,
} from './ai/bs2MatchupProfiles'
import type { GameCard } from './types'

const makeCookie = (
  name: string,
  level: number,
  hp: number,
  instanceId?: string,
): GameCard => ({
  id: `test-${name}`,
  instanceId: instanceId ?? `inst-${name}`,
  name,
  type: 'cookie',
  level,
  hp,
  attack: 1,
  attackCost: 1,
})

describe('R6a: 替補基礎品質篩選', () => {
  describe('calculateReplacementBaseScore', () => {
    it('Lv.1 HP-1 餅乾分數最低', () => {
      const cookie = makeCookie('Popcorn Cookie', 1, 1)
      expect(calculateReplacementBaseScore(cookie)).toBe(5) // 1*3 + 1*2
    })

    it('Lv.2 HP-2 餅乾分數中等', () => {
      const cookie = makeCookie('Cherry Cookie', 2, 2)
      expect(calculateReplacementBaseScore(cookie)).toBe(10) // 2*3 + 2*2
    })

    it('Lv.2 HP-3 餅乾分數較高', () => {
      const cookie = makeCookie('Princess Cookie', 2, 3)
      expect(calculateReplacementBaseScore(cookie)).toBe(12) // 2*3 + 3*2
    })

    it('Lv.3 HP-3 餅乾分數最高', () => {
      const cookie = makeCookie('Rebel Cookie', 3, 3)
      expect(calculateReplacementBaseScore(cookie)).toBe(15) // 3*3 + 3*2
    })

    it('非 cookie 類型回傳 0', () => {
      const item: GameCard = {
        id: 'test-item',
        instanceId: 'inst-item',
        name: 'Test Item',
        type: 'item',
      }
      expect(calculateReplacementBaseScore(item)).toBe(0)
    })

    it('Lv.3 HP-2 餅乾分數高於 Lv.2 HP-3', () => {
      const lv3hp2 = makeCookie('Lv3 HP2', 3, 2)
      const lv2hp3 = makeCookie('Lv2 HP3', 2, 3)
      expect(calculateReplacementBaseScore(lv3hp2)).toBeGreaterThan(
        calculateReplacementBaseScore(lv2hp3),
      )
    })
  })

  describe('scoreReplacement 整合測試', () => {
    const profile = MATCHUP_PROFILES.red

    it('Lv.3 餅乾分數高於 Lv.2，Lv.2 高於 Lv.1', () => {
      const lv1 = makeCookie('Popcorn Cookie', 1, 1)
      const lv2 = makeCookie('Princess Cookie', 2, 3)
      const lv3 = makeCookie('Rebel Cookie', 3, 3)

      const scoreLv1 = scoreReplacement(lv1, profile, 'safe')
      const scoreLv2 = scoreReplacement(lv2, profile, 'safe')
      const scoreLv3 = scoreReplacement(lv3, profile, 'safe')

      expect(scoreLv3).toBeGreaterThan(scoreLv2)
      expect(scoreLv2).toBeGreaterThan(scoreLv1)
    })

    it('低價值餅乾有額外懲罰', () => {
      const lowValue = makeCookie('Popcorn Cookie', 1, 1)
      const normalLv1 = makeCookie('Test Cookie', 1, 1)

      const scoreLow = scoreReplacement(lowValue, profile, 'safe')
      const scoreNormal = scoreReplacement(normalLv1, profile, 'safe')

      expect(scoreLow).toBeLessThan(scoreNormal)
    })

    it('危急時 HP 更有价值', () => {
      const cookie = makeCookie('Test Cookie', 2, 3)
      const scoreSafe = scoreReplacement(cookie, profile, 'safe')
      const scoreCritical = scoreReplacement(cookie, profile, 'critical')

      expect(scoreCritical).toBeGreaterThan(scoreSafe)
    })

    it('所有 BS2 紅色替補候選中，高等級餅乾排名更高', () => {
      const candidates = [
        makeCookie('Popcorn Cookie', 1, 1),
        makeCookie('Adventurer Cookie', 1, 1),
        makeCookie('Carrot Cookie', 1, 1),
        makeCookie('Cherry Cookie', 2, 2),
        makeCookie('Princess Cookie', 2, 3),
        makeCookie('Rebel Cookie', 3, 3),
        makeCookie('Dark Choco Cookie', 3, 3),
      ]

      const scored = candidates
        .map((c) => ({
          name: c.name,
          score: scoreReplacement(c, profile, 'safe'),
        }))
        .sort((a, b) => b.score - a.score)

      // Lv.3 餅乾排名最高
      expect(scored[0].name).toBe('Rebel Cookie')
      // Lv.1 低價值餅乾（Popcorn, Adventurer, Carrot）全部排在最後
      const bottomThreeNames = scored.slice(-3).map((s) => s.name)
      expect(bottomThreeNames).toContain('Popcorn Cookie')
      expect(bottomThreeNames).toContain('Adventurer Cookie')
      expect(bottomThreeNames).toContain('Carrot Cookie')

      // Lv.3 和 Lv.1 的分數差距至少 5
      const rebelScore = scored.find((s) => s.name === 'Rebel Cookie')!.score
      const popcornScore = scored.find(
        (s) => s.name === 'Popcorn Cookie',
      )!.score
      expect(rebelScore).toBeGreaterThan(popcornScore + 5)
    })
  })
})
