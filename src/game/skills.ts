import { GameRuleError } from './errors'
import {
  selectEnergyPayment,
  validateEnergyPayment,
} from './energy'
import {
  getBreakCount,
  getBreakToBattleCandidates,
  getBreakToHandBySumCandidates,
  getEffectSelectionCandidates,
  getEffectTargetCandidates,
  isEffectConditionMet,
  isEffectTargeted,
} from './effects/targeting'
import type {
  AbilityCost,
  CardEffect,
  CardSkill,
  CookieCard,
  CookieInBattle,
  GameCard,
  GameState,
  PlayerId,
  PlayerState,
  SkillTrigger,
  SupportCard,
} from './types'
import {
  clearDepartedCookieModifiers,
  continuePendingReplacements,
  recordCookieDepartures,
} from './replacement'
import { defaultShuffle } from './helpers'
import type { Shuffle } from './types'

export const getSkillUseKey = (
  source: GameState['players'][PlayerId]['battleArea'][number],
) => source.battleEntryId ?? source.card.instanceId

/**
 * 官方釋疑：「本場遊戲只能使用 1 次」是每位玩家限定一次，即使同一位玩家的
 * 休息區有多張同名卡（例如兩張 BS3-025），也只能共用這一次額度——不是每張
 * 卡各自的 instanceId 各算一次。因此用 `playerId + card.id`（卡片編號，
 * 同名卡共用）而非 `card.instanceId`（每張實體卡各自不同）當 key。
 */
const getOncePerGameKey = (playerId: PlayerId, cardId: string) =>
  `${playerId}:${cardId}`

/**
 * 尋找要發動技能的來源餅乾。一般技能只能從戰鬥區發動；`fromBreakArea` 技能
 * （BS3-025）額外允許來源在休息區。休息區餅乾包成與 `CookieInBattle` 相容
 * 的形狀以便沿用既有的代價／條件檢查，但休息區沒有「橫置」語意，固定回傳
 * `rested: false`——目前唯一的休息區技能 `restSource` 也是 false，不影響
 * 正確性；若未來新增 `restSource` 且 `fromBreakArea` 都為真的技能，這裡需要
 * 另外設計「已用過仍視為不可用」的判定，而不能只靠 rested。
 */
export const findSkillSource = (
  player: PlayerState,
  sourceInstanceId: string,
): CookieInBattle | undefined => {
  const battleSource = player.battleArea.find(
    (cookie) => cookie.card.instanceId === sourceInstanceId,
  )
  if (battleSource) return battleSource

  const breakCard = player.breakArea.find(
    (card) => card.instanceId === sourceInstanceId,
  )
  return breakCard?.skill?.fromBreakArea
    ? { card: breakCard, hpCards: [], rested: false }
    : undefined
}

/**
 * 記錄支援區減少，並在指定情況下排入「支援卡進入棄牌區」的被動餅乾技能。
 * 共用既有 pendingStageTrigger 通道，讓效果排序、AI、線上同步與 UI 維持同一套待處理協定。
 */
export const markSupportAreaDecreased = (
  state: GameState,
  playerId: PlayerId,
  options: { triggerSkill?: boolean; trashedCount?: number } = {},
): GameState => {
  const trashedCount = Math.max(0, options.trashedCount ?? 0)
  const nextState: GameState = {
    ...state,
    supportAreaDecreasedThisTurn: {
      ...(state.supportAreaDecreasedThisTurn ?? {}),
      [playerId]: true,
    },
    ...(trashedCount > 0
      ? {
          supportCardsTrashedThisTurn: {
            ...(state.supportCardsTrashedThisTurn ?? {}),
            [playerId]:
              (state.supportCardsTrashedThisTurn?.[playerId] ?? 0) +
              trashedCount,
          },
        }
      : {}),
  }

  if (!options.triggerSkill || nextState.pendingStageTrigger) {
    return nextState
  }

  const player = nextState.players[playerId]
  if (nextState.activePlayerId !== playerId) return nextState

  const source = player.battleArea.find((cookie) => {
    const skill = cookie.card.skill
    const triggerEffects = skill?.effects.filter(
      (effect) =>
        'condition' in effect &&
        effect.condition?.kind === 'support-area-decreased-this-turn',
    ) ?? []
    return (
      skill?.trigger === 'passive' &&
      (!skill.yourTurn || nextState.activePlayerId === playerId) &&
      (!skill.restSource || !cookie.rested) &&
      (!skill.oncePerTurn ||
        !nextState.skillUsesThisTurn.includes(getSkillUseKey(cookie))) &&
      triggerEffects.some((effect) =>
        isEffectConditionMet(
          nextState,
          {
            sourcePlayerId: playerId,
            sourceInstanceId: cookie.card.instanceId,
          },
          effect,
        ),
      )
    )
  })

  if (!source?.card.skill) return nextState

  const context = {
    sourcePlayerId: playerId,
    sourceInstanceId: source.card.instanceId,
  }
  const effects = source.card.skill.effects.filter(
    (effect) =>
      'condition' in effect &&
      effect.condition?.kind === 'support-area-decreased-this-turn' &&
      isEffectConditionMet(nextState, context, effect),
  )
  if (effects.length === 0) return nextState

  return {
    ...nextState,
    pendingStageTrigger: {
      playerId,
      sourceInstanceId: source.card.instanceId,
      sourceCardName: source.card.name,
      effectText: source.card.skill.text,
      sourceKind: 'cookie-skill',
      effects,
      ...(source.card.skill.sourceEnergy
        ? { sourceEnergy: source.card.skill.sourceEnergy }
        : {}),
    },
  }
}

