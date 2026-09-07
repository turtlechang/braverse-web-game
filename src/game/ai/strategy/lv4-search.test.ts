import { describe, expect, it } from 'vitest'
import { createPlayerView } from '../../player-view'
import type { PlayerActionCommand } from '../../commands'
import type { GameState } from '../../types'
import { createBattleState, item } from '../../test-helpers/battle-helpers'
import { createKnowledgeState } from './knowledge-state'
import {
  advanceLv4Plan,
  searchLv4Commands,
  selectLv4StrategicContribution,
  type Lv4SearchHooks,
  type Lv4PlanProgress,
} from './lv4-search'
import type { TacticalPlan } from './tactical-plans'

const playerId = 'player-two' as const

const emptyPlan: Lv4PlanProgress = {
  setupSteps: 0,
  payoffSteps: 0,
  completedPayoffs: 0,
  abandonedCombos: 0,
  sharedTags: [],
  activeComboPlanIds: [],
}

const setupPlan: TacticalPlan = {
  kind: 'setup',
  status: 'confirmed',
  sourceCardId: 'fixture-setup',
  sharedTags: ['support'],
  relativeValue: 12,
  requiresKnownDeckFact: false,
  detail: 'fixture setup',
  comboPlanId: 'fixture-combo',
}

const payoffPlan: TacticalPlan = {
  kind: 'payoff',
  status: 'confirmed',
  sourceCardId: 'fixture-payoff',
  sharedTags: ['support'],
  relativeValue: 42,
  requiresKnownDeckFact: false,
  detail: 'fixture payoff',
  comboPlanId: 'fixture-combo',
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
  it('明確防守保留時，不讓通用攻擊節奏扣分壓過保留理由', () => {
    expect(selectLv4StrategicContribution({
      scoreType: 'relative-action-score',
      total: -28,
      calibrated: {
        terminalOutcome: 'none',
        legalAttackCountBefore: 1,
        legalAttackCountAfter: 0,
        activeSupportBefore: 1,
        activeSupportAfter: 1,
        knownDeckFactCount: 0,
        publicLethal: false,
      },
      contributions: [
        { id: 'attack-tempo', amount: -70, detail: '仍有合法攻擊。' },
        { id: 'defensive-reserve', amount: 42, detail: '保留唯一陷阱。' },
      ],
      unsupportedEffectKinds: [],
      unknownInformationPenalty: 0,
      tieBreakKey: 'advance-phase|||',
    })).toBe(42)
  })

  it('將跳過合法攻擊的節奏扣分納入實際 command 排序', () => {
    const state = createBattleState()
    const stages = new WeakMap<GameState, number>()
    const stateAt = (current: GameState) => stages.get(current) ?? 0
    const advance: PlayerActionCommand = {
      kind: 'advance-phase',
      playerId,
    }
    const attack: PlayerActionCommand = {
      kind: 'attack',
      playerId,
      attackerInstanceId: 'attacker',
      targetInstanceId: 'defender',
      supportPaymentIds: ['p2-support'],
    }

    const result = searchLv4Commands(
      state,
      playerId,
      createKnowledgeState(playerId),
      {
        getLegalCommands: (current) => stateAt(current) === 0
          ? [advance, attack]
          : [],
        applyCommand: (current) => {
          const next = { ...current }
          stages.set(next, stateAt(current) + 1)
          return next
        },
        createPlayerView,
        scorePublicView: () => 0,
        legacyStepBonus: () => 0,
        getPublicAttackDamage: () => 1,
        isTerminal: (current) => stateAt(current) > 0,
      },
      { beamWidth: 2, maxDepth: 1, maxNodes: 4, timeBudgetMs: 1000 },
    )

    expect(result.firstCommand).toEqual(attack)
  })

  it('採用規則層提供的公開宣告傷害，保留攻防修正後的擊倒訊號', () => {
    const state = createBattleState()
    state.players['player-two'].battleArea[0].card = {
      ...state.players['player-two'].battleArea[0].card,
      attack: 1,
    }
    const attack: PlayerActionCommand = {
      kind: 'attack',
      playerId,
      attackerInstanceId: 'attacker',
      targetInstanceId: 'defender',
      supportPaymentIds: ['p2-support'],
    }
    const result = searchLv4Commands(
      state,
      playerId,
      createKnowledgeState(playerId),
      {
        getLegalCommands: () => [attack],
        applyCommand: (current) => current,
        createPlayerView,
        scorePublicView: () => 0,
        legacyStepBonus: () => 0,
        getPublicAttackDamage: () => 3,
        isTerminal: () => false,
      },
      { maxDepth: 1 },
    )

    expect(result.firstStep?.actionScore.calibrated.publicLethal).toBe(true)
    expect(result.firstStep?.actionScore.contributions).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'public-attack', amount: 180 }),
    ]))
  })

  it('保留跨步 setup → payoff 計畫，且只有已先完成 setup 才給完成 bonus', () => {
    const afterSetup = advanceLv4Plan(emptyPlan, setupPlan)
    const lv5Setup = advanceLv4Plan(
      emptyPlan,
      setupPlan,
      'activate-skill',
      { onlyTrackSameTurn: true, rewardConfirmedSetup: true },
    )
    const afterPayoff = advanceLv4Plan(afterSetup.plan, payoffPlan)
    const standalonePayoff = advanceLv4Plan(emptyPlan, payoffPlan)
    const mismatchedPayoff = advanceLv4Plan(afterSetup.plan, {
      ...payoffPlan,
      comboPlanId: 'different-combo',
    })

    expect(afterSetup.plan.setupSteps).toBe(1)
    expect(afterSetup.completionBonus).toBe(0)
    expect(lv5Setup.completionBonus).toBeGreaterThan(0)
    expect(afterPayoff.plan).toMatchObject({
      setupSteps: 1,
      payoffSteps: 1,
      completedPayoffs: 1,
    })
    expect(afterPayoff.completionBonus).toBeGreaterThan(0)
    expect(standalonePayoff.plan.completedPayoffs).toBe(0)
    expect(standalonePayoff.completionBonus).toBe(0)
    expect(mismatchedPayoff.plan.completedPayoffs).toBe(0)
    expect(mismatchedPayoff.completionBonus).toBe(0)
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

  it('將公開回應 Min 分支與防守保留修正納入第一步評分及 telemetry', () => {
    const state = createBattleState()
    const baseHooks = makeThreeStepHooks()
    const attackCommand: PlayerActionCommand = {
      kind: 'attack',
      playerId,
      attackerInstanceId: 'attacker',
      targetInstanceId: 'defender',
      supportPaymentIds: ['p2-support'],
    }
    const hooks: Lv4SearchHooks = {
      ...baseHooks,
      getLegalCommands: (current) =>
        (baseHooks.getLegalCommands(current, playerId).length > 0
          ? [attackCommand]
          : []),
      opponentResponseMinimax: () => ({
        responseLikelihood: 0.8,
        publicResponseEvidence: 1,
        expectedPenalty: -12,
        worstCasePenalty: -17,
        worstCaseKind: 'visible-block',
        responseBranches: [{
          kind: 'visible-block',
          penalty: -17,
          evidence: 1,
          detail: 'fixture visible block',
        }],
        activeSupportCount: 2,
        hiddenHandEnergyCapacity: 1,
        detail: 'fixture response minimax',
      }),
      defensiveReserveAssessment: () => ({
        reason: 'trap-in-hand',
        reserveRequired: 1,
        activeSupportBefore: 2,
        activeSupportAfter: 0,
        shortage: 1,
        adjustment: -10,
        detail: 'fixture defensive reserve',
      }),
      endgameSurvivalAssessment: () => ({
        breakLevel: 6,
        breakDistance: 4,
        opponentThreatCount: 1,
        defenseOptionsBefore: 1,
        defenseOptionsAfter: 0,
        defenseOptionsLost: 1,
        adjustment: -18,
        detail: 'fixture endgame survival',
      }),
    }

    const result = searchLv4Commands(
      state,
      playerId,
      createKnowledgeState(playerId),
      hooks,
      { beamWidth: 2, maxDepth: 1, maxNodes: 4, timeBudgetMs: 1000 },
    )

    expect(result.firstStep?.actionScore.contributions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'opponent-response-minimax', amount: -17 }),
        expect.objectContaining({ id: 'defensive-reserve', amount: -10 }),
        expect.objectContaining({ id: 'endgame-survival', amount: -18 }),
      ]),
    )
    expect(result.telemetry).toMatchObject({
      publicResponseEvaluations: 1,
      publicResponseBranches: 1,
      publicResponseMinPenalty: -17,
      defensiveReserveEvaluations: 1,
      defensiveReserveAdjustment: -10,
      endgameSurvivalEvaluations: 1,
      endgameSurvivalAdjustment: -18,
    })
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
