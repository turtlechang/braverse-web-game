import { getActingPlayerId } from './controller'
import { getLegalTurnCommands } from './legal-actions'
import { getEffectiveAttack } from './effects'
import type { AttackCommand } from './commands'
import { calculateReplacementBaseScore } from './ai/bs2MatchupProfiles'
import { takeAiStep } from './ai'
import { resetR10Counters, getR10Counters } from './ai/evaluated-turn-handler'
import {
  aggregateLv4SearchTelemetry,
  type Lv4SearchTelemetry,
} from './ai/strategy/search-telemetry'
import type {
  AiMatchMetrics,
  AiDetailedResult,
  ReplacementEvent,
  AttackEvent,
  TurnProgression,
  EndInfo,
  BehaviorMetrics,
} from './ai/types'
import type { GameState, PendingBattle, PlayerId } from './types'

const countBreakLevel = (state: GameState, playerId: PlayerId): number =>
  state.players[playerId].breakArea.reduce((sum, c) => sum + c.level, 0)

const countBattleAreaHp = (state: GameState, playerId: PlayerId): number =>
  state.players[playerId].battleArea.reduce(
    (sum, cookie) => sum + cookie.hpCards.length,
    0,
  )

/** 只以目前公開攻擊／HP 找出可立即擊倒的合法 attack command。 */
const publicLethalAttackCommands = (
  state: GameState,
  playerId: PlayerId,
): AttackCommand[] => getLegalTurnCommands(state, playerId).filter((command): command is AttackCommand => {
  if (command.kind !== 'attack') return false
  const opponentId: PlayerId = playerId === 'player-one'
    ? 'player-two'
    : 'player-one'
  const target = state.players[opponentId].battleArea.find(
    (cookie) => cookie.card.instanceId === command.targetInstanceId,
  )
  return target !== undefined &&
    getEffectiveAttack(state, command.attackerInstanceId) >= target.hpCards.length
})

const detectReplacement = (
  prevState: GameState,
  nextState: GameState,
  playerId: PlayerId,
  turn: number,
): ReplacementEvent | null => {
  if (nextState.players[playerId].battleArea.length <= prevState.players[playerId].battleArea.length) {
    return null
  }

  const prevIds = new Set(
    prevState.players[playerId].battleArea.map((c) => c.card.instanceId),
  )
  const newCookie = nextState.players[playerId].battleArea.find(
    (c) => !prevIds.has(c.card.instanceId),
  )
  if (!newCookie) return null

  const score = calculateReplacementBaseScore(newCookie.card)
  const candidateCount = nextState.players[playerId].hand.filter(
    (c) => c.type === 'cookie',
  ).length + 1

  return {
    turn,
    player: playerId,
    cardId: newCookie.card.instanceId,
    cardName: newCookie.card.name,
    level: newCookie.card.level,
    hp: newCookie.card.hp,
    score,
    candidateCount,
    rank: 1,
  }
}

interface AttackStartInfo {
  attackerPlayerId: PlayerId
  defenderPlayerId: PlayerId
  attackerInstanceId: string
  attackerName: string
  attackerLevel: number
  declaredTargetInstanceId: string
  targetHpBefore: number
  breakAreaBefore: number
}

const buildAttackStartInfo = (
  prevState: GameState,
  battle: PendingBattle,
): AttackStartInfo => {
  const attackerCookie = prevState.players[battle.attackerPlayerId].battleArea.find(
    (c) => c.card.instanceId === battle.attackerInstanceId,
  )
  const targetCookie = prevState.players[battle.defenderPlayerId].battleArea.find(
    (c) => c.card.instanceId === battle.targetInstanceId,
  )

  return {
    attackerPlayerId: battle.attackerPlayerId,
    defenderPlayerId: battle.defenderPlayerId,
    attackerInstanceId: battle.attackerInstanceId,
    attackerName: attackerCookie?.card.name ?? 'unknown',
    attackerLevel: attackerCookie?.card.level ?? 0,
    declaredTargetInstanceId: battle.targetInstanceId,
    targetHpBefore: targetCookie?.hpCards.length ?? 0,
    breakAreaBefore: prevState.players[battle.defenderPlayerId].breakArea.length,
  }
}

