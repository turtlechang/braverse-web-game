import { describe, expect, it } from 'vitest'
import officialBs6Dataset from '../data/cards/official-age-of-heroes-and-kingdoms-bs6.en.json'
import type { OfficialCardRecord } from '../src/cards/types'
import {
  analyzeBs6EffectCoverage,
  createBs6EffectCoverageMarkdown,
} from './analyze-bs6-effect-coverage'

describe('BS6 effect coverage analysis', () => {
  it('audits every base card number and accounts for every primary conversion', () => {
    const report = analyzeBs6EffectCoverage(
      officialBs6Dataset.cards as OfficialCardRecord[],
    )

    expect(report.baseCardCount).toBe(107)
    expect(
      Object.values(report.primaryConversion).reduce(
        (total, count) => total + count,
        0,
      ),
    ).toBe(report.baseCardCount)
    expect(report.entries).toContainEqual(
      expect.objectContaining({
        cardNumber: 'BS6-091@2',
        primaryConversion: 'supported',
      }),
    )
  })

  it('keeps every colour visible in the audit matrix', () => {
    const report = analyzeBs6EffectCoverage(
      officialBs6Dataset.cards as OfficialCardRecord[],
    )

    expect(Object.keys(report.byColor)).toEqual(
      expect.arrayContaining(['BLUE', 'GREEN', 'PURPLE', 'RED', 'YELLOW']),
    )
  })

  it('uses the specialised Trap adapter for primary coverage', () => {
    const report = analyzeBs6EffectCoverage([
      {
        cardNumber: 'BS6-042',
        baseCardNumber: 'BS6-042',
        name: 'Clever Advice',
        type: 'trap',
        color: 'YELLOW',
        skill: { name: null, text: null },
        attackText:
          '<{Y}> If there are 3 or more Cookies in your break area, select up to 1 of your opponent\'s Cookies that is LV.2 or higher. During this turn, that Cookie deals -2 attack damage. Then, draw up to 1 card from your deck.',
        flipText: null,
      } as OfficialCardRecord,
    ])

    expect(report.primaryUnsupportedCards).toEqual([])
    expect(report.entries[0]?.abilityConversion).toBe('converted')
  })

  it('renders inventory and promotion gates with pending card tables', () => {
    const markdown = createBs6EffectCoverageMarkdown(
      analyzeBs6EffectCoverage(officialBs6Dataset.cards as OfficialCardRecord[]),
    )

    expect(markdown).toContain('# BS6 效果轉接覆蓋盤點（正式卡池）')
    expect(markdown).toContain('## 逐色稽核矩陣')
    expect(markdown).toContain('正式對戰狀態以 Chrome')
    expect(markdown).toContain('再次 promote')
  })
})
