import { applyGameCommand } from '../commands'
import type { AttackCommand, PlayerActionCommand } from '../commands'
import { beginAttack, resolveBattleAutomatically } from '../battle'
import { getEffectiveAttack } from '../effects'
import { getLegalTurnCommands } from '../legal-actions'
import { getActivatableSkillSources } from '../skills'
import { createPlayerView } from '../player-view'
import type { CookieInBattleView, PlayerView } from '../player-view'
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
 * 場上單張餅乾的存在價值：舊版是不分等級一律 60 分，等於 Lv.1 雜牌
 * 跟 Lv.4 王牌一樣重要，AI 因此不會特別想保留高等級餅乾。改成
 * 40 + level*10——Level 2（最常見的中段餅乾）維持原本的 60 分不變，
 * 只有 Level 1（50）與 Level 3/4（70/80）往兩側拉開，盡量不動到
 * 已經調校過的既有數值尺度。
 */
const boardPresenceValue = (cookies: CookieInBattleView[]): number =>
  cookies.reduce((sum, cookie) => sum + 40 + cookie.card.level * 10, 0)

/**
 * 場上總攻擊力：卡面攻擊力皆為公開資訊。舊版評分只看戰鬥區張數與
 * HP，兩個攻守分佈不同但張數/HP 相同的場面會拿到同分，AI 分不出
 * 「這場面比較能打」。加成幅度刻意壓低（每點攻擊力 3 分），只用來
 * 在既有分數打平時提供額外解析度，不喧賓奪主。
 */
const attackPotentialValue = (cookies: CookieInBattleView[]): number =>
  cookies.reduce((sum, cookie) => sum + (cookie.card.attack ?? 0), 0)

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
  score += boardPresenceValue(self.battleArea)
  score -= boardPresenceValue(opponent.battleArea)
  score += attackPotentialValue(self.battleArea) * 3
  score -= attackPotentialValue(opponent.battleArea) * 3
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

/**
 * 技能效果加成：比較技能發動前後的場面差異，回傳與 attackBonus
 * 同量級的效果價值，讓技能候選能與攻擊候選公平競爭。
 *
 * 只使用公開資訊（PlayerView 內的 self/opponent 戰鬥區）。
 */
const skillEffectBonus = (
  preState: GameState,
  postState: GameState,
  playerId: PlayerId,
): number => {
  const opponentId: PlayerId =
    playerId === 'player-one' ? 'player-two' : 'player-one'
  const preSelf = preState.players[playerId].battleArea
  const postSelf = postState.players[playerId].battleArea
  const preOpp = preState.players[opponentId].battleArea
  const postOpp = postState.players[opponentId].battleArea

  let bonus = 0

  // 移除對手戰鬥區餅乾（每個 +70：含 60 board + 10 initiative）
  const removedOpp = preOpp.filter(
    (c) => !postOpp.find((p) => p.card.instanceId === c.card.instanceId),
  )
  bonus += removedOpp.length * 70

  // 自方獲得 HP（每張 +25）
  const selfHpBefore = preSelf.reduce((s, c) => s + c.hpCards.length, 0)
  const selfHpAfter = postSelf.reduce((s, c) => s + c.hpCards.length, 0)
  bonus += Math.max(0, selfHpAfter - selfHpBefore) * 25

  // 對手破壞區推進（每級 +20）
  const oppBreakBefore = preState.players[opponentId].breakArea.reduce(
    (s, c) => s + c.level,
    0,
  )
  const oppBreakAfter = postState.players[opponentId].breakArea.reduce(
    (s, c) => s + c.level,
    0,
  )
  bonus += Math.max(0, oppBreakAfter - oppBreakBefore) * 20

  // 抽到手牌（每張 +6）
  const handBefore = preState.players[playerId].hand.length
  const handAfter = postState.players[playerId].hand.length
  bonus += Math.max(0, handAfter - handBefore) * 6

  // 清除所有對手戰鬥區餅乾（額外 +40 戰略價值）
  if (preOpp.length > 0 && postOpp.length === 0) {
    bonus += 40
  }

  // 計算對手戰鬥區受到的總傷害（剩餘 HP 差異）
  let totalDamage = 0
  for (const pre of preOpp) {
    const post = postOpp.find(
      (p) => p.card.instanceId === pre.card.instanceId,
    )
    if (post) {
      totalDamage += Math.max(0, pre.hpCards.length - post.hpCards.length)
    } else {
      // 被移除 = 傷害至少等於其剩餘 HP
      totalDamage += pre.hpCards.length
    }
  }
  // 非擊倒傷害每點 +15（接近擊倒的累積價值，與 attackBonus 同量級）
  bonus += totalDamage * 15

  return bonus
}

