import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { CardEffectText, CardFace } from './CardVisuals'
import type { GameCard } from '../../game'

describe('CardFace hidden information', () => {
  const card: GameCard = {
    id: 'secret-card',
    instanceId: 'secret-instance',
    name: 'Hidden HP Identity',
    type: 'item',
    imageUrl: 'https://example.invalid/secret-card.png',
  }

  it('conceals interactive HP names from tooltips and accessibility metadata', () => {
    const markup = renderToStaticMarkup(
      <CardFace card={card} concealed ariaLabel={card.name} onClick={() => undefined} />,
    )

    expect(markup).toContain('title="未公開卡牌"')
    expect(markup).toContain('aria-label="未公開卡牌"')
    expect(markup).toContain('Braverse 卡牌背面')
    expect(markup).not.toContain(card.name)
    expect(markup).not.toContain(card.id)
    expect(markup).not.toContain(card.imageUrl)
  })

  it('preserves public card identity and action labels after reveal', () => {
    const markup = renderToStaticMarkup(
      <CardFace card={card} ariaLabel="選擇已揭示卡牌" onClick={() => undefined} />,
    )

    expect(markup).toContain(`title="${card.name}"`)
    expect(markup).toContain('aria-label="選擇已揭示卡牌"')
    expect(markup).toContain(card.imageUrl)
  })
})

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
