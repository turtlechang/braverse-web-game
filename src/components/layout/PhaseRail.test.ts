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

  it('next-phase-button specifies grid-row: 2 in base rules', () => {
    expect(normalizedPhaseRailCss).toMatch(/\.next-phase-button\s*\{[^}]*grid-row\s*:\s*2[^}]*\}/)
  })

  it('max-width:900px block resets grid-row to 1 for the two remaining children', () => {
    expect(normalizedPhaseRailCss).toMatch(
      /\.turn-indicator\s*,\s*\.next-phase-button\s*\{[^}]*grid-row\s*:\s*1[^}]*\}/
    )
  })

  it('floats as a vertically-centered block anchored to the right edge of its container', () => {
    expect(normalizedPhaseRailCss).toMatch(/\.phase-rail\s*\{[^}]*top\s*:\s*50%[^}]*\}/)
    expect(normalizedPhaseRailCss).toMatch(/\.phase-rail\s*\{[^}]*right\s*:\s*0[^}]*\}/)
  })

  it('keeps the desktop rail vertically centered against the game-shell right edge', () => {
    expect(normalizedPhaseRailCss).toMatch(
      /@container game-shell \(min-width: 901px\)\s*\{\s*\.phase-rail\s*\{[^}]*top\s*:\s*50%[^}]*right\s*:\s*0[^}]*bottom\s*:\s*auto[^}]*transform\s*:\s*translateY\(-50%\)[^}]*\}/,
    )
  })

  it('uses a gold background for the phase rail while preserving turn ownership colors', () => {
    expect(normalizedPhaseRailCss).toContain('background: #d4af37')
    expect(normalizedPhaseRailCss).toContain('rgba(37, 99, 235, 0.78)')
    expect(normalizedPhaseRailCss).toContain('rgba(220, 38, 38, 0.76)')
  })

  it('uses blue for the player turn and red for the opponent turn on desktop', () => {
    const desktopPlayerRule = normalizedPhaseRailCss.match(
      /@container game-shell \(min-width: 901px\)\s*\{[\s\S]*?\.turn-indicator\.is-player\s*\{[\s\S]*?\n {2}}/,
    )?.[0]
    const desktopOpponentRule = normalizedPhaseRailCss.match(
      /@container game-shell \(min-width: 901px\)\s*\{[\s\S]*?\.turn-indicator\.is-opponent\s*\{[\s\S]*?\n {2}}/,
    )?.[0]

    expect(desktopPlayerRule).toContain('rgba(37, 99, 235, 0.78)')
    expect(desktopOpponentRule).toContain('rgba(220, 38, 38, 0.76)')
  })
})
