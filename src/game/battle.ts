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
  hasRequiredEffectTargets,
  getTargetPlayerId,
  isEffectConditionMet,
  requiresTargetSelection,
  isEffectTargeted,
  requiresEffectCardSelection,
  resolveDrawUpTo,
  selectEffectTargets,
} from './effects'
import {
  getAttackEnergyCost,
  getRemainingEnergyCost,
  selectEnergyPayment,
  validateEnergyPayment,
} from './energy'
import { getOpponentId } from './helpers'
import {
  clearDepartedCookieModifiers,
  continuePendingReplacements,
  finalizePendingReplacements,
  recordCookieDepartures,
} from './replacement'
import {
  canPayTrashBattleCookieCost,
  payTrashBattleCookieCost,
} from './skills'
import { canAttack } from './turn'
import type {
  CardEffect,
  CookieInBattle,
  EffectContext,
  EffectTargetSelector,
  EnergyColor,
  GameCard,
  GameState,
  CookieCard,
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

  if (!attacker || attacker.rested) {
    throw new GameRuleError('Invalid battle action.')
  }

  if (
    state.attackDisabledUntilTurn?.[attackerInstanceId] === state.turnNumber
  ) {
    throw new GameRuleError('Invalid battle action.')
  }

  const defenderPlayerId = getOpponentId(state.activePlayerId)
  const defender = state.players[defenderPlayerId]
  if (
    !defender.battleArea.some(
      (cookie) => cookie.card.instanceId === targetInstanceId,
    )
  ) {
    throw new GameRuleError('Invalid battle action.')
  }

  const paymentValidation = validateEnergyPayment(
    getAttackEnergyCost(attacker.card),
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
    const isTargetedGainHp =
      effect.kind === 'gain-hp' && Boolean(effect.target) && !effect.target?.sourceOnly
    if ((!isEffectTargeted(effect) && !isTargetedGainHp) || !effect.target || effect.target.min === 0) {
      return true
    }

    const battleCandidateCount = getEffectTargetCandidates(
      state,
      context,
      effect.target,
    ).length
    const stageCandidateCount =
      effect.kind === 'field-to-trash' &&
      effect.allowStage &&
      state.players[getTargetPlayerId(context, effect.target)].stage !== null
        ? 1
        : 0

    return battleCandidateCount + stageCandidateCount >= effect.target.min
  })
}