/**
 * AI 的「主動發動技能」決策迴圈要考慮的候選來源：戰鬥區照舊，另外加上休息區
 * 帶 `fromBreakArea` 的餅乾（BS3-025），否則 AI 永遠不會發動這類技能。
 */
export const getActivatableSkillSources = (
  player: PlayerState,
): CookieInBattle[] => [
  ...player.battleArea,
  ...player.breakArea
    .filter((card) => card.skill?.fromBreakArea)
    .map((card) => ({ card, hpCards: [], rested: false })),
]

export const canPayEnergyCost = (
  cost: AbilityCost,
  supports: SupportCard[],
): boolean => selectEnergyPayment(cost.energy ?? cost, supports) !== null

/**
 * 某些效果條件讀取同一次啟動支付後才產生的紀錄，不能在支付前把技能
 * 隱藏。BS5-016 的傷害條件就是「剛丟進棄牌區的 HP 卡不是 Cookie」。
 */
export const isSkillEffectConditionDeferredUntilCost = (
  skill: CardSkill,
  effect: CardEffect,
): boolean =>
  Boolean(skill.cost.hpToTrash) &&
  'condition' in effect &&
  effect.condition?.kind === 'last-hp-trash-card-non-cookie'

export const canPaySupportToTrashCost = (
  cost: AbilityCost,
  supports: SupportCard[],
  excludedSupportIds: ReadonlySet<string> = new Set(),
): boolean => {
  if (!cost.supportToTrash) return true
  return (
    supports.filter(
      (support) => !excludedSupportIds.has(support.card.instanceId),
    ).length >= cost.supportToTrash
  )
}

export const getTrashToDeckBottomCostCandidates = (
  cost: AbilityCost,
  discardPile: readonly GameCard[],
): GameCard[] => {
  if (!cost.trashToDeckBottom) return []
  return discardPile.filter(
    (card) => !cost.trashToDeckBottom!.nonCookieOnly || card.type !== 'cookie',
  )
}

export const canPayTrashToDeckBottomCost = (
  cost: AbilityCost,
  discardPile: readonly GameCard[],
): boolean =>
  !cost.trashToDeckBottom ||
  getTrashToDeckBottomCostCandidates(cost, discardPile).length >=
    cost.trashToDeckBottom.count

export const getTrashToDeckCostCandidates = (
  cost: AbilityCost,
  discardPile: readonly GameCard[],
): GameCard[] => {
  const trashCost = cost.trashToDeck
  if (!trashCost) return []
  return discardPile.filter((card) => {
    if (trashCost.energyColor !== undefined && card.energyColor !== trashCost.energyColor) {
      return false
    }
    if (trashCost.excludeFlip && card.flip) return false
    if (trashCost.keyword && !card.keywords?.includes(trashCost.keyword)) {
      return false
    }
    if (trashCost.nonCookieOnly && card.type === 'cookie') return false
    return true
  })
}

export const canPayTrashToDeckCost = (
  cost: AbilityCost,
  discardPile: readonly GameCard[],
): boolean =>
  !cost.trashToDeck ||
  getTrashToDeckCostCandidates(cost, discardPile).length >=
    cost.trashToDeck.count

export const getTrashBattleCookieCostCandidates = (
  cost: AbilityCost,
  battleArea: CookieInBattle[],
  sourceInstanceId?: string,
): CookieInBattle[] => {
  if (!cost.trashBattleCookie) return []
  if (cost.trashBattleCookie.sourceOnly) {
    return battleArea.filter(
      (cookie) => cookie.card.instanceId === sourceInstanceId,
    )
  }
  const { level, minLevel, maxLevel, energyColor } = cost.trashBattleCookie
  return battleArea.filter((cookie) => {
    if (
      cost.trashBattleCookie?.excludeSource &&
      cookie.card.instanceId === sourceInstanceId
    ) {
      return false
    }
    if (level !== undefined && cookie.card.level !== level) return false
    if (minLevel !== undefined && cookie.card.level < minLevel) return false
    if (maxLevel !== undefined && cookie.card.level > maxLevel) return false
    if (energyColor !== undefined && cookie.card.energyColor !== energyColor) return false
    return true
  })
}

export const canPayTrashBattleCookieCost = (
  cost: AbilityCost,
  battleArea: CookieInBattle[],
  sourceInstanceId?: string,
): boolean =>
  !cost.trashBattleCookie ||
  getTrashBattleCookieCostCandidates(cost, battleArea, sourceInstanceId).length >=
    cost.trashBattleCookie.count

export const getTrashCookieToBreakAreaCostCandidates = (
  cost: AbilityCost,
  discardPile: readonly GameCard[],
): GameCard[] => {
  if (!cost.trashCookieToBreakArea) return []
  const requirement = cost.trashCookieToBreakArea
  return discardPile.filter(
    (card) =>
      card.type === 'cookie' &&
      (requirement.hp === undefined || card.hp === requirement.hp) &&
      (requirement.energyColor === undefined ||
        card.energyColor === requirement.energyColor) &&
      (!requirement.excludeFlip || !card.flip),
  )
}

