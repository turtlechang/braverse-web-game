import { applyGameCommand } from '../commands'
import type { AttackCommand, PlayerActionCommand } from '../commands'
import { resolveBattleAutomatically } from '../battle'
import { getEffectiveAttack } from '../effects'
import { getLegalTurnCommands } from '../legal-actions'
import { createPlayerView } from '../player-view'
import type { PlayerView } from '../player-view'
import type { CookieCard, GameState, PlayerId } from '../types'
import type { AiDecision } from './types'
import {
  applyChosenTurnCommand,
  commandActionTypes,
  describeCommand,
} from './random-turn-handler'
import { handleAiTurnState, type AiTurnStrategy } from './turn-handler'

const sumBreakLevel = (cards: CookieCard[]): number =>
  cards.reduce((sum, card) => sum + card.level, 0)

/**
 * 場面評分：只讀 PlayerView，型別上保證不使用隱藏資訊。
 * 分數對 viewer 而言越高越好。
 */
export const evaluatePlayerView = (view: PlayerView): number => {
  if (view.status === 'finished') {
    if (!view.result) return 0
    return view.result.winnerId === view.viewerId ? 100000 : -100000
  }

  const { self, opponent } = view
  let score = 0
  score += self.battleArea.length * 60
  score -= opponent.battleArea.length * 60
  score += self.battleArea.reduce((sum, cookie) => sum + cookie.hpCount, 0) * 25
  score -=
    opponent.battleArea.reduce((sum, cookie) => sum + cookie.hpCount, 0) * 25
  score += self.handCount * 6
  score -= opponent.handCount * 3
  score += self.supportArea.filter((support) => !support.rested).length * 10
  score += self.supportArea.length * 4
  score -= sumBreakLevel(self.breakArea) * 20
  score += sumBreakLevel(opponent.breakArea) * 20
  score += self.deckCount
  if (self.stage) score += 8
  return score
}

/**
 * 攻擊指令採期望值啟發式：套用後戰局停在待回應階段，直接評分
 * 會低估攻擊價值，因此以「預期傷害／斬殺」加成計分。攻擊力與
 * 目標剩餘 HP 張數皆為公開資訊。
 */
const attackBonus = (
  state: GameState,
  playerId: PlayerId,
  command: AttackCommand,
): number => {
  const opponentId: PlayerId =
    playerId === 'player-one' ? 'player-two' : 'player-one'
  const target = state.players[opponentId].battleArea.find(
    (cookie) => cookie.card.instanceId === command.targetInstanceId,
  )
  if (!target) return 0
  const damage = getEffectiveAttack(state, command.attackerInstanceId)
  const lethal = target.hpCards.length <= damage
  const bonus = lethal
    ? 350 + target.card.level * 30
    : Math.min(damage, target.hpCards.length) * 30
  return bonus - command.supportPaymentIds.length * 6
}

interface EvaluatedCandidate {
  decision: AiDecision
  score: number
}

/**
 * 目標能量數：低於此值時，AI 應優先鋪能量以維持運作。
 */
const RAMP_ENERGY_TARGET = 5

/**
 * 餅乾放到支援區的懲罰。
 *
 * 原意是避免把還能登場的餅乾浪費成能量，但無條件 -12 會讓
 * 以餅乾為主的牌組（例如 bs2-red）在手上全是餅乾時，因為
 * 「放餅乾當能量」分數為負而寧可整個支援階段不填能，造成能量匱乏。
 *
 * 改為：能量已足夠（>= RAMP_ENERGY_TARGET）才施加懲罰以保留餅乾；
 * 能量不足時不懲罰，確保 AI 會先把能量鋪起來。
 */
const cookieSupportPenalty = (
  state: GameState,
  playerId: PlayerId,
  command: PlayerActionCommand,
): number => {
  if (command.kind !== 'place-support') return 0
  const placed = state.players[playerId].hand.find(
    (card) => card.instanceId === command.instanceId,
  )
  if (placed?.type !== 'cookie') return 0
  const currentEnergy = state.players[playerId].supportArea.length
  return currentEnergy >= RAMP_ENERGY_TARGET ? 12 : 0
}

const commandCandidate = (
  state: GameState,
  playerId: PlayerId,
  command: PlayerActionCommand,
): EvaluatedCandidate | null => {
  try {
    // 攻擊：decision.state 停在 trap 階段（applyChosenTurnCommand），
    // 讓防守方能回應；評分仍用 state + attackBonus 啟發式，不受影響。
    const nextState = applyChosenTurnCommand(state, command)
    let score: number
    if (command.kind === 'attack') {
      score =
        evaluatePlayerView(createPlayerView(state, playerId)) +
        attackBonus(state, playerId, command)
    } else {
      score = evaluatePlayerView(createPlayerView(nextState, playerId))
      score -= cookieSupportPenalty(state, playerId, command)
    }
    return {
      decision: {
        state: nextState,
        action: commandActionTypes[command.kind],
        description: describeCommand(state, playerId, command),
      },
      score,
    }
  } catch {
    return null
  }
}

