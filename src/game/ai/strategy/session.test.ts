import { describe, expect, it } from 'vitest'
import { createDemoGame } from '../../demo'
import { createPlayerView } from '../../player-view'
import {
  advanceAiStrategyMemory,
  createAiStrategyMemory,
  scoreIntentContinuity,
} from './session'
import type { ActionScoreBreakdown } from './action-score'
import type { TacticalPlan } from './tactical-plans'

const actionScore = (
  id: 'tactical-setup' | 'tactical-payoff',
): ActionScoreBreakdown => ({
  scoreType: 'relative-action-score',
  total: 1,
  calibrated: {
    terminalOutcome: 'none',
    legalAttackCountBefore: 0,
    legalAttackCountAfter: 0,
    activeSupportBefore: 0,
    activeSupportAfter: 0,
    knownDeckFactCount: 0,
    publicLethal: false,
  },
  contributions: [{ id, amount: 1, detail: 'fixture' }],
  unsupportedEffectKinds: [],
  unknownInformationPenalty: 0,
  tieBreakKey: 'fixture',
})

const comboPlan = (kind: 'setup' | 'payoff'): TacticalPlan => ({
  kind,
  status: 'confirmed',
  sourceCardId: `fixture-${kind}`,
  sharedTags: ['support'],
  relativeValue: 10,
  requiresKnownDeckFact: false,
  detail: 'fixture combo',
  comboPlanId: 'fixture-combo',
  setupCardId: 'fixture-setup',
  payoffCardId: 'fixture-payoff',
  validity: 'same-turn',
})

describe('AiStrategyMemory', () => {
  it('跨步保存公開知識與戰術意圖，但不改寫舊 snapshot', () => {
    const view = createPlayerView(createDemoGame(1), 'player-one')
    const initial = createAiStrategyMemory('player-one')
    const first = advanceAiStrategyMemory(initial, view, {
      chosenCommandKind: 'play-support',
      actionScore: actionScore('tactical-setup'),
    })
    const second = advanceAiStrategyMemory(first, view, {
      chosenCommandKind: 'advance-phase',
    })

    expect(initial.decisionCount).toBe(0)
    expect(first).not.toBe(initial)
    expect(second.decisionCount).toBe(2)
    expect(second.activeIntent).toBe('setup')
    expect(second.intentStreak).toBe(1)
    expect(second.knowledgeState.facts.length).toBeGreaterThan(0)
  })

  it('setup 意圖會優先獎勵下一個 payoff，且不影響合法性', () => {
    const memory = {
      ...createAiStrategyMemory('player-one'),
      activeIntent: 'setup' as const,
      intentStreak: 1,
    }
    expect(scoreIntentContinuity(memory, 'payoff')).toBeGreaterThan(
      scoreIntentContinuity(memory, 'setup'),
    )
    expect(scoreIntentContinuity(memory, 'tempo')).toBeLessThan(0)
  })

  it('只完成同一條 Combo，並記錄開始、完成與放棄生命週期', () => {
    const view = createPlayerView(createDemoGame(6), 'player-one')
    const started = advanceAiStrategyMemory(createAiStrategyMemory('player-one'), view, {
      chosenCommandKind: 'activate-skill',
      actionScore: actionScore('tactical-setup'),
      tacticalPlan: comboPlan('setup'),
    })
    expect(started.activeCombo?.planId).toBe('fixture-combo')
    expect(started.comboTelemetry).toEqual({ started: 1, completed: 0, abandoned: 0 })
    expect(scoreIntentContinuity(started, comboPlan('payoff'))).toBeGreaterThan(30)

    const completed = advanceAiStrategyMemory(started, view, {
      chosenCommandKind: 'activate-skill',
      actionScore: actionScore('tactical-payoff'),
      tacticalPlan: comboPlan('payoff'),
    })
    expect(completed.activeCombo).toBeUndefined()
    expect(completed.comboTelemetry).toEqual({ started: 1, completed: 1, abandoned: 0 })

    const restarted = advanceAiStrategyMemory(completed, view, {
      chosenCommandKind: 'activate-skill',
      actionScore: actionScore('tactical-setup'),
      tacticalPlan: comboPlan('setup'),
    })
    const abandoned = advanceAiStrategyMemory(restarted, view, {
      chosenCommandKind: 'advance-phase',
    })
    expect(abandoned.activeCombo).toBeUndefined()
    expect(abandoned.comboTelemetry.abandoned).toBe(1)
  })

  it('拒絕由不同 observer 的 PlayerView 污染記憶', () => {
    const view = createPlayerView(createDemoGame(2), 'player-two')
    expect(() => advanceAiStrategyMemory(
      createAiStrategyMemory('player-one'),
      view,
      { chosenCommandKind: 'idle' },
    )).toThrow(/相同 observer/)
  })
})
