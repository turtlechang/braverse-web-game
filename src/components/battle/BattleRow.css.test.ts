import { describe, expect, it } from 'vitest'
import css from './BattleRow.css?raw'

describe('player hand layout styles', () => {
  it('anchors the bottom hand above the support zone', () => {
    expect(css).toContain('.bottom-field .bottom-hand,')
    expect(css).toContain('bottom: 45%;')
  })
})

describe('player hand hover styles', () => {
  it('straightens the fan rotation and lifts 20px on hover', () => {
    const hoverRule = css.match(
      /\.bottom-hand \.hand-card-wrap:hover,[\s\S]*?\n}/,
    )?.[0]

    expect(hoverRule).toContain(
      'translateX(calc(-50% + var(--fan-x))) translateY(-20px) rotate(0deg) scale(1.05)',
    )
    expect(css).toContain(
      'translateX(calc(-50% + var(--fan-x))) translateY(-28px) rotate(0deg) scale(1.07)',
    )
  })
})
