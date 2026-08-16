import { describe, expect, it } from 'vitest'
import type { CookieCard, GameCard } from '../../types'
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

  it('Lv.1/Lv.2 不啟用通用 pending 選擇器', () => {
    expect(createPendingSelectionStrategy(
      view(),
      createKnowledgeState('player-one'),
      2,
    ).enabled).toBe(false)
  })
})
