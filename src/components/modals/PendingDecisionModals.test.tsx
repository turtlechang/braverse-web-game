/// @vitest-environment jsdom

import { createRoot } from 'react-dom/client'
import { act } from 'react'
import { describe, expect, it, vi } from 'vitest'
import type { CookieCard, GameCard } from '../../game'
import {
  DrawUpToResponseModal,
  HandDiscardResponseModal,
  OptionalCostAttackModal,
  InspectDeckModal,
} from './PendingDecisionModals'

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

const createHandCard = (index: number): GameCard => ({
  id: `TEST-${index}`,
  instanceId: `test-hand-${index}`,
  name: `測試手牌 ${index}`,
  type: 'item',
})

const createCookieCard = (index: number): CookieCard => ({
  id: `COOKIE-${index}`,
  instanceId: `cookie-${index}`,
  name: `對手餅乾 ${index}`,
  type: 'cookie',
  level: 1,
  hp: 1,
  attack: 1,
  attackCost: 1,
})

function findAllButtons(container: HTMLElement): HTMLButtonElement[] {
  return Array.from(container.querySelectorAll('button'))
}

function findButtonByText(
  container: HTMLElement,
  text: string,
): HTMLButtonElement | undefined {
  return findAllButtons(container).find((btn) =>
    btn.textContent?.includes(text),
  )
}

describe('DrawUpToResponseModal', () => {
  const tridentCard: GameCard = {
    id: 'BS2-049',
    instanceId: 'test-bs2-049',
    name: 'Salt Crystal Trident',
    type: 'trap',
    effectText:
      '《{B}》 During this battle, if 1 of your {B} Cookies faints, you can draw up to 3 cards from your deck and discard 1 card from your hand.',
  }

  it('uses the battle response modal style instead of the faint floating prompt', async () => {
    const onConfirm = vi.fn()
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)

    await act(() =>
      root.render(
        <DrawUpToResponseModal
          sourceCardName="Salt Crystal Trident"
          sourceCard={tridentCard}
          effectText={tridentCard.effectText}
          max={3}
          deckSize={47}
          onConfirm={onConfirm}
        />,
      ),
    )

    expect(container.querySelector('.battle-response-modal.draw-up-to-modal')).not.toBeNull()
    expect(container.querySelector('.faint-response-modal')).toBeNull()
    expect(container.textContent).toContain('抽牌效果')
    expect(container.textContent).toContain('抽 3 張')

    await act(() => {
      findButtonByText(container, '抽 3 張')!.click()
    })
    await act(() => {
      findButtonByText(container, '抽取 3 張牌')!.click()
    })

    expect(onConfirm).toHaveBeenCalledWith(3)

    await act(() => root.unmount())
    container.remove()
  })

  // BS3-070（Puppet Theater of Chaos）「draw up to 2 cards ... and discard
  // 1 card」過去分成兩個完全獨立的彈窗（抽牌→棄牌），使用者反映感覺像是
  // 「跳出兩個視窗」。這裡驗證 followedByDiscard 會在抽牌彈窗上加一個
  // 「步驟 1/2」提示，讓玩家知道接下來的棄牌提示是同一個效果的下一步。
  it('shows a 2-step phase indicator when the draw is followed by a discard', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)

    await act(() =>
      root.render(
        <DrawUpToResponseModal
          sourceCardName="Puppet Theater of Chaos"
          max={2}
          deckSize={40}
          onConfirm={() => undefined}
          followedByDiscard
        />,
      ),
    )

    const phaseProgress = container.querySelector('.phase-progress')
    expect(phaseProgress).not.toBeNull()
    expect(phaseProgress!.textContent).toContain('抽牌')
    expect(phaseProgress!.textContent).toContain('棄牌')
    expect(
      container.querySelector('.phase-step.is-active')?.textContent,
    ).toContain('抽牌')

    await act(() => root.unmount())
    container.remove()
  })

  it('does not show a phase indicator for a standalone draw with no follow-up discard', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)

    await act(() =>
      root.render(
        <DrawUpToResponseModal
          sourceCardName="Salt Crystal Trident"
          max={3}
          deckSize={40}
          onConfirm={() => undefined}
        />,
      ),
    )

    expect(container.querySelector('.phase-progress')).toBeNull()

    await act(() => root.unmount())
    container.remove()
  })

  it('minimizes and restores the draw-up-to prompt', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)

    await act(() =>
      root.render(
        <DrawUpToResponseModal
          sourceCardName="Salt Crystal Trident"
          sourceCard={tridentCard}
          effectText={tridentCard.effectText}
          max={3}
          deckSize={2}
          onConfirm={() => undefined}
        />,
      ),
    )

    await act(() => {
      findButtonByText(container, '縮小')!.click()
    })

    expect(container.querySelector('.draw-up-to-modal')).toBeNull()
    expect(container.querySelector('.card-reveal-dock')?.textContent).toContain(
      '最多抽 2 張牌',
    )

    await act(() => {
      container.querySelector<HTMLButtonElement>('.card-reveal-dock')!.click()
    })

    expect(container.querySelector('.draw-up-to-modal')).not.toBeNull()

    await act(() => root.unmount())
    container.remove()
  })
})

