import { describe, expect, it } from 'vitest'
import phaseRailCss from './PhaseRail.css?inline'

describe('PhaseRail CSS grid-row assignments', () => {
  it('brand-mark specifies grid-row: 1 in base rules', () => {
    expect(phaseRailCss).toMatch(/\.brand-mark\s*\{[^}]*grid-row\s*:\s*1[^}]*\}/)
  })

  it('turn-indicator specifies grid-row: 2 in base rules', () => {
    expect(phaseRailCss).toMatch(/\.turn-indicator\s*\{[^}]*grid-row\s*:\s*2[^}]*\}/)
  })

  it('phase-rail ol specifies grid-row: 3 in base rules', () => {
    expect(phaseRailCss).toMatch(/\.phase-rail\s+ol\s*\{[^}]*grid-row\s*:\s*3[^}]*\}/)
  })

  it('next-phase-button specifies grid-row: 4 in base rules', () => {
    expect(phaseRailCss).toMatch(/\.next-phase-button\s*\{[^}]*grid-row\s*:\s*4[^}]*\}/)
  })

  it('turn-counter specifies grid-row: 5 in base rules', () => {
    expect(phaseRailCss).toMatch(/\.turn-counter\s*\{[^}]*grid-row\s*:\s*5[^}]*\}/)
  })

  it('max-width:900px block resets grid-row to 1 for all five children', () => {
    expect(phaseRailCss).toMatch(
      /\.brand-mark\s*,\s*\.turn-indicator\s*,\s*\.phase-rail\s+ol\s*,\s*\.next-phase-button\s*,\s*\.turn-counter\s*\{[^}]*grid-row\s*:\s*1[^}]*\}/
    )
  })
})
