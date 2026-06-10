import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { CookieCard } from '../../game'
import { CardDetailModal } from './GameModals'

describe('CardDetailModal', () => {
  it('shows skill text before the attack text', () => {
    const card: CookieCard = {
      id: 'ST1-008',
      instanceId: 'test-ST1-008',
      name: 'Cherry Blossom Cookie',
      type: 'cookie',
      level: 3,
      hp: 1,
      attack: 1,
      attackCost: 1,
      attackEnergyCost: { red: 1 },
      attackText: '《{R}》 Deals 1 damage.',
      effectText:
        '{mob} {t1} 《{R}{R}》 Rest this card. Select up to 2 Cookies.',
    }

    const markup = renderToStaticMarkup(
      <CardDetailModal card={card} onClose={() => undefined} />,
    )

    expect(markup.indexOf('<strong>技能</strong>')).toBeLessThan(
      markup.indexOf('<strong>攻擊</strong>'),
    )
    expect(markup).toContain('Once per turn 一回合一次')
    expect(markup).toContain('Deals 1 damage.')
  })

  it('centers a trap description when there is no skill section', () => {
    const markup = renderToStaticMarkup(
      <CardDetailModal
        card={{
          id: 'ST1-021',
          instanceId: 'test-ST1-021',
          name: 'Trap Card',
          type: 'trap',
          officialType: 'trap',
          effectText: '《{R}》 The attacking Cookie deals -1 damage.',
        }}
        onClose={() => undefined}
      />,
    )

    expect(markup).toContain('card-detail-rules single-rule')
    expect(markup).toContain('<strong>陷阱效果</strong>')
    expect(markup.match(/card-rule-section/g)).toHaveLength(1)
  })
})