describe('HandDiscardResponseModal', () => {
  const tridentCard: GameCard = {
    id: 'BS2-049',
    instanceId: 'test-bs2-049',
    name: 'Salt Crystal Trident',
    type: 'trap',
    effectText:
      '《{B}》 During this battle, if 1 of your {B} Cookies faints, you can draw up to 3 cards from your deck and discard 1 card from your hand.',
  }

  it('uses the same battle response modal style for the discard step', async () => {
    const onToggleCard = vi.fn()
    const onConfirm = vi.fn()
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)

    await act(() =>
      root.render(
        <HandDiscardResponseModal
          sourceCardName="Salt Crystal Trident"
          sourceCard={tridentCard}
          effectText={tridentCard.effectText}
          hand={[createHandCard(1), createHandCard(2)]}
          requiredCount={1}
          selectedIds={[]}
          onToggleCard={onToggleCard}
          onConfirm={onConfirm}
        />,
      ),
    )

    expect(container.querySelector('.battle-response-modal.hand-discard-modal')).not.toBeNull()
    expect(container.querySelector('.faint-response-modal')).toBeNull()
    expect(container.textContent).toContain('棄置手牌')
    expect(findButtonByText(container, '確認棄置')!.disabled).toBe(true)

    await act(() => {
      findButtonByText(container, '測試手牌 1')!.click()
    })

    expect(onToggleCard).toHaveBeenCalledWith('test-hand-1')
    expect(onConfirm).not.toHaveBeenCalled()

    await act(() => root.unmount())
    container.remove()
  })

  it('confirms after the required hand card count is selected', async () => {
    const onConfirm = vi.fn()
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)

    await act(() =>
      root.render(
        <HandDiscardResponseModal
          sourceCardName="Salt Crystal Trident"
          sourceCard={tridentCard}
          effectText={tridentCard.effectText}
          hand={[createHandCard(1), createHandCard(2)]}
          requiredCount={1}
          selectedIds={['test-hand-1']}
          onToggleCard={() => undefined}
          onConfirm={onConfirm}
        />,
      ),
    )

    const confirm = findButtonByText(container, '確認棄置')
    expect(confirm!.disabled).toBe(false)

    await act(() => {
      confirm!.click()
    })

    expect(onConfirm).toHaveBeenCalledOnce()

    await act(() => root.unmount())
    container.remove()
  })

  it('shows a 2-step phase indicator continuing from the draw when chained', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)

    await act(() =>
      root.render(
        <HandDiscardResponseModal
          sourceCardName="Puppet Theater of Chaos"
          hand={[createHandCard(1)]}
          requiredCount={1}
          selectedIds={[]}
          onToggleCard={() => undefined}
          onConfirm={() => undefined}
          continuesFromDraw
        />,
      ),
    )

    const phaseProgress = container.querySelector('.phase-progress')
    expect(phaseProgress).not.toBeNull()
    expect(
      container.querySelector('.phase-step.is-active')?.textContent,
    ).toContain('棄牌')
    expect(
      container.querySelector('.phase-step.is-done')?.textContent,
    ).toContain('抽牌')

    await act(() => root.unmount())
    container.remove()
  })

  it('does not show a phase indicator for a standalone discard unrelated to any draw', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)

    await act(() =>
      root.render(
        <HandDiscardResponseModal
          sourceCardName="Some Other Trap"
          hand={[createHandCard(1)]}
          requiredCount={1}
          selectedIds={[]}
          onToggleCard={() => undefined}
          onConfirm={() => undefined}
        />,
      ),
    )

    expect(container.querySelector('.phase-progress')).toBeNull()

    await act(() => root.unmount())
    container.remove()
  })

  it('minimizes and restores the hand discard prompt', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)

    await act(() =>
      root.render(
        <HandDiscardResponseModal
          sourceCardName="Salt Crystal Trident"
          sourceCard={tridentCard}
          effectText={tridentCard.effectText}
          hand={[createHandCard(1)]}
          requiredCount={1}
          selectedIds={[]}
          onToggleCard={() => undefined}
          onConfirm={() => undefined}
        />,
      ),
    )

    await act(() => {
      findButtonByText(container, '縮小')!.click()
    })

    expect(container.querySelector('.hand-discard-modal')).toBeNull()
    expect(container.querySelector('.card-reveal-dock')?.textContent).toContain(
      '已選擇 0/1 張手牌',
    )

    await act(() => {
      container.querySelector<HTMLButtonElement>('.card-reveal-dock')!.click()
    })

    expect(container.querySelector('.hand-discard-modal')).not.toBeNull()

    await act(() => root.unmount())
    container.remove()
  })
})

