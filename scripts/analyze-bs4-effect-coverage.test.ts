import { describe, expect, it } from 'vitest'
import inventory from '../data/cards/official-age-of-heroes-and-kingdoms-bs4.en.json'
import type { OfficialCardRecord } from '../src/cards/types'
import {
  analyzeBs4EffectCoverage,
  createBs4EffectCoverageMarkdown,
} from './analyze-bs4-effect-coverage'

describe('BS4 effect coverage analysis', () => {
  it('uses the same specialised ability adapters as the runtime', () => {
    const report = analyzeBs4EffectCoverage(
      inventory.cards as OfficialCardRecord[],
    )

    expect(report.baseCardCount).toBe(111)
    expect(report.primaryConversion['unsupported-effect-text']).toBe(0)
    expect(report.abilityConversion.pending).toBe(0)
    expect(report.attackThen.pendingCardNumbers).toEqual([])
  })

  it('renders no pending primary or ability conversion', () => {
    const markdown = createBs4EffectCoverageMarkdown(
      analyzeBs4EffectCoverage(inventory.cards as OfficialCardRecord[]),
    )

    expect(markdown).toContain('| 主要效果文字待轉接 | 0 |')
    expect(markdown).toContain('| 額外能力來源待轉接 | 0 |')
    expect(markdown).toContain('\n無\n')
  })
})
