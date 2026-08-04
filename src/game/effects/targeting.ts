import { GameRuleError } from '../errors'
import { getOpponentId } from '../helpers'
import type {
  BreakToTrashEffect,
  CardEffect,
  CookieCard,
  CookieInBattle,
  DeckToSupportEffect,
  DrawEffect,
  EffectContext,
  EffectTargetSelector,
  EnergyColor,
  GameCard,
  GameState,
  GainHpEffect,
  PlayerId,
  OpponentBattleToTrashEffect,
  TargetedCardEffect,
} from '../types'
import { getBreakAreaLevel } from '../victory'

export const getBreakCount = (
  state: GameState,
  playerId: PlayerId,
  options: {
    minBreakLevel?: number
    exactBreakLevel?: number
    breakEnergyColor?: CookieCard['energyColor']
  },
): number =>
  state.players[playerId].breakArea.filter((card) => {
    if (
      options.exactBreakLevel !== undefined &&
      card.level !== options.exactBreakLevel
    ) {
      return false
    }
    if (
      options.minBreakLevel !== undefined &&
      card.level < options.minBreakLevel
    ) {
      return false
    }
    if (
      options.breakEnergyColor !== undefined &&
      card.energyColor !== options.breakEnergyColor
    ) {
      return false
    }
    return true
  }).length

/** 回傳戰鬥區中持有該餅乾的玩家；不在任何戰鬥區時回傳 null。 */
export const getCookieOwnerId = (
  state: GameState,
  instanceId: string,
): PlayerId | null =>
  (['player-one', 'player-two'] as PlayerId[]).find((playerId) =>
    state.players[playerId].battleArea.some(
      (cookie) => cookie.card.instanceId === instanceId,
    ),
  ) ?? null

export const getTargetPlayerId = (
  context: EffectContext,
  selector: EffectTargetSelector,
): PlayerId => {
  if (selector.side === 'either') {
    // 跨雙方的目標沒有單一擁有者，呼叫端必須改用 getCookieOwnerId 逐一判定。
    throw new GameRuleError(
      'either 目標必須逐一判定擁有者，不能取得單一目標玩家。',
    )
  }

  return selector.side === 'self'
    ? context.sourcePlayerId
    : getOpponentId(context.sourcePlayerId)
}

/** BS3-115 裝載後：該餅乾不能被對手效果選為目標，也不能被對手效果送入棄牌區。 */
export const isProtectedBySoulJamResolution = (
  cookie: CookieInBattle,
): boolean => cookie.equippedCards?.some((card) => card.id === 'BS3-115') ?? false

/**
 * 對手效果是否被 BS3-115 擋下。
 * 例外：攻擊附加效果若以 `attackTargetOnly` 保持同一攻擊對象（未重新選擇），
 * 官方裁定仍可對該餅乾造成附加傷害。
 */
export const isBlockedByOpponentEffectProtection = (
  cookie: CookieInBattle,
  ownerId: PlayerId,
  sourcePlayerId: PlayerId,
  options: {
    attackTargetOnly?: boolean
    attackTargetInstanceId?: string | null
  } = {},
): boolean => {
  if (ownerId === sourcePlayerId) return false
  if (!isProtectedBySoulJamResolution(cookie)) return false
  if (
    options.attackTargetOnly &&
    options.attackTargetInstanceId !== undefined &&
    options.attackTargetInstanceId !== null &&
    cookie.card.instanceId === options.attackTargetInstanceId
  ) {
    return false
  }
  return true
}

const matchesSelector = (
  cookie: CookieInBattle,
  selector: EffectTargetSelector,
  context: EffectContext,
  state: GameState,
  ownerId: PlayerId,
): boolean => {
  if (
    isBlockedByOpponentEffectProtection(cookie, ownerId, context.sourcePlayerId, {
      attackTargetOnly: selector.attackTargetOnly,
      attackTargetInstanceId: state.pendingBattle?.targetInstanceId,
    })
  ) {
    return false
  }
  if (
    selector.sourceOnly &&
    cookie.card.instanceId !== context.sourceInstanceId
  ) {
    return false
  }

  if (
    selector.attackTargetOnly &&
    cookie.card.instanceId !== state.pendingBattle?.targetInstanceId
  ) {
    return false
  }

  if (
    selector.excludeAttackTarget &&
    cookie.card.instanceId === state.pendingBattle?.targetInstanceId
  ) {
    return false
  }

  if (
    selector.excludeSource &&
    cookie.card.instanceId === context.sourceInstanceId
  ) {
    return false
  }

  if (
    selector.remainingHp !== undefined &&
    cookie.hpCards.length > selector.remainingHp
  ) {
    return false
  }

  if (
    selector.minRemainingHp !== undefined &&
    cookie.hpCards.length < selector.minRemainingHp
  ) {
    return false
  }

  if (
    selector.energyColor !== undefined &&
    cookie.card.energyColor !== selector.energyColor
  ) {
    return false
  }

  if (
    selector.keyword !== undefined &&
    !cookie.card.keywords?.includes(selector.keyword)
  ) {
    return false
  }

  if (selector.restedOnly && !cookie.rested) {
    return false
  }

  return (
    (selector.minLevel === undefined ||
      cookie.card.level >= selector.minLevel) &&
    (selector.maxLevel === undefined ||
      cookie.card.level <= selector.maxLevel)
  )
}