const finalizeAttackEvent = (
  prevState: GameState,
  nextState: GameState,
  startInfo: AttackStartInfo,
  pendingBattle: PendingBattle,
): AttackEvent => {
  const defenderId = startInfo.defenderPlayerId

  const finalTargetCookie = nextState.players[defenderId].battleArea.find(
    (c) => c.card.instanceId === pendingBattle.targetInstanceId,
  )
  const targetHpAfter = finalTargetCookie?.hpCards.length ?? null
  const breakAreaAfter = nextState.players[defenderId].breakArea.length
  const breakAreaDelta = breakAreaAfter - startInfo.breakAreaBefore

  const rawDamage = targetHpAfter !== null
    ? Math.max(0, startInfo.targetHpBefore - targetHpAfter)
    : startInfo.targetHpBefore

  const targetCookieBefore = prevState.players[defenderId].battleArea.find(
    (c) => c.card.instanceId === startInfo.declaredTargetInstanceId,
  )
  const isKill = targetHpAfter === null ||
    (targetCookieBefore !== undefined && targetHpAfter <= 0)
  const isOverkill = isKill && rawDamage > startInfo.targetHpBefore
  const overkillAmount = isOverkill ? rawDamage - startInfo.targetHpBefore : 0

  const wasRedirected = startInfo.declaredTargetInstanceId !== pendingBattle.targetInstanceId

  return {
    turn: prevState.turnNumber,
    attackerPlayerId: startInfo.attackerPlayerId,
    defenderPlayerId: defenderId,
    attackerId: startInfo.attackerInstanceId,
    attackerName: startInfo.attackerName,
    declaredTargetId: startInfo.declaredTargetInstanceId,
    finalTargetId: pendingBattle.targetInstanceId,
    targetName: targetCookieBefore?.card.name ?? finalTargetCookie?.card.name ?? 'unknown',
    targetLevel: targetCookieBefore?.card.level ?? finalTargetCookie?.card.level ?? 0,
    damage: rawDamage,
    targetHpBefore: startInfo.targetHpBefore,
    targetHpAfter,
    isKill,
    isOverkill,
    overkillAmount,
    wasRedirected,
    breakAreaBefore: startInfo.breakAreaBefore,
    breakAreaAfter,
    breakAreaDelta,
  }
}

const computeEndInfo = (
  state: GameState,
  turnCapReached: boolean,
): EndInfo => ({
  winner: state.result?.winnerId ?? null,
  loser: state.result?.loserId ?? null,
  reason: state.result?.reason ?? null,
  playerOneBreakLevel: countBreakLevel(state, 'player-one'),
  playerTwoBreakLevel: countBreakLevel(state, 'player-two'),
  turnCapReached,
})

const computeBehaviorMetrics = (
  replacementEvents: ReplacementEvent[],
  attackEvents: AttackEvent[],
  metrics: AiMatchMetrics,
  turnProgression: TurnProgression,
  invalidActionCount: number,
  deadlockCount: number,
  r7TrapSkipCount: number,
  lethalOpportunityCount: number,
  lethalConversionCount: number,
  directWinCount: number,
  r10PenaltyAppliedCount: number,
  r10BreakRaceRiskCount: number,
  r10ExposureRiskCount: number,
  r6cReplacementCount: number,
  r6cLowQualityCount: number,
  r6cForcedCount: number,
  r6cBreakWorsenedCount: number,
  legalAttackSkippedCount: number,
  lv4SearchTelemetry: readonly Lv4SearchTelemetry[],
): BehaviorMetrics => {
  const lowQualityCount = replacementEvents.filter((e) => e.level <= 1 && e.hp <= 1).length

  const p1Events = replacementEvents.filter((e) => e.player === 'player-one')
  const p2Events = replacementEvents.filter((e) => e.player === 'player-two')
  const p1LowQuality = p1Events.filter((e) => e.level <= 1 && e.hp <= 1).length
  const p2LowQuality = p2Events.filter((e) => e.level <= 1 && e.hp <= 1).length

  const avgScore = replacementEvents.length > 0
    ? replacementEvents.reduce((sum, e) => sum + e.score, 0) / replacementEvents.length
    : 0
  const avgRank = replacementEvents.length > 0
    ? replacementEvents.reduce((sum, e) => sum + e.rank, 0) / replacementEvents.length
    : 0
  const p1AvgScore = p1Events.length > 0
    ? p1Events.reduce((sum, e) => sum + e.score, 0) / p1Events.length
    : 0
  const p2AvgScore = p2Events.length > 0
    ? p2Events.reduce((sum, e) => sum + e.score, 0) / p2Events.length
    : 0

  const killEvents = attackEvents.filter((e) => e.isKill)
  const overkillEvents = attackEvents.filter((e) => e.isOverkill)
  const killRate = attackEvents.length > 0 ? killEvents.length / attackEvents.length : 0
  const overkillRatio = attackEvents.length > 0 ? overkillEvents.length / attackEvents.length : 0
  const avgOverkill = overkillEvents.length > 0
    ? overkillEvents.reduce((sum, e) => sum + e.overkillAmount, 0) / overkillEvents.length
    : 0

  return {
    lowQualityReplacementCount: lowQualityCount,
    playerOneLowQualityReplacements: p1LowQuality,
    playerTwoLowQualityReplacements: p2LowQuality,
    replacementAvgScore: avgScore,
    replacementAvgRank: avgRank,
    playerOneReplacementAvgScore: p1AvgScore,
    playerTwoReplacementAvgScore: p2AvgScore,
    playerOneTotalReplacements: p1Events.length,
    playerTwoTotalReplacements: p2Events.length,
    attackKillRate: killRate,
    overkillRatio,
    avgOverkillAmount: avgOverkill,
    skillUsageCount: metrics.skillActivations,
    invalidActionCount,
    deadlockCount,
    noDamageTurns: turnProgression.noDamageTurns,
    noBoardChangeTurns: turnProgression.noBoardChangeTurns,
    consecutiveNoProgressMax: turnProgression.consecutiveNoProgressMax,
    r7TrapSkippedCount: r7TrapSkipCount,
    lethalOpportunityCount,
    lethalConversionCount,
    directWinCount,
    r10PenaltyAppliedCount,
    r10BreakRaceRiskCount,
    r10ExposureRiskCount,
    r6cReplacementCount,
    r6cLowQualityCount,
    r6cForcedCount,
    r6cBreakWorsenedCount,
    legalAttackSkippedCount,
    lv4Search: aggregateLv4SearchTelemetry(lv4SearchTelemetry),
  }
}

