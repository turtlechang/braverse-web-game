import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { CookieCard, GameCard } from '../../game'
import {
  CardDetailModal,
  DecisionModal,
  FlipResponseModal,
  ResultModal,
} from './GameModals'

const createHandCard = (index: number): GameCard => ({
  id: `TEST-${index}`,
  instanceId: `test-hand-${index}`,
  name: `測試手牌 ${index}`,
  type: 'item',
})

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

describe('DecisionModal', () => {
  it('allows the player to decline a Cookie replacement', () => {
    const markup = renderToStaticMarkup(
      <DecisionModal
        isRefresh={false}
        playerName="玩家"
        replacementCount={1}
        options={[]}
        isOptionDisabled={() => false}
        onSelect={() => undefined}
        onSkipReplacement={() => undefined}
      />,
    )

    expect(markup).toContain('是否要在戰鬥區放置新餅乾？')
    expect(markup).toContain('尚可補 1 張')
    expect(markup).toContain('不補餅乾')
    expect(markup).not.toContain('必須在戰鬥區放置新餅乾')
  })

  it('does not show a skip button during Refresh', () => {
    const markup = renderToStaticMarkup(
      <DecisionModal
        isRefresh
        playerName="玩家"
        options={[]}
        isOptionDisabled={() => false}
        onSelect={() => undefined}
      />,
    )

    expect(markup).toContain('必須選擇一張餅乾放入休息區')
    expect(markup).not.toContain('不補餅乾')
  })
})

describe('FlipResponseModal', () => {
  it('shows the first three hand cards without rendering the remaining page', () => {
    const card: CookieCard = {
      id: 'ST1-001',
      instanceId: 'test-flip',
      name: 'Brave Cookie',
      type: 'cookie',
      officialType: 'flip',
      level: 2,
      hp: 2,
      attack: 2,
      attackCost: 2,
      flip: {
        text:
          '《Discard 1 card.》 The Cookie with this card attached for HP gains +1 HP.',
        cost: { energy: {}, discardHand: 1 },
        effects: [{ kind: 'gain-hp', amount: 1 }],
      },
    }
    const markup = renderToStaticMarkup(
      <FlipResponseModal
        card={card}
        hand={Array.from({ length: 6 }, (_, index) =>
          createHandCard(index + 1),
        )}
        discardCount={1}
        selectedDiscardIds={[]}
        onToggleDiscard={() => undefined}
        onActivate={() => undefined}
        onSkip={() => undefined}
      />,
    )

    expect(markup).toContain('測試手牌 1')
    expect(markup).toContain('測試手牌 3')
    expect(markup).not.toContain('測試手牌 4')
    expect(markup).toContain('aria-label="上一頁手牌"')
    expect(markup).toContain('aria-label="下一頁手牌"')
    expect(markup).toContain('1 / 2')
  })
})

describe('ResultModal', () => {
  it('shows our break area when the viewer loses', () => {
    const markup = renderToStaticMarkup(
      <ResultModal
        winnerName="AI 對手"
        loserId="player-one"
        viewerPlayerId="player-one"
        reason="break-level-limit"
        onRestart={() => undefined}
      />,
    )

    expect(markup).toContain('我方休息區的等級達到 10。')
  })

  it('shows the opponent break area when the viewer wins', () => {
    const markup = renderToStaticMarkup(
      <ResultModal
        winnerName="玩家"
        loserId="player-two"
        viewerPlayerId="player-one"
        reason="break-level-limit"
        onRestart={() => undefined}
      />,
    )

    expect(markup).toContain('對方休息區的等級達到 10。')
  })
})
