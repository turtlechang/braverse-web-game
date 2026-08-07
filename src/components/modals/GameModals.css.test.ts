import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const normalizedCss = readFileSync(
  new URL('./GameModals.css', import.meta.url),
  'utf8',
).replace(/\r\n/g, '\n')

describe('modal card option layout', () => {
  it('keeps the first card reachable when the horizontal list overflows', () => {
    const optionRule = normalizedCss.match(
      /^\.modal-card-options\s*\{[\s\S]*?\n}/m,
    )?.[0]

    expect(optionRule).toContain('justify-content: flex-start')
    expect(optionRule).toContain('padding-inline: 4px')
    expect(optionRule).toContain('scroll-padding-inline: 4px')
    expect(optionRule).not.toContain('justify-content: center')
  })
})