export const getEffectTargetCandidates = (
  state: GameState,
  context: EffectContext,
  selector: EffectTargetSelector,
): CookieInBattle[] => {
  const candidatesOf = (playerId: PlayerId) =>
    state.players[playerId].battleArea.filter((cookie) =>
      matchesSelector(cookie, selector, context, state, playerId),
    )

  if (selector.side === 'either') {
    return [
      ...candidatesOf(context.sourcePlayerId),
      ...candidatesOf(getOpponentId(context.sourcePlayerId)),
    ]
  }

  return candidatesOf(getTargetPlayerId(context, selector))
}

/**
 * 回傳沒有標準 `target` selector 的卡牌效果之合法目標。
 *
 * `opponent-battle-to-trash` 使用效果本身的等級／剩餘 HP 條件，
 * 但在 UI、攻擊後續效果與規則驗證中仍必須和一般目標效果共用同一份候選。
 */
export const getEffectTargetCandidatesForEffect = (
  state: GameState,
  context: EffectContext,
  effect: CardEffect,
): CookieInBattle[] => {
  if (effect.kind === 'opponent-battle-to-trash') {
    const targetPlayerId = getOpponentId(context.sourcePlayerId)
    const targetPlayer = state.players[targetPlayerId]
    const bttEffect: OpponentBattleToTrashEffect = effect
    return targetPlayer.battleArea.filter((cookie) => {
      if (
        isBlockedByOpponentEffectProtection(
          cookie,
          targetPlayerId,
          context.sourcePlayerId,
        )
      ) {
        return false
      }
      if (
        bttEffect.maxLevel !== undefined &&
        cookie.card.level > bttEffect.maxLevel
      ) {
        return false
      }
      if (
        bttEffect.minLevel !== undefined &&
        cookie.card.level < bttEffect.minLevel
      ) {
        return false
      }
      if (
        bttEffect.remainingHp !== undefined &&
        cookie.hpCards.length > bttEffect.remainingHp
      ) {
        return false
      }
      return true
    })
  }

  if (effect.kind === 'gain-hp' && effect.target && !effect.target.sourceOnly) {
    return getEffectTargetCandidates(state, context, effect.target)
  }

  if (effect.kind === 'equip-source') {
    return getEffectTargetCandidates(state, context, effect.target).filter(
      (cookie) => cookie.card.id === effect.requiredCookieId,
    )
  }

  if (!isEffectTargeted(effect)) return []
  return getEffectTargetCandidates(state, context, effect.target)
}

export const selectEffectTargets = (
  state: GameState,
  context: EffectContext,
  selector: EffectTargetSelector,
  selectedTargetIds: string[],
): CookieInBattle[] => {
  const uniqueIds = [...new Set(selectedTargetIds)]

  if (
    uniqueIds.length !== selectedTargetIds.length ||
    uniqueIds.length < selector.min ||
    uniqueIds.length > selector.max
  ) {
    throw new GameRuleError('選擇的效果目標數量不合法。')
  }

  const candidates = getEffectTargetCandidates(state, context, selector)
  const selectedTargets = uniqueIds.map((instanceId) =>
    candidates.find((cookie) => cookie.card.instanceId === instanceId),
  )

  if (selectedTargets.some((target) => !target)) {
    throw new GameRuleError('選擇的卡牌不是此效果的合法目標。')
  }

  return selectedTargets as CookieInBattle[]
}

export const isEffectUntargeted = (
  effect: CardEffect,
): effect is
  | DrawEffect
  | DeckToSupportEffect
  | Extract<CardEffect, { kind: 'deck-to-trash' }>
  | Extract<CardEffect, {
      kind: 'gain-hp' | 'damage-all' | 'modify-all-attack' | 'multiply-attack-damage' | 'place-source-to-support' | 'discard-hand' | 'discard-hand-all' | 'opponent-discard-hand' | 'opponent-random-discard' | 'hand-to-deck-and-draw' | 'draw-up-to' | 'draw-until-hand-equals-opponent' | 'set-active' | 'field-to-trash-all' | 'field-to-deck-bottom-all' | 'break-to-battle' | 'support-to-battle' | 'break-to-hand-by-level-sum' | 'hand-to-break-by-level-sum' | 'reveal-top-deck' | 'hand-to-break' | 'break-to-hand' | 'draw-up-to-battle-cookie-count' | 'trash-to-deck-all' | 'reveal-bottom-deck' | 'choose-one' | 'break-source-to-battle' | 'stage-source-to-deck' | 'flip-to-break'
    }> =>
  effect.kind === 'draw' ||
  effect.kind === 'deck-to-support' ||
  effect.kind === 'deck-to-trash' ||
  effect.kind === 'gain-hp' ||
  (effect.kind === 'damage-all' && !effect.sequential) ||
  effect.kind === 'modify-all-attack' ||
  effect.kind === 'multiply-attack-damage' ||
  effect.kind === 'place-source-to-support' ||
  effect.kind === 'discard-hand' ||
  effect.kind === 'discard-hand-all' ||
  effect.kind === 'opponent-discard-hand' ||
  effect.kind === 'opponent-random-discard' ||
  effect.kind === 'hand-to-deck-and-draw' ||
  effect.kind === 'disable-block' ||
  effect.kind === 'draw-up-to' ||
  effect.kind === 'draw-until-hand-equals-opponent' ||
  effect.kind === 'set-active' ||
  effect.kind === 'field-to-trash-all' ||
  effect.kind === 'field-to-deck-bottom-all' ||
  effect.kind === 'break-to-battle' ||
  effect.kind === 'support-to-battle' ||
  effect.kind === 'break-to-hand-by-level-sum' ||
  effect.kind === 'hand-to-break-by-level-sum' ||
  effect.kind === 'reveal-top-deck' ||
  effect.kind === 'hand-to-break' ||
  effect.kind === 'break-to-hand' ||
  effect.kind === 'draw-up-to-battle-cookie-count' ||
  effect.kind === 'trash-to-deck-all' ||
  effect.kind === 'reveal-bottom-deck' ||
  effect.kind === 'choose-one' ||
  effect.kind === 'break-source-to-battle' ||
  effect.kind === 'stage-source-to-deck'
  || effect.kind === 'flip-to-break'

