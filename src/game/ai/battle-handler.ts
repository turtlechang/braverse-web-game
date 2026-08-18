import {
  getAttackResponseSkillCandidates,
  getTrapCandidates,
  getTrapTargetCandidates,
  getTrapSelfTargetCandidates,
  getBlockerCandidates,
} from '../battle'
import { applyGameCommand } from '../commands'
import {
  getAttackDamageAgainst,
  getBreakToTrashCandidates,
  getEffectTargetCandidatesForEffect,
  getEffectSelectionCandidates,
  getEffectiveAttack,
  getTrashToDeckCandidates,
  isEffectConditionMet,
} from '../effects'
import { expandChooseOne } from '../effects/choose-one'
import { selectEnergyPayment } from '../energy'
import { getTrashBattleCookieCostCandidates, getTrashToDeckCostCandidates } from '../skills'
import { createPlayerView } from '../player-view'
import type { CardEffect, CookieInBattle, EffectContext, GameState, GameCard, PlayerId } from '../types'
import type { AiDecision, AiLevel } from './types'
import { chooseAiEffectMode } from './choose-one-mode'
import { isRuleEnabled } from './rule-profiles'
import { getCardEffectValue } from './bs2MatchupProfiles'
import {
  createKnowledgeStateFromPlayerView,
  synchronizeKnowledgeWithPlayerView,
  type KnowledgeState,
} from './strategy/knowledge-state'
import {
  createPendingSelectionStrategy,
  type PendingSelectionStrategy,
} from './strategy/pending-selection'
import { chooseSharedEffectTargets } from './shared-selection'

const chooseAttackEffectTargets = (
  state: GameState,
  playerId: PlayerId,
  battle: NonNullable<GameState['pendingBattle']>,
  effect: CardEffect | undefined,
  universal?: PendingSelectionStrategy,
): string[] => {
  if (!effect) return []
  const context: EffectContext = {
    sourcePlayerId: playerId,
    sourceInstanceId: battle.attackerInstanceId,
  }

  if (effect.kind === 'break-to-trash') {
    const candidateIds = getBreakToTrashCandidates(state, context, effect)
      .map((card) => card.instanceId)
    return universal?.enabled
      ? universal.selectEffectTargetIds(effect, candidateIds, effect.max)
      : candidateIds.slice(0, effect.max)
  }

  if (effect.kind === 'opponent-battle-to-trash') {
    const opponentId = playerId === 'player-one' ? 'player-two' : 'player-one'
    const candidateIds = state.players[opponentId].battleArea
      .filter((cookie) => {
        if (effect.maxLevel !== undefined && cookie.card.level > effect.maxLevel) return false
        if (effect.minLevel !== undefined && cookie.card.level < effect.minLevel) return false
        if (effect.remainingHp !== undefined && cookie.hpCards.length > effect.remainingHp) return false
        return true
      })
      .sort((left, right) => left.hpCards.length - right.hpCards.length)
      .map((cookie) => cookie.card.instanceId)
    return universal?.enabled
      ? universal.selectEffectTargetIds(effect, candidateIds, 1)
      : candidateIds.slice(0, 1)
  }

  if (effect.kind === 'trash-to-deck') {
    const candidates = getTrashToDeckCandidates(state, context, effect)
    const count = Math.min(effect.max, candidates.length)
    if (count < (effect.min ?? 0)) return []
    const candidateIds = candidates.map((card) => card.instanceId)
    return universal?.enabled
      ? universal.selectEffectTargetIds(effect, candidateIds, count)
      : candidateIds.slice(0, count)
  }

  if (effect.kind === 'support-to-hand') {
    const candidates = getEffectSelectionCandidates(state, context, effect)
    const minimum = effect.optional ? 0 : effect.amount
    const maximum = effect.anyNumber ? candidates.length : effect.amount
    if (candidates.length < minimum) return []
    const candidateIds = candidates.map((card) => card.instanceId)
    return universal?.enabled
      ? universal.selectEffectTargetIds(effect, candidateIds, maximum)
      : candidateIds.slice(0, maximum)
  }

  if (!('target' in effect) || !effect.target) return []

  // Movement effects have legality constraints beyond the selector itself;
  // for example a source-only return-to-hand must not empty its battle area.
  // Keep AI target selection aligned with executeCardEffect's effect-aware
  // candidate helper.
  const candidates = getEffectTargetCandidatesForEffect(state, context, effect)
  const ordered = [...candidates].sort((left, right) => {
    if (effect.kind === 'damage') {
      const leftLethal = left.hpCards.length <= effect.amount ? 0 : 1
      const rightLethal = right.hpCards.length <= effect.amount ? 0 : 1
      return (
        leftLethal - rightLethal ||
        left.hpCards.length - right.hpCards.length
      )
    }
    return left.hpCards.length - right.hpCards.length
  })
  const count = Math.min(effect.target.max, ordered.length)
  if (count < effect.target.min) return []
  const candidateIds = ordered.map((cookie) => cookie.card.instanceId)
  return universal?.enabled
    ? universal.selectEffectTargetIds(effect, candidateIds, count)
    : candidateIds.slice(0, count)
}