/**
 * R9: 致命傷害偵測加分（Lv.4 專用）
 *
 * 幫助 Lv.4 在「公開資訊下已經明顯可以收尾」時，不要錯過致命攻擊。
 * 僅偵測明顯致命，不模擬完整多步連招。
 *
 * 只使用公開資訊：雙方戰鬥區、破壞區、HP 數量。
 */
const lethalDetectionBonus = (
  state: GameState,
  playerId: PlayerId,
  command: PlayerActionCommand,
): number => {
  if (command.kind !== 'attack') return 0

  const opponentId: PlayerId =
    playerId === 'player-one' ? 'player-two' : 'player-one'
  const attacker = state.players[playerId].battleArea.find(
    (c) => c.card.instanceId === command.attackerInstanceId,
  )
  const target = state.players[opponentId].battleArea.find(
    (c) => c.card.instanceId === command.targetInstanceId,
  )
  if (!attacker || !target) return 0

  const damage = getEffectiveAttack(state, command.attackerInstanceId)
  const targetHp = target.hpCards.length
  const isLethal = targetHp <= damage

  let bonus = 0

  // 1. 直接致勝：擊倒後對手 break area 達到勝利條件（>=10）
  const oppBreakLevel = state.players[opponentId].breakArea.reduce(
    (sum, c) => sum + c.level, 0,
  )
  const projectedBreak = oppBreakLevel + target.card.level
  if (isLethal && projectedBreak >= 10) {
    bonus += 500
  } else if (isLethal && projectedBreak >= 8) {
    bonus += 80
  }

  // 2. 對手 break area 偏高時，擊倒價值提高
  if (isLethal && oppBreakLevel >= 8) {
    bonus += 50
  } else if (isLethal && oppBreakLevel >= 6) {
    bonus += 25
  }

  // 3. 多攻擊者聯合致命偵測
  //    如果非休息的攻擊者總傷害 >= 目標 HP，且目標是最高價值目標
  if (!isLethal) {
    const totalDamage = state.players[playerId].battleArea
      .filter((c) => !c.rested && c.card.instanceId !== command.attackerInstanceId)
      .reduce((sum, c) => sum + (c.card.attack ?? 0), 0)
    const combinedDamage = damage + totalDamage
    if (combinedDamage >= targetHp) {
      bonus += 40
    }
  }

  // 4. 我方 break area 偏高時，收尾更急迫
  const myBreakLevel = state.players[playerId].breakArea.reduce(
    (sum, c) => sum + c.level, 0,
  )
  if (isLethal && myBreakLevel >= 8) {
    bonus += 30
  }

  return bonus
}

/**
 * R8: 手牌數量管理加分
 *
 * 讓 Lv.3+ 在評估行動時考慮手牌資源節奏：
 * - 手牌過低時，低價值出牌扣分
 * - 手牌過低時，抽牌效果加分
 * - 手牌充足時，有效進攻不因消耗手牌被過度扣分
 * - 不讓 AI 囤牌到不行動
 */
const handManagementBonus = (
  preState: GameState,
  postState: GameState,
  playerId: PlayerId,
  actionKind: string,
): number => {
  const preHand = preState.players[playerId].hand.length
  const postHand = postState.players[playerId].hand.length
  const handDelta = postHand - preHand

  let bonus = 0

  // 手牌極低（<=2）且行動後更低 → 扣分（避免耗盡手牌）
  if (postHand <= 1 && handDelta < 0) {
    bonus -= 40
  } else if (postHand <= 2 && handDelta < 0) {
    bonus -= 20
  }

  // 抽牌效果加分（手牌增加，且手牌偏低時更重視）
  if (handDelta > 0) {
    const drawBonus = handDelta * 12
    bonus += preHand <= 3 ? drawBonus + 15 : drawBonus
  }

  // 支援放置（place-support）：消耗手牌但增加能量
  // 手牌低時放置能量應鼓勵（建立資源基礎）
  if (actionKind === 'place-support') {
    if (preHand <= 2) {
      bonus += 25
    } else if (preHand <= 3) {
      bonus += 10
    }
  }

  // 部署餅乾（deploy-cookie）：消耗手牌但增加戰鬥力
  // 手牌極低時需謹慎，但不應完全阻止部署
  if (actionKind === 'deploy-cookie') {
    if (preHand <= 1) {
      bonus -= 15
    } else if (preHand <= 2) {
      bonus -= 5
    }
  }

  // 手牌過多（>=6）且未消耗 → 小扣分（避免囤牌）
  if (preHand >= 6 && handDelta >= 0 && actionKind !== 'attack') {
    bonus -= 8
  }

  return bonus
}