type TargetSelectableGainHpEffect = GainHpEffect & {
  target: NonNullable<GainHpEffect['target']>
}

/** Effects that require a target-selection step, including optional (`min: 0`) selections. */
export const requiresTargetSelection = (
  effect: CardEffect,
): effect is
  | TargetedCardEffect
  | OpponentBattleToTrashEffect
  | TargetSelectableGainHpEffect
  | Extract<CardEffect, { kind: 'damage-all' }> =>
  (effect.kind === 'damage-all' && effect.sequential) ||
  isEffectTargeted(effect) ||
  effect.kind === 'opponent-battle-to-trash' ||
  (effect.kind === 'gain-hp' &&
    effect.target !== undefined &&
    !effect.target.sourceOnly)

/**
 * Cards selected from a non-battle zone use the same pending target channel as
 * battle targets. Keep the source of truth here so attack follow-ups, the UI,
 * and AI cannot disagree about legal selections.
 */
export const requiresEffectCardSelection = (effect: CardEffect): boolean =>
  requiresTargetSelection(effect) ||
  effect.kind === 'break-to-battle' ||
  effect.kind === 'support-to-battle' ||
  effect.kind === 'trash-to-battle' ||
  effect.kind === 'support-to-trash' ||
  effect.kind === 'hand-to-break' ||
  effect.kind === 'hand-to-break-by-level-sum' ||
  effect.kind === 'break-to-hand' ||
  effect.kind === 'rest-support' ||
  effect.kind === 'hand-to-battle' ||
  effect.kind === 'opponent-trash-to-break' ||
  effect.kind === 'trash-to-break' ||
  effect.kind === 'trash-to-deck' ||
  (effect.kind === 'set-active' && Boolean(effect.selectable))

export const getEffectSelectionLimits = (
  effect: CardEffect,
): { min: number; max: number } | null => {
  if (effect.kind === 'damage-all' && effect.sequential) {
    return effect.target ?? null
  }
  if (effect.kind === 'break-to-battle' || effect.kind === 'support-to-battle') {
    return { min: 0, max: effect.amount }
  }
  if (effect.kind === 'trash-to-battle') {
    return { min: effect.amount, max: effect.amount }
  }
  if (effect.kind === 'trash-to-deck') {
    return { min: 0, max: effect.max }
  }
  if (effect.kind === 'support-to-trash') {
    return { min: effect.optional ? 0 : effect.amount, max: effect.amount }
  }
  if (effect.kind === 'hand-to-break' || effect.kind === 'break-to-hand') {
    return { min: effect.optional ? 0 : effect.amount, max: effect.amount }
  }
  if (effect.kind === 'hand-to-hp' || effect.kind === 'support-to-hp') {
    if (effect.selectTarget) return { min: effect.optional ? 0 : 1, max: 2 }
    return { min: effect.optional ? 0 : 1, max: 1 }
  }
  if (effect.kind === 'cycle-hp') {
    return { min: 0, max: 2 }
  }
  if (effect.kind === 'rest-support') {
    return { min: effect.optional ? 0 : effect.amount, max: effect.amount }
  }
  if (effect.kind === 'rest-support-and-damage') {
    return { min: 0, max: effect.supportAmount + effect.target.max }
  }
  if (effect.kind === 'set-active' && effect.selectable) {
    return { min: 0, max: effect.supportCount }
  }
  if (effect.kind === 'hand-to-battle') {
    return { min: effect.optional ? 0 : effect.amount, max: effect.amount }
  }
  if (effect.kind === 'opponent-trash-to-break') {
    return { min: 0, max: effect.max }
  }
  if (effect.kind === 'trash-to-break') {
    return { min: effect.amount, max: effect.amount }
  }
  if (effect.kind === 'opponent-battle-to-trash') {
    return { min: effect.min ?? 1, max: 1 }
  }
  if (effect.kind === 'gain-hp' && effect.target && !effect.target.sourceOnly) {
    return effect.target
  }
  return isEffectTargeted(effect) ? effect.target : null
}

