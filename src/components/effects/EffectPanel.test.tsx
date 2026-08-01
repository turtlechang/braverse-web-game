/// @vitest-environment jsdom

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { CardEffect, CookieCard, EnergyColor, GameCard } from '../../game'
import { EffectPanel } from './EffectPanel'
import type { PendingEffect } from './effectUiTypes'

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

const scrollIntoViewMock = vi.fn()
Element.prototype.scrollIntoView = scrollIntoViewMock

afterEach(() => {
  scrollIntoViewMock.mockReset()
})

const createCookieCard = (index: number): CookieCard => ({
  id: `COOKIE-${index}`,
  instanceId: `cookie-${index}`,
  name: `測試餅乾 ${index}`,
  type: 'cookie',
  level: 1,
  hp: 2,
  attack: 1,
  attackCost: 1,
})

const createItemCard = (index: number): GameCard => ({
  id: `ITEM-${index}`,
  instanceId: `item-${index}`,
  name: `測試物品 ${index}`,
  type: 'item',
})

const createSupportCard = (index: number, energyColor: EnergyColor = 'red'): GameCard => ({
  id: `SUPPORT-${index}`,
  instanceId: `support-${index}`,
  name: `支援卡 ${index}`,
  type: 'item',
  energyColor,
})

const createPendingEffect = (
  overrides: Partial<PendingEffect> = {},
): PendingEffect => ({
  sourceCard: createCookieCard(0),
  context: {} as PendingEffect['context'],
  skill: {
    trigger: 'activate',
    oncePerTurn: false,
    yourTurn: false,
    restSource: false,
    cost: { energy: {}, discardHand: 0 },
    text: 'Test skill',
    effects: [],
  },
  trigger: 'activate',
  effects: [],
  effectIndex: 0,
  selectedTargetIds: [],
  selectedPaymentIds: [],
  selectedCostSupportToTrashIds: [],
  selectedDiscardHandIds: [],
  selectedTrashBattleCookieIds: [],
  skillActivated: false,
  optional: false,
  triggerLabel: '技能啟動',
  sourceKind: 'cookie',
  ...overrides,
})