export const canPayTrashCookieToBreakAreaCost = (
  cost: AbilityCost,
  discardPile: readonly GameCard[],
): boolean =>
  !cost.trashCookieToBreakArea ||
  getTrashCookieToBreakAreaCostCandidates(cost, discardPile).length >=
    cost.trashCookieToBreakArea.count

/** 以卡面指定的顏色／類型篩選可作為棄手牌代價的卡片。 */
export const isDiscardHandCostCandidate = (
  cost: AbilityCost,
  card: GameCard,
  sourceInstanceId?: string,
): boolean =>
  card.instanceId !== sourceInstanceId &&
  (!cost.discardHandColor || card.energyColor === cost.discardHandColor) &&
  (!cost.discardHandType || card.type === cost.discardHandType) &&
  (!cost.discardHandKeyword || Boolean(card.keywords?.includes(cost.discardHandKeyword))) &&
  (!cost.discardHandHasFlip || (card.type === 'cookie' && Boolean(card.flip)))

export const getDiscardHandCostCandidates = (
  cost: AbilityCost,
  hand: readonly GameCard[],
  sourceInstanceId?: string,
): GameCard[] =>
  hand.filter((card) =>
    isDiscardHandCostCandidate(cost, card, sourceInstanceId),
  )

/**
 * 取得「昏厥技能」尚未由效果本身表示的手牌／支援區代價。
 *
 * BS3-061 與 BS5-026 已把支付動作放在 effects 的第一段；若再把同一筆
 * cost 掛到 pending faint，會被重複支付。因此只把仍停留在 CardSkill.cost、
 * 且 effects 沒有對應支付動作的部分交給昏厥提示框處理。
 */
export const getFaintTriggeredCost = (
  skill: CardSkill,
): Pick<
  AbilityCost,
  | 'discardHand'
  | 'discardHandColor'
  | 'discardHandType'
  | 'discardHandKeyword'
  | 'discardHandHasFlip'
  | 'supportToTrash'
> | undefined => {
  const discardHand = skill.cost.discardHand ?? 0
  const supportToTrash = skill.cost.supportToTrash ?? 0
  const discardCoveredByHandPlacement =
    discardHand > 0 &&
    skill.effects.some(
      (effect) =>
        effect.kind === 'hand-to-break' &&
        effect.amount >= discardHand &&
        (!skill.cost.discardHandColor ||
          effect.energyColor === skill.cost.discardHandColor) &&
        (!skill.cost.discardHandType || skill.cost.discardHandType === 'cookie'),
    )
  const discardCovered =
    discardHand > 0 &&
    (discardCoveredByHandPlacement ||
      skill.effects.some(
        (effect) => effect.kind === 'discard-hand' && effect.count >= discardHand,
      ))
  const supportCovered =
    supportToTrash > 0 &&
    skill.effects.some(
      (effect) => effect.kind === 'support-to-trash' && effect.amount >= supportToTrash,
    )

  if (
    (discardHand === 0 || discardCovered) &&
    (supportToTrash === 0 || supportCovered)
  ) {
    return undefined
  }

  return {
    ...(discardHand > 0 && !discardCovered ? { discardHand } : {}),
    ...(skill.cost.discardHandColor && !discardCovered
      ? { discardHandColor: skill.cost.discardHandColor }
      : {}),
    ...(skill.cost.discardHandType && !discardCovered
      ? { discardHandType: skill.cost.discardHandType }
      : {}),
    ...(skill.cost.discardHandKeyword && !discardCovered
      ? { discardHandKeyword: skill.cost.discardHandKeyword }
      : {}),
    ...(skill.cost.discardHandHasFlip && !discardCovered
      ? { discardHandHasFlip: skill.cost.discardHandHasFlip }
      : {}),
    ...(supportToTrash > 0 && !supportCovered ? { supportToTrash } : {}),
  }
}

/**
 * 「Discard your entire hand.」類代價（BS5-083）：整副手牌都是合法選擇
 * （不含來源卡自身）；與 `discardHand` 不同，不限制張數與顏色。
 */
export const getDiscardAllHandCostCandidates = (
  cost: AbilityCost,
  hand: readonly GameCard[],
  sourceInstanceId?: string,
): GameCard[] =>
  cost.discardAllHand
    ? hand.filter((card) =>
        isDiscardHandCostCandidate(cost, card, sourceInstanceId),
      )
    : []

export const getHpToTrashCostCandidates = (
  cost: AbilityCost,
  battleArea: CookieInBattle[],
  sourceInstanceId?: string,
): CookieInBattle[] => {
  if (!cost.hpToTrash) return []
  return battleArea.filter((cookie) => {
    if (
      cost.hpToTrash?.sourceOnly &&
      cookie.card.instanceId !== sourceInstanceId
    ) {
      return false
    }
    if (
      cost.hpToTrash?.excludeSource &&
      cookie.card.instanceId === sourceInstanceId
    ) {
      return false
    }
    if (
      cost.hpToTrash?.energyColor &&
      cookie.card.energyColor !== cost.hpToTrash.energyColor
    ) {
      return false
    }
    if (
      cost.hpToTrash?.minLevel !== undefined &&
      (cookie.card.level ?? 0) < cost.hpToTrash.minLevel
    ) {
      return false
    }
    if (
      cost.hpToTrash?.maxLevel !== undefined &&
      (cookie.card.level ?? Number.POSITIVE_INFINITY) > cost.hpToTrash.maxLevel
    ) {
      return false
    }
    if (cookie.hpCards.length === 0) return false
    return cost.hpToTrash?.untilRemainingHp === undefined
      ? true
      : cookie.hpCards.length > cost.hpToTrash.untilRemainingHp
  })
}

