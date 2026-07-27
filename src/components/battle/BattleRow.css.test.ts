import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const normalizedCss = readFileSync(
  new URL('./BattleRow.css', import.meta.url),
  'utf8',
).replace(/\r\n/g, '\n')

describe('player hand hover styles', () => {
  it('keeps every opponent hand card horizontally aligned without individual rotation', () => {
    expect(normalizedCss).toContain(
      'translateX(calc(-50% + var(--opponent-x))) translateY(var(--opponent-y, 0px))',
    )
    expect(normalizedCss).not.toContain('rotate(var(--opponent-angle))')
  })

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

  it('uses the same red border for every opponent board and resource zone', () => {
    expect(normalizedCss).toMatch(
      /\.top-field \.combat-zone,\s*\.top-field \.support-zone,\s*\.top-field \.break-zone > \.resource-summary,\s*\.top-field \.deck-zone > \.resource-summary,\s*\.top-field \.stage-zone > \.resource-summary,\s*\.top-field \.discard-zone\.resource-summary\s*\{[^}]*border-color:\s*rgba\(220, 38, 38, 0\.76\)[^}]*}/,
    )
  })

  it('uses the same blue border for every player board and resource zone', () => {
    expect(normalizedCss).toMatch(
      /\.bottom-field \.combat-zone,\s*\.bottom-field \.support-zone,\s*\.bottom-field \.break-zone > \.resource-summary,\s*\.bottom-field \.deck-zone > \.resource-summary,\s*\.bottom-field \.stage-zone > \.resource-summary,\s*\.bottom-field \.discard-zone\.resource-summary\s*\{[^}]*border-color:\s*#2179d1[^}]*}/,
    )
  })

  it('uses a blue active border for the player metadata', () => {
    expect(normalizedCss).toMatch(
      /\.bottom-field \.row-meta\[data-active='true'\]\s*\{[^}]*border-left-color:\s*#2179d1[^}]*}/,
    )
  })

  it('matches both utility columns to their visible battle and support stacks on desktop', () => {
    expect(normalizedCss).toMatch(
      /:root\[data-theme="tactical-clean"\] \.utility-zones\s*\{[^}]*position:\s*relative[^}]*top:\s*-30px[^}]*grid-template-columns:\s*minmax\(0, 1fr\)[^}]*width:\s*96px[^}]*}/,
    )
    expect(normalizedCss).toMatch(
      /:root\[data-theme="tactical-clean"\] \.top-field \.utility-zones\s*\{[^}]*height:\s*calc\(100% - var\(--field-stack-reserve\)\)[^}]*align-self:\s*end[^}]*}/,
    )
    expect(normalizedCss).toMatch(
      /:root\[data-theme="tactical-clean"\] \.bottom-field \.utility-zones\s*\{[^}]*height:\s*calc\(100% - var\(--field-stack-reserve\)\)[^}]*align-self:\s*start[^}]*}/,
    )
  })

  it('matches the opponent break dock height to the opponent combat zone', () => {
    expect(normalizedCss).toMatch(
      /\.top-field \.break-zone\s*\{[^}]*height:\s*calc\(70% - 73\.4px\)[^}]*top:\s*-30px[^}]*}/,
    )
  })

  it('matches the player break dock height and position to the player combat zone', () => {
    expect(normalizedCss).toMatch(
      /\.bottom-field \.break-zone\s*\{[^}]*height:\s*calc\(70% - 73\.4px\)[^}]*top:\s*-30px[^}]*}/,
    )
  })

  it('uses the approved vertical utility order and makes every cell fill its row', () => {
    expect(normalizedCss).toMatch(
      /:root\[data-theme="tactical-clean"\] \.utility-zones > \.resource-dock,\s*:root\[data-theme="tactical-clean"\] \.utility-zones > \.discard-zone\s*\{[^}]*grid-column:\s*1[^}]*justify-self:\s*stretch[^}]*align-self:\s*stretch[^}]*}/,
    )
    expect(normalizedCss).toMatch(
      /:root\[data-theme="tactical-clean"\] \.top-field \.discard-zone\s*\{[^}]*grid-row:\s*1[^}]*}/,
    )
    expect(normalizedCss).toMatch(
      /:root\[data-theme="tactical-clean"\] \.top-field \.deck-zone\s*\{[^}]*grid-row:\s*2[^}]*}/,
    )
    expect(normalizedCss).toMatch(
      /:root\[data-theme="tactical-clean"\] \.top-field \.stage-zone\s*\{[^}]*grid-row:\s*3[^}]*}/,
    )
    expect(normalizedCss).toMatch(
      /:root\[data-theme="tactical-clean"\] \.bottom-field \.stage-zone\s*\{[^}]*grid-row:\s*1[^}]*}/,
    )
    expect(normalizedCss).toMatch(
      /:root\[data-theme="tactical-clean"\] \.bottom-field \.deck-zone\s*\{[^}]*grid-row:\s*2[^}]*}/,
    )
    expect(normalizedCss).toMatch(
      /:root\[data-theme="tactical-clean"\] \.bottom-field \.discard-zone\s*\{[^}]*grid-row:\s*3[^}]*}/,
    )
  })

  it('places the player support count just outside the support zone lower-left edge', () => {
    expect(normalizedCss).toMatch(
      /\.bottom-field \.support-count\s*\{[^}]*top:\s*auto[^}]*bottom:\s*-25px[^}]*left:\s*0[^}]*}/,
    )
  })

  it('places the opponent support count just outside the support zone upper-right edge', () => {
    expect(normalizedCss).toMatch(
      /\.top-field \.support-count\s*\{[^}]*top:\s*-25px[^}]*right:\s*0[^}]*bottom:\s*auto[^}]*left:\s*auto[^}]*}/,
    )
  })

  it('uses restrained side tints and a larger no-glow support count', () => {
    expect(normalizedCss).toMatch(
      /:root\[data-theme="tactical-clean"\] \.support-count\s*\{[^}]*font-size:\s*1\.08rem[^}]*font-weight:\s*800[^}]*text-shadow:\s*none[^}]*}/,
    )
    expect(normalizedCss).toMatch(
      /:root\[data-theme="tactical-clean"\] \.top-field \.support-count\s*\{[^}]*color:\s*#f0dadf[^}]*}/,
    )
    expect(normalizedCss).toMatch(
      /:root\[data-theme="tactical-clean"\] \.bottom-field \.support-count\s*\{[^}]*color:\s*#d2e5f1[^}]*}/,
    )
  })

  it('keeps only the enlarged level inside each break dock', () => {
    expect(normalizedCss).toMatch(
      /:root\[data-theme="tactical-clean"\] \.break-zone \.zone-heading > :not\(strong\)\s*\{[^}]*display:\s*none[^}]*}/,
    )
    expect(normalizedCss).toMatch(
      /:root\[data-theme="tactical-clean"\] \.break-zone \.zone-heading strong\s*\{[^}]*font-size:\s*1\.08rem[^}]*font-weight:\s*900[^}]*}/,
    )
    expect(normalizedCss).toMatch(
      /:root\[data-theme="tactical-clean"\] \.top-field \.break-zone \.zone-heading\s*\{[^}]*top:\s*auto[^}]*bottom:\s*8px[^}]*}/,
    )
    expect(normalizedCss).toMatch(
      /:root\[data-theme="tactical-clean"\] \.bottom-field \.break-zone \.zone-heading\s*\{[^}]*top:\s*8px[^}]*bottom:\s*auto[^}]*}/,
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

  it('matches combat and support zone heights with a shared desktop field-stack reserve', () => {
    expect(normalizedCss).toMatch(
      /\.top-field \.field-stack\s*\{[^}]*grid-template-rows:\s*minmax\(0, calc\(30% \+ 13px\)\) minmax\(0, calc\(70% - 23px\)\)[^}]*}/,
    )
    expect(normalizedCss).toMatch(
      /\.bottom-field \.field-stack\s*\{[^}]*grid-template-rows:\s*minmax\(0, calc\(70% - 23px\)\) minmax\(0, calc\(30% \+ 13px\)\)[^}]*}/,
    )
    expect(normalizedCss).toMatch(
      /\.top-field \.field-stack\s*\{[^}]*height:\s*calc\(100% - var\(--field-stack-reserve\)\)[^}]*}/,
    )
    expect(normalizedCss).toMatch(
      /\.bottom-field \.field-stack\s*\{[^}]*height:\s*calc\(100% - var\(--field-stack-reserve\)\)[^}]*}/,
    )
  })

  it('gives both combat zones complete rounded opponent and player frames on desktop', () => {
    expect(normalizedCss).toMatch(
      /:root\[data-theme="tactical-clean"\] \.top-field \.combat-zone\s*\{[^}]*border:\s*2px solid rgba\(255, 105, 120, 0\.72\)[^}]*border-radius:\s*18px[^}]*}/,
    )
    expect(normalizedCss).toMatch(
      /:root\[data-theme="tactical-clean"\] \.bottom-field \.combat-zone\s*\{[^}]*border:\s*2px solid rgba\(74, 213, 255, 0\.78\)[^}]*border-radius:\s*18px[^}]*}/,
    )
  })

  it('moves the opponent field and player field stack up by 30px without changing the player HUD fixed containing block', () => {
    expect(normalizedCss).toMatch(
      /\.top-field \.support-zone,\s*\.top-field \.combat-zone\s*\{[^}]*transform:\s*translateY\(-30px\)[^}]*}/,
    )
    expect(normalizedCss).toMatch(
      /\.bottom-field \.field-stack\s*\{[^}]*gap:\s*10px[^}]*top:\s*-30px[^}]*}/,
    )
  })

  it('keeps support cards smaller than combat cards at a target board height', () => {
    const supportCardRule = normalizedCss.match(
      /Support cards stay smaller[\s\S]*?\.card-face\.support-card\s*\{[\s\S]*?\n}/,
    )?.[0]

    expect(supportCardRule).toContain(
      '--support-card-height: clamp(88px, 11.1vh, 100px)',
    )
    expect(supportCardRule).toContain('height: var(--support-card-height)')
    expect(supportCardRule).toContain(
      'width: calc(var(--support-card-height) * 0.7)',
    )
    expect(supportCardRule).toContain('aspect-ratio: 0.7')
    expect(normalizedCss).not.toContain('padding-bottom: 32px')
    expect(normalizedCss).not.toContain('padding-bottom: 38px')
  })

  it('vertically centers support cards instead of anchoring to a fixed bottom offset', () => {
    const baseRule = normalizedCss.match(
      /支援卡以垂直置中錨定[\s\S]*?\.card-face\.support-card\s*\{[\s\S]*?\n}/,
    )?.[0]
    expect(baseRule).toContain('top: 50%')
    expect(baseRule).toContain('transform: translateY(-50%)')
    expect(baseRule).not.toContain('bottom:')

    const restedRule = normalizedCss.match(
      /\.card-face\.support-card\.is-rested\s*\{[\s\S]*?\n}/,
    )?.[0]
    expect(restedRule).toContain('transform: translateY(-50%) rotate(90deg)')
    expect(restedRule).not.toContain('bottom:')

    expect(normalizedCss).toMatch(
      /\.top-field \.card-face\.support-card\.is-rested\s*\{[^}]*transform:\s*translateY\(-50%\) rotate\(-90deg\)[^}]*}/,
    )
  })

  it('keeps rested battle-zone cookies the same size as upright ones', () => {
    expect(normalizedCss).toMatch(
      /\.combat-card-wrap > \.card-face\.is-rested\s*\{\s*transform:\s*rotate\(90deg\);\s*\}/,
    )
  })

  it('gives hand cards a target board height that beats the old per-breakpoint tiers', () => {
    const handCardRule = normalizedCss.match(
      /\.hand-fan \.hand-card\s*\{[\s\S]*?\n}/,
    )?.[0]

    expect(handCardRule).toContain(
      '--hand-card-height: clamp(168px, 20.4vh, 180px)',
    )
    expect(handCardRule).toContain('height: var(--hand-card-height)')
    expect(handCardRule).toContain(
      'width: calc(var(--hand-card-height) * 0.7)',
    )
  })

  it('keeps the compact-layout combat card zone-fit formula unscoped (untouched below 901px)', () => {
    expect(normalizedCss).toContain('container-name: combat-zone')
    expect(normalizedCss).toContain('container-type: size')
    expect(normalizedCss).toContain('@container combat-zone (max-height: 220px)')
    expect(normalizedCss).toContain('@container combat-zone (max-height: 160px)')
    expect(normalizedCss).toContain('@container combat-zone (max-height: 140px)')
    const baseFluidRule = normalizedCss.match(
      /@container combat-zone \(min-height: 0px\)\s*\{\s*\.combat-card-wrap\s*\{[\s\S]*?\n {2}\}/,
    )?.[0]
    expect(baseFluidRule).toContain(
      '--combat-card-height: max(0px, calc(100cqh - 18px));',
    )
    expect(baseFluidRule).toContain(
      'width: calc(var(--combat-card-height) * 0.7)',
    )
    expect(baseFluidRule).toContain('height: var(--combat-card-height)')
    expect(baseFluidRule).toContain('max-height: var(--combat-card-height)')
    expect(normalizedCss).toMatch(
      /\.combat-card-wrap > \.card-face\s*\{[^}]*width:\s*100%[^}]*height:\s*100%[^}]*max-height:\s*100%[^}]*}/,
    )
    expect(normalizedCss).toMatch(/\.combat-card-wrap \.hp-card-stack\s*\{[^}]*max-width:\s*100%[^}]*}/)
  })

  it('layers a target-height clamp on top of the compact formula for the desktop tier only', () => {
    const desktopFluidRule = normalizedCss.match(
      /is layered on top[\s\S]*?@container combat-zone \(min-height: 0px\)\s*\{\s*\.combat-card-wrap\s*\{[\s\S]*?\n {4}\}/,
    )?.[0]
    expect(desktopFluidRule).toContain(
      '--combat-card-height: min(\n        clamp(148px, 17.8vh, 158px),\n        max(0px, calc(100cqh - 18px))\n      );',
    )
    expect(desktopFluidRule).toContain(
      'width: calc(var(--combat-card-height) * 0.7)',
    )
    expect(desktopFluidRule).toContain('height: var(--combat-card-height)')
    expect(desktopFluidRule).toContain(
      'max-height: var(--combat-card-height)',
    )
  })

  it('pins the HP badge to the card upper-right and enlarges both combat stat badges by 32%', () => {
    expect(normalizedCss).toMatch(
      /\.combat-card-wrap \.card-badges\s*\{[^}]*inset:\s*0[^}]*display:\s*block[^}]*padding:\s*0[^}]*}/,
    )
    expect(normalizedCss).toMatch(
      /\.combat-card-wrap \.badge-hp\s*\{[^}]*position:\s*absolute[^}]*top:\s*3px[^}]*right:\s*3px[^}]*transform:\s*scale\(1\.32\)[^}]*transform-origin:\s*top right[^}]*}/,
    )
    expect(normalizedCss).toMatch(
      /\.combat-card-wrap \.badge-atk\s*\{[^}]*position:\s*absolute[^}]*right:\s*3px[^}]*bottom:\s*40px[^}]*transform:\s*scale\(1\.32\)[^}]*transform-origin:\s*bottom right[^}]*}/,
    )
  })

  it('aligns the energy shortfall hint through the shared combat action stack', () => {
    expect(normalizedCss).toMatch(
      /\.combat-action-stack\s+\.energy-shortfall-hint\s*\{[^}]*position:\s*static[^}]*transform:\s*none[^}]*}/,
    )
  })

  it('keeps the energy hint and skill action in one non-overlapping action stack', () => {
    expect(normalizedCss).toMatch(
      /\.combat-action-stack\s*\{[^}]*position:\s*absolute[^}]*top:\s*calc\(100% \+ var\(--hp-dock-height\) \+ 4px\)[^}]*display:\s*flex[^}]*flex-direction:\s*column[^}]*}/,
    )
    expect(normalizedCss).toMatch(
      /\.combat-action-stack\s+\.energy-shortfall-hint\s*\{[^}]*position:\s*static[^}]*transform:\s*none[^}]*}/,
    )
    expect(normalizedCss).toMatch(
      /\.combat-action-stack\s+\.skill-action\s*\{[^}]*position:\s*static[^}]*transform:\s*none[^}]*}/,
    )
  })

  it('moves both action prompts to the outer side of their battle card slot', () => {
    expect(normalizedCss).toMatch(
      /\.combat-card-wrap\.is-left-slot \.combat-action-stack\s*\{[^}]*top:\s*50%[^}]*right:\s*calc\(100% \+ 8px\)[^}]*left:\s*auto[^}]*transform:\s*translateY\(-50%\)[^}]*}/,
    )
    expect(normalizedCss).toMatch(
      /\.combat-card-wrap\.is-right-slot \.combat-action-stack\s*\{[^}]*top:\s*50%[^}]*right:\s*auto[^}]*left:\s*calc\(100% \+ 8px\)[^}]*transform:\s*translateY\(-50%\)[^}]*}/,
    )
  })

  it('places the HP card dock below the combat card instead of using the action area', () => {
    expect(normalizedCss).toMatch(
      /\.hp-card-stack\s*\{[^}]*top:\s*calc\(100% - var\(--hp-dock-overlap\)\)[^}]*bottom:\s*auto[^}]*}/,
    )
    expect(normalizedCss).toMatch(
      /\.hp-card-stack\s+\.hp-card\s*\{[^}]*bottom:\s*0[^}]*}/,
    )
  })

  it('reserves lower-edge space for the opponent HP dock and widens two-cookie spacing', () => {
    expect(normalizedCss).toMatch(
      /\.top-field \.combat-card-wrap\s*\{[^}]*margin-bottom:\s*clamp\(2px, 0\.35vh, 3px\)[^}]*}/,
    )
    expect(normalizedCss).toMatch(
      /\.combat-slots\s*\{[^}]*--battle-card-gap:\s*clamp\(166px, 14vw, 196px\)[^}]*gap:\s*var\(--battle-card-gap\)[^}]*}/,
    )
  })

  it('keeps the battle-zone label centered while a single cookie uses the left slot', () => {
    expect(normalizedCss).toMatch(
      /\.combat-zone > \.zone-watermark\s*\{[^}]*z-index:\s*2[^}]*}/,
    )
    expect(normalizedCss).toMatch(
      /\.zone-watermark\s*\{[^}]*inset:\s*50% auto auto 50%[^}]*transform:\s*translate\(-50%, -50%\)[^}]*}/,
    )
    expect(normalizedCss).toMatch(
      /\.combat-zone\.battle-count-1 \.combat-slots\s*\{[^}]*justify-content:\s*center[^}]*}/,
    )
    expect(normalizedCss).toMatch(
      /\.combat-card-wrap\.is-single-slot\s*\{[^}]*translate:\s*calc\(-50% - \(var\(--battle-card-gap\) \/ 2\)\) 0[^}]*}/,
    )
  })

  it('enlarges the standard HP dock without changing the compact dock cap', () => {
    expect(normalizedCss).toMatch(
      /\.hp-card-stack \.hp-card\s*\{[^}]*width:\s*50px[^}]*}/,
    )
    expect(normalizedCss).toMatch(
      /\.hp-card-stack \.hp-card\s*\{[^}]*width:\s*50px[^}]*}/,
    )
    expect(normalizedCss).toMatch(
      /@container combat-zone \(max-height: 220px\)\s*\{[\s\S]*?\.hp-card-stack \.hp-card\s*\{[^}]*width:\s*32px[^}]*}/,
    )
  })

  it('draws a persistent target marker around the pending attack target', () => {
    expect(normalizedCss).toMatch(
      /\.combat-card-wrap\.is-attack-target::before\s*\{[^}]*content:\s*'攻擊目標'[^}]*z-index:\s*7[^}]*}/,
    )
    expect(normalizedCss).toMatch(
      /\.combat-card-wrap\.is-attack-target::after\s*\{[^}]*inset:\s*-5px[^}]*border:\s*3px solid #fff17c[^}]*animation:\s*attack-target-pulse 0\.9s ease-in-out infinite[^}]*}/,
    )
  })
})
