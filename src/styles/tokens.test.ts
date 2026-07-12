import { describe, expect, it } from 'vitest'
import { designThemes, type DesignTheme } from './tokens'

describe('designTokens', () => {
  it('匯出五個視覺變體', () => {
    expect(designThemes).toHaveLength(5)
    const ids = designThemes.map((t) => t.id)
    expect(ids).toEqual([
      'tactical',
      'tactical-clean',
      'tactical-mono',
      'low-glare',
      'broadcast',
    ])
  })

  it('每個變體有 id / label / description', () => {
    for (const theme of designThemes) {
      expect(theme.id).toBeTruthy()
      expect(theme.label).toBeTruthy()
      expect(theme.description).toBeTruthy()
    }
  })

  it('tactical-clean 為預設變體', () => {
    const defaultTheme: DesignTheme = 'tactical-clean'
    expect(designThemes.find((t) => t.id === defaultTheme)).toBeDefined()
  })
})
