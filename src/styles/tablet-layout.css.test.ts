import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const css = readFileSync(new URL('./tablet-layout.css', import.meta.url), 'utf8')
  .replace(/\r\n/g, '\n')
const appCss = readFileSync(new URL('../App.css', import.meta.url), 'utf8')
  .replace(/\r\n/g, '\n')

describe('tablet battlefield layout', () => {
  it('reserves a real lower dock for the player hand at 1164×777', () => {
    expect(appCss).toContain('--tablet-hand-dock-height: clamp(126px, 19vh, 148px)')
    expect(css).toContain(
      'height: calc(100% - 54px - var(--tablet-hand-dock-height) - 26px)',
    )
    expect(css).toContain('margin: 54px 0 0')
    expect(css).toContain('height: auto')
    expect(css).toMatch(
      /\.hand-fan\.bottom-hand \.hand-card-wrap\s*\{\s*bottom:\s*0;/,
    )
    expect(css).toMatch(
      /\.hand-fan\.bottom-hand\s*\{\s*position:\s*fixed;/,
    )
  })

  it('keeps tablet resource docks in one compact vertical column', () => {
    expect(css).toContain('width: 68px')
    expect(css).toContain('grid-template-columns: minmax(0, 1fr)')
    expect(css).toContain('grid-template-rows: repeat(3, minmax(0, 1fr))')
    expect(css).toContain('grid-column: 1')
  })

  it('prevents support labels and selected hand cards from crossing into the board', () => {
    expect(css).toContain('top: 6px')
    expect(css).toContain('font-size: 0.72rem')
    expect(css).toContain('translateY(calc(var(--fan-y) - 18px))')
    expect(css).toContain('translateY(calc(var(--fan-y) - 14px))')
  })

  it('moves small-tablet hands out of both support areas', () => {
    expect(css).toContain(
      '@container game-shell (min-width: 681px) and (max-width: 900px) and (min-height: 401px)',
    )
    expect(css).toContain('height: 108px')
    expect(css).toContain('display: none')
  })
})
