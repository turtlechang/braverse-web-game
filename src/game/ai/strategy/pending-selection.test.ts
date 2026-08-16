import { describe, expect, it } from 'vitest'
import type { CardEffect, CookieCard, GameCard } from '../../types'
import type { PlayerView } from '../../player-view'
import { createKnowledgeState } from './knowledge-state'
import { createPendingSelectionStrategy } from './pending-selection'

const cookie = (
  instanceId: string,
  options: Partial<Pick<CookieCard, 'level' | 'hp' | 'attack'>> = {},
): CookieCard => ({
  id: `fixture-${instanceId}`,
  instanceId,
  name: 'same visible name',
  type: 'cookie',
  level: options.level ?? 1,
  hp: options.hp ?? 2,
  attack: options.attack ?? 1,
  attackCost: 0,
  attackEnergyCost: {},
})

const item = (instanceId: string): GameCard => ({
  id: `fixture-${instanceId}`,
  instanceId,
  name: 'same visible name',
  type: 'item',
})

const view = (): PlayerView => ({
  viewerId: 'player-one',
  hand: [item('low'), cookie('high', { level: 3, hp: 5, attack: 4 })],
  self: {
    id: 'player-one',
    name: 'player-one',
    handCount: 2,
    deckCount: 20,
    battleArea: [{ card: cookie('self', { level: 2, hp: 4, attack: 2 }), hpCount: 1, rested: false }],
    supportArea: [],
    breakArea: [],
    discardPile: [],
    stage: null,
  },
  opponent: {
    id: 'player-two',
    name: 'player-two',
    handCount: 5,
    deckCount: 20,
    battleArea: [
      { card: cookie('survivor', { level: 3, hp: 5, attack: 3 }), hpCount: 3, rested: false },
      { card: cookie('lethal', { level: 1, hp: 2, attack: 1 }), hpCount: 1, rested: false },
    ],
    supportArea: [],
    breakArea: [],
    discardPile: [],
    stage: null,
  },
  turnNumber: 5,
  phase: 'main',
  status: 'playing',
  activePlayerId: 'player-one',
  firstPlayerId: 'player-one',
  result: null,
  supportPlacedThisTurn: false,
  attackModifiers: [],
  damageReceivedModifiers: [],
})