describe('EffectPanel', () => {
  it('returns null when no pending effect and empty history', () => {
    const container = document.createElement('div')
    const root = createRoot(container)
    act(() => root.render(
      <EffectPanel
        pendingEffect={null}
        currentEffect={null}
        effectHistory={[]}
        onConfirm={() => undefined}
        onSkip={() => undefined}
      />,
    ))

    expect(container.innerHTML).toBe('')
    act(() => root.unmount())
  })

  it('shows the ability text for the active pendingEffect, not the card\'s unrelated effectText (BS2-058 attack-effect regression)', () => {
    const attacker: CookieCard = {
      ...createCookieCard(0),
      // sourceCard.effectText 是卡牌的技能文字，攻擊後續效果流程要顯示的是
      // pendingEffect.skill.text（攻擊文字），兩者這裡故意設成不同字串以驗證。
      effectText: 'OnPlay 登場技能文字（不應顯示）',
    }
    const pending = createPendingEffect({
      sourceCard: attacker,
      sourceKind: 'attack',
      triggerLabel: '攻擊後續效果',
      skill: {
        trigger: 'activate',
        oncePerTurn: false,
        yourTurn: true,
        restSource: false,
        cost: { energy: {}, discardHand: 0 },
        text: '攻擊後續效果文字（應該顯示）',
        effects: [],
      },
    })

    const container = document.createElement('div')
    const root = createRoot(container)
    act(() => root.render(
      <EffectPanel
        pendingEffect={pending}
        currentEffect={{
          kind: 'damage',
          amount: 1,
          target: { side: 'opponent', min: 0, max: 1 },
        }}
        effectHistory={[]}
        onConfirm={() => undefined}
        onSkip={() => undefined}
      />,
    ))

    expect(container.textContent).toContain('攻擊後續效果文字（應該顯示）')
    expect(container.textContent).not.toContain('OnPlay 登場技能文字（不應顯示）')
    expect(
      container.querySelector('.effect-source-copy .effect-source-description')
        ?.textContent,
    ).toContain('攻擊後續效果文字（應該顯示）')
    act(() => root.unmount())
  })

  it('shows effect history when no pending effect', () => {
    const container = document.createElement('div')
    const root = createRoot(container)
    act(() => root.render(
      <EffectPanel
        pendingEffect={null}
        currentEffect={null}
        effectHistory={['發動了技能效果']}
        onConfirm={() => undefined}
        onSkip={() => undefined}
      />,
    ))

    expect(container.textContent).toContain('效果紀錄')
    expect(container.textContent).toContain('發動了技能效果')
    const backdrop = container.querySelector<HTMLElement>('.modal-backdrop')
    const history = container.querySelector<HTMLElement>('[role="status"]')
    expect(backdrop?.style.pointerEvents).toBe('none')
    expect(history).not.toBeNull()
    act(() => root.unmount())
  })

  it('embeds optional attack cost choices in the shared effect prompt', () => {
    const hand = createItemCard(10)
    const support = createSupportCard(11, 'blue')
    const target = createCookieCard(12)
    const container = document.createElement('div')
    const root = createRoot(container)
    act(() => root.render(
      <EffectPanel
        pendingEffect={null}
        currentEffect={null}
        effectHistory={[]}
        onConfirm={() => undefined}
        onSkip={() => undefined}
        optionalCostAttack={{
          sourceCard: createCookieCard(13),
          sourceCardName: 'Tiramisu Cookie',
          effectText: 'Pay to deal damage.',
          discardHandCost: 1,
          energyCostTotal: 1,
          playerHand: [hand],
          supportCandidates: [{ card: support, instanceId: support.instanceId }],
          targetCandidates: [{ card: target, instanceId: target.instanceId }],
          needsTarget: true,
          targetMin: 1,
          targetLabel: '對手餅乾',
          onSkip: () => undefined,
          onPay: () => undefined,
        }}
      />,
    ))

    expect(container.querySelectorAll('.modal-backdrop')).toHaveLength(1)
    expect(container.querySelector('.optional-cost-attack-inline')).not.toBeNull()
    expect(container.querySelector('.optional-cost-attack-modal')).toBeNull()
    expect(container.textContent).toContain('Tiramisu Cookie')
    expect(container.querySelector('.effect-source-card')).not.toBeNull()

    act(() => root.unmount())
  })

  it('minimizes and restores an embedded optional attack prompt', () => {
    const optionalCostAttack = {
      sourceCard: createCookieCard(13),
      sourceCardName: 'Tiramisu Cookie',
      effectText: 'Pay to deal damage.',
      discardHandCost: 0,
      energyCostTotal: 0,
      playerHand: [],
      supportCandidates: [],
      targetCandidates: [],
      needsTarget: false,
      targetMin: 0,
      targetLabel: '對手餅乾',
      onSkip: () => undefined,
      onPay: () => undefined,
    }
    const container = document.createElement('div')
    const root = createRoot(container)
    act(() => root.render(
      <EffectPanel
        pendingEffect={null}
        currentEffect={null}
        effectHistory={[]}
        onConfirm={() => undefined}
        onSkip={() => undefined}
        optionalCostAttack={optionalCostAttack}
      />,
    ))

    expect(container.querySelector('.minimize-reveal')).not.toBeNull()
    act(() => {
      container.querySelector<HTMLButtonElement>('.minimize-reveal')?.click()
    })
    expect(container.querySelector('.effect-panel-dock')).not.toBeNull()
    expect(container.querySelector('.optional-cost-attack-inline')).toBeNull()

    act(() => {
      container.querySelector<HTMLButtonElement>('.effect-panel-dock')?.click()
    })
    expect(container.querySelector('.optional-cost-attack-inline')).not.toBeNull()

    act(() => root.unmount())
  })

  it('allows skipping an attack follow-up effect', () => {
    const pending = createPendingEffect({
      skillActivated: true,
      sourceKind: 'attack',
    })
    const container = document.createElement('div')
    const root = createRoot(container)
    act(() => root.render(
      <EffectPanel
        pendingEffect={pending}
        currentEffect={{
          kind: 'optional-cost-attack',
          cost: { energy: {}, discardHand: 0 },
          effects: [],
          effectText: 'Optional attack effect.',
        }}
        effectHistory={[]}
        onConfirm={() => undefined}
        onSkip={() => undefined}
      />,
    ))

    expect(
      container
        .querySelector('.effect-panel-sticky-actions')
        ?.classList.contains('is-confirm-only'),
    ).toBe(false)
    expect(container.querySelector('.effect-skip-label')?.textContent).toBe('略過')

    act(() => root.unmount())
  })

  it('guides payment, extra cost, and target one step at a time with back navigation', async () => {
    const paymentCard = createSupportCard(1, 'red')
    const costSupport = createItemCard(2)
    const target = createCookieCard(3)
    const pending = createPendingEffect({
      selectedPaymentIds: [],
      skill: {
        trigger: 'activate',
        oncePerTurn: false,
        yourTurn: false,
        restSource: false,
        cost: { energy: { red: 1 }, discardHand: 0 },
        text: 'Test skill',
        effects: [],
      },
    })

    const container = document.createElement('div')
    const root = createRoot(container)
    act(() => root.render(
      <EffectPanel
        pendingEffect={pending}
        currentEffect={{
          kind: 'damage',
          amount: 1,
          target: { side: 'opponent', min: 1, max: 1 },
        }}
        effectHistory={[]}
        onConfirm={() => undefined}
        onSkip={() => undefined}
        paymentCandidates={[paymentCard]}
        selectedPaymentIds={new Set<string>()}
        onTogglePayment={() => undefined}
        costSupportCandidates={[costSupport]}
        selectedCostSupportIds={new Set<string>()}
        onToggleCostSupport={() => undefined}
        candidateCards={[target]}
        onToggleCandidate={() => undefined}
        energyPaymentValid={true}
      />,
    ))

    expect(container.querySelectorAll('.phase-step')).toHaveLength(3)
    expect(container.textContent).toContain('能量支付')
    expect(container.querySelector('.effect-candidates-choice')).toBeNull()
    expect(container.querySelector('.effect-panel-extra-cost-col')).toBeNull()
    expect(container.querySelector('.effect-panel-target-col')).toBeNull()

    await act(() => {
      container.querySelector<HTMLButtonElement>('.effect-panel-primary-action')!.click()
    })
    expect(container.textContent).toContain('額外代價')
    expect(container.querySelector('.effect-panel-payment-col')).toBeNull()

    await act(() => {
      container.querySelector<HTMLButtonElement>('.effect-panel-primary-action')!.click()
    })
    expect(container.textContent).toContain('目標')
    expect(container.querySelector('.effect-panel-extra-cost-col')).toBeNull()

    await act(() => {
      container.querySelector<HTMLButtonElement>('.effect-panel-back-action')!.click()
    })
    expect(container.textContent).toContain('額外代價')

    await act(() => root.unmount())
  })

  it('stages every choose-one effect after payment and before its selected follow-up', async () => {
    const paymentCard = createSupportCard(4, 'red')
    const target = createCookieCard(5)
    const damageEffect: CardEffect = {
      kind: 'damage',
      amount: 1,
      target: { side: 'opponent', min: 1, max: 1 },
    }
    const chooseOneEffect: CardEffect = {
      kind: 'choose-one',
      modes: [
        {
          label: 'Draw 1 card',
          effects: [{ kind: 'draw', amount: 1 }],
        },
        {
          label: 'Deal 1 damage',
          effects: [damageEffect],
        },
      ],
    }
    const pending = createPendingEffect({
      effects: [chooseOneEffect],
      skill: {
        trigger: 'activate',
        oncePerTurn: false,
        yourTurn: false,
        restSource: false,
        cost: { energy: { red: 1 }, discardHand: 0 },
        text: 'Select 1 of the following.',
        effects: [chooseOneEffect],
      },
    })
    const onChooseMode = vi.fn()
    const onConfirm = vi.fn()
    let energyPaymentValid = false
    let currentPending = pending
    let currentEffect: CardEffect = chooseOneEffect
    const container = document.createElement('div')
    const root = createRoot(container)
    const renderPanel = async () => {
      await act(() => root.render(
        <EffectPanel
          pendingEffect={currentPending}
          currentEffect={currentEffect}
          effectHistory={[]}
          onConfirm={onConfirm}
          onSkip={() => undefined}
          onChooseMode={onChooseMode}
          paymentCandidates={[paymentCard]}
          selectedPaymentIds={new Set([paymentCard.instanceId])}
          onTogglePayment={() => undefined}
          energyPaymentValid={energyPaymentValid}
          candidateCards={[target]}
          onToggleCandidate={() => undefined}
        />,
      ))
    }

    await renderPanel()
    expect(container.querySelectorAll('.phase-step')).toHaveLength(2)
    expect(container.querySelector('.effect-panel-payment-col')).not.toBeNull()
    expect(container.querySelector('.effect-panel-choice-col')).toBeNull()
    expect(
      container.querySelector<HTMLButtonElement>('.effect-panel-primary-action')
        ?.disabled,
    ).toBe(true)

    energyPaymentValid = true
    await renderPanel()
    await act(() => {
      container.querySelector<HTMLButtonElement>('.effect-panel-primary-action')!.click()
    })
    expect(container.querySelector('.effect-panel-payment-col')).toBeNull()
    expect(container.querySelector('.effect-panel-choice-col')).not.toBeNull()
    expect(container.querySelectorAll('.effect-candidates-choice button')).toHaveLength(2)
    expect(onChooseMode).not.toHaveBeenCalled()
    expect(
      container.querySelector<HTMLButtonElement>('.effect-panel-primary-action')
        ?.disabled,
    ).toBe(true)

    await act(() => {
      container.querySelectorAll<HTMLButtonElement>('.effect-candidates-choice button')[1].click()
    })
    expect(onChooseMode).not.toHaveBeenCalled()
    expect(
      container.querySelector<HTMLButtonElement>('.effect-panel-primary-action')
        ?.disabled,
    ).toBe(false)

    await act(() => {
      container.querySelector<HTMLButtonElement>('.effect-panel-primary-action')!.click()
    })
    expect(onChooseMode).toHaveBeenCalledWith(1)

    currentPending = {
      ...pending,
      chooseOneModes: [1],
      selectedTargetIds: [],
    }
    currentEffect = damageEffect
    await renderPanel()
    expect(container.querySelector('.effect-panel-payment-col')).toBeNull()
    expect(container.querySelector('.effect-panel-choice-col')).toBeNull()
    expect(container.querySelector('.effect-panel-target-col')).not.toBeNull()
    expect(
      container.querySelector<HTMLButtonElement>('.effect-panel-primary-action')
        ?.disabled,
    ).toBe(true)

    currentPending = { ...currentPending, selectedTargetIds: [target.instanceId] }
    await renderPanel()
    await act(() => {
      container.querySelector<HTMLButtonElement>('.effect-panel-primary-action')!.click()
    })
    expect(onConfirm).toHaveBeenCalledTimes(1)

    await act(() => root.unmount())
  })

  it('skips target selection when a selected effect condition is unmet', async () => {
    const pending = createPendingEffect({
      skill: {
        trigger: 'activate',
        oncePerTurn: false,
        yourTurn: false,
        restSource: false,
        cost: { energy: {}, discardHand: 0 },
        text: 'Conditional damage',
        effects: [],
      },
    })
    const onConfirm = vi.fn()
    const container = document.createElement('div')
    const root = createRoot(container)
    await act(() => root.render(
      <EffectPanel
        pendingEffect={pending}
        currentEffect={{
          kind: 'damage',
          amount: 1,
          target: { side: 'opponent', min: 0, max: 1 },
          condition: { kind: 'opponent-battle-area-has-no-blocker' },
        }}
        effectHistory={[]}
        onConfirm={onConfirm}
        onSkip={() => undefined}
        effectConditionMet={false}
      />,
    ))

    expect(container.querySelector('.effect-panel-target-col')).toBeNull()
    expect(container.querySelector('.effect-resolution-summary')?.textContent).toContain(
      '目前條件不成立',
    )
    const confirmButton = container.querySelector<HTMLButtonElement>(
      '.effect-panel-primary-action',
    )
    expect(confirmButton?.disabled).toBe(false)

    await act(() => confirmButton!.click())
    expect(onConfirm).toHaveBeenCalledTimes(1)

    await act(() => root.unmount())
  })

  it('renders energy payment candidates inside the panel', () => {
    const paymentCard = createSupportCard(1, 'red')
    const pending = createPendingEffect({
      selectedPaymentIds: [],
      skill: {
        trigger: 'activate',
        oncePerTurn: false,
        yourTurn: false,
        restSource: false,
        cost: { energy: { red: 1 }, discardHand: 0 },
        text: 'Test skill',
        effects: [],
      },
    })

    const container = document.createElement('div')
    const root = createRoot(container)
    act(() => root.render(
      <EffectPanel
        pendingEffect={pending}
        currentEffect={{
          kind: 'damage',
          amount: 1,
          target: { side: 'opponent', min: 0, max: 1 },
        }}
        effectHistory={[]}
        onConfirm={() => undefined}
        onSkip={() => undefined}
        paymentCandidates={[paymentCard]}
        selectedPaymentIds={new Set<string>()}
        onTogglePayment={() => undefined}
        energyPaymentValid={false}
      />,
    ))

    expect(container.textContent).toContain('能量支付')
    expect(container.textContent).toContain('支援卡 1')

    act(() => root.unmount())
  })

  it('toggles payment candidate from panel', () => {
    const paymentCard = createSupportCard(1, 'red')
    const pending = createPendingEffect({
      selectedPaymentIds: [],
      skill: {
        trigger: 'activate',
        oncePerTurn: false,
        yourTurn: false,
        restSource: false,
        cost: { energy: { red: 1 }, discardHand: 0 },
        text: 'Test skill',
        effects: [],
      },
    })

    const onTogglePayment = vi.fn()
    const container = document.createElement('div')
    const root = createRoot(container)
    act(() => root.render(
      <EffectPanel
        pendingEffect={pending}
        currentEffect={{
          kind: 'damage',
          amount: 1,
          target: { side: 'opponent', min: 0, max: 1 },
        }}
        effectHistory={[]}
        onConfirm={() => undefined}
        onSkip={() => undefined}
        paymentCandidates={[paymentCard]}
        selectedPaymentIds={new Set<string>()}
        onTogglePayment={onTogglePayment}
        energyPaymentValid={false}
      />,
    ))

    const paymentButtons = container.querySelectorAll('.effect-candidates-payment button')
    expect(paymentButtons.length).toBe(1)
    ;(paymentButtons[0] as HTMLButtonElement).click()
    expect(onTogglePayment).toHaveBeenCalledWith(paymentCard.instanceId)

    act(() => root.unmount())
  })

  it('marks selected payment candidate', () => {
    const paymentCard = createSupportCard(1, 'red')
    const pending = createPendingEffect({
      selectedPaymentIds: [],
      skill: {
        trigger: 'activate',
        oncePerTurn: false,
        yourTurn: false,
        restSource: false,
        cost: { energy: { red: 1 }, discardHand: 0 },
        text: 'Test skill',
        effects: [],
      },
    })

    const selectedIds = new Set([paymentCard.instanceId])
    const container = document.createElement('div')
    const root = createRoot(container)
    act(() => root.render(
      <EffectPanel
        pendingEffect={pending}
        currentEffect={{
          kind: 'damage',
          amount: 1,
          target: { side: 'opponent', min: 0, max: 1 },
        }}
        effectHistory={[]}
        onConfirm={() => undefined}
        onSkip={() => undefined}
        paymentCandidates={[paymentCard]}
        selectedPaymentIds={selectedIds}
        onTogglePayment={() => undefined}
        energyPaymentValid={false}
      />,
    ))

    const paymentBtn = container.querySelector('.effect-candidates-payment button') as HTMLButtonElement
    expect(paymentBtn).not.toBeNull()
    expect(paymentBtn.classList.contains('is-selected')).toBe(true)

    act(() => root.unmount())
  })

  it('renders sticky action bar with confirm and skip buttons', async () => {
    const target = createCookieCard(1)
    const pending = createPendingEffect({
      optional: true,
      selectedPaymentIds: [],
    })

    const onConfirm = vi.fn()
    const onSkip = vi.fn()
    const container = document.createElement('div')
    const root = createRoot(container)
    await act(() => root.render(
      <EffectPanel
        pendingEffect={pending}
        currentEffect={{
          kind: 'damage',
          amount: 1,
          target: { side: 'opponent', min: 0, max: 1 },
        }}
        effectHistory={[]}
        onConfirm={onConfirm}
        onSkip={onSkip}
        candidateCards={[target]}
        onToggleCandidate={() => undefined}
        energyPaymentValid={true}
      />,
    ))

    const stickyActions = container.querySelector('.effect-panel-sticky-actions')
    expect(stickyActions).not.toBeNull()

    const confirmBtn = stickyActions!.querySelector('.effect-panel-primary-action') as HTMLButtonElement
    expect(confirmBtn).toBeDefined()
    expect(confirmBtn.textContent).toContain('確認發動')

    const skipBtn = stickyActions!.querySelector('.skip-effect') as HTMLButtonElement
    expect(skipBtn).toBeDefined()
    expect(skipBtn.textContent).toContain('不發動')

    await act(() => root.unmount())
  })

  it('disables confirm button when cost is not ready', async () => {
    const pending = createPendingEffect({
      selectedPaymentIds: [],
      skill: {
        trigger: 'activate',
        oncePerTurn: false,
        yourTurn: false,
        restSource: false,
        cost: { energy: { red: 1 }, discardHand: 0 },
        text: 'Test skill',
        effects: [],
      },
    })

    const container = document.createElement('div')
    const root = createRoot(container)
    await act(() => root.render(
      <EffectPanel
        pendingEffect={pending}
        currentEffect={{
          kind: 'damage',
          amount: 1,
          target: { side: 'opponent', min: 0, max: 1 },
        }}
        effectHistory={[]}
        onConfirm={() => undefined}
        onSkip={() => undefined}
        energyPaymentValid={false}
      />,
    ))

    const stickyActions = container.querySelector('.effect-panel-sticky-actions')
    const confirmBtn = stickyActions!.querySelector('.effect-panel-primary-action') as HTMLButtonElement
    expect(confirmBtn.disabled).toBe(true)

    await act(() => root.unmount())
  })

  it('allows BS2-069 cost confirmation before the server opens target selection', async () => {
    const discardedCard = createItemCard(9)
    const pending = createPendingEffect({
      selectedDiscardHandIds: [discardedCard.instanceId],
      skill: {
        trigger: 'on-play',
        oncePerTurn: false,
        yourTurn: false,
        restSource: false,
        cost: { energy: {}, discardHand: 1 },
        text: 'Discard 1 card. Trash up to 1 opposing LV.1 Cookie.',
        effects: [{ kind: 'opponent-battle-to-trash', maxLevel: 1 }],
      },
    })
    const container = document.createElement('div')
    const root = createRoot(container)

    await act(() => root.render(
      <EffectPanel
        pendingEffect={pending}
        currentEffect={{ kind: 'opponent-battle-to-trash', maxLevel: 1 }}
        effectHistory={[]}
        onConfirm={() => undefined}
        onSkip={() => undefined}
        discardHandCandidates={[discardedCard]}
        selectedDiscardHandIds={new Set([discardedCard.instanceId])}
        discardHandCost={1}
        energyPaymentValid={true}
        showTargetSelection={false}
      />,
    ))

    expect(container.querySelector('.effect-panel-target-col')).toBeNull()
    const confirmButton = container.querySelector(
      '.effect-panel-primary-action',
    ) as HTMLButtonElement
    expect(confirmButton.disabled).toBe(false)

    await act(() => root.unmount())
  })

  it('shows and requires a battle Cookie sacrifice cost', async () => {
    const battleCookie = createCookieCard(7)
    const pending = createPendingEffect({
      skill: {
        trigger: 'activate',
        oncePerTurn: false,
        yourTurn: true,
        restSource: false,
        cost: {
          energy: {},
          trashBattleCookie: { count: 1, level: 1, energyColor: 'purple' },
        },
        text: 'Trash a battle Cookie as a cost.',
        effects: [],
      },
    })
    const onToggle = vi.fn()
    const container = document.createElement('div')
    const root = createRoot(container)
    await act(() => root.render(
      <EffectPanel
        pendingEffect={pending}
        currentEffect={{ kind: 'draw', amount: 1 }}
        effectHistory={[]}
        onConfirm={() => undefined}
        onSkip={() => undefined}
        trashBattleCookieCandidates={[battleCookie]}
        selectedTrashBattleCookieIds={new Set()}
        onToggleTrashBattleCookie={onToggle}
        trashBattleCookieCost={1}
      />,
    ))

    expect(container.textContent).toContain('戰鬥區餅乾代價')
    const confirmButton = container.querySelector(
      '.effect-panel-primary-action',
    ) as HTMLButtonElement
    expect(confirmButton.disabled).toBe(true)

    const candidateButton = container.querySelector(
      '.effect-candidates-trash-battle button',
    ) as HTMLButtonElement
    await act(() => candidateButton.click())
    expect(onToggle).toHaveBeenCalledWith(battleCookie.instanceId)

    await act(() => root.unmount())
  })
})