export const payHpToTrashCost = (
  player: PlayerState,
  cost: AbilityCost,
  selectedIds: string[],
  sourceInstanceId?: string,
): {
  player: PlayerState
  departedCount: number
  costRecord?: GameState['costRecord']
} => {
  const uniqueIds = [...new Set(selectedIds)]
  if (uniqueIds.length !== selectedIds.length) {
    throw new GameRuleError('HP 費用不能重複選同一張餅乾。')
  }
  if (!cost.hpToTrash) {
    if (uniqueIds.length > 0) {
      throw new GameRuleError('此能力不需要支付 HP 費用。')
    }
    return { player, departedCount: 0 }
  }
  if (uniqueIds.length !== 1) {
    throw new GameRuleError('必須選擇 1 張餅乾支付 HP 費用。')
  }

  const target = getHpToTrashCostCandidates(
    cost,
    player.battleArea,
    sourceInstanceId,
  ).find((cookie) => cookie.card.instanceId === uniqueIds[0])
  if (!target) {
    throw new GameRuleError('選擇的 HP 費用餅乾不合法。')
  }

  const targetIndex = player.battleArea.findIndex(
    (cookie) => cookie.card.instanceId === target.card.instanceId,
  )
  const removeCount = Math.max(
    0,
    cost.hpToTrash.untilRemainingHp !== undefined
      ? target.hpCards.length - cost.hpToTrash.untilRemainingHp
      : (cost.hpToTrash.amount ?? 1),
  )
  if (removeCount === 0) {
    return {
      player,
      departedCount: 0,
      costRecord: {
        hpTrashCookieInstanceId: target.card.instanceId,
        hpTrashTopCardType: undefined,
      },
    }
  }

  const removedHpCards = target.hpCards.slice(-removeCount)
  const remainingHpCards = target.hpCards.slice(
    0,
    Math.max(0, target.hpCards.length - removeCount),
  )
  if (remainingHpCards.length === 0) {
    return {
      player: {
        ...player,
        battleArea: player.battleArea.filter((_, index) => index !== targetIndex),
        breakArea: [...player.breakArea, target.card],
        discardPile: [...player.discardPile, ...removedHpCards],
      },
      departedCount: 1,
      costRecord: {
        hpTrashCookieInstanceId: target.card.instanceId,
        hpTrashTopCardInstanceId:
          removedHpCards[removedHpCards.length - 1]?.instanceId,
        hpTrashTopCardType: removedHpCards[removedHpCards.length - 1]?.type,
      },
    }
  }
  return {
    player: {
      ...player,
      battleArea: player.battleArea.map((cookie, index) =>
        index === targetIndex
          ? { ...cookie, hpCards: remainingHpCards }
          : cookie,
      ),
      discardPile: [...player.discardPile, ...removedHpCards],
    },
    departedCount: 0,
    costRecord: {
      hpTrashCookieInstanceId: target.card.instanceId,
      hpTrashTopCardInstanceId:
        removedHpCards[removedHpCards.length - 1]?.instanceId,
      hpTrashTopCardType: removedHpCards[removedHpCards.length - 1]?.type,
    },
  }
}

export const payTrashBattleCookieCost = (
  player: PlayerState,
  cost: AbilityCost,
  selectedIds: string[],
  sourceInstanceId?: string,
): { player: PlayerState; departedCount: number } => {
  const effectiveIds =
    cost.trashBattleCookie?.sourceOnly && sourceInstanceId
      ? [sourceInstanceId]
      : selectedIds
  const uniqueIds = [...new Set(effectiveIds)]
  if (uniqueIds.length !== effectiveIds.length) {
    throw new GameRuleError('不能重複選擇同一張戰鬥區餅乾作為代價。')
  }

  if (!cost.trashBattleCookie) {
    if (uniqueIds.length > 0) {
      throw new GameRuleError('此效果不需要支付戰鬥區餅乾代價。')
    }
    return { player, departedCount: 0 }
  }

  if (uniqueIds.length !== cost.trashBattleCookie.count) {
    throw new GameRuleError(
      `必須選擇 ${cost.trashBattleCookie.count} 張戰鬥區餅乾作為代價。`,
    )
  }

  const candidateIds = new Set(
    getTrashBattleCookieCostCandidates(cost, player.battleArea, sourceInstanceId).map(
      (cookie) => cookie.card.instanceId,
    ),
  )
  if (uniqueIds.some((id) => !candidateIds.has(id))) {
    throw new GameRuleError('選擇的餅乾不符合代價條件。')
  }

  const selectedSet = new Set(uniqueIds)
  const trashedCookies = player.battleArea.filter((cookie) =>
    selectedSet.has(cookie.card.instanceId),
  )
  return {
    player: {
      ...player,
      battleArea: player.battleArea.filter(
        (cookie) => !selectedSet.has(cookie.card.instanceId),
      ),
      discardPile: [
        ...player.discardPile,
        ...trashedCookies.map((cookie) => cookie.card),
        ...trashedCookies.flatMap((cookie) => cookie.hpCards),
      ],
    },
    departedCount: trashedCookies.length,
  }
}

