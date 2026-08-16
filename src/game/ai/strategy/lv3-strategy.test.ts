import { describe, expect, it } from 'vitest'
import type { PlayerView } from '../../player-view'
import type { CardEffect, CookieCard } from '../../types'
import type { DeckStrategyProfile } from './deck-profile'
import {
  compareActionScoreBreakdowns,
  scoreAction,
  type ActionScoreBreakdown,
} from './action-score'
import { createKnowledgeState } from './knowledge-state'
import {
  createLv3ContextForView,
  scoreLv3ActionCandidate,
  selectBestLv3Action,
} from './lv3-strategy'

const cookie = (
  instanceId: string,
  effects: CardEffect[] = [],
): CookieCard => ({
  id: `fixture-${instanceId}`,
  instanceId,
  name: 'same visible card name',
  type: 'cookie',
  level: 2,
  hp: 3,
  attack: 2,
  attackCost: 1,
  effects,
})

const side = (id: 'player-one' | 'player-two'): PlayerView['self'] => ({
  id,
  name: id,
  handCount: 0,
  deckCount: 30,
  battleArea: [],
  supportArea: [],
  breakArea: [],
  discardPile: [],
  stage: null,
})

const view = (): PlayerView => ({
  viewerId: 'player-one',
  hand: [],
  self: side('player-one'),
  opponent: side('player-two'),
  turnNumber: 3,
  phase: 'main',
  status: 'playing',
  activePlayerId: 'player-one',
  firstPlayerId: 'player-one',
  result: null,
  supportPlacedThisTurn: false,
  attackModifiers: [],
  damageReceivedModifiers: [],
})

const noPlan = {
  kind: 'tempo' as const,
  status: 'none' as const,
  sharedTags: [],
  relativeValue: 0,
  requiresKnownDeckFact: false,
  detail: 'no plan',
}

const profile: DeckStrategyProfile = {
  cardCount: 1,
  unsupportedEffectCount: 0,
  axes: {
    aggression: { value: 0, evidenceCount: 0, confidence: 0 },
    control: { value: 0, evidenceCount: 0, confidence: 0 },
    'effect-damage': { value: 0, evidenceCount: 0, confidence: 0 },
    'support-engine': { value: 0, evidenceCount: 0, confidence: 0 },
    'deck-order-engine': { value: 0, evidenceCount: 0, confidence: 0 },
    'trash-cycle': { value: 0, evidenceCount: 0, confidence: 0 },
    'active-rest-chain': { value: 0, evidenceCount: 0, confidence: 0 },
    'hand-threshold': { value: 0, evidenceCount: 0, confidence: 0 },
    durability: { value: 0, evidenceCount: 0, confidence: 0 },
    'setup-payoff': { value: 0, evidenceCount: 0, confidence: 0 },
  },
}

const breakdown = (overrides: Partial<ActionScoreBreakdown> = {}): ActionScoreBreakdown => ({
  scoreType: 'relative-action-score',
  total: 0,
  calibrated: {
    terminalOutcome: 'none',
    legalAttackCountBefore: 0,
    legalAttackCountAfter: 0,
    activeSupportBefore: 0,
    activeSupportAfter: 0,
    knownDeckFactCount: 0,
    publicLethal: false,
  },
  contributions: [],
  unsupportedEffectKinds: [],
  unknownInformationPenalty: 0,
  tieBreakKey: 'x',
  ...overrides,
})

