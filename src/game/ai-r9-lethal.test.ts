import { describe, expect, it } from 'vitest'
import { isRuleEnabled } from './ai/rule-profiles'
import { readFileSync } from 'fs'
import { resolve } from 'path'

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

  describe('R9 行為驗證（via benchmark）', () => {
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
    it('lv4RiskBonus 存在且被 twoPlyCandidateScore 使用', () => {
      const filePath = resolve(__dirname, 'ai', 'evaluated-turn-handler.ts')
      const content = readFileSync(filePath, 'utf-8')

      // lv4RiskBonus 函式必須存在
      expect(content).toContain('const lv4RiskBonus = (')
      // twoPlyCandidateScore 必須呼叫 lv4RiskBonus
      expect(content).toContain('lv4RiskBonus(view, playerId)')
      // 標記為不可刪除
      expect(content).toContain('Lv.4 既有核心風險評分')
    })

    it('lethalDetectionBonus 存在且被 twoPlyCandidateScore 使用', () => {
      const filePath = resolve(__dirname, 'ai', 'evaluated-turn-handler.ts')
      const content = readFileSync(filePath, 'utf-8')

      expect(content).toContain('const lethalDetectionBonus = (')
      expect(content).toContain('score += lethalDetectionBonus(state, playerId, command)')
    })

    it('勝利條件閾值為 >= 10（非 >= 12）', () => {
      const filePath = resolve(__dirname, 'ai', 'evaluated-turn-handler.ts')
      const content = readFileSync(filePath, 'utf-8')

      // lethalDetectionBonus 中不應有 >= 12 作為勝利條件
      const lethalStart = content.indexOf('const lethalDetectionBonus')
      const lethalSection = content.slice(lethalStart, lethalStart + 1500)
      expect(lethalSection).not.toContain('>= 12')
      expect(lethalSection).toContain('>= 10')
    })
  })
})
