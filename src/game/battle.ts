import { collectAfterDamageEffectsFromIds } from './afterDamage'
import { GameRuleError } from './errors'
import {
  executeCardEffect,
  getAttackDamageAgainst,
  getBreakToTrashCandidates,
  getEffectTargetCandidates,
  getEffectTargetCandidatesForEffect,
  getEffectSelectionCandidates,
  getEffectSelectionLimits,
  getSupportEffectCandidates,
  hasRequiredEffectTargets,
  getTargetPlayerId,
  isEffectConditionMet,
  isEffectTargeted,
  requiresEffectCardSelection,
  resolveDrawUpTo,
  selectEffectTargets,
  expandChooseOne,
} from './effects'
import {
  getAttackEnergyCostForState,
  getRemainingEnergyCost,
  selectEnergyPayment,
  validateEnergyPayment,
} from './energy'
import { defaultShuffle, getCookieEffectiveHp, getOpponentId } from './helpers'
import {
  clearDepartedCookieModifiers,
  continuePendingReplacements,
  finalizePendingReplacements,
  recordCookieDepartures,
} from './replacement'
import { hasBlockingPending } from './pending'
import {
  canPayTrashBattleCookieCost,
  canPayTrashCookieToBreakAreaCost,
  canPayTrashToDeckCost,
  getFaintTriggeredCost,
  getDiscardHandCostCandidates,
  getHpToTrashCostCandidates,
  getTrashToDeckCostCandidates,
  markSupportAreaDecreased,
  payHpToTrashCost,
  payTrashBattleCookieCost,
  payTrashCookieToBreakAreaCost,
} from './skills'
import { canAttack } from './turn'
import type {
  AbilityCost,
  CardEffect,
  CookieInBattle,
  EffectContext,
  EffectTargetSelector,
  EnergyColor,
  GameCard,
  GameState,
  CookieCard,
  FlipAbility,
  PendingBattle,
  PendingEffectOrderItem,
  PlayerId,
  PlayerState,
  TrapAbility,
} from './types'
import { getBreakAreaLevel, resolveBreakLevelVictory } from './victory'

const requirePendingBattle = (state: GameState): PendingBattle => {
  if (!state.pendingBattle) {
    throw new GameRuleError('Invalid battle action.')
  }

  return state.pendingBattle
}

/**
 * A FLIP ability can be represented either by executable effects or by the
 * attached-HP bonus used by cards such as BS6-069.  The latter still opens a
 * real FLIP decision: paying its cost converts the temporary attached bonus
 * into an HP gain during resolution.
 */
export const hasActivatableFlipEffect = (
  state: GameState,
  flip: FlipAbility,
  context: EffectContext,
): boolean =>
  (flip.attachedHpBonus ?? 0) > 0 ||
  flip.effects.some((effect) => isEffectConditionMet(state, context, effect))

const markCookieHpReducedThisTurn = (
  state: GameState,
  playerId: PlayerId,
  instanceId: string,
): GameState => ({
  ...state,
  cookiesHpReducedThisTurn: {
    ...(state.cookiesHpReducedThisTurn ?? {}),
    [playerId]: {
      ...(state.cookiesHpReducedThisTurn?.[playerId] ?? {}),
      [instanceId]: true,
    },
  },
})

const assertNoBlockingDecision = (state: GameState) => {
  if (state.pendingBattle) {
    throw new GameRuleError('Invalid battle action.')
  }

  if (state.pendingReplacement) {
    throw new GameRuleError('Invalid battle action.')
  }

  if (state.pendingRefresh) {
    throw new GameRuleError('Invalid battle action.')
  }

  if (state.pendingFaintEffects && state.pendingFaintEffects.length > 0) {
    throw new GameRuleError('Invalid battle action.')
  }

  if (state.pendingOpponentHandDiscard) {
    throw new GameRuleError('Invalid battle action.')
  }

  if (state.pendingInspectDeck) {
    throw new GameRuleError('Invalid battle action.')
  }

  if (state.pendingRevealTopDeck) {
    throw new GameRuleError('Invalid battle action.')
  }

  if (state.pendingOptionalCostAttack) {
    throw new GameRuleError('Invalid battle action.')
  }

  if (state.pendingOnPlay) {
    throw new GameRuleError('Invalid battle action.')
  }

  if (state.pendingAbilityEffect) {
    throw new GameRuleError('Invalid battle action.')
  }
}

const getEquipAttackEffects = (attacker: CookieInBattle): CardEffect[] =>
  (attacker.equippedCards ?? []).flatMap<CardEffect>((card) => {
    if (card.id === 'BS3-066') {
      return [{ kind: 'set-active', supportCount: 1, selectable: true }]
    }
    if (card.id === 'BS3-091') {
      return [{ kind: 'draw', amount: 1 }]
    }
    return []
  })

export const getForcedAttackTargetId = (
  state: GameState,
  attackerPlayerId: PlayerId,
): string | undefined => {
  const defenderPlayerId = getOpponentId(attackerPlayerId)
  const defender = state.players[defenderPlayerId]
  return defender.battleArea.find((cookie) => {
    const skill = cookie.card.skill
    if (!skill || skill.trigger !== 'passive') return false
    const context: EffectContext = {
      sourcePlayerId: defenderPlayerId,
      sourceInstanceId: cookie.card.instanceId,
    }
    return skill.effects.some(
      (effect) =>
        effect.kind === 'redirect-attack' &&
        effect.target.side === 'self' &&
        effect.target.sourceOnly &&
        isEffectConditionMet(state, context, effect),
    )
  })?.card.instanceId
}

export const beginAttack = (
  state: GameState,
  attackerInstanceId: string,
  targetInstanceId: string,
  supportPaymentIds: string[],
): GameState => {
  assertNoBlockingDecision(state)

  if (!canAttack(state)) {
    throw new GameRuleError('Invalid battle action.')
  }

  const attackerPlayer = state.players[state.activePlayerId]
  const attackerIndex = attackerPlayer.battleArea.findIndex(
    (cookie) => cookie.card.instanceId === attackerInstanceId,
  )
  const attacker = attackerPlayer.battleArea[attackerIndex]

  if (!attacker || attacker.rested || attacker.card.nonAttackable) {
    throw new GameRuleError('Invalid battle action.')
  }

  if (
    state.attackDisabledUntilTurn?.[attackerInstanceId] === state.turnNumber
  ) {
    throw new GameRuleError('Invalid battle action.')
  }

  const defenderPlayerId = getOpponentId(state.activePlayerId)
  const defender = state.players[defenderPlayerId]
  const forcedTargetId = getForcedAttackTargetId(state, state.activePlayerId)
  if (forcedTargetId && targetInstanceId !== forcedTargetId) {
    throw new GameRuleError('Invalid battle action.')
  }
  if (
    !defender.battleArea.some(
      (cookie) => cookie.card.instanceId === targetInstanceId,
    )
  ) {
    throw new GameRuleError('Invalid battle action.')
  }

  const paymentValidation = validateEnergyPayment(
    getAttackEnergyCostForState(state, attackerInstanceId),
    attackerPlayer.supportArea,
    supportPaymentIds,
  )
  if (!paymentValidation.valid) {
    throw new GameRuleError(`Invalid attack payment: ${paymentValidation.reason}`)
  }

  const paymentSet = new Set(supportPaymentIds)
  const declaredDamage = getAttackDamageAgainst(
    state,
    attackerInstanceId,
    targetInstanceId,
  )
  const attackContext: EffectContext = {
    sourcePlayerId: attackerPlayer.id,
    sourceInstanceId: attacker.card.instanceId,
  }
  const trapsDisabled =
    attacker.card.skill?.trigger === 'passive' &&
    attacker.card.skill.effects.some(
      (effect) =>
        effect.kind === 'disable-traps' &&
        isEffectConditionMet(state, attackContext, effect),
    )

  return {
    ...state,
    players: {
      ...state.players,
      [attackerPlayer.id]: {
        ...attackerPlayer,
        battleArea: attackerPlayer.battleArea.map((cookie, index) =>
          index === attackerIndex ? { ...cookie, rested: true } : cookie,
        ),
        supportArea: attackerPlayer.supportArea.map((support) =>
          paymentSet.has(support.card.instanceId)
            ? { ...support, rested: true }
            : support,
        ),
      },
    },
    pendingBattle: {
      attackerPlayerId: attackerPlayer.id,
      defenderPlayerId,
      attackerInstanceId,
      targetInstanceId,
      declaredDamage,
      remainingDamage: declaredDamage,
      stage: 'trap',
      trapUsed: false,
      ...(trapsDisabled ? { trapsDisabled: true } : {}),
      revealedHpCard: null,
      preventKnockoutTargetIds: [],
      faintedColors: [],
      attackEffects: [
        ...(attacker.card.attackEffects ?? []),
        ...getEquipAttackEffects(attacker),
      ],
      attackEffectIndex: 0,
    },
  }
}

const isTrapConditionMet = (
  state: GameState,
  playerId: PlayerId,
  trap: TrapAbility,
): boolean => {
  const battle = requirePendingBattle(state)

  const condition = trap.condition
  if (!condition) return true

  if (condition.kind === 'break-level-at-least') {
    return getBreakAreaLevel(state, playerId) >= condition.level
  }

  if (condition.kind === 'break-area-card-count-at-least') {
    return state.players[playerId].breakArea.length >= condition.count
  }

  if (condition.kind === 'attacker-attack-more-than') {
    return battle.declaredDamage > condition.amount
  }

  if (condition.kind === 'self-cookie-hp-equals') {
    return state.players[playerId].battleArea.some(
      (cookie) => cookie.hpCards.length === condition.amount,
    )
  }

  if (condition.kind === 'opponent-trash-count-at-least') {
    // 名稱雖是「opponent」，但陷阱語意檢查的是 playerId（陷阱擁有者／防守方）
    // 自己的棄牌區，對應官方文字「if there are N cards or more in your
    // trash」的「your」。見 types.ts TrapCondition 上方註解；不要改成
    // getOpponentId(playerId)，那會破壞 BS2-080 等既有卡牌。
    return state.players[playerId].discardPile.length >= condition.count
  }

  if (condition.kind === 'friendly-color-fainted-this-battle') {
    return true
  }

  if (condition.kind === 'friendly-cookie-fainted-this-battle') {
    return true
  }

  if (condition.kind === 'battle-area-has-cookie-with-level') {
    // 陷阱擁有者自己的戰鬥區（官方文字的「your battle area」）。
    return state.players[playerId].battleArea.some(
      (cookie) => cookie.card.level === condition.level,
    )
  }

  return true
}

const hasRequiredTrapTargets = (
  state: GameState,
  playerId: PlayerId,
  card: GameCard,
): boolean => {
  const context = {
    sourcePlayerId: playerId,
    sourceInstanceId: card.instanceId,
  }

  return card.trap!.effects.every((effect) => {
    if (effect.kind === 'trash-to-battle') {
      const available = state.players[playerId].discardPile.filter(
        (discarded) =>
          discarded.type === 'cookie' &&
          (effect.energyColor === undefined ||
            discarded.energyColor === effect.energyColor) &&
          (effect.exactLevel === undefined || discarded.level === effect.exactLevel) &&
          (effect.maxLevel === undefined || discarded.level <= effect.maxLevel) &&
          (effect.maxHp === undefined || discarded.hp <= effect.maxHp),
      ).length
      return effect.optional || available >= effect.amount
    }

    const isTargetedGainHp =
      effect.kind === 'gain-hp' && Boolean(effect.target) && !effect.target?.sourceOnly
    if ((!isEffectTargeted(effect) && !isTargetedGainHp) || !effect.target) {
      return true
    }

    // Movement effects have additional legality constraints (for example a
    // return-to-deck-bottom effect cannot empty a battle area).  Use the
    // effect-aware candidate helper here so the trap candidate list cannot
    // advertise BS2-050 when its remaining-HP target is not movable.
    const battleCandidateCount =
      effect.kind === 'return-to-hand' || effect.kind === 'return-to-deck-bottom'
        ? getEffectTargetCandidatesForEffect(state, context, effect).length
        : getEffectTargetCandidates(state, context, effect.target).length
    const stageCandidateCount =
      effect.kind === 'field-to-trash' &&
      effect.allowStage &&
      state.players[getTargetPlayerId(context, effect.target)].stage !== null
        ? 1
        : 0

    // A trap with an optional target still needs at least one legal movement
    // target to be offered. Once the trap is played, min=0 continues to let
    // the player skip target selection; this gate only prevents a trap whose
    // effect cannot do anything from appearing in the trap window.
    return (
      battleCandidateCount + stageCandidateCount > 0 &&
      battleCandidateCount + stageCandidateCount >= effect.target.min
    )
  })
}

export type TrapUnavailableReason =
  | 'not-trap-stage'
  | 'traps-disabled'
  | 'condition-not-met'
  | 'no-legal-targets'
  | 'not-enough-support-to-trash'
  | 'not-enough-hand-to-discard'
  | 'cannot-pay-energy'
  | 'cannot-trash-battle-cookie'
  | 'unknown'

export interface UnavailableTrap {
  instanceId: string
  cardId: string
  reason: TrapUnavailableReason
}

/**
 * 逐一說明手上的陷阱卡為什麼進不了 `getTrapCandidates`。
 *
 * 檢查順序必須與 `getTrapCandidates` 的 filter 完全一致，回報的才會是「真正
 * 第一個擋下它的那道關卡」。若所有已知關卡都通過卻仍不在候選名單，回報
 * `unknown`——那才代表引擎真的有問題，值得示警。
 *
 * 存在的理由：被攻擊時支援卡多半還是橫置的（支援區要到自己回合的活躍階段
 * 才會重置），所以「手上有陷阱但付不出代價」是再正常不過的日常狀況，不該
 * 每次都對主控台大喊。
 */
export const explainUnavailableTraps = (
  state: GameState,
  playerId: PlayerId,
): UnavailableTrap[] => {
  const player = state.players[playerId]
  const available = new Set(
    getTrapCandidates(state, playerId).map((card) => card.instanceId),
  )
  const battle = state.pendingBattle
  const inTrapStage =
    battle?.stage === 'trap' &&
    !battle.trapUsed &&
    battle.defenderPlayerId === playerId

  return player.hand
    .filter((card) => card.type === 'trap' && Boolean(card.trap))
    .filter((card) => !available.has(card.instanceId))
    .map((card) => {
      const trap = card.trap!
      const reason: TrapUnavailableReason = !inTrapStage
        ? 'not-trap-stage'
        : battle?.trapsDisabled
          ? 'traps-disabled'
        : !isTrapConditionMet(state, playerId, trap)
          ? 'condition-not-met'
          : !hasRequiredTrapTargets(state, playerId, card)
            ? 'no-legal-targets'
            : player.supportArea.length <
                trap.effects.reduce(
                  (total, effect) =>
                    effect.kind === 'support-to-trash'
                      ? total + effect.amount
                      : total,
                  0,
                )
              ? 'not-enough-support-to-trash'
              : player.hand.filter(
                    (handCard) =>
                      handCard.instanceId !== card.instanceId &&
                      (!trap.cost.discardHandColor ||
                        handCard.energyColor === trap.cost.discardHandColor),
                  ).length < (trap.cost.discardHand ?? 0)
                ? 'not-enough-hand-to-discard'
                : getTrapCostOptions(trap).some((cost) =>
                    canPayTrapCost(state, playerId, cost, card.instanceId),
                  )
                  ? 'unknown'
                  : selectEnergyPayment(
                        trap.cost.energy ?? trap.cost,
                        player.supportArea,
                      ) === null
                    ? 'cannot-pay-energy'
                    : !canPayTrashBattleCookieCost(trap.cost, player.battleArea)
                      ? 'cannot-trash-battle-cookie'
                      : 'unknown'
      return { instanceId: card.instanceId, cardId: card.id, reason }
    })
}

export const getTrapCandidates = (
  state: GameState,
  playerId: PlayerId,
): GameCard[] => {
  const battle = state.pendingBattle
  if (
    !battle ||
    battle.stage !== 'trap' ||
    battle.trapUsed ||
    battle.trapsDisabled ||
    battle.defenderPlayerId !== playerId
  ) {
    return []
  }

  const player = state.players[playerId]
  return player.hand.filter(
    (card) =>
      card.type === 'trap' &&
      Boolean(card.trap) &&
      isTrapConditionMet(state, playerId, card.trap!) &&
      hasRequiredTrapTargets(state, playerId, card) &&
      player.supportArea.length >=
        card.trap!.effects.reduce(
          (total, effect) =>
            effect.kind === 'support-to-trash' ? total + effect.amount : total,
          0,
        ) &&
      player.hand.filter(
        (handCard) =>
          handCard.instanceId !== card.instanceId &&
          (!card.trap!.cost.discardHandColor ||
            handCard.energyColor === card.trap!.cost.discardHandColor),
      ).length >= (card.trap!.cost.discardHand ?? 0) &&
      getTrapCostOptions(card.trap!).some((cost) =>
        canPayTrapCost(state, playerId, cost, card.instanceId),
      ),
  )
}