describe('G5 pending selection strategy', () => {
  it('以結構化效果及公開 HP 優先選擇可擊倒的傷害目標', () => {
    const selection = createPendingSelectionStrategy(
      view(),
      createKnowledgeState('player-one'),
      3,
    )

    expect(selection.selectEffectTargetIds({
      kind: 'damage',
      amount: 1,
      target: { side: 'opponent', min: 1, max: 1 },
    }, ['survivor', 'lethal'], 1)).toEqual(['lethal'])
  })

  it('以公開 HP 決定全體傷害的結算順序，優先處理可擊倒的目標', () => {
    const selection = createPendingSelectionStrategy(
      view(),
      createKnowledgeState('player-one'),
      3,
    )

    expect(selection.selectEffectTargetIds({
      kind: 'damage-all',
      amount: 1,
      side: 'opponent',
      target: { side: 'opponent', min: 1, max: 2 },
    }, ['survivor', 'lethal'], 2)).toEqual(['lethal', 'survivor'])
  })

  it('只以本次合法揭露的檢視卡面挑選牌庫牌，不讀取其餘未知牌序', () => {
    const selection = createPendingSelectionStrategy(
      view(),
      createKnowledgeState('player-one'),
      3,
    )
    const revealedLow = item('revealed-low')
    const revealedHigh = cookie('revealed-high', { level: 3, hp: 5, attack: 4 })

    expect(selection.selectRevealedCardIds(
      [revealedLow, revealedHigh],
      ['revealed-low', 'revealed-high', 'not-revealed'],
      1,
    )).toEqual(['revealed-high'])
  })

  it('付款／棄牌保留較高的公開戰力，且同候選重跑穩定', () => {
    const selection = createPendingSelectionStrategy(
      view(),
      createKnowledgeState('player-one'),
      4,
    )

    expect(selection.orderCostIds(['high', 'low'], 1)).toEqual(['low'])
    expect(selection.orderCostIds(['high', 'low'], 1)).toEqual(
      selection.orderCostIds(['high', 'low'], 1),
    )
    expect(selection.orderPaymentIds(['high', 'low'])).toEqual(['low', 'high'])
  })

  it('將可行的 choose-one 模式依結構化收益排序，並對同時效果提供穩定順序', () => {
    const selection = createPendingSelectionStrategy(
      view(),
      createKnowledgeState('player-one'),
      4,
    )
    const chooseOne = {
      kind: 'choose-one' as const,
      modes: [
        { label: 'draw', effects: [{ kind: 'draw' as const, amount: 1 }] },
        {
          label: 'damage',
          effects: [{
            kind: 'damage' as const,
            amount: 1,
            target: { side: 'opponent' as const, min: 1, max: 1 },
          }],
        },
      ],
    }

    expect(selection.preferredModeIndices(chooseOne)).toEqual([1, 0])
    expect(selection.orderEffectIds([
      {
        id: 'draw',
        kind: 'draw-up-to',
        sourceInstanceId: 'high',
        sourcePlayerId: 'player-one',
        sourceCardName: 'high',
      },
      {
        id: 'faint',
        kind: 'faint-effect',
        sourceInstanceId: 'low',
        sourcePlayerId: 'player-one',
        sourceCardName: 'low',
      },
    ])).toEqual(['faint', 'draw'])
  })

  it('只在已確認的 setup/payoff 前提下，讓 TacticalPlan 改變 choose-one 的相對排序', () => {
    const plannedSource: CookieCard = {
      ...cookie('planned-source'),
      skill: {
        trigger: 'activate',
        oncePerTurn: false,
        yourTurn: true,
        restSource: false,
        cost: {},
        text: 'choose between immediate damage and a conditional payoff',
        effects: [{
          kind: 'choose-one',
          modes: [
            {
              label: 'immediate damage',
              effects: [{
                kind: 'damage',
                amount: 1,
                target: { side: 'opponent', min: 1, max: 1 },
              }],
            },
            {
              label: 'confirmed payoff',
              effects: [{
                kind: 'draw',
                amount: 1,
                condition: { kind: 'support-count-at-least', count: 1 },
              }],
            },
          ],
        }],
      },
    }
    const supportSetup: GameCard = {
      ...item('support-setup'),
      effects: [{ kind: 'hand-to-support', amount: 1 }],
    }
    const plannedView = view()
    plannedView.hand = [plannedSource]
    plannedView.self.handCount = 1
    plannedView.self.supportArea = [{ card: supportSetup, rested: false }]
    const selection = createPendingSelectionStrategy(
      plannedView,
      createKnowledgeState('player-one'),
      4,
    )
    const chooseOne = plannedSource.skill!.effects[0]
    if (chooseOne.kind !== 'choose-one') throw new Error('fixture must use choose-one')

    expect(selection.preferredModeIndices(chooseOne, plannedSource.instanceId))
      .toEqual([1, 0])
  })

  it('只依 PlayerView 評分：不存在於公開視角的 instance 保持中性穩定 fallback', () => {
    const selection = createPendingSelectionStrategy(
      view(),
      createKnowledgeState('player-one'),
      3,
    )

    expect(selection.orderCostIds(['hidden-b', 'hidden-a'], 2)).toEqual([
      'hidden-a',
      'hidden-b',
    ])
    expect(selection.telemetry('discard', 'hidden-a')).toMatchObject({
      usedUniversalSelection: true,
      publicViewOnly: true,
      planKind: 'tempo',
    })
  })

  it('將來源卡的未知結構化效果記入 pending telemetry，而非假裝已支援', () => {
    const unknownCard: GameCard = {
      ...item('unknown-source'),
      effects: [{ kind: 'fixture-unknown-effect' } as unknown as CardEffect],
    }
    const unknownView = view()
    unknownView.hand = [unknownCard]
    unknownView.self.handCount = 1
    const selection = createPendingSelectionStrategy(
      unknownView,
      createKnowledgeState('player-one'),
      4,
    )

    expect(selection.telemetry('flip', unknownCard.instanceId)).toMatchObject({
      sourceCardId: unknownCard.id,
      unsupportedEffectCount: 1,
      publicViewOnly: true,
    })
  })

  it('優先記錄實際 pending effect：即使來源卡不在公開視角也不漏報 unsupported', () => {
    const selection = createPendingSelectionStrategy(
      view(),
      createKnowledgeState('player-one'),
      4,
    )
    const unknownEffect = { kind: 'fixture-pending-unknown' } as unknown as CardEffect

    expect(selection.telemetry('multi-stage', 'hidden-source', unknownEffect))
      .toMatchObject({
        sourceCardId: undefined,
        unsupportedEffectCount: 1,
        publicViewOnly: true,
      })
  })

  it('Lv.1/Lv.2 不啟用通用 pending 選擇器', () => {
    expect(createPendingSelectionStrategy(
      view(),
      createKnowledgeState('player-one'),
      2,
    ).enabled).toBe(false)
  })
})
