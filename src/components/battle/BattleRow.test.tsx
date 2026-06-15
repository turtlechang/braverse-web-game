import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import {
  createItemUsageDemoState,
  createStageUsageDemoState,
} from '../../game/demo'
import { BattleRow, type BattleRowProps } from './BattleRow'

const createProps = (
  overrides: Record<string, unknown> = {},
): BattleRowProps => {
  const game = createItemUsageDemoState(true)

  return {
    game,
    playerId: 'player-one',
    position: 'bottom',
    selectedAttackerId: null,
    effectTargetIds: new Set(),
    breakEffectTargetIds: new Set(),
    selectedEffectTargetIds: new Set(),
    selectedSkillPaymentIds: new Set(),
    skillPaymentTargetIds: new Set(),
    selectedAttackPaymentIds: new Set(),
    attackPaymentValid: false,
    interactionLocked: false,
    onPlaceSupport: () => undefined,
    onDeployCookie: () => undefined,
    onPlayItem: () => undefined,
    onPlayStage: () => undefined,
    onInspectCard: () => undefined,
    onInspectDiscard: () => undefined,
    ...overrides,
  } as BattleRowProps
}

describe('BattleRow desktop interactions', () => {
  it('keeps legal hand actions hidden until the card is selected', () => {
    const markup = renderToStaticMarkup(
      <BattleRow {...createProps()} />,
    )

    expect(markup).not.toContain('hand-card-actions')
    expect(markup).not.toContain('>使用<')
  })

  it('shows one contextual hand action for the selected card', () => {
    const game = createItemUsageDemoState(true)
    const selectedCardId = game.players['player-one'].hand[0].instanceId
    const markup = renderToStaticMarkup(
      <BattleRow
        {...createProps({
          game,
          selectedHandCardId: selectedCardId,
          onSelectHandCard: () => undefined,
        })}
      />,
    )

    expect(markup).toContain('hand-card-wrap is-selected')
    expect(markup).toContain('hand-card-actions')
    expect(markup).toContain('>使用<')
    expect(markup).toContain('>詳情<')
  })

  it('renders compact resource summaries and an anchored resource popover', () => {
    const markup = renderToStaticMarkup(
      <BattleRow
        {...createProps({
          openResourceKind: 'deck',
          onToggleResource: () => undefined,
        })}
      />,
    )

    expect(markup).toContain('resource-summary')
    expect(markup).toContain('resource-popover')
    expect(markup).toContain('牌庫剩餘')
  })

  it('does not offer an item action when the payment is unavailable', () => {
    const game = {
      ...createItemUsageDemoState(false),
      phase: 'main' as const,
    }
    const selectedCardId = game.players['player-one'].hand[0].instanceId
    const markup = renderToStaticMarkup(
      <BattleRow
        {...createProps({
          game,
          selectedHandCardId: selectedCardId,
          onSelectHandCard: () => undefined,
        })}
      />,
    )

    expect(markup).not.toContain('hand-card-actions')
    expect(markup).not.toContain('>使用<')
  })

  it('does not offer a stage action when the placement payment is unavailable', () => {
    const payableState = createStageUsageDemoState(true)
    const game = {
      ...payableState,
      players: {
        ...payableState.players,
        'player-one': {
          ...payableState.players['player-one'],
          supportArea: [],
        },
      },
    }
    const selectedCardId = game.players['player-one'].hand[0].instanceId
    const markup = renderToStaticMarkup(
      <BattleRow
        {...createProps({
          game,
          selectedHandCardId: selectedCardId,
          onSelectHandCard: () => undefined,
        })}
      />,
    )

    expect(markup).not.toContain('hand-card-actions')
    expect(markup).not.toContain('>放置<')
  })

  it('marks support cards as selectable for a support-to-trash skill cost', () => {
    const game = createItemUsageDemoState(true)
    const supportId =
      game.players['player-one'].supportArea[0].card.instanceId
    const markup = renderToStaticMarkup(
      <BattleRow
        {...createProps({
          game,
          skillCostSupportTargetIds: new Set([supportId]),
          selectedSkillCostSupportIds: new Set([supportId]),
          onSkillCostSupport: () => undefined,
        })}
      />,
    )

    expect(markup).toContain('support-card is-selected is-targetable')
    expect(markup).toContain('aria-label="選擇')
  })

  it('distinguishes energy payment from support-to-trash targets', () => {
    const baseGame = createItemUsageDemoState(true)
    const firstSupport =
      baseGame.players['player-one'].supportArea[0]
    const secondSupport = {
      ...firstSupport,
      card: {
        ...firstSupport.card,
        instanceId: `${firstSupport.card.instanceId}-cost`,
        name: '技能代價支援卡',
      },
    }
    const game = {
      ...baseGame,
      players: {
        ...baseGame.players,
        'player-one': {
          ...baseGame.players['player-one'],
          supportArea: [firstSupport, secondSupport],
        },
      },
    }
    const markup = renderToStaticMarkup(
      <BattleRow
        {...createProps({
          game,
          interactionLocked: true,
          skillPaymentTargetIds: new Set([
            firstSupport.card.instanceId,
          ]),
          skillCostSupportTargetIds: new Set([
            secondSupport.card.instanceId,
          ]),
          onSkillPayment: () => undefined,
          onSkillCostSupport: () => undefined,
        })}
      />,
    )

    expect(markup).toContain('支付技能能量')
    expect(markup).toContain('作為技能代價')
  })
})