export const isBlockDisabled = (
  state: GameState,
  playerId: PlayerId,
): boolean => state.blockDisabledUntilTurn?.[playerId] === state.turnNumber

export const getBlockerCandidates = (
  state: GameState,
  playerId: PlayerId,
): CookieInBattle[] => {
  const battle = state.pendingBattle
  if (
    !battle ||
    battle.stage !== 'trap' ||
    battle.defenderPlayerId !== playerId ||
    isBlockDisabled(state, playerId)
  ) {
    return []
  }

  return state.players[playerId].battleArea.filter((cookie) => {
    const skill = cookie.card.skill
    if (!skill || skill.trigger !== 'block') return false
    if (cookie.card.instanceId === battle.targetInstanceId) return false
    if (!skill.effects.some((effect) => effect.kind === 'redirect-attack')) {
      return false
    }
    return (
      selectEnergyPayment(
        skill.cost.energy ?? skill.cost,
        state.players[playerId].supportArea,
      ) !== null
    )
  })
}

/**
 * 陷阱／攻擊後續效果的目標 ID 解析：AI 與部分 UI 呼叫端只會替整張卡（或整次
 * 攻擊後續）算出「一組」targetIds（例如取自第一個符合條件的子效果），但像
 * BS3-117 這種一張陷阱掛兩個子效果、且各自 target selector 不同（modify-attack
 * 沒有 remainingHp 限制、field-to-trash 要求 remainingHp<=2）時，直接把同一組
 * targetIds 套進後面每個子效果，遇到不滿足該子效果 selector 的目標就會被
 * selectEffectTargets 判定為不合法目標而拋錯，讓整個 playTrap 中止。
 * 這裡跟本來就存在、只用在 self-target 分支的 fallback 邏輯一致：先過濾出
 * 這個子效果自己候選裡有效的 ID，過濾完是空的再退而求其次選它自己的最佳候選。
 * validateTrapTargets（送出指令前的預先檢查）跟 playTrap 主迴圈（真正結算）
 * 都要用同一套邏輯，否則前者可能比後者更嚴格，在後者本來能靠 fallback
 * 正常結算的情況下就先擋下來拋錯。
 *
 * 非 self 目標刻意保留「明確送 0 個 ID」＝略過這個選填效果（例如 ST2-021
 * Pretzel Snare 的「最多選 1」允許不選），只有在呼叫端送了非空但對「這個
 * 子效果」而言不合法的 ID 時，才 fallback 選這個子效果自己候選裡的最佳
 * 選項。self 目標維持原本行為：沒有專屬 selfTargetIds 時一律自動代選，
 * 不受 requestedIds 是否為空影響（self 目標本來就不是玩家自由選擇的）。
 */
const resolveTrapEffectTargetIds = (
  state: GameState,
  context: EffectContext,
  target: EffectTargetSelector | undefined,
  requestedIds: string[],
  selfTargetIds: string[] | undefined,
): string[] => {
  if (!target) return requestedIds
  if (target.side === 'self') {
    if (selfTargetIds && selfTargetIds.length > 0) return selfTargetIds
    // An explicitly supplied empty selfTargetIds means the UI deliberately
    // skipped an optional self effect (for example BS6-020's "up to 1" HP
    // return). Older callers omit selfTargetIds and still use targetIds for
    // self-only traps such as BS1-051, so keep that compatibility path.
    if (selfTargetIds && target.min === 0) return []
  } else if (requestedIds.length === 0) {
    return requestedIds
  }
  const candidates = getEffectTargetCandidates(state, context, target)
  const candidateIds = new Set(candidates.map((c) => c.card.instanceId))
  const validIds = requestedIds.filter((id) => candidateIds.has(id))
  if (validIds.length > 0) return validIds
  return candidates.length > 0 ? [candidates[0].card.instanceId] : []
}

const validateTrapTargets = (
  state: GameState,
  playerId: PlayerId,
  effects: CardEffect[],
  targetIds: string[],
  selfTargetIds?: string[],
) => {
  const targetEffects = effects.filter(
    (effect) =>
      effect.kind === 'damage' ||
      effect.kind === 'damage-by-break-count' ||
      effect.kind === 'damage-by-break-level-difference' ||
      effect.kind === 'modify-attack' ||
      effect.kind === 'modify-attack-by-break-count' ||
      effect.kind === 'prevent-knockout' ||
      effect.kind === 'field-to-trash' ||
      effect.kind === 'redirect-attack' ||
      effect.kind === 'return-to-hand' ||
      effect.kind === 'return-to-deck-bottom' ||
      effect.kind === 'hp-to-hand' ||
      (effect.kind === 'gain-hp' && Boolean(effect.target) && !effect.target?.sourceOnly),
  )
  if (targetEffects.length === 0) {
    if (targetIds.length > 0) {
    throw new GameRuleError('Invalid battle action.')
    }
    return
  }

  const context: EffectContext = {
    sourcePlayerId: playerId,
    sourceInstanceId: 'pending-trap',
  }
  for (const effect of targetEffects) {
    const target = 'target' in effect ? effect.target : undefined
    if (!target) continue
    const effectiveIds = resolveTrapEffectTargetIds(
      state,
      context,
      target,
      targetIds,
      selfTargetIds,
    )
    selectEffectTargets(state, context, target, effectiveIds)
  }
}

const moveSupportsToTrash = (
  player: PlayerState,
  selectedIds: string[],
  amount: number,
): PlayerState => {
  const uniqueIds = [...new Set(selectedIds)]
  if (uniqueIds.length !== amount) {
    throw new GameRuleError(`Must select exactly ${amount} support cards to trash.`)
  }

  const selected = player.supportArea.filter((support) =>
    uniqueIds.includes(support.card.instanceId),
  )
  if (selected.length !== amount) {
    throw new GameRuleError('Invalid battle action.')
  }

  return {
    ...player,
    supportArea: player.supportArea.filter(
      (support) => !uniqueIds.includes(support.card.instanceId),
    ),
    discardPile: [
      ...player.discardPile,
      ...selected.map((support) => support.card),
    ],
  }
}

const moveSupportsToHand = (
  player: PlayerState,
  selectedIds: string[],
  amount: number,
): PlayerState => {
  const uniqueIds = [...new Set(selectedIds)]
  if (uniqueIds.length !== amount) {
    throw new GameRuleError(`必須選擇 ${amount} 張支援卡。`)
  }
  const selected = player.supportArea.filter((support) =>
    uniqueIds.includes(support.card.instanceId),
  )
  if (selected.length !== amount) {
    throw new GameRuleError('選擇的卡片不在支援區。')
  }
  return {
    ...player,
    supportArea: player.supportArea.filter(
      (support) => !uniqueIds.includes(support.card.instanceId),
    ),
    hand: [...player.hand, ...selected.map((support) => support.card)],
  }
}

export interface PlayTrapOptions {
  trapInstanceId: string
  /** 選取陷阱的第幾種支付方式；0 為卡面主支付。 */
  costOptionIndex?: number
  paymentIds: string[]
  targetIds: string[]
  supportTrashIds?: string[]
  supportToHandIds?: string[]
  handToSupportIds?: string[]
  discardHandIds?: string[]
  /** 放進自己休息區的手牌餅乾代價（BS3-046）。 */
  handToBreakIds?: string[]
  trashBattleCookieIds?: string[]
  trashCookieToBreakAreaIds?: string[]
  /**
   * trash-to-deck 效果的獨立目標欄位（例如 BS2-079 第二段「洗回牌庫」）。
   * 陷阱效果不像物品/技能有逐效果的 effectTargets 陣列，只有單一共用
   * targetIds；trash-to-deck 與其他可能同時出現的目標式效果（如
   * modify-attack）語意不同、選擇對象也不同，需要自己的欄位才能與
   * targetIds 並存，不會互相覆蓋。
   */
  trashToDeckIds?: string[]
  /**
   * 自身目標效果的獨立目標欄位（例如 BS3-021 的「1 of your Cookies takes
   * 1 damage」）。與 targetIds（通常瞄準對手）的目標側不同，不能共用。
   */
  selfTargetIds?: string[]
}

export const getTrapCostOptions = (trap: TrapAbility): AbilityCost[] => [
  trap.cost,
  ...(trap.alternativeCosts ?? []),
]

const canPayTrapCost = (
  state: GameState,
  playerId: PlayerId,
  cost: AbilityCost,
  trapInstanceId?: string,
): boolean => {
  const player = state.players[playerId]
  const handCandidates = getDiscardHandCostCandidates(
    cost,
    player.hand,
    trapInstanceId,
  )
  const handToBreakCost = cost.handToBreakArea
  const handToBreakCandidates = handToBreakCost
    ? player.hand.filter(
        (card) =>
          card.instanceId !== trapInstanceId &&
          card.type === 'cookie' &&
          (handToBreakCost.energyColor === undefined ||
            card.energyColor === handToBreakCost.energyColor),
      )
    : []
  return (
    selectEnergyPayment(cost.energy ?? cost, player.supportArea) !== null &&
    handCandidates.length >= (cost.discardHand ?? 0) &&
    handToBreakCandidates.length >= (handToBreakCost?.count ?? 0) &&
    canPayTrashBattleCookieCost(cost, player.battleArea) &&
    canPayTrashCookieToBreakAreaCost(cost, player.discardPile)
  )
}

export interface PlayBlockerOptions {
  sourceInstanceId: string
  paymentIds: string[]
}

/**
 * 對手指攻回應技能候選（BS5-081 Squid Ink Cookie 的「When your opponent's
 * Cookie attacks」）：防守方在陷阱視窗（stage 'trap'）內可以宣告的
 * 一次性回應技能。與陷阱／阻擋者不同，此技能不關閉回應窗，使用後仍可
 * 繼續選陷阱／阻擋者或直接 skipTrap。
 */
export const getAttackResponseSkillCandidates = (
  state: GameState,
  playerId: PlayerId,
): CookieInBattle[] => {
  const battle = state.pendingBattle
  if (
    !battle ||
    battle.stage !== 'trap' ||
    battle.defenderPlayerId !== playerId
  ) {
    return []
  }
  return state.players[playerId].battleArea.filter((cookie) => {
    const skill = cookie.card.skill
    if (!skill || skill.trigger !== 'opponent-attack') return false
    if (
      skill.oncePerTurn &&
      state.skillUsesThisTurn.includes(
        cookie.battleEntryId ?? cookie.card.instanceId,
      )
    ) {
      return false
    }
    const cost = skill.cost ?? {}
    return (
      state.players[playerId].hand.length >= (cost.discardHand ?? 0) &&
      canPayTrashToDeckCost(cost, state.players[playerId].discardPile)
    )
  })
}

export interface PlayAttackResponseSkillOptions {
  sourceInstanceId: string
  discardHandIds: string[]
  trashToDeckIds: string[]
}

/**
 * 對手指攻回應技能（BS5-081／BS5-092）：支付技能代價後結算效果。
 * - BS5-081 的 prevent-knockout 寫入 pendingBattle.preventKnockoutTargetIds，
 *   與陷阱的 prevent-knockout 共用同一條傷害防護檢查。
 * - 其餘效果（BS5-092 的 modify-attack）排入 pendingAbilityEffect，由既有
 *   逐段結算流程選目標；不掛 battleContinuation，讓陷阱視窗保持 open
 *   （stage 仍為 'trap'），防守方之後仍可選陷阱／阻擋者或 skipTrap。
 *   傷害在視窗真正關閉時由 advanceBattleAfterTrap 依 attackModifiers 重算。
 */
export const playAttackResponseSkill = (
  state: GameState,
  playerId: PlayerId,
  options: PlayAttackResponseSkillOptions,
): GameState => {
  const battle = requirePendingBattle(state)
  if (battle.stage !== 'trap' || battle.defenderPlayerId !== playerId) {
    throw new GameRuleError('Invalid battle action.')
  }

  const player = state.players[playerId]
  const source = player.battleArea.find(
    (cookie) => cookie.card.instanceId === options.sourceInstanceId,
  )
  const skill = source?.card.skill
  if (!source || !skill || skill.trigger !== 'opponent-attack') {
    throw new GameRuleError('Invalid battle action.')
  }

  const useKey = source.battleEntryId ?? source.card.instanceId
  if (skill.oncePerTurn && state.skillUsesThisTurn.includes(useKey)) {
    throw new GameRuleError('This skill can only be used once per turn.')
  }

  const cost = skill.cost ?? {}
  const discardCount = cost.discardHand ?? 0
  const uniqueDiscardIds = [...new Set(options.discardHandIds)]
  if (uniqueDiscardIds.length !== discardCount) {
    throw new GameRuleError(
      `Must discard exactly ${discardCount} cards for this skill.`,
    )
  }
  if (uniqueDiscardIds.length !== options.discardHandIds.length) {
    throw new GameRuleError('Invalid battle action.')
  }
  const discardedCards = player.hand.filter((card) =>
    uniqueDiscardIds.includes(card.instanceId),
  )
  if (discardedCards.length !== uniqueDiscardIds.length) {
    throw new GameRuleError('Invalid battle action.')
  }

  const trashToDeckCost = cost.trashToDeck
  const uniqueTrashToDeckIds = [...new Set(options.trashToDeckIds)]
  if (uniqueTrashToDeckIds.length !== options.trashToDeckIds.length) {
    throw new GameRuleError('不能重複選擇同一張棄牌區卡牌作為代價。')
  }
  if (trashToDeckCost) {
    if (uniqueTrashToDeckIds.length !== trashToDeckCost.count) {
      throw new GameRuleError(
        `必須選擇 ${trashToDeckCost.count} 張棄牌區卡牌作為技能代價。`,
      )
    }
    const candidateIds = new Set(
      getTrashToDeckCostCandidates(cost, player.discardPile).map(
        (card) => card.instanceId,
      ),
    )
    if (uniqueTrashToDeckIds.some((id) => !candidateIds.has(id))) {
      throw new GameRuleError('棄牌區卡牌不符合洗回牌庫代價條件。')
    }
  } else if (uniqueTrashToDeckIds.length > 0) {
    throw new GameRuleError('此技能不需要支付洗回牌庫代價。')
  }

  const trashToDeckSet = new Set(uniqueTrashToDeckIds)
  const trashToDeckCards = player.discardPile.filter((card) =>
    trashToDeckSet.has(card.instanceId),
  )
  const afterCostPlayer: PlayerState = {
    ...player,
    hand: player.hand.filter(
      (card) => !uniqueDiscardIds.includes(card.instanceId),
    ),
    discardPile: [
      ...player.discardPile.filter((card) => !trashToDeckSet.has(card.instanceId)),
      ...discardedCards,
    ],
    deck: trashToDeckCost
      ? defaultShuffle([...player.deck, ...trashToDeckCards])
      : player.deck,
  }

  const preventKnockoutEffects = skill.effects.filter(
    (effect) =>
      effect.kind === 'prevent-knockout' && effect.target.sourceOnly === true,
  )
  const queuedEffects = skill.effects.filter(
    (effect) =>
      !(
        effect.kind === 'prevent-knockout' &&
        effect.target.sourceOnly === true
      ),
  )

  const nextState: GameState = {
    ...state,
    players: {
      ...state.players,
      [playerId]: afterCostPlayer,
    },
    pendingBattle: {
      ...battle,
      ...(preventKnockoutEffects.length > 0
        ? {
            preventKnockoutTargetIds: [
              ...battle.preventKnockoutTargetIds,
              source.card.instanceId,
            ],
          }
        : {}),
    },
    skillUsesThisTurn: [...state.skillUsesThisTurn, useKey],
  }

  if (queuedEffects.length === 0) return nextState

  return {
    ...nextState,
    pendingAbilityEffect: {
      playerId,
      sourcePlayerId: playerId,
      sourceInstanceId: source.card.instanceId,
      sourceCardName: source.card.name,
      sourceKind: 'skill',
      effects: queuedEffects,
      effectIndex: 0,
    },
  }
}

export const playBlocker = (
  state: GameState,
  playerId: PlayerId,
  options: PlayBlockerOptions,
): GameState => {
  const battle = requirePendingBattle(state)
  if (battle.stage !== 'trap' || battle.defenderPlayerId !== playerId) {
    throw new GameRuleError('Invalid battle action.')
  }

  if (isBlockDisabled(state, playerId)) {
    throw new GameRuleError('Invalid battle action.')
  }

  const player = state.players[playerId]
  const sourceIndex = player.battleArea.findIndex(
    (cookie) => cookie.card.instanceId === options.sourceInstanceId,
  )
  const source = player.battleArea[sourceIndex]
  const skill = source?.card.skill

  if (!source || !skill || skill.trigger !== 'block') {
    throw new GameRuleError('Invalid battle action.')
  }

  if (source.card.instanceId === battle.targetInstanceId) {
    throw new GameRuleError('Invalid battle action.')
  }

  const paymentValidation = validateEnergyPayment(
    skill.cost.energy ?? skill.cost,
    player.supportArea,
    options.paymentIds,
  )
  if (!paymentValidation.valid) {
    throw new GameRuleError(`Invalid {bl} payment: ${paymentValidation.reason}`)
  }

  const paymentSet = new Set(options.paymentIds)
  const redirectedDamage = getAttackDamageAgainst(
    state,
    battle.attackerInstanceId,
    source.card.instanceId,
  )

  return {
    ...state,
    players: {
      ...state.players,
      [playerId]: {
        ...player,
        supportArea: player.supportArea.map((support) =>
          paymentSet.has(support.card.instanceId)
            ? { ...support, rested: true }
            : support,
        ),
      },
    },
    pendingBattle: {
      ...battle,
      targetInstanceId: source.card.instanceId,
      declaredDamage: redirectedDamage,
      remainingDamage: redirectedDamage,
      stage: 'damage',
    },
  }
}

