/** @vitest-environment jsdom */

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it, vi } from 'vitest'
import { createBattleState } from '../../game/test-helpers/battle-helpers'
import type { GameCard } from '../../game'
import type { BattleRowProps } from './BattleRow'
import { BattleTable, type BattleTableProps } from './BattleTable'

;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

const battleRowProps = (
  overrides: Partial<BattleRowProps> & Pick<BattleRowProps, 'playerId' | 'position'>,
): BattleRowProps => {
  const game = createBattleState()
  return {
    game,
    selectedAttackerId: null,
    effectTargetIds: new Set(),
    breakEffectTargetIds: new Set(),
    selectedEffectTargetIds: new Set(),
    selectedSkillPaymentIds: new Set(),
    selectedAttackPaymentIds: new Set(),
    attackPaymentValid: true,
    interactionLocked: false,
    onInspectCard: vi.fn(),
    onInspectDiscard: vi.fn(),
    ...overrides,
  }
}

const baseProps = (
  overrides: Partial<BattleTableProps> = {},
): BattleTableProps => ({
  ariaLabel: 'Braverse 對戰桌',
  phaseRail: {
    phase: 'main',
    turnNumber: 1,
    isPlayerTurn: true,
    disabled: false,
    onAdvance: vi.fn(),
  },
  topBattleRow: battleRowProps({ playerId: 'player-two', position: 'top' }),
  bottomBattleRow: battleRowProps({ playerId: 'player-one', position: 'bottom' }),
  remoteActionBanner: { status: null, compact: true },
  attackPreviewArrow: { sourceInstanceId: null, targetInstanceIds: [] },
  previewCard: null,
  attackPaymentPanel: null,
  ...overrides,
})

const render = async (props: BattleTableProps) => {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  await act(() => root.render(<BattleTable {...props} />))
  const cleanup = async () => {
    await act(() => root.unmount())
    container.remove()
  }
  return { container, cleanup }
}

const previewCard: GameCard = {
  id: 'preview-card',
  instanceId: 'preview-card',
  name: 'Preview Cookie',
  type: 'item',
}

describe('BattleTable', () => {
  it('renders the phase rail and both battle rows with the given aria-label', async () => {
    const { container, cleanup } = await render(baseProps())

    expect(container.querySelector('.phase-rail')).not.toBeNull()
    expect(
      container.querySelector('.table-area')?.getAttribute('aria-label'),
    ).toBe('Braverse 對戰桌')
    expect(container.querySelector('.battle-row.top-field')).not.toBeNull()
    expect(container.querySelector('.battle-row.bottom-field')).not.toBeNull()

    await cleanup()
  })

  it('forwards phaseRail props so onAdvance fires from the next-phase button', async () => {
    const onAdvance = vi.fn()
    const { container, cleanup } = await render(
      baseProps({
        phaseRail: {
          phase: 'main',
          turnNumber: 3,
          isPlayerTurn: true,
          disabled: false,
          onAdvance,
        },
      }),
    )

    expect(container.querySelector('.turn-indicator')?.textContent).toContain(
      'TURN 3',
    )
    const button = container.querySelector<HTMLButtonElement>(
      '.next-phase-button',
    )
    await act(() => button!.click())
    expect(onAdvance).toHaveBeenCalledTimes(1)

    await cleanup()
  })

  it('renders the remote action banner when a status is given, inside the table divider', async () => {
    const { container, cleanup } = await render(
      baseProps({
        remoteActionBanner: {
          status: {
            mode: 'resolving',
            actorId: null,
            actorLabel: '',
            phaseLabel: '',
            headline: '效果結算中',
          },
          compact: true,
        },
      }),
    )

    expect(
      container.querySelector('.table-divider .remote-action-banner'),
    ).not.toBeNull()

    await cleanup()
  })

  it('renders the attack preview arrow inside the table area', async () => {
    const { container, cleanup } = await render(
      baseProps({
        attackPreviewArrow: {
          sourceInstanceId: 'attacker',
          targetInstanceIds: ['defender'],
          label: '攻擊宣告',
        },
      }),
    )

    expect(
      container.querySelector('[data-testid="attack-preview-arrow"]'),
    ).not.toBeNull()

    await cleanup()
  })

  it('omits the preview panel when no card is hovered or previewed', async () => {
    const { container, cleanup } = await render(baseProps())

    expect(container.querySelector('.card-preview-panel')).toBeNull()

    await cleanup()
  })

  it('shows the preview panel with its context label when provided', async () => {
    const { container, cleanup } = await render(
      baseProps({
        previewCard,
        previewContextLabel: '對手目前操作',
      }),
    )

    const panel = container.querySelector('.card-preview-panel')
    expect(panel).not.toBeNull()
    expect(panel?.classList.contains('is-empty')).toBe(false)
    expect(panel?.textContent).toContain('對手目前操作')
    expect(panel?.textContent).toContain('Preview Cookie')

    await cleanup()
  })

  it('omits the attack payment panel when null', async () => {
    const { container, cleanup } = await render(baseProps())

    expect(container.querySelector('.attack-payment-panel')).toBeNull()

    await cleanup()
  })

  it('renders the attack payment panel and forwards onCancel', async () => {
    const onCancel = vi.fn()
    const { container, cleanup } = await render(
      baseProps({
        attackPaymentPanel: {
          attackerName: 'Attacker Cookie',
          attackCost: { red: 1 },
          selectedPaymentCount: 0,
          isValid: false,
          validationReason: '尚未支付攻擊費用',
          onCancel,
        },
      }),
    )

    const panel = container.querySelector('.attack-payment-panel')
    expect(panel).not.toBeNull()
    expect(panel?.textContent).toContain('Attacker Cookie')

    const cancelButton = panel!.querySelector<HTMLButtonElement>('button')
    await act(() => cancelButton!.click())
    expect(onCancel).toHaveBeenCalledTimes(1)

    await cleanup()
  })

  it('omits the center card preview when not provided', async () => {
    const { container, cleanup } = await render(baseProps())

    expect(container.querySelector('.center-card-preview')).toBeNull()

    await cleanup()
  })

  it('shows the center card preview with card name, label, and effect text', async () => {
    const skillCard: GameCard = {
      id: 'skill-card',
      instanceId: 'skill-card',
      name: 'Opponent Skill Cookie',
      type: 'cookie',
      officialType: 'cookie',
      level: 1,
      hp: 3,
      attack: 2,
      attackCost: 1,
      attackEnergyCost: { red: 1 },
      skill: {
        trigger: 'activate',
        oncePerTurn: false,
        yourTurn: false,
        restSource: false,
        text: 'Deals bonus damage.',
        cost: {},
        effects: [],
      },
    }
    const { container, cleanup } = await render(
      baseProps({
        centerPreview: { card: skillCard, label: '對手發動技能' },
      }),
    )

    const preview = container.querySelector('.center-card-preview')
    expect(preview).not.toBeNull()
    expect(preview?.textContent).toContain('對手發動技能')
    expect(preview?.textContent).toContain('Opponent Skill Cookie')
    expect(preview?.textContent).toContain('Deals bonus damage.')

    await cleanup()
  })
})