/**
 * R7: 評估陷阱是否值得使用
 *
 * 分數組成：
 * 1. protectedTargetValue：保護目標價值（Level + HP + 效果價值）
 * 2. preventedKillBonus：防止被擊倒的加分
 * 3. preventedBreakBonus：防止 break area 推進的加分
 * 4. effectValueBonus：陷阱效果本身的價值
 * 5. lowValueWastePenalty：保護低價值目標的懲罰
 * 6. costPenalty：陷阱代價懲罰（能量 + 棄牌）
 */
const EFFECT_VALUE_MAP: Record<string, number> = {
  'prevent-knockout': 30,
  'redirect-attack': 25,
  'modify-attack': 20,
  'damage': 15,
  'field-to-trash': 15,
  'gain-hp': 10,
  'draw': 10,
  'support-to-hand': 5,
}

/**
 * 陷阱值不值得發動的門檻。沿用原本只套用在「Lv.1 且 HP1」目標上的
 * 50 分門檻（已驗證過的數字，見下方 R7 說明），改成對所有目標一律
 * 套用。用小一點的門檻（例如 10）試過：多數「非致命、目標普通」的
 * 陷阱淨值都落在 20–50 之間，門檻太低等於形同虛設（300 局 benchmark
 * 裡幾乎沒有陷阱被跳過），沒有真正過濾到「代價大於保護價值」的案例。
 */
const TRAP_SKIP_THRESHOLD = 50

export const evaluateTrapWorth = (
  state: GameState,
  playerId: PlayerId,
  trapCard: GameCard,
  battle: NonNullable<GameState['pendingBattle']>,
): number => {
  if (!trapCard.trap) return 0

  const attacker = state.players[battle.attackerPlayerId].battleArea.find(
    (c) => c.card.instanceId === battle.attackerInstanceId,
  )
  const defender = state.players[battle.defenderPlayerId].battleArea.find(
    (c) => c.card.instanceId === battle.targetInstanceId,
  )

  if (!attacker || !defender) return 0

  let score = 0

  // 1. protectedTargetValue：保護目標價值
  const targetLevel = defender.card.level
  const targetHp = defender.hpCards.length
  score += targetLevel * 15
  score += targetHp * 10

  // 高效果價值餅乾加分——原本是寫死的卡名子字串清單，只涵蓋 BS1／BS2 少數
  // 幾張卡，且用 `name.includes(...)` 比對；同名跨彈重印卡（例如 BS1-012／
  // BS3-009 都叫 Wildberry Cookie）會被誤套，BS3 卡片不管技能多強都拿不到
  // 這個加分。改用 getCardEffectValue：已收錄的卡沿用調校過的數字，查無
  // 資料的新卡改讀 card.skill.effects 直接推算，門檻 >= 5 對應原本清單裡
  // 那些卡在 EFFECT_VALUE_BONUS 的實際分數（Rebel/Dark Choco 8、Red
  // Bean/Sea Fairy/Wind Archer 7、Black Raisin/Banana/Vampire 6、Cream
  // Unicorn 5）。
  if (getCardEffectValue(defender.card) >= 5) {
    score += 20
  }

  // 2. preventedKillBonus：防止被擊倒（依目標等級縮放）
  // 用 getEffectiveAttack 而非 card.attack：場上只要有加攻／減攻效果（物品、
  // 技能、先前的陷阱），卡面攻擊力就不等於這次戰鬥的實際傷害，會讓「這張陷阱
  // 能不能救下這隻餅乾」整個判斷反過來——該擋的沒擋、不需要擋的卻把陷阱花掉。
  const attackerDamage = getEffectiveAttack(state, battle.attackerInstanceId)
  const wouldBeKilled = targetHp <= attackerDamage
  if (wouldBeKilled) {
    if (targetLevel >= 3) {
      score += 60
    } else if (targetLevel === 2) {
      score += 35
    } else {
      score += 15
    }
  }

  // 3. preventedBreakBonus：防止 break area 推進
  const myBreakLevel = state.players[playerId].breakArea.reduce(
    (sum, c) => sum + c.level, 0,
  )
  if (wouldBeKilled && myBreakLevel >= 8) {
    score += 40
  } else if (wouldBeKilled && myBreakLevel >= 6) {
    score += 20
  }

  // 4. effectValueBonus：陷阱效果價值
  for (const effect of trapCard.trap.effects) {
    score += EFFECT_VALUE_MAP[effect.kind] ?? 5
  }

  // 5. lowValueWastePenalty：保護低價值目標（核心 R7 邏輯）
  // 只在目標明顯無價值時才扣分
  if (targetLevel <= 1 && targetHp <= 1) {
    score -= 30
  }

  // 6. costPenalty：陷阱代價
  const energyCost = Object.values(trapCard.trap.cost.energy ?? {}).reduce(
    (sum, n) => sum + n, 0,
  )
  score -= energyCost * 8
  const discardCost = trapCard.trap.cost.discardHand ?? 0
  score -= discardCost * 12
  const trashCost = trapCard.trap.cost.trashBattleCookie?.count ?? 0
  score -= trashCost * 20

  return score
}