export const playTrap = (
  state: GameState,
  playerId: PlayerId,
  options: PlayTrapOptions,
): GameState => {
  const battle = requirePendingBattle(state)
  if (
    battle.stage !== 'trap' ||
    battle.trapUsed ||
    battle.trapsDisabled ||
    battle.defenderPlayerId !== playerId
  ) {
    throw new GameRuleError('Invalid battle action.')
  }

  const player = state.players[playerId]
  const trapIndex = player.hand.findIndex(
    (card) => card.instanceId === options.trapInstanceId,
  )
  const trapCard = player.hand[trapIndex]
  const trap = trapCard?.trap

  if (!trapCard || trapCard.type !== 'trap' || !trap) {
    throw new GameRuleError('Invalid battle action.')
  }

  if (!isTrapConditionMet(state, playerId, trap)) {
    throw new GameRuleError('Invalid battle action.')
  }

  const costOptions = getTrapCostOptions(trap)
  const costOptionIndex = options.costOptionIndex ?? 0
  const paidCost = costOptions[costOptionIndex]
  if (!paidCost || !canPayTrapCost(state, playerId, paidCost, trapCard.instanceId)) {
    throw new GameRuleError('Invalid trap payment option.')
  }

  const paymentValidation = validateEnergyPayment(
    paidCost.energy ?? paidCost,
    player.supportArea,
    options.paymentIds,
  )
  if (!paymentValidation.valid) {
    throw new GameRuleError(`Invalid trap payment: ${paymentValidation.reason}`)
  }

  validateTrapTargets(state, playerId, trap.effects, options.targetIds, options.selfTargetIds)

  const discardHandIds = options.discardHandIds ?? []
  const uniqueDiscardHandIds = [...new Set(discardHandIds)]
  if (
    uniqueDiscardHandIds.length !== discardHandIds.length ||
    uniqueDiscardHandIds.length !== (paidCost.discardHand ?? 0)
  ) {
    throw new GameRuleError(
      `Must discard exactly ${paidCost.discardHand ?? 0} cards from hand.`,
    )
  }
  const discardedHandCards = player.hand.filter(
    (card) =>
      card.instanceId !== trapCard.instanceId &&
      uniqueDiscardHandIds.includes(card.instanceId),
  )
  if (discardedHandCards.length !== (paidCost.discardHand ?? 0)) {
    throw new GameRuleError('Invalid battle action.')
  }
  if (paidCost.discardHandColor) {
    const invalidDiscard = discardedHandCards.find(
      (card) => card.energyColor !== paidCost.discardHandColor,
    )
    if (invalidDiscard) {
      throw new GameRuleError(
        `Discarded cards must be ${paidCost.discardHandColor} energy color.`,
      )
    }
  }

  // 手牌餅乾放進自己的休息區，與 discardHand（進棄牌區）不同，會推進自己的 break 等級。
  const handToBreakCost = paidCost.handToBreakArea
  const uniqueHandToBreakIds = [...new Set(options.handToBreakIds ?? [])]
  if (uniqueHandToBreakIds.length !== (options.handToBreakIds ?? []).length) {
    throw new GameRuleError('休息區代價不能重複選同一張手牌。')
  }
  if (uniqueHandToBreakIds.length !== (handToBreakCost?.count ?? 0)) {
    throw new GameRuleError(
      `必須將 ${handToBreakCost?.count ?? 0} 張手牌餅乾放入休息區。`,
    )
  }
  const handToBreakCards = player.hand.filter(
    (card) =>
      card.instanceId !== trapCard.instanceId &&
      uniqueHandToBreakIds.includes(card.instanceId) &&
      card.type === 'cookie' &&
      (handToBreakCost?.energyColor === undefined ||
        card.energyColor === handToBreakCost.energyColor),
  )
  if (handToBreakCards.length !== uniqueHandToBreakIds.length) {
    throw new GameRuleError('選擇的休息區代價手牌不合法。')
  }
  if (uniqueDiscardHandIds.some((id) => uniqueHandToBreakIds.includes(id))) {
    throw new GameRuleError('同一張手牌不能同時支付兩種代價。')
  }

  const paymentSet = new Set(options.paymentIds)
  let updatedPlayer: PlayerState = {
    ...player,
    breakArea: [
      ...player.breakArea,
      ...(handToBreakCards as CookieCard[]),
    ],
    hand: player.hand.filter(
      (card, index) =>
        index !== trapIndex &&
        !uniqueDiscardHandIds.includes(card.instanceId) &&
        !uniqueHandToBreakIds.includes(card.instanceId),
    ),
    supportArea: player.supportArea.map((support) =>
      paymentSet.has(support.card.instanceId)
        ? { ...support, rested: true }
        : support,
    ),
    discardPile: [...player.discardPile, trapCard, ...discardedHandCards],
  }

  const supportToTrash = trap.effects.find(
    (effect) => effect.kind === 'support-to-trash',
  )
  if (supportToTrash?.kind === 'support-to-trash') {
    updatedPlayer = moveSupportsToTrash(
      updatedPlayer,
      options.supportTrashIds ?? [],
      supportToTrash.amount,
    )
  }

  const supportToHand = trap.effects.find(
    (effect) => effect.kind === 'support-to-hand',
  )
  if (supportToHand?.kind === 'support-to-hand') {
    const ids = options.supportToHandIds ?? []
    if (ids.length >= supportToHand.amount) {
      updatedPlayer = moveSupportsToHand(
        updatedPlayer,
        ids,
        supportToHand.amount,
      )
    }
  }

  const handToSupport = trap.effects.find(
    (effect) => effect.kind === 'hand-to-support',
  )
  if (handToSupport?.kind === 'hand-to-support') {
    const uniqueHandIds = [...new Set(options.handToSupportIds ?? [])]
    if (uniqueHandIds.length === handToSupport.amount) {
      const selectedHand = updatedPlayer.hand.filter((card) =>
        uniqueHandIds.includes(card.instanceId),
      )
      if (selectedHand.length === handToSupport.amount) {
        updatedPlayer = {
          ...updatedPlayer,
          hand: updatedPlayer.hand.filter(
            (card) => !uniqueHandIds.includes(card.instanceId),
          ),
          supportArea: [
            ...updatedPlayer.supportArea,
            ...selectedHand.map((card) => ({
              card,
              rested: handToSupport.rested ?? true,
            })),
          ],
        }
      }
    }
  }

  const trashBattlePayment = payTrashBattleCookieCost(
    updatedPlayer,
    paidCost,
    options.trashBattleCookieIds ?? [],
  )
  updatedPlayer = trashBattlePayment.player
  updatedPlayer = payTrashCookieToBreakAreaCost(
    updatedPlayer,
    paidCost,
    options.trashCookieToBreakAreaIds ?? [],
  )

  let nextState: GameState = {
    ...state,
    players: {
      ...state.players,
      [playerId]: updatedPlayer,
    },
    pendingBattle: {
      ...battle,
      trapUsed: true,
      ...(trap.condition?.kind === 'friendly-color-fainted-this-battle'
        ? {
            delayedTrap: {
              playerId,
              sourceInstanceId: trapCard.instanceId,
              sourceCardName: trapCard.name,
              color: trap.condition.color,
              ...(trap.condition.minLevel !== undefined
                ? { minLevel: trap.condition.minLevel }
                : {}),
              effects: trap.effects,
            },
          }
        : trap.condition?.kind === 'friendly-cookie-fainted-this-battle'
          ? {
              delayedTrap: {
                playerId,
                sourceInstanceId: trapCard.instanceId,
                sourceCardName: trapCard.name,
                anyFriendlyCookie: true,
                effects: trap.effects,
              },
            }
          : {}),
    },
  }

  if (trashBattlePayment.departedCount > 0) {
    nextState = recordCookieDepartures(
      clearDepartedCookieModifiers(nextState),
      playerId,
      trashBattlePayment.departedCount,
    )
  }

  if (handToBreakCards.length > 0) {
    const arenaCount = handToBreakCards.filter((card) =>
      card.keywords?.includes('arena'),
    ).length
    if (arenaCount > 0) {
      nextState = {
        ...nextState,
        arenaCookiesPlacedInBreakThisTurn: {
          ...(nextState.arenaCookiesPlacedInBreakThisTurn ?? {}),
          [playerId]:
            (nextState.arenaCookiesPlacedInBreakThisTurn?.[playerId] ?? 0) +
            arenaCount,
        },
      }
    }
    // 手牌進休息區會推進自己的 break 等級，必須立刻結算勝負。
    nextState = resolveBreakLevelVictory(nextState)
  }

  if (supportToTrash?.kind === 'support-to-trash') {
    nextState = markSupportAreaDecreased(nextState, playerId, {
      triggerSkill: (options.supportTrashIds ?? []).length > 0,
      trashedCount: (options.supportTrashIds ?? []).length,
    })
  }

  const context = {
    sourcePlayerId: playerId,
    sourceInstanceId: trapCard.instanceId,
    sourceCardName: trapCard.name,
  }

  for (let effectIndex = 0; effectIndex < trap.effects.length; effectIndex += 1) {
    const effect = trap.effects[effectIndex]
    if (
      trap.condition?.kind === 'friendly-color-fainted-this-battle' ||
      trap.condition?.kind === 'friendly-cookie-fainted-this-battle'
    ) {
      continue
    }

    // 陷阱可能一次帶多個子效果，各自有自己的 condition（例如 BS3-070 的
    // draw-up-to／discard-hand 都掛「支援區至少 5 張」）。這裡跟
    // filterActiveEffects（item／技能路徑）一樣先濾掉條件不成立的子效果，
    // 不然落到最後 fallback 分支的 executeCardEffect 會透過 assertCondition
    // 直接拋錯，讓整個 playTrap 連同前面已經生效的子效果一起中止。
    if (!isEffectConditionMet(nextState, context, effect)) {
      continue
    }

    if (
      effect.kind === 'support-to-trash' ||
      effect.kind === 'prevent-knockout'
    ) {
      if (effect.kind === 'prevent-knockout') {
        const targets = selectEffectTargets(
          nextState,
          context,
          effect.target,
          options.targetIds,
        )
        nextState = {
          ...nextState,
          pendingBattle: {
            ...requirePendingBattle(nextState),
            preventKnockoutTargetIds: [
              ...requirePendingBattle(nextState).preventKnockoutTargetIds,
              ...targets.map((target) => target.card.instanceId),
            ],
          },
        }
      }
      continue
    }

    if (effect.kind === 'support-to-hand') {
      continue
    }

    if (effect.kind === 'hand-to-support') {
      continue
    }

    if (effect.kind === 'redirect-attack') {
      const redirectTargetIds = resolveTrapEffectTargetIds(
        nextState,
        context,
        effect.target,
        options.targetIds,
        options.selfTargetIds,
      )
      const targets = selectEffectTargets(
        nextState,
        context,
        effect.target,
        redirectTargetIds,
      )
      const redirectTarget = targets[0]
      const activeBattle = requirePendingBattle(nextState)
      if (!redirectTarget) {
    throw new GameRuleError('Invalid battle action.')
      }
      if (redirectTarget.card.instanceId === activeBattle.targetInstanceId) {
    throw new GameRuleError('Invalid battle action.')
      }
      const redirectedDamage = getAttackDamageAgainst(
        nextState,
        activeBattle.attackerInstanceId,
        redirectTarget.card.instanceId,
      )
      nextState = {
        ...nextState,
        pendingBattle: {
          ...activeBattle,
          targetInstanceId: redirectTarget.card.instanceId,
          declaredDamage: redirectedDamage,
          remainingDamage: redirectedDamage,
        },
      }
      continue
    }

    if (
      effect.kind === 'damage' ||
      effect.kind === 'damage-by-break-level-difference'
    ) {
      const damageTargetIds = resolveTrapEffectTargetIds(
        nextState,
        context,
        effect.target,
        options.targetIds,
        options.selfTargetIds,
      )
      const targets = selectEffectTargets(
        nextState,
        context,
        effect.target,
        damageTargetIds,
      )
      if (targets.length === 0) {
        continue
      }
      const target = targets[0]
      const targetPlayerId = Object.values(nextState.players).find((owner) =>
        owner.battleArea.some(
          (cookie) =>
            cookie.card.instanceId === target?.card.instanceId,
        ),
      )?.id
      if (!target || !targetPlayerId) {
    throw new GameRuleError('Invalid battle action.')
      }
      const activeBattle = requirePendingBattle(nextState)
      const damageAmount =
        effect.kind === 'damage'
          ? effect.amount
          : Math.max(
              0,
              getBreakAreaLevel(nextState, playerId) -
                getBreakAreaLevel(nextState, getOpponentId(playerId)),
            )
      nextState = {
        ...nextState,
        pendingBattle: {
          ...activeBattle,
          stage: 'damage',
          remainingDamage: damageAmount,
          damagePlayerId: targetPlayerId,
          damageTargetInstanceId: target.card.instanceId,
          suspendedAttackDamage: activeBattle.declaredDamage,
        },
      }
      continue
    }

    if (effect.kind === 'trash-to-deck') {
      nextState = executeCardEffect(
        nextState,
        context,
        effect,
        options.trashToDeckIds ?? [],
      )
      continue
    }

    // 陷阱的第一段戰鬥區目標與後續「從棄牌區登場」不是同一批卡。
    // 不能把既有 targetIds 再傳給 trash-to-battle，否則會把對手餅乾當成
    // 自己棄牌區的候選而被規則層拒絕。改交由既有的 pendingAbilityEffect
    // 逐段選擇，並以 after-trap 在結算後回到同一場戰鬥重算傷害。
    if (effect.kind === 'trash-to-battle') {
      const candidates = getEffectSelectionCandidates(nextState, context, effect)
      if (candidates.length === 0) {
        nextState = executeCardEffect(nextState, context, effect, [])
        continue
      }
      return {
        ...nextState,
        pendingAbilityEffect: {
          playerId,
          sourcePlayerId: playerId,
          sourceInstanceId: trapCard.instanceId,
          sourceCardName: trapCard.name,
          sourceKind: 'trap',
          effects: trap.effects,
          effectIndex,
          battleContinuation: 'after-trap',
        },
      }
    }

    // 從棄牌區選餅乾放入支援區也必須沿用 pending ability 的選卡流程。
    // 不能把前一段戰鬥目標的 targetIds 直接傳進 executeCardEffect，否則
    // 會把對手戰鬥區 instanceId 當成自己的棄牌區餅乾而被規則層拒絕。
    if (effect.kind === 'trash-to-support') {
      const candidates = getEffectSelectionCandidates(nextState, context, effect)
      if (candidates.length === 0) {
        if (effect.optional) {
          nextState = executeCardEffect(nextState, context, effect, [])
        }
        continue
      }
      return {
        ...nextState,
        pendingAbilityEffect: {
          playerId,
          sourcePlayerId: playerId,
          sourceInstanceId: trapCard.instanceId,
          sourceCardName: trapCard.name,
          sourceKind: 'trap',
          effects: trap.effects,
          effectIndex,
          battleContinuation: 'after-trap',
        },
      }
    }

    // 陷阱的手牌／休息區移動效果也需要獨立的選卡步驟。若直接落入
    // fallback，resolveTrapEffectTargetIds 會把前一段戰鬥目標傳入，
    // 導致用對手戰鬥區 instanceId 嘗試支付自己的區域效果而失敗。
    // pendingAbilityEffect 會在玩家選完後沿用一般效果佇列；若這段有
    // thenEffects（例如 BS2-014），commands 層只在確實選到卡牌時展開。
    if (effect.kind === 'hand-to-break' || effect.kind === 'break-to-hand') {
      const candidates = getEffectSelectionCandidates(nextState, context, effect)
      if (candidates.length === 0) {
        // 沒有合法候選時，optional 效果等同選 0；mandatory 效果則依
        // 既有 pending queue 規則略過不可完成的步驟，讓陷阱仍能收尾。
        if (effect.optional) {
          nextState = executeCardEffect(nextState, context, effect, [])
        }
        continue
      }
      return {
        ...nextState,
        pendingAbilityEffect: {
          playerId,
          sourcePlayerId: playerId,
          sourceInstanceId: trapCard.instanceId,
          sourceCardName: trapCard.name,
          sourceKind: 'trap',
          effects: trap.effects,
          effectIndex,
          battleContinuation: 'after-trap',
        },
      }
    }

    // 陷阱也可能包含「選擇一項」；先保留未展開的效果佇列，讓 UI／AI
    // 透過既有 resolve-choose-one 流程選模式，再接續同一場戰鬥。
    if (effect.kind === 'choose-one') {
      return {
        ...nextState,
        pendingAbilityEffect: {
          playerId,
          sourcePlayerId: playerId,
          sourceInstanceId: trapCard.instanceId,
          sourceCardName: trapCard.name,
          sourceKind: 'trap',
          effects: trap.effects,
          effectIndex,
          battleContinuation: 'after-trap',
        },
      }
    }

    nextState = executeCardEffect(
      nextState,
      context,
      effect,
      effect.kind === 'draw' ||
        effect.kind === 'deck-to-support' ||
        (effect.kind === 'gain-hp' && (!effect.target || effect.target.sourceOnly))
        ? []
        : resolveTrapEffectTargetIds(
            nextState,
            context,
            'target' in effect ? effect.target : undefined,
            options.targetIds,
            options.selfTargetIds,
          ),
    )
    if (nextState.pendingRevealTopDeck) break
  }

  if (nextState.status !== 'playing') {
    return { ...nextState, pendingBattle: null }
  }

  const activeBattle = requirePendingBattle(nextState)
  if (activeBattle.suspendedAttackDamage !== undefined) {
    return nextState
  }

  // 陷阱裡的 reveal-top-deck（BS3-093）還沒確認，巢狀效果可能再改一次攻擊力，
  // 現在鎖傷害的話那個 -1 就永遠打不到。改由 resolve-reveal-top-deck 結算完
  // 巢狀效果後呼叫 advanceBattleAfterTrap 推進。
  if (nextState.pendingRevealTopDeck) {
    return {
      ...nextState,
      pendingRevealTopDeck: {
        ...nextState.pendingRevealTopDeck,
        battleContinuation: 'after-trap',
      },
    }
  }

  return advanceBattleAfterTrap(nextState)
}

