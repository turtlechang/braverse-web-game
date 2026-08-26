import { describe, expect, it } from 'vitest'
import { createPlayerView, type PlayerView } from '../../player-view'
import type { GameCard } from '../../types'
import { createKnowledgeStateFromPlayerView } from './knowledge-state'
import { createLv3StrategyContext, deriveTacticalPlan } from './tactical-plans'
import { createBattleState, item } from '../../test-helpers/battle-helpers'

const withSupport = (view: PlayerView, instanceId: string): PlayerView => ({
  ...view,
  self: {
    ...view.self,
    supportArea: [...view.self.supportArea, { card: item(instanceId), rested: false }],
  },
})

describe('Lv.5 Combo payoff 前置', () => {
  it('只有 setup 真的跨過 payoff 的公開門檻時才開始 Combo', () => {
    const state = createBattleState()
    const setup: GameCard = {
      ...item('support-setup'),
      id: 'support-setup',
      item: {
        cost: { energy: {}, discardHand: 0 },
        text: 'fixture setup',
        effects: [{ kind: 'hand-to-support', amount: 1 }],
      },
    }
    const payoff: GameCard = {
      ...item('support-payoff'),
      id: 'support-payoff',
      item: {
        cost: { energy: {}, discardHand: 0 },
        text: 'fixture payoff',
        effects: [{
          kind: 'damage',
          amount: 2,
          target: { side: 'opponent', min: 1, max: 1 },
          condition: { kind: 'support-count-at-least', count: 3 },
        }],
      },
    }
    state.players['player-two'].hand = [setup, payoff]
    const before = createPlayerView(state, 'player-two')
    const context = createLv3StrategyContext(
      before,
      createKnowledgeStateFromPlayerView(before),
    )

    const oneShort = withSupport(before, 'second-support')
    expect(deriveTacticalPlan(
      context,
      before,
      setup.id,
      oneShort,
      'activate-item',
      { actionablePayoffSources: [{ cardId: payoff.id, actionKind: 'activate-item' }] },
    )).toMatchObject({ kind: 'setup', status: 'potential' })
    expect(deriveTacticalPlan(
      context,
      oneShort,
      payoff.id,
      oneShort,
      'activate-item',
      { actionablePayoffSources: [] },
    )).toMatchObject({ kind: 'payoff', status: 'potential' })

    const ready = withSupport(oneShort, 'third-support')
    expect(deriveTacticalPlan(
      context,
      oneShort,
      setup.id,
      ready,
      'activate-item',
      { actionablePayoffSources: [{ cardId: payoff.id, actionKind: 'activate-item' }] },
    )).toMatchObject({ kind: 'setup', status: 'confirmed' })
    expect(deriveTacticalPlan(
      context,
      ready,
      payoff.id,
      ready,
      'activate-item',
      { actionablePayoffSources: [] },
    )).toMatchObject({ kind: 'payoff', status: 'confirmed' })
  })

  it('同回合 payoff 不在可操作公開區域時，setup 不建立虛假的 Combo 意圖', () => {
    const state = createBattleState()
    const setup: GameCard = {
      ...item('trash-setup'),
      id: 'trash-setup',
      item: {
        cost: { energy: {}, discardHand: 0 },
        text: 'fixture setup',
        effects: [{ kind: 'hand-to-support', amount: 1 }],
      },
    }
    const payoff: GameCard = {
      ...item('trash-payoff'),
      id: 'trash-payoff',
      item: {
        cost: { energy: {}, discardHand: 0 },
        text: 'fixture payoff',
        effects: [{
          kind: 'damage',
          amount: 2,
          target: { side: 'opponent', min: 1, max: 1 },
          condition: { kind: 'support-count-at-least', count: 2 },
        }],
      },
    }
    state.players['player-two'].hand = [setup]
    state.players['player-two'].discardPile = [payoff]
    const before = createPlayerView(state, 'player-two')
    const context = createLv3StrategyContext(
      before,
      createKnowledgeStateFromPlayerView(before),
    )
    const conditionMet = withSupport(before, 'second-support')

    expect(deriveTacticalPlan(
      context,
      before,
      setup.id,
      conditionMet,
      'activate-item',
      { actionablePayoffSources: [] },
    )).toMatchObject({ kind: 'setup', status: 'potential' })

    const payoffAvailable: PlayerView = {
      ...conditionMet,
      hand: [...conditionMet.hand, payoff],
      self: {
        ...conditionMet.self,
        discardPile: [],
      },
    }
    expect(deriveTacticalPlan(
      context,
      before,
      setup.id,
      payoffAvailable,
      'activate-item',
      { actionablePayoffSources: [{ cardId: payoff.id, actionKind: 'activate-item' }] },
    )).toMatchObject({ kind: 'setup', status: 'confirmed' })
  })

  it('Lv.4/5 只在規則層列出的正確時機收益動作存在時才確認 setup', () => {
    const state = createBattleState()
    const setup: GameCard = {
      ...item('timing-setup'),
      id: 'timing-setup',
      item: {
        cost: { energy: {}, discardHand: 0 },
        text: 'fixture setup',
        effects: [{ kind: 'hand-to-support', amount: 1 }],
      },
    }
    const payoff: GameCard = {
      ...item('timing-payoff'),
      id: 'timing-payoff',
      item: {
        cost: { energy: {}, discardHand: 0 },
        text: 'fixture payoff',
        effects: [{
          kind: 'damage',
          amount: 2,
          target: { side: 'opponent', min: 1, max: 1 },
          condition: { kind: 'support-count-at-least', count: 2 },
        }],
      },
    }
    state.players['player-two'].hand = [setup, payoff]
    const before = createPlayerView(state, 'player-two')
    const ready = withSupport(before, 'second-support')
    const context = createLv3StrategyContext(
      before,
      createKnowledgeStateFromPlayerView(before),
    )

    expect(deriveTacticalPlan(
      context,
      before,
      setup.id,
      ready,
      'activate-item',
      { actionablePayoffSources: [{ cardId: payoff.id, actionKind: 'attack' }] },
    )).toMatchObject({ kind: 'setup', status: 'potential' })

    expect(deriveTacticalPlan(
      context,
      before,
      setup.id,
      ready,
      'activate-item',
      { actionablePayoffSources: [{ cardId: payoff.id, actionKind: 'activate-item' }] },
    )).toMatchObject({ kind: 'setup', status: 'confirmed' })

    expect(deriveTacticalPlan(
      context,
      ready,
      payoff.id,
      ready,
      'attack',
      { actionablePayoffSources: [] },
    )).toMatchObject({ kind: 'payoff', status: 'potential' })
    expect(deriveTacticalPlan(
      context,
      ready,
      payoff.id,
      ready,
      'activate-item',
      { actionablePayoffSources: [] },
    )).toMatchObject({ kind: 'payoff', status: 'confirmed' })
  })

  it('同一張 payoff 連到多條泛化邊時，優先完成已啟動的同一條 ComboPlan', () => {
    const state = createBattleState()
    const firstSetup: GameCard = {
      ...item('first-setup'),
      id: 'first-setup',
      item: {
        cost: { energy: {}, discardHand: 0 },
        text: 'first setup',
        effects: [{ kind: 'hand-to-support', amount: 1 }],
      },
    }
    const preferredSetup: GameCard = {
      ...item('preferred-setup'),
      id: 'preferred-setup',
      item: {
        cost: { energy: {}, discardHand: 0 },
        text: 'preferred setup',
        effects: [{ kind: 'hand-to-support', amount: 1 }],
      },
    }
    const payoff: GameCard = {
      ...item('shared-payoff'),
      id: 'shared-payoff',
      item: {
        cost: { energy: {}, discardHand: 0 },
        text: 'shared payoff',
        effects: [{
          kind: 'damage',
          amount: 2,
          target: { side: 'opponent', min: 1, max: 1 },
          condition: { kind: 'support-count-at-least', count: 2 },
        }],
      },
    }
    state.players['player-two'].hand = [firstSetup, preferredSetup, payoff]
    const before = createPlayerView(state, 'player-two')
    const ready = withSupport(before, 'second-support')
    const context = createLv3StrategyContext(
      before,
      createKnowledgeStateFromPlayerView(before),
    )
    const planId = context.comboPlans.find((plan) =>
      plan.setup.cardId === preferredSetup.id && plan.payoff.cardId === payoff.id,
    )?.id
    expect(planId).toBeDefined()

    expect(deriveTacticalPlan(
      context,
      ready,
      payoff.id,
      ready,
      'activate-item',
      {
        actionablePayoffSources: [],
        preferredComboPlanId: planId,
      },
    )).toMatchObject({
      kind: 'payoff',
      status: 'confirmed',
      comboPlanId: planId,
    })
  })
})
