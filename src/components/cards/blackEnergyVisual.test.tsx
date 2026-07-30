import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { CardEffectText } from './CardVisuals'

describe('black energy visual', () => {
  it('renders the K energy token with the black energy image', () => {
    const markup = renderToStaticMarkup(<CardEffectText text="{K}" />)

    expect(markup).toContain('src="/energy/{K}.webp"')
    expect(markup).toContain('class="energy-icon"')
  })
})
