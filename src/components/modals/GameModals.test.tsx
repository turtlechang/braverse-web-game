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
  PauseModal,
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
  it('shows the attacker and attack target together during an attack response', () => {
    const attacker = createBattleCookie(40).card
    const target = createBattleCookie(41).card
    const markup = renderToStaticMarkup(
      <TrapResponseModal
        cards={[createHandCard(40)]}
        selectedTrapId={null}
        paymentCards={[]}
        targetCards={[]}
        discardHandCards={[]}
        discardHandCost={0}
        selectedDiscardHandIds={[]}
        attackerCard={attacker}
        attackTargetCard={target}
        onSelectTrap={() => undefined}
        onToggleDiscardHand={() => undefined}
        onConfirm={() => undefined}
        onSkip={() => undefined}
      />,
    )

    expect(markup).toContain('attack-declaration-summary')
    expect(markup).toContain('attack-declaration-attacker')
    expect(markup).toContain('attack-declaration-target')
    expect(markup).toContain(attacker.name)
    expect(markup).toContain(target.name)
  })

  it('guides energy, cost, and target separately with previous-step navigation', async () => {
    const trap: GameCard = {
      id: 'GUIDED-TRAP',
      instanceId: 'guided-trap',
      name: 'Guided Trap',
      type: 'trap',
      trap: {
        text: 'Pay energy, discard 1 card, then select a target.',
        cost: { energy: { blue: 1 }, discardHand: 1 },
        effects: [],
      },
    }
    const payment = createHandCard(10)
    const discard = createHandCard(11)
    const target = createBattleCookie(12)
    const container = document.createElement('div')
    const root = createRoot(container)
    await act(() => root.render(
      <TrapResponseModal
        cards={[trap]}
        selectedTrapId={trap.instanceId}
        paymentCards={[payment]}
        trapEnergyCostTotal={1}
        selectedPaymentIds={[payment.instanceId]}
        targetCards={[target.card]}
        trapTargetCandidates={[target]}
        selectedTrapTargetId={target.card.instanceId}
        onSelectTrap={() => undefined}
        onSelectTrapTarget={() => undefined}
        onTogglePayment={() => undefined}
        discardHandCards={[discard]}
        discardHandCost={1}
        selectedDiscardHandIds={[discard.instanceId]}
        onToggleDiscardHand={() => undefined}
        onConfirm={() => undefined}
        onSkip={() => undefined}
      />,
    ))

    expect(container.querySelectorAll('.phase-step')).toHaveLength(3)
    expect(container.textContent).toContain('能量支付')
    expect(container.textContent).not.toContain('額外代價')

    await click(findButton(container, '下一步'))
    expect(container.textContent).toContain('額外代價')
    expect(container.textContent).not.toContain('能量支付')

    await click(findButton(container, '下一步'))
    expect(container.textContent).toContain('選擇目標餅乾')

    await click(findButton(container, '上一步'))
    expect(container.textContent).toContain('額外代價')

    await act(() => root.unmount())
  })

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

  it('shows a trash-to-deck selection section independent from the modify-attack target section (R15, BS2-079 regression)', async () => {
    const trap: GameCard = {
      id: 'BS2-079',
      instanceId: 'bs2-079-test',
      name: 'Two-Effect Trap',
      type: 'trap',
      trap: {
        text: "Select up to 1 opponent Cookie. -1 attack this turn. Select up to 5 non-FLIP trash cards, shuffle into deck.",
        cost: { energy: { purple: 1 }, discardHand: 0 },
        effects: [
          {
            kind: 'modify-attack',
            amount: -1,
            duration: 'this-turn',
            target: { side: 'opponent', min: 0, max: 1 },
          },
          { kind: 'trash-to-deck', max: 5, excludeFlip: true },
        ],
      },
    }
    const trashCards = [createHandCard(1), createHandCard(2)]
    const onToggleTrashToDeck = vi.fn()
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
        onSkip={() => undefined}
        trashToDeckCards={trashCards}
        trashToDeckAmount={5}
        selectedTrashToDeckIds={[trashCards[0].instanceId]}
        onToggleTrashToDeck={onToggleTrashToDeck}
      />,
    ))

    expect(container.textContent).toContain('選擇最多 5 張棄牌區卡牌洗回牌庫')
    expect(container.textContent).toContain('已選 1／最多 5')

    await click(findButton(container, '測試手牌 2'))
    expect(onToggleTrashToDeck).toHaveBeenCalledWith(trashCards[1].instanceId)

    await act(() => root.unmount())
  })

  it('lets the player choose the support card for a support-to-trash effect', async () => {
    const trap: GameCard = {
      id: 'ST3-019',
      instanceId: 'st3-019-modal-test',
      name: 'Supreme Whipped Cream',
      type: 'trap',
      trap: {
        text: 'Place 1 card from your support area into the trash.',
        cost: { energy: {}, discardHand: 0 },
        effects: [{ kind: 'support-to-trash', amount: 1 }],
      },
    }
    const supportCards = [createHandCard(21), createHandCard(22)]
    const onToggleSupportTrash = vi.fn()
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
        onSkip={() => undefined}
        supportTrashCards={supportCards}
        supportTrashAmount={1}
        selectedSupportTrashIds={[]}
        onToggleSupportTrash={onToggleSupportTrash}
      />,
    ))

    expect(container.textContent).toContain('支援區')
    await click(findButton(container, supportCards[1].name))
    expect(onToggleSupportTrash).toHaveBeenCalledWith(supportCards[1].instanceId)

    await act(() => root.unmount())
  })

  it('keeps every trap target button in a scrollable target list', () => {
    const trap: GameCard = {
      id: 'BS2-021',
      instanceId: 'bs2-021-modal-test',
      name: 'Carrot Farm Scarecrow',
      type: 'trap',
      trap: {
        text: "Select up to 1 of your opponent's Cookies.",
        cost: { energy: {}, discardHand: 0 },
        effects: [
          {
            kind: 'modify-attack',
            amount: -1,
            duration: 'this-turn',
            target: { side: 'opponent', min: 0, max: 1 },
          },
        ],
      },
    }
    const targets = Array.from({ length: 8 }, (_, index) =>
      createBattleCookie(index + 30),
    )
    const markup = renderToStaticMarkup(
      <TrapResponseModal
        cards={[trap]}
        selectedTrapId={trap.instanceId}
        paymentCards={[]}
        targetCards={targets.map((target) => target.card)}
        trapTargetCandidates={targets}
        selectedTrapTargetId={null}
        onSelectTrap={() => undefined}
        onSelectTrapTarget={() => undefined}
        discardHandCards={[]}
        discardHandCost={0}
        selectedDiscardHandIds={[]}
        onToggleDiscardHand={() => undefined}
        onConfirm={() => undefined}
        onSkip={() => undefined}
      />,
    )

    expect((markup.match(/class="is-selected"/g) ?? []).length).toBe(0)
    expect(markup).toContain('trap-target-options')
    expect((markup.match(/type="button"/g) ?? []).length).toBeGreaterThanOrEqual(9)
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

    await click(findButton(container, '上一步'))

    expect(onBack).not.toHaveBeenCalled()
    expect(onSkip).not.toHaveBeenCalled()
    expect(container.textContent).toContain('是否發動陷阱？')

    await act(() => root.unmount())
  })
})