describe('OptionalCostAttackModal', () => {
  it('calls onPay with exact discard IDs and target ID after full flow', async () => {
    const hand = [createHandCard(1), createHandCard(2), createHandCard(3)]
    const opponents = [
      { card: createCookieCard(1), instanceId: 'cookie-1' },
      { card: createCookieCard(2), instanceId: 'cookie-2' },
    ]
    const onSkip = vi.fn()
    const onPay = vi.fn()

    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)

    await act(() =>
      root.render(
        <OptionalCostAttackModal
          sourceCardName="測試餅乾"
          effectText="支付代價後使用效果。"
          discardHandCost={2}
          energyCostTotal={0}
          supportCandidates={[]}
          playerHand={hand}
          targetCandidates={opponents}
          needsTarget={true}
          targetMin={1}
          targetLabel="對手餅乾"
          onSkip={onSkip}
          onPay={onPay}
        />,
      ),
    )

    const payBtn = findButtonByText(container, '支付')
    expect(payBtn).toBeDefined()
    expect(payBtn!.disabled).toBe(false)

    await act(() => {
      payBtn!.click()
    })

    // discardHandCost>0 and needsTarget=true (energyCostTotal=0) means the
    // guided flow is cost -> target: only the hand-discard step is visible
    // first, matching the same one-thing-at-a-time flow as other prompts.
    const handBtns = Array.from(
      container.querySelectorAll<HTMLButtonElement>('.modal-card-options button'),
    ).filter((btn) => btn.textContent?.includes('測試手牌'))
    expect(handBtns.length).toBe(3)
    expect(
      Array.from(
        container.querySelectorAll<HTMLButtonElement>('.modal-card-options button'),
      ).some((btn) => btn.textContent?.includes('對手餅乾')),
    ).toBe(false)

    await act(() => {
      handBtns[0].click()
    })
    await act(() => {
      handBtns[1].click()
    })

    const nextBtn = findButtonByText(container, '下一步')
    expect(nextBtn).toBeDefined()
    expect(nextBtn!.disabled).toBe(false)

    await act(() => {
      nextBtn!.click()
    })

    const targetBtns = Array.from(
      container.querySelectorAll<HTMLButtonElement>('.modal-card-options button'),
    ).filter((btn) => btn.textContent?.includes('對手餅乾'))
    expect(targetBtns.length).toBe(2)

    await act(() => {
      targetBtns[1].click()
    })

    const confirmBtn = findButtonByText(container, '確認')
    expect(confirmBtn).toBeDefined()
    expect(confirmBtn!.disabled).toBe(false)

    await act(() => {
      confirmBtn!.click()
    })

    expect(onPay).toHaveBeenCalledTimes(1)
    expect(onPay).toHaveBeenCalledWith(
      ['test-hand-1', 'test-hand-2'],
      'cookie-2',
      [],
    )
    expect(onSkip).not.toHaveBeenCalled()

    await act(() => root.unmount())
    container.remove()
  })

  it('allows confirming an up-to-one target selection without selecting a card', async () => {
    const onPay = vi.fn()
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)

    await act(() =>
      root.render(
        <OptionalCostAttackModal
          sourceCardName="Target Test"
          effectText="Select up to one friendly Cookie."
          discardHandCost={0}
          energyCostTotal={0}
          supportCandidates={[]}
          playerHand={[]}
          targetCandidates={[
            { card: createCookieCard(1), instanceId: 'friendly-cookie-1' },
          ]}
          needsTarget={true}
          targetMin={0}
          targetLabel="friendly Cookie"
          onSkip={() => undefined}
          onPay={onPay}
        />,
      ),
    )

    const decisionButtons = container.querySelectorAll<HTMLButtonElement>(
      '.modal-actions-decision button',
    )
    await act(() => {
      decisionButtons[1].click()
    })

    expect(container.textContent).toContain('最多選擇 1 個friendly Cookie作為目標')
    const confirmButton = container.querySelector<HTMLButtonElement>(
      '.modal-actions-sticky button:last-child',
    )
    expect(confirmButton?.disabled).toBe(false)

    await act(() => {
      confirmButton!.click()
    })

    expect(onPay).toHaveBeenCalledWith([], '', [])

    await act(() => root.unmount())
    container.remove()
  })

  it('disables pay button when hand is less than cost', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)

    await act(() =>
      root.render(
        <OptionalCostAttackModal
          sourceCardName="測試餅乾"
          effectText="支付代價後使用效果。"
          discardHandCost={2}
          energyCostTotal={0}
          supportCandidates={[]}
          playerHand={[createHandCard(1)]}
          targetCandidates={[
            { card: createCookieCard(1), instanceId: 'cookie-1' },
          ]}
          needsTarget={true}
          targetMin={1}
          targetLabel="對手餅乾"
          onSkip={() => undefined}
          onPay={() => undefined}
        />,
      ),
    )

    const payBtn = findButtonByText(container, '支付')
    expect(payBtn!.disabled).toBe(true)

    await act(() => root.unmount())
    container.remove()
  })

  it('disables confirm when selections are insufficient', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)

    await act(() =>
      root.render(
        <OptionalCostAttackModal
          sourceCardName="測試餅乾"
          effectText="支付代價後使用效果。"
          discardHandCost={2}
          energyCostTotal={0}
          supportCandidates={[]}
          playerHand={[createHandCard(1), createHandCard(2)]}
          targetCandidates={[
            { card: createCookieCard(1), instanceId: 'cookie-1' },
          ]}
          needsTarget={true}
          targetMin={1}
          targetLabel="對手餅乾"
          onSkip={() => undefined}
          onPay={() => undefined}
        />,
      ),
    )

    await act(() => {
      findButtonByText(container, '支付')!.click()
    })

    // Cost phase comes before target (energyCostTotal=0), so the primary
    // button here is "下一步", not "確認" — the target step isn't reachable
    // yet with an incomplete cost selection.
    const nextBtn = findButtonByText(container, '下一步')
    expect(nextBtn!.disabled).toBe(true)

    const handBtns = Array.from(
      container.querySelectorAll<HTMLButtonElement>('.modal-card-options button'),
    ).filter((btn) => btn.textContent?.includes('測試手牌'))

    await act(() => {
      handBtns[0].click()
    })

    expect(nextBtn!.disabled).toBe(true)

    await act(() => {
      handBtns[1].click()
    })

    expect(nextBtn!.disabled).toBe(false)

    await act(() => {
      nextBtn!.click()
    })

    const confirmBtn = findButtonByText(container, '確認')
    expect(confirmBtn!.disabled).toBe(true)

    await act(() => root.unmount())
    container.remove()
  })

  it('clears selections and returns to decision on back button', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)

    await act(() =>
      root.render(
        <OptionalCostAttackModal
          sourceCardName="測試餅乾"
          effectText="支付代價後使用效果。"
          discardHandCost={2}
          energyCostTotal={0}
          supportCandidates={[]}
          playerHand={[createHandCard(1), createHandCard(2)]}
          targetCandidates={[
            { card: createCookieCard(1), instanceId: 'cookie-1' },
          ]}
          needsTarget={true}
          targetMin={1}
          targetLabel="對手餅乾"
          onSkip={() => undefined}
          onPay={() => undefined}
        />,
      ),
    )

    await act(() => {
      findButtonByText(container, '支付')!.click()
    })

    const handBtns = Array.from(
      container.querySelectorAll('.modal-card-options button'),
    ).filter((btn) => btn.textContent?.includes('測試手牌'))
    await act(() => {
      ;(handBtns[0] as HTMLButtonElement).click()
    })

    const backBtn = findButtonByText(container, '返回')
    expect(backBtn).toBeDefined()

    await act(() => {
      backBtn!.click()
    })

    const payBtnAgain = findButtonByText(container, '支付')
    expect(payBtnAgain).toBeDefined()

    await act(() => {
      payBtnAgain!.click()
    })

    const selectedAfterReturn = container.querySelectorAll(
      '.modal-card-options button.is-selected',
    )
    expect(selectedAfterReturn.length).toBe(0)

    await act(() => root.unmount())
    container.remove()
  })

  it('calls onSkip when skip button is clicked', async () => {
    const onSkip = vi.fn()
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)

    await act(() =>
      root.render(
        <OptionalCostAttackModal
          sourceCardName="測試餅乾"
          effectText="支付代價後使用效果。"
          discardHandCost={2}
          energyCostTotal={0}
          supportCandidates={[]}
          playerHand={[createHandCard(1), createHandCard(2)]}
          targetCandidates={[
            { card: createCookieCard(1), instanceId: 'cookie-1' },
          ]}
          needsTarget={true}
          targetMin={1}
          targetLabel="對手餅乾"
          onSkip={onSkip}
          onPay={() => undefined}
        />,
      ),
    )

    await act(() => {
      findButtonByText(container, '略過')!.click()
    })

    expect(onSkip).toHaveBeenCalledTimes(1)

    await act(() => root.unmount())
    container.remove()
  })

  it('minimizes to dock without calling onSkip and restores on expand', async () => {
    const onSkip = vi.fn()
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)

    await act(() =>
      root.render(
        <OptionalCostAttackModal
          sourceCardName="測試餅乾"
          effectText="支付代價後使用效果。"
          discardHandCost={2}
          energyCostTotal={0}
          supportCandidates={[]}
          playerHand={[createHandCard(1), createHandCard(2)]}
          targetCandidates={[
            { card: createCookieCard(1), instanceId: 'cookie-1' },
          ]}
          needsTarget={true}
          targetMin={1}
          targetLabel="對手餅乾"
          onSkip={onSkip}
          onPay={() => undefined}
        />,
      ),
    )

    await act(() => {
      findButtonByText(container, '縮小')!.click()
    })

    expect(container.querySelector('.optional-cost-attack-modal')).toBeNull()
    expect(container.querySelector('.card-reveal-dock')).not.toBeNull()
    expect(container.querySelector('.card-reveal-dock')?.textContent).toContain(
      '攻擊可選效果',
    )
    expect(onSkip).not.toHaveBeenCalled()

    await act(() => {
      container.querySelector<HTMLButtonElement>('.card-reveal-dock')!.click()
    })

    expect(container.querySelector('.optional-cost-attack-modal')).not.toBeNull()
    expect(onSkip).not.toHaveBeenCalled()

    await act(() => root.unmount())
    container.remove()
  })
})

