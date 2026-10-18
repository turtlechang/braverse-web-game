import { applyGameCommand, type AttackCommand, type PlayerActionCommand } from '../commands'
import { getStageActivationSource } from '../card-abilities'
import { createPublicAttackAllocationForecast } from './attack-allocation'
import { forecastPublicAttackAftereffectValue } from './optional-attack-aftereffect'
import { forecastPublicSupportReentry } from './support-reentry-followup'
import { getAttackDamageAgainst } from '../effects'
import { getCookieEffectiveLevel } from '../helpers'
import { getLegalTurnCommands } from '../legal-actions'
import { canActivateCookieSkill, getActivatableSkillSources } from '../skills'
import { maskGameStateForViewer } from '../masked-state'
import { createPlayerView } from '../player-view'
import { hasBlockingPending } from '../pending'
import type { PlayerView } from '../player-view'
import type { GameState, PlayerId } from '../types'
import type { AiDecision } from './types'
import type { ActionScoreBreakdown } from './strategy/action-score'
import {
  applyChosenTurnCommand,
  commandActionTypes,
  describeCommand,
} from './random-turn-handler'
import {
  actionIdentityFromCommand,
  createLv3ContextForView,
  legalActionIdentityKey,
  scoreLv3ActionCandidate,
  selectBestLv3Action,
  type ScoredLv3ActionCandidate,
} from './strategy/lv3-strategy'
import {
  createKnowledgeStateFromPlayerView,
  synchronizeKnowledgeWithPlayerView,
} from './strategy/knowledge-state'
import {
  DEFAULT_LV4_SEARCH_OPTIONS,
  DEFAULT_LV5_SEARCH_OPTIONS,
  searchLv4Commands,
  selectLv4StrategicContribution,
  type Lv4SearchHooks,
} from './strategy/lv4-search'
import { createLv4SearchTelemetry } from './strategy/search-telemetry'
import { handleAiTurnState, type AiTurnStrategy } from './turn-handler'
import {
  assessLv5Deployment,
  isAllowedAiDeploymentCommand,
} from './deployment-policy'
import {
  evaluatePublicResponseMinimax,
  type OpponentResponseEstimate,
} from './strategy/opponent-response'
import { assessLv5DefensiveReserve } from './strategy/defensive-reserve'
import {
  assessLv5EndgameSurvival,
  type EndgameSurvivalAssessment,
} from './strategy/endgame-survival'
import { scoreIntentContinuity } from './strategy/session'
import { scoreTournamentExperience } from './strategy/tournament-experience'
import {
  forecastOpponentEndgame,
  type OpponentEndgameForecast,
} from './strategy/endgame-forecast'
import {
  capabilitiesForVisibleCard,
  deriveTacticalPlan,
  findVisibleSelfCard,
  type ActionablePayoffSource,
  type TacticalPlan,
} from './strategy/tactical-plans'
import {
  evaluatePlayerView,
  evaluatePlayerViewBreakdown,
  type PublicStateEvaluationBreakdown,
} from './strategy/state-evaluation'

// 保留既有公開匯出，讓 Lv.3 測試與其他呼叫端不必改變 import 路徑。
export { evaluatePlayerView, evaluatePlayerViewBreakdown }
export type { PublicStateEvaluationBreakdown }

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
  const damage = getAttackDamageAgainst(state, command.attackerInstanceId, command.targetInstanceId)
  const lethal = target.hpCards.length <= damage
  const bonus = lethal
    ? 350 + getCookieEffectiveLevel(target) * 30
    : Math.min(damage, target.hpCards.length) * 30
  const priorDamage = Math.max(0, target.card.hp - target.hpCards.length)
  const focusFireBonus = lethal ? 0 : Math.min(priorDamage, 3)
  return bonus + focusFireBonus - command.supportPaymentIds.length * 6
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

/** Value an affordable public On Play continuation without settling real state. */
const forecastOnPlayResourceFollowup = (
  state: GameState,
  playerId: PlayerId,
  command: PlayerActionCommand,
  resolveSkill: AiTurnStrategy['resolveSkill'],
  before?: GameState,
): ActionScoreBreakdown['contributions'][number] | null => {
  if (command.kind !== 'deploy-cookie' ||
      state.pendingOnPlay?.sourceInstanceId !== command.instanceId ||
      state.pendingOnPlay.playerId !== playerId) return null
  // Resolve only a masked forecast. Hidden HP can contain a rescuing FLIP;
  // this estimates a continuation, never a guaranteed win or actual settlement.
  const masked = maskGameStateForViewer({ ...state, commandLog: undefined }, playerId)
  const source = masked.players[playerId].battleArea.find(
    cookie => cookie.card.instanceId === command.instanceId,
  )
  const skill = source?.card.skill
  if (!source || skill?.trigger !== 'on-play' || skill.effects.length === 0 ||
      skill.effects.some(effect => {
        if (effect.kind === 'damage') return effect.condition !== undefined
        const publicResource = effect.kind === 'draw-up-to' || effect.kind === 'trash-to-hand' ||
          (effect.kind === 'draw' && (effect.side === undefined || effect.side === 'self'))
        return !publicResource || (effect.condition !== undefined && effect.condition.kind !== 'hand-count-at-most')
      })) return null
  const allowedCosts = new Set(['energy', 'discardHand', 'discardHandColor', 'discardHandCookieOnly'])
  if (Object.entries(skill.cost).some(([key, value]) =>
    value !== undefined && !allowedCosts.has(key),
  ) || !canActivateCookieSkill(masked, playerId, command.instanceId, 'on-play')) return null
  let followup = resolveSkill(masked, playerId, source, 'on-play')
  if (!followup || followup.action !== 'activate-skill') return null
  if (followup.state.pendingRefresh) return null
  const pendingDraw = followup.state.pendingDrawUpTo
  if (pendingDraw) {
    // Drawing unknown backs values quantity only. Do not model a Refresh or
    // its additional costs as if the whole resource continuation had settled.
    if (pendingDraw.playerId !== playerId || pendingDraw.max >= masked.players[playerId].deck.length) return null
    followup = { ...followup, state: applyGameCommand(followup.state, {
      kind: 'resolve-draw-up-to', playerId, drawCount: pendingDraw.max,
    }) }
  }
  if (followup.state.pendingRefresh) return null
  // Deployment already has its own score. Value the net resource change of
  // deployment + On Play, rather than treating a spent hand card as free.
  const effectBonus = before
    ? skillEffectBonus(before, followup.state, playerId) - skillEffectBonus(before, masked, playerId)
    : skillEffectBonus(masked, followup.state, playerId)
  const amount = Math.min(200, Math.max(0,
    evaluatePlayerView(createPlayerView(followup.state, playerId)) -
    evaluatePlayerView(createPlayerView(masked, playerId)) +
    effectBonus + onPlayHandPenaltyRefund(before, masked, followup.state, playerId, command.kind),
  ))
  return amount > 0 ? {
    id: 'on-play-followup', amount,
    detail: '條件式登場續接：按公開資源估計傷害、抽牌張數與棄牌回收，合併登場消耗計分；未知牌面與 HP／FLIP 不視為保證收益，實際效果仍另行結算。',
  } : null
}