/**
 * 陷阱視窗結束後把戰鬥推進到傷害階段；攻守任一方已離場就直接收尾。
 *
 * 傷害要在這裡才重算：陷阱效果（含 BS3-093 翻牌後的巢狀 modify-attack）會改動
 * 攻擊力，提早鎖住 `remainingDamage` 等於讓那些效果失效。
 */
export const advanceBattleAfterTrap = (state: GameState): GameState => {
  const activeBattle = requirePendingBattle(state)

  const attackerExists = battleParticipantExists(
    state,
    activeBattle.attackerInstanceId,
  )
  const targetExists = battleParticipantExists(
    state,
    activeBattle.targetInstanceId,
  )

  if (!attackerExists || !targetExists) {
    return finishBattle(state)
  }

  const recalculatedDamage = getAttackDamageAgainst(
    state,
    activeBattle.attackerInstanceId,
    activeBattle.targetInstanceId,
  )

  return {
    ...state,
    pendingBattle: {
      ...activeBattle,
      declaredDamage: recalculatedDamage,
      remainingDamage: recalculatedDamage,
      stage: 'damage',
    },
  }
}

export const skipTrap = (state: GameState, playerId: PlayerId): GameState => {
  const battle = requirePendingBattle(state)
  if (
    battle.stage !== 'trap' ||
    battle.defenderPlayerId !== playerId
  ) {
    throw new GameRuleError('Invalid battle action.')
  }

  // 對手指攻回應技能（BS5-092）會在視窗內改動 attackModifiers，
  // 即使防守方最後選擇略過陷阱，傷害也必須像 playTrap 路徑一樣重算。
  return advanceBattleAfterTrap(state)
}

const addFaintedColor = (
  colors: EnergyColor[],
  card: GameCard,
): EnergyColor[] => {
  const color = card.energyColor
  return color && color !== 'wild' && !colors.includes(color)
    ? [...colors, color]
    : colors
}

/**
 * 攻擊者的被動技能若明確檢查「本次戰鬥有對手餅乾昏厥」，要在昏厥實際發生
 * 後建立效果佇列。這和「此餅乾昏厥時」不同：來源仍在戰鬥區，且依官方規則
 * （昏厥後先維持戰線），對手的空場補位／Refresh 必須優先完成，補位完成後
 * 再由既有的 pendingAbilityEffect UI 逐步結算。佇列以
 * `trigger: 'attacker-faint'` 標記，讓 `continuePendingReplacements` 不會被它
 * 阻塞，但 `resolvePendingAbilityEffect` 仍會拒絕在補位完成前結算。
 */
const queueAttackerFaintTriggeredSkill = (
  state: GameState,
  faintedPlayerId: PlayerId,
): GameState => {
  const battle = requirePendingBattle(state)
  if (battle.effectDamageSequence) return state
  if (faintedPlayerId !== getOpponentId(battle.attackerPlayerId)) return state
  if (state.pendingAbilityEffect) return state

  const attacker = state.players[battle.attackerPlayerId].battleArea.find(
    (cookie) => cookie.card.instanceId === battle.attackerInstanceId,
  )
  const skill = attacker?.card.skill
  if (!attacker || !skill || skill.trigger !== 'passive') return state

  const context: EffectContext = {
    sourcePlayerId: battle.attackerPlayerId,
    sourceInstanceId: attacker.card.instanceId,
    sourceCardName: attacker.card.name,
  }
  const effects = skill.effects.flatMap((effect) => {
    if (
      !('condition' in effect) ||
      effect.condition?.kind !== 'opponent-cookie-fainted-in-current-battle' ||
      !isEffectConditionMet(state, context, effect)
    ) {
      return []
    }
    return [{ ...effect, condition: undefined } as CardEffect]
  })
  if (effects.length === 0) return state

  return {
    ...state,
    pendingAbilityEffect: {
      playerId: battle.attackerPlayerId,
      sourcePlayerId: battle.attackerPlayerId,
      sourceInstanceId: attacker.card.instanceId,
      sourceCardName: attacker.card.name,
      sourceKind: 'skill',
      trigger: 'attacker-faint',
      effects,
      effectIndex: 0,
    },
  }
}

const removeFaintedCookie = (
  state: GameState,
  playerId: PlayerId,
  targetInstanceId: string,
): GameState => {
  const battle = requirePendingBattle(state)
  const player = state.players[playerId]
  const target = player.battleArea.find(
    (cookie) => cookie.card.instanceId === targetInstanceId,
  )
  if (!target || target.hpCards.length > 0) {
    return state
  }

  let nextState = recordCookieDepartures(
    {
      ...state,
      players: {
        ...state.players,
        [playerId]: {
          ...player,
          battleArea: player.battleArea.filter(
            (cookie) => cookie.card.instanceId !== targetInstanceId,
          ),
          breakArea: [...player.breakArea, target.card],
          discardPile: [...player.discardPile, ...(target.equippedCards ?? [])],
        },
      },
      pendingBattle: {
        ...battle,
        faintedColors: addFaintedColor(battle.faintedColors, target.card),
        faintedCookies: [
          ...(battle.faintedCookies ?? []),
          {
            playerId,
            energyColor: target.card.energyColor,
            level: target.card.level,
          },
        ],
      },
      cookiesFaintedThisTurn: {
        ...(state.cookiesFaintedThisTurn ?? {}),
        [playerId]: (state.cookiesFaintedThisTurn?.[playerId] ?? 0) + 1,
      } as Record<PlayerId, number>,
    },
    playerId,
    1,
  )

  const faintSkill = target.card.skill
  if (faintSkill && faintSkill.faint) {
    const context = {
      sourcePlayerId: playerId,
      sourceInstanceId: target.card.instanceId,
      sourceCardName: target.card.name,
    }
    const faintCost = getFaintTriggeredCost(faintSkill)
    let faintCostAttached = false
    let faintOptionalAttached = false
    for (const effect of faintSkill.effects) {
      if (!isEffectConditionMet(nextState, context, effect)) continue

      if (
        effect.kind === 'damage' ||
        effect.kind === 'modify-attack' ||
        effect.kind === 'modify-damage-received'
      ) {
        const candidates = getEffectTargetCandidates(nextState, context, effect.target)
        if (candidates.length > 0) {
          nextState = {
            ...nextState,
            pendingFaintEffects: [
              ...(nextState.pendingFaintEffects ?? []),
              {
                sourcePlayerId: playerId,
                sourceInstanceId: target.card.instanceId,
                sourceCardName: target.card.name,
                ...(faintSkill.faintOptional && !faintOptionalAttached
                  ? { optional: true }
                  : {}),
                effect,
                context,
                ...(faintCost && !faintCostAttached
                  ? { cost: faintCost }
                  : {}),
              },
            ],
          }
          faintCostAttached = true
          faintOptionalAttached = true
        }
      } else {
        nextState = {
          ...nextState,
          pendingFaintEffects: [
            ...(nextState.pendingFaintEffects ?? []),
            {
              sourcePlayerId: playerId,
              sourceInstanceId: target.card.instanceId,
              sourceCardName: target.card.name,
              ...(faintSkill.faintOptional && !faintOptionalAttached
                ? { optional: true }
                : {}),
              effect,
              context,
              ...(faintCost && !faintCostAttached
                ? { cost: faintCost }
                : {}),
            },
          ],
        }
        faintCostAttached = true
        faintOptionalAttached = true
      }
    }
  }

  return continuePendingReplacements(
    queueAttackerFaintTriggeredSkill(nextState, playerId),
  )
}
/**
 * 延遲陷阱是否成立。未指定 `minLevel` 時沿用舊行為（只看本次戰鬥有沒有該顏色
 * 的餅乾昏厥）；指定時改用 `faintedCookies`，額外要求昏厥的是陷阱擁有者自己的
 * 餅乾且等級達標（BS3-046 的「your {Y} LV.2 or higher Cookies」）。
 */
const isDelayedTrapTriggered = (battle: PendingBattle): boolean => {
  const delayed = battle.delayedTrap
  if (!delayed) return false
  if (delayed.anyFriendlyCookie) {
    return (battle.faintedCookies ?? []).some(
      (fainted) => fainted.playerId === delayed.playerId,
    )
  }
  if (!delayed.color) return false
  if (delayed.minLevel === undefined) {
    return battle.faintedColors.includes(delayed.color)
  }
  return (battle.faintedCookies ?? []).some(
    (fainted) =>
      fainted.playerId === delayed.playerId &&
      fainted.energyColor === delayed.color &&
      fainted.level >= delayed.minLevel!,
  )
}

export const finishBattle = (state: GameState): GameState => {
  const battle = requirePendingBattle(state)
  let completedState = state
  if (battle.delayedTrap && isDelayedTrapTriggered(battle)) {
    const context = {
      sourcePlayerId: battle.delayedTrap.playerId,
      sourceInstanceId: battle.delayedTrap.sourceInstanceId,
      sourceCardName: battle.delayedTrap.sourceCardName,
    }

    // 需要玩家選卡的效果不能在這裡直接執行（會被當成「選 0 張」而失效），
    // 改交給既有的 pendingAbilityEffect 逐步流程處理。
    if (battle.delayedTrap.effects.some(requiresEffectCardSelection)) {
      return finalizePendingReplacements({
        ...buildPendingEffectOrder(completedState),
        pendingBattle: null,
        pendingAbilityEffect: {
          playerId: battle.delayedTrap.playerId,
          sourcePlayerId: battle.delayedTrap.playerId,
          sourceInstanceId: battle.delayedTrap.sourceInstanceId,
          sourceCardName: battle.delayedTrap.sourceCardName,
          sourceKind: 'trap',
          effects: battle.delayedTrap.effects,
          effectIndex: 0,
        },
      })
    }

    for (let i = 0; i < battle.delayedTrap.effects.length; i += 1) {
      const effect = battle.delayedTrap.effects[i]
      completedState = executeCardEffect(
        completedState,
        context,
        effect,
        [],
      )
      if (completedState.pendingBattle?.effectDamageSequence) {
        return {
          ...completedState,
          pendingAbilityEffect: {
            playerId: battle.delayedTrap.playerId,
            sourcePlayerId: battle.delayedTrap.playerId,
            sourceInstanceId: battle.delayedTrap.sourceInstanceId,
            sourceCardName: battle.delayedTrap.sourceCardName,
            sourceKind: 'trap',
            effects: battle.delayedTrap.effects,
            effectIndex: i,
            battleContinuation: 'finish',
          },
          pendingBattle: {
            ...completedState.pendingBattle,
            delayedTrap: undefined,
            effectDamageSequence: {
              ...completedState.pendingBattle.effectDamageSequence,
              continuation: 'ability-effect',
              resumeBattleAfterAbility: true,
            },
          },
        }
      }
      const remainingEffects = battle.delayedTrap.effects.slice(i + 1)
      if (completedState.pendingDrawUpTo && remainingEffects.length > 0) {
        completedState = {
          ...completedState,
          pendingDrawUpTo: {
            ...completedState.pendingDrawUpTo,
            afterEffects: remainingEffects,
            afterEffectContext: context,
          },
        }
        break
      }
    }
  }

  // reveal-top-deck 需要玩家確認後才執行巢狀效果，此處保留 pendingBattle
  // 讓巢狀 damage 的 attackTargetOnly 能找到攻擊目標，戰鬥改由
  // resolve-reveal-top-deck 收尾。
  //
  // 保留 pendingBattle 就代表 finishBattle 會對同一場戰鬥跑第二次，所以延後前
  // 必須：
  //   1. 用 battleContinuation: 'finish' 標記「這次翻牌欠一個收尾」，好跟陷阱
  //      （BS3-093）裡的翻牌區分開——後者的戰鬥還沒打到傷害，不能收尾。
  //   2. 把上面已經執行過的 delayedTrap 拿掉，否則第二次 finishBattle 會讓延遲
  //      陷阱的效果再結算一次。
  if (completedState.pendingRevealTopDeck) {
    const deferredBattle = completedState.pendingBattle
    return finalizePendingReplacements({
      ...buildPendingEffectOrder(completedState),
      pendingRevealTopDeck: {
        ...completedState.pendingRevealTopDeck,
        battleContinuation: 'finish',
      },
      ...(deferredBattle
        ? { pendingBattle: { ...deferredBattle, delayedTrap: undefined } }
        : {}),
    })
  }

  return finalizePendingReplacements({
    ...buildPendingEffectOrder(completedState),
    pendingBattle: null,
  })
}

const battleParticipantExists = (
  state: GameState,
  instanceId: string,
): boolean =>
  Object.values(state.players).some((owner) =>
    owner.battleArea.some(
      (cookie) => cookie.card.instanceId === instanceId,
    ),
  )

const getBattleCookie = (
  state: GameState,
  instanceId: string,
): CookieInBattle | undefined =>
  Object.values(state.players)
    .flatMap((player) => player.battleArea)
    .find((cookie) => cookie.card.instanceId === instanceId)

const collectAfterDamageEffects = (
  state: GameState,
  battle: PendingBattle,
): GameState => {
  const damagedIds = battle.damagedInstanceIds ?? []
  return collectAfterDamageEffectsFromIds(
    state,
    damagedIds,
    battle.effectDamageSequence ? 'effect' : undefined,
  )
}

const getAttackEffectContext = (
  playerId: PlayerId,
  battle: PendingBattle,
): EffectContext => ({
  sourcePlayerId: playerId,
  sourceInstanceId: battle.attackerInstanceId,
})

const hasApplicableOptionalAttackEffect = (
  state: GameState,
  context: EffectContext,
  effects: CardEffect[],
  cost?: AbilityCost,
): boolean =>
  effects.some(
    (effect) =>
      isEffectConditionMet(state, context, effect) &&
      (hasRequiredEffectTargets(state, context, effect) ||
        (cost?.selfToTrash === true && effect.kind === 'trash-to-battle')),
  )

export const advanceAttackEffect = (
  state: GameState,
  battle: PendingBattle,
): GameState => {
  const attackEffectIndex = battle.attackEffectIndex + 1
  if (attackEffectIndex < battle.attackEffects.length) {
    return {
      ...state,
      pendingBattle: {
        ...battle,
        attackEffectIndex,
        stage: 'attack-effect',
      },
    }
  }
  return finishBattle({
    ...state,
    pendingBattle: {
      ...battle,
      attackEffectIndex,
    },
  })
}

const findSourceCardName = (
  state: GameState,
  playerId: PlayerId,
  sourceInstanceId: string,
): string => {
  const player = state.players[playerId]
  const battleCard = player.battleArea.find(
    (cookie) => cookie.card.instanceId === sourceInstanceId,
  )?.card
  const handCard = player.hand.find(
    (card) => card.instanceId === sourceInstanceId,
  )
  const discardCard = player.discardPile.find(
    (card) => card.instanceId === sourceInstanceId,
  )
  const supportCard = player.supportArea.find(
    (support) => support.card.instanceId === sourceInstanceId,
  )?.card
  return battleCard?.name ?? handCard?.name ?? discardCard?.name ?? supportCard?.name ?? 'Unknown'
}

