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

describe('BS6-039 compound target UI', () => {
  it('requires the break-area target first, then permits skipping the battle-area target', async () => {
    const effect: CardEffect = {
      kind: 'opponent-break-to-trash-then-battle-to-break',
    }
    const candidate = createCookieCard(98)
    const pending = createPendingEffect({ effects: [effect] })
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)

    await act(() =>
      root.render(
        <EffectPanel
          pendingEffect={pending}
          currentEffect={effect}
          effectHistory={[]}
          onConfirm={() => undefined}
          onSkip={() => undefined}
          candidateCards={[candidate]}
          onToggleCandidate={() => undefined}
        />,
      ),
    )
    const initialConfirm = container.querySelector(
      '.effect-panel-primary-action',
    ) as HTMLButtonElement
    expect(initialConfirm.disabled).toBe(true)

    await act(() =>
      root.render(
        <EffectPanel
          pendingEffect={{ ...pending, compoundEffectStep: 'follow-up' }}
          currentEffect={effect}
          effectHistory={[]}
          onConfirm={() => undefined}
          onSkip={() => undefined}
          candidateCards={[candidate]}
          onToggleCandidate={() => undefined}
        />,
      ),
    )
    const followUpConfirm = container.querySelector(
      '.effect-panel-primary-action',
    ) as HTMLButtonElement
    expect(followUpConfirm.disabled).toBe(false)

    await act(() => root.unmount())
    container.remove()
  })
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
  selectedHpToTrashTargetIds: [],
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

  it('renders ordinary attack text and its follow-up text as separate descriptions', () => {
    const pending = createPendingEffect({
      sourceKind: 'attack',
      skill: {
        trigger: 'activate',
        oncePerTurn: false,
        yourTurn: true,
        restSource: false,
        cost: { energy: {}, discardHand: 0 },
        text: 'Diamond Formation! Damage 4 Then, Draw 1 card from your deck.',
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
          amount: 4,
          target: { side: 'opponent', min: 0, max: 1 },
        }}
        effectHistory={[]}
        onConfirm={() => undefined}
        onSkip={() => undefined}
      />,
    ))

    const descriptions = Array.from(
      container.querySelectorAll<HTMLParagraphElement>('.effect-source-description'),
    )
    expect(descriptions).toHaveLength(2)
    expect(descriptions[0].classList.contains('effect-source-attack-text')).toBe(true)
    expect(descriptions[0].textContent).toContain('Diamond Formation!')
    expect(descriptions[0].textContent).not.toContain('Then')
    expect(descriptions[1].classList.contains('effect-source-attack-follow-up')).toBe(true)
    expect(descriptions[1].textContent).toContain('Then')
    expect(descriptions[1].textContent).toContain('Draw 1 card from your deck.')

    act(() => root.unmount())
  })

  it('shows the HP card revealed by a deferred skill cost before target selection', () => {
    const revealedHpCard = createItemCard(17)
    const pending = createPendingEffect({
      skillActivated: true,
      revealedHpCard,
      skill: {
        trigger: 'activate',
        oncePerTurn: true,
        yourTurn: true,
        restSource: false,
        cost: { energy: {}, hpToTrash: { sourceOnly: true } },
        text: 'Place the top HP card into the trash, then deal damage.',
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
        candidateCards={[createCookieCard(18)]}
      />,
    ))

    expect(container.querySelector('.effect-cost-resolution')).not.toBeNull()
    expect(container.textContent).toContain('HP 費用已支付，丟棄的卡片')
    expect(container.textContent).toContain(revealedHpCard.name)
    expect(container.textContent).toContain('卡片種類：物品')

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

  it('shows the opponent trash target for BS3-028 OnPlay', () => {
    const target = {
      ...createCookieCard(14),
      id: 'trash-lv1-cookie',
      name: 'LV1 Trash Cookie',
      level: 1,
    }
    const effect: CardEffect = {
      kind: 'opponent-trash-to-break',
      max: 1,
      exactLevel: 1,
      condition: { kind: 'opponent-break-level-at-most', level: 6 },
    }
    const pending = createPendingEffect({
      sourceCard: {
        ...createCookieCard(15),
        id: 'BS3-028',
        name: 'Mozzarella Cookie',
      },
      skill: {
        trigger: 'on-play',
        oncePerTurn: false,
        yourTurn: false,
        restSource: false,
        cost: { energy: { yellow: 1 }, discardHand: 1 },
        text: 'Select up to 1 LV.1 Cookie from your opponent\'s trash.',
        effects: [effect],
      },
      trigger: 'on-play',
      triggerLabel: 'OnPlay 登場觸發',
      effects: [effect],
      skillActivated: true,
    })
    const onToggleCandidate = vi.fn()
    const container = document.createElement('div')
    const root = createRoot(container)
    act(() => root.render(
      <EffectPanel
        pendingEffect={pending}
        currentEffect={effect}
        effectHistory={[]}
        onConfirm={() => undefined}
        onSkip={() => undefined}
        candidateCards={[target]}
        onToggleCandidate={onToggleCandidate}
      />,
    ))

    expect(container.querySelector('.effect-panel-target-col')).not.toBeNull()
    expect(container.querySelectorAll('.effect-candidates-target button')).toHaveLength(1)

    act(() => {
      container.querySelector<HTMLButtonElement>('.effect-candidates-target button')!.click()
    })
    expect(onToggleCandidate).toHaveBeenCalledWith(target.instanceId)

    act(() => root.unmount())
  })

  it('makes BS4-089 mandatory deck mill and Then progress explicit', () => {
    const millEffect: CardEffect = {
      kind: 'deck-to-trash',
      amount: 5,
      side: 'opponent',
    }
    const thenEffect: CardEffect = {
      kind: 'opponent-battle-to-trash',
      min: 0,
      condition: { kind: 'opponent-battle-area-cookie-count', count: 2 },
    }
    const pending = createPendingEffect({
      sourceCard: {
        ...createCookieCard(16),
        id: 'BS4-089',
        name: 'Moonlight Cookie',
      },
      skill: {
        trigger: 'on-play',
        oncePerTurn: false,
        yourTurn: false,
        restSource: false,
        cost: { energy: {} },
        text: 'Place 5 cards from the top of your opponent\'s deck in the trash.',
        effects: [millEffect, thenEffect],
      },
      trigger: 'on-play',
      effects: [millEffect, thenEffect],
      effectIndex: 0,
      optional: true,
    })
    const container = document.createElement('div')
    const root = createRoot(container)
    act(() => root.render(
      <EffectPanel
        pendingEffect={pending}
        currentEffect={millEffect}
        effectHistory={[]}
        onConfirm={() => undefined}
        onSkip={() => undefined}
      />,
    ))

    expect(container.textContent).toContain('強制：將對手牌庫頂 5 張牌放入棄牌區。')
    expect(container.querySelector('.effect-sequence-status')?.textContent).toContain(
      '第 1 / 2 段',
    )
    expect(container.textContent).toContain(
      '第一段為強制效果；確認後才會進入 Then 的後續目標選擇。',
    )
    expect(container.querySelector('.effect-panel-primary-action')?.textContent).toContain(
      '確認並執行強制效果',
    )
    expect(container.querySelector('.effect-skip-label')?.textContent).toBe(
      '略過整個登場效果',
    )

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

  it('guides BS4-062 through energy payment, extra support rests, then opponent target', async () => {
    const supports = Array.from({ length: 8 }, (_, index) =>
      createSupportCard(index + 30, 'green'),
    )
    const target = createCookieCard(40)
    const effect: CardEffect = {
      kind: 'rest-support-and-damage',
      supportSide: 'self',
      supportAmount: 4,
      supportEnergyColor: 'green',
      activeOnly: true,
      target: { side: 'opponent', min: 0, max: 1 },
    }
    const pending = createPendingEffect({
      sourceCard: {
        ...createItemCard(41),
        id: 'BS4-062',
        name: 'Wind Gems',
      },
      sourceKind: 'item',
      selectedPaymentIds: [
        supports[0].instanceId,
        supports[1].instanceId,
      ],
      skill: {
        trigger: 'activate',
        oncePerTurn: false,
        yourTurn: true,
        restSource: false,
        cost: { energy: { green: 2 }, discardHand: 0 },
        text:
          'Set up to 4 green cards in your support area as rested. Then, select up to 1 opposing Cookie.',
        effects: [effect],
      },
      effects: [effect],
    })
    const onToggleCandidate = vi.fn()
    const container = document.createElement('div')
    const root = createRoot(container)

    await act(() => root.render(
      <EffectPanel
        pendingEffect={pending}
        currentEffect={effect}
        effectHistory={[]}
        onConfirm={() => undefined}
        onSkip={() => undefined}
        paymentCandidates={supports}
        selectedPaymentIds={new Set(pending.selectedPaymentIds)}
        onTogglePayment={() => undefined}
        energyPaymentValid={true}
        candidateCards={[...supports, target]}
        restSupportCandidates={supports.slice(2)}
        damageTargetCandidates={[target]}
        onToggleCandidate={onToggleCandidate}
      />,
    ))

    expect(
      Array.from(container.querySelectorAll('.phase-step')).map((step) =>
        step.textContent?.replace(/^\d+/, '').trim(),
      ),
    ).toEqual(['能量', '額外橫置', '目標'])

    await act(() => {
      container
        .querySelector<HTMLButtonElement>('.effect-panel-primary-action')!
        .click()
    })

    const supportStep = container.querySelector(
      '.effect-panel-rest-support-col',
    )
    expect(supportStep).not.toBeNull()
    expect(
      supportStep?.querySelectorAll('.effect-candidates-rest-support button'),
    ).toHaveLength(6)
    expect(supportStep?.textContent).not.toContain(supports[0].name)
    expect(supportStep?.textContent).not.toContain(supports[1].name)
    expect(supportStep?.textContent).not.toContain(target.name)

    await act(() => {
      supportStep
        ?.querySelector<HTMLButtonElement>(
          '.effect-candidates-rest-support button',
        )
        ?.click()
    })
    expect(onToggleCandidate).toHaveBeenCalledWith(supports[2].instanceId)

    await act(() => {
      container
        .querySelector<HTMLButtonElement>('.effect-panel-primary-action')!
        .click()
    })

    const targetStep = container.querySelector('.effect-panel-target-col')
    expect(targetStep).not.toBeNull()
    expect(
      targetStep?.querySelectorAll('.effect-candidates-target button'),
    ).toHaveLength(1)
    expect(targetStep?.textContent).toContain(target.name)
    expect(targetStep?.textContent).not.toContain(supports[2].name)

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

  // BS2-011「Select {Y} Cookies from your break area until their total LV.
  // sum reaches LV.3. Return those Cookies to your hand」轉換成
  // break-to-hand-by-level-sum。修正前這個 kind 完全沒被 selectionLimits／
  // selectedLevelSum／targetReady 涵蓋，導致：(a) 選卡時看不到等級總和
  // 進度提示，(b) 不管選了什麼（甚至 0 張）確認按鈕都會被判定為就緒，
  // 玩家點下去才會被後端 execute.ts 的 GameRuleError 彈回來。修正後行為
  // 應該跟已經正確處理的姊妹效果 hand-to-break-by-level-sum（BS3-047，
  // 方向相反：手牌→休息區）一致。
  it('BS2-011: shows level-sum progress and gates confirm on the exact target sum (break-to-hand-by-level-sum)', async () => {
    const breakCandidateLv1 = { ...createCookieCard(20), level: 1 }
    const breakCandidateLv2 = { ...createCookieCard(21), level: 2 }
    const effect: CardEffect = {
      kind: 'break-to-hand-by-level-sum',
      targetSum: 3,
      energyColor: 'yellow',
    }

    const renderWithSelection = async (selectedTargetIds: string[]) => {
      const pending = createPendingEffect({ selectedTargetIds })
      const container = document.createElement('div')
      const root = createRoot(container)
      await act(() => root.render(
        <EffectPanel
          pendingEffect={pending}
          currentEffect={effect}
          effectHistory={[]}
          onConfirm={() => undefined}
          onSkip={() => undefined}
          candidateCards={[breakCandidateLv1, breakCandidateLv2]}
          onToggleCandidate={() => undefined}
        />,
      ))
      return { container, root }
    }

    // 未選任何卡：進度提示顯示 0／3，確認按鈕必須是 disabled（修正前這裡
    // selectionLimits 是 null，targetReady 會直接短路成 true）。
    const empty = await renderWithSelection([])
    expect(empty.container.textContent).toContain('已選等級總和 0／3')
    expect(
      (empty.container.querySelector('.effect-panel-primary-action') as HTMLButtonElement)
        .disabled,
    ).toBe(true)
    await act(() => empty.root.unmount())

    // 只選 LV.1，總和 1，還沒到 3，確認按鈕仍須 disabled。
    const partial = await renderWithSelection([breakCandidateLv1.instanceId])
    expect(partial.container.textContent).toContain('已選等級總和 1／3')
    expect(
      (partial.container.querySelector('.effect-panel-primary-action') as HTMLButtonElement)
        .disabled,
    ).toBe(true)
    await act(() => partial.root.unmount())

    // LV.1 + LV.2 = 3，剛好等於 targetSum，確認按鈕才應該開放。
    const exact = await renderWithSelection([
      breakCandidateLv1.instanceId,
      breakCandidateLv2.instanceId,
    ])
    expect(exact.container.textContent).toContain('已選等級總和 3／3')
    expect(
      (exact.container.querySelector('.effect-panel-primary-action') as HTMLButtonElement)
        .disabled,
    ).toBe(false)
    await act(() => exact.root.unmount())
  })
})
