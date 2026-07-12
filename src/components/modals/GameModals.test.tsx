/// @vitest-environment jsdom

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { CookieCard, CookieInBattle, GameCard } from '../../game'
import {
  AttackResponseModal,
  CardDetailModal,
  DecisionModal,
  DiscardRevealModal,
  FaintEffectResponseModal,
  FlipResponseModal,
  OpeningSetupModal,
  ResultModal,
  TrapResponseModal,
} from './GameModals'
import { DeckEditorModal } from './DeckEditorModal'

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

const createHandCard = (index: number): GameCard => ({
  id: `TEST-${index}`,
  instanceId: `test-hand-${index}`,
  name: `測試手牌 ${index}`,
  type: 'item',
})

const createBattleCookie = (index: number): CookieInBattle => ({
  card: {
    id: `COOKIE-${index}`,
    instanceId: `test-cookie-${index}`,
    name: `測試餅乾 ${index}`,
    type: 'cookie',
    level: 1,
    hp: 2,
    attack: 1,
    attackCost: 1,
  },
  hpCards: [],
  rested: false,
})

const findButton = (container: HTMLElement, label: string) =>
  [...container.querySelectorAll('button')].find((button) =>
    button.textContent?.includes(label),
  )

const click = async (button: HTMLButtonElement | undefined) => {
  expect(button).toBeDefined()
  await act(() => {
    button!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })
}

describe('DiscardRevealModal', () => {
  it('shows every card discarded by an opponent effect in one window', () => {
    const cards = [createHandCard(1), createHandCard(2)]
    const markup = renderToStaticMarkup(
      <DiscardRevealModal
        cards={cards}
        onConfirm={() => undefined}
      />,
    )

    expect(markup).toContain('對手棄置的卡牌')
    expect(markup).toContain('測試手牌 1')
    expect(markup).toContain('測試手牌 2')
    expect(markup).toContain('確認並繼續')
  })

  it('minimizes to a dock and restores without confirming', async () => {
    const cards = [createHandCard(1), createHandCard(2)]
    const onConfirm = vi.fn()
    const container = document.createElement('div')
    const root = createRoot(container)
    await act(() => root.render(
      <DiscardRevealModal cards={cards} onConfirm={onConfirm} />,
    ))

    await click(findButton(container, '縮小'))
    expect(container.querySelector('.discard-reveal-modal')).toBeNull()
    expect(container.querySelector('.card-reveal-dock')?.textContent).toContain(
      '對手棄置 2 張卡牌',
    )
    expect(onConfirm).not.toHaveBeenCalled()

    await click(
      container.querySelector<HTMLButtonElement>('.card-reveal-dock') ??
        undefined,
    )
    expect(container.querySelector('.discard-reveal-modal')).not.toBeNull()
    expect(onConfirm).not.toHaveBeenCalled()

    await act(() => root.unmount())
  })
})

