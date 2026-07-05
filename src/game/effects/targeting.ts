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
  PlayerId,
  TargetedCardEffect,
} from '../types'
import { getBreakAreaLevel } from '../victory'

export const getTargetPlayerId = (
  context: EffectContext,
  selector: EffectTargetSelector,
): PlayerId =>
  selector.side === 'self'
    ? context.sourcePlayerId
    : getOpponentId(context.sourcePlayerId)

const matchesSelector = (
  cookie: CookieInBattle,
  selector: EffectTargetSelector,
  context: EffectContext,
  state: GameState,
): boolean => {
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
): CookieInBattle[] =>
  state.players[getTargetPlayerId(context, selector)].battleArea.filter(
    (cookie) => matchesSelector(cookie, selector, context, state),
  )

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
  | Extract<CardEffect, {
      kind: 'gain-hp' | 'damage-all' | 'modify-all-attack' | 'place-source-to-support' | 'discard-hand' | 'opponent-discard-hand' | 'opponent-battle-to-trash' | 'opponent-random-discard' | 'hand-to-deck-and-draw' | 'draw-up-to' | 'set-active' | 'field-to-trash-all' | 'break-to-battle' | 'break-to-hand-by-level-sum'
    }> =>
  effect.kind === 'draw' ||
  effect.kind === 'deck-to-support' ||
  effect.kind === 'gain-hp' ||
  effect.kind === 'damage-all' ||
  effect.kind === 'modify-all-attack' ||
  effect.kind === 'place-source-to-support' ||
  effect.kind === 'discard-hand' ||
  effect.kind === 'opponent-discard-hand' ||
  effect.kind === 'opponent-battle-to-trash' ||
  effect.kind === 'opponent-random-discard' ||
  effect.kind === 'hand-to-deck-and-draw' ||
  effect.kind === 'disable-block' ||
  effect.kind === 'draw-up-to' ||
  effect.kind === 'set-active' ||
  effect.kind === 'field-to-trash-all' ||
  effect.kind === 'break-to-battle' ||
  effect.kind === 'break-to-hand-by-level-sum'

export const isEffectTargeted = (
  effect: CardEffect,
): effect is TargetedCardEffect =>
  effect.kind === 'damage' ||
  effect.kind === 'damage-by-break-count' ||
  effect.kind === 'modify-attack-by-break-count' ||
  effect.kind === 'modify-attack' ||
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
  effect.kind === 'battle-to-break'

export const getSupportEffectCandidates = (
  state: GameState,
  context: EffectContext,
) => state.players[context.sourcePlayerId].supportArea

export const getTrashCookieCandidates = (
  state: GameState,
  context: EffectContext,
): CookieCard[] =>
  state.players[context.sourcePlayerId].discardPile.filter(
    (card): card is CookieCard =>
      card.type === 'cookie' &&
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
    if (effect.exactLevel !== undefined && card.level !== effect.exactLevel) {
      return false
    }
    if (effect.maxLevel !== undefined && card.level > effect.maxLevel) {
      return false
    }
    return true
  })

export const getTrashToHandCandidates = (
  state: GameState,
  context: EffectContext,
  effect: { energyColor?: EnergyColor },
): GameCard[] =>
  state.players[context.sourcePlayerId].discardPile.filter(
    (card) =>
      effect.energyColor === undefined ||
      card.energyColor === effect.energyColor,
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
): CookieCard[] =>
  state.players[context.sourcePlayerId].breakArea.filter((card) => {
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

  if (condition?.kind === 'source-hp-less-than') {
    const source = state.players[context.sourcePlayerId].battleArea.find(
      (cookie) => cookie.card.instanceId === context.sourceInstanceId,
    )
    return source ? source.hpCards.length < condition.amount : false
  }

  if (condition?.kind === 'support-count-at-least') {
    return state.players[context.sourcePlayerId].supportArea.length >= condition.count
  }

  if (condition?.kind === 'hand-count-at-most') {
    return state.players[context.sourcePlayerId].hand.length <= condition.count
  }

  if (condition?.kind === 'support-area-decreased-this-turn') {
    return Boolean(
      state.supportAreaDecreasedThisTurn?.[context.sourcePlayerId],
    )
  }

  if (condition?.kind === 'break-level-at-least') {
    return getBreakAreaLevel(state, context.sourcePlayerId) >= condition.level
  }

  if (condition?.kind === 'opponent-has-cookie-with-level') {
    const opponentId = getOpponentId(context.sourcePlayerId)
    return state.players[opponentId].battleArea.some(
      (cookie) => cookie.card.level === condition.level,
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
