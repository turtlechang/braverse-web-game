import { describe, expect, it } from 'vitest'
import inventory from '../data/candidates/official-age-of-heroes-and-kingdoms-bs5.en.json'
import type { OfficialCardRecord } from '../src/cards/types'
import {
  analyzeBs5EffectCoverage,
  createBs5EffectCoverageMarkdown,
} from './analyze-bs5-effect-coverage'

describe('BS5 effect coverage analysis', () => {
  it('audits only base card numbers and accounts for every primary conversion', () => {
    const report = analyzeBs5EffectCoverage(
      inventory.cards as OfficialCardRecord[],
    )

    expect(report.baseCardCount).toBe(111)
    expect(
      Object.values(report.primaryConversion).reduce(
        (total, count) => total + count,
        0,
      ),
    ).toBe(report.baseCardCount)
    expect(report.entries.every((entry) => !entry.cardNumber.includes('@'))).toBe(
      true,
    )
  })

  it('keeps every colour visible in the audit matrix', () => {
    const report = analyzeBs5EffectCoverage(
      inventory.cards as OfficialCardRecord[],
    )

    expect(Object.keys(report.byColor)).toEqual(
      expect.arrayContaining(['BLUE', 'GREEN', 'PURPLE', 'RED', 'YELLOW']),
    )
    expect(report.byColor.RED.total).toBeGreaterThan(0)
    expect(report.byColor.YELLOW.total).toBeGreaterThan(0)
    expect(report.byColor.GREEN.total).toBeGreaterThan(0)
    expect(report.byColor.BLUE.total).toBeGreaterThan(0)
    expect(report.byColor.PURPLE.total).toBeGreaterThan(0)
  })

  it('renders runtime and promotion gates with the pending card tables', () => {
    const markdown = createBs5EffectCoverageMarkdown(
      analyzeBs5EffectCoverage(inventory.cards as OfficialCardRecord[]),
    )

    expect(markdown).toContain('# BS5 效果轉接覆蓋盤點')
    expect(markdown).toContain('## 逐色稽核矩陣')
    expect(markdown).toContain('## Promotion 門檻')
    expect(markdown).toContain('不得執行 `promote:candidate`')
  })
})
