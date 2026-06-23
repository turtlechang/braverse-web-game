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

  const energyCases = [
    { token: 'R', file: '/energy/{R}.webp', label: '紅' },
    { token: 'Y', file: '/energy/{Y}.webp', label: '黃' },
    { token: 'G', file: '/energy/{G}.webp', label: '綠' },
    { token: 'B', file: '/energy/{B}.webp', label: '藍' },
    { token: 'P', file: '/energy/{P}.webp', label: '紫' },
    { token: 'N', file: '/energy/{N}.webp', label: '任意' },
  ] as const

  for (const { token, file, label } of energyCases) {
    it(`renders {${token}} as energy icon (${label}色能量)`, () => {
      const markup = renderToStaticMarkup(
        <CardEffectText text={`Deals {${token}} damage`} />,
      )

      expect(markup).toContain(`src="${file}"`)
      expect(markup).toContain(`alt="${label}色能量"`)
      expect(markup).toContain(`title="${label}色能量"`)
      expect(markup).not.toContain(`Deals {${token}} damage`)
    })
  }

  it('renders multiple energy icons in cost syntax', () => {
    const markup = renderToStaticMarkup(
      <CardEffectText text="《{R}{R}》 Deal 2 damage." />,
    )

    const redIconCount = (
      markup.match(/<img[^>]+src="\/energy\/\{R\}\.webp"/g) ?? []
    ).length
    expect(redIconCount).toBe(2)
    expect(markup).toContain('Deal 2 damage.')
  })
})
