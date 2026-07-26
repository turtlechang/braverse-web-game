import { describe, expect, it } from 'vitest'
import inventory from '../data/cards/official-age-of-heroes-and-kingdoms-bs3.en.json'
import type { OfficialCardRecord } from '../src/cards/types'
import {
  analyzeBs3EffectCoverage,
  createBs3EffectCoverageMarkdown,
} from './analyze-bs3-effect-coverage'

describe('BS3 effect coverage analysis', () => {
  it('separates primary, ability, and attack-then conversion coverage', () => {
    const report = analyzeBs3EffectCoverage(
      inventory.cards as OfficialCardRecord[],
    )

    expect(report.baseCardCount).toBe(121)
    expect(report.primaryConversion).toEqual({
      supported: 73,
      'no-effect-text': 20,
      'unsupported-effect-text': 28,
    })
    // BS3-025（休息區啟動＋每局一次）與 BS3-046（戰鬥內延遲觸發＋手牌休息區代價）
    // 是最後兩張額外能力來源轉接，至此 121 張 BS3 基礎卡的能力來源已全數轉接。
    expect(report.abilityConversion.pending).toBe(0)
    expect(report.pendingAbilityCards).toEqual([])
    expect(report.attackThen.total).toBeGreaterThan(0)
    expect(report.attackThen.converted).toBeGreaterThanOrEqual(5)
    expect(report.attackThen.pendingCardNumbers).not.toContain('BS3-013')
    expect(report.attackThen.pendingCardNumbers).not.toContain('BS3-017')
    expect(report.attackThen.pendingCardNumbers).not.toContain('BS3-041')
    expect(report.attackThen.pendingCardNumbers).not.toContain('BS3-100')
    expect(report.attackThen.pendingCardNumbers).not.toContain('BS3-109')
  })

  it('renders the unresolved candidate lists without claiming promotion readiness', () => {
    const markdown = createBs3EffectCoverageMarkdown(
      analyzeBs3EffectCoverage(inventory.cards as OfficialCardRecord[]),
    )

    expect(markdown).toContain('# BS3 效果轉接覆蓋盤點')
    expect(markdown).toContain('不得 promote')
    // 額外能力來源已全數轉接，待轉接表格改為顯示空狀態的佔位列。
    expect(markdown).toContain('| — | — | — | — |')
  })
})