export const getHandToBattleCandidates = (
  state: GameState,
  context: EffectContext,
  effect: Extract<CardEffect, { kind: 'hand-to-battle' }>,
): GameCard[] =>
  state.players[context.sourcePlayerId].hand.filter(
    (card) =>
      card.type === 'cookie' &&
      (effect.energyColor === undefined ||
        card.energyColor === effect.energyColor) &&
      (effect.minLevel === undefined || card.level >= effect.minLevel) &&
      (effect.maxLevel === undefined || card.level <= effect.maxLevel),
  )

export const getOpponentTrashToBreakCandidates = (
  state: GameState,
  context: EffectContext,
  effect: Extract<CardEffect, { kind: 'opponent-trash-to-break' }>,
): GameCard[] =>
  state.players[getOpponentId(context.sourcePlayerId)].discardPile.filter(
    (card) =>
      card.type === 'cookie' &&
      (effect.exactLevel === undefined || card.level === effect.exactLevel) &&
      (effect.maxLevel === undefined || card.level <= effect.maxLevel),
  )

export const getEffectSelectionCandidates = (
  state: GameState,
  context: EffectContext,
  effect: CardEffect,
): GameCard[] => {
  if (effect.kind === 'break-to-battle') {
    return getBreakToBattleCandidates(state, context, effect)
  }
  if (effect.kind === 'support-to-battle') {
    return getSupportToBattleCandidates(state, context, effect)
  }
  if (effect.kind === 'trash-to-battle') {
    return getTrashCookieCandidates(state, context, effect)
  }
  if (effect.kind === 'support-to-trash') {
    return getSupportEffectCandidates(state, context, {
      side: effect.side,
      activeOnly: effect.activeOnly,
    }).map((support) => support.card)
  }
  if (effect.kind === 'trash-to-deck') {
    return getTrashToDeckCandidates(state, context, effect)
  }
  if (effect.kind === 'hand-to-break') {
    return state.players[context.sourcePlayerId].hand.filter(
      (card) =>
        card.type === 'cookie' &&
        !effect.nonCookieOnly &&
        (effect.energyColor === undefined ||
          card.energyColor === effect.energyColor) &&
        (effect.minLevel === undefined || card.level >= effect.minLevel) &&
        (effect.maxLevel === undefined || card.level <= effect.maxLevel),
    )
  }
  if (effect.kind === 'break-to-hand') {
    return state.players[context.sourcePlayerId].breakArea.filter(
      (card) =>
        (effect.energyColor === undefined ||
          card.energyColor === effect.energyColor) &&
        (effect.minLevel === undefined || card.level >= effect.minLevel) &&
        (effect.maxLevel === undefined || card.level <= effect.maxLevel),
    )
  }
  if (effect.kind === 'hand-to-hp') {
    if (!effect.selectTarget) {
      return state.players[context.sourcePlayerId].hand.filter(
        (card) =>
          effect.energyColor === undefined || card.energyColor === effect.energyColor,
      )
    }
    return [
      ...getEffectTargetCandidates(state, context, effect.target).map(
        (cookie) => cookie.card,
      ),
      ...state.players[context.sourcePlayerId].hand.filter(
        (card) =>
          effect.energyColor === undefined || card.energyColor === effect.energyColor,
      ),
    ]
  }
  if (effect.kind === 'rest-support') {
    return getSupportEffectCandidates(state, context, {
      side: effect.side,
      activeOnly: effect.activeOnly,
    }).flatMap((support) =>
      effect.energyColor === undefined ||
      support.card.energyColor === effect.energyColor
        ? [support.card]
        : [],
    )
  }
  if (effect.kind === 'rest-support-and-damage') {
    const supports = getSupportEffectCandidates(state, context, {
      side: effect.supportSide,
      activeOnly: effect.activeOnly,
    }).flatMap((support) =>
      effect.supportEnergyColor === undefined ||
      support.card.energyColor === effect.supportEnergyColor
        ? [support.card]
        : [],
    )
    return [
      ...supports,
      ...getEffectTargetCandidates(state, context, effect.target).map(
        (cookie) => cookie.card,
      ),
    ]
  }
  if (effect.kind === 'support-to-hp') {
    const supportCandidates = getSupportEffectCandidates(state, context).flatMap((support) =>
      effect.energyColor === undefined ||
      support.card.energyColor === effect.energyColor
        ? [support.card]
        : [],
    )
    if (!effect.selectTarget) return supportCandidates
    return [
      ...supportCandidates,
      ...getEffectTargetCandidates(state, context, effect.target).map(
        (cookie) => cookie.card,
      ),
    ]
  }
  if (effect.kind === 'cycle-hp') {
    return [
      ...getEffectTargetCandidates(state, context, effect.target).map(
        (cookie) => cookie.card,
      ),
      ...state.players[context.sourcePlayerId].hand,
    ]
  }
  if (effect.kind === 'field-to-deck-bottom') {
    const battleOwnerId =
      effect.battleSide === undefined
        ? undefined
        : effect.battleSide === 'self'
          ? context.sourcePlayerId
          : getOpponentId(context.sourcePlayerId)
    const battleCards = getEffectTargetCandidates(state, context, effect.target)
      .filter(
        (cookie) =>
          battleOwnerId === undefined ||
          getCookieOwnerId(state, cookie.card.instanceId) === battleOwnerId,
      )
      .map((cookie) => cookie.card)
    if (!effect.allowStage) return battleCards
    const stageCards: GameCard[] = []
    const ownerIds: PlayerId[] =
      effect.target.side === 'either'
        ? ['player-one', 'player-two']
        : [getTargetPlayerId(context, effect.target)]
    for (const ownerId of ownerIds) {
      const stage = state.players[ownerId].stage
      if (stage) stageCards.push(stage.card)
    }
    return [...battleCards, ...stageCards]
  }
  if (effect.kind === 'set-active' && effect.selectable) {
    return getSupportEffectCandidates(state, context, { activeOnly: false })
      .filter((support) => support.rested)
      .map((support) => support.card)
  }
  if (effect.kind === 'hand-to-battle') {
    return getHandToBattleCandidates(state, context, effect)
  }
  if (effect.kind === 'opponent-trash-to-break') {
    return getOpponentTrashToBreakCandidates(state, context, effect)
  }
  if (effect.kind === 'trash-to-break') {
    return getTrashToBreakCandidates(state, context, effect)
  }
  return getEffectTargetCandidatesForEffect(state, context, effect).map(
    (cookie) => cookie.card,
  )
}

