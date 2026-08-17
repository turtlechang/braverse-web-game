import { describe, expect, it } from 'vitest'
import { createPlayerView } from '../../player-view'
import type { PlayerActionCommand } from '../../commands'
import type { GameState } from '../../types'
import { createBattleState, item } from '../../test-helpers/battle-helpers'
import { createKnowledgeState } from './knowledge-state'
import {
  advanceLv4Plan,
  searchLv4Commands,
  type Lv4SearchHooks,
  type Lv4PlanProgress,
} from './lv4-search'
import type { TacticalPlan } from './tactical-plans'

const playerId = 'player-two' as const

const emptyPlan: Lv4PlanProgress = {
  setupSteps: 0,
  payoffSteps: 0,
  completedPayoffs: 0,
  sharedTags: [],
}

const setupPlan: TacticalPlan = {
  kind: 'setup',
  status: 'confirmed',
  sourceCardId: 'fixture-setup',
  sharedTags: ['support'],
  relativeValue: 12,
  requiresKnownDeckFact: false,
  detail: 'fixture setup',
}

const payoffPlan: TacticalPlan = {
  kind: 'payoff',
  status: 'confirmed',
  sourceCardId: 'fixture-payoff',
  sharedTags: ['support'],
  relativeValue: 42,
  requiresKnownDeckFact: false,
  detail: 'fixture payoff',
}

const makeThreeStepHooks = (): Lv4SearchHooks => {
  const stages = new WeakMap<GameState, number>()
  const stateAt = (state: GameState) => stages.get(state) ?? 0
  const advance = (state: GameState): GameState => {
    const next = { ...state, turnNumber: state.turnNumber + 1 }
    stages.set(next, stateAt(state) + 1)
    return next
  }
  const command: PlayerActionCommand = {
    kind: 'advance-phase',
    playerId,
  }
  return {
    getLegalCommands: (state) => stateAt(state) < 3 ? [command] : [],
    applyCommand: advance,
    createPlayerView,
    scorePublicView: (view) => view.turnNumber,
    legacyStepBonus: () => 0,
    isTerminal: (state) => stateAt(state) >= 3,
  }
}

describe('G4 Lv4 command search', () => {
  it('保留跨步 setup → payoff 計畫，且只有已先完成 setup 才給完成 bonus', () => {
    const afterSetup = advanceLv4Plan(emptyPlan, setupPlan)
    const afterPayoff = advanceLv4Plan(afterSetup.plan, payoffPlan)
    const standalonePayoff = advanceLv4Plan(emptyPlan, payoffPlan)

    expect(afterSetup.plan.setupSteps).toBe(1)
    expect(afterPayoff.plan).toMatchObject({
      setupSteps: 1,
      payoffSteps: 1,
      completedPayoffs: 1,
    })
    expect(afterPayoff.completionBonus).toBeGreaterThan(0)
    expect(standalonePayoff.plan.completedPayoffs).toBe(0)
    expect(standalonePayoff.completionBonus).toBe(0)
  })

  it('可在有限 beam 內穩定探索三步合法 GameCommand 路徑', () => {
    const state = createBattleState()
    const run = () => searchLv4Commands(
      state,
      playerId,
      createKnowledgeState(playerId),
      makeThreeStepHooks(),
      { beamWidth: 4, maxDepth: 4, maxNodes: 10, timeBudgetMs: 1000 },
    )

    const first = run()
    const second = run()

    expect(first.telemetry.maxDepthReached).toBe(3)
    expect(first.telemetry.nodesGenerated).toBeLessThanOrEqual(10)
    expect(first.firstCommand).toEqual({ kind: 'advance-phase', playerId })
    expect(first.firstCommand).toEqual(second.firstCommand)
    expect(first.relativeScore).toBe(second.relativeScore)
  })

  it('遇到假想抽牌時停止列舉後續命令，不讀未知手牌內容', () => {
    const state = createBattleState()
    const unknown = item('unknown-drawn-card')
    const queried: number[] = []
    const stages = new WeakMap<GameState, number>()
    const hooks: Lv4SearchHooks = {
      getLegalCommands: (current) => {
        queried.push(stages.get(current) ?? 0)
        return [{ kind: 'advance-phase', playerId }]
      },
      applyCommand: (current) => {
        const next = {
          ...current,
          players: {
            ...current.players,
            [playerId]: {
              ...current.players[playerId],
              hand: [...current.players[playerId].hand, unknown],
            },
          },
        }
        stages.set(next, 1)
        return next
      },
      createPlayerView,
      scorePublicView: (view) => view.self.handCount,
      legacyStepBonus: () => 0,
      isTerminal: () => false,
    }

    const result = searchLv4Commands(
      state,
      playerId,
      createKnowledgeState(playerId),
      hooks,
      { maxDepth: 4, maxNodes: 10, timeBudgetMs: 1000 },
    )

    expect(result.telemetry.hiddenInformationStops).toBe(1)
    expect(result.telemetry.maxDepthReached).toBe(1)
    expect(queried).toEqual([0])
  })

  it('耗盡時間預算時不採用半截 frontier，明確要求 caller 回退 Lv.3', () => {
    let clockCalls = 0
    const result = searchLv4Commands(
      createBattleState(),
      playerId,
      createKnowledgeState(playerId),
      makeThreeStepHooks(),
      {
        timeBudgetMs: 1,
        now: () => clockCalls++ === 0 ? 0 : 1,
      },
    )

    expect(result.firstCommand).toBeNull()
    expect(result.telemetry).toMatchObject({
      stopReason: 'time-budget',
      fallbackUsed: true,
    })
  })
})
