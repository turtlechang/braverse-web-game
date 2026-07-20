import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const normalizedCss = readFileSync(
  new URL('./BattleRow.css', import.meta.url),
  'utf8',
).replace(/\r\n/g, '\n')

describe('player hand hover styles', () => {
  it('keeps the bottom hand inside its fan viewport without clipping every card', () => {
    const baseFanRule = normalizedCss.match(
      /\.hand-fan\.bottom-hand\s*\{[\s\S]*?\n}/,
    )?.[0]
    const baseCardRule = normalizedCss.match(
      /\.hand-fan\.bottom-hand \.hand-card-wrap\s*\{[\s\S]*?\n}/,
    )?.[0]

    expect(baseFanRule).toContain('bottom: 102px')
    expect(baseFanRule).toContain('height: 95px')
    expect(baseCardRule).toContain('bottom: -94px')
    expect(baseCardRule).not.toContain('overflow: hidden')
  })

  it('keeps the fan transform while lifting 8px and scaling slightly', () => {
    const hoverRule = normalizedCss.match(
      /\.bottom-hand \.hand-card-wrap:hover,[\s\S]*?\n}/,
    )?.[0]

    expect(hoverRule).toContain(
      'translateX(calc(-50% + var(--fan-x))) translateY(calc(var(--fan-y) - 8px)) rotate(var(--fan-rotation)) scale(1.02)',
    )
    expect(normalizedCss).toContain(
      'translateX(calc(-50% + var(--fan-x))) translateY(var(--fan-y)) rotate(var(--fan-rotation)) scale(1.07)',
    )
  })

  it('keeps the desktop player hand fully visible above the support zone', () => {
    expect(normalizedCss).toContain('height: calc(100% - var(--break-summary-end))')
    expect(normalizedCss).toContain('z-index: 40')
    expect(normalizedCss).toContain('bottom: 2px')
    expect(normalizedCss).toContain('height: 180px')
    expect(normalizedCss).toContain('overflow: visible')
    expect(normalizedCss).toContain('.bottom-hand .hand-card')
    expect(normalizedCss).toContain('width: 100px')
    expect(normalizedCss).not.toContain('bottom: -50px')
  })

  it('pins one-third of the opponent hand to the game-shell top center on desktop', () => {
    expect(normalizedCss).toContain('height: calc(100% - var(--break-summary-start))')
    expect(normalizedCss).toContain('position: fixed')
    expect(normalizedCss).toContain('top: 0')
    expect(normalizedCss).toContain('left: 50%')
    expect(normalizedCss).toContain('height: 72px')
    expect(normalizedCss).toContain('overflow: hidden')
    expect(normalizedCss).toContain('.top-hand .hand-card-wrap.opponent-hand-card')
    expect(normalizedCss).toContain('top: -142px')
  })

  it('anchors player metadata at the game-shell corners on desktop', () => {
    expect(normalizedCss).toMatch(
      /\.top-field \.row-meta\s*\{[^}]*position: fixed[^}]*top: 16px[^}]*right: 16px[^}]*transform: scale\(1\.44\)[^}]*transform-origin: top right/,
    )
    expect(normalizedCss).toMatch(
      /\.bottom-field \.row-meta\s*\{[^}]*position: fixed[^}]*bottom: 16px[^}]*left: 16px[^}]*transform: scale\(1\.44\)[^}]*transform-origin: bottom left/,
    )
  })

  it('uses a red right border for the opponent metadata', () => {
    expect(normalizedCss).toMatch(
      /\.top-field \.row-meta\s*\{[^}]*border-right-color:\s*rgba\(220, 38, 38, 0\.76\)[^}]*}/,
    )
  })

  it('uses a blue active border for the player metadata', () => {
    expect(normalizedCss).toMatch(
      /\.bottom-field \.row-meta\[data-active='true'\]\s*\{[^}]*border-left-color:\s*#2179d1[^}]*}/,
    )
  })

  it('ends the player break-zone at the visible field-stack lower edge on desktop', () => {
    expect(normalizedCss).toMatch(
      /\.bottom-field \.break-zone\s*,\s*\.bottom-field \.utility-zones\s*\{[^}]*align-self:\s*start[^}]*height:\s*calc\(100% - var\(--break-summary-end\)\)[^}]*}/,
    )
  })

  it('starts the opponent break-zone at the visible field-stack upper edge on desktop', () => {
    expect(normalizedCss).toMatch(
      /\.top-field \.break-zone\s*,\s*\.top-field \.utility-zones\s*\{[^}]*align-self:\s*end[^}]*height:\s*calc\(100% - var\(--break-summary-start\)\)[^}]*}/,
    )
  })

  it('uses the same bounds for each break-zone and visible field-stack on desktop', () => {
    expect(normalizedCss).toContain('--break-summary-start: 72px')
    expect(normalizedCss).toContain('--break-summary-end: 112px')
    expect(normalizedCss).toContain('height: calc(100% - var(--break-summary-start))')
    expect(normalizedCss).toContain('height: calc(100% - var(--break-summary-end))')
  })

  it('places deck and discard piles beside each other on their respective player sides', () => {
    expect(normalizedCss).toMatch(
      /\.top-field \.deck-zone\s*\{[^}]*grid-column:\s*1[^}]*grid-row:\s*1[^}]*}/,
    )
    expect(normalizedCss).toMatch(
      /\.top-field \.discard-zone\s*\{[^}]*grid-column:\s*2[^}]*grid-row:\s*1[^}]*}/,
    )
    expect(normalizedCss).toMatch(
      /\.bottom-field \.discard-zone\s*\{[^}]*grid-column:\s*1[^}]*grid-row:\s*3[^}]*}/,
    )
    expect(normalizedCss).toMatch(
      /\.bottom-field \.discard-zone\.resource-summary\s*\{[^}]*height:\s*80px[^}]*align-self:\s*end[^}]*}/,
    )
    expect(normalizedCss).toMatch(
      /\.bottom-field \.deck-zone\s*\{[^}]*grid-column:\s*2[^}]*grid-row:\s*3[^}]*}/,
    )
    expect(normalizedCss).toMatch(
      /\.bottom-field \.deck-zone\.resource-dock\s*\{[^}]*width:\s*86px[^}]*height:\s*80px[^}]*}/,
    )
    expect(normalizedCss).toMatch(
      /\.top-field \.utility-zones\s*\{[^}]*width:\s*176px[^}]*justify-self:\s*end[^}]*}/,
    )
    expect(normalizedCss).toMatch(
      /\.bottom-field \.utility-zones\s*\{[^}]*width:\s*176px[^}]*justify-self:\s*start[^}]*}/,
    )
  })

  it('aligns stage zones toward their respective combat areas without stretching them', () => {
    expect(normalizedCss).toMatch(
      /\.top-field \.stage-zone\s*\{[^}]*grid-row:\s*2[^}]*justify-self:\s*end[^}]*}/,
    )
    expect(normalizedCss).toMatch(
      /\.bottom-field \.stage-zone\s*\{[^}]*grid-row:\s*2[^}]*justify-self:\s*start[^}]*}/,
    )
  })

  it('places the player support count just outside the support zone lower-left edge', () => {
    expect(normalizedCss).toMatch(
      /\.bottom-field \.support-count\s*\{[^}]*top:\s*auto[^}]*bottom:\s*-18px[^}]*left:\s*0[^}]*}/,
    )
  })

  it('places the opponent support count just outside the support zone upper-right edge', () => {
    expect(normalizedCss).toMatch(
      /\.top-field \.support-count\s*\{[^}]*top:\s*-18px[^}]*right:\s*0[^}]*bottom:\s*auto[^}]*left:\s*auto[^}]*}/,
    )
  })

  it('enlarges both support counts by 20 percent', () => {
    expect(normalizedCss.lastIndexOf('.support-count {')).toBeGreaterThan(
      normalizedCss.lastIndexOf('.top-field .support-count {'),
    )
    expect(normalizedCss).toMatch(
      /\.support-count\s*\{[^}]*font-size:\s*0\.792rem[^}]*}/,
    )
  })

  it('keeps the player hand card wrappers fully opaque', () => {
    expect(normalizedCss).toMatch(
      /\.bottom-hand \.hand-card-wrap\s*\{[^}]*opacity:\s*1[^}]*}/,
    )
  })

  it('keeps the opponent hand card wrappers fully opaque', () => {
    expect(normalizedCss).toMatch(
      /\.top-hand \.hand-card-wrap\s*\{[^}]*opacity:\s*1[^}]*}/,
    )
  })

  it('gives matching heights to the player and opponent combat and support zones', () => {
    expect(normalizedCss).toMatch(
      /\.field-stack\s*\{[^}]*grid-template-rows:\s*minmax\(0, 62fr\) minmax\(0, 38fr\)[^}]*}/,
    )
    expect(normalizedCss).toMatch(
      /\.bottom-field \.field-stack\s*\{[^}]*grid-template-rows:\s*minmax\(0, 38fr\) minmax\(0, 62fr\)[^}]*}/,
    )
    expect(normalizedCss).not.toContain(
      'grid-template-rows: minmax(0, 62fr) minmax(0, 38fr);\n}\n\n.combat-zone',
    )
  })

  it('uses compact desktop support zones to give equal combat zones the room needed to fill the table', () => {
    expect(normalizedCss).toMatch(
      /\.top-field \.field-stack\s*\{[^}]*grid-template-rows:\s*minmax\(0, 30fr\) minmax\(0, 70fr\)[^}]*}/,
    )
    expect(normalizedCss).toMatch(
      /\.bottom-field \.field-stack\s*\{[^}]*grid-template-rows:\s*minmax\(0, 70fr\) minmax\(0, 30fr\)[^}]*}/,
    )
  })

  it('visually joins the opponent and player combat zones into one shared battlefield on desktop', () => {
    expect(normalizedCss).toMatch(
      /\.top-field \.combat-zone\s*\{[^}]*border-radius:\s*16px 16px 0 0[^}]*border-bottom-width:\s*1px[^}]*}/,
    )
    expect(normalizedCss).toMatch(
      /\.bottom-field \.combat-zone\s*\{[^}]*border-top-width:\s*0[^}]*border-radius:\s*0 0 16px 16px[^}]*}/,
    )
  })

  it('moves the opponent field and player field stack up by 30px without changing the player HUD fixed containing block', () => {
    expect(normalizedCss).toMatch(
      /\.top-field \.support-zone,\s*\.top-field \.combat-zone\s*\{[^}]*transform:\s*translateY\(-30px\)[^}]*}/,
    )
    expect(normalizedCss).toMatch(
      /\.bottom-field \.field-stack\s*\{[^}]*gap:\s*0[^}]*top:\s*-30px[^}]*}/,
    )
  })

  it('uses the same 100px-tall cards in both combat and support zones', () => {
    const fixedBoardCardRule = normalizedCss.match(
      /\/\* Board cards share one physical size[\s\S]*?\.combat-card-wrap,\s*\.combat-card-wrap > \.card-face,\s*\.card-face\.support-card\s*\{[\s\S]*?\n}/,
    )?.[0]

    expect(fixedBoardCardRule).toContain('width: 70px')
    expect(fixedBoardCardRule).toContain('height: 100px')
    expect(fixedBoardCardRule).toContain('aspect-ratio: 0.7')
    expect(normalizedCss).toContain(
      '.top-field .card-face.support-card {\n  transform: none;\n  bottom: 6px;',
    )
    expect(normalizedCss).not.toContain('padding-bottom: 32px')
    expect(normalizedCss).not.toContain('padding-bottom: 38px')
  })

  it('scales combat cards to the available combat-zone height', () => {
    expect(normalizedCss).toContain('container-name: combat-zone')
    expect(normalizedCss).toContain('container-type: size')
    expect(normalizedCss).toContain('@container combat-zone (max-height: 220px)')
    expect(normalizedCss).toContain('@container combat-zone (max-height: 160px)')
    expect(normalizedCss).toContain('@container combat-zone (max-height: 140px)')
    expect(normalizedCss).toContain('.combat-card-wrap,\n  .combat-card-wrap > .card-face')
    expect(normalizedCss).toContain('width: 100px')
    expect(normalizedCss.lastIndexOf('/* Board cards share one physical size')).toBeGreaterThan(
      normalizedCss.lastIndexOf('@container combat-zone (max-height: 140px)'),
    )
  })
})