interface EvaluatedCandidate {
  decision: AiDecision
  score: number
}

interface TwoPlyCandidate {
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
    const nextState = applyChosenTurnCommand(state, command)
    let score: number
    if (command.kind === 'attack') {
      score =
        evaluatePlayerView(createPlayerView(state, playerId)) +
        attackBonus(state, playerId, command) +
        handManagementBonus(state, nextState, playerId, command.kind)
    } else {
      score = evaluatePlayerView(createPlayerView(nextState, playerId))
      score -= cookieSupportPenalty(state, playerId, command)
      score += handManagementBonus(state, nextState, playerId, command.kind)
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
    for (const source of getActivatableSkillSources(state.players[playerId])) {
      try {
        const decision = strategy.resolveSkill(state, playerId, source, 'activate')
        if (decision) {
          candidates.push({
            decision,
            score:
              evaluatePlayerView(createPlayerView(decision.state, playerId)) +
              skillEffectBonus(state, decision.state, playerId),
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
              evaluatePlayerView(createPlayerView(decision.state, playerId)) +
              skillEffectBonus(state, decision.state, playerId),
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
// R10 tracking (module-level counter, reset per match)
// ---------------------------------------------------------------------------

let r10PenaltyAppliedCount = 0
let r10BreakRaceRiskCount = 0
let r10ExposureRiskCount = 0

export const resetR10Counters = () => {
  r10PenaltyAppliedCount = 0
  r10BreakRaceRiskCount = 0
  r10ExposureRiskCount = 0
}

export const getR10Counters = () => ({
  penaltyApplied: r10PenaltyAppliedCount,
  breakRaceRisk: r10BreakRaceRiskCount,
  exposureRisk: r10ExposureRiskCount,
})

// ---------------------------------------------------------------------------
// Beam search — 回合層最佳行動序列規劃
// ---------------------------------------------------------------------------

/**
 * 從指定玩家視角對終局場面打分。反覆使用的基本評分單元。
 */
const stateScore = (state: GameState, playerId: PlayerId): number => {
  if (state.status === 'finished') {
    const view = createPlayerView(state, playerId)
    return evaluatePlayerView(view) + lv4RiskBonus(view, playerId)
  }
  const view = createPlayerView(state, playerId)
  return evaluatePlayerView(view) + lv4RiskBonus(view, playerId)
}

/**
 * 判定一個狀態是否不適合繼續展開 beam（回合結束、換人、有 pending、
 * 對局結束等）。
 */
const isBeamTerminal = (state: GameState, playerId: PlayerId): boolean =>
  state.status === 'finished' ||
  state.activePlayerId !== playerId ||
  !!state.pendingBattle ||
  !!state.pendingRefresh ||
  !!state.pendingReplacement ||
  !!state.pendingOnPlay

/**
 * 把單一命令應用到當前狀態，若為攻擊則自動結算整場戰鬥。
 * 回傳 (nextState, isTerminal) 供 beam 展開使用。
 */
const applyBeamAction = (
  state: GameState,
  command: PlayerActionCommand,
  playerId: PlayerId,
): { nextState: GameState; isTerminal: boolean } => {
  let next: GameState
  if (command.kind === 'attack') {
    next = beginAttack(
      state,
      command.attackerInstanceId,
      command.targetInstanceId,
      command.supportPaymentIds,
    )
  } else {
    next = applyGameCommand(state, command)
  }
  if (next.status === 'finished') return { nextState: next, isTerminal: true }

  if (command.kind === 'attack') {
    next = resolveBattleAutomatically(next)
  }
  if (next.status === 'finished') return { nextState: next, isTerminal: true }

  // advance-phase 之後 phase 會變（e.g. main → end），即終端
  const phaseChanged = next.phase !== state.phase
  const terminal = phaseChanged || isBeamTerminal(next, playerId)
  return { nextState: next, isTerminal: terminal }
}

interface BeamEntry {
  state: GameState
  firstCommand: PlayerActionCommand | null
  score: number
  isTerminal: boolean
}

/**
 * 回合層 beam search（Lv.4 核心增強）。
 *
 * 從當前 state 出發，以 beamWidth × maxDepth 枚舉同一回合內可能的
 * 行動序列，取終局 state 分數最高者，回傳該序列的「第一個動作」。
 *
 * 若回傳 null 代表 beam 尚未展開出有效動作（合法命令清單為空或全部
 * 拋例），caller 應 fallback 回傳統單步評估。
 */
const beamSearchBestFirstCommand = (
  state: GameState,
  playerId: PlayerId,
  beamWidth: number,
  maxDepth: number,
): { firstCommand: PlayerActionCommand | null; beamScore: number } => {
  let beams: BeamEntry[] = [
    {
      state,
      firstCommand: null,
      score: stateScore(state, playerId),
      isTerminal: false,
    },
  ]

  for (let depth = 0; depth < maxDepth; depth += 1) {
    if (beams.every((b) => b.isTerminal)) break

    const nextBeams: BeamEntry[] = []

    for (const beam of beams) {
      if (beam.isTerminal) {
        nextBeams.push(beam)
        continue
      }

      const commands = getLegalTurnCommands(beam.state, playerId)
      for (const cmd of commands) {
        try {
          const { nextState, isTerminal } = applyBeamAction(beam.state, cmd, playerId)
          const score = stateScore(nextState, playerId)
          nextBeams.push({
            state: nextState,
            firstCommand: beam.firstCommand ?? cmd,
            score,
            isTerminal,
          })
        } catch {
          // invalid action within beam — skip
        }
      }
    }

    if (nextBeams.length === 0) break

    // 穩定排序（deterministic tie-break）
    nextBeams.sort((a, b) => b.score - a.score)
    beams = nextBeams.slice(0, beamWidth)
  }

  const best = beams[0]
  const bestScore = best?.score ?? -Infinity
  if (!best?.firstCommand) return { firstCommand: null, beamScore: bestScore }
  // 當 beam 的「最佳序列」根本沒做事（advance-phase 是第一個命令），
  // best.firstCommand 其實就是 advance-phase；但如果 beams 只有初始
  // entry（no expansion），firstCommand 為 null，退回 fallback。
  return { firstCommand: best.firstCommand, beamScore: bestScore }
}

/**
 * Lv.4 既有核心風險評分（不可刪除）。
 * 所有因子均只使用 PlayerView 公開資訊。
 * 此函式是 Lv.4 兩層前瞻的基礎風險管理，不屬於 R10。
 * R10 只能疊加在此函式之上，不可取代或刪除。
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
      bonus -= 10
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

/**
 * R10: 對手回應風險扣分（Lv.4 專用）
 *
 * 完整版——逐步落實 docs/ai-training-rules-refined.md R10 的四項 ACTION：
 * 1) Break race risk：我方 break area 偏高時，行動導致 break 惡化 → 扣分（保留原有 guardrail）
 * 2) 攻擊者反擊暴露：攻擊動作讓 attacker 休息、且為高 Level（>=2）餅乾；
 *    若對手公開可見之反擊潛力（未休息戰鬥區攻擊力 + 手牌張數）足以擊倒
 *    該 attacker，且我方 break 中等以上（被反擊破會擴大 break race）→ 扣分。
 *
 * 此項補 lv4RiskBonus 的缺口：lv4RiskBonus 只看靜態戰鬥區 HP/數量，
 * 不讀對手 hand 與未休息 attacker 攻擊力作為「下一步反擊潛力」。
 *
 * 約定：以「負值＝風險」回傳，caller 以 `+= responseRiskPenalty(...)` 疊加，
 * score 自然被往下扣。不要在 caller 用 `-= responseRiskPenalty(...)`—
 * 那會把負號反過來、把風險變加分（歷史方向 bug 已於完整版修正）。
 *
 * 不讀取對手隱藏資訊（只讀 break area、戰鬥區、手牌張數等公開資訊）。
 * 以 penalty 為主，不做正向加分。只疊加在 lv4RiskBonus 之上，不取代。
 */
export const responseRiskPenalty = (
  preState: GameState,
  postState: GameState,
  playerId: PlayerId,
  command: PlayerActionCommand,
): number => {
  let penalty = 0
  const opponentId: PlayerId =
    playerId === 'player-one' ? 'player-two' : 'player-one'

  const preMyBreak = preState.players[playerId].breakArea.reduce(
    (s, c) => s + c.level, 0,
  )
  const postMyBreak = postState.players[playerId].breakArea.reduce(
    (s, c) => s + c.level, 0,
  )
  const breakWorsened = postMyBreak - preMyBreak

  // F0 — Break race risk（保留既有 guardrail）
  if (preMyBreak >= 8 && breakWorsened > 0) {
    penalty -= breakWorsened * 12
    r10BreakRaceRiskCount++
  }

  // F1 — 攻擊者反擊暴露（完整版新增；covers the action '短期賺分但長期崩盤'）
  if (command.kind === 'attack') {
    const postAttacker = postState.players[playerId].battleArea.find(
      (c) => c.card.instanceId === command.attackerInstanceId,
    )
    // 攻擊者若已破壞則無後續反擊窗口；F1 只關心「活著但休息且高價值」的 attacker
    if (postAttacker && postAttacker.rested && postAttacker.card.level >= 2) {
      const oppUnrestedAtk = postState.players[opponentId].battleArea
        .filter((c) => !c.rested)
        .reduce((s, c) => s + c.card.attack, 0)
      const oppHandCount = postState.players[opponentId].hand.length

      // 觸發條件全部用公開資訊：
      //  - 我方 break 中等以上（反擊破會擴大 break race）
      //  - 對手有足夠未休息攻擊力可擊倒 attacker
      //  - 對手手牌資源 proxy 達到門檻（暗示有 FLIP/trap 加碼反擊）
      const attackerHp = postAttacker.hpCards.length
      if (
        preMyBreak >= 6 &&
        oppUnrestedAtk >= attackerHp &&
        oppHandCount >= 3
      ) {
        // 罰分幅度刻意保守：基礎 12、level>=3 再加 6、opp 手牌每多 1 張加 2（最多 +6）
        penalty -= 12
        penalty -= (postAttacker.card.level - 2) * 6
        penalty -= Math.min(oppHandCount - 3, 3) * 2
        r10ExposureRiskCount++
      }
    }
  }

  if (penalty !== 0) {
    r10PenaltyAppliedCount++
  }

  return penalty
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
    let nextState: GameState
    if (command.kind === 'attack') {
      nextState = beginAttack(
        state,
        command.attackerInstanceId,
        command.targetInstanceId,
        command.supportPaymentIds,
      )
    } else {
      nextState = applyGameCommand(state, command)
    }
    if (nextState.status === 'finished') {
      const view = createPlayerView(nextState, playerId)
      return evaluatePlayerView(view) + lv4RiskBonus(view, playerId)
    }

    let resolved = nextState
    if (command.kind === 'attack') {
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
      // R9: 致命傷害偵測（Lv.4 專用）
      score += lethalDetectionBonus(state, playerId, command)
    }

    // R10: 對手回應風險扣分（Lv.4 專用）
    // responseRiskPenalty 回傳非正值（負＝風險），以 += 疊加做扣分。
    score += responseRiskPenalty(state, resolved, playerId, command)

    // R8: 手牌數量管理
    score += handManagementBonus(state, resolved, playerId, command.kind)

    // 支援放置懲罰（餅乾放支援區浪費；能量不足時不懲罰以利鋪能量）
    score -= cookieSupportPenalty(state, playerId, command)

    return score
  } catch {
    return -999999
  }
}

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

  // ── Beam search 回合層序列規劃 ──
  // beam 探索最多 3 步 deep，同層保留 top 3 序列。
  // 攻擊自動結算整場戰鬥；終端 state 直接以 stateScore 打分。
  const beamWidth = 3
  const maxBeamDepth = 3
  const beamResult = beamSearchBestFirstCommand(
    state,
    playerId,
    beamWidth,
    maxBeamDepth,
  )

  const candidates: TwoPlyCandidate[] = []

  if (beamResult.firstCommand) {
    const decisionState = applyChosenTurnCommand(state, beamResult.firstCommand)
    candidates.push({
      decision: {
        state: decisionState,
        action: commandActionTypes[beamResult.firstCommand.kind],
        description: describeCommand(state, playerId, beamResult.firstCommand),
      },
      score: beamResult.beamScore,
    })
  }

  // fallback：beam 若找不到有效動作，退一步用單指令枚舉
  if (candidates.length === 0) {
    for (const command of getLegalTurnCommands(state, playerId)) {
      const score = twoPlyCandidateScore(state, playerId, command)
      try {
        candidates.push({
          decision: {
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
  }

  if (state.phase === 'main') {
    for (const source of getActivatableSkillSources(state.players[playerId])) {
      try {
        const decision = strategy.resolveSkill(state, playerId, source, 'activate')
        if (decision) {
          const view = createPlayerView(decision.state, playerId)
          const score =
            evaluatePlayerView(view) +
            lv4RiskBonus(view, playerId) +
            skillEffectBonus(state, decision.state, playerId)
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
          const score =
            evaluatePlayerView(view) +
            lv4RiskBonus(view, playerId) +
            skillEffectBonus(state, decision.state, playerId)
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
