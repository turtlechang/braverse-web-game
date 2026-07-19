import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const normalizedPhaseRailCss = readFileSync(
  new URL('./PhaseRail.css', import.meta.url),
  'utf8',
).replace(/\r\n/g, '\n')

describe('PhaseRail CSS grid-row assignments', () => {
  it('turn-indicator specifies grid-row: 1 in base rules', () => {
    expect(normalizedPhaseRailCss).toMatch(/\.turn-indicator\s*\{[^}]*grid-row\s*:\s*1[^}]*\}/)
  })

  it('turn-counter specifies grid-row: 2 in base rules', () => {
    expect(normalizedPhaseRailCss).toMatch(/\.turn-counter\s*\{[^}]*grid-row\s*:\s*2[^}]*\}/)
  })

  it('next-phase-button specifies grid-row: 3 in base rules', () => {
    expect(normalizedPhaseRailCss).toMatch(/\.next-phase-button\s*\{[^}]*grid-row\s*:\s*3[^}]*\}/)
  })

  it('max-width:900px block resets grid-row to 1 for the three remaining children', () => {
    expect(normalizedPhaseRailCss).toMatch(
      /\.turn-indicator\s*,\s*\.turn-counter\s*,\s*\.next-phase-button\s*\{[^}]*grid-row\s*:\s*1[^}]*\}/
    )
  })

  it('is positioned on the right edge of the game shell', () => {
    expect(normalizedPhaseRailCss).toMatch(/\.phase-rail\s*\{[^}]*inset\s*:\s*0\s+0\s+0\s+auto[^}]*\}/)
  })
})