describe('G3 ActionScoreBreakdown', () => {
  it('明確終局訊號優先於相對分數，避免用固定分數門檻推論致勝', () => {
    const terminalWin = breakdown({
      total: -100,
      calibrated: { ...breakdown().calibrated, terminalOutcome: 'win' },
    })
    const highRelative = breakdown({ total: 9999 })

    expect(compareActionScoreBreakdowns(terminalWin, highRelative)).toBeGreaterThan(0)
  })

  it('公開可見的擊倒攻擊會高過高分但低價值的 setup', () => {
    const before = view()
    before.self.battleArea = [{
      card: cookie('attacker'),
      hpCount: 3,
      rested: false,
    }]
    before.opponent.battleArea = [{
      card: cookie('target'),
      hpCount: 1,
      rested: false,
    }]
    const attack = scoreAction({
      identity: {
        kind: 'attack',
        sourceInstanceId: 'attacker',
        targetInstanceId: 'target',
      },
      beforeView: before,
      afterView: before,
      postActionBoardScore: 0,
      deckProfile: profile,
      tacticalPlan: noPlan,
      sourceCapabilities: [],
      knownDeckFactCount: 0,
      legalAttackCountBefore: 1,
      legalAttackCountAfter: 0,
    })
    const setup = scoreAction({
      identity: { kind: 'place-support', sourceInstanceId: 'setup' },
      beforeView: before,
      afterView: before,
      postActionBoardScore: 100,
      deckProfile: profile,
      tacticalPlan: {
        kind: 'setup',
        status: 'confirmed',
        sourceCardId: 'fixture-setup',
        sharedTags: ['support'],
        relativeValue: 12,
        requiresKnownDeckFact: false,
        detail: 'confirmed setup',
      },
      sourceCapabilities: [],
      knownDeckFactCount: 0,
      legalAttackCountBefore: 1,
      legalAttackCountAfter: 1,
    })

    expect(attack.calibrated.publicLethal).toBe(true)
    expect(compareActionScoreBreakdowns(attack, setup)).toBeGreaterThan(0)
  })

  it('未知效果與未知牌庫前提會得到保守扣分並出現在 breakdown', () => {
    const scored = scoreAction({
      identity: { kind: 'activate-skill', sourceInstanceId: 'unknown-source' },
      beforeView: view(),
      afterView: view(),
      postActionBoardScore: 0,
      deckProfile: profile,
      tacticalPlan: {
        kind: 'payoff',
        status: 'potential',
        sourceCardId: 'fixture-unknown',
        sharedTags: ['deck-order'],
        relativeValue: 14,
        requiresKnownDeckFact: true,
        detail: 'unconfirmed deck payoff',
      },
      sourceCapabilities: [{
        cardId: 'fixture-unknown',
        cardIndex: 0,
        kind: 'unsupported',
        source: 'skill',
        timing: 'activate',
        effectKind: 'fixture-unknown-effect',
        target: { side: 'none' },
        cost: null,
        conditionKinds: [],
        strategyTags: [],
        certainty: 'unsupported',
        effectPath: [],
      }],
      knownDeckFactCount: 0,
      legalAttackCountBefore: 0,
      legalAttackCountAfter: 0,
    })

    expect(scored.unsupportedEffectKinds).toEqual(['fixture-unknown-effect'])
    expect(scored.unknownInformationPenalty).toBeLessThan(0)
    expect(scored.contributions.map((entry) => entry.id)).toEqual(expect.arrayContaining([
      'unsupported-effect',
      'unknown-information',
    ]))
  })

  it('不會在仍有合法攻擊時把結束主要階段視為無代價', () => {
    const scored = scoreAction({
      identity: { kind: 'advance-phase' },
      beforeView: view(),
      afterView: view(),
      postActionBoardScore: 0,
      deckProfile: profile,
      tacticalPlan: noPlan,
      sourceCapabilities: [],
      knownDeckFactCount: 0,
      legalAttackCountBefore: 1,
      legalAttackCountAfter: 0,
    })

    expect(scored.contributions).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'attack-tempo', amount: -70 }),
    ]))
  })
})

describe('G3 TacticalPlan and deterministic selection', () => {
  it('以結構化 setup/payoff 與公開支援區推導 confirmed payoff，而非卡名', () => {
    const setup = cookie('setup', [{ kind: 'hand-to-support', amount: 1 }])
    const payoff = cookie('payoff', [{
      kind: 'damage',
      amount: 1,
      target: { side: 'opponent', min: 1, max: 1 },
      condition: { kind: 'support-count-at-least', count: 1 },
    }])
    const before = view()
    before.hand = [setup, payoff]
    before.self.handCount = 2
    before.self.supportArea = [{ card: cookie('support'), rested: false }]
    const context = createLv3ContextForView(before, createKnowledgeState('player-one'))
    const scored = scoreLv3ActionCandidate(context, before, {
      value: 'payoff',
      identity: { kind: 'activate-skill', sourceInstanceId: 'payoff' },
      afterView: before,
      postActionBoardScore: 0,
      legalAttackCountBefore: 0,
      legalAttackCountAfter: 0,
    })

    expect(scored.breakdown.contributions).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'tactical-payoff', amount: 42 }),
    ]))
  })

  it('同一候選集合以穩定 tie-break 選擇，重跑結果一致', () => {
    const before = view()
    const context = createLv3ContextForView(before, createKnowledgeState('player-one'))
    const candidates = ['b', 'a'].map((instanceId) => scoreLv3ActionCandidate(context, before, {
      value: instanceId,
      identity: { kind: 'place-support', sourceInstanceId: instanceId },
      afterView: before,
      postActionBoardScore: 0,
      legalAttackCountBefore: 0,
      legalAttackCountAfter: 0,
    }))

    expect(selectBestLv3Action(candidates)?.candidate.value).toBe('a')
    expect(selectBestLv3Action(candidates)).toEqual(selectBestLv3Action(candidates))
  })
})