describe('TrapResponseModal', () => {
  it('selects a trap without opening a separate card detail modal', async () => {
    const trap: GameCard = {
      id: 'ST4-020',
      instanceId: 'st4-020-test',
      name: 'Octo-Ink Spray',
      type: 'trap',
      trap: {
        text: 'Discard 2 cards. Select up to 1 opposing Cookie.',
        cost: { energy: { blue: 1 }, discardHand: 2 },
        effects: [],
      },
    }
    const onSelectTrap = vi.fn()
    const onInspectCard = vi.fn()
    const container = document.createElement('div')
    const root = createRoot(container)
    await act(() => root.render(
      <TrapResponseModal
        cards={[trap]}
        selectedTrapId={null}
        paymentCards={[]}
        targetCards={[]}
        discardHandCards={[]}
        discardHandCost={0}
        selectedDiscardHandIds={[]}
        onSelectTrap={onSelectTrap}
        onToggleDiscardHand={() => undefined}
        onConfirm={() => undefined}
        onSkip={() => undefined}
        onInspectCard={onInspectCard}
      />,
    ))

    await click(findButton(container, 'Octo-Ink Spray'))

    expect(onSelectTrap).toHaveBeenCalledWith(trap.instanceId)
    expect(onInspectCard).not.toHaveBeenCalled()

    await act(() => root.unmount())
  })

  it('shows discard-hand candidates and blocks activation until the cost is selected', () => {
    const trap: GameCard = {
      id: 'ST4-020',
      instanceId: 'st4-020-test',
      name: 'Octo-Ink Spray',
      type: 'trap',
      trap: {
        text: 'Discard 2 cards.',
        cost: { energy: { blue: 1 }, discardHand: 2 },
        effects: [],
      },
    }
    const hand = [createHandCard(1), createHandCard(2), createHandCard(3)]
    const markup = renderToStaticMarkup(
      <TrapResponseModal
        cards={[trap]}
        selectedTrapId={trap.instanceId}
        paymentCards={[]}
        targetCards={[]}
        discardHandCards={hand}
        discardHandCost={2}
        selectedDiscardHandIds={[hand[0].instanceId]}
        onSelectTrap={() => undefined}
        onToggleDiscardHand={() => undefined}
        onConfirm={() => undefined}
        onSkip={() => undefined}
      />,
    )

    expect(markup).toContain('選擇 2 張手牌棄置')
    expect(markup).toContain('已選 1／2')
    expect(markup).toContain('測試手牌 1')
    expect(markup).toContain('Discard 2 cards.')
    expect(markup).toContain('disabled=""')
  })

  it('returns to response selection without skipping the attack response', async () => {
    const trap: GameCard = {
      id: 'ST4-020',
      instanceId: 'st4-020-test',
      name: 'Octo-Ink Spray',
      type: 'trap',
    }
    const onBack = vi.fn()
    const onSkip = vi.fn()
    const onSelectTrap = vi.fn()
    const container = document.createElement('div')
    const root = createRoot(container)
    await act(() => root.render(
      <TrapResponseModal
        cards={[trap]}
        selectedTrapId={null}
        paymentCards={[]}
        targetCards={[]}
        discardHandCards={[]}
        discardHandCost={0}
        selectedDiscardHandIds={[]}
        onSelectTrap={onSelectTrap}
        onToggleDiscardHand={() => undefined}
        onConfirm={() => undefined}
        onSkip={onSkip}
        onBack={onBack}
      />,
    ))

    await click(findButton(container, 'Octo-Ink Spray'))

    expect(onSelectTrap).toHaveBeenCalledWith(trap.instanceId)
    expect(onBack).not.toHaveBeenCalled()
    expect(onSkip).not.toHaveBeenCalled()

    await act(() => root.unmount())
  })

  it('returns from pay step to select step without calling onBack', async () => {
    const trap: GameCard = {
      id: 'ST4-020',
      instanceId: 'st4-020-test',
      name: 'Octo-Ink Spray',
      type: 'trap',
    }
    const onBack = vi.fn()
    const onSkip = vi.fn()
    const container = document.createElement('div')
    const root = createRoot(container)
    await act(() => root.render(
      <TrapResponseModal
        cards={[trap]}
        selectedTrapId={trap.instanceId}
        paymentCards={[]}
        targetCards={[]}
        discardHandCards={[]}
        discardHandCost={0}
        selectedDiscardHandIds={[]}
        onSelectTrap={() => undefined}
        onToggleDiscardHand={() => undefined}
        onConfirm={() => undefined}
        onSkip={onSkip}
        onBack={onBack}
      />,
    ))

    await click(findButton(container, '返回'))

    expect(onBack).not.toHaveBeenCalled()
    expect(onSkip).not.toHaveBeenCalled()
    expect(container.textContent).toContain('是否發動陷阱？')

    await act(() => root.unmount())
  })
})

describe('AttackResponseModal', () => {
  it('minimizes and restores the response choice prompt', async () => {
    const trap = createHandCard(1)
    const blocker = createBattleCookie(1)
    const container = document.createElement('div')
    const root = createRoot(container)
    await act(() => root.render(
      <AttackResponseModal
        trapCards={[trap]}
        blockerCards={[blocker]}
        onSkip={() => undefined}
      />,
    ))

    await click(findButton(container, '縮小'))
    expect(container.querySelector('.attack-response-modal')).toBeNull()
    expect(container.querySelector('.card-reveal-dock')?.textContent).toContain(
      '陷阱 1 張',
    )

    await click(
      container.querySelector<HTMLButtonElement>('.card-reveal-dock') ??
        undefined,
    )
    expect(container.querySelector('.attack-response-modal')).not.toBeNull()

    await act(() => root.unmount())
  })
})