export const payTrashCookieToBreakAreaCost = (
  player: PlayerState,
  cost: AbilityCost,
  selectedIds: string[],
): PlayerState => {
  const requirement = cost.trashCookieToBreakArea
  const uniqueIds = [...new Set(selectedIds)]
  if (!requirement) {
    if (uniqueIds.length > 0) {
      throw new GameRuleError('Unexpected trash-to-break payment.')
    }
    return player
  }
  if (
    uniqueIds.length !== selectedIds.length ||
    uniqueIds.length !== requirement.count
  ) {
    throw new GameRuleError(
      `Must place exactly ${requirement.count} Cookie from trash into the break area.`,
    )
  }

  const candidateIds = new Set(
    getTrashCookieToBreakAreaCostCandidates(cost, player.discardPile).map(
      (card) => card.instanceId,
    ),
  )
  if (uniqueIds.some((id) => !candidateIds.has(id))) {
    throw new GameRuleError('Invalid Cookie selected for the alternative payment.')
  }

  const selectedSet = new Set(uniqueIds)
  const selectedCards = player.discardPile.filter(
    (card): card is CookieCard =>
      selectedSet.has(card.instanceId) && card.type === 'cookie',
  )
  return {
    ...player,
    discardPile: player.discardPile.filter(
      (card) => !selectedSet.has(card.instanceId),
    ),
    breakArea: [...player.breakArea, ...selectedCards],
  }
}

const validatePayment = (
  skill: CardSkill,
  supports: SupportCard[],
  paymentIds: string[],
) => {
  const validation = validateEnergyPayment(
    skill.cost.energy ?? skill.cost,
    supports,
    paymentIds,
  )

  if (!validation.valid) {
    throw new GameRuleError(`技能支付無效：${validation.reason}`)
  }
}

export const canActivateCookieSkill = (
  state: GameState,
  playerId: PlayerId,
  sourceInstanceId: string,
  trigger: SkillTrigger,
): boolean => {
  const player = state.players[playerId]
  const source = findSkillSource(player, sourceInstanceId)
  const skill = source?.card.skill

  if (!source || !skill || skill.trigger !== trigger) {
    return false
  }

  if (
    state.status !== 'playing' ||
    state.pendingRefresh ||
    state.pendingBattle ||
    state.pendingOpponentHandDiscard ||
    state.pendingInspectDeck ||
    state.pendingOptionalCostAttack ||
    state.pendingStageTrigger ||
    (state.pendingFaintEffects && state.pendingFaintEffects.length > 0) ||
    (state.pendingAfterDamageEffects && state.pendingAfterDamageEffects.length > 0)
  ) {
    return false
  }

  if (state.pendingReplacement && trigger !== 'on-play') {
    return false
  }

  if (
    state.pendingOnPlay
      ? trigger !== 'on-play' ||
        state.pendingOnPlay.playerId !== playerId ||
        state.pendingOnPlay.sourceInstanceId !== sourceInstanceId
      : trigger === 'on-play'
  ) {
    return false
  }

  const onPlayOrigin = state.pendingOnPlay?.origin
  if (skill.fromTrashArea && onPlayOrigin !== 'trash') {
    return false
  }
  if (skill.fromSupportArea && onPlayOrigin !== 'support') {
    return false
  }

  if (
    trigger === 'activate' &&
    (state.phase !== 'main' || state.activePlayerId !== playerId)
  ) {
    return false
  }

  if (skill.yourTurn && state.activePlayerId !== playerId) {
    return false
  }

  if (
    skill.oncePerTurn &&
    state.skillUsesThisTurn.includes(getSkillUseKey(source))
  ) {
    return false
  }

  if (
    skill.oncePerGame &&
    (state.skillUsesThisGame ?? []).includes(
      getOncePerGameKey(playerId, source.card.id),
    )
  ) {
    return false
  }

  if (skill.restSource && source.rested) {
    return false
  }

  if (
    skill.cost.selfToTrash &&
    !player.battleArea.some(
      (cookie) => cookie.card.instanceId === sourceInstanceId,
    )
  ) {
    return false
  }

  const discardHandCandidates = skill.cost.discardAllHand
    ? getDiscardAllHandCostCandidates(
        skill.cost,
        player.hand,
        sourceInstanceId,
      )
    : getDiscardHandCostCandidates(skill.cost, player.hand, sourceInstanceId)
  if (
    skill.cost.discardAllHand &&
    (player.hand.length === 0 ||
      discardHandCandidates.length !== player.hand.length)
  ) {
    return false
  }
  if (
    (skill.cost.discardHand ?? 0) > 0 &&
    discardHandCandidates.length < (skill.cost.discardHand ?? 0)
  ) {
    return false
  }

  const energyPayment = selectEnergyPayment(
    skill.cost.energy ?? skill.cost,
    player.supportArea,
  )
  if (!energyPayment) return false

  if (!canPaySupportToTrashCost(
    skill.cost,
    player.supportArea,
    new Set(energyPayment),
  )) {
    return false
  }
  const availableSupportForSecondaryCosts = player.supportArea.filter(
    (support) => !energyPayment.includes(support.card.instanceId),
  ).length
  if (
    availableSupportForSecondaryCosts <
    (skill.cost.supportToTrash ?? 0) + (skill.cost.supportToHand ?? 0)
  ) {
    return false
  }

  if (!canPayTrashToDeckBottomCost(skill.cost, player.discardPile)) {
    return false
  }

  if (!canPayTrashToDeckCost(skill.cost, player.discardPile)) {
    return false
  }

  if (!canPayTrashBattleCookieCost(skill.cost, player.battleArea, sourceInstanceId)) {
    return false
  }

  if (
    skill.cost.hpToTrash &&
    getHpToTrashCostCandidates(
      skill.cost,
      player.battleArea,
      sourceInstanceId,
    ).length === 0
  ) {
    return false
  }

  const context = { sourcePlayerId: playerId, sourceInstanceId }
  for (const effect of skill.effects) {
    if (!isEffectConditionMet(state, context, effect)) {
      if (!isSkillEffectConditionDeferredUntilCost(skill, effect)) return false
    }
    if (
      (effect.kind === 'damage-by-break-count' ||
        effect.kind === 'modify-attack-by-break-count') &&
      getBreakCount(state, playerId, effect) <= 0
    ) {
      return false
    }
    if (
      effect.kind === 'break-to-battle' &&
      getBreakToBattleCandidates(state, context, effect).length === 0
    ) {
      return false
    }
    if (
      effect.kind === 'break-to-hand-by-level-sum' &&
      getBreakToHandBySumCandidates(state, context, effect).length === 0
    ) {
      return false
    }
    if (
      effect.kind === 'support-to-hand' &&
      getEffectSelectionCandidates(state, context, effect).length <
        (effect.optional ? 0 : effect.amount)
    ) {
      return false
    }
    if (
      effect.kind === 'break-source-to-battle' &&
      player.battleArea.length >= 2
    ) {
      return false
    }
    if (isEffectTargeted(effect) && effect.target.min > 0) {
      const candidates = getEffectTargetCandidates(state, context, effect.target)
      if (candidates.length < effect.target.min) {
        return false
      }
    }
  }

  return true
}

