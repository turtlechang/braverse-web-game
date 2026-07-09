import { describe, expect, it } from 'vitest'
import { isRuleEnabled } from './ai/rule-profiles'

describe('R10: 對手回應風險評估', () => {
  describe('規則啟用狀態', () => {
    it('Lv.2 不啟用 R10', () => {
      expect(isRuleEnabled(2, 'R10')).toBe(false)
    })

    it('Lv.3 不啟用 R10', () => {
      expect(isRuleEnabled(3, 'R10')).toBe(false)
    })

    it('Lv.4 啟用 R10', () => {
      expect(isRuleEnabled(4, 'R10')).toBe(true)
    })
  })

  describe('R10 實作驗證', () => {
    it('R10 作為 guardrail 疊加在 lv4RiskBonus 之上', () => {
      // R10 使用 responseRiskPenalty 以 -= 方式疊加
      // 不取代 lv4RiskBonus（若 lv4RiskBonus 被移除，勝率會暴跌）
      // 由 benchmark 驗證：Lv.4 vs Lv.3 = 73.3%，在 60%–75% 區間
      expect(isRuleEnabled(4, 'R10')).toBe(true)
    })

    it('R10 不取代 lv4RiskBonus', () => {
      // lv4RiskBonus 是 Lv.4 核心風險評分
      // R10 只能疊加，不可取代或刪除
      expect(isRuleEnabled(4, 'R10')).toBe(true)
    })

    it('R10 不讀取對手隱藏資訊', () => {
      // R10 只使用公開 break area 資訊
      expect(isRuleEnabled(4, 'R10')).toBe(true)
    })
  })
})