export const simulateAiMatchDetailed = (
  initialState: GameState,
  maxActions = 500,
  options: { levels?: Partial<Record<PlayerId, number>>; seed?: number } = {},
): AiDetailedResult => {
  let state = initialState
  const logs: string[] = []
  const metrics: AiMatchMetrics = {
    skillActivations: 0,
    refreshes: 0,
    replacements: 0,
  }
  let error: string | null = null
  const replacementEvents: ReplacementEvent[] = []
  const attackEvents: AttackEvent[] = []

  let prevTurnNumber = state.turnNumber
  let prevPlayerOneBattleHp = countBattleAreaHp(state, 'player-one')
  let prevPlayerTwoBattleHp = countBattleAreaHp(state, 'player-two')
  let noDamageTurns = 0
  let noBoardChangeTurns = 0
  let consecutiveNoProgress = 0
  let consecutiveNoProgressMax = 0
  let turnCapReached = false
  let r7TrapSkipCount = 0
  let directWinCount = 0
  let r6cReplacementCount = 0
  let r6cLowQualityCount = 0
  let r6cForcedCount = 0
  let r6cBreakWorsenedCount = 0
  let invalidActionCount = 0
  let deadlockCount = 0
  let legalAttackSkippedCount = 0
  let lethalOpportunityCount = 0
  let lethalConversionCount = 0
  const lv4SearchTelemetry: Lv4SearchTelemetry[] = []

  resetR10Counters()

  let prevPendingBattle: PendingBattle | null = state.pendingBattle ?? null
  let currentAttackStart: AttackStartInfo | null = null

  for (let actionCount = 0; actionCount < maxActions; actionCount += 1) {
    if (state.status === 'finished') {
      break
    }

    const prevState = state
    const controller = getActingPlayerId(state)
    const legalCommands = getLegalTurnCommands(state, controller)
    const legalAttacks = legalCommands.filter((command) => command.kind === 'attack')
    const publicLethals = publicLethalAttackCommands(state, controller)
    const decision = takeAiStep(state, controller, {
      level: (options.levels?.[controller] ?? 2) as 1 | 2 | 3 | 4,
      seed: options.seed,
    })
    if (decision.reason?.lv4Search) {
      lv4SearchTelemetry.push(decision.reason.lv4Search)
    }
    if (legalAttacks.length > 0 && decision.action === 'advance-phase') {
      legalAttackSkippedCount += 1
    }
    if (publicLethals.length > 0) {
      lethalOpportunityCount += 1
      if (
        decision.action === 'attack' &&
        decision.state.pendingBattle &&
        publicLethals.some((command) =>
          command.attackerInstanceId === decision.state.pendingBattle?.attackerInstanceId &&
          command.targetInstanceId === decision.state.pendingBattle?.targetInstanceId,
        )
      ) {
        lethalConversionCount += 1
      }
    }
    logs.push(
      `#${actionCount + 1} T${state.turnNumber} ${decision.description}`,
    )

    if (decision.action === 'activate-skill') {
      metrics.skillActivations += 1
    } else if (decision.action === 'refresh') {
      metrics.refreshes += 1
    } else     if (decision.action === 'replace-cookie') {
      metrics.replacements += 1
      const event = detectReplacement(prevState, decision.state, controller, prevState.turnNumber)
      if (event) replacementEvents.push(event)

      // R6c audit: track replacement risk for player-one
      if (controller === 'player-one') {
        r6cReplacementCount++
        if (event && event.level <= 1 && event.hp <= 1) {
          r6cLowQualityCount++
          if (event.candidateCount <= 2) {
            r6cForcedCount++
          }
        }
        // Check if break area worsened after replacement
        const preBreak = prevState.players['player-one'].breakArea.reduce(
          (s, c) => s + c.level, 0,
        )
        const postBreak = decision.state.players['player-one'].breakArea.reduce(
          (s, c) => s + c.level, 0,
        )
        if (postBreak > preBreak) {
          r6cBreakWorsenedCount++
        }
      }
    }

    if (decision.r7TrapSkip) {
      r7TrapSkipCount++
    }

    // Direct win tracking
    if (decision.state.status === 'finished' && decision.state.result?.winnerId === 'player-one') {
      directWinCount++
    }

    if (decision.action === 'attack' && decision.state.pendingBattle) {
      currentAttackStart = buildAttackStartInfo(prevState, decision.state.pendingBattle)
    }

    const nextPendingBattle = decision.state.pendingBattle ?? null
    if (prevPendingBattle && !nextPendingBattle && currentAttackStart) {
      const event = finalizeAttackEvent(prevState, decision.state, currentAttackStart, prevPendingBattle)
      attackEvents.push(event)
      currentAttackStart = null
    }
    prevPendingBattle = nextPendingBattle

    const turnChanged = decision.state.turnNumber !== prevTurnNumber
    if (turnChanged) {
      const currentP1Hp = countBattleAreaHp(state, 'player-one')
      const currentP2Hp = countBattleAreaHp(state, 'player-two')
      if (currentP1Hp === prevPlayerOneBattleHp && currentP2Hp === prevPlayerTwoBattleHp) {
        noDamageTurns += 1
      }
      if (state.players['player-one'].battleArea.length === decision.state.players['player-one'].battleArea.length &&
          state.players['player-two'].battleArea.length === decision.state.players['player-two'].battleArea.length) {
        noBoardChangeTurns += 1
        consecutiveNoProgress += 1
        consecutiveNoProgressMax = Math.max(consecutiveNoProgressMax, consecutiveNoProgress)
      } else {
        consecutiveNoProgress = 0
      }
      prevTurnNumber = decision.state.turnNumber
      prevPlayerOneBattleHp = countBattleAreaHp(decision.state, 'player-one')
      prevPlayerTwoBattleHp = countBattleAreaHp(decision.state, 'player-two')
    }

    if (decision.action === 'error') {
      invalidActionCount += 1
      error =
        decision.error ??
        `AI 未推進狀態：${decision.description}`
      break
    }
    if (decision.state === state) {
      deadlockCount += 1
      error = `AI 未推進狀態：${decision.description}`
      break
    }
    state = decision.state
  }

  if (state.status !== 'finished' && !error) {
    turnCapReached = true
    error = `超過最大行動數 ${maxActions}。`
  }

  const totalTurns = state.turnNumber - initialState.turnNumber
  const turnProgression: TurnProgression = {
    totalTurns,
    noDamageTurns,
    noBoardChangeTurns,
    consecutiveNoProgressMax,
    turnCapReached,
  }

  const endInfo = computeEndInfo(state, turnCapReached)
  const behavior = computeBehaviorMetrics(
    replacementEvents,
    attackEvents,
    metrics,
    turnProgression,
    invalidActionCount,
    deadlockCount,
    r7TrapSkipCount,
    lethalOpportunityCount,
    lethalConversionCount,
    directWinCount,
    getR10Counters().penaltyApplied,
    getR10Counters().breakRaceRisk,
    getR10Counters().exposureRisk,
    r6cReplacementCount,
    r6cLowQualityCount,
    r6cForcedCount,
    r6cBreakWorsenedCount,
    legalAttackSkippedCount,
    lv4SearchTelemetry,
  )

  return {
    state,
    actions: state.status === 'finished' ? logs.length : logs.length,
    logs: logs.slice(-20),
    metrics,
    stuck: !!error && state.status !== 'finished',
    error,
    replacementEvents,
    attackEvents,
    turnProgression,
    endInfo,
    behavior,
    lv4SearchTelemetry,
  }
}