/** Conditional Special Play payoff after the real On Play/replacement decisions.
 * Only the masked forecast is advanced; real Trap/FLIP responses remain open.
 */
export const forecastOnPlayFollowup = (
  state: GameState,
  playerId: PlayerId,
  command: PlayerActionCommand,
  resolveSkill: AiTurnStrategy['resolveSkill'],
  before?: GameState,
): ActionScoreBreakdown['contributions'][number] | null => {
  const resource = forecastOnPlayResourceFollowup(state, playerId, command, resolveSkill, before)
  if (command.kind !== 'deploy-cookie' || !command.specialPlayCookieInstanceIds?.length ||
      state.pendingOnPlay?.playerId !== playerId ||
      state.pendingOnPlay.sourceInstanceId !== command.instanceId) return resource

  let forecast = maskGameStateForViewer({ ...state, commandLog: undefined }, playerId)
  const opponentId = playerId === 'player-one' ? 'player-two' : 'player-one'
  const breakLevel = forecast.players[opponentId].breakArea.reduce((sum, card) => sum + card.level, 0)
  if (!forecast.players[opponentId].battleArea.some(target =>
    breakLevel + getCookieEffectiveLevel(target) >= 10,
  )) return resource
  const source = forecast.players[playerId].battleArea.find(cookie => cookie.card.instanceId === command.instanceId)
  const skill = source?.card.skill
  // Exclude conditional/mixed effects and attacks whose Then needs more choices.
  if (!source || skill?.trigger !== 'on-play' || skill.effects.length !== 1 ||
      skill.effects[0].kind !== 'damage' || skill.effects[0].condition ||
      source.card.attackEffects?.length) return resource
  const knownCosts = new Set(['energy', 'discardHand', 'discardHandColor', 'discardHandCookieOnly'])
  if (Object.entries(skill.cost).some(([key, value]) =>
    value !== undefined && !knownCosts.has(key),
  )) return resource
  const resolved = canActivateCookieSkill(forecast, playerId, command.instanceId, 'on-play')
    ? resolveSkill(forecast, playerId, source, 'on-play') : null
  forecast = resolved?.action === 'activate-skill' ? resolved.state : applyGameCommand(forecast, {
    kind: 'skip-on-play', playerId, sourceInstanceId: command.instanceId,
  })
  for (let count = 0; forecast.pendingReplacement && count < 4; count++) {
    const skip = getLegalTurnCommands(forecast, playerId).find(candidate => candidate.kind === 'skip-replacement')
    if (!skip) return resource
    forecast = applyGameCommand(forecast, skip)
  }
  if (hasBlockingPending(forecast) || forecast.status !== 'playing') return resource
  let amount = 0
  for (const attack of getLegalTurnCommands(forecast, playerId)) {
    if (attack.kind !== 'attack' || attack.attackerInstanceId !== command.instanceId) continue
    const target = forecast.players[opponentId].battleArea.find(cookie => cookie.card.instanceId === attack.targetInstanceId)
    if (!target || breakLevel + getCookieEffectiveLevel(target) < 10 ||
        target.hpCards.length > getAttackDamageAgainst(forecast, command.instanceId, attack.targetInstanceId)) continue
    amount = Math.max(amount, attackBonus(forecast, playerId, attack) + lethalDetectionBonus(forecast, playerId, attack))
  }
  return amount > 0 ? {
    id: 'on-play-followup', amount: Math.max(resource?.amount ?? 0, amount),
    detail: '條件式特殊登場續接：依公開 HP 與實際剩餘支付資源預估後續補刀，真正陷阱／FLIP 回應仍另行結算。',
  } : resource
}

/** An attack can rest supports that a later Activate removes as its cost.
 * Forecast only the same visible source's simple follow-up. The real battle
 * still stops for responses; no forecast state is returned to the game.
 */