describe('FaintEffectResponseModal', () => {
  const aloeCard: CookieCard = {
    id: 'BS2-040',
    instanceId: 'test-aloe',
    name: 'Aloe Cookie',
    type: 'cookie',
    level: 1,
    hp: 2,
    attack: 2,
    attackCost: 2,
    effectText:
      'When this Cookie faints, view the top 3 cards of your deck. Out of the 3 cards, select 1 {B} card, show it to your opponent, and place that card in your hand. Then, return the remaining cards to the bottom of your deck in any order.',
  }

  it('treats untargeted faint effects as mandatory resolution instead of skip', async () => {
    const onConfirm = vi.fn()
    const container = document.createElement('div')
    const root = createRoot(container)
    await act(() => root.render(
      <FaintEffectResponseModal
        card={aloeCard}
        minTargets={0}
        maxTargets={0}
        selectedTargetCount={0}
        onConfirm={onConfirm}
      />,
    ))

    expect(container.querySelector('.battle-response-modal')).not.toBeNull()
    expect(container.textContent).toContain('確認結算')
    expect(container.textContent).not.toContain('略過')

    await click(findButton(container, '確認結算'))
    expect(onConfirm).toHaveBeenCalledOnce()

    await act(() => root.unmount())
  })

  it('does not block board target clicks while choosing faint targets', async () => {
    const container = document.createElement('div')
    const root = createRoot(container)
    await act(() => root.render(
      <FaintEffectResponseModal
        card={aloeCard}
        minTargets={1}
        maxTargets={1}
        selectedTargetCount={0}
        onConfirm={() => undefined}
      />,
    ))

    const backdrop = container.querySelector<HTMLElement>('.modal-backdrop')
    const modal = container.querySelector<HTMLElement>('.faint-response-modal')
    expect(backdrop?.style.pointerEvents).toBe('none')
    expect(modal?.style.pointerEvents).toBe('auto')

    await act(() => root.unmount())
  })

  it('minimizes and restores the faint effect prompt', async () => {
    const container = document.createElement('div')
    const root = createRoot(container)
    await act(() => root.render(
      <FaintEffectResponseModal
        card={aloeCard}
        minTargets={0}
        maxTargets={0}
        selectedTargetCount={0}
        onConfirm={() => undefined}
      />,
    ))

    await click(findButton(container, '縮小'))
    expect(container.querySelector('.faint-response-modal')).toBeNull()
    expect(container.querySelector('.card-reveal-dock')?.textContent).toContain(
      '昏厥效果待結算',
    )

    await click(
      container.querySelector<HTMLButtonElement>('.card-reveal-dock') ??
        undefined,
    )
    expect(container.querySelector('.faint-response-modal')).not.toBeNull()

    await act(() => root.unmount())
  })
})

describe('OpeningSetupModal', () => {
  it('starts by asking the player to choose one of the five decks', () => {
    const markup = renderToStaticMarkup(
      <OpeningSetupModal
        step="deck-selection"
        message="請選擇牌組"
        hand={[]}
        deckConfig={{ player: 'red', ai: 'green' }}
        onSelectDeck={() => undefined}
        onRps={() => undefined}
        onChooseFirstPlayer={() => undefined}
        onMulligan={() => undefined}
        onSelectStartingCookie={() => undefined}
      />,
    )

    expect(markup).toContain('選擇牌組')
    expect(markup).toContain('紅色起始牌組')
    expect(markup).toContain('黃色起始牌組')
    expect(markup).toContain('綠色起始牌組')
    expect(markup).toContain('藍色起始牌組')
    expect(markup).toContain('紫色起始牌組')
    expect(markup).not.toContain('剪刀')
  })
})