export const hasRequiredEffectTargets = (
  state: GameState,
  context: EffectContext,
  effect: CardEffect,
): boolean => {
  // reveal-top-deck 本身沒有 target 欄位（`requiresTargetSelection` 因此
  // 一律放行），但巢狀 effects 常常有——例如 BS3-076「攻擊後可選付費翻牌，
  // 翻到符合條件就對被攻擊的餅乾追加傷害」，巢狀的 damage 效果鎖定
  // `attackTargetOnly`。如果攻擊本身已經把目標打到昏厥離場，這個巢狀效果
  // 不管翻到什麼都不可能有合法目標，整張 reveal-top-deck 形同無效，不該
  // 被判定為「可以套用」。這裡遞迴檢查巢狀效果，跟 resolve-reveal-top-deck
  // 翻牌後篩選 applicableEffects 用的同一組判斷（isEffectConditionMet +
  // hasRequiredEffectTargets）一致，只是提前到「決定要不要開放付費」這一步。
  if (effect.kind === 'reveal-top-deck') {
    return effect.effects.some(
      (nested) =>
        isEffectConditionMet(state, context, nested) &&
        hasRequiredEffectTargets(state, context, nested),
    )
  }
  if (effect.kind === 'field-to-deck-bottom') {
    return (
      getEffectSelectionCandidates(state, context, effect).length >=
      effect.target.min
    )
  }
  if (effect.kind === 'damage-all' && effect.sequential) {
    return Boolean(
      effect.target &&
        getEffectTargetCandidates(state, context, effect.target).length >=
          effect.target.min,
    )
  }
  if (!requiresTargetSelection(effect)) return true
  const candidates = getEffectTargetCandidatesForEffect(state, context, effect)
  const min =
    effect.kind === 'opponent-battle-to-trash'
      ? effect.min ?? 1
      : effect.target?.min ?? Number.POSITIVE_INFINITY
  return candidates.length >= min
}

export const isEffectTargeted = (
  effect: CardEffect,
): effect is TargetedCardEffect =>
  effect.kind === 'damage' ||
  effect.kind === 'damage-by-break-count' ||
  effect.kind === 'damage-by-break-level-difference' ||
  effect.kind === 'modify-attack-by-break-count' ||
  effect.kind === 'modify-attack' ||
  effect.kind === 'modify-attack-cost' ||
  effect.kind === 'modify-damage-received' ||
  effect.kind === 'prevent-knockout' ||
  effect.kind === 'disable-flip' ||
  effect.kind === 'view-hp' ||
  effect.kind === 'battle-to-support' ||
  effect.kind === 'return-to-hand' ||
  effect.kind === 'return-to-deck-bottom' ||
  effect.kind === 'field-to-trash' ||
  effect.kind === 'redirect-attack' ||
  effect.kind === 'hp-to-trash' ||
  effect.kind === 'disable-attack' ||
  effect.kind === 'hp-to-support' ||
  effect.kind === 'hp-to-hand' ||
  effect.kind === 'hand-to-hp' ||
  effect.kind === 'support-to-hp' ||
  effect.kind === 'cycle-hp' ||
  effect.kind === 'rest-support-and-damage' ||
  effect.kind === 'field-to-deck-bottom' ||
  effect.kind === 'battle-to-deck-top' ||
  effect.kind === 'equip-source' ||
  effect.kind === 'battle-to-break' ||
  effect.kind === 'split-damage' ||
  effect.kind === 'prevent-effect-damage' ||
  effect.kind === 'transfer-hp' ||
  effect.kind === 'set-cookie-active'

export const getSupportEffectCandidates = (
  state: GameState,
  context: EffectContext,
  options: {
    side?: 'self' | 'opponent'
    activeOnly?: boolean
  } = {},
) => {
  const playerId =
    options.side === 'opponent'
      ? getOpponentId(context.sourcePlayerId)
      : context.sourcePlayerId
  return state.players[playerId].supportArea.filter(
    (support) => !options.activeOnly || !support.rested,
  )
}

export const getTrashCookieCandidates = (
  state: GameState,
  context: EffectContext,
  effect?: Extract<CardEffect, { kind: 'trash-to-battle' }>,
): CookieCard[] =>
  state.players[context.sourcePlayerId].discardPile.filter(
    (card): card is CookieCard =>
      card.type === 'cookie' &&
      (effect?.energyColor === undefined || card.energyColor === effect.energyColor) &&
      state.players[context.sourcePlayerId].battleArea.length < 2,
  )

