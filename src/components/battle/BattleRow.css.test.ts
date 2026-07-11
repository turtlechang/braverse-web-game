import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const normalizedCss = readFileSync(
  new URL('./BattleRow.css', import.meta.url),
  'utf8',
).replace(/\r\n/g, '\n')

describe('player hand hover styles', () => {
  it('keeps the fan transform while lifting 8px and scaling slightly', () => {
    const hoverRule = normalizedCss.match(
      /\.bottom-hand \.hand-card-wrap:hover,[\s\S]*?\n}/,
    )?.[0]

    expect(hoverRule).toContain(
      'translateX(calc(-50% + var(--fan-x))) translateY(calc(var(--fan-y) - 8px)) rotate(var(--fan-rotation)) scale(1.02)',
    )
    expect(normalizedCss).toContain(
      'translateX(calc(-50% + var(--fan-x))) translateY(-28px) rotate(0deg) scale(1.07)',
    )
  })
})