export type TrapUnavailableReason =
  | 'not-trap-stage'
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
      selectEnergyPayment(
        card.trap!.cost.energy ?? card.trap!.cost,
        player.supportArea,
      ) !== null &&
      canPayTrashBattleCookieCost(card.trap!.cost, player.battleArea),
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
      effect.kind === 'modify-attack' ||
      effect.kind === 'prevent-knockout' ||
      effect.kind === 'field-to-trash' ||
      effect.kind === 'redirect-attack' ||
      (effect.kind === 'gain-hp' && Boolean(effect.target) && !effect.target?.sourceOnly),
  )
  if (targetEffects.length === 0) {
    if (targetIds.length > 0) {
    throw new GameRuleError('Invalid battle action.')
    }
    return
  }

  for (const effect of targetEffects) {
    const target = 'target' in effect ? effect.target : undefined
    if (!target) continue
    const isSelfTarget = target.side === 'self'
    let effectiveIds: string[]
    if (isSelfTarget) {
      if (selfTargetIds && selfTargetIds.length > 0) {
        effectiveIds = selfTargetIds
      } else {
        const selfCandidates = getEffectTargetCandidates(
          state,
          { sourcePlayerId: playerId, sourceInstanceId: 'pending-trap' },
          target,
        )
        const selfCandidateIds = new Set(selfCandidates.map((c) => c.card.instanceId))
        const validTargetIds = targetIds.filter((id) => selfCandidateIds.has(id))
        effectiveIds = validTargetIds.length > 0
          ? validTargetIds
          : selfCandidates.length > 0
            ? [selfCandidates[0].card.instanceId]
            : []
      }
    } else {
      effectiveIds = targetIds
    }
    selectEffectTargets(
      state,
      {
        sourcePlayerId: playerId,
        sourceInstanceId: 'pending-trap',
      },
      target,
      effectiveIds,
    )
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

const markSupportAreaDecreased = (
  state: GameState,
  playerId: PlayerId,
): GameState => ({
  ...state,
  supportAreaDecreasedThisTurn: {
    ...(state.supportAreaDecreasedThisTurn ?? {}),
    [playerId]: true,
  },
})

export interface PlayTrapOptions {
  trapInstanceId: string
  paymentIds: string[]
  targetIds: string[]
  supportTrashIds?: string[]
  supportToHandIds?: string[]
  handToSupportIds?: string[]
  discardHandIds?: string[]
  /** 放進自己休息區的手牌餅乾代價（BS3-046）。 */
  handToBreakIds?: string[]
  trashBattleCookieIds?: string[]
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

export interface PlayBlockerOptions {
  sourceInstanceId: string
  paymentIds: string[]
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

  const paymentValidation = validateEnergyPayment(
    trap.cost.energy ?? trap.cost,
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
    uniqueDiscardHandIds.length !== (trap.cost.discardHand ?? 0)
  ) {
    throw new GameRuleError(
      `Must discard exactly ${trap.cost.discardHand ?? 0} cards from hand.`,
    )
  }
  const discardedHandCards = player.hand.filter(
    (card) =>
      card.instanceId !== trapCard.instanceId &&
      uniqueDiscardHandIds.includes(card.instanceId),
  )
  if (discardedHandCards.length !== (trap.cost.discardHand ?? 0)) {
    throw new GameRuleError('Invalid battle action.')
  }
  if (trap.cost.discardHandColor) {
    const invalidDiscard = discardedHandCards.find(
      (card) => card.energyColor !== trap.cost.discardHandColor,
    )
    if (invalidDiscard) {
      throw new GameRuleError(
        `Discarded cards must be ${trap.cost.discardHandColor} energy color.`,
      )
    }
  }

  // 手牌餅乾放進自己的休息區，與 discardHand（進棄牌區）不同，會推進自己的 break 等級。
  const handToBreakCost = trap.cost.handToBreakArea
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
    trap.cost,
    options.trashBattleCookieIds ?? [],
  )
  updatedPlayer = trashBattlePayment.player

  let nextState: GameState = {
    ...state,
    players: {
      ...state.players,
      [playerId]: updatedPlayer,
    },
    pendingBattle: {
      ...battle,
      trapUsed: true,
      ...(trap.condition?.kind ===
      'friendly-color-fainted-this-battle'
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
    // 手牌進休息區會推進自己的 break 等級，必須立刻結算勝負。
    nextState = resolveBreakLevelVictory(nextState)
  }

  if (supportToTrash?.kind === 'support-to-trash') {
    nextState = markSupportAreaDecreased(nextState, playerId)
  }

  const context = {
    sourcePlayerId: playerId,
    sourceInstanceId: trapCard.instanceId,
    sourceCardName: trapCard.name,
  }

  for (const effect of trap.effects) {
    if (
      trap.condition?.kind ===
      'friendly-color-fainted-this-battle'
    ) {
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
      const isSelfTarget = effect.target?.side === 'self'
      let redirectTargetIds: string[]
      if (isSelfTarget) {
        if (options.selfTargetIds && options.selfTargetIds.length > 0) {
          redirectTargetIds = options.selfTargetIds
        } else {
          const selfCandidates = getEffectTargetCandidates(
            nextState,
            context,
            effect.target,
          )
          const selfCandidateIds = new Set(selfCandidates.map((c) => c.card.instanceId))
          const validTargetIds = options.targetIds.filter((id) => selfCandidateIds.has(id))
          redirectTargetIds = validTargetIds.length > 0
            ? validTargetIds
            : selfCandidates.length > 0
              ? [selfCandidates[0].card.instanceId]
              : []
        }
      } else {
        redirectTargetIds = options.targetIds
      }
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

    if (effect.kind === 'damage') {
      const isSelfTarget = effect.target?.side === 'self'
      let damageTargetIds: string[]
      if (isSelfTarget) {
        if (options.selfTargetIds && options.selfTargetIds.length > 0) {
          damageTargetIds = options.selfTargetIds
        } else {
          const selfCandidates = getEffectTargetCandidates(
            nextState,
            context,
            effect.target,
          )
          const selfCandidateIds = new Set(selfCandidates.map((c) => c.card.instanceId))
          const validTargetIds = options.targetIds.filter((id) => selfCandidateIds.has(id))
          damageTargetIds = validTargetIds.length > 0
            ? validTargetIds
            : selfCandidates.length > 0
              ? [selfCandidates[0].card.instanceId]
              : []
        }
      } else {
        damageTargetIds = options.targetIds
      }
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
      nextState = {
        ...nextState,
        pendingBattle: {
          ...activeBattle,
          stage: 'damage',
          remainingDamage: effect.amount,
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

    nextState = executeCardEffect(
      nextState,
      context,
      effect,
      effect.kind === 'draw' ||
        effect.kind === 'deck-to-support' ||
        (effect.kind === 'gain-hp' && (!effect.target || effect.target.sourceOnly))
        ? []
        : (() => {
            if ('target' in effect && effect.target?.side === 'self') {
              if (options.selfTargetIds && options.selfTargetIds.length > 0) {
                return options.selfTargetIds
              }
              const selfCandidates = getEffectTargetCandidates(
                nextState,
                context,
                effect.target,
              )
              const selfCandidateIds = new Set(selfCandidates.map((c) => c.card.instanceId))
              const validTargetIds = options.targetIds.filter((id) => selfCandidateIds.has(id))
              return validTargetIds.length > 0
                ? validTargetIds
                : selfCandidates.length > 0
                  ? [selfCandidates[0].card.instanceId]
                  : []
            }
            return options.targetIds
          })(),
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

  const attackerExists = battleParticipantExists(
    state,
    battle.attackerInstanceId,
  )
  const targetExists = battleParticipantExists(
    state,
    battle.targetInstanceId,
  )
  if (!attackerExists || !targetExists) {
    return finishBattle(state)
  }

  return {
    ...state,
    pendingBattle: {
      ...battle,
      stage: 'damage',
    },
  }
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
    for (const effect of faintSkill.effects) {
      if (
        effect.kind === 'damage' ||
        effect.kind === 'modify-attack' ||
        effect.kind === 'modify-damage-received'
      ) {
        const context = {
          sourcePlayerId: playerId,
          sourceInstanceId: target.card.instanceId,
          sourceCardName: target.card.name,
        }
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
                effect,
                context,
              },
            ],
          }
        }
      } else {
        const context = {
          sourcePlayerId: playerId,
          sourceInstanceId: target.card.instanceId,
          sourceCardName: target.card.name,
        }
        nextState = {
          ...nextState,
          pendingFaintEffects: [
            ...(nextState.pendingFaintEffects ?? []),
            {
              sourcePlayerId: playerId,
              sourceInstanceId: target.card.instanceId,
              sourceCardName: target.card.name,
              effect,
              context,
            },
          ],
        }
      }
    }
  }

  return continuePendingReplacements(nextState)
}
/**
 * 延遲陷阱是否成立。未指定 `minLevel` 時沿用舊行為（只看本次戰鬥有沒有該顏色
 * 的餅乾昏厥）；指定時改用 `faintedCookies`，額外要求昏厥的是陷阱擁有者自己的
 * 餅乾且等級達標（BS3-046 的「your {Y} LV.2 or higher Cookies」）。
 */
const isDelayedTrapTriggered = (battle: PendingBattle): boolean => {
  const delayed = battle.delayedTrap
  if (!delayed) return false
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

const collectAfterDamageEffects = (
  state: GameState,
  battle: PendingBattle,
): GameState => {
  const damagedIds = battle.damagedInstanceIds ?? []
  return collectAfterDamageEffectsFromIds(state, damagedIds)
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
): boolean =>
  effects.some(
    (effect) =>
      isEffectConditionMet(state, context, effect) &&
      hasRequiredEffectTargets(state, context, effect),
  )

const advanceAttackEffect = (
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
  const energyCost = getRemainingEnergyCost(
    pending.cost.energy ?? {},
    pending.sourceEnergy,
  )
  const uniquePaymentIds = [...new Set(paymentIds)]
  if (uniquePaymentIds.length !== paymentIds.length) {
    throw new GameRuleError('Invalid battle action.')
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
  const selectableEffects = applicableEffects.filter((effect) =>
    requiresEffectCardSelection(effect),
  )
  if (selectableEffects.length > 0) {
    const uniqueTargetIds = [...new Set(targetIds)]
    if (uniqueTargetIds.length !== targetIds.length) {
      throw new GameRuleError('Invalid battle action.')
    }
    const hasValidTarget = selectableEffects.every((effect) => {
        const limits = getEffectSelectionLimits(effect)
        if (!limits) return false
        const { min, max } = limits
        if (uniqueTargetIds.length < min || uniqueTargetIds.length > max) {
          return false
        }
        const candidates = getEffectSelectionCandidates(
          state,
          effectContext,
          effect,
        )
        return uniqueTargetIds.every((targetId) =>
          candidates.some((card) => card.instanceId === targetId),
        )
      })
    if (!hasValidTarget) {
      throw new GameRuleError('Invalid battle action.')
    }
  }
  const discardedCards = player.hand.filter((card) => uniqueDiscardIds.includes(card.instanceId))
  const paymentSet = new Set(uniquePaymentIds)
  let nextState: GameState = {
    ...state,
    pendingOptionalCostAttack: null,
    players: {
      ...state.players,
      [playerId]: {
        ...player,
        hand: player.hand.filter((card) => !uniqueDiscardIds.includes(card.instanceId)),
        discardPile: [...player.discardPile, ...discardedCards],
        supportArea: player.supportArea.map((support) =>
          paymentSet.has(support.card.instanceId)
            ? { ...support, rested: true }
            : support,
        ),
      },
    },
  }
  const context = effectContext
  for (const effect of applicableEffects) {
    if (nextState.status !== 'playing') break
    nextState = executeCardEffect(nextState, context, effect, targetIds)
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
  if (!attackerExists || !targetExists) {
    return finishBattle(state)
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
  let nextState: GameState = {
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
        revealedHpCard.flip.effects.some((effect) =>
          isEffectConditionMet(state, {
            sourcePlayerId: defender.id,
            sourceInstanceId: revealedHpCard.instanceId,
            sourceCardName: revealedHpCard.name,
          }, effect),
        )
          ? 'flip'
          : 'damage',
    },
  }

  if (
    revealedHpCard.flip &&
    state.flipDisabledUntilTurn?.[target.card.instanceId] !==
      state.turnNumber &&
    revealedHpCard.flip.effects.some((effect) =>
      isEffectConditionMet(state, {
        sourcePlayerId: defender.id,
        sourceInstanceId: revealedHpCard.instanceId,
        sourceCardName: revealedHpCard.name,
      }, effect),
    )
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
  if (options.activate) {
    const flipContext = {
      sourcePlayerId: playerId,
      sourceInstanceId: revealed.instanceId,
      sourceCardName: revealed.name,
    }
    const hasActivatableEffect = revealed.flip.effects.some((effect) =>
      isEffectConditionMet(state, flipContext, effect),
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

    for (let i = 0; i < revealed.flip.effects.length; i += 1) {
      const effect = revealed.flip.effects[i]
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
      } else {
        nextState = executeCardEffect(
          nextState,
          context,
          effect,
          [],
        )
        if (nextState.pendingDrawUpTo) {
          const remainingEffects = revealed.flip.effects.slice(i + 1)
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

  const player = nextState.players[playerId]
  nextState = {
    ...nextState,
    players: {
      ...nextState.players,
      [playerId]: flipToSupportChoice
        ? {
            ...player,
            supportArea: [
              ...player.supportArea,
              { card: revealed, rested: flipToSupportChoice.rested },
            ],
          }
        : {
            ...player,
            discardPile: [...player.discardPile, revealed],
          },
    },
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
      const context: EffectContext = {
        sourcePlayerId: pending.playerId,
        sourceInstanceId: pending.sourceInstanceId,
      }
      const applicableEffects = pending.effects.filter((effect) =>
        isEffectConditionMet(nextState, context, effect),
      )
      const targetedEffect = applicableEffects.find((e) =>
        requiresTargetSelection(e),
      )
      let autoTargetIds: string[] = []
      if (targetedEffect) {
        const candidates = getEffectTargetCandidatesForEffect(
          nextState,
          context,
          targetedEffect,
        )
        autoTargetIds = candidates
          .slice(0, targetedEffect.kind === 'opponent-battle-to-trash' ? 1 : targetedEffect.target.max)
          .map((c) => c.card.instanceId)
      }
      const hasTarget = targetedEffect
        ? autoTargetIds.length >=
          (targetedEffect.kind === 'opponent-battle-to-trash'
            ? targetedEffect.min ?? 1
            : targetedEffect.target.min)
        : applicableEffects.length > 0
      if (canPayHand && canPayEnergy && hasTarget) {
        const discardIds = hand.slice(0, pending.cost.discardHand ?? 0).map((c) => c.instanceId)
        nextState = resolveOptionalCostAttack(nextState, pending.playerId, 'pay', discardIds, autoTargetIds, paymentIds ?? undefined)
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
  const targetEffect = card?.trap?.effects.find(
    (effect) =>
      effect.kind === 'damage' ||
      effect.kind === 'modify-attack' ||
      effect.kind === 'prevent-knockout' ||
      effect.kind === 'field-to-trash' ||
      effect.kind === 'redirect-attack' ||
      (effect.kind === 'gain-hp' && Boolean(effect.target) && !effect.target?.sourceOnly),
  )
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
      (effect.kind === 'damage' || effect.kind === 'gain-hp') &&
      'target' in effect &&
      effect.target?.side === 'self' &&
      (effect.target.min ?? 0) > 0,
  )
  if (!selfEffects || selfEffects.length === 0) return []
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

export const getFaintEffectMinMax = (
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

export const resolveFaintEffect = (
  state: GameState,
  targetIds: string[],
): GameState => {
  const faints = state.pendingFaintEffects
  if (!faints || faints.length === 0) {
    throw new GameRuleError('Invalid battle action.')
  }

  const faint = faints[0]
  const remaining = faints.slice(1)
  let nextState: GameState = {
    ...state,
    pendingFaintEffects: remaining.length > 0 ? remaining : undefined,
  }

  if (
    faint.effect.kind === 'damage' ||
    faint.effect.kind === 'modify-attack' ||
    faint.effect.kind === 'modify-damage-received'
  ) {
    if (targetIds.length > 0) {
      selectEffectTargets(nextState, faint.context, faint.effect.target, targetIds)
      nextState = executeCardEffect(
        nextState,
        faint.context,
        faint.effect,
        targetIds,
      )
    } else if (faint.effect.target.min > 0) {
    throw new GameRuleError('Invalid battle action.')
    }
  } else {
    nextState = executeCardEffect(
      nextState,
      faint.context,
      faint.effect,
      [],
    )
  }

  if (nextState.status !== 'playing') {
    return nextState
  }

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
      nextState = executeCardEffect(
        nextState,
        pending.context,
        pending.effect,
        targetIds,
      )
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
