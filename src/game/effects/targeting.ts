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
): boolean => {
  if (
    selector.sourceOnly &&
    cookie.card.instanceId !== context.sourceInstanceId
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
    (cookie) => matchesSelector(cookie, selector, context),
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
      kind: 'gain-hp' | 'modify-all-attack' | 'opponent-discard-hand' | 'opponent-battle-to-trash' | 'opponent-random-discard' | 'hand-to-deck-and-draw' | 'draw-up-to' | 'set-active'
    }> =>
  effect.kind === 'draw' ||
  effect.kind === 'deck-to-support' ||
  effect.kind === 'gain-hp' ||
  effect.kind === 'modify-all-attack' ||
  effect.kind === 'opponent-discard-hand' ||
  effect.kind === 'opponent-battle-to-trash' ||
  effect.kind === 'opponent-random-discard' ||
  effect.kind === 'hand-to-deck-and-draw' ||
  effect.kind === 'draw-up-to' ||
  effect.kind === 'set-active'

export const isEffectTargeted = (
  effect: CardEffect,
): effect is TargetedCardEffect =>
  effect.kind === 'damage' ||
  effect.kind === 'modify-attack' ||
  effect.kind === 'modify-damage-received' ||
  effect.kind === 'prevent-knockout' ||
  effect.kind === 'disable-flip' ||
  effect.kind === 'view-hp' ||
  effect.kind === 'battle-to-support' ||
  effect.kind === 'return-to-hand' ||
  effect.kind === 'field-to-trash'

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

export const getBreakToTrashCandidates = (
  state: GameState,
  context: EffectContext,
  effect: BreakToTrashEffect,
): CookieCard[] =>
  state.players[context.sourcePlayerId].breakArea.filter(
    (card) => card.level === effect.exactLevel,
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

  if (condition?.kind === 'break-level-at-least') {
    return getBreakAreaLevel(state, context.sourcePlayerId) >= condition.level
  }

  if (effect.kind === 'modify-all-attack') {
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
    effect.kind === 'support-to-hand' ||
    effect.kind === 'inspect-deck' ||
    effect.kind === 'optional-cost-attack' ||
    effect.kind === 'return-to-hand'
  ) {
    return true
  }

  return true
}
