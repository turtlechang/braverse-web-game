import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { CardEffectText } from './CardVisuals'

describe('CardEffectText', () => {
  it('renders the once-per-turn marker instead of its raw token', () => {
    const markup = renderToStaticMarkup(
      <CardEffectText text="{mob} {t1} Skill text" />,
    )

    expect(markup).toContain('Activate 啟動')
    expect(markup).toContain('Once per turn 一回合一次')
    expect(markup).not.toContain('{t1}')
  })
})
