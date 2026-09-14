import { describe, expect, it } from 'vitest'
import bs9CandidateDataset from '../data/cards/official-a-game-of-truth-and-deceit-bs9.en.json'
import type { OfficialCardRecord } from '../src/cards/types'
import { analyzeBs6EffectCoverage } from './analyze-bs6-effect-coverage'

describe('BS9 effect coverage analysis', () => {
  it('uses the dedicated EXTRA adapter for every BS9 EXTRA base card', () => {
    const report = analyzeBs6EffectCoverage(
      bs9CandidateDataset.cards as OfficialCardRecord[],
    )

    expect(report.entries.filter((entry) => entry.type === 'extra')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ cardNumber: 'BS9-010', abilityConversion: 'converted' }),
        expect.objectContaining({ cardNumber: 'BS9-030', abilityConversion: 'converted' }),
        expect.objectContaining({ cardNumber: 'BS9-055', abilityConversion: 'converted' }),
        expect.objectContaining({ cardNumber: 'BS9-088', abilityConversion: 'converted' }),
        expect.objectContaining({ cardNumber: 'BS9-102', abilityConversion: 'converted' }),
      ]),
    )
  })

  it('reports BS9-025 as converted alongside the remaining EXTRA mappings', () => {
    const report = analyzeBs6EffectCoverage(
      bs9CandidateDataset.cards as OfficialCardRecord[],
    )

    expect(report.primaryConversion).toMatchObject({
      supported: 74,
      'unsupported-effect-text': 0,
    })
    expect(report.abilityConversion).toMatchObject({
      converted: 74,
      pending: 0,
    })
    expect(report.pendingAbilityCards).toEqual([])
    expect(report.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ cardNumber: 'BS9-025', primaryConversion: 'supported', abilityConversion: 'converted' }),
      ]),
    )
  })
})
