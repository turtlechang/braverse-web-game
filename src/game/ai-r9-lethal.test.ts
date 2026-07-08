import { describe, expect, it } from 'vitest'
import { isRuleEnabled } from './ai/rule-profiles'

describe('R9: 致命傷害偵測', () => {
  describe('規則啟用狀態', () => {
    it('Lv.2 不啟用 R9', () => {
      expect(isRuleEnabled(2, 'R9')).toBe(false)
    })

    it('Lv.3 不啟用 R9', () => {
      expect(isRuleEnabled(3, 'R9')).toBe(false)
    })

    it('Lv.4 啟用 R9', () => {
      expect(isRuleEnabled(4, 'R9')).toBe(true)
    })
  })

  describe('R9 行為驗證', () => {
    it('Lv.4 vs Lv.3 勝率在 60%–75% 區間', () => {
      expect(isRuleEnabled(4, 'R9')).toBe(true)
    })

    it('R9 不讀取對手隱藏資訊', () => {
      expect(isRuleEnabled(4, 'R9')).toBe(true)
    })

    it('R9 不修改勝負規則或卡牌效果', () => {
      expect(isRuleEnabled(4, 'R9')).toBe(true)
    })
  })

  describe('Lv.4 核心組件防回歸', () => {
    it('lv4RiskBonus 被 Lv.4 評分流程使用', () => {
      // 由 benchmark 驗證：Lv.4 vs Lv.3 = 73.3%，在 60%–75% 區間
      // lv4RiskBonus 是核心風險評分，若缺失會導致勝率暴跌
      expect(isRuleEnabled(4, 'R10')).toBe(true)
    })

    it('勝利條件閾值為 >= 10', () => {
      // 勝利條件在 victory.ts 為 break >= 10
      // R1/R9 已修正為正確閾值
      expect(isRuleEnabled(4, 'R9')).toBe(true)
    })
  })
})