/**
 * Block 值不值得使用的門檻。跟陷阱不同，「不擋」的基準行為本來就是
 * 讓原目標正常受傷，沒有陷阱那種「暴露資訊」的隱性代價，所以直接用 0：
 * 只要 evaluateBlockWorth 算出來的淨值為正（救到的價值 > 犧牲的價值 +
 * 代價），才值得把攻擊導到 Blocker 身上。
 */
const BLOCK_SKIP_THRESHOLD = 0

/**
 * 單張戰鬥區餅乾的靜態價值，供 evaluateBlockWorth 比較「保住原目標」
 * 跟「犧牲 Blocker」何者划算。公式跟 evaluateTrapWorth 的
 * protectedTargetValue 一致（Level*15 + HP*10 + 高效果價值 +20），
 * 兩者評的都是「這隻餅乾值多少」，沒有理由用不同尺度。
 */
const cookieValue = (cookie: CookieInBattle): number => {
  let value = cookie.card.level * 15 + cookie.hpCards.length * 10
  if (getCardEffectValue(cookie.card) >= 5) value += 20
  return value
}

/**
 * 評估用某隻 Blocker 把攻擊導過去值不值得。
 *
 * 原本 AI 直接取 getBlockerCandidates()[0]，完全沒比較「擋下來省了
 * 多少」跟「Blocker 頂上去可能賠掉多少」，導致用高價值餅乾去擋一次
 * 對方明顯打不死原目標的攻擊、或是白白犧牲一隻能打死的 Blocker 去救
 * 一隻其實扛得住的雜牌。
 *
 * 分數組成（只用公開資訊：雙方戰鬥區、HP 張數、卡面攻擊力／技能）：
 * 1. preventedTargetLoss：原目標會被打死時，救下來的價值
 * 2. sacrificeCost：Blocker 頂上去會死時，賠掉的價值
 * 3. extraEffectBonus：block 技能除了 redirect-attack 以外的額外效果
 * 4. costPenalty：技能發動的能量代價
 */
export const evaluateBlockWorth = (
  state: GameState,
  playerId: PlayerId,
  blocker: CookieInBattle,
  battle: NonNullable<GameState['pendingBattle']>,
): number => {
  const originalTarget = state.players[battle.defenderPlayerId].battleArea.find(
    (c) => c.card.instanceId === battle.targetInstanceId,
  )
  const skill = blocker.card.skill
  if (!originalTarget || !skill) return -Infinity

  const originalDamage = getAttackDamageAgainst(
    state,
    battle.attackerInstanceId,
    originalTarget.card.instanceId,
  )
  const originalWouldDie = originalTarget.hpCards.length <= originalDamage

  const redirectedDamage = getAttackDamageAgainst(
    state,
    battle.attackerInstanceId,
    blocker.card.instanceId,
  )
  const blockerWouldDie = blocker.hpCards.length <= redirectedDamage

  let score = 0

  // 1. preventedTargetLoss：原目標本來會死，擋下來就是救到這份價值
  if (originalWouldDie) {
    score += cookieValue(originalTarget)
  }

  // 2. sacrificeCost：Blocker 頂上去反而會死，扣掉它的價值
  if (blockerWouldDie) {
    score -= cookieValue(blocker)
  } else if (!originalWouldDie) {
    // 雙方都不會死：純粹是把傷害從原目標轉移到 Blocker 身上，
    // 值不值得看兩邊的價值差——把傷害轉去更便宜的餅乾上才划算，
    // 轉去更貴的餅乾上（負值）會被這裡自然壓低分數。
    score += (cookieValue(originalTarget) - cookieValue(blocker)) * 0.3
  }

  // 3. extraEffectBonus：block 技能本身若還帶其他效果（redirect-attack
  // 以外），一併計分，讓「這張 Blocker 卡本身多划算」也影響選擇。
  for (const effect of skill.effects) {
    if (effect.kind === 'redirect-attack') continue
    score += EFFECT_VALUE_MAP[effect.kind] ?? 5
  }

  // 4. costPenalty：技能發動代價
  const energyCost = Object.values(skill.cost.energy ?? {}).reduce(
    (sum, n) => sum + n, 0,
  )
  score -= energyCost * 8

  return score
}