const buildPendingEffectOrder = (
  state: GameState,
): GameState => {
  if (state.pendingEffectOrder) return state

  const items: PendingEffectOrderItem[] = []
  const faint = state.pendingFaintEffects?.[0]
  if (faint) {
    items.push({
      id: `faint-effect:${faint.sourceInstanceId}`,
      kind: 'faint-effect',
      sourcePlayerId: faint.sourcePlayerId,
      sourceInstanceId: faint.sourceInstanceId,
      sourceCardName: faint.sourceCardName ??
        findSourceCardName(state, faint.sourcePlayerId, faint.sourceInstanceId),
    })
  }

  const afterDamage = state.pendingAfterDamageEffects?.[0]
  if (afterDamage) {
    items.push({
      id: `after-damage-effect:${afterDamage.sourceInstanceId}`,
      kind: 'after-damage-effect',
      sourcePlayerId: afterDamage.sourcePlayerId,
      sourceInstanceId: afterDamage.sourceInstanceId,
      sourceCardName: afterDamage.sourceCardName ??
        findSourceCardName(state, afterDamage.sourcePlayerId, afterDamage.sourceInstanceId),
    })
  }

  if (state.pendingDrawUpTo) {
    const pending = state.pendingDrawUpTo
    items.push({
      id: `draw-up-to:${pending.sourceInstanceId}`,
      kind: 'draw-up-to',
      sourcePlayerId: pending.sourcePlayerId,
      sourceInstanceId: pending.sourceInstanceId,
      sourceCardName: pending.sourceCardName,
    })
  }

  if (state.pendingInspectDeck) {
    const pending = state.pendingInspectDeck
    items.push({
      id: `inspect-deck:${pending.sourceInstanceId}`,
      kind: 'inspect-deck',
      sourcePlayerId: pending.playerId,
      sourceInstanceId: pending.sourceInstanceId,
      sourceCardName: pending.sourceCardName,
    })
  }

  if (state.pendingRevealTopDeck) {
    const pending = state.pendingRevealTopDeck
    items.push({
      id: `reveal-top-deck:${pending.sourceInstanceId}`,
      kind: 'reveal-top-deck',
      sourcePlayerId: pending.playerId,
      sourceInstanceId: pending.sourceInstanceId,
      sourceCardName: pending.sourceCardName,
    })
  }

  if (state.pendingStageTrigger) {
    const pending = state.pendingStageTrigger
    items.push({
      id: `stage-trigger:${pending.sourceInstanceId}`,
      kind: 'stage-trigger',
      sourcePlayerId: pending.playerId,
      sourceInstanceId: pending.sourceInstanceId,
      sourceCardName: pending.sourceCardName,
    })
  }

  if (items.length < 2) return state
  const firstPlayerId = items[0].sourcePlayerId
  if (!items.every((item) => item.sourcePlayerId === firstPlayerId)) {
    return state
  }

  return {
    ...state,
    pendingEffectOrder: {
      playerId: firstPlayerId,
      items,
    },
  }
}

const finishDamageSequence = (state: GameState): GameState => {
  const battle = requirePendingBattle(state)
  if (battle.effectDamageSequence) {
    const sequence = battle.effectDamageSequence
    const afterCurrentDamageState = sequence.afterCurrentDamageResolved
      ? state
      : collectAfterDamageEffects(state, battle)
    const activeBattle = requirePendingBattle(afterCurrentDamageState)

    // 逐一傷害要等目前目標衍生的所有決策完整處理後才可前往下一個。
    // `hasBlockingPending` 本身會把目前的 pendingBattle 視為阻塞，因此
    // 暫時移除它來檢查真正插入此序列的決策（FLIP、昏厥、Refresh、補位等）。
    const sequenceInterruptState = {
      ...afterCurrentDamageState,
      pendingBattle: null,
      // `pendingAbilityEffect` is the continuation owner for this sequence,
      // not an external interruption. Other pending decisions still block the
      // next target as before.
      ...(sequence.continuation === 'ability-effect'
        ? { pendingAbilityEffect: undefined }
        : {}),
    }
    const hasSequenceInterrupt =
      hasBlockingPending(sequenceInterruptState) ||
      Boolean(afterCurrentDamageState.pendingEffectOrder)
    if (hasSequenceInterrupt) {
      return {
        ...afterCurrentDamageState,
        pendingBattle: {
          ...activeBattle,
          effectDamageSequence: {
            ...sequence,
            afterCurrentDamageResolved: true,
          },
        },
      }
    }

    const nextTarget = sequence.remainingTargets?.[0]
    const nextTargetInstanceId =
      nextTarget?.instanceId ?? sequence.remainingTargetInstanceIds[0]
    const remainingTargets = sequence.remainingTargets
      ? sequence.remainingTargets.slice(1)
      : undefined
    const remainingTargetInstanceIds = sequence.remainingTargetInstanceIds.slice(1)
    if (!nextTargetInstanceId) {
      const completedBattle = {
        ...activeBattle,
        effectDamageSequence: undefined,
      }
      const completedState = {
        ...afterCurrentDamageState,
        pendingBattle: completedBattle,
      }
      const continuation = sequence.continuation

      if (continuation === 'attack-effect') {
        const nextIndex = completedBattle.attackEffectIndex + 1
        return nextIndex < completedBattle.attackEffects.length
          ? {
              ...completedState,
              pendingBattle: {
                ...completedBattle,
                attackEffectIndex: nextIndex,
                stage: 'attack-effect',
              },
            }
          : finishBattle(completedState)
      }

      if (continuation === 'after-trap') {
        return advanceBattleAfterTrap(completedState)
      }

      if (continuation === 'ability-effect') {
        const pendingAbility = completedState.pendingAbilityEffect
        if (!pendingAbility) return finishBattle(completedState)

        const nextIndex = pendingAbility.effectIndex + 1
        const hasNextEffect = nextIndex < pendingAbility.effects.length
        const nextPendingAbility = hasNextEffect
          ? { ...pendingAbility, effectIndex: nextIndex }
          : undefined
        const keepBattle = sequence.resumeBattleAfterAbility === true
        const resumedState: GameState = {
          ...completedState,
          pendingBattle: keepBattle ? completedBattle : null,
          pendingAbilityEffect: nextPendingAbility,
        }

        if (nextPendingAbility) return resumedState
        if (pendingAbility.battleContinuation === 'finish') {
          return keepBattle ? finishBattle(resumedState) : resumedState
        }
        if (pendingAbility.battleContinuation === 'after-trap') {
          return keepBattle ? advanceBattleAfterTrap(resumedState) : resumedState
        }
        if (pendingAbility.battleContinuation === 'attack-effect') {
          return keepBattle
            ? advanceAttackEffect(resumedState, completedBattle)
            : resumedState
        }
        return resumedState
      }

      return finishBattle(completedState)
    }

    const nextDamage = nextTarget?.damage ?? sequence.damage
    const nextDamagePlayerId = nextTarget?.playerId ?? activeBattle.defenderPlayerId

    return {
      ...afterCurrentDamageState,
      pendingBattle: {
        ...activeBattle,
        targetInstanceId: nextTargetInstanceId,
        declaredDamage: nextDamage,
        remainingDamage: nextDamage,
        stage: 'damage',
        revealedHpCard: null,
        damagePlayerId: nextDamagePlayerId,
        damageTargetInstanceId: nextTargetInstanceId,
        damagedInstanceIds: [],
        effectDamageSequence: {
          remainingTargetInstanceIds,
          damage: sequence.damage,
          ...(remainingTargets ? { remainingTargets } : {}),
          continuation: sequence.continuation,
          resumeBattleAfterAbility: sequence.resumeBattleAfterAbility,
        },
      },
    }
  }

  if (battle.suspendedAttackDamage !== undefined) {
    const attackerExists = battleParticipantExists(
      state,
      battle.attackerInstanceId,
    )
    const targetExists = battleParticipantExists(
      state,
      battle.targetInstanceId,
    )
    if (!attackerExists || !targetExists) {
      if (battle.attackEffectIndex < battle.attackEffects.length) {
        return {
          ...state,
          pendingBattle: {
            ...battle,
            stage: 'attack-effect',
          },
        }
      }
      return finishBattle(state)
    }
    const resumedDamage = getAttackDamageAgainst(
      state,
      battle.attackerInstanceId,
      battle.targetInstanceId,
    )
    return {
      ...state,
      pendingBattle: {
        ...battle,
        stage: 'damage',
        declaredDamage: resumedDamage,
        remainingDamage: resumedDamage,
        damagePlayerId: undefined,
        damageTargetInstanceId: undefined,
        suspendedAttackDamage: undefined,
        revealedHpCard: null,
      },
    }
  }

  if (battle.attackEffectIndex < battle.attackEffects.length) {
    return {
      ...state,
      pendingBattle: {
        ...battle,
        stage: 'attack-effect',
      },
    }
  }

  const afterDamageState = collectAfterDamageEffects(state, battle)
  return finishBattle(afterDamageState)
}

export const resolveAttackEffect = (
  state: GameState,
  playerId: PlayerId,
  selectedTargetIds: string[],
): GameState => {
  const battle = requirePendingBattle(state)
  if (
    battle.stage !== 'attack-effect' ||
    battle.attackerPlayerId !== playerId
  ) {
    throw new GameRuleError('Invalid battle action.')
  }

  const effect = battle.attackEffects[battle.attackEffectIndex]
  if (!effect) {
    return finishBattle(state)
  }

  const effectContext = getAttackEffectContext(playerId, battle)

  // 攻擊後效果若已沒有合法目標（例如 BS1-037 對手場上沒有 LV.1
  // 餅乾），直接略過該效果，不建立任何玩家提示或付款決策。
  if (
    !isEffectConditionMet(state, effectContext, effect) ||
    !hasRequiredEffectTargets(state, effectContext, effect)
  ) {
    return advanceAttackEffect(state, battle)
  }

  if (effect.kind === 'optional-cost-attack') {
    if (
      !hasApplicableOptionalAttackEffect(
        state,
        effectContext,
        effect.effects,
        effect.cost,
      )
    ) {
      return advanceAttackEffect(state, battle)
    }
    const sourceCard = state.players[playerId].battleArea.find(
      (c) => c.card.instanceId === battle.attackerInstanceId,
    )?.card
    return {
      ...state,
      pendingOptionalCostAttack: {
        playerId,
        sourceInstanceId: battle.attackerInstanceId,
        sourceCardName: sourceCard?.name ?? 'Unknown',
        cost: effect.cost,
        effects: effect.effects,
        effectText: effect.effectText,
        sourceEnergy: effect.sourceEnergy,
      },
    }
  }

  if (effect.kind === 'discard-hand') {
    // 攻擊後續效果的棄牌代價（BS5-080 的「Then, <discard 2 cards.>」）：
    // 交由既有的 pendingOpponentHandDiscard 通道讓玩家選牌，但保留
    // pendingBattle（stage 'attack-effect'），棄牌完成後由
    // resolve-opponent-hand-discard 命令接續 advanceAttackEffect，
    // 不能走 executeCardEffect（該路徑會直接把下一個效果也結算掉）。
    const player = state.players[playerId]
    if (player.hand.length < effect.count) {
      return advanceAttackEffect(state, battle)
    }
    return {
      ...state,
      pendingOpponentHandDiscard: {
        playerId,
        count: effect.count,
        destination: effect.destination,
        sourcePlayerId: playerId,
        sourceInstanceId: battle.attackerInstanceId,
        sourceCardName: effectContext.sourceCardName ?? 'Unknown',
        effectText: effect.kind,
      },
    }
  }

  const hasCondition = 'condition' in effect && Boolean(effect.condition)

  if (hasCondition) {
    const nextState = executeCardEffect(
      state,
      effectContext,
      effect,
      selectedTargetIds,
    )
    if (nextState.status !== 'playing') {
      return { ...nextState, pendingBattle: null }
    }

    if (nextState.pendingBattle?.effectDamageSequence) {
      return {
        ...nextState,
        pendingBattle: {
          ...nextState.pendingBattle,
          effectDamageSequence: {
            ...nextState.pendingBattle.effectDamageSequence,
            continuation: 'attack-effect',
            resumeBattleAfterAbility: false,
          },
        },
      }
    }

    const nextBattle = requirePendingBattle(nextState)
    return advanceAttackEffect(nextState, nextBattle)
  }

  const nextState = executeCardEffect(
    state,
    effectContext,
    effect,
    selectedTargetIds,
  )
  if (nextState.status !== 'playing') {
    return { ...nextState, pendingBattle: null }
  }

  if (nextState.pendingBattle?.effectDamageSequence) {
    return {
      ...nextState,
      pendingBattle: {
        ...nextState.pendingBattle,
        effectDamageSequence: {
          ...nextState.pendingBattle.effectDamageSequence,
          continuation: 'attack-effect',
          resumeBattleAfterAbility: false,
        },
      },
    }
  }

  const nextBattle = requirePendingBattle(nextState)
  return advanceAttackEffect(nextState, nextBattle)
}