describe('InspectDeckModal', () => {
  const revealedCards: GameCard[] = [
    { id: 'A-1', instanceId: 'reveal-a', name: '牌A', type: 'item' },
    {
      id: 'B-1',
      instanceId: 'reveal-b',
      name: '牌B',
      type: 'cookie',
      level: 1,
      hp: 1,
      attack: 1,
      attackCost: 1,
    },
    { id: 'C-1', instanceId: 'reveal-c', name: '牌C', type: 'item' },
  ]

  it('picks a card and confirms with correct payload', async () => {
    const onConfirm = vi.fn()
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)

    await act(() =>
      root.render(
        <InspectDeckModal
          sourceCardName="檢視餅乾"
          revealedCards={revealedCards}
          pickCount={1}
          onConfirm={onConfirm}
        />,
      ),
    )

    const confirmBtn = findButtonByText(container, '確認並放回')
    expect(confirmBtn!.disabled).toBe(true)

    const pickBtn = findButtonByText(container, '牌A')
    expect(pickBtn).toBeDefined()

    await act(() => {
      pickBtn!.click()
    })

    expect(confirmBtn!.disabled).toBe(false)

    await act(() => {
      confirmBtn!.click()
    })

    expect(onConfirm).toHaveBeenCalledTimes(1)
    const [pickedCardIds, restOrder] = onConfirm.mock.calls[0]
    expect(pickedCardIds).toEqual(['reveal-a'])
    expect(restOrder).toEqual(['reveal-b', 'reveal-c'])

    await act(() => root.unmount())
    container.remove()
  })

  it('re-selects from A to B: restOrder must contain all revealed IDs except B', async () => {
    const onConfirm = vi.fn()
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)

    await act(() =>
      root.render(
        <InspectDeckModal
          sourceCardName="檢視餅乾"
          revealedCards={revealedCards}
          pickCount={1}
          onConfirm={onConfirm}
        />,
      ),
    )

    const btnA = findButtonByText(container, '牌A')!
    await act(() => {
      btnA.click()
    })

    // Deselect A by clicking again, then select B
    await act(() => {
      btnA.click()
    })

    const btnB = findButtonByText(container, '牌B')!
    await act(() => {
      btnB.click()
    })

    const confirmBtn = findButtonByText(container, '確認並放回')
    await act(() => {
      confirmBtn!.click()
    })

    expect(onConfirm).toHaveBeenCalledTimes(1)
    const [pickedCardIds, restOrder] = onConfirm.mock.calls[0]
    expect(pickedCardIds).toEqual(['reveal-b'])
    expect(restOrder).toHaveLength(2)
    expect(restOrder).toContain('reveal-a')
    expect(restOrder).toContain('reveal-c')
    expect(restOrder).not.toContain('reveal-b')

    const allIds = revealedCards.map((c) => c.instanceId)
    const restSet = new Set(restOrder as string[])
    const expectedRest = allIds.filter((id) => !pickedCardIds.includes(id))
    expect(restSet.size).toBe(expectedRest.length)
    for (const id of expectedRest) {
      expect(restSet.has(id)).toBe(true)
    }

    await act(() => root.unmount())
    container.remove()
  })

  it('deselects when clicking the same card again', async () => {
    const onConfirm = vi.fn()
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)

    await act(() =>
      root.render(
        <InspectDeckModal
          sourceCardName="檢視餅乾"
          revealedCards={revealedCards}
          pickCount={1}
          onConfirm={onConfirm}
        />,
      ),
    )

    const btnA = findButtonByText(container, '牌A')!
    await act(() => {
      btnA.click()
    })

    await act(() => {
      btnA.click()
    })

    const confirmBtn = findButtonByText(container, '確認並放回')
    expect(confirmBtn!.disabled).toBe(true)

    await act(() => root.unmount())
    container.remove()
  })

  it('returns from a picked card to the card choice', async () => {
    const onConfirm = vi.fn()
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)

    await act(() =>
      root.render(
        <InspectDeckModal
          sourceCardName="檢視餅乾"
          revealedCards={revealedCards}
          pickCount={1}
          onConfirm={onConfirm}
        />,
      ),
    )

    await act(() => {
      findButtonByText(container, '牌A')!.click()
    })

    expect(findButtonByText(container, '確認並放回')!.disabled).toBe(false)

    await act(() => {
      findButtonByText(container, '返回')!.click()
    })

    expect(findButtonByText(container, '確認並放回')!.disabled).toBe(true)
    expect(container.querySelector('.inspect-deck-grid .is-selected')).toBeNull()
    expect(onConfirm).not.toHaveBeenCalled()

    await act(() => root.unmount())
    container.remove()
  })

  it('minimizes and restores the inspect deck prompt', async () => {
    const onConfirm = vi.fn()
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)

    await act(() =>
      root.render(
        <InspectDeckModal
          sourceCardName="Aloe Cookie"
          revealedCards={revealedCards}
          pickCount={1}
          onConfirm={onConfirm}
        />,
      ),
    )

    await act(() => {
      findButtonByText(container, '縮小')!.click()
    })

    expect(container.querySelector('.inspect-deck-modal')).toBeNull()
    expect(container.querySelector('.card-reveal-dock')?.textContent).toContain(
      '查看 3 張牌',
    )

    await act(() => {
      ;(container.querySelector('.card-reveal-dock') as HTMLButtonElement).click()
    })

    expect(container.querySelector('.inspect-deck-modal')).not.toBeNull()
    expect(onConfirm).not.toHaveBeenCalled()

    await act(() => root.unmount())
    container.remove()
  })

  it('moveUp and moveDown reorder the remaining cards', async () => {
    const onConfirm = vi.fn()
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)

    const fourCards: GameCard[] = [
      { id: 'A', instanceId: 'id-a', name: '牌A', type: 'item' },
      { id: 'B', instanceId: 'id-b', name: '牌B', type: 'item' },
      { id: 'C', instanceId: 'id-c', name: '牌C', type: 'item' },
      { id: 'D', instanceId: 'id-d', name: '牌D', type: 'item' },
    ]

    await act(() =>
      root.render(
        <InspectDeckModal
          sourceCardName="檢視餅乾"
          revealedCards={fourCards}
          pickCount={1}
          onConfirm={onConfirm}
        />,
      ),
    )

    await act(() => {
      findButtonByText(container, '牌A')!.click()
    })

    const moveDownBtn = container.querySelector(
      '[aria-label="牌B 下移"]',
    ) as HTMLButtonElement
    expect(moveDownBtn).toBeDefined()
    expect(moveDownBtn.disabled).toBe(false)

    await act(() => {
      moveDownBtn.click()
    })

    const confirmBtn = findButtonByText(container, '確認並放回')
    await act(() => {
      confirmBtn!.click()
    })

    const [pickedCardIds, restOrder] = onConfirm.mock.calls[0]
    expect(pickedCardIds).toEqual(['id-a'])
    expect(restOrder).toEqual(['id-c', 'id-b', 'id-d'])

    await act(() => root.unmount())
    container.remove()
  })

  it('renders revealed cards with aria labels', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)

    await act(() =>
      root.render(
        <InspectDeckModal
          sourceCardName="檢視餅乾"
          revealedCards={revealedCards}
          pickCount={1}
          onConfirm={() => undefined}
        />,
      ),
    )

    expect(container.querySelector('[aria-label="選擇牌A"]')).not.toBeNull()
    expect(container.querySelector('[aria-label="選擇牌B"]')).not.toBeNull()
    expect(container.querySelector('[aria-label="選擇牌C"]')).not.toBeNull()

    await act(() => root.unmount())
    container.remove()
  })
})