describe('DeckEditorModal', () => {
  it('loads the existing deck when editing from the main menu', async () => {
    const container = document.createElement('div')
    const root = createRoot(container)
    await act(() => root.render(
      <DeckEditorModal
        initialDeck={{
          id: 'existing-deck',
          name: '既有牌組',
          entries: [{ cardNumber: 'ST1-001', count: 4 }],
          createdAt: '2026-06-30T00:00:00.000Z',
          updatedAt: '2026-06-30T00:00:00.000Z',
        }}
        onSave={() => undefined}
        onClose={() => undefined}
      />,
    ))

    expect(
      container.querySelector<HTMLInputElement>('.deck-editor-name-input')
        ?.value,
    ).toBe('既有牌組')
    expect(container.textContent).toContain('ST1-001')
    expect(container.textContent).toContain('4')

    await act(() => root.unmount())
  })
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

  it('shows the FLIP heading and text for a FLIP-only cookie once effectText is populated (BS2-056 regression)', () => {
    // 修復前 official-card-adapter.ts／starter-deck.ts 的 fallback chain 沒有把
    // flip 納入，FLIP-only 餅乾（無 activate/on-play 技能）的 card.effectText
    // 永遠是 undefined，這裡的 FLIP 段落因此永遠不會渲染。
    const markup = renderToStaticMarkup(
      <CardDetailModal
        card={{
          id: 'BS2-056',
          instanceId: 'test-BS2-056',
          name: 'Raspberry Mousse Cookie',
          type: 'cookie',
          officialType: 'flip',
          level: 2,
          hp: 3,
          attack: 1,
          attackCost: 1,
          attackText: '《{P}》 Deals 1 damage.',
          effectText:
            '《Discard 1 card.》 The Cookie with this card attached for HP gains +1 HP.',
        }}
        onClose={() => undefined}
      />,
    )

    expect(markup).toContain('<strong>FLIP</strong>')
    expect(markup).toContain('gains +1 HP')
  })

  it('shows ST2-021 Pretzel Snare official effect text', () => {
    const markup = renderToStaticMarkup(
      <CardDetailModal
        card={{
          id: 'ST2-021',
          instanceId: 'test-ST2-021',
          name: 'Pretzel Snare',
          type: 'trap',
          officialType: 'trap',
          effectText:
            '《{Y}{Y}》 [If opponent Cookie attacks more than 4.] Select up to 1 of your opponent\'s Cookies. That Cookie receives 1 damage.',
        }}
        onClose={() => undefined}
      />,
    )

    expect(markup).toContain('card-detail-rules single-rule')
    expect(markup).toContain('<strong>陷阱效果</strong>')
    expect(markup).toContain('Pretzel Snare')
    expect(markup).toContain('Select up to 1')
    expect(markup).toContain('receives 1 damage')
  })

  it('shows ST2-001 Roguefort Cookie OnPlay skill text', () => {
    const markup = renderToStaticMarkup(
      <CardDetailModal
        card={{
          id: 'ST2-001',
          instanceId: 'test-ST2-001',
          name: 'Roguefort Cookie',
          type: 'cookie',
          level: 3,
          hp: 6,
          attack: 3,
          attackCost: 4,
          attackEnergyCost: { yellow: 3, neutral: 1 },
          effectText:
            '{ap} 《{Y}》 Your opponent must place 1 card from their hand into the trash.',
          skill: {
            trigger: 'on-play',
            oncePerTurn: false,
            yourTurn: false,
            restSource: false,
            cost: { energy: { yellow: 1 }, discardHand: 0 },
            text: '{ap} 《{Y}》 Your opponent must place 1 card from their hand into the trash.',
            effects: [{ kind: 'opponent-discard-hand', count: 1 }],
          },
        }}
        onClose={() => undefined}
      />,
    )

    expect(markup).toContain('Roguefort Cookie')
    expect(markup).toContain('<strong>技能</strong>')
    expect(markup).toContain('opponent')
    expect(markup).toContain('hand')
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
    expect(markup).not.toContain('縮小')
  })

  it('minimizes replacement choice and restores without choosing', async () => {
    const onSelect = vi.fn()
    const onSkipReplacement = vi.fn()
    const container = document.createElement('div')
    const root = createRoot(container)
    await act(() => root.render(
      <DecisionModal
        isRefresh={false}
        playerName="玩家"
        replacementCount={2}
        options={[createHandCard(1), createHandCard(2)]}
        isOptionDisabled={() => false}
        onSelect={onSelect}
        onSkipReplacement={onSkipReplacement}
      />,
    ))

    await click(findButton(container, '縮小'))
    expect(container.querySelector('.decision-modal')).toBeNull()
    expect(container.querySelector('.card-reveal-dock')?.textContent).toContain(
      '玩家尚可補 2 張',
    )
    expect(onSelect).not.toHaveBeenCalled()
    expect(onSkipReplacement).not.toHaveBeenCalled()

    await click(
      container.querySelector<HTMLButtonElement>('.card-reveal-dock') ??
        undefined,
    )
    expect(container.querySelector('.decision-modal')).not.toBeNull()
    expect(onSelect).not.toHaveBeenCalled()
    expect(onSkipReplacement).not.toHaveBeenCalled()

    await act(() => root.unmount())
  })

  it('selects a replacement option from the dialog', async () => {
    const onSelect = vi.fn()
    const container = document.createElement('div')
    const root = createRoot(container)
    await act(() => root.render(
      <DecisionModal
        isRefresh={false}
        playerName="玩家"
        replacementCount={1}
        options={[createBattleCookie(1).card]}
        isOptionDisabled={() => false}
        onSelect={onSelect}
        onSkipReplacement={() => undefined}
      />,
    ))

    await click(findButton(container, '測試餅乾 1'))

    expect(onSelect).toHaveBeenCalledWith('test-cookie-1')

    await act(() => root.unmount())
  })

  it('skips replacement from the dialog', async () => {
    const onSkipReplacement = vi.fn()
    const container = document.createElement('div')
    const root = createRoot(container)
    await act(() => root.render(
      <DecisionModal
        isRefresh={false}
        playerName="玩家"
        replacementCount={1}
        options={[createBattleCookie(1).card]}
        isOptionDisabled={() => false}
        onSelect={() => undefined}
        onSkipReplacement={onSkipReplacement}
      />,
    ))

    await click(findButton(container, '不補餅乾'))

    expect(onSkipReplacement).toHaveBeenCalledTimes(1)

    await act(() => root.unmount())
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