export const resolveOptionalCostAttack = (
  state: GameState,
  playerId: PlayerId,
  action: 'skip' | 'pay',
  discardCardIds: string[] = [],
  targetIds: string[] = [],
  paymentIds: string[] = [],
  supportToHandIds: string[] = [],
  hpToTrashIds: string[] = [],
  trashToDeckIds: string[] = [],
): GameState => {
  const pending = state.pendingOptionalCostAttack
  if (!pending || pending.playerId !== playerId) {
    throw new GameRuleError('Invalid battle action.')
  }
  if (action === 'skip') {
    const battle = requirePendingBattle(state)
    const nextIndex = battle.attackEffectIndex + 1
    const clearedState: GameState = { ...state, pendingOptionalCostAttack: null }
    if (nextIndex < battle.attackEffects.length) {
      return { ...clearedState, pendingBattle: { ...battle, attackEffectIndex: nextIndex, stage: 'attack-effect' } }
    }
    return finishBattle({ ...clearedState, pendingBattle: { ...battle, attackEffectIndex: nextIndex } })
  }
  const player = state.players[playerId]
  const uniqueDiscardIds = [...new Set(discardCardIds)]
  if (uniqueDiscardIds.length !== (pending.cost.discardHand ?? 0)) {
    throw new GameRuleError(`Must discard exactly ${pending.cost.discardHand ?? 0} cards for this effect.`)
  }
  const allInHand = uniqueDiscardIds.every((id) => player.hand.some((card) => card.instanceId === id))
  if (!allInHand) {
    throw new GameRuleError('Invalid battle action.')
  }
  const supportToHandAmount = pending.cost.supportToHand ?? 0
  const uniqueSupportToHandIds = [...new Set(supportToHandIds)]
  if (uniqueSupportToHandIds.length !== supportToHandIds.length) {
    throw new GameRuleError('Invalid battle action.')
  }
  if (uniqueSupportToHandIds.length !== supportToHandAmount) {
    throw new GameRuleError(
      `Must return exactly ${supportToHandAmount} support card(s) for this effect.`,
    )
  }
  const supportToHandCandidates = player.supportArea.filter(
    (support) =>
      (pending.cost.supportToHandType === undefined ||
        support.card.type === pending.cost.supportToHandType) &&
      uniqueSupportToHandIds.includes(support.card.instanceId),
  )
  if (supportToHandCandidates.length !== supportToHandAmount) {
    throw new GameRuleError('只能選擇符合條件的支援區卡牌返回手牌。')
  }
  const hpToTrashCost = pending.cost.hpToTrash
  const uniqueHpToTrashIds = [...new Set(hpToTrashIds)]
  if (uniqueHpToTrashIds.length !== hpToTrashIds.length) {
    throw new GameRuleError('HP 費用不能重複選同一張餅乾。')
  }
  if (hpToTrashCost && uniqueHpToTrashIds.length !== 1) {
    throw new GameRuleError('必須選擇 1 張餅乾支付 HP 費用。')
  }
  if (!hpToTrashCost && uniqueHpToTrashIds.length > 0) {
    throw new GameRuleError('此攻擊後效果不需要支付 HP 費用。')
  }
  const hpToTrashCandidates = hpToTrashCost
    ? getHpToTrashCostCandidates(
        pending.cost,
        player.battleArea,
        pending.sourceInstanceId,
      )
    : []
  if (
    hpToTrashCost &&
    !hpToTrashCandidates.some(
      (cookie) => cookie.card.instanceId === uniqueHpToTrashIds[0],
    )
  ) {
    throw new GameRuleError('選擇的 HP 費用餅乾不合法。')
  }
  const trashToDeckCost = pending.cost.trashToDeck
  const uniqueTrashToDeckIds = [...new Set(trashToDeckIds)]
  if (uniqueTrashToDeckIds.length !== trashToDeckIds.length) {
    throw new GameRuleError('不能重複選擇同一張棄牌區卡牌作為代價。')
  }
  if (
    trashToDeckCost &&
    uniqueTrashToDeckIds.length !== trashToDeckCost.count
  ) {
    throw new GameRuleError(
      `必須選擇 ${trashToDeckCost.count} 張棄牌區卡牌作為代價。`,
    )
  }
  if (!trashToDeckCost && uniqueTrashToDeckIds.length > 0) {
    throw new GameRuleError('此攻擊後效果不需要支付棄牌區代價。')
  }
  const trashToDeckCandidates = trashToDeckCost
    ? getTrashToDeckCostCandidates(pending.cost, player.discardPile)
    : []
  if (
    trashToDeckCost &&
    uniqueTrashToDeckIds.some(
      (id) => !trashToDeckCandidates.some((card) => card.instanceId === id),
    )
  ) {
    throw new GameRuleError('選擇的棄牌區卡牌不符合洗回牌庫代價條件。')
  }
  const energyCost = getRemainingEnergyCost(
    pending.cost.energy ?? {},
    pending.sourceEnergy,
  )
  const uniquePaymentIds = [...new Set(paymentIds)]
  if (uniquePaymentIds.length !== paymentIds.length) {
    throw new GameRuleError('Invalid battle action.')
  }
  if (uniquePaymentIds.some((id) => uniqueSupportToHandIds.includes(id))) {
    throw new GameRuleError('同一張支援卡不能同時支付能量與返回手牌代價。')
  }
  const paymentValidation = validateEnergyPayment(
    energyCost,
    player.supportArea,
    uniquePaymentIds,
  )
  if (!paymentValidation.valid) {
    throw new GameRuleError(`Invalid attack effect payment: ${paymentValidation.reason}`)
  }
  const effectContext = {
    sourcePlayerId: playerId,
    sourceInstanceId: pending.sourceInstanceId,
  }
  const applicableEffects = pending.effects.filter((effect) =>
    isEffectConditionMet(state, effectContext, effect),
  )
  if (applicableEffects.length === 0) {
    const battle = requirePendingBattle(state)
    const nextIndex = battle.attackEffectIndex + 1
    const clearedState = { ...state, pendingOptionalCostAttack: null }
    return nextIndex < battle.attackEffects.length
      ? {
          ...clearedState,
          pendingBattle: {
            ...battle,
            attackEffectIndex: nextIndex,
            stage: 'attack-effect',
          },
        }
      : finishBattle({
          ...clearedState,
          pendingBattle: { ...battle, attackEffectIndex: nextIndex },
        })
  }
  const hpToTrashPayment = payHpToTrashCost(
    player,
    pending.cost,
    uniqueHpToTrashIds,
    pending.sourceInstanceId,
  )
  let playerAfterSourceCosts = hpToTrashPayment.player
  const sourceToLeaveBattle =
    pending.cost.selfToTrash || pending.cost.selfToBreakArea
      ? playerAfterSourceCosts.battleArea.find(
          (cookie) => cookie.card.instanceId === pending.sourceInstanceId,
        )
      : undefined
  if (
    (pending.cost.selfToTrash || pending.cost.selfToBreakArea) &&
    !sourceToLeaveBattle
  ) {
    throw new GameRuleError('Invalid battle action.')
  }
  if (sourceToLeaveBattle) {
    const remainingBattleArea = playerAfterSourceCosts.battleArea.filter(
      (cookie) => cookie.card.instanceId !== sourceToLeaveBattle.card.instanceId,
    )
    playerAfterSourceCosts = {
      ...playerAfterSourceCosts,
      battleArea: remainingBattleArea,
      ...(pending.cost.selfToBreakArea
        ? {
            breakArea: [
              ...playerAfterSourceCosts.breakArea,
              sourceToLeaveBattle.card,
            ],
          }
        : {}),
      discardPile: [
        ...playerAfterSourceCosts.discardPile,
        ...(pending.cost.selfToTrash ? [sourceToLeaveBattle.card] : []),
        ...sourceToLeaveBattle.hpCards,
        ...(sourceToLeaveBattle.equippedCards ?? []),
      ],
    }
  }
  const stateAfterSourceCost: GameState = {
    ...state,
    ...(hpToTrashPayment.costRecord
      ? { costRecord: hpToTrashPayment.costRecord }
      : {}),
    players: {
      ...state.players,
      [playerId]: playerAfterSourceCosts,
    },
  }
  const selectableEffects = applicableEffects.filter((effect) =>
    requiresEffectCardSelection(effect),
  )
  if (selectableEffects.length > 0) {
    const uniqueTargetIds = [...new Set(targetIds)]
    if (uniqueTargetIds.length !== targetIds.length) {
      throw new GameRuleError('Invalid battle action.')
    }
    const hasValidTarget = selectableEffects.every((effect) => {
      const effectTargetIds =
        ((effect.kind === 'battle-to-break' || effect.kind === 'hp-to-trash') &&
          effect.target.sourceOnly)
          ? [pending.sourceInstanceId]
          : uniqueTargetIds
      const limits = getEffectSelectionLimits(effect)
      if (!limits) return false
      const { min, max } = limits
      if (effectTargetIds.length < min || effectTargetIds.length > max) {
        return false
      }
      const candidates = getEffectSelectionCandidates(
        stateAfterSourceCost,
        effectContext,
        effect,
      )
      return effectTargetIds.every((targetId) =>
        candidates.some((card) => card.instanceId === targetId),
      )
    })
    if (!hasValidTarget) {
      throw new GameRuleError('Invalid battle action.')
    }
  }
  const discardedCards = player.hand.filter((card) => uniqueDiscardIds.includes(card.instanceId))
  const paymentSet = new Set(uniquePaymentIds)
  const supportToHandSet = new Set(uniqueSupportToHandIds)
  const playerAfterSourceCost = stateAfterSourceCost.players[playerId]
  const context = effectContext
  const returnedSupportCards = playerAfterSourceCost.supportArea.filter((support) =>
    supportToHandSet.has(support.card.instanceId),
  )
  let nextState: GameState = {
    ...stateAfterSourceCost,
    pendingOptionalCostAttack: null,
    players: {
      ...stateAfterSourceCost.players,
      [playerId]: {
        ...playerAfterSourceCost,
        hand: [
          ...playerAfterSourceCost.hand.filter((card) => !uniqueDiscardIds.includes(card.instanceId)),
          ...returnedSupportCards.map((support) => support.card),
        ],
        discardPile: [...playerAfterSourceCost.discardPile, ...discardedCards],
        supportArea: playerAfterSourceCost.supportArea
          .filter((support) => !supportToHandSet.has(support.card.instanceId))
          .map((support) =>
            paymentSet.has(support.card.instanceId)
              ? { ...support, rested: true }
              : support,
          ),
      },
    },
  }
  // 支援區回手也是「支援區張數減少」：BS6-061 的攻擊後代價可讓
  // BS1-078 Awakening Ancient Forest 在同一回合依條件發動。這裡是
  // 攻擊後代價的手動移動路徑，不能只依賴 executeCardEffect 的
  // support-to-hand 分支來更新回合旗標。
  if (returnedSupportCards.length > 0) {
    nextState = markSupportAreaDecreased(nextState, playerId)
  }
  if (trashToDeckCost) {
    nextState = executeCardEffect(
      nextState,
      context,
      {
        kind: 'trash-to-deck',
        min: trashToDeckCost.count,
        max: trashToDeckCost.count,
        energyColor: trashToDeckCost.energyColor,
        excludeFlip: trashToDeckCost.excludeFlip,
        cookieOnly: trashToDeckCost.cookieOnly,
        keyword: trashToDeckCost.keyword,
        nonCookieOnly: trashToDeckCost.nonCookieOnly,
      },
      uniqueTrashToDeckIds,
    )
  }
  for (let effectIndex = 0; effectIndex < applicableEffects.length; effectIndex += 1) {
    const effect = applicableEffects[effectIndex]
    if (nextState.status !== 'playing') break
    const effectTargetIds =
      ((effect.kind === 'battle-to-break' || effect.kind === 'hp-to-trash') &&
        effect.target.sourceOnly)
        ? [pending.sourceInstanceId]
        : targetIds
    nextState = executeCardEffect(nextState, context, effect, effectTargetIds)
    if (nextState.pendingBattle?.effectDamageSequence) {
      return {
        ...nextState,
        pendingAbilityEffect: {
          playerId,
          sourcePlayerId: playerId,
          sourceInstanceId: pending.sourceInstanceId,
          sourceCardName: pending.sourceCardName,
          sourceKind: 'skill',
          effects: applicableEffects,
          effectIndex,
          battleContinuation: 'attack-effect',
        },
        pendingBattle: {
          ...nextState.pendingBattle,
          effectDamageSequence: {
            ...nextState.pendingBattle.effectDamageSequence,
            continuation: 'ability-effect',
            resumeBattleAfterAbility: true,
          },
        },
      }
    }
  }
  if (nextState.status !== 'playing') {
    return { ...nextState, pendingBattle: null }
  }
  const battle = requirePendingBattle(nextState)
  const nextIndex = battle.attackEffectIndex + 1
  if (nextIndex < battle.attackEffects.length) {
    return { ...nextState, pendingBattle: { ...battle, attackEffectIndex: nextIndex, stage: 'attack-effect' } }
  }
  return finishBattle({ ...nextState, pendingBattle: { ...battle, attackEffectIndex: nextIndex } })
}

export const resolveNextDamage = (state: GameState): GameState => {
  if (state.pendingRefresh) {
    throw new GameRuleError('Invalid battle action.')
  }

  const battle = requirePendingBattle(state)
  if (battle.stage !== 'damage') {
    throw new GameRuleError('Invalid battle action.')
  }

  const attackerExists = battleParticipantExists(
    state,
    battle.attackerInstanceId,
  )
  const targetExists = battleParticipantExists(
    state,
    battle.targetInstanceId,
  )
  // 效果傷害在支付後已經獨立成立。像 BS4-005 以最後一張來源 HP 作為
  // 代價時，來源雖會昏厥，仍必須結算所有已選定目標；一般攻擊則維持
  // 攻擊者或目標離場即收尾的既有規則。
  if (
    (!battle.effectDamageSequence && !attackerExists) ||
    !targetExists
  ) {
    return battle.effectDamageSequence
      ? finishDamageSequence(state)
      : finishBattle(state)
  }

  if (battle.remainingDamage <= 0) {
    return finishDamageSequence(state)
  }

  const damagePlayerId =
    battle.damagePlayerId ?? battle.defenderPlayerId
  const damageTargetInstanceId =
    battle.damageTargetInstanceId ?? battle.targetInstanceId
  const defender = state.players[damagePlayerId]
  const targetIndex = defender.battleArea.findIndex(
    (cookie) => cookie.card.instanceId === damageTargetInstanceId,
  )
  const target = defender.battleArea[targetIndex]
  if (!target) {
    return finishDamageSequence(state)
  }

  if (target.hpCards.length === 0) {
    const afterFaint = removeFaintedCookie(
      state,
      damagePlayerId,
      damageTargetInstanceId,
    )
    if (afterFaint.pendingFaintEffects && afterFaint.pendingFaintEffects.length > 0) {
      if (battle.effectDamageSequence) {
        return finishDamageSequence(afterFaint)
      }
      const activeBattle = requirePendingBattle(afterFaint)
      if (
        !battleParticipantExists(afterFaint, activeBattle.attackerInstanceId) ||
        !battleParticipantExists(afterFaint, activeBattle.targetInstanceId)
      ) {
        return finishBattle(afterFaint)
      }
      return afterFaint
    }
    return finishDamageSequence(afterFaint)
  }

  const protectedFromKnockout =
    battle.preventKnockoutTargetIds.includes(damageTargetInstanceId) &&
    target.hpCards.length === 1
  if (protectedFromKnockout) {
    return finishDamageSequence({
      ...state,
      pendingBattle: {
        ...battle,
        remainingDamage: 0,
      },
    })
  }

  const revealedHpCard = target.hpCards[target.hpCards.length - 1]
  const updatedDefender: PlayerState = {
    ...defender,
    battleArea: defender.battleArea.map((cookie, index) =>
      index === targetIndex
        ? {
            ...cookie,
            hpCards: cookie.hpCards.slice(0, -1),
          }
        : cookie,
    ),
  }
  let nextState: GameState = markCookieHpReducedThisTurn({
    ...state,
    players: {
      ...state.players,
      [defender.id]: updatedDefender,
    },
    pendingBattle: {
      ...battle,
      remainingDamage: battle.remainingDamage - 1,
      revealedHpCard,
      damagedInstanceIds: [
        ...(battle.damagedInstanceIds ?? []),
        damageTargetInstanceId,
      ],
      stage:
        revealedHpCard.flip &&
        state.flipDisabledUntilTurn?.[target.card.instanceId] !==
          state.turnNumber &&
        hasActivatableFlipEffect(state, revealedHpCard.flip, {
          sourcePlayerId: defender.id,
          sourceInstanceId: revealedHpCard.instanceId,
          sourceCardName: revealedHpCard.name,
        })
          ? 'flip'
          : 'damage',
    },
  }, defender.id, target.card.instanceId)

  if (battle.effectDamageSequence) {
    const effectSource = state.players[battle.attackerPlayerId].battleArea.find(
      (cookie) => cookie.card.instanceId === battle.attackerInstanceId,
    )
    if (effectSource?.card.keywords?.includes('arena')) {
      nextState = {
        ...nextState,
        arenaCookieDealtEffectDamageThisTurn: {
          ...(nextState.arenaCookieDealtEffectDamageThisTurn ?? {}),
          [battle.attackerPlayerId]: true,
        },
      }
    }
  }

  if (
    revealedHpCard.flip &&
    state.flipDisabledUntilTurn?.[target.card.instanceId] !==
      state.turnNumber &&
    hasActivatableFlipEffect(state, revealedHpCard.flip, {
      sourcePlayerId: defender.id,
      sourceInstanceId: revealedHpCard.instanceId,
      sourceCardName: revealedHpCard.name,
    })
  ) {
    return nextState
  }

  nextState = {
    ...nextState,
    players: {
      ...nextState.players,
      [defender.id]: {
        ...nextState.players[defender.id],
        discardPile: [
          ...nextState.players[defender.id].discardPile,
          revealedHpCard,
        ],
      },
    },
    pendingBattle: {
      ...requirePendingBattle(nextState),
      revealedHpCard: null,
    },
  }
  nextState = removeFaintedCookie(
    nextState,
    defender.id,
    damageTargetInstanceId,
  )

  if (nextState.pendingFaintEffects && nextState.pendingFaintEffects.length > 0) {
    const activeBattle = requirePendingBattle(nextState)
    if (
      !battleParticipantExists(nextState, activeBattle.attackerInstanceId) ||
      !battleParticipantExists(nextState, activeBattle.targetInstanceId)
    ) {
      return finishDamageSequence(nextState)
    }
    return nextState
  }

  const afterRemoveBattle = requirePendingBattle(nextState)
  if (afterRemoveBattle.remainingDamage <= 0) {
    return finishDamageSequence(nextState)
  }
  if (
    !battleParticipantExists(nextState, afterRemoveBattle.targetInstanceId) &&
    afterRemoveBattle.attackEffectIndex < afterRemoveBattle.attackEffects.length
  ) {
    return finishDamageSequence(nextState)
  }
  return nextState
}

export interface ResolveFlipOptions {
  activate: boolean
  discardHandIds?: string[]
  chooseOneModeIndex?: number
  targetIds?: string[]
}

