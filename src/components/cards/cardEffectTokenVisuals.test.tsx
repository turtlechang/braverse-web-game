import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { CardEffectText } from './CardVisuals'

const imageTokens = [
  ['{mou}', 'Equip', '/card-tags/equip.webp'],
  ['{ap}', 'On play', '/card-tags/on-play.webp'],
  ['{mt}', 'Your Turn', '/card-tags/your-turn.webp'],
  ['{t1}', 'Once Per Turn', '/card-tags/once-per-turn.webp'],
  ['{mob}', 'Activate', '/card-tags/activate.webp'],
  ['{bl}', 'Blocker', '/card-tags/blocker.webp'],
  ['{da}', 'Damage', '/card-tags/damage.webp'],
  ['{sk}', 'Skill', '/card-tags/skill.webp'],
] as const

describe('CardEffectText image tags', () => {
  it.each(imageTokens)(
    'renders %s with its corresponding image tag',
    (token, alt, imageUrl) => {
      const markup = renderToStaticMarkup(<CardEffectText text={token} />)

      expect(markup).toContain(`src="${imageUrl}"`)
      expect(markup).toContain(`alt="${alt}"`)
      expect(markup).not.toContain(token)
    },
  )

  it('renders official full-width timing tags with the same images', () => {
    const markup = renderToStaticMarkup(
      <CardEffectText
        text="【Equip】 【On Play】 【Your Turn】 【Once Per Turn】 【Activate】 【Blocker】"
      />,
    )

    expect(markup).toContain('src="/card-tags/equip.webp"')
    expect(markup).toContain('src="/card-tags/on-play.webp"')
    expect(markup).toContain('src="/card-tags/your-turn.webp"')
    expect(markup).toContain('src="/card-tags/once-per-turn.webp"')
    expect(markup).toContain('src="/card-tags/activate.webp"')
    expect(markup).toContain('src="/card-tags/blocker.webp"')
    expect(markup).not.toContain('【On Play】')
  })
})
