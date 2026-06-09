import { GameRuleError } from './errors'
import { drawCards, getOpponentId, updatePlayer } from './helpers'
import { getRefreshCandidates } from './refresh'
import type {
  BreakToTrashEffect,
  CardEffect,
  CookieCard,
  CookieInBattle,
  DeckToSupportEffect,
  DrawEffect,
  EffectContext,
  EffectDuration,
  EffectTargetSelector,
  GameState,
  ModifyAttackEffect,
  PlayerId,
  PlayerState,
} from './types'
import { finishWithDefeat, getBreakAreaLevel, resolveBasicVictory } from './victory'

const getTargetPlayerId = (
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
    cookie.hpCards.length !== selector.remainingHp
  ) {
    return false
  }

  return (
    selector.minLevel === undefined ||
    cookie.card.level >= selector.minLevel
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
): effect is DrawEffect | DeckToSupportEffect =>
  effect.kind === 'draw' || effect.kind === 'deck-to-support'

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
  if (isEffectUntargeted(effect)) {
    return true
  }

  if (effect.kind === 'break-to-trash') {
    return (
      !effect.condition ||
      effect.condition.kind !== 'break-level-at-least' ||
      getBreakAreaLevel(state, context.sourcePlayerId) >=
        effect.condition.level
    )
  }

  return (
    effect.condition?.kind !== 'break-level-at-least' ||
    getBreakAreaLevel(state, context.sourcePlayerId) >=
      effect.condition.level
  )
}

const assertCondition = (
  state: GameState,
  context: EffectContext,
  effect: CardEffect,
) => {
  if (!isEffectConditionMet(state, context, effect)) {
    throw new GameRuleError('尚未滿足卡牌效果的發動條件。')
  }
}

const damagePlayerCookie = (
  player: PlayerState,
  targetInstanceId: string,
  damage: number,
): PlayerState => {
  const targetIndex = player.battleArea.findIndex(
    (cookie) => cookie.card.instanceId === targetInstanceId,
  )
  const target = player.battleArea[targetIndex]

  if (!target) {
    throw new GameRuleError('找不到傷害效果的目標。')
  }

  const damageAmount = Math.min(
    Math.max(damage, 0),
    target.hpCards.length,
  )
  const remainingHpCount = target.hpCards.length - damageAmount
  const damagedCards = target.hpCards.slice(remainingHpCount)
  const remainingHpCards = target.hpCards.slice(0, remainingHpCount)

  if (remainingHpCards.length === 0) {
    return {
      ...player,
      battleArea: player.battleArea.filter(
        (_, index) => index !== targetIndex,
      ),
      breakArea: [...player.breakArea, target.card],
      discardPile: [...player.discardPile, ...damagedCards],
    }
  }

  return {
    ...player,
    battleArea: player.battleArea.map((cookie, index) =>
      index === targetIndex
        ? { ...cookie, hpCards: remainingHpCards }
        : cookie,
    ),
    discardPile: [...player.discardPile, ...damagedCards],
  }
}

const resolveDamageOutcome = (
  state: GameState,
  damagedPlayerId: PlayerId,
): GameState => {
  const livingCookieIds = new Set(
    Object.values(state.players).flatMap((player) =>
      player.battleArea.map((cookie) => cookie.card.instanceId),
    ),
  )
  let updatedState = resolveBasicVictory({
    ...state,
    attackModifiers: state.attackModifiers.filter((modifier) =>
      livingCookieIds.has(modifier.targetInstanceId),
    ),
    damageReceivedModifiers: state.damageReceivedModifiers.filter(
      (modifier) => livingCookieIds.has(modifier.targetInstanceId),
    ),
  })

  if (
    updatedState.status === 'playing' &&
    updatedState.players[damagedPlayerId].battleArea.length === 0
  ) {
    updatedState = {
      ...updatedState,
      pendingReplacementPlayerId: damagedPlayerId,
    }
  }

  return updatedState
}

const getExpirationTurn = (
  state: GameState,
  duration: EffectDuration,
): number | null => {
  if (duration === 'persistent') {
    return null
  }

  return duration === 'this-turn'
    ? state.turnNumber
    : state.turnNumber + 1
}

export const getEffectiveAttack = (
  state: GameState,
  targetInstanceId: string,
): number => {
  const owner = Object.values(state.players).find((player) =>
    player.battleArea.some(
      (cookie) => cookie.card.instanceId === targetInstanceId,
    ),
  )
  const target = owner?.battleArea.find(
    (cookie) => cookie.card.instanceId === targetInstanceId,
  )

  if (!target || !owner) {
    throw new GameRuleError('找不到要計算攻擊力的餅乾。')
  }

  const modifierTotal = state.attackModifiers
    .filter((modifier) => modifier.targetInstanceId === targetInstanceId)
    .reduce((total, modifier) => total + modifier.amount, 0)
  const passiveModifierTotal =
    target.card.skill?.trigger === 'passive' &&
    (!target.card.skill.yourTurn ||
      state.activePlayerId === owner.id)
      ? target.card.skill.effects
          .filter(
            (effect) =>
              effect.kind === 'modify-attack' &&
              effect.target.sourceOnly &&
              isEffectConditionMet(
                state,
                {
                  sourcePlayerId: owner.id,
                  sourceInstanceId: targetInstanceId,
                },
                effect,
              ),
          )
          .reduce((total, effect) => total + (effect as ModifyAttackEffect).amount, 0)
      : 0

  return Math.max(
    0,
    target.card.attack + modifierTotal + passiveModifierTotal,
  )
}