export const activateCookieSkill = (
  state: GameState,
  playerId: PlayerId,
  sourceInstanceId: string,
  trigger: SkillTrigger,
  paymentIds: string[],
  costSupportToTrashIds: string[] = [],
  discardHandIds: string[] = [],
  trashBattleCookieIds: string[] = [],
  trashToDeckBottomIds: string[] = [],
  trashToDeckIds: string[] = [],
  shuffle: Shuffle = defaultShuffle,
  hpToTrashTargetIds: string[] = [],
  supportToHandIds: string[] = [],
): GameState => {
  if (
    !canActivateCookieSkill(state, playerId, sourceInstanceId, trigger)
  ) {
    throw new GameRuleError('目前無法發動這個餅乾技能。')
  }

  const player = state.players[playerId]
  const source = findSkillSource(player, sourceInstanceId)

  if (!source?.card.skill) {
    throw new GameRuleError('找不到要發動的餅乾技能。')
  }

  validatePayment(source.card.skill, player.supportArea, paymentIds)

  const uniqueDiscardHandIds = [...new Set(discardHandIds)]
  if (uniqueDiscardHandIds.length !== discardHandIds.length) {
    throw new GameRuleError('不能重複選擇同一張手牌作為代價。')
  }

  const cost = source.card.skill.cost
  const uniqueCostSupportToTrashIds = [...new Set(costSupportToTrashIds)]
  const uniqueCostSupportToHandIds = [...new Set(supportToHandIds)]

  if (cost.supportToTrash) {
    if (uniqueCostSupportToTrashIds.length !== cost.supportToTrash) {
      throw new GameRuleError(
        `必須選擇 ${cost.supportToTrash} 張支援卡作為技能代價。`,
      )
    }

    const trashed = player.supportArea.filter((support) =>
      uniqueCostSupportToTrashIds.includes(support.card.instanceId),
    )

    if (trashed.length !== cost.supportToTrash) {
      throw new GameRuleError('只能選擇自己的支援區卡牌作為代價。')
    }
  } else if (uniqueCostSupportToTrashIds.length > 0) {
    throw new GameRuleError('此技能不需要支付支援區卡牌代價。')
  }

  if (cost.supportToHand) {
    if (uniqueCostSupportToHandIds.length !== cost.supportToHand) {
      throw new GameRuleError(
        `必須選擇 ${cost.supportToHand} 張支援卡返回手牌。`,
      )
    }
    const returned = player.supportArea.filter((support) =>
      uniqueCostSupportToHandIds.includes(support.card.instanceId),
    )
    if (returned.length !== cost.supportToHand) {
      throw new GameRuleError('只能選擇自己的支援區卡牌返回手牌。')
    }
  } else if (uniqueCostSupportToHandIds.length > 0) {
    throw new GameRuleError('此技能不需要支付支援區回手代價。')
  }

  if (cost.discardAllHand || cost.discardHandAtLeast) {
    const discardHandCandidates = cost.discardAllHand
      ? getDiscardAllHandCostCandidates(cost, player.hand, sourceInstanceId)
      : getDiscardHandCostCandidates(cost, player.hand, sourceInstanceId)
    const discardCandidateIds = new Set(
      discardHandCandidates.map((card) => card.instanceId),
    )
    if (cost.discardAllHand) {
      if (
        player.hand.length === 0 ||
        uniqueDiscardHandIds.length !== player.hand.length
      ) {
        throw new GameRuleError('必須棄掉整手牌。')
      }
    } else if (
      uniqueDiscardHandIds.length < (cost.discardHand ?? 0)
    ) {
      throw new GameRuleError(
        `至少須棄掉 ${cost.discardHand ?? 0} 張手牌。`,
      )
    }
    if (uniqueDiscardHandIds.some((id) => !discardCandidateIds.has(id))) {
      throw new GameRuleError('手牌不符合棄牌代價條件。')
    }
  } else if ((cost.discardHand ?? 0) > 0) {
    if (uniqueDiscardHandIds.length !== (cost.discardHand ?? 0)) {
      throw new GameRuleError(
        `必須棄置 ${cost.discardHand ?? 0} 張手牌作為技能代價。`,
      )
    }
    const discardCandidateIds = new Set(
      getDiscardHandCostCandidates(cost, player.hand, sourceInstanceId).map(
        (card) => card.instanceId,
      ),
    )
    if (uniqueDiscardHandIds.some((id) => !discardCandidateIds.has(id))) {
      throw new GameRuleError('只能選擇自己的手牌作為代價。')
    }
  } else if (uniqueDiscardHandIds.length > 0) {
    throw new GameRuleError('此技能不需要棄手牌代價。')
  }

  const uniqueTrashToDeckBottomIds = [...new Set(trashToDeckBottomIds)]
  if (uniqueTrashToDeckBottomIds.length !== trashToDeckBottomIds.length) {
    throw new GameRuleError('不能重複選擇同一張棄牌區卡牌作為代價。')
  }
  if (cost.trashToDeckBottom) {
    if (uniqueTrashToDeckBottomIds.length !== cost.trashToDeckBottom.count) {
      throw new GameRuleError(
        `必須選擇 ${cost.trashToDeckBottom.count} 張棄牌區卡牌放到牌庫底作為代價。`,
      )
    }
    const candidateIds = new Set(
      getTrashToDeckBottomCostCandidates(cost, player.discardPile).map(
        (card) => card.instanceId,
      ),
    )
    if (uniqueTrashToDeckBottomIds.some((id) => !candidateIds.has(id))) {
      throw new GameRuleError('選擇的棄牌區代價不合法。')
    }
  } else if (uniqueTrashToDeckBottomIds.length > 0) {
    throw new GameRuleError('此技能不需要支付棄牌區代價。')
  }

  const uniqueTrashToDeckIds = [...new Set(trashToDeckIds)]
  if (uniqueTrashToDeckIds.length !== trashToDeckIds.length) {
    throw new GameRuleError('不能重複選擇同一張棄牌區卡牌作為代價。')
  }
  if (cost.trashToDeck) {
    if (uniqueTrashToDeckIds.length !== cost.trashToDeck.count) {
      throw new GameRuleError(
        `必須選擇 ${cost.trashToDeck.count} 張棄牌區卡牌作為代價。`,
      )
    }
    const candidateIds = new Set(
      getTrashToDeckCostCandidates(cost, player.discardPile).map(
        (card) => card.instanceId,
      ),
    )
    if (uniqueTrashToDeckIds.some((id) => !candidateIds.has(id))) {
      throw new GameRuleError('選擇的棄牌區卡牌不符合洗回牌庫代價條件。')
    }
  } else if (uniqueTrashToDeckIds.length > 0) {
    throw new GameRuleError('此技能不需要支付洗回牌庫的棄牌區代價。')
  }

  const hpToTrashPayment = payHpToTrashCost(
    player,
    cost,
    hpToTrashTargetIds,
    sourceInstanceId,
  )
  const trashBattlePayment = payTrashBattleCookieCost(
    hpToTrashPayment.player,
    cost,
    trashBattleCookieIds,
    sourceInstanceId,
  )
  const uniqueTrashBattleCookieIds = cost.trashBattleCookie?.sourceOnly
    ? [sourceInstanceId]
    : [...new Set(trashBattleCookieIds)]

  let selfToBreakDepartedCount = 0
  let playerAfterCosts = trashBattlePayment.player
  if (cost.selfToBreakArea) {
    const stillInBattle = playerAfterCosts.battleArea.find(
      (cookie) => cookie.card.instanceId === sourceInstanceId,
    )
    if (stillInBattle) {
      playerAfterCosts = {
        ...playerAfterCosts,
        battleArea: playerAfterCosts.battleArea.filter(
          (cookie) => cookie.card.instanceId !== sourceInstanceId,
        ),
        breakArea: [...playerAfterCosts.breakArea, stillInBattle.card],
        discardPile: [
          ...playerAfterCosts.discardPile,
          ...stillInBattle.hpCards,
        ],
      }
      selfToBreakDepartedCount = 1
    }
  }

  let selfToDeckBottomDepartedCount = 0
  if (cost.selfToDeckBottom) {
    const stillInBattle = playerAfterCosts.battleArea.find(
      (cookie) => cookie.card.instanceId === sourceInstanceId,
    )
    if (stillInBattle) {
      playerAfterCosts = {
        ...playerAfterCosts,
        battleArea: playerAfterCosts.battleArea.filter(
          (cookie) => cookie.card.instanceId !== sourceInstanceId,
        ),
        deck: [...playerAfterCosts.deck, stillInBattle.card],
        discardPile: [
          ...playerAfterCosts.discardPile,
          ...stillInBattle.hpCards,
        ],
      }
      selfToDeckBottomDepartedCount = 1
    }
  }

  if (cost.selfToTrash) {
    const stillInBattle = playerAfterCosts.battleArea.find(
      (cookie) => cookie.card.instanceId === sourceInstanceId,
    )
    if (stillInBattle) {
      playerAfterCosts = {
        ...playerAfterCosts,
        battleArea: playerAfterCosts.battleArea.filter(
          (cookie) => cookie.card.instanceId !== sourceInstanceId,
        ),
        discardPile: [
          ...playerAfterCosts.discardPile,
          stillInBattle.card,
          ...stillInBattle.hpCards,
        ],
      }
    }
  }

  const paymentSet = new Set(paymentIds)
  const costSupportSet = new Set(uniqueCostSupportToTrashIds)
  const supportToHandSet = new Set(uniqueCostSupportToHandIds)
  const trashBattleSet = new Set(uniqueTrashBattleCookieIds)

  if (
    paymentIds.some(
      (id) =>
        costSupportSet.has(id) ||
        supportToHandSet.has(id) ||
        trashBattleSet.has(id),
    ) ||
    uniqueCostSupportToTrashIds.some((id) => paymentSet.has(id)) ||
    uniqueCostSupportToHandIds.some(
      (id) => paymentSet.has(id) || costSupportSet.has(id),
    ) ||
    uniqueTrashBattleCookieIds.some(
      (id) =>
        paymentSet.has(id) ||
        costSupportSet.has(id) ||
        supportToHandSet.has(id),
    )
  ) {
    throw new GameRuleError('同一張卡不能同時支付兩種費用。')
  }

  const trashedCards = player.supportArea.filter((support) =>
    costSupportSet.has(support.card.instanceId),
  )
  const returnedSupportCards = player.supportArea.filter((support) =>
    supportToHandSet.has(support.card.instanceId),
  )

  // uniqueTrashToDeckBottomIds 的順序就是玩家決定的牌庫底順序。
  const trashToDeckBottomSet = new Set(uniqueTrashToDeckBottomIds)
  const trashToDeckBottomCards = uniqueTrashToDeckBottomIds.flatMap((id) => {
    const card = playerAfterCosts.discardPile.find(
      (candidate) => candidate.instanceId === id,
    )
    return card ? [card] : []
  })
  const trashToDeckSet = new Set(uniqueTrashToDeckIds)
  const trashToDeckCards = uniqueTrashToDeckIds.flatMap((id) => {
    const card = playerAfterCosts.discardPile.find(
      (candidate) => candidate.instanceId === id,
    )
    return card ? [card] : []
  })

  const discardedCards = player.hand.filter((card) =>
    uniqueDiscardHandIds.includes(card.instanceId),
  )

  const activatedState: GameState = {
    ...state,
    ...(hpToTrashPayment.costRecord
      ? { costRecord: hpToTrashPayment.costRecord }
      : {}),
    pendingOnPlay: trigger === 'on-play' ? null : state.pendingOnPlay,
    players: {
      ...state.players,
      [playerId]: {
        ...playerAfterCosts,
        battleArea: playerAfterCosts.battleArea
          .map((cookie) =>
            cookie.card.instanceId === sourceInstanceId &&
            source.card.skill?.restSource
              ? { ...cookie, rested: true }
              : cookie,
          ),
        supportArea: playerAfterCosts.supportArea
          .filter(
            (support) =>
              !costSupportSet.has(support.card.instanceId) &&
              !supportToHandSet.has(support.card.instanceId),
          )
          .map((support) =>
            paymentSet.has(support.card.instanceId)
              ? { ...support, rested: true }
              : support,
        ),
        hand: [
          ...player.hand.filter(
            (card) => !uniqueDiscardHandIds.includes(card.instanceId),
          ),
          ...returnedSupportCards.map((support) => support.card),
        ],
        deck: cost.trashToDeck
          ? shuffle([...playerAfterCosts.deck, ...trashToDeckCards])
          : [...playerAfterCosts.deck, ...trashToDeckBottomCards],
        discardPile: [
          ...playerAfterCosts.discardPile.filter(
            (card) =>
              !trashToDeckBottomSet.has(card.instanceId) &&
              !trashToDeckSet.has(card.instanceId),
          ),
          ...trashedCards.map((support) => support.card),
          ...discardedCards,
        ],
      },
    },
    skillUsesThisTurn: source.card.skill.oncePerTurn
      ? [...state.skillUsesThisTurn, getSkillUseKey(source)]
      : state.skillUsesThisTurn,
    skillUsesThisGame: source.card.skill.oncePerGame
      ? [
          ...(state.skillUsesThisGame ?? []),
          getOncePerGameKey(playerId, source.card.id),
        ]
      : state.skillUsesThisGame,
  }

  const totalDepartedCount =
    hpToTrashPayment.departedCount +
    trashBattlePayment.departedCount +
    selfToBreakDepartedCount +
    selfToDeckBottomDepartedCount

  return totalDepartedCount > 0
    ? recordCookieDepartures(
        clearDepartedCookieModifiers(activatedState),
        playerId,
        totalDepartedCount,
      )
    : activatedState
}

export const skipCookieOnPlay = (
  state: GameState,
  playerId: PlayerId,
  sourceInstanceId: string,
): GameState => {
  if (
    state.pendingOnPlay?.playerId !== playerId ||
    state.pendingOnPlay.sourceInstanceId !== sourceInstanceId
  ) {
    throw new GameRuleError('目前沒有可略過的登場效果。')
  }

  return continuePendingReplacements({
    ...state,
    pendingOnPlay: null,
  })
}