export const getTrashToSupportCandidates = (
  state: GameState,
  context: EffectContext,
): CookieCard[] =>
  state.players[context.sourcePlayerId].discardPile.filter(
    (card): card is CookieCard => card.type === 'cookie',
  )

export const getBreakToTrashCandidates = (
  state: GameState,
  context: EffectContext,
  effect: BreakToTrashEffect,
): CookieCard[] =>
  state.players[context.sourcePlayerId].breakArea.filter((card) => {
    if (effect.energyColor !== undefined && card.energyColor !== effect.energyColor) {
      return false
    }
    if (effect.exactLevel !== undefined && card.level !== effect.exactLevel) {
      return false
    }
    if (effect.maxLevel !== undefined && card.level > effect.maxLevel) {
      return false
    }
    return true
  })

export const getTrashToBreakCandidates = (
  state: GameState,
  context: EffectContext,
  effect: Extract<CardEffect, { kind: 'trash-to-break' }>,
): CookieCard[] =>
  state.players[context.sourcePlayerId].discardPile.filter(
    (card): card is CookieCard =>
      card.type === 'cookie' &&
      (effect.energyColor === undefined || card.energyColor === effect.energyColor) &&
      (effect.exactLevel === undefined || card.level === effect.exactLevel) &&
      (effect.maxLevel === undefined || card.level <= effect.maxLevel),
  )

export const getTrashToHandCandidates = (
  state: GameState,
  context: EffectContext,
  effect: { energyColor?: EnergyColor; cookieOnly?: boolean },
): GameCard[] =>
  state.players[context.sourcePlayerId].discardPile.filter(
    (card) =>
      (effect.energyColor === undefined ||
        card.energyColor === effect.energyColor) &&
      (!effect.cookieOnly || card.type === 'cookie'),
  )

export const getTrashToDeckCandidates = (
  state: GameState,
  context: EffectContext,
  effect: { excludeFlip?: boolean },
): GameCard[] =>
  state.players[context.sourcePlayerId].discardPile.filter(
    (card) => !effect.excludeFlip || !card.flip,
  )

export const getBreakToBattleCandidates = (
  state: GameState,
  context: EffectContext,
  effect: { exactLevel?: number; maxLevel?: number; energyColor?: EnergyColor },
): CookieCard[] => {
  if (state.players[context.sourcePlayerId].battleArea.length >= 2) {
    return []
  }
  return state.players[context.sourcePlayerId].breakArea.filter((card) => {
    if (effect.exactLevel !== undefined && card.level !== effect.exactLevel) {
      return false
    }
    if (effect.maxLevel !== undefined && card.level > effect.maxLevel) {
      return false
    }
    if (
      effect.energyColor !== undefined &&
      card.energyColor !== effect.energyColor
    ) {
      return false
    }
    return true
  })
}

export const getSupportToBattleCandidates = (
  state: GameState,
  context: EffectContext,
  effect: { exactLevel?: number; maxLevel?: number; energyColor?: EnergyColor },
): CookieCard[] => {
  if (state.players[context.sourcePlayerId].battleArea.length >= 2) {
    return []
  }
  return state.players[context.sourcePlayerId].supportArea
    .map((support) => support.card)
    .filter((card): card is CookieCard => {
      if (card.type !== 'cookie') return false
      if (effect.exactLevel !== undefined && card.level !== effect.exactLevel) {
        return false
      }
      if (effect.maxLevel !== undefined && card.level > effect.maxLevel) {
        return false
      }
      if (
        effect.energyColor !== undefined &&
        card.energyColor !== effect.energyColor
      ) {
        return false
      }
      return true
    })
}

export const getBreakToHandBySumCandidates = (
  state: GameState,
  context: EffectContext,
  effect: { energyColor?: EnergyColor },
): CookieCard[] =>
  state.players[context.sourcePlayerId].breakArea.filter(
    (card) =>
      effect.energyColor === undefined ||
      card.energyColor === effect.energyColor,
  )

export const getHandToBreakBySumCandidates = (
  state: GameState,
  context: EffectContext,
  effect: { energyColor?: EnergyColor },
): GameCard[] =>
  state.players[context.sourcePlayerId].hand.filter(
    (card) =>
      card.type === 'cookie' &&
      (effect.energyColor === undefined ||
        card.energyColor === effect.energyColor),
  )

export const validateBreakToTrashTargets = (
  state: GameState,
  context: EffectContext,
  effect: BreakToTrashEffect,
  selectedTargetIds: string[],
) => {
  const uniqueIds = [...new Set(selectedTargetIds)]

  if (uniqueIds.length !== selectedTargetIds.length) {
    throw new GameRuleError('選擇的效果目標數量不合法。')
  }

  if (uniqueIds.length > effect.max) {
    throw new GameRuleError('選擇的效果目標數量不合法。')
  }

  const candidates = getBreakToTrashCandidates(state, context, effect)
  const candidateIds = new Set(candidates.map((card) => card.instanceId))

  if (uniqueIds.some((id) => !candidateIds.has(id))) {
    throw new GameRuleError('選擇的卡牌不是此效果的合法目標。')
  }
}

