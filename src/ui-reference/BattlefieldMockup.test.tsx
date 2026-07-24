/** @vitest-environment jsdom */

import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { BattlefieldMockup } from './BattlefieldMockup'

describe('BattlefieldMockup', () => {
  it('reuses the production battle table with two occupied battle slots per side', () => {
    const markup = renderToStaticMarkup(<BattlefieldMockup />)

    expect(markup).toContain('game-shell mock-bf-root')
    expect(markup).toContain('table-area')
    expect(markup).toContain('battle-row top-field')
    expect(markup).toContain('battle-row bottom-field')
    expect(markup.match(/battle-count-2/g)).toHaveLength(2)
    expect(markup).toContain('phase-rail')
  })
})