/**
 * Lv.3 評估式 AI：在支援／主要階段對每個候選動作打分後取最高分；
 * 其餘強制流程（Refresh、補位、OnPlay、戰鬥回應、非行動回合）
 * 委派給 Lv.2 的 turn handler。
 */
export const handleAiEvaluatedTurnState = (
  state: GameState,
  playerId: PlayerId,
  strategy: AiTurnStrategy,
): AiDecision => {
  const isFreeChoiceState =
    state.status === 'playing' &&
    !state.pendingRefresh &&
    !state.pendingReplacement &&
    !state.pendingOnPlay &&
    !state.pendingBattle &&
    state.activePlayerId === playerId &&
    (state.phase === 'support' || state.phase === 'main')

  if (!isFreeChoiceState) {
    const delegated = handleAiTurnState(state, playerId, strategy)
    return delegated.reason
      ? delegated
      : { ...delegated, reason: { level: 3 } }
  }

  const candidates: EvaluatedCandidate[] = []

  for (const command of getLegalTurnCommands(state, playerId)) {
    const candidate = commandCandidate(state, playerId, command)
    if (candidate) candidates.push(candidate)
  }

  if (state.phase === 'main') {
    for (const source of state.players[playerId].battleArea) {
      try {
        const decision = strategy.resolveSkill(state, playerId, source, 'activate')
        if (decision) {
          candidates.push({
            decision,
            score:
              evaluatePlayerView(createPlayerView(decision.state, playerId)) + 2,
          })
        }
      } catch {
        // skip invalid skill resolution
      }
    }
    for (const card of state.players[playerId].hand) {
      try {
        const decision = strategy.resolveCardAbility(state, playerId, card)
        if (decision) {
          candidates.push({
            decision,
            score:
              evaluatePlayerView(createPlayerView(decision.state, playerId)) + 2,
          })
        }
      } catch {
        // skip invalid card ability resolution
      }
    }
  }

  if (candidates.length === 0) {
    const fallback = handleAiTurnState(state, playerId, strategy)
    return fallback.reason ? fallback : { ...fallback, reason: { level: 3 } }
  }

  let best = candidates[0]
  for (const candidate of candidates) {
    if (candidate.score > best.score) best = candidate
  }

  return {
    ...best.decision,
    reason: {
      level: 3,
      consideredCommands: candidates.length,
      chosenCommandKind: best.decision.action,
    },
  }
}

// ---------------------------------------------------------------------------
// Lv.4 — Two-ply lookahead with battle resolution + risk management
// ---------------------------------------------------------------------------

/**
 * Lv.4 修正分數：在 evaluatePlayerView 基礎上疊加風險管理。
 * 所有因子均只使用 PlayerView 公開資訊。
 */
const lv4RiskBonus = (
  view: PlayerView,
  _playerId: PlayerId,
): number => {
  if (view.status === 'finished') return 0

  const { self, opponent } = view
  let bonus = 0

  const selfBreakSum = self.breakArea.reduce((s, c) => s + c.level, 0)
  const oppBreakSum = opponent.breakArea.reduce((s, c) => s + c.level, 0)

  // 破壞區接近 10 時的懲罰（越接近越重）
  if (selfBreakSum >= 8) {
    bonus -= (selfBreakSum - 7) * 25
  } else if (selfBreakSum >= 6) {
    bonus -= (selfBreakSum - 5) * 8
  }

  // 對手破壞區高時加分（我方優勢）
  if (oppBreakSum >= 8) {
    bonus += (oppBreakSum - 7) * 20
  } else if (oppBreakSum >= 6) {
    bonus += (oppBreakSum - 5) * 6
  }

  // 戰鬥區低 HP 餅乾暴露懲罰
  for (const cookie of self.battleArea) {
    if (cookie.hpCount <= 1) {
      bonus -= 15
    }
  }

  // 對手戰鬥區高威脅餅乾（高等級 + 多 HP）的清除價值
  for (const cookie of opponent.battleArea) {
    if (cookie.card.level >= 3 && cookie.hpCount >= 3) {
      bonus -= 10 // 未清除高威脅 = 潛在風險
    }
  }

  // 戰鬥區數量優勢 / 劣勢修正
  const boardDelta = self.battleArea.length - opponent.battleArea.length
  if (boardDelta >= 2) {
    bonus += 15
  } else if (boardDelta <= -2) {
    bonus -= 15
  }

  // 無戰鬥區餅乾且手牌也無餅乾的風險
  if (self.battleArea.length === 0) {
    const hasCookieInHand = self.handCount > 0
    if (!hasCookieInHand) {
      bonus -= 40
    } else {
      bonus -= 20
    }
  }

  return bonus
}

interface TwoPlyCandidate {
  decision: AiDecision
  score: number
}