export const isEffectConditionMet = (
  state: GameState,
  context: EffectContext,
  effect: CardEffect,
): boolean => {
  const condition = 'condition' in effect ? effect.condition : undefined

  if (condition?.kind === 'all-of') {
    return condition.conditions.every((sub) =>
      isEffectConditionMet(state, context, { ...effect, condition: sub } as CardEffect),
    )
  }

  if (condition?.kind === 'opponent-trash-count-at-least') {
    const opponentId = getOpponentId(context.sourcePlayerId)
    return state.players[opponentId].discardPile.length >= condition.count
  }

  if (condition?.kind === 'trash-count-at-least') {
    return (
      state.players[context.sourcePlayerId].discardPile.length >=
      condition.count
    )
  }

  if (condition?.kind === 'trash-count-at-most') {
    return (
      state.players[context.sourcePlayerId].discardPile.length <=
      condition.count
    )
  }

  if (condition?.kind === 'source-hp-less-than') {
    const source = state.players[context.sourcePlayerId].battleArea.find(
      (cookie) => cookie.card.instanceId === context.sourceInstanceId,
    )
    return source ? source.hpCards.length < condition.amount : false
  }

  if (condition?.kind === 'support-count-at-least') {
    return state.players[context.sourcePlayerId].supportArea.length >= condition.count
  }

  if (condition?.kind === 'support-color-count-at-least') {
    return (
      state.players[context.sourcePlayerId].supportArea.filter(
        (support) => support.card.energyColor === condition.color,
      ).length >= condition.count
    )
  }

  if (condition?.kind === 'support-count-at-most') {
    return state.players[context.sourcePlayerId].supportArea.length <= condition.count
  }

  if (condition?.kind === 'opponent-support-count-at-least') {
    const opponentId = getOpponentId(context.sourcePlayerId)
    return state.players[opponentId].supportArea.length >= condition.count
  }

  if (condition?.kind === 'active-support-count-at-least') {
    return state.players[context.sourcePlayerId].supportArea.filter(
      (support) => !support.rested,
    ).length >= condition.count
  }

  if (condition?.kind === 'trash-color-count-at-least') {
    return state.players[context.sourcePlayerId].discardPile.filter(
      (card) => card.energyColor === condition.color,
    ).length >= condition.count
  }
  if (condition?.kind === 'trash-flip-count-at-least') {
    return state.players[context.sourcePlayerId].discardPile.filter(
      (card) => Boolean(card.flip),
    ).length >= condition.count
  }

  if (condition?.kind === 'source-hp-at-least') {
    const source = state.players[context.sourcePlayerId].battleArea.find(
      (cookie) => cookie.card.instanceId === context.sourceInstanceId,
    )
    return source ? source.hpCards.length >= condition.amount : false
  }

  if (condition?.kind === 'source-in-break-area') {
    return state.players[context.sourcePlayerId].breakArea.some(
      (card) => card.instanceId === context.sourceInstanceId,
    )
  }

  if (condition?.kind === 'attack-target-remaining-hp-at-least') {
    const battle = state.pendingBattle
    const targetInstanceId =
      context.attackTargetInstanceId ??
      (battle &&
        battle.attackerPlayerId === context.sourcePlayerId &&
        battle.attackerInstanceId === context.sourceInstanceId
        ? battle.targetInstanceId
        : undefined)
    if (!targetInstanceId) return false
    const opponentId = getOpponentId(context.sourcePlayerId)
    const target = state.players[opponentId].battleArea.find(
      (cookie) => cookie.card.instanceId === targetInstanceId,
    )
    return Boolean(target && target.hpCards.length >= condition.amount)
  }

  if (condition?.kind === 'attack-target-level-at-most') {
    const battle = state.pendingBattle
    const targetInstanceId =
      context.attackTargetInstanceId ??
      (battle &&
        battle.attackerPlayerId === context.sourcePlayerId &&
        battle.attackerInstanceId === context.sourceInstanceId
        ? battle.targetInstanceId
        : undefined)
    if (!targetInstanceId) return false
    const opponentId = getOpponentId(context.sourcePlayerId)
    const target = state.players[opponentId].battleArea.find(
      (cookie) => cookie.card.instanceId === targetInstanceId,
    )
    return Boolean(target && target.card.level <= condition.level)
  }

  if (condition?.kind === 'opponent-cookie-fainted-in-current-battle') {
    const battle = state.pendingBattle
    return Boolean(
      battle &&
        battle.attackerPlayerId === context.sourcePlayerId &&
        battle.faintedColors.length > 0,
    )
  }

  if (condition?.kind === 'support-keyword-at-least') {
    return state.players[context.sourcePlayerId].supportArea.filter((support) =>
      support.card.keywords?.includes(condition.keyword),
    ).length >= condition.count
  }

  if (condition?.kind === 'distinct-named-family-count') {
    const isMarzipanCookie = (card: GameCard) =>
      card.type === 'cookie' &&
      (card.name === 'Marzipan Cookie' ||
        /^Marzipan Cookie \d+$/i.test(card.name))
    const player = state.players[context.sourcePlayerId]
    const battleNames = new Set(
      player.battleArea
        .map((cookie) => cookie.card)
        .filter(isMarzipanCookie)
        .map((card) => card.name),
    )
    const supportNames = new Set(
      player.supportArea
        .map((support) => support.card)
        .filter(isMarzipanCookie)
        .map((card) => card.name),
    )
    return (
      battleNames.size >= condition.battleAreaCount &&
      supportNames.size >= condition.supportAreaCount
    )
  }

  if (condition?.kind === 'any-battle-area-has-blocker') {
    const allBattleCookies = [
      ...state.players['player-one'].battleArea,
      ...state.players['player-two'].battleArea,
    ]
    return allBattleCookies.some(
      (cookie) => cookie.card.skill?.trigger === 'block',
    )
  }

  if (condition?.kind === 'opponent-battle-area-has-no-blocker') {
    const opponent = state.players[getOpponentId(context.sourcePlayerId)]
    return !opponent.battleArea.some(
      (cookie) => cookie.card.skill?.trigger === 'block',
    )
  }

  if (condition?.kind === 'hand-count-at-most') {
    return state.players[context.sourcePlayerId].hand.length <= condition.count
  }

  if (condition?.kind === 'hand-count-at-least') {
    return state.players[context.sourcePlayerId].hand.length >= condition.count
  }

  if (condition?.kind === 'support-area-decreased-this-turn') {
    return Boolean(
      state.supportAreaDecreasedThisTurn?.[context.sourcePlayerId],
    )
  }

  if (condition?.kind === 'break-level-at-least') {
    return getBreakAreaLevel(state, context.sourcePlayerId) >= condition.level
  }

  if (condition?.kind === 'opponent-break-level-at-most') {
    return (
      getBreakAreaLevel(state, getOpponentId(context.sourcePlayerId)) <=
      condition.level
    )
  }

  if (condition?.kind === 'break-level-higher-than-opponent') {
    return (
      getBreakAreaLevel(state, context.sourcePlayerId) >
      getBreakAreaLevel(state, getOpponentId(context.sourcePlayerId))
    )
  }

  if (condition?.kind === 'opponent-has-cookie-with-level') {
    const opponentId = getOpponentId(context.sourcePlayerId)
    return state.players[opponentId].battleArea.some(
      (cookie) => cookie.card.level === condition.level,
    )
  }

  if (condition?.kind === 'attacker-level-at-most') {
    const battle = state.pendingBattle
    if (!battle || battle.targetInstanceId !== context.sourceInstanceId) {
      return false
    }
    const attacker = state.players[battle.attackerPlayerId].battleArea.find(
      (cookie) => cookie.card.instanceId === battle.attackerInstanceId,
    )
    return Boolean(attacker && attacker.card.level <= condition.level)
  }

  if (condition?.kind === 'opponent-battle-area-cookie-count') {
    const opponentId = getOpponentId(context.sourcePlayerId)
    return (
      state.players[opponentId].battleArea.length === condition.count
    )
  }

  if (condition?.kind === 'battle-area-has-cookie-with-level') {
    const playerId =
      condition.side === 'self'
        ? context.sourcePlayerId
        : getOpponentId(context.sourcePlayerId)
    return state.players[playerId].battleArea.some(
      (cookie) => cookie.card.level === condition.level,
    )
  }

  if (condition?.kind === 'battle-area-has-color') {
    const playerId =
      condition.side === 'self'
        ? context.sourcePlayerId
        : getOpponentId(context.sourcePlayerId)
    return state.players[playerId].battleArea.some(
      (cookie) =>
        cookie.card.energyColor === condition.color &&
        (condition.level === undefined || cookie.card.level === condition.level) &&
        (!condition.excludeSource ||
          cookie.card.instanceId !== context.sourceInstanceId),
    )
  }

  if (condition?.kind === 'break-area-has-card') {
    const playerId =
      condition.side === 'self'
        ? context.sourcePlayerId
        : getOpponentId(context.sourcePlayerId)
    return state.players[playerId].breakArea.some(
      (card) =>
        (condition.color === undefined || card.energyColor === condition.color) &&
        (condition.minLevel === undefined || card.level >= condition.minLevel) &&
        (condition.maxLevel === undefined || card.level <= condition.maxLevel),
    )
  }

  if (effect.kind === 'damage-all' && effect.sequential) {
    return Boolean(
      effect.target &&
        getEffectTargetCandidates(state, context, effect.target).length >=
          effect.target.min,
    )
  }

  if (effect.kind === 'damage-all' || effect.kind === 'modify-all-attack') {
    return true
  }

  if (effect.kind === 'field-to-trash') {
    return true
  }

  if (effect.kind === 'draw' || effect.kind === 'draw-up-to') {
    return true
  }

  if (isEffectUntargeted(effect)) return true

  if (effect.kind === 'break-to-trash') {
    return true
  }

  if (effect.kind === 'prevent-knockout') {
    return true
  }

  if (
    effect.kind === 'disable-flip' ||
    effect.kind === 'view-hp' ||
    effect.kind === 'battle-to-support' ||
    effect.kind === 'support-to-trash' ||
    effect.kind === 'trash-to-battle' ||
    effect.kind === 'trash-to-support' ||
    effect.kind === 'support-to-hand' ||
    effect.kind === 'redirect-attack' ||
    effect.kind === 'inspect-deck' ||
    effect.kind === 'optional-cost-attack' ||
    effect.kind === 'return-to-hand'
  ) {
    return true
  }

  return true
}
