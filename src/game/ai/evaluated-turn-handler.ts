import { applyGameCommand } from '../commands'
import type { AttackCommand, PlayerActionCommand } from '../commands'
import { getEffectiveAttack } from '../effects'
import { getLegalTurnCommands } from '../legal-actions'
import { createPlayerView } from '../player-view'
import type { PlayerView } from '../player-view'
import type { CookieCard, GameState, PlayerId } from '../types'
import type { AiDecision } from './types'
import {
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

const commandCandidate = (
  state: GameState,
  playerId: PlayerId,
  command: PlayerActionCommand,
): EvaluatedCandidate | null => {
  try {
    const nextState = applyGameCommand(state, command)
    let score: number
    if (command.kind === 'attack') {
      score =
        evaluatePlayerView(createPlayerView(state, playerId)) +
        attackBonus(state, playerId, command)
    } else {
      score = evaluatePlayerView(createPlayerView(nextState, playerId))
      if (command.kind === 'place-support') {
        const placed = state.players[playerId].hand.find(
          (card) => card.instanceId === command.instanceId,
        )
        if (placed?.type === 'cookie') score -= 12
      }
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
      const decision = strategy.resolveSkill(state, playerId, source, 'activate')
      if (decision) {
        candidates.push({
          decision,
          score:
            evaluatePlayerView(createPlayerView(decision.state, playerId)) + 2,
        })
      }
    }
    for (const card of state.players[playerId].hand) {
      const decision = strategy.resolveCardAbility(state, playerId, card)
      if (decision) {
        candidates.push({
          decision,
          score:
            evaluatePlayerView(createPlayerView(decision.state, playerId)) + 2,
        })
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