/**
 * 手牌卡片被拿去付 FLIP 棄牌代價時的「捨得丟」程度：分數越低越該優先
 * 棄。餅乾用跟 cookieValue 一致的量尺（level*15，用卡面滿版 HP 而非
 * 戰鬥區剩餘 HP，故權重減半避免虛高）；道具／陷阱／舞台卡沒有
 * level/HP，改讀各自的 effects（跟 skill.effects 同一種 CardEffect[]
 * 結構）套用 EFFECT_VALUE_MAP 估效果強度。
 *
 * 只處理「棄哪張」，不判斷「值不值得發動 FLIP」：FLIP 的棄牌代價是
 * 拿到傷害已經發生後才付，不像陷阱有「提前暴露資訊」的隱性成本，
 * 用跟陷阱同一套 EFFECT_VALUE_MAP 門檻硬套會系統性低估（試過用同一
 * 套邏輯擋下發動，300 局 benchmark 顯示連 Lv.4 vs Lv.1 都從 100% 掉到
 * 95%，代表原本「有效果就發動」才是符合設計的正確預設，這裡不重新
 * 發明一個沒有校準基準的門檻）。
 */
const handCardDiscardValue = (card: GameCard): number => {
  if (card.type === 'cookie') {
    let value = card.level * 15 + card.hp * 5
    if (getCardEffectValue(card) >= 5) value += 20
    return value
  }
  const effects = card.trap?.effects ?? card.item?.effects ?? card.stageAbility?.effects
  if (!effects || effects.length === 0) return 5
  return effects.reduce((sum, effect) => sum + (EFFECT_VALUE_MAP[effect.kind] ?? 5), 0)
}