const forecastSupportCostFollowup = (
  before: GameState,
  afterAttack: GameState,
  playerId: PlayerId,
  command: PlayerActionCommand,
  resolveSkill: AiTurnStrategy['resolveSkill'],
): ActionScoreBreakdown['contributions'][number] | null => {
  if (command.kind !== 'attack') return null
  const source = afterAttack.players[playerId].battleArea.find(
    cookie => cookie.card.instanceId === command.attackerInstanceId,
  )
  const skill = source?.card.skill
  if (!source || skill?.trigger !== 'activate' || skill.restSource ||
      (source.card.attackEffects?.length ?? 0) > 0 ||
      (skill.cost.supportToHand ?? 0) + (skill.cost.supportToTrash ?? 0) === 0) return null
  // Limit this forecast to known support/hand costs and simple public HP
  // effects. Mixed HP costs, draws and unmodelled conditions must not expose
  // hidden card faces while estimating an otherwise legal continuation.
  const knownCostFields = new Set([
    'energy', 'red', 'yellow', 'green', 'blue', 'purple', 'black', 'neutral',
    'discardHand', 'supportToHand', 'supportToHandColor', 'supportToHandType',
    'supportToHandKeyword', 'supportToTrash', 'supportToTrashKeyword',
  ])
  if (Object.entries(skill.cost).some(([key, value]) =>
    value !== undefined && !knownCostFields.has(key),
  ) || skill.effects.length === 0 || skill.effects.some(effect =>
    (effect.kind !== 'hp-to-trash' && effect.kind !== 'gain-hp') ||
    (effect.condition !== undefined &&
      effect.condition.kind !== 'battle-area-has-named-cookie'),
  )) return null
  // This is a conditional forecast after the response window, not a simulated
  // choice of Trap/FLIP. Unknown draws and further pending decisions are excluded.
  const forecast = { ...afterAttack, pendingBattle: null }
  const followup = resolveSkill(forecast, playerId, source, 'activate')
  if (!followup || followup.state.status !== 'playing' ||
      hasBlockingPending(followup.state)) return null
  const knownHandIds = new Set([
    ...before.players[playerId].hand.map(card => card.instanceId),
    ...before.players[playerId].supportArea.map(support => support.card.instanceId),
  ])
  if (followup.state.players[playerId].hand.some(card => !knownHandIds.has(card.instanceId))) return null
  const amount = Math.min(200, Math.max(0,
    evaluatePlayerView(createPlayerView(followup.state, playerId)) -
    evaluatePlayerView(createPlayerView(forecast, playerId)) +
    skillEffectBonus(forecast, followup.state, playerId),
  ))
  return amount > 0 ? {
    id: 'support-cost-followup', amount,
    detail: '條件式續接：若攻擊回應後來源與支援仍在場，可支付 Activate 能量並回收／棄置已疲勞支援；未替對手略過回應。',
  } : null
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

  const damage = getAttackDamageAgainst(state, command.attackerInstanceId, command.targetInstanceId)
  const targetHp = target.hpCards.length
  const isLethal = targetHp <= damage

  let bonus = 0

  // 1. 直接致勝：擊倒後對手 break area 達到勝利條件（>=10）
  const oppBreakLevel = state.players[opponentId].breakArea.reduce(
    (sum, c) => sum + c.level, 0,
  )
  const projectedBreak = oppBreakLevel + getCookieEffectiveLevel(target)
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
      .reduce((sum, c) => sum + getAttackDamageAgainst(state, c.card.instanceId, command.targetInstanceId), 0)
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

/** Refund only a temporary depletion penalty that the same On Play repairs.
 * Cap the hand at its original size so this does not award draw value twice,
 * and never introduce a new hoarding penalty into an otherwise useful draw.
 */
const onPlayHandPenaltyRefund = (
  before: GameState | undefined,
  deployed: GameState,
  settled: GameState,
  playerId: PlayerId,
  actionKind: string,
): number => {
  if (!before || settled.players[playerId].hand.length <= deployed.players[playerId].hand.length) return 0
  const restored = { ...settled, players: { ...settled.players, [playerId]: {
    ...settled.players[playerId],
    hand: settled.players[playerId].hand.slice(0, before.players[playerId].hand.length),
  } } }
  return Math.max(0,
    Math.min(0, handManagementBonus(before, restored, playerId, actionKind)) -
    Math.min(0, handManagementBonus(before, deployed, playerId, actionKind)),
  )
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

/**
 * Lv.4 的 beam 只展開自己的回合，若沒有額外節奏修正，容易把「保留
 * 支援卡與未休息攻擊者」高估成優勢，直接結束主階段而放棄已可支付的
 * 攻擊。只在主階段仍存在合法 attack command 時處罰 advance-phase；
 * 攻擊者都已休息、能量不足或沒有對手目標時不產生懲罰。
 */
const unspentAttackOpportunityPenalty = (
  state: GameState,
  playerId: PlayerId,
  command: PlayerActionCommand,
): number => {
  if (command.kind !== 'advance-phase' || state.phase !== 'main') return 0

  const attacks = getLegalTurnCommands(state, playerId).filter(
    (candidate): candidate is AttackCommand => candidate.kind === 'attack',
  )
  if (attacks.length === 0) return 0

  const bestDamage = Math.max(
    ...attacks.map((attack) =>
      getAttackDamageAgainst(state, attack.attackerInstanceId, attack.targetInstanceId),
    ),
  )
  return -(50 + Math.min(bestDamage, 3) * 10)
}

const commandCandidate = (
  state: GameState,
  playerId: PlayerId,
  command: PlayerActionCommand,
  beforeView: PlayerView,
  context: ReturnType<typeof createLv3ContextForView>,
  legalAttackCountBefore: number,
  strategy: AiTurnStrategy,
  includeSupportCostFollowup = false,
): ScoredLv3ActionCandidate<AiDecision> | null => {
  if (!isAllowedAiDeploymentCommand(state, playerId, command)) return null
  if (
    strategy.conservativeDeployment &&
    command.kind === 'deploy-cookie' &&
    command.instanceId
  ) {
    const card = state.players[playerId].hand.find(
      (candidate) => candidate.instanceId === command.instanceId,
    )
    if (card && assessLv5Deployment(state, playerId, card, {
      confirmedCombo:
        strategy.strategyMemory?.activeCombo?.payoffCardId === card.id,
    }).reason === 'single-cookie-discipline') {
      return null
    }
  }

  try {
    const nextState = applyChosenTurnCommand(state, command)
    const afterView = createPlayerView(nextState, playerId)
    const decision: AiDecision = {
        state: nextState,
        action: commandActionTypes[command.kind],
        description: describeCommand(state, playerId, command),
    }
    const scored = scoreLv3ActionCandidate(context, beforeView, {
      value: decision,
      identity: actionIdentityFromCommand(command),
      afterView,
      // 攻擊進入 pending battle，尚未翻開 HP；以攻擊前公開盤面為基準，
      // 傷害與致命價值由純 PlayerView 評分模組加入。
      postActionBoardScore: command.kind === 'attack'
        ? evaluatePlayerView(beforeView)
        : evaluatePlayerView(afterView),
      legalAttackCountBefore,
      legalAttackCountAfter: command.kind === 'attack'
        ? 0
        : getLegalTurnCommands(nextState, playerId).filter(
          (candidate) => candidate.kind === 'attack',
        ).length,
      publicAttackDamage: command.kind === 'attack'
        ? getAttackDamageAgainst(
          state,
          command.attackerInstanceId,
          command.targetInstanceId,
        )
        : undefined,
      conditionalAttackAftereffectValue: command.kind === 'attack'
        ? forecastPublicAttackAftereffectValue(state, nextState, command)
        : undefined,
    })
    const supportCostFollowup = includeSupportCostFollowup
      ? forecastSupportCostFollowup(
        state,
        nextState,
        playerId,
        command,
        strategy.resolveSkill,
      )
      : null
    return supportCostFollowup ? {
      ...scored,
      breakdown: {
        ...scored.breakdown,
        total: scored.breakdown.total + supportCostFollowup.amount,
        contributions: [...scored.breakdown.contributions, supportCostFollowup],
      },
    } : scored
  } catch {
    return null
  }
}

const visibleCardInstanceIds = (view: PlayerView): Set<string> => new Set([
  ...view.hand,
  ...(view.extraDeck ?? []),
  ...[view.self, view.opponent].flatMap(side => [
    ...side.battleArea.flatMap(cookie => [
      cookie.card,
      ...(cookie.faceUpHpCards ?? []).map(hp => hp.card),
    ]),
    ...side.supportArea.map(support => support.card),
    ...side.breakArea,
    ...side.discardPile,
    ...(side.stage ? [side.stage.card] : []),
  ]),
].map(card => card.instanceId))

/**
 * A Lv.3 setup may have little immediate board value while making a real
 * follow-up command legal (for example, lowering a Cookie's level so it can
 * pay a Special Play cost). Value only commands newly exposed by the setup,
 * using the same public-state scorer as ordinary root candidates.
 */
const addNewlyLegalFollowupValue = (
  scored: ScoredLv3ActionCandidate<AiDecision>,
  beforeState: GameState,
  afterState: GameState,
  playerId: PlayerId,
  context: ReturnType<typeof createLv3ContextForView>,
  strategy: AiTurnStrategy,
): ScoredLv3ActionCandidate<AiDecision> => {
  const reentry = scorePublicSupportReentry(scored.breakdown, beforeState, afterState, playerId, strategy)
  if (reentry) return {
    ...scored,
    breakdown: {
      ...scored.breakdown,
      total: scored.breakdown.total + reentry.amount,
      contributions: [...scored.breakdown.contributions, reentry],
    },
  }
  if (
    beforeState.status !== 'playing' || afterState.status !== 'playing' ||
    beforeState.phase !== 'main' || afterState.phase !== 'main' ||
    beforeState.activePlayerId !== playerId || afterState.activePlayerId !== playerId ||
    beforeState.turnNumber !== afterState.turnNumber ||
    hasBlockingPending(afterState) || afterState.pendingEffectOrder
  ) return scored

  const beforeView = createPlayerView(beforeState, playerId)
  const afterView = createPlayerView(afterState, playerId)
  const knownIds = visibleCardInstanceIds(beforeView)
  if ([...visibleCardInstanceIds(afterView)].some(id => !knownIds.has(id))) return scored

  // A reveal may return a card to its hidden zone, and a shuffle may happen to
  // reveal a previously known card. Neither outcome is known before acting.
  const source = findVisibleSelfCard(beforeView, scored.candidate.identity.sourceInstanceId)
  const capabilities = capabilitiesForVisibleCard(context, source?.id)
  if (capabilities.some(capability =>
    capability.kind === 'inspect-deck' ||
    capability.effectKind === 'hand-to-deck-and-draw' ||
    capability.effectKind === 'trash-to-deck-all' ||
    capability.effectKind === 'opponent-random-discard' ||
    (capability.effectKind === 'trash-to-deck' && capability.destinationZone !== 'deck-bottom') ||
    Boolean(capability.cost?.trashToDeck),
  )) return scored

  const beforeCommands = new Set(
    getLegalTurnCommands(beforeState, playerId).map(legalActionIdentityKey),
  )
  const afterCommands = getLegalTurnCommands(afterState, playerId)
  const legalAttackCount = afterCommands.filter((command) => command.kind === 'attack').length
  const currentBoardScore = evaluatePlayerView(afterView)
  let bestFollowupValue = 0

  for (const command of afterCommands) {
    if (beforeCommands.has(legalActionIdentityKey(command))) continue
    const candidate = commandCandidate(
      afterState,
      playerId,
      command,
      afterView,
      context,
      legalAttackCount,
      strategy,
    )
    if (candidate) {
      bestFollowupValue = Math.max(
        bestFollowupValue,
        candidate.breakdown.total - currentBoardScore,
      )
    }
  }

  if (bestFollowupValue <= 0) return scored
  const followup = {
    id: 'legal-action-followup' as const,
    amount: bestFollowupValue,
    detail: '此技能使下一步新增合法行動；依公開局面估計其中最高後續價值。',
  }
  return {
    ...scored,
    breakdown: {
      ...scored.breakdown,
      total: scored.breakdown.total + followup.amount,
      contributions: [...scored.breakdown.contributions, followup],
    },
  }
}

const scorePublicSupportReentry = (
  breakdown: ActionScoreBreakdown,
  before: GameState,
  after: GameState,
  owner: PlayerId,
  strategy: AiTurnStrategy,
): ActionScoreBreakdown['contributions'][number] | null => {
  let value = 0
  for (const forecast of forecastPublicSupportReentry(before, after, owner, strategy)) {
    const boardRestoration = evaluatePlayerView(createPlayerView(forecast.reentryState, owner)) -
      evaluatePlayerView(createPlayerView(forecast.parentState, owner))
    for (const attack of forecast.attacks) {
      // Existing attack value includes its actual energy payment. Discount and
      // cap the attack portion because hidden FLIPs/responses remain unresolved.
      const attackValue = Math.min(250, Math.floor(0.75 * (
        attackBonus(forecast.reentryState, owner, attack) +
        lethalDetectionBonus(forecast.reentryState, owner, attack)
      )))
      value = Math.max(value, boardRestoration + attackValue)
    }
  }
  const overlap = breakdown.contributions.reduce((sum, contribution) =>
    contribution.id === 'tactical-setup' || contribution.id === 'tactical-payoff' ||
    contribution.id === 'legal-action-followup' || contribution.id === 'support-cost-followup'
      ? sum + Math.max(0, contribution.amount) : sum, 0)
  const amount = Math.max(0, value - overlap)
  return amount > 0 ? {
    id: 'support-reentry-followup', amount,
    detail: '公開條件式續接：支付移入支援及再登場的代價後，同張餅乾有合法普通攻擊；未結算隱藏 FLIP。',
  } : null
}

/**
 * A speculative post-attack skill must not erase the value of an available
 * public knockout. Keep the forecast when it fits below the strongest lethal
 * attack, and cap only the portion that would make a nonlethal attack win.
 */
const capSupportFollowupAgainstPublicLethal = (
  candidates: readonly ScoredLv3ActionCandidate<AiDecision>[],
): ScoredLv3ActionCandidate<AiDecision>[] => {
  const bestLethalScore = candidates.reduce((best, candidate) =>
    candidate.candidate.identity.kind === 'attack' &&
      candidate.breakdown.calibrated.publicLethal
      ? Math.max(best, candidate.breakdown.total)
      : best,
  Number.NEGATIVE_INFINITY)
  if (!Number.isFinite(bestLethalScore)) return [...candidates]

  return candidates.map((candidate) => {
    if (candidate.candidate.identity.kind !== 'attack' ||
        candidate.breakdown.calibrated.publicLethal) return candidate
    const followup = candidate.breakdown.contributions.find(
      (contribution) => contribution.id === 'support-cost-followup',
    )
    if (!followup) return candidate

    const scoreWithoutFollowup = candidate.breakdown.total - followup.amount
    const allowedFollowup = Math.max(
      0,
      bestLethalScore - scoreWithoutFollowup - 1,
    )
    if (allowedFollowup >= followup.amount) return candidate

    const contributions = candidate.breakdown.contributions.flatMap((contribution) => {
      if (contribution.id !== 'support-cost-followup') return [contribution]
      if (allowedFollowup <= 0) return []
      return [{
        ...contribution,
        amount: allowedFollowup,
        detail: `${contribution.detail}；受公開致命攻擊的同局評分限制。`,
      }]
    })
    return {
      ...candidate,
      breakdown: {
        ...candidate.breakdown,
        total: scoreWithoutFollowup + allowedFollowup,
        contributions,
      },
    }
  })
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

  const beforeView = createPlayerView(state, playerId)
  const knowledgeState = strategy.knowledgeState?.observerId === playerId
    ? synchronizeKnowledgeWithPlayerView(strategy.knowledgeState, beforeView)
    : createKnowledgeStateFromPlayerView(beforeView)
  // KnowledgeState 只從 PlayerView 與已知事件建立；不把 GameState 暴露給策略。
  strategy.knowledgeState = knowledgeState
  const context = createLv3ContextForView(beforeView, knowledgeState)
  const legalAttackCountBefore = getLegalTurnCommands(state, playerId).filter(
    (candidate) => candidate.kind === 'attack',
  ).length
  const candidates: ScoredLv3ActionCandidate<AiDecision>[] = []
  const attackAllocation = createPublicAttackAllocationForecast()

  for (const command of getLegalTurnCommands(state, playerId)) {
    const candidate = commandCandidate(
      state,
      playerId,
      command,
      beforeView,
      context,
      legalAttackCountBefore,
      strategy,
      true,
    )
    if (candidate) {
      const allocation = attackAllocation(state, playerId, command)
      const allocated = allocation ? { ...candidate, breakdown: {
        ...candidate.breakdown,
        total: candidate.breakdown.total + allocation.amount,
        contributions: [...candidate.breakdown.contributions, allocation],
      } } : candidate
      const opensMainPhaseFollowup = state.phase === 'main' &&
        (command.kind === 'deploy-cookie' || command.kind === 'play-extra-deck-cookie')
      candidates.push(opensMainPhaseFollowup
        ? addNewlyLegalFollowupValue(
            allocated,
            state,
            candidate.candidate.value.state,
            playerId,
            context,
            strategy,
          )
        : allocated)
    }
  }

  if (state.phase === 'main') {
    for (const source of getActivatableSkillSources(state.players[playerId])) {
      try {
        const decision = strategy.resolveSkill(state, playerId, source, 'activate')
        if (decision) {
          const afterView = createPlayerView(decision.state, playerId)
          const scored = scoreLv3ActionCandidate(context, beforeView, {
            value: decision,
            identity: {
              kind: 'activate-skill',
              sourceInstanceId: source.card.instanceId,
            },
            afterView,
            postActionBoardScore: evaluatePlayerView(afterView),
            legalAttackCountBefore,
            legalAttackCountAfter: getLegalTurnCommands(
              decision.state,
              playerId,
            ).filter((candidate) => candidate.kind === 'attack').length,
          })
          candidates.push(addNewlyLegalFollowupValue(
            scored,
            state,
            decision.state,
            playerId,
            context,
            strategy,
          ))
        }
      } catch {
        // skip invalid skill resolution
      }
    }
    for (const card of state.players[playerId].hand) {
      try {
        const decision = strategy.resolveCardAbility(state, playerId, card)
        if (decision) {
          const afterView = createPlayerView(decision.state, playerId)
          const scored = scoreLv3ActionCandidate(context, beforeView, {
            value: decision,
            identity: {
              kind: `activate-${card.type}`,
              sourceInstanceId: card.instanceId,
            },
            afterView,
            postActionBoardScore: evaluatePlayerView(afterView),
            legalAttackCountBefore,
            legalAttackCountAfter: getLegalTurnCommands(
              decision.state,
              playerId,
            ).filter((candidate) => candidate.kind === 'attack').length,
          })
          candidates.push(addNewlyLegalFollowupValue(
            scored,
            state,
            decision.state,
            playerId,
            context,
            strategy,
          ))
        }
      } catch {
        // skip invalid card ability resolution
      }
    }

    // `getLegalTurnCommands` deliberately excludes stage activation because
    // it may contain target／choose-one effects.  Evaluate the already legal
    // turn-handler decision as an additional root candidate so Lv.3 does not
    // treat `advance-phase` as the only option when a stage ability is ready.
    const stageSource = getStageActivationSource(state, playerId)
    const stageDecision = stageSource
      ? handleAiTurnState(state, playerId, strategy)
      : null
    if (stageDecision?.action === 'activate-stage' && stageSource) {
      const afterView = createPlayerView(stageDecision.state, playerId)
      const scored = scoreLv3ActionCandidate(context, beforeView, {
        value: stageDecision,
        identity: {
          kind: 'activate-stage',
          sourceInstanceId: stageSource.stage.card.instanceId,
        },
        afterView,
        postActionBoardScore: evaluatePlayerView(afterView),
        legalAttackCountBefore,
        legalAttackCountAfter: getLegalTurnCommands(
          stageDecision.state,
          playerId,
        ).filter((candidate) => candidate.kind === 'attack').length,
      })
      candidates.push(addNewlyLegalFollowupValue(
        scored,
        state,
        stageDecision.state,
        playerId,
        context,
        strategy,
      ))
    }
  }

  if (candidates.length === 0) {
    const fallback = handleAiTurnState(state, playerId, strategy)
    return fallback.reason ? fallback : { ...fallback, reason: { level: 3 } }
  }

  const best = selectBestLv3Action(capSupportFollowupAgainstPublicLethal(candidates))
  if (!best) {
    const fallback = handleAiTurnState(state, playerId, strategy)
    return fallback.reason ? fallback : { ...fallback, reason: { level: 3 } }
  }

  return {
    ...best.candidate.value,
    reason: {
      level: 3,
      consideredCommands: candidates.length,
      chosenCommandKind: best.candidate.identity.kind,
      actionScore: best.breakdown,
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

/**
 * R8～R11 的公開單步風險／機會修正。G4 會在每個合法 command 過渡
 * 套用此分數，但攻擊一建立 pending battle 就停止搜尋；不會自動略過
 * 防守方的 blocker、陷阱、FLIP 或 replacement 決策。
 */
const beamStepBonus = (
  preState: GameState,
  postState: GameState,
  playerId: PlayerId,
  command: PlayerActionCommand,
): number => {
  if (postState.status === 'finished') return 0

  let bonus = 0
  if (command.kind === 'attack') {
    bonus += attackBonus(preState, playerId, command)
    bonus += lethalDetectionBonus(preState, playerId, command)
  }
  bonus += responseRiskPenalty(preState, postState, playerId, command)
  bonus += handManagementBonus(preState, postState, playerId, command.kind)
  bonus -= cookieSupportPenalty(preState, playerId, command)
  bonus += unspentAttackOpportunityPenalty(preState, playerId, command)
  return bonus
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
    if (postAttacker && postAttacker.rested && getCookieEffectiveLevel(postAttacker) >= 2) {
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
        penalty -= (getCookieEffectiveLevel(postAttacker) - 2) * 6
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

const isLv4SearchTerminal = (
  state: GameState,
  playerId: PlayerId,
): boolean =>
  state.status !== 'playing' ||
  state.activePlayerId !== playerId ||
  hasBlockingPending(state) ||
  !!state.pendingEffectOrder ||
  state.phase === 'end' ||
  state.phase === 'active'

const canContinueFromKnownHand = (
  beforeView: PlayerView,
  afterView: PlayerView,
): boolean => {
  const beforeHandIds = new Set(beforeView.hand.map((card) => card.instanceId))
  return afterView.hand.every((card) => beforeHandIds.has(card.instanceId))
}

const terminalRankForDecision = (
  decision: AiDecision,
  playerId: PlayerId,
): number => {
  if (decision.state.status !== 'finished') return 1
  return decision.state.result?.winnerId === playerId ? 2 : 0
}

interface Lv4RootCandidate {
  decision: AiDecision
  relativeScore: number
  tieBreakKey: string
  actionScore: NonNullable<AiDecision['reason']>['actionScore']
  telemetry: ReturnType<typeof createLv4SearchTelemetry>
  opponentResponse: OpponentResponseEstimate
  opponentEndgame: OpponentEndgameForecast
  endgameSurvival?: EndgameSurvivalAssessment
  tacticalPlan?: TacticalPlan
}

const chooseBestLv4Candidate = (
  candidates: readonly Lv4RootCandidate[],
  playerId: PlayerId,
): Lv4RootCandidate | null => {
  if (candidates.length === 0) return null
  return candidates.reduce((best, candidate) => {
    const candidateRank = terminalRankForDecision(candidate.decision, playerId)
    const bestRank = terminalRankForDecision(best.decision, playerId)
    if (candidateRank !== bestRank) {
      return candidateRank > bestRank ? candidate : best
    }
    if (candidate.relativeScore !== best.relativeScore) {
      return candidate.relativeScore > best.relativeScore ? candidate : best
    }
    return candidate.tieBreakKey.localeCompare(best.tieBreakKey) < 0
      ? candidate
      : best
  })
}

export const handleAiTwoPlyTurnState = (
  state: GameState,
  playerId: PlayerId,
  strategy: AiTurnStrategy,
): AiDecision => {
  const decisionLevel = strategy.currentLevel === 5 ? 5 : 4
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
    if (delegated.reason) {
      return {
        ...delegated,
        reason: { ...delegated.reason, level: decisionLevel },
      }
    }
    return {
      ...delegated,
      reason: {
        level: decisionLevel,
        consideredCommands: 0,
        chosenCommandKind: delegated.action,
      },
    }
  }

  // Lv.4 預算中斷回退 G3；Lv.5 回退 Lv.4。reason 保持呼叫層級，讓
  // benchmark 能辨識安全降階，而不是把 fallback 誤當成低階對局。
  const previousLevel = strategy.currentLevel
  strategy.currentLevel = decisionLevel === 5 ? 4 : 3
  let baseline: AiDecision
  try {
    baseline = decisionLevel === 5
      ? handleAiTwoPlyTurnState(state, playerId, strategy)
      : handleAiEvaluatedTurnState(state, playerId, strategy)
  } finally {
    strategy.currentLevel = previousLevel
  }

  const beforeView = createPlayerView(state, playerId)
  const knowledgeState = strategy.knowledgeState?.observerId === playerId
    ? synchronizeKnowledgeWithPlayerView(strategy.knowledgeState, beforeView)
    : createKnowledgeStateFromPlayerView(beforeView)
  strategy.knowledgeState = knowledgeState
  const rootContext = createLv3ContextForView(beforeView, knowledgeState)
  const searchOptions = {
    ...(decisionLevel === 5 ? DEFAULT_LV5_SEARCH_OPTIONS : DEFAULT_LV4_SEARCH_OPTIONS),
    ...(strategy.searchNow ? { now: strategy.searchNow } : {}),
  }
  const deadlineMs = (searchOptions.now ?? Date.now)() + searchOptions.timeBudgetMs
  const attackAllocation = createPublicAttackAllocationForecast({
        shouldStop: () => (searchOptions.now ?? Date.now)() >= deadlineMs,
      })
  const searchHooks: Lv4SearchHooks = {
    attackAllocation,
    getLegalCommands: (nextState: GameState, nextPlayerId: PlayerId) =>
      getLegalTurnCommands(nextState, nextPlayerId).filter((command) =>
        isAllowedAiDeploymentCommand(nextState, nextPlayerId, command),
      ),
    applyCommand: applyChosenTurnCommand,
    createPlayerView,
    scorePublicView: (view: PlayerView) =>
      evaluatePlayerView(view) + lv4RiskBonus(view, playerId),
    legacyStepBonus: (
      beforeState: GameState,
      afterState: GameState,
      nextPlayerId: PlayerId,
      command: PlayerActionCommand,
    ) => {
      if (decisionLevel !== 5) {
        return beamStepBonus(beforeState, afterState, nextPlayerId, command)
      }
      const before = createPlayerView(beforeState, nextPlayerId)
      const identity = actionIdentityFromCommand(command)
      const effectiveDamage = command.kind === 'attack'
        ? getAttackDamageAgainst(beforeState, command.attackerInstanceId, command.targetInstanceId)
        : 0
      return beamStepBonus(beforeState, afterState, nextPlayerId, command) +
        forecastOpponentEndgame(before, identity, effectiveDamage).score
    },
    getPublicAttackDamage: (nextState, command) =>
      command.kind === 'attack'
        ? getAttackDamageAgainst(
          nextState,
          command.attackerInstanceId,
          command.targetInstanceId,
        )
        : undefined,
    conditionalAttackAftereffectValue: (beforeState, declaredState, command) =>
      command.kind === 'attack'
        ? forecastPublicAttackAftereffectValue(beforeState, declaredState, command)
        : undefined,
    persistentIntentBonus: decisionLevel === 5
      ? (plan, _identity, depth) =>
          depth === 0
            ? scoreIntentContinuity(strategy.strategyMemory, plan)
            : 0
      : undefined,
    preferredComboPlanId: decisionLevel === 5
      ? strategy.strategyMemory?.activeCombo?.planId
      : undefined,
    strictComboActionability: decisionLevel === 5,
    onPlayFollowup: decisionLevel === 5
      ? (after, nextPlayerId, command, before) =>
          forecastOnPlayFollowup(after, nextPlayerId, command, strategy.resolveSkill, before)
      : undefined,
    supportCostFollowup: decisionLevel >= 4
      ? (before, after, nextPlayerId, command) =>
          forecastSupportCostFollowup(before, after, nextPlayerId, command, strategy.resolveSkill)
      : undefined,
    opponentResponseMinimax: decisionLevel === 5
      ? (view, identity) => evaluatePublicResponseMinimax(view, identity)
      : undefined,
    defensiveReserveAssessment: decisionLevel === 5
      ? (before, after, command, beforeState) =>
          assessLv5DefensiveReserve(before, after, command, beforeState)
      : undefined,
    endgameSurvivalAssessment: decisionLevel === 5
      ? (before, after, actionKind) =>
          assessLv5EndgameSurvival(before, after, actionKind)
      : undefined,
    tournamentExperienceBonus: decisionLevel === 5
      ? (view, identity) =>
          scoreTournamentExperience(
            strategy.tournamentExperienceProfile,
            view,
            identity,
          )
      : undefined,
    deploymentTempoBonus: decisionLevel === 5
      ? (beforeState, _afterState, nextPlayerId, command, tacticalPlan) => {
          if (command.kind !== 'deploy-cookie' || !command.instanceId) return 0
          const card = beforeState.players[nextPlayerId].hand.find(
            (candidate) => candidate.instanceId === command.instanceId,
          )
          if (!card) return 0
          const confirmedCombo =
            tacticalPlan.status === 'confirmed' &&
            (tacticalPlan.kind === 'setup' || tacticalPlan.kind === 'payoff') &&
            tacticalPlan.validity === 'same-turn'
          return assessLv5Deployment(beforeState, nextPlayerId, card, {
            confirmedCombo,
          }).penalty
        }
      : undefined,
    isTerminal: isLv4SearchTerminal,
  }
  const searchResult = searchLv4Commands(
    state,
    playerId,
    knowledgeState,
    searchHooks,
    { ...searchOptions, deadlineMs },
  )

  const fallbackToBaseline = (telemetry = searchResult.telemetry): AiDecision => ({
    ...baseline,
    reason: {
      level: decisionLevel,
      consideredCommands: telemetry.nodesGenerated,
      chosenCommandKind: baseline.reason?.chosenCommandKind ?? baseline.action,
      actionScore: baseline.reason?.actionScore,
      lv4Search: { ...telemetry, fallbackUsed: true },
      publicEvaluation: evaluatePlayerViewBreakdown(beforeView),
    },
  })

  if (searchResult.telemetry.stopReason === 'time-budget') {
    return fallbackToBaseline()
  }

  const candidates: Lv4RootCandidate[] = []
  if (searchResult.firstCommand && searchResult.firstStep) {
    try {
      const command = searchResult.firstCommand
      candidates.push({
        decision: {
          state: applyChosenTurnCommand(state, command),
          action: commandActionTypes[command.kind],
          description: describeCommand(state, playerId, command),
        },
        relativeScore: searchResult.relativeScore,
        tieBreakKey: searchResult.firstStep.actionScore.tieBreakKey,
        actionScore: searchResult.firstStep.actionScore,
        telemetry: searchResult.telemetry,
        opponentResponse: searchResult.firstStep.opponentResponse ??
          evaluatePublicResponseMinimax(
            beforeView,
            actionIdentityFromCommand(command),
          ),
        opponentEndgame: forecastOpponentEndgame(
          beforeView,
          actionIdentityFromCommand(command),
          command.kind === 'attack'
            ? getAttackDamageAgainst(state, command.attackerInstanceId, command.targetInstanceId)
            : 0,
        ),
        endgameSurvival: searchResult.firstStep.endgameSurvival,
        tacticalPlan: searchResult.firstStep.tacticalPlan,
      })
    } catch {
      // 搜尋後再次由規則層驗證；若狀態已不適用就保守回退 G3。
    }
  }

  const addAbilityCandidate = (
    decision: AiDecision,
    kind: string,
    sourceInstanceId: string,
  ): boolean => {
    const afterView = createPlayerView(decision.state, playerId)
    const canContinue = canContinueFromKnownHand(beforeView, afterView) &&
      !isLv4SearchTerminal(decision.state, playerId)
    const afterCommands = canContinue
      ? getLegalTurnCommands(decision.state, playerId)
      : []
    const afterActionablePayoffs: ActionablePayoffSource[] = afterCommands
      .flatMap((command) => {
        const commandIdentity = actionIdentityFromCommand(command)
        const source = findVisibleSelfCard(afterView, commandIdentity.sourceInstanceId)
        return source
          ? [{ cardId: source.id, actionKind: commandIdentity.kind }]
          : []
      })
    const identity = { kind, sourceInstanceId }
    const scored = scoreLv3ActionCandidate(rootContext, beforeView, {
      value: decision,
      identity,
      afterView,
      postActionBoardScore:
        evaluatePlayerView(afterView) + lv4RiskBonus(afterView, playerId),
      legalAttackCountBefore: getLegalTurnCommands(state, playerId)
        .filter((command) => command.kind === 'attack').length,
      legalAttackCountAfter: afterCommands
        .filter((command) => command.kind === 'attack').length,
      tacticalPlanOptions: decisionLevel === 5
        ? {
            actionablePayoffSources: afterActionablePayoffs,
            preferredComboPlanId: strategy.strategyMemory?.activeCombo?.planId,
          }
        : undefined,
    })
    const endgameSurvival = decisionLevel === 5
      ? assessLv5EndgameSurvival(beforeView, afterView, identity.kind)
      : undefined
    const endgameSurvivalAdjustment = endgameSurvival?.adjustment ?? 0
    const tournamentExperience = decisionLevel === 5
      ? scoreTournamentExperience(
          strategy.tournamentExperienceProfile,
          beforeView,
          identity,
        )
      : undefined
    const reentry = !canContinue
      ? scorePublicSupportReentry(scored.breakdown, state, decision.state, playerId, strategy)
      : null
    const extraContributions: ActionScoreBreakdown['contributions'][number][] = [
      ...(reentry ? [reentry] : []),
      ...(endgameSurvivalAdjustment === 0
        ? []
        : [{
            id: 'endgame-survival' as const,
            amount: endgameSurvivalAdjustment,
            detail: endgameSurvival?.detail ?? 'Break 6–9 終局生存保留修正。',
          }]),
      ...(tournamentExperience && tournamentExperience.amount !== 0
        ? [{
            id: 'tournament-experience' as const,
            amount: tournamentExperience.amount,
            detail: tournamentExperience.detail,
          }]
        : []),
    ]
    const extraTotal = extraContributions.reduce(
      (total, contribution) => total + contribution.amount,
      0,
    )
    const actionScore = extraTotal === 0
      ? scored.breakdown
      : {
          ...scored.breakdown,
          total: scored.breakdown.total + extraTotal,
          contributions: [
            ...scored.breakdown.contributions,
            ...extraContributions,
          ],
        }
    let relativeScore =
      (evaluatePlayerView(afterView) + lv4RiskBonus(afterView, playerId)) -
      (evaluatePlayerView(beforeView) + lv4RiskBonus(beforeView, playerId)) +
      selectLv4StrategicContribution(actionScore) +
      skillEffectBonus(state, decision.state, playerId)
    let telemetry = createLv4SearchTelemetry()
    const sourceCard = findVisibleSelfCard(beforeView, sourceInstanceId)
    const tacticalPlan = deriveTacticalPlan(
      rootContext,
      beforeView,
      sourceCard?.id,
      afterView,
      identity.kind,
      decisionLevel === 5
        ? {
            actionablePayoffSources: afterActionablePayoffs,
            preferredComboPlanId: strategy.strategyMemory?.activeCombo?.planId,
          }
        : undefined,
    )
    const intentContinuity = decisionLevel === 5
      ? scoreIntentContinuity(strategy.strategyMemory, tacticalPlan)
      : 0
    relativeScore += intentContinuity

    if (canContinue) {
      const continuation = searchLv4Commands(
        decision.state,
        playerId,
        knowledgeState,
        searchHooks,
        { ...searchOptions, deadlineMs },
      )
      telemetry = continuation.telemetry
      if (telemetry.stopReason === 'time-budget') return false
      relativeScore += continuation.relativeScore
    }

    if (endgameSurvival) {
      telemetry.endgameSurvivalEvaluations += 1
      telemetry.endgameSurvivalAdjustment += endgameSurvival.adjustment
    }

    candidates.push({
      decision,
      relativeScore,
      tieBreakKey: actionScore.tieBreakKey,
      actionScore,
      telemetry,
      opponentResponse: evaluatePublicResponseMinimax(beforeView, { kind }),
      opponentEndgame: forecastOpponentEndgame(beforeView, identity, 0),
      endgameSurvival,
      tacticalPlan,
    })
    return true
  }

  if (state.phase === 'main') {
    for (const source of getActivatableSkillSources(state.players[playerId])) {
      try {
        const decision = strategy.resolveSkill(state, playerId, source, 'activate')
        if (decision && !addAbilityCandidate(
          decision,
          'activate-skill',
          source.card.instanceId,
        )) {
          return fallbackToBaseline()
        }
      } catch {
        // skip invalid skill resolution
      }
    }
    for (const card of state.players[playerId].hand) {
      try {
        const decision = strategy.resolveCardAbility(state, playerId, card)
        if (decision && !addAbilityCandidate(
          decision,
          `activate-${card.type}`,
          card.instanceId,
        )) {
          return fallbackToBaseline()
        }
      } catch {
        // skip invalid card ability resolution
      }
    }
    const stageSource = getStageActivationSource(state, playerId)
    const stageDecision = stageSource
      ? handleAiTurnState(state, playerId, strategy)
      : null
    if (
      stageDecision?.action === 'activate-stage' &&
      stageSource &&
      !addAbilityCandidate(
        stageDecision,
        'activate-stage',
        stageSource.stage.card.instanceId,
      )
    ) {
      return fallbackToBaseline()
    }
  }

  if (candidates.length === 0) {
    return fallbackToBaseline({
      ...searchResult.telemetry,
      stopReason: 'no-candidate',
      fallbackUsed: true,
    })
  }

  const best = chooseBestLv4Candidate(candidates, playerId)
  if (!best) return fallbackToBaseline()

  return {
    ...best.decision,
    reason: {
      level: decisionLevel,
      consideredCommands: searchResult.telemetry.nodesGenerated + candidates.length,
      chosenCommandKind: best.decision.action,
      actionScore: best.actionScore,
      lv4Search: best.telemetry,
      opponentResponse: decisionLevel === 5 ? best.opponentResponse : undefined,
      opponentEndgame: decisionLevel === 5 ? best.opponentEndgame : undefined,
      endgameSurvival: decisionLevel === 5 ? best.endgameSurvival : undefined,
      tacticalPlan: decisionLevel === 5 ? best.tacticalPlan : undefined,
      publicEvaluation: evaluatePlayerViewBreakdown(beforeView),
    },
  }
}