describe('AttackResponseModal', () => {
  it('keeps the attack target visible while choosing a response', () => {
    const attacker = createBattleCookie(50).card
    const target = createBattleCookie(51).card
    const markup = renderToStaticMarkup(
      <AttackResponseModal
        trapCards={[createHandCard(50)]}
        blockerCards={[]}
        attackerCard={attacker}
        attackTargetCard={target}
        onSkip={() => undefined}
      />,
    )

    expect(markup).toContain('attack-declaration-summary')
    expect(markup).toContain(attacker.name)
    expect(markup).toContain(target.name)
  })

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

  it('shows selectable card candidates for card-based faint effects', async () => {
    const onSelectTarget = vi.fn()
    const handCookie: CookieCard = {
      ...aloeCard,
      id: 'BS3-029-target',
      instanceId: 'bs3-029-target',
      name: 'Yellow Cookie',
    }
    const container = document.createElement('div')
    const root = createRoot(container)
    await act(() => root.render(
      <FaintEffectResponseModal
        card={aloeCard}
        minTargets={0}
        maxTargets={1}
        selectedTargetCount={0}
        selectedTargetIds={[]}
        candidateCards={[handCookie]}
        onSelectTarget={onSelectTarget}
        onConfirm={() => undefined}
      />,
    ))

    await click(findButton(container, 'Yellow Cookie'))
    expect(onSelectTarget).toHaveBeenCalledWith('bs3-029-target')

    await act(() => root.unmount())
  })

  it('blocks faint resolution until its optional energy cost is paid', async () => {
    const onSelectPayment = vi.fn()
    const paymentCard: GameCard = {
      id: 'yellow-support',
      instanceId: 'yellow-support',
      name: 'Yellow Support',
      type: 'item',
      energyColor: 'yellow',
    }
    const container = document.createElement('div')
    const root = createRoot(container)
    await act(() => root.render(
      <FaintEffectResponseModal
        card={aloeCard}
        minTargets={0}
        maxTargets={0}
        selectedTargetCount={0}
        energyCost={{ yellow: 1 }}
        paymentCandidates={[paymentCard]}
        paymentCostTotal={1}
        paymentValid={false}
        onSelectPayment={onSelectPayment}
        allowSkip
        onSkip={() => undefined}
        onConfirm={() => undefined}
      />,
    ))

    expect(findButton(container, '確認結算')?.disabled).toBe(true)
    await click(findButton(container, 'Yellow Support'))
    expect(onSelectPayment).toHaveBeenCalledWith('yellow-support')
    expect(findButton(container, '不發動')).toBeDefined()

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

  it('keeps ordinary attack power beside the attack name before Then text', () => {
    const markup = renderToStaticMarkup(
      <CardDetailModal
        card={{
          id: 'BS3-088',
          instanceId: 'test-BS3-088',
          name: 'Pure Vanilla Cookie',
          type: 'cookie',
          level: 3,
          hp: 4,
          attack: 4,
          attackCost: 4,
          attackEnergyCost: { blue: 4 },
          attackText:
            '<{B}{B}{B}{B}> I Will Not Falter! {da} 4\r\nThen, <discard 1 card.> Select up to 1 Cookie in your battle area. That Cookie gains +1 HP.',
        }}
        onClose={() => undefined}
      />,
    )

    expect(markup).toContain('class="card-attack-main"')
    expect(markup).toContain('class="attack-power-value"')
    expect(markup).toContain('title="普通攻擊力 4"')
    expect(markup).toContain('class="card-attack-follow-up">Then,')
    expect(markup).not.toContain('card-attack-follow-up">4 Then')
    expect(markup.indexOf('class="attack-power-value"')).toBeLessThan(
      markup.indexOf('class="card-attack-follow-up"'),
    )
  })

  it('keeps stage placement and activation effects on separate lines', () => {
    const markup = renderToStaticMarkup(
      <CardDetailModal
        card={{
          id: 'BS3-096',
          instanceId: 'test-BS3-096',
          name: 'Peaceful Vanilla Kingdom',
          type: 'stage',
          effectText:
            '<{B}{B}> Place in your stage area.\r\n{mob} <Rest this card.> If your hand contains 2 cards or less, draw 2 cards from your deck.',
        }}
        onClose={() => undefined}
      />,
    )

    const lineStarts = [...markup.matchAll(/<span class="card-stage-effect-line">/g)].map(
      (match) => match.index ?? -1,
    )

    expect(lineStarts).toHaveLength(2)
    expect(markup.slice(lineStarts[0], lineStarts[1])).toContain(
      'Place in your stage area.',
    )
    expect(markup.slice(lineStarts[1])).toContain('/card-tags/activate.webp')
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

  it('keeps the first and last replacement cards reachable in the horizontal list', async () => {
    const onSelect = vi.fn()
    const options = Array.from({ length: 8 }, (_, index) =>
      createBattleCookie(index + 1).card,
    )
    const container = document.createElement('div')
    const root = createRoot(container)
    await act(() =>
      root.render(
        <DecisionModal
          isRefresh={false}
          playerName="玩家"
          replacementCount={1}
          options={options}
          isOptionDisabled={() => false}
          onSelect={onSelect}
          onSkipReplacement={() => undefined}
        />,
      ),
    )

    const optionsList = container.querySelector('.decision-card-options')
    expect(optionsList).not.toBeNull()
    const optionButtons = optionsList!.querySelectorAll('button')
    expect(optionButtons).toHaveLength(options.length)

    await act(() => (optionButtons[0] as HTMLButtonElement).click())
    await act(() =>
      (optionButtons[optionButtons.length - 1] as HTMLButtonElement).click(),
    )

    expect(onSelect).toHaveBeenNthCalledWith(1, options[0].instanceId)
    expect(onSelect).toHaveBeenNthCalledWith(
      2,
      options[options.length - 1].instanceId,
    )

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

  it('shows choose-one options for FLIP effects that need a mode before activation', () => {
    const card: CookieCard = {
      id: 'BS4-102',
      instanceId: 'choose-one-flip',
      name: 'Wildberry Cookie',
      type: 'cookie',
      officialType: 'flip',
      level: 1,
      hp: 1,
      attack: 1,
      attackCost: 1,
      flip: {
        text: 'Place up to 3 cards from the top of either player deck into the trash.',
        cost: { energy: {}, discardHand: 0 },
        effects: [{
          kind: 'choose-one',
          modes: [
            { label: 'your deck', effects: [{ kind: 'deck-to-trash', amount: 3, side: 'self' }] },
            { label: "opponent's deck", effects: [{ kind: 'deck-to-trash', amount: 3, side: 'opponent' }] },
          ],
        }],
      },
    }
    const chooseOneModes = card.flip!.effects[0].kind === 'choose-one'
      ? card.flip!.effects[0].modes
      : undefined
    const markup = renderToStaticMarkup(
      <FlipResponseModal
        card={card}
        hand={[]}
        discardCount={0}
        selectedDiscardIds={[]}
        onToggleDiscard={() => undefined}
        onActivate={() => undefined}
        onSkip={() => undefined}
        chooseOneModes={chooseOneModes}
      />,
    )

    expect(markup).toContain('FLIP 效果選項')
    expect(markup).toContain('your deck')
    expect(markup).toContain('opponent&#x27;s deck')
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

  it('shows a special-victory reason without describing a defeat condition', () => {
    const markup = renderToStaticMarkup(
      <ResultModal
        winnerName="玩家"
        loserId="player-two"
        viewerPlayerId="player-one"
        reason="special-victory"
        onRestart={() => undefined}
      />,
    )

    expect(markup).toContain('玩家達成了特殊勝利條件。')
    expect(markup).not.toContain('休息區')
  })
})

describe('PauseModal', () => {
  const baseProps = {
    turnNumber: 3,
    phaseLabel: '主要階段',
    deckConfig: { player: 'red', ai: 'red' } as const,
    aiActionCount: 5,
    onRunSimulation: () => undefined,
    onResume: () => undefined,
  }

  it('offers 複製問題包 and shows copied feedback after the handler resolves', async () => {
    const onCopyIssueBundle = vi.fn().mockResolvedValue(true)
    const container = document.createElement('div')
    const root = createRoot(container)
    await act(() =>
      root.render(
        <PauseModal {...baseProps} onCopyIssueBundle={onCopyIssueBundle} />,
      ),
    )

    await click(findButton(container, '複製問題包'))
    await act(async () => {})

    expect(onCopyIssueBundle).toHaveBeenCalledTimes(1)
    expect(container.textContent).toContain('已複製問題包')

    await act(() => root.unmount())
  })

  it('hides the copy button when onCopyIssueBundle is not provided', () => {
    const markup = renderToStaticMarkup(<PauseModal {...baseProps} />)
    expect(markup).not.toContain('複製問題包')
    expect(markup).toContain('繼續對戰')
  })
})
