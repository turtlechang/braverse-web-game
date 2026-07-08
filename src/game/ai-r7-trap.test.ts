import { describe, expect, it } from 'vitest'
import { isRuleEnabled } from './ai/rule-profiles'

describe('R7: 陷阱防護高價值目標', () => {
  describe('規則啟用狀態', () => {
    it('Lv.2 不啟用 R7', () => {
      expect(isRuleEnabled(2, 'R7')).toBe(false)
    })

    it('Lv.3 啟用 R7', () => {
      expect(isRuleEnabled(3, 'R7')).toBe(true)
    })

    it('Lv.4 啟用 R7', () => {
      expect(isRuleEnabled(4, 'R7')).toBe(true)
    })
  })

  describe('R7 行為驗證（via benchmark）', () => {
    it('Lv.2 vs Lv.1: R7 未啟用，所有陷阱都使用', () => {
      // Lv.2 不受 R7 影響，Trap Skipped 應為 0
      // 由 benchmark 驗證：Trap Offered = Trap Played
      expect(isRuleEnabled(2, 'R7')).toBe(false)
    })

    it('Lv.3+ 會在低價值場景跳過陷阱', () => {
      // 由 benchmark 驗證：Lv.3 vs Lv.2 Trap Skipped >= 1
      // Lv.4 vs Lv.3 Trap Skipped >= 1
      expect(isRuleEnabled(3, 'R7')).toBe(true)
      expect(isRuleEnabled(4, 'R7')).toBe(true)
    })
  })
})
