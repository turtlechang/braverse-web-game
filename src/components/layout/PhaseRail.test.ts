import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const normalizedPhaseRailCss = readFileSync(
  new URL('./PhaseRail.css', import.meta.url),
  'utf8',
).replace(/\r\n/g, '\n')

describe('PhaseRail CSS grid-row assignments', () => {
  it('brand-mark specifies grid-row: 1 in base rules', () => {
    expect(normalizedPhaseRailCss).toMatch(/\.brand-mark\s*\{[^}]*grid-row\s*:\s*1[^}]*\}/)
  })

  it('turn-indicator specifies grid-row: 2 in base rules', () => {
    expect(normalizedPhaseRailCss).toMatch(/\.turn-indicator\s*\{[^}]*grid-row\s*:\s*2[^}]*\}/)
  })

  it('phase-rail ol specifies grid-row: 3 in base rules', () => {
    expect(normalizedPhaseRailCss).toMatch(/\.phase-rail\s+ol\s*\{[^}]*grid-row\s*:\s*3[^}]*\}/)
  })

  it('next-phase-button specifies grid-row: 5 in base rules', () => {
    expect(normalizedPhaseRailCss).toMatch(/\.next-phase-button\s*\{[^}]*grid-row\s*:\s*5[^}]*\}/)
  })

  it('turn-counter specifies grid-row: 6 in base rules', () => {
    expect(normalizedPhaseRailCss).toMatch(/\.turn-counter\s*\{[^}]*grid-row\s*:\s*6[^}]*\}/)
  })

  it('max-width:900px block resets grid-row to 1 for all six children', () => {
    expect(normalizedPhaseRailCss).toMatch(
      /\.brand-mark\s*,\s*\.turn-indicator\s*,\s*\.phase-rail\s+ol\s*,\s*\.phase-hint\s*,\s*\.next-phase-button\s*,\s*\.turn-counter\s*\{[^}]*grid-row\s*:\s*1[^}]*\}/
    )
  })
})