/**
 * 計算單一候選動作的兩層前瞻分數。
 *
 * 與 Lv.3 的差異：
 * - 攻擊：使用 resolveBattleAutomatically 解析完整戰鬥，再評分
 *   （Lv.3 僅用 attackBonus 啟發式）
 * - 所有動作：疊加 lv4RiskBonus 風險修正
 */
const twoPlyCandidateScore = (
  state: GameState,
  playerId: PlayerId,
  command: PlayerActionCommand,
): number => {
  try {
    const nextState = applyGameCommand(state, command)
    if (nextState.status === 'finished') {
      const view = createPlayerView(nextState, playerId)
      return evaluatePlayerView(view) + lv4RiskBonus(view, playerId)
    }

    let resolved = nextState
    if (command.kind === 'attack') {
      // 攻擊：完整解析戰鬥（含陷阱、FLIP、昏厥效果）
      resolved = resolveBattleAutomatically(nextState)
    }

    if (resolved.status === 'finished') {
      const view = createPlayerView(resolved, playerId)
      return evaluatePlayerView(view) + lv4RiskBonus(view, playerId)
    }

    const view = createPlayerView(resolved, playerId)
    let score = evaluatePlayerView(view) + lv4RiskBonus(view, playerId)

    // 攻擊動作：仍保留 attackBonus 作為額外斬殺加成
    if (command.kind === 'attack') {
      score += attackBonus(state, playerId, command)
    }

    // 支援放置懲罰（餅乾放支援區浪費；能量不足時不懲罰以利鋪能量）
    score -= cookieSupportPenalty(state, playerId, command)

    return score
  } catch {
    return -999999
  }
}

/**
 * Lv.4 兩層前瞻 AI：在支援／主要階段對每個候選動作執行
 * 「apply → resolveBattle（攻擊時）→ 評分 + 風險修正」流程，
 * 取最高分動作。其餘強制流程委派給 Lv.2 turn handler。
 *
 * 核心改進（相較 Lv.3）：
 * 1. 攻擊使用 resolveBattleAutomatically 而非 attackBonus 啟發式
 * 2. 所有評分疊加 lv4RiskBonus（破壞區壓力、低 HP 暴露、高威脅未清除等）
 */
export const handleAiTwoPlyTurnState = (
  state: GameState,
  playerId: PlayerId,
  strategy: AiTurnStrategy,
): AiDecision => {
  const isFreeChoiceState =
    state.status === 'playing' &&
    !state.pendingRefresh &&
    !state.pendingReplacement &&
    !state.pendingOnPlay &&
    !state.pendingBattle &&
    state.activePlayerId === playerId &&
    (state.phase === 'support' || state.phase === 'main')

  if (!isFreeChoiceState) {
    const delegated = handleAiTurnState(state, playerId, strategy)
    if (delegated.reason) return delegated
    return {
      ...delegated,
      reason: {
        level: 4 as const,
        consideredCommands: 0,
        chosenCommandKind: delegated.action,
      },
    }
  }

  const candidates: TwoPlyCandidate[] = []

  for (const command of getLegalTurnCommands(state, playerId)) {
    const score = twoPlyCandidateScore(state, playerId, command)
    try {
      candidates.push({
        decision: {
          // 攻擊停在 trap 階段讓防守方回應；評分已在
          // twoPlyCandidateScore 內用 resolveBattleAutomatically 完整解析。
          state: applyChosenTurnCommand(state, command),
          action: commandActionTypes[command.kind],
          description: describeCommand(state, playerId, command),
        },
        score,
      })
    } catch {
      // skip invalid command
    }
  }

  if (state.phase === 'main') {
    for (const source of state.players[playerId].battleArea) {
      try {
        const decision = strategy.resolveSkill(state, playerId, source, 'activate')
        if (decision) {
          const view = createPlayerView(decision.state, playerId)
          const score = evaluatePlayerView(view) + lv4RiskBonus(view, playerId)
          candidates.push({ decision, score })
        }
      } catch {
        // skip invalid skill resolution
      }
    }
    for (const card of state.players[playerId].hand) {
      try {
        const decision = strategy.resolveCardAbility(state, playerId, card)
        if (decision) {
          const view = createPlayerView(decision.state, playerId)
          const score = evaluatePlayerView(view) + lv4RiskBonus(view, playerId)
          candidates.push({ decision, score })
        }
      } catch {
        // skip invalid card ability resolution
      }
    }
  }

  if (candidates.length === 0) {
    const fallback = handleAiTurnState(state, playerId, strategy)
    if (fallback.reason) return fallback
    return {
      ...fallback,
      reason: {
        level: 4 as const,
        consideredCommands: 0,
        chosenCommandKind: fallback.action,
      },
    }
  }

  // Deterministic tie-break：分數相同時選先出現的（穩定排序）
  let best = candidates[0]
  for (const candidate of candidates) {
    if (candidate.score > best.score) best = candidate
  }

  return {
    ...best.decision,
    reason: {
      level: 4,
      consideredCommands: candidates.length,
      chosenCommandKind: best.decision.action,
    },
  }
}