export const resolveFlip = (
  state: GameState,
  playerId: PlayerId,
  options: ResolveFlipOptions,
): GameState => {
  const battle = requirePendingBattle(state)
  const revealed = battle.revealedHpCard
  if (
    battle.stage !== 'flip' ||
    (battle.damagePlayerId ?? battle.defenderPlayerId) !== playerId ||
    !revealed?.flip
  ) {
    throw new GameRuleError('Invalid battle action.')
  }

  let nextState = state
  let flipToSupportChoice: { rested: boolean } | null = null
  let flipToBreakChoice = false
  if (options.activate) {
    const flipContext = {
      sourcePlayerId: playerId,
      sourceInstanceId: revealed.instanceId,
      sourceCardName: revealed.name,
    }
    const hasActivatableEffect = hasActivatableFlipEffect(
      state,
      revealed.flip,
      flipContext,
    )
    if (!hasActivatableEffect) {
      return {
        ...state,
        players: {
          ...state.players,
          [playerId]: {
            ...state.players[playerId],
            discardPile: [...state.players[playerId].discardPile, revealed],
          },
        },
        pendingBattle: {
          ...requirePendingBattle(state),
          stage: 'damage',
          revealedHpCard: null,
        },
      }
    }

    const player = nextState.players[playerId]
    const discardIds = [...new Set(options.discardHandIds ?? [])]
    if (discardIds.length !== (revealed.flip.cost.discardHand ?? 0)) {
      throw new GameRuleError(
        `Must discard exactly ${revealed.flip.cost.discardHand ?? 0} cards for FLIP activation.`,
      )
    }
    const discarded = player.hand.filter((card) =>
      discardIds.includes(card.instanceId),
    )
    if (discarded.length !== discardIds.length) {
      throw new GameRuleError('Invalid battle action.')
    }
    nextState = {
      ...nextState,
      players: {
        ...nextState.players,
        [playerId]: {
          ...player,
          hand: player.hand.filter(
            (card) => !discardIds.includes(card.instanceId),
          ),
          discardPile: [...player.discardPile, ...discarded],
        },
      },
    }

    const chooseOneIndex = revealed.flip.effects.findIndex(
      (effect) => effect.kind === 'choose-one',
    )
    const attachedHpBonus = revealed.flip.attachedHpBonus ?? 0
    const attachedHpEffect: CardEffect | null = attachedHpBonus > 0
      ? {
          kind: 'gain-hp',
          amount: attachedHpBonus,
          target: { side: 'self', min: 1, max: 1, sourceOnly: true },
        }
      : null
    let flipEffects: CardEffect[] = attachedHpEffect
      ? [...revealed.flip.effects, attachedHpEffect]
      : [...revealed.flip.effects]
    if (chooseOneIndex >= 0) {
      if (options.chooseOneModeIndex === undefined) {
        throw new GameRuleError('Must choose a FLIP effect mode.')
      }
      flipEffects = expandChooseOne(
        flipEffects,
        chooseOneIndex,
        options.chooseOneModeIndex,
      )
    }

    for (let i = 0; i < flipEffects.length; i += 1) {
      const effect = flipEffects[i]
      const context = {
        sourcePlayerId: playerId,
        sourceInstanceId: revealed.instanceId,
        sourceCardName: revealed.name,
      }
      if (!isEffectConditionMet(nextState, context, effect)) {
        continue
      }

      if (effect.kind === 'gain-hp') {
        const owner = nextState.players[playerId]
        const targetIndex = owner.battleArea.findIndex(
          (cookie) =>
            cookie.card.instanceId ===
            (battle.damageTargetInstanceId ?? battle.targetInstanceId),
        )
        const target = owner.battleArea[targetIndex]
        if (!target || owner.deck.length < effect.amount) {
          continue
        }
        const gainedCards = owner.deck.slice(0, effect.amount)
        nextState = {
          ...nextState,
          players: {
            ...nextState.players,
            [playerId]: {
              ...owner,
              deck: owner.deck.slice(effect.amount),
              battleArea: owner.battleArea.map((cookie, index) =>
                index === targetIndex
                  ? {
                      ...cookie,
                      hpCards: [...cookie.hpCards, ...gainedCards],
                    }
                  : cookie,
              ),
            },
          },
        }
      } else if (effect.kind === 'flip-to-support') {
        flipToSupportChoice = { rested: effect.rested ?? true }
      } else if (effect.kind === 'flip-to-break') {
        flipToBreakChoice = true
      } else {
        nextState = executeCardEffect(
          nextState,
          context,
          effect,
          options.targetIds ?? [],
        )
        if (nextState.pendingDrawUpTo) {
          const remainingEffects = flipEffects.slice(i + 1)
          if (remainingEffects.length > 0) {
            nextState = {
              ...nextState,
              pendingDrawUpTo: {
                ...nextState.pendingDrawUpTo,
                afterEffects: remainingEffects,
                afterEffectContext: context,
              },
            }
          }

          if (effect.kind === 'draw-up-to') {
            nextState = resolveDrawUpTo(nextState, playerId, effect.max)
          }
          break
        }
      }
    }
  }

  const addRevealedFlipCard = (currentState: GameState): GameState => {
    const player = currentState.players[playerId]
    return {
      ...currentState,
      players: {
        ...currentState.players,
        [playerId]: flipToSupportChoice
          ? {
              ...player,
              supportArea: [
                ...player.supportArea,
                { card: revealed, rested: flipToSupportChoice.rested },
              ],
            }
          : flipToBreakChoice
            ? {
                ...player,
                breakArea: [...player.breakArea, revealed],
              }
            : {
                ...player,
                discardPile: [...player.discardPile, revealed],
              },
      },
    }
  }

  // FLIP 的效果可能讓攻擊中的餅乾昏厥，甚至直接達成勝負條件；
  // 這時傷害效果會先清除 pendingBattle，仍須把翻開的牌送入對應區域，
  // 但不可再以原戰鬥要求 pendingBattle。
  if (!nextState.pendingBattle) {
    return addRevealedFlipCard(nextState)
  }

  nextState = addRevealedFlipCard(nextState)
  nextState = {
    ...nextState,
    pendingBattle: {
      ...requirePendingBattle(nextState),
      stage: 'damage',
      revealedHpCard: null,
    },
  }
  nextState = removeFaintedCookie(
    nextState,
    playerId,
    battle.damageTargetInstanceId ?? battle.targetInstanceId,
  )

  if (nextState.pendingFaintEffects && nextState.pendingFaintEffects.length > 0) {
    return nextState
  }

  // Attack damage may depend on the attacker's current HP (for example,
  // BS5-111).  A FLIP can damage the attacker before the remaining attack
  // damage resolves, so re-evaluate the total and preserve damage already
  // dealt.  The existing `remainingDamage` counter still prevents a
  // defender-side damage reduction from being applied retroactively during
  // the same multi-point damage sequence.
  if (nextState.pendingBattle && !battle.effectDamageSequence) {
    const attackerBefore = getBattleCookie(state, battle.attackerInstanceId)
    const attackerAfter = getBattleCookie(
      nextState,
      battle.attackerInstanceId,
    )
    if (
      attackerBefore &&
      attackerAfter &&
      getCookieEffectiveHp(attackerBefore) !==
        getCookieEffectiveHp(attackerAfter) &&
      battleParticipantExists(nextState, battle.targetInstanceId)
    ) {
      const activeBattle = requirePendingBattle(nextState)
      const damageAlreadyDealt = Math.max(
        0,
        activeBattle.declaredDamage - activeBattle.remainingDamage,
      )
      const recalculatedDamage = getAttackDamageAgainst(
        nextState,
        activeBattle.attackerInstanceId,
        activeBattle.targetInstanceId,
      )
      nextState = {
        ...nextState,
        pendingBattle: {
          ...activeBattle,
          declaredDamage: recalculatedDamage,
          remainingDamage: Math.max(
            0,
            recalculatedDamage - damageAlreadyDealt,
          ),
        },
      }
    }
  }

  return requirePendingBattle(nextState).remainingDamage <= 0
    ? finishDamageSequence(nextState)
    : nextState
}

export const resolveBattleAutomatically = (state: GameState): GameState => {
  let nextState = state
  let guard = 0

  while ((nextState.pendingBattle || nextState.pendingOptionalCostAttack || (nextState.pendingFaintEffects && nextState.pendingFaintEffects.length > 0) || (nextState.pendingAfterDamageEffects && nextState.pendingAfterDamageEffects.length > 0)) && guard < 100) {
    guard += 1

    if (nextState.status !== 'playing') {
      break
    }

    // 翻牌展示要玩家確認才能往下走（BS3-076／080 的攻擊後效果、BS3-093 的陷阱）。
    // 自動結算沒辦法代為確認，不讓出的話會停在同一個階段空轉到 guard 上限拋錯。
    if (nextState.pendingRevealTopDeck) {
      break
    }

    if (
      nextState.pendingReplacement ||
      nextState.pendingRefresh ||
      nextState.pendingOnPlay
    ) {
      break
    }

    if (nextState.pendingOptionalCostAttack) {
      const pending = nextState.pendingOptionalCostAttack
      const hand = nextState.players[pending.playerId].hand
      const canPayHand = hand.length >= (pending.cost.discardHand ?? 0)
      const effectiveEnergyCost = getRemainingEnergyCost(
        pending.cost.energy ?? pending.cost,
        pending.sourceEnergy,
      )
      const paymentIds = selectEnergyPayment(
        effectiveEnergyCost,
        nextState.players[pending.playerId].supportArea,
      )
      const canPayEnergy = Boolean(paymentIds)
      const supportToHandAmount = pending.cost.supportToHand ?? 0
      const supportToHandIds = nextState.players[pending.playerId].supportArea
        .filter(
          (support) =>
            !paymentIds?.includes(support.card.instanceId) &&
            (pending.cost.supportToHandType === undefined ||
              support.card.type === pending.cost.supportToHandType),
        )
        .slice(0, supportToHandAmount)
        .map((support) => support.card.instanceId)
      const canPaySupportToHand =
        supportToHandIds.length >= supportToHandAmount
      const hpToTrashIds = pending.cost.hpToTrash
        ? getHpToTrashCostCandidates(
            pending.cost,
            nextState.players[pending.playerId].battleArea,
            pending.sourceInstanceId,
          )
            .slice(0, 1)
            .map((cookie) => cookie.card.instanceId)
        : []
      const canPayHpToTrash = pending.cost.hpToTrash
        ? hpToTrashIds.length === 1
        : true
      const trashToDeckIds = pending.cost.trashToDeck
        ? getTrashToDeckCostCandidates(
            pending.cost,
            nextState.players[pending.playerId].discardPile,
          )
            .slice(0, pending.cost.trashToDeck.count)
            .map((card) => card.instanceId)
        : []
      const canPayTrashToDeck = pending.cost.trashToDeck
        ? trashToDeckIds.length === pending.cost.trashToDeck.count
        : true
      const context: EffectContext = {
        sourcePlayerId: pending.playerId,
        sourceInstanceId: pending.sourceInstanceId,
      }
      const applicableEffects = pending.effects.filter((effect) =>
        isEffectConditionMet(nextState, context, effect),
      )
      const selectableEffect = applicableEffects.find((effect) =>
        requiresEffectCardSelection(effect),
      )
      let autoTargetIds: string[] = []
      let selectionLimits: { min: number; max: number } | null = null
      if (selectableEffect) {
        const candidates = getEffectSelectionCandidates(
          nextState,
          context,
          selectableEffect,
        )
        const source = nextState.players[pending.playerId].battleArea.find(
          (cookie) => cookie.card.instanceId === pending.sourceInstanceId,
        )
        const sourceCanEnterTrashToBattle =
          pending.cost.selfToTrash === true &&
          selectableEffect.kind === 'trash-to-battle' &&
          source !== undefined &&
          source.card.type === 'cookie' &&
          (selectableEffect.energyColor === undefined ||
            source.card.energyColor === selectableEffect.energyColor) &&
          (selectableEffect.exactLevel === undefined ||
            source.card.level === selectableEffect.exactLevel) &&
          (selectableEffect.maxLevel === undefined ||
            source.card.level <= selectableEffect.maxLevel) &&
          (selectableEffect.maxHp === undefined ||
            source.card.hp <= selectableEffect.maxHp)
        const selectableCards =
          candidates.length > 0 || !sourceCanEnterTrashToBattle
            ? candidates
            : [source.card]
        selectionLimits = getEffectSelectionLimits(selectableEffect)
        autoTargetIds = selectableCards
          .slice(0, selectionLimits?.max ?? 0)
          .map((card) => card.instanceId)
      }
      const hasTarget = selectableEffect
        ? autoTargetIds.length >= (selectionLimits?.min ?? Number.POSITIVE_INFINITY)
        : applicableEffects.length > 0
      if (
        canPayHand &&
        canPayEnergy &&
        canPaySupportToHand &&
        canPayHpToTrash &&
        canPayTrashToDeck &&
        hasTarget
      ) {
        const discardIds = hand.slice(0, pending.cost.discardHand ?? 0).map((c) => c.instanceId)
        nextState = resolveOptionalCostAttack(
          nextState,
          pending.playerId,
          'pay',
          discardIds,
          autoTargetIds,
          paymentIds ?? undefined,
          supportToHandIds,
          hpToTrashIds,
          trashToDeckIds,
        )
      } else {
        nextState = resolveOptionalCostAttack(nextState, pending.playerId, 'skip')
      }
      continue
    }

    if (nextState.pendingFaintEffects && nextState.pendingFaintEffects.length > 0) {
      const faint = nextState.pendingFaintEffects[0]
      if (
        faint.effect.kind === 'damage' ||
        faint.effect.kind === 'modify-attack' ||
        faint.effect.kind === 'modify-damage-received'
      ) {
        const candidates = getEffectTargetCandidates(
          nextState,
          faint.context,
          (faint.effect as { target: EffectTargetSelector }).target,
        )
        const targetIds = candidates.length > 0 ? [candidates[0].card.instanceId] : []
        nextState = resolveFaintEffect(nextState, targetIds)
      } else {
        nextState = resolveFaintEffect(nextState, [])
      }
      continue
    }

    if (nextState.pendingAfterDamageEffects && nextState.pendingAfterDamageEffects.length > 0) {
      const pending = nextState.pendingAfterDamageEffects[0]
      if (
        pending.effect.kind === 'damage' ||
        pending.effect.kind === 'modify-attack' ||
        pending.effect.kind === 'modify-damage-received'
      ) {
        const candidates = getAfterDamageEffectCandidates(nextState)
        const targetIds = candidates.length > 0 ? [candidates[0].card.instanceId] : []
        nextState = resolveNextAfterDamageEffect(nextState, targetIds)
      } else {
        nextState = resolveNextAfterDamageEffect(nextState, [])
      }
      continue
    }

    const battle = nextState.pendingBattle!
    if (battle.stage === 'trap') {
      nextState = skipTrap(nextState, battle.defenderPlayerId)
    } else if (battle.stage === 'flip') {
      nextState = resolveFlip(nextState, battle.defenderPlayerId, {
        activate: false,
      })
    } else if (battle.stage === 'attack-effect') {
      const effect = battle.attackEffects[battle.attackEffectIndex]
      if (effect?.kind === 'optional-cost-attack') {
        nextState = resolveAttackEffect(nextState, battle.attackerPlayerId, [])
        continue
      }
      const targetIds =
        effect?.kind === 'break-to-trash'
          ? getBreakToTrashCandidates(
              nextState,
              {
                sourcePlayerId: battle.attackerPlayerId,
                sourceInstanceId: battle.attackerInstanceId,
              },
              effect,
            )
              .slice(0, effect.max)
              .map((card) => card.instanceId)
          : []
      nextState = resolveAttackEffect(
        nextState,
        battle.attackerPlayerId,
        targetIds,
      )
    } else {
      nextState = resolveNextDamage(nextState)
    }
  }

  if (guard >= 100) {
    throw new GameRuleError('Invalid battle action.')
  }

  return nextState
}

export const getTrapTargetCandidates = (
  state: GameState,
  playerId: PlayerId,
  trapInstanceId: string,
) => {
  const card = state.players[playerId].hand.find(
    (candidate) => candidate.instanceId === trapInstanceId,
  )
  const targetEffects = card?.trap?.effects.filter(
    (effect) =>
      effect.kind === 'damage' ||
      effect.kind === 'damage-by-break-count' ||
      effect.kind === 'damage-by-break-level-difference' ||
      effect.kind === 'modify-attack' ||
      effect.kind === 'modify-attack-by-break-count' ||
      effect.kind === 'prevent-knockout' ||
      effect.kind === 'field-to-trash' ||
      effect.kind === 'redirect-attack' ||
      effect.kind === 'return-to-hand' ||
      effect.kind === 'return-to-deck-bottom' ||
      (effect.kind === 'gain-hp' && Boolean(effect.target) && !effect.target?.sourceOnly),
  )
  // The guided trap UI has separate channels for opponent/either targets and
  // explicit self targets. Prefer the former when a trap targets both sides
  // (for example P-082), while retaining the first-target fallback for traps
  // that only target one of the defender's own Cookies.
  const targetEffect =
    targetEffects?.find(
      (effect) => 'target' in effect && effect.target?.side !== 'self',
    ) ?? targetEffects?.[0]
  const target =
    targetEffect && 'target' in targetEffect ? targetEffect.target : undefined
  return target
    ? getEffectTargetCandidates(
        state,
        {
          sourcePlayerId: playerId,
          sourceInstanceId: card!.instanceId,
        },
        target,
      )
    : []
}

export const getTrapSelfTargetCandidates = (
  state: GameState,
  playerId: PlayerId,
  trapInstanceId: string,
): CookieInBattle[] => {
  const card = state.players[playerId].hand.find(
    (candidate) => candidate.instanceId === trapInstanceId,
  )
  const selfEffects = card?.trap?.effects.filter(
    (effect) =>
      (effect.kind === 'damage' ||
        effect.kind === 'gain-hp' ||
        effect.kind === 'hp-to-hand') &&
      'target' in effect &&
      effect.target?.side === 'self' &&
      effect.target.max > 0,
  )
  const hasNonSelfTarget = card?.trap?.effects.some(
    (effect) =>
      'target' in effect &&
      effect.target !== undefined &&
      effect.target.side !== 'self',
  )
  // A self-only trap is already represented by getTrapTargetCandidates. Do
  // not expose the same Cookie again in a second guided phase.
  if (!selfEffects || selfEffects.length === 0 || !hasNonSelfTarget) return []
  const firstSelfEffect = selfEffects[0]
  const target =
    firstSelfEffect && 'target' in firstSelfEffect
      ? firstSelfEffect.target
      : undefined
  return target
    ? getEffectTargetCandidates(
        state,
        {
          sourcePlayerId: playerId,
          sourceInstanceId: card!.instanceId,
        },
        target,
      )
    : []
}

