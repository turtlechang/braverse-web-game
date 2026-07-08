import { describe, expect, it } from 'vitest'
import { isRuleEnabled } from './ai/rule-profiles'
import { readFileSync } from 'fs'
import { resolve } from 'path'

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
    it('responseRiskPenalty 存在且被 twoPlyCandidateScore 使用', () => {
      const filePath = resolve(__dirname, 'ai', 'evaluated-turn-handler.ts')
      const content = readFileSync(filePath, 'utf-8')

      expect(content).toContain('const responseRiskPenalty = (')
      expect(content).toContain('score -= responseRiskPenalty(state, resolved, playerId)')
    })

    it('R10 不取代 lv4RiskBonus', () => {
      const filePath = resolve(__dirname, 'ai', 'evaluated-turn-handler.ts')
      const content = readFileSync(filePath, 'utf-8')

      // lv4RiskBonus 仍存在且仍被使用
      expect(content).toContain('const lv4RiskBonus = (')
      expect(content).toContain('lv4RiskBonus(view, playerId)')
      // responseRiskPenalty 是用 -= 叠加，不是取代
      expect(content).toContain('score -= responseRiskPenalty')
    })

    it('R10 不讀取對手隱藏資訊', () => {
      const filePath = resolve(__dirname, 'ai', 'evaluated-turn-handler.ts')
      const content = readFileSync(filePath, 'utf-8')

      const r10Start = content.indexOf('const responseRiskPenalty')
      const r10Section = content.slice(r10Start, r10Start + 600)

      // 不存取 opponent.hand / opponent.deck
      expect(r10Section).not.toContain('opponent.hand')
      expect(r10Section).not.toContain('opponent.deck')
      // 只使用公開 break area
      expect(r10Section).toContain('breakArea')
    })
  })
})