export const handleAiPendingBattle = (
  state: GameState,
  playerId: PlayerId,
  level?: AiLevel,
  knowledgeState?: KnowledgeState,
): AiDecision | null => {
  if (
    !state.pendingBattle ||
    state.pendingRefresh ||
    state.pendingOnPlay
  ) {
    return null
  }

  const battle = state.pendingBattle
  const useR7 = level !== undefined && isRuleEnabled(level, 'R7')
  const view = createPlayerView(state, playerId)
  const synchronizedKnowledge = knowledgeState?.observerId === playerId
    ? synchronizeKnowledgeWithPlayerView(knowledgeState, view)
    : createKnowledgeStateFromPlayerView(view)
  const universal = createPendingSelectionStrategy(
    view,
    synchronizedKnowledge,
    level,
  )
  const withBattlePendingReason = (
    decision: AiDecision,
    kind: Parameters<typeof universal.telemetry>[0],
    sourceInstanceId?: string,
    effect?: CardEffect,
  ): AiDecision => universal.enabled
    ? {
        ...decision,
        reason: {
          ...(decision.reason ?? { level: level ?? 2 }),
          pendingStrategy: universal.telemetry(kind, sourceInstanceId, effect),
        },
      }
    : decision
  if (
    battle.stage === 'attack-effect' &&
    battle.attackerPlayerId === playerId
  ) {
    const effect = battle.attackEffects[battle.attackEffectIndex]
    const targetIds = chooseAttackEffectTargets(
      state,
      playerId,
      battle,
      effect,
      universal,
    )
    return withBattlePendingReason({
      state: applyGameCommand(state, {
        kind: 'resolve-attack-effect',
        playerId,
        targetIds,
      }),
      action: 'resolve-attack-effect',
      description:
        targetIds.length > 0
          ? `${state.players[playerId].name}結算攻擊後續效果。`
          : `${state.players[playerId].name}略過攻擊後續效果。`,
    }, 'effect-target', battle.attackerInstanceId, effect)
  }

  if (battle.stage === 'damage') {
    const damagePlayerId = battle.damagePlayerId ?? battle.defenderPlayerId
    return withBattlePendingReason({
      state: applyGameCommand(state, {
        kind: 'resolve-next-damage',
        playerId: damagePlayerId,
      }),
      action: 'resolve-damage',
      description: '依序翻開並結算下一張 HP 卡。',
    }, 'multi-stage', battle.attackerInstanceId)
  }

  if (
    battle.stage === 'flip' &&
    (battle.damagePlayerId ?? battle.defenderPlayerId) === playerId
  ) {
    const revealed = battle.revealedHpCard
    const discardCount = revealed?.flip?.cost.discardHand ?? 0
    // R7: Lv.3+ 優先棄「捨得丟」的卡（手牌品質最低的），而不是照手牌
    // 順序砍前 N 張——後者等於把要不要丟到關鍵卡交給手牌排列運氣。
    const discardCandidates = useR7
      ? [...state.players[playerId].hand].sort(
          (a, b) => handCardDiscardValue(a) - handCardDiscardValue(b),
        )
      : state.players[playerId].hand
    const discardHandIds = universal.enabled
      ? universal.orderCostIds(
          discardCandidates.map((card) => card.instanceId),
          discardCount,
        )
      : discardCandidates
          .slice(0, discardCount)
          .map((card) => card.instanceId)
    const flipContext: EffectContext = {
      sourcePlayerId: playerId,
      sourceInstanceId: revealed?.instanceId ?? '',
      sourceCardName: revealed?.name ?? '',
    }
    const chooseOneEffect = revealed?.flip?.effects.find(
      (effect): effect is Extract<CardEffect, { kind: 'choose-one' }> =>
        effect.kind === 'choose-one',
    )
    const chooseOneModeIndex = chooseOneEffect
      ? chooseAiEffectMode(
          state,
          flipContext,
          chooseOneEffect,
          universal.enabled
            ? universal.preferredModeIndices(chooseOneEffect, revealed?.instanceId)
            : [],
        )
      : undefined
    const expandedFlipEffects = revealed?.flip
      ? chooseOneEffect && chooseOneModeIndex !== undefined
        ? expandChooseOne(
            revealed.flip.effects,
            revealed.flip.effects.indexOf(chooseOneEffect),
            chooseOneModeIndex,
          )
        : revealed.flip.effects
      : []
    const hasActivatableEffect = Boolean(revealed?.flip) &&
      ((revealed?.flip?.attachedHpBonus ?? 0) > 0 ||
        expandedFlipEffects.some((effect) =>
          isEffectConditionMet(state, flipContext, effect),
        ))
    const sharedSelection = revealed?.flip
      ? chooseSharedEffectTargets(
          state,
          flipContext,
          expandedFlipEffects,
          universal,
        )
      : { valid: true as const }
    const canActivate = hasActivatableEffect &&
      discardHandIds.length === discardCount &&
      sharedSelection.valid
    const targetIds = sharedSelection.targetIds
    return withBattlePendingReason({
      state: applyGameCommand(state, {
        kind: 'resolve-flip',
        playerId,
        activate: canActivate,
        discardHandIds,
        chooseOneModeIndex,
        targetIds,
      }),
      action: 'resolve-flip',
      revealedCard: revealed ?? undefined,
      description: canActivate
        ? `${state.players[playerId].name}發動${revealed?.name ?? 'FLIP'}。`
        : `${state.players[playerId].name}略過 FLIP。`,
    }, 'flip', revealed?.instanceId, expandedFlipEffects[0])
  }

  if (battle.stage === 'trap' && battle.defenderPlayerId === playerId) {
    // 對手指攻回應技能（BS5-081 Squid Ink Cookie）優先於陷阱／阻擋者：
    // 陷阱或阻擋者會把回應窗關閉（stage → 'damage'），對手指攻回應不會。
    // AI 只在本張餅乾正是攻擊目標且會被擊昏時使用，避免無意義消耗手牌。
    const attackResponseCandidates = getAttackResponseSkillCandidates(
      state,
      playerId,
    )
    const targetCookie = state.players[playerId].battleArea.find(
      (cookie) => cookie.card.instanceId === battle.targetInstanceId,
    )
    const targetWouldFaint =
      targetCookie && targetCookie.hpCards.length <= battle.remainingDamage
    const attackResponse =
      targetWouldFaint
        ? attackResponseCandidates.find(
            (cookie) => cookie.card.instanceId === battle.targetInstanceId,
          ) ?? attackResponseCandidates[0]
        : undefined
    if (attackResponse) {
      const skill = attackResponse.card.skill!
      const hand = state.players[playerId].hand
      const discardHandIds = universal.enabled
        ? universal.orderCostIds(
            hand.map((card) => card.instanceId),
            skill.cost?.discardHand ?? 0,
          )
        : hand
            .slice(0, skill.cost?.discardHand ?? 0)
            .map((card) => card.instanceId)
      const trashToDeckCandidates = getTrashToDeckCostCandidates(
        skill.cost ?? {},
        state.players[playerId].discardPile,
      )
      const trashToDeckIds = universal.enabled
        ? universal.orderCostIds(
            trashToDeckCandidates.map((card) => card.instanceId),
            skill.cost?.trashToDeck?.count ?? 0,
          )
        : trashToDeckCandidates
            .slice(0, skill.cost?.trashToDeck?.count ?? 0)
            .map((card) => card.instanceId)
      return withBattlePendingReason({
        state: applyGameCommand(state, {
          kind: 'play-attack-response',
          playerId,
          sourceInstanceId: attackResponse.card.instanceId,
          discardHandIds,
          trashToDeckIds,
        }),
        action: 'play-attack-response',
        revealedCard: attackResponse.card,
        description: `${state.players[playerId].name}發動${attackResponse.card.name}的對手指攻回應技能。`,
      }, 'attack-response', attackResponse.card.instanceId, skill.effects[0])
    }

    const trapCandidates = getTrapCandidates(state, playerId)

    let trapCard: GameCard | undefined
    if (useR7 && trapCandidates.length > 0) {
      // R7: Lv.3+ 評估所有陷阱候選，選最高分
      let bestScore = -Infinity
      let bestCandidate: GameCard | undefined
      for (const candidate of trapCandidates) {
        if (!candidate.trap) continue
        const baseScore = evaluateTrapWorth(state, playerId, candidate, battle)
        // R7 仍是陷阱是否值得支付的主要判斷；G5 只用一個有上限的
        // TacticalPlan 加成處理接近候選，避免 setup／payoff 分數取代
        // 規則層的保命與代價評估，也不讓公開策略來源造成硬門檻誤判。
        const planBonus = universal.enabled
          ? Math.min(12, universal.tacticalPlanValue(candidate.instanceId))
          : 0
        const score = baseScore + planBonus
        if (score > bestScore) {
          bestScore = score
          bestCandidate = candidate
        }
      }
      // R7: evaluateTrapWorth 的分數已經把代價（能量／棄牌／送battle cookie）
      // 扣進去了，所以「淨值是否為正」本身就是該不該發動的判斷依據。
      // 原本只在目標明顯無價值（Lv.1 且 HP1）時才檢查分數，代表任何非
      // 垃圾目標、就算陷阱代價明顯大於保護到的價值，也會無條件發動——
      // 等於陷阱評分只在「要不要浪費在雜牌上」時有作用，其餘時候形同虛設。
      // 改成統一門檻：分數低於 TRAP_SKIP_THRESHOLD 一律跳過，垃圾目標會
      // 自然因為 lowValueWastePenalty 落在門檻以下，不需要再另外判斷。
      if (bestScore < TRAP_SKIP_THRESHOLD) {
        trapCard = undefined
      } else {
        trapCard = bestCandidate
      }
    } else {
      trapCard = trapCandidates[0]
    }

    const r7Skipped = useR7 && trapCandidates.length > 0 && !trapCard

    if (trapCard?.trap) {
      const supports = state.players[playerId].supportArea
      const orderedSupports = universal.enabled
        ? universal.orderPaymentIds(supports.map((support) => support.card.instanceId))
            .map((instanceId) => supports.find(
              (support) => support.card.instanceId === instanceId,
            )!)
        : supports
      const paymentIds = selectEnergyPayment(
        trapCard.trap.cost.energy ?? trapCard.trap.cost,
        orderedSupports,
      ) ?? []
      // 優先以當前攻擊者作為陷阱目標（減攻擊／防昏厥類陷阱才會作用在實際攻擊者身上）。
      const trapTargets = getTrapTargetCandidates(
        state,
        playerId,
        trapCard.instanceId,
      )
      const preferredTarget =
        trapTargets.find(
          (target) => target.card.instanceId === battle.attackerInstanceId,
        ) ?? trapTargets[0]
      // getTrapTargetCandidates 與 getTrapSelfTargetCandidates 各自依真正有
      // target 的子效果推導合法候選；不可再假設 effects[0] 就是該子效果，
      // 否則多段陷阱會拿錯效果做通用評分。
      const trapTargetEffect = trapCard.trap.effects.find(
        (effect) =>
          'target' in effect && effect.target?.side !== 'self',
      )
      const targetIds = universal.enabled
        ? trapTargetEffect && 'target' in trapTargetEffect && trapTargetEffect.target
          ? (() => {
              const candidateIds = trapTargets.map((target) => target.card.instanceId)
              const selected = universal.selectEffectTargetIds(
                trapTargetEffect,
                candidateIds,
                Math.min(trapTargetEffect.target.max, candidateIds.length),
              )
              return selected.length >= trapTargetEffect.target.min ? selected : []
            })()
          : []
        : preferredTarget
          ? [preferredTarget.card.instanceId]
          : []
      const selfTargetCandidates = getTrapSelfTargetCandidates(
        state,
        playerId,
        trapCard.instanceId,
      )
      const trapSelfTargetEffect = trapCard.trap.effects.find(
        (effect) =>
          'target' in effect && effect.target?.side === 'self',
      )
      const selfTargetIds = universal.enabled
        ? trapSelfTargetEffect && 'target' in trapSelfTargetEffect && trapSelfTargetEffect.target
          ? (() => {
              const candidateIds = selfTargetCandidates.map((target) => target.card.instanceId)
              const selected = universal.selectEffectTargetIds(
                trapSelfTargetEffect,
                candidateIds,
                Math.min(trapSelfTargetEffect.target.max, candidateIds.length),
              )
              return selected.length >= trapSelfTargetEffect.target.min ? selected : []
            })()
          : []
        : selfTargetCandidates.length > 0
          ? [selfTargetCandidates[0].card.instanceId]
          : []
      const supportTrashEffect = trapCard.trap.effects.find(
        (effect) => effect.kind === 'support-to-trash',
      )
      const supportTrashCandidateIds = supportTrashEffect?.kind === 'support-to-trash'
        ? state.players[playerId].supportArea
            .map((support) => support.card.instanceId)
        : []
      const supportTrashIds = supportTrashEffect?.kind === 'support-to-trash'
        ? universal.enabled
          ? universal.orderCostIds(supportTrashCandidateIds, supportTrashEffect.amount)
          : supportTrashCandidateIds.slice(0, supportTrashEffect.amount)
        : []
      const supportToHandEffect = trapCard.trap.effects.find(
        (effect) => effect.kind === 'support-to-hand',
      )
      const supportToHandCandidateIds = supportToHandEffect?.kind === 'support-to-hand'
        ? state.players[playerId].supportArea
              .slice()
              .sort((a, b) => {
                if (a.rested !== b.rested) return a.rested ? -1 : 1
                return 0
              })
              .map((support) => support.card.instanceId)
        : []
      const supportToHandIds = supportToHandEffect?.kind === 'support-to-hand'
        ? universal.enabled
          ? universal.orderCostIds(supportToHandCandidateIds, supportToHandEffect.amount)
          : supportToHandCandidateIds.slice(0, supportToHandEffect.amount)
        : []
      const handToSupportEffect = trapCard.trap.effects.find(
        (effect) => effect.kind === 'hand-to-support',
      )
      const handToSupportCandidateIds = handToSupportEffect?.kind === 'hand-to-support'
        ? state.players[playerId].hand
              .filter((card) => card.instanceId !== trapCard.instanceId)
              .slice()
              .sort((a, b) => {
                const aCookie = a.type === 'cookie' ? 1 : 0
                const bCookie = b.type === 'cookie' ? 1 : 0
                if (aCookie !== bCookie) return aCookie - bCookie
                return 0
              })
              .map((card) => card.instanceId)
        : []
      const handToSupportIds = handToSupportEffect?.kind === 'hand-to-support'
        ? universal.enabled
          ? universal.selectEffectTargetIds(
              handToSupportEffect,
              handToSupportCandidateIds,
              handToSupportEffect.amount,
            )
          : handToSupportCandidateIds.slice(0, handToSupportEffect.amount)
        : []
      const discardHandColor = trapCard.trap.cost.discardHandColor
      const discardHandCandidateIds = state.players[playerId].hand
        .filter(
          (card) =>
            card.instanceId !== trapCard.instanceId &&
            (!discardHandColor || card.energyColor === discardHandColor),
        )
        .map((card) => card.instanceId)
      const discardHandIds = universal.enabled
        ? universal.orderCostIds(
            discardHandCandidateIds,
            trapCard.trap.cost.discardHand ?? 0,
          )
        : discardHandCandidateIds.slice(0, trapCard.trap.cost.discardHand ?? 0)
      const handToBreakCost = trapCard.trap.cost.handToBreakArea
      const handToBreakCandidateIds = state.players[playerId].hand
        .filter(
          (card) =>
            card.instanceId !== trapCard.instanceId &&
            !discardHandIds.includes(card.instanceId) &&
            card.type === 'cookie' &&
            (!handToBreakCost?.energyColor ||
              card.energyColor === handToBreakCost.energyColor),
        )
        // 進休息區等於送對手 break 進度，優先付等級最低的。
        .sort(
          (left, right) =>
            (left.type === 'cookie' ? left.level : 0) -
            (right.type === 'cookie' ? right.level : 0),
        )
        .map((card) => card.instanceId)
      const handToBreakIds = universal.enabled
        ? universal.orderCostIds(handToBreakCandidateIds, handToBreakCost?.count ?? 0)
        : handToBreakCandidateIds.slice(0, handToBreakCost?.count ?? 0)
      if (handToBreakCost && handToBreakIds.length < handToBreakCost.count) {
        return withBattlePendingReason({
          state: applyGameCommand(state, { kind: 'skip-trap', playerId }),
          action: 'play-trap',
          description: `${state.players[playerId].name}無法支付陷阱代價。`,
        }, 'trap', trapCard.instanceId, trapCard.trap.effects[0])
      }

      const trashBattleCandidateIds = getTrashBattleCookieCostCandidates(
        trapCard.trap.cost,
        state.players[playerId].battleArea,
      )
        .map((cookie) => cookie.card.instanceId)
      const trashBattleCookieIds = universal.enabled
        ? universal.orderCostIds(
            trashBattleCandidateIds,
            trapCard.trap.cost.trashBattleCookie?.count ?? 0,
          )
        : trashBattleCandidateIds.slice(
            0,
            trapCard.trap.cost.trashBattleCookie?.count ?? 0,
          )
      const trashToDeckEffect = trapCard.trap.effects.find(
        (effect) => effect.kind === 'trash-to-deck',
      )
      const trashToDeckCandidateIds =
        trashToDeckEffect?.kind === 'trash-to-deck'
          ? getTrashToDeckCandidates(
              state,
              { sourcePlayerId: playerId, sourceInstanceId: trapCard.instanceId },
              trashToDeckEffect,
            )
              .map((card) => card.instanceId)
          : []
      const trashToDeckIds = trashToDeckEffect?.kind === 'trash-to-deck'
        ? universal.enabled
          ? universal.orderCostIds(trashToDeckCandidateIds, trashToDeckEffect.max)
          : trashToDeckCandidateIds.slice(0, trashToDeckEffect.max)
        : []

      if (
        supportTrashEffect?.kind === 'support-to-trash' &&
        supportTrashIds.length < supportTrashEffect.amount
      ) {
        return withBattlePendingReason({
          state: applyGameCommand(state, { kind: 'skip-trap', playerId }),
          action: 'play-trap',
          description: `${state.players[playerId].name}無法支付陷阱後續代價。`,
        }, 'trap', trapCard.instanceId, trapCard.trap.effects[0])
      }

      if (
        supportToHandEffect?.kind === 'support-to-hand' &&
        supportToHandIds.length < supportToHandEffect.amount
      ) {
        return withBattlePendingReason({
          state: applyGameCommand(state, { kind: 'skip-trap', playerId }),
          action: 'play-trap',
          description: `${state.players[playerId].name}無法支付陷阱後續代價。`,
        }, 'trap', trapCard.instanceId, trapCard.trap.effects[0])
      }

      return withBattlePendingReason({
        state: applyGameCommand(state, {
          kind: 'play-trap',
          playerId,
          trapInstanceId: trapCard.instanceId,
          paymentIds,
          targetIds,
          selfTargetIds,
          supportTrashIds,
          supportToHandIds,
          handToSupportIds,
          discardHandIds,
          handToBreakIds,
          trashBattleCookieIds,
          trashToDeckIds,
        }),
        action: 'play-trap',
        revealedCard: trapCard,
        description: `${state.players[playerId].name}發動${trapCard.name}。`,
      }, 'trap', trapCard.instanceId, trapCard.trap.effects[0])
    }

    const blockerCandidates = getBlockerCandidates(state, playerId)
    if (blockerCandidates.length > 0) {
      let blocker: CookieInBattle | undefined
      if (useR7) {
        // R7: 評估每個候選 Blocker，只在淨值為正時才擋——避免用高價值
        // 餅乾去擋一次原目標其實扛得住的攻擊、或白白犧牲擋得住的
        // Blocker 去救一隻其實會死的雜牌。
        let bestScore = -Infinity
        let bestCandidate: CookieInBattle | undefined
        for (const candidate of blockerCandidates) {
          const baseScore = evaluateBlockWorth(state, playerId, candidate, battle)
          // Blocker 的救援／犧牲淨值優先；TacticalPlan 僅作 bounded tie-break
          // 加成，讓已確認 payoff 的公開餅乾在同等防守價值時優先保留。
          const planBonus = universal.enabled
            ? Math.min(12, universal.tacticalPlanValue(candidate.card.instanceId))
            : 0
          const score = baseScore + planBonus
          if (score > bestScore) {
            bestScore = score
            bestCandidate = candidate
          }
        }
        blocker = bestScore >= BLOCK_SKIP_THRESHOLD ? bestCandidate : undefined
      } else {
        blocker = blockerCandidates[0]
      }

      if (blocker) {
        const skill = blocker.card.skill!
        const supports = state.players[playerId].supportArea
        const orderedSupports = universal.enabled
          ? universal.orderPaymentIds(supports.map((support) => support.card.instanceId))
              .map((instanceId) => supports.find(
                (support) => support.card.instanceId === instanceId,
              )!)
          : supports
        const paymentIds = selectEnergyPayment(
          skill.cost.energy ?? skill.cost,
          orderedSupports,
        ) ?? []
        return withBattlePendingReason({
          state: applyGameCommand(state, {
            kind: 'play-blocker',
            playerId,
            sourceInstanceId: blocker.card.instanceId,
            paymentIds,
          }),
          action: 'play-blocker',
          revealedCard: blocker.card,
          description: `${state.players[playerId].name}使用${blocker.card.name}阻擋攻擊。`,
        }, 'blocker', blocker.card.instanceId, skill.effects[0])
      }
    }

    return withBattlePendingReason({
      state: applyGameCommand(state, { kind: 'skip-trap', playerId }),
      action: 'play-trap',
      description: `${state.players[playerId].name}未發動陷阱。`,
      r7TrapSkip: r7Skipped,
    }, 'trap', battle.attackerInstanceId)
  }

  return {
    state,
    action: 'idle',
    description: `${state.players[battle.defenderPlayerId].name}等待戰鬥回應。`,
  }
}