export const getAttackDamageAgainst = (
  state: GameState,
  attackerInstanceId: string,
  targetInstanceId: string,
): number => {
  const receivedModifierTotal = state.damageReceivedModifiers
    .filter((modifier) => modifier.targetInstanceId === targetInstanceId)
    .reduce((total, modifier) => total + modifier.amount, 0)

  return Math.max(
    0,
    getEffectiveAttack(state, attackerInstanceId) + receivedModifierTotal,
  )
}

export const executeCardEffect = (
  state: GameState,
  context: EffectContext,
  effect: CardEffect,
  selectedTargetIds: string[],
): GameState => {
  if (state.status !== 'playing') {
    throw new GameRuleError('只有進行中的遊戲可以執行卡牌效果。')
  }

  assertCondition(state, context, effect)

  if (effect.kind === 'draw') {
    const player = state.players[context.sourcePlayerId]
    const drawAmount = Math.min(player.deck.length, effect.amount)
    const updatedState = updatePlayer(
      state,
      drawCards(player, drawAmount),
    )
    const remainingDraws = effect.amount - drawAmount

    if (
      updatedState.players[context.sourcePlayerId].deck.length > 0
    ) {
      return updatedState
    }

    if (
      getRefreshCandidates(
        updatedState,
        context.sourcePlayerId,
      ).length === 0
    ) {
      return finishWithDefeat(
        updatedState,
        context.sourcePlayerId,
        'refresh-unavailable',
      )
    }

    return {
      ...updatedState,
      pendingRefresh: {
        playerId: context.sourcePlayerId,
        remainingDraws,
      },
    }
  }

  if (effect.kind === 'deck-to-support') {
    const player = state.players[context.sourcePlayerId]
    const takeAmount = Math.min(player.deck.length, effect.amount)
    const takenCards = player.deck.slice(0, takeAmount)
    const updatedPlayer: PlayerState = {
      ...player,
      deck: player.deck.slice(takeAmount),
      supportArea: [
        ...player.supportArea,
        ...takenCards.map((card) => ({ card, rested: false })),
      ],
    }
    const updatedState = updatePlayer(state, updatedPlayer)

    if (
      updatedState.players[context.sourcePlayerId].deck.length > 0
    ) {
      return updatedState
    }

    if (
      getRefreshCandidates(
        updatedState,
        context.sourcePlayerId,
      ).length === 0
    ) {
      return finishWithDefeat(
        updatedState,
        context.sourcePlayerId,
        'refresh-unavailable',
      )
    }

    return {
      ...updatedState,
      pendingRefresh: {
        playerId: context.sourcePlayerId,
        remainingDraws: 0,
      },
    }
  }

  if (effect.kind === 'break-to-trash') {
    validateBreakToTrashTargets(
      state,
      context,
      effect,
      selectedTargetIds,
    )

    const sourcePlayer = state.players[context.sourcePlayerId]
    const selectedIds = new Set(selectedTargetIds)

    if (selectedIds.size === 0) {
      return { ...state }
    }

    const updatedPlayer: PlayerState = {
      ...sourcePlayer,
      breakArea: sourcePlayer.breakArea.filter(
        (card) => !selectedIds.has(card.instanceId),
      ),
      discardPile: [
        ...sourcePlayer.discardPile,
        ...sourcePlayer.breakArea.filter((card) =>
          selectedIds.has(card.instanceId),
        ),
      ],
    }

    const updatedState = updatePlayer(state, updatedPlayer)

    if (updatedState.status !== 'playing') {
      return updatedState
    }

    return resolveBasicVictory(updatedState)
  }

  const targets = selectEffectTargets(
    state,
    context,
    effect.target,
    selectedTargetIds,
  )
  const targetPlayerId = getTargetPlayerId(context, effect.target)

  if (effect.kind === 'damage') {
    const damagedPlayer = targets.reduce(
      (player, target) =>
        damagePlayerCookie(player, target.card.instanceId, effect.amount),
      state.players[targetPlayerId],
    )

    return resolveDamageOutcome(
      {
        ...state,
        players: {
          ...state.players,
          [targetPlayerId]: damagedPlayer,
        },
      },
      targetPlayerId,
    )
  }

  const modifiers = targets.map((target) => ({
    sourceInstanceId: context.sourceInstanceId,
    targetInstanceId: target.card.instanceId,
    amount: effect.amount,
    expiresAfterTurn: getExpirationTurn(state, effect.duration),
  }))

  return effect.kind === 'modify-attack'
    ? {
        ...state,
        attackModifiers: [...state.attackModifiers, ...modifiers],
      }
    : {
        ...state,
        damageReceivedModifiers: [
          ...state.damageReceivedModifiers,
          ...modifiers,
        ],
      }
}
