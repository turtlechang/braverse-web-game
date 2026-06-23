import { describe, expect, it } from 'vitest'
import css from './BattleRow.css?raw'

describe('player hand layout styles', () => {
  it('anchors the bottom hand above the support zone', () => {
    expect(css).toContain('.bottom-field .bottom-hand,')
    expect(css).toContain('bottom: 45%;')
  })
})

describe('player hand hover styles', () => {
  it('keeps the fan transform while lifting 8px and scaling slightly', () => {
    const hoverRule = css.match(
      /\.bottom-hand \.hand-card-wrap:hover,[\s\S]*?\n}/,
    )?.[0]

    expect(hoverRule).toContain(
      'translateX(calc(-50% + var(--fan-x))) translateY(calc(var(--fan-y) - 8px)) rotate(var(--fan-rotation)) scale(1.02)',
    )
    expect(css).toContain(
      'translateX(calc(-50% + var(--fan-x))) translateY(-28px) rotate(0deg) scale(1.07)',
    )
  })
})