export const getFaintEffectCandidates = (
  state: GameState,
): CookieInBattle[] => {
  const faint = state.pendingFaintEffects?.[0]
  if (
    !faint ||
    (faint.effect.kind !== 'damage' &&
      faint.effect.kind !== 'modify-attack' &&
      faint.effect.kind !== 'modify-damage-received')
  ) {
    return []
  }
  return getEffectTargetCandidates(state, faint.context, faint.effect.target)
}

/**
 * Label the non-battle cards shown by a faint-effect prompt.
 *
 * Faint effects share the same target-selection modal as Cookie targets, but
 * effects such as BS3-061's support sacrifice select from another zone. Keep
 * the wording derived from the pending effect so the UI cannot call a support
 * card an opponent Cookie.
 */
export const getFaintEffectCandidateLabel = (state: GameState): string => {
  const effect = state.pendingFaintEffects?.[0]?.effect
  if (!effect) return '目標'

  switch (effect.kind) {
    case 'support-to-trash':
    case 'support-to-hand':
    case 'rest-support':
    case 'set-active':
      return '支援區卡'
    case 'hand-to-support':
    case 'hand-to-break':
    case 'hand-to-break-by-level-sum':
    case 'hand-to-battle':
      return '手牌卡'
    case 'break-to-hand':
    case 'break-to-hand-by-level-sum':
      return '休息區卡'
    case 'trash-to-battle':
    case 'trash-to-break':
    case 'opponent-trash-to-break':
    case 'trash-to-deck':
      return '棄牌區卡'
    default:
      return '目標'
  }
}

/**
 * 回傳昏厥效果需要從非戰鬥區選取的卡牌候選。
 * 傷害類效果沿用戰鬥區目標選擇，其他需要卡牌選擇的效果則共用一般效果候選。
 */
export const getFaintEffectCardCandidates = (state: GameState): GameCard[] => {
  const faint = state.pendingFaintEffects?.[0]
  if (!faint) return []

  if (
    faint.effect.kind === 'damage' ||
    faint.effect.kind === 'modify-attack' ||
    faint.effect.kind === 'modify-damage-received'
  ) {
    return []
  }

  if (
    !requiresEffectCardSelection(faint.effect) ||
    getEffectSelectionLimits(faint.effect) === null
  ) {
    return []
  }

  return getEffectSelectionCandidates(
    state,
    faint.context,
    faint.effect,
  )
}

export const getFaintEffectMinMax = (
  state: GameState,
  effect: CardEffect,
): { min: number; max: number } => {
  // 昏厥技能（When this Cookie faints）的「Return this Cookie to your hand」：
  // 來源在休息區、戰鬥區沒有候選，由 executeCardEffect 自動把休息區的來源
  // 返回手牌，不需要玩家選目標（BS5-026 DJ Cookie）。
  if (effect.kind === 'return-to-hand' && effect.target.sourceOnly) {
    const faint = state.pendingFaintEffects?.[0]
    if (
      faint &&
      state.players[faint.sourcePlayerId].breakArea.some(
        (card) => card.instanceId === faint.sourceInstanceId,
      )
    ) {
      return { min: 0, max: 0 }
    }
  }
  return getEffectSelectionLimits(effect) ?? { min: 0, max: 0 }
}

const skipUnmetPendingFaintEffects = (state: GameState): GameState => {
  const pending = state.pendingFaintEffects
  if (!pending || pending.length === 0) return state

  let firstApplicableIndex = 0
  while (firstApplicableIndex < pending.length) {
    const entry = pending[firstApplicableIndex]
    if (isEffectConditionMet(state, entry.context, entry.effect)) break
    firstApplicableIndex += 1
  }

  if (firstApplicableIndex === 0) return state
  return {
    ...state,
    pendingFaintEffects:
      firstApplicableIndex < pending.length
        ? pending.slice(firstApplicableIndex)
        : undefined,
  }
}

/**
 * 略過可選的昏厥技能時，必須跳過同一次觸發拆出的所有效果；
 * 不能只移除支援區代價，否則 BS3-061 仍會繼續結算後面的全場傷害。
 */
const skipOptionalFaintTrigger = (
  state: GameState,
  sourceInstanceId: string,
): GameState => {
  const pending = state.pendingFaintEffects ?? []
  let consumed = 0
  while (
    consumed < pending.length &&
    pending[consumed].sourceInstanceId === sourceInstanceId
  ) {
    consumed += 1
  }
  return {
    ...state,
    pendingFaintEffects:
      consumed < pending.length ? pending.slice(consumed) : undefined,
  }
}

export const resolveFaintEffect = (
  state: GameState,
  targetIds: string[],
  paymentIds: string[] = [],
  costOptions: {
    discardHandIds?: string[]
    supportToTrashIds?: string[]
  } = {},
): GameState => {
  if (state.pendingReplacement) {
    throw new GameRuleError('必須先完成補位。')
  }
  if (state.pendingOnPlay) {
    throw new GameRuleError('必須先處理餅乾的登場效果。')
  }
  if (state.pendingRefresh) {
    throw new GameRuleError('必須先完成牌庫 Refresh。')
  }

  const faints = state.pendingFaintEffects
  if (!faints || faints.length === 0) {
    throw new GameRuleError('Invalid battle action.')
  }

  const faint = faints[0]
  const discardHandIds = costOptions.discardHandIds ?? []
  const supportToTrashIds = costOptions.supportToTrashIds ?? []
  const isOptionalTriggerSkipped =
    faint.optional === true &&
    targetIds.length === 0 &&
    paymentIds.length === 0 &&
    discardHandIds.length === 0 &&
    supportToTrashIds.length === 0
  if (isOptionalTriggerSkipped) {
    return continuePendingReplacements(
      skipOptionalFaintTrigger(state, faint.sourceInstanceId),
    )
  }

  const remaining = faints.slice(1)
  let nextState: GameState = {
    ...state,
    pendingFaintEffects: remaining.length > 0 ? remaining : undefined,
  }

  if (!isEffectConditionMet(nextState, faint.context, faint.effect)) {
    return continuePendingReplacements(nextState)
  }

  const selectionLimits = getFaintEffectMinMax(state, faint.effect)
  // A faint effect can become unfulfillable after the Cookie leaves the
  // battle area. Treat an empty selection for a mandatory card effect as the
  // player's explicit skip instead of sending an invalid target error back to
  // the same modal forever.
  if (selectionLimits.min > 0 && targetIds.length === 0) {
    return continuePendingReplacements(nextState)
  }

  const faintCost = faint.cost
  if (!faintCost && (discardHandIds.length > 0 || supportToTrashIds.length > 0)) {
    throw new GameRuleError('此昏厥效果不需要支付手牌或支援區代價。')
  }
  if (faintCost) {
    const uniqueDiscardHandIds = [...new Set(discardHandIds)]
    const uniqueSupportToTrashIds = [...new Set(supportToTrashIds)]
    if (
      uniqueDiscardHandIds.length !== discardHandIds.length ||
      uniqueSupportToTrashIds.length !== supportToTrashIds.length
    ) {
      throw new GameRuleError('昏厥效果代價不能重複選擇同一張卡。')
    }

    const discardAmount = faintCost.discardHand ?? 0
    const supportAmount = faintCost.supportToTrash ?? 0
    const costWasSkipped =
      discardAmount + supportAmount > 0 &&
      uniqueDiscardHandIds.length === 0 &&
      uniqueSupportToTrashIds.length === 0
    if (costWasSkipped) {
      return continuePendingReplacements(nextState)
    }

    const sourcePlayer = nextState.players[faint.context.sourcePlayerId]
    const discardCandidates = getDiscardHandCostCandidates(
      faintCost,
      sourcePlayer.hand,
      faint.sourceInstanceId,
    )
    const discardCandidateIds = new Set(
      discardCandidates.map((card) => card.instanceId),
    )
    if (
      uniqueDiscardHandIds.length !== discardAmount ||
      uniqueDiscardHandIds.some((id) => !discardCandidateIds.has(id))
    ) {
      throw new GameRuleError('昏厥效果的手牌代價不合法。')
    }

    const supportCandidates = getSupportEffectCandidates(
      nextState,
      faint.context,
    )
    const supportCandidateIds = new Set(
      supportCandidates.map((support) => support.card.instanceId),
    )
    if (
      uniqueSupportToTrashIds.length !== supportAmount ||
      uniqueSupportToTrashIds.some((id) => !supportCandidateIds.has(id))
    ) {
      throw new GameRuleError('昏厥效果的支援區代價不合法。')
    }

    const discardHandSet = new Set(uniqueDiscardHandIds)
    const supportToTrashSet = new Set(uniqueSupportToTrashIds)
    const discardedHand = sourcePlayer.hand.filter((card) =>
      discardHandSet.has(card.instanceId),
    )
    const discardedSupport = sourcePlayer.supportArea
      .filter((support) => supportToTrashSet.has(support.card.instanceId))
      .map((support) => support.card)
    nextState = {
      ...nextState,
      players: {
        ...nextState.players,
        [faint.context.sourcePlayerId]: {
          ...sourcePlayer,
          hand: sourcePlayer.hand.filter(
            (card) => !discardHandSet.has(card.instanceId),
          ),
          supportArea: sourcePlayer.supportArea.filter(
            (support) => !supportToTrashSet.has(support.card.instanceId),
          ),
          discardPile: [
            ...sourcePlayer.discardPile,
            ...discardedHand,
            ...discardedSupport,
          ],
        },
      },
    }
  }

  const faintEnergyCost =
    faint.effect.kind === 'hand-to-battle' ||
    faint.effect.kind === 'trash-to-battle'
      ? faint.effect.energyCost
      : undefined
  if (!faintEnergyCost && paymentIds.length > 0) {
    throw new GameRuleError('此昏厥效果不需要能量費用。')
  }
  if (faintEnergyCost) {
    if (
      targetIds.length === 0 &&
      paymentIds.length === 0 &&
      (faint.effect.kind === 'hand-to-battle' ||
        faint.effect.kind === 'trash-to-battle') &&
      faint.effect.optional
    ) {
      return continuePendingReplacements(nextState)
    }

    const sourcePlayer = nextState.players[faint.context.sourcePlayerId]
    const paymentValidation = validateEnergyPayment(
      faintEnergyCost,
      sourcePlayer.supportArea,
      paymentIds,
    )
    if (!paymentValidation.valid) {
      throw new GameRuleError(`昏厥效果能量費用不合法：${paymentValidation.reason}`)
    }
    const paymentSet = new Set(paymentIds)
    nextState = {
      ...nextState,
      players: {
        ...nextState.players,
        [faint.context.sourcePlayerId]: {
          ...sourcePlayer,
          supportArea: sourcePlayer.supportArea.map((support) =>
            paymentSet.has(support.card.instanceId)
              ? { ...support, rested: true }
              : support,
          ),
        },
      },
    }
  }

  const faintExecutionContext = {
    ...faint.context,
    sourceCardName: faint.sourceCardName,
  }

  if (
    faint.effect.kind === 'damage' ||
    faint.effect.kind === 'modify-attack' ||
    faint.effect.kind === 'modify-damage-received'
  ) {
    if (targetIds.length > 0) {
      selectEffectTargets(nextState, faint.context, faint.effect.target, targetIds)
      const isDamageEffect = faint.effect.kind === 'damage'
      if (isDamageEffect) {
        nextState = {
          ...nextState,
          pendingAbilityEffect: {
            playerId: faint.context.sourcePlayerId,
            sourcePlayerId: faint.context.sourcePlayerId,
            sourceInstanceId: faint.context.sourceInstanceId,
            sourceCardName: faint.sourceCardName,
            sourceKind: 'skill',
            effects: [faint.effect],
            effectIndex: 0,
            battleContinuation: 'finish',
          },
        }
      }
      nextState = executeCardEffect(
        nextState,
        faintExecutionContext,
        faint.effect,
        targetIds,
      )
      if (isDamageEffect && !nextState.pendingBattle?.effectDamageSequence) {
        nextState = { ...nextState, pendingAbilityEffect: undefined }
      }
      if (nextState.pendingBattle?.effectDamageSequence) {
        return {
          ...nextState,
          pendingBattle: {
            ...nextState.pendingBattle,
            effectDamageSequence: {
              ...nextState.pendingBattle.effectDamageSequence,
              continuation: 'ability-effect',
              resumeBattleAfterAbility: true,
            },
          },
        }
      }
    } else if (faint.effect.target.min > 0) {
    throw new GameRuleError('Invalid battle action.')
    }
  } else {
    nextState = executeCardEffect(
      nextState,
      faintExecutionContext,
      faint.effect,
      targetIds,
    )
  }

  if (nextState.status !== 'playing') {
    return nextState
  }

  nextState = skipUnmetPendingFaintEffects(nextState)
  return continuePendingReplacements(nextState)
}

export const getAfterDamageEffectCandidates = (
  state: GameState,
): CookieInBattle[] => {
  const pending = state.pendingAfterDamageEffects?.[0]
  if (
    !pending ||
    (pending.effect.kind !== 'damage' &&
      pending.effect.kind !== 'modify-attack' &&
      pending.effect.kind !== 'modify-damage-received')
  ) {
    return []
  }
  return getEffectTargetCandidates(state, pending.context, pending.effect.target)
}

export const getAfterDamageEffectMinMax = (
  effect: CardEffect,
): { min: number; max: number } => {
  if (
    effect.kind === 'damage' ||
    effect.kind === 'modify-attack' ||
    effect.kind === 'modify-damage-received'
  ) {
    return { min: effect.target.min ?? 0, max: effect.target.max ?? 1 }
  }
  return { min: 0, max: 0 }
}

export const resolveNextAfterDamageEffect = (
  state: GameState,
  targetIds: string[],
): GameState => {
  const effects = state.pendingAfterDamageEffects
  if (!effects || effects.length === 0) {
    throw new GameRuleError('Invalid battle action.')
  }

  const pending = effects[0]
  const remaining = effects.slice(1)
  let nextState: GameState = {
    ...state,
    pendingAfterDamageEffects: remaining.length > 0 ? remaining : undefined,
  }

  if (
    pending.effect.kind === 'damage' ||
    pending.effect.kind === 'modify-attack' ||
    pending.effect.kind === 'modify-damage-received'
  ) {
    if (targetIds.length > 0) {
      selectEffectTargets(nextState, pending.context, pending.effect.target, targetIds)
      const isDamageEffect = pending.effect.kind === 'damage'
      if (isDamageEffect) {
        nextState = {
          ...nextState,
          pendingAbilityEffect: {
            playerId: pending.context.sourcePlayerId,
            sourcePlayerId: pending.context.sourcePlayerId,
            sourceInstanceId: pending.context.sourceInstanceId,
            sourceCardName: pending.sourceCardName,
            sourceKind: 'skill',
            effects: [pending.effect],
            effectIndex: 0,
            battleContinuation: 'finish',
          },
        }
      }
      nextState = executeCardEffect(
        nextState,
        pending.context,
        pending.effect,
        targetIds,
      )
      if (isDamageEffect && !nextState.pendingBattle?.effectDamageSequence) {
        nextState = { ...nextState, pendingAbilityEffect: undefined }
      }
      if (nextState.pendingBattle?.effectDamageSequence) {
        nextState = {
          ...nextState,
          pendingBattle: {
            ...nextState.pendingBattle,
            effectDamageSequence: {
              ...nextState.pendingBattle.effectDamageSequence,
              continuation: 'ability-effect',
              resumeBattleAfterAbility: true,
            },
          },
        }
      }
    } else if (pending.effect.target.min > 0) {
    throw new GameRuleError('Invalid battle action.')
    }
  } else {
    nextState = executeCardEffect(
      nextState,
      pending.context,
      pending.effect,
      [],
    )
  }

  if (nextState.status !== 'playing') {
    return nextState
  }

  const sourceCookie = nextState.players[pending.context.sourcePlayerId]?.battleArea.find(
    (c) => c.card.instanceId === pending.context.sourceInstanceId,
  )
  if (sourceCookie?.card.skill?.oncePerTurn) {
    const useKey = sourceCookie.battleEntryId ?? sourceCookie.card.instanceId
    if (!nextState.skillUsesThisTurn.includes(useKey)) {
      nextState = {
        ...nextState,
        skillUsesThisTurn: [...nextState.skillUsesThisTurn, useKey],
      }
    }
  }

  return continuePendingReplacements(nextState)
}
