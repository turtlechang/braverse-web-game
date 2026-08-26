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

  it('preserves official paragraph breaks between skill segments', () => {
    const markup = renderToStaticMarkup(
      <CardEffectText
        text={
          'If the condition is met, this Cookie gains +1 attack damage.\r\n【Activate】 【Once Per Turn】 <{N}> If there are 7 【Arena】 cards or more in your trash, select up to 1 opponent Cookie.'
        }
      />,
    )

    expect(markup).toContain('gains +1 attack damage.<br/>')
    expect(markup).toContain('Activate 啟動')
    expect(markup).toContain('Once per turn 一回合一次')
  })
})
