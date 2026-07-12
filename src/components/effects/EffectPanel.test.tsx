/// @vitest-environment jsdom

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { CookieCard, EnergyColor, GameCard } from '../../game'
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
    act(() => root.unmount())
  })

  it('uses wide interaction layout when payment, extra cost, and target are present', () => {
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
        energyPaymentValid={false}
      />,
    ))

    const grid = container.querySelector('.effect-panel-interaction-grid')
    expect(grid).not.toBeNull()
    expect(grid!.classList.contains('cols-3')).toBe(true)
    expect(container.textContent).toContain('能量支付')
    expect(container.textContent).toContain('額外代價')
    expect(container.textContent).toContain('目標')

    act(() => root.unmount())
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

    const confirmBtn = stickyActions!.querySelector('button:not(.skip-effect)') as HTMLButtonElement
    expect(confirmBtn).toBeDefined()
    expect(confirmBtn.textContent).toContain('確認效果')

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
    const confirmBtn = stickyActions!.querySelector('button:not(.skip-effect)') as HTMLButtonElement
    expect(confirmBtn.disabled).toBe(true)

    await act(() => root.unmount())
  })
})
