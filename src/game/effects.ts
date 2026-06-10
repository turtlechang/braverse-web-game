import { GameRuleError } from './errors'
import { drawCards, getOpponentId, updatePlayer } from './helpers'
import { recordCookieDepartures } from './replacement'
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
  TargetedCardEffect,
} from './types'
import {
  finishWithDefeat,
  getBreakAreaLevel,
  resolveBasicVictory,
  resolveBreakLevelVictory,
} from './victory'

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
      kind:
        | 'gain-hp'
        | 'support-to-trash'
        | 'modify-all-attack'
        | 'trash-to-battle'
        | 'support-to-hand'
    }> =>
  effect.kind === 'draw' ||
  effect.kind === 'deck-to-support' ||
  effect.kind === 'gain-hp' ||
  effect.kind === 'support-to-trash' ||
  effect.kind === 'modify-all-attack' ||
  effect.kind === 'trash-to-battle' ||
  effect.kind === 'support-to-hand'

export const isEffectTargeted = (
  effect: CardEffect,
): effect is TargetedCardEffect =>
  effect.kind === 'damage' ||
  effect.kind === 'modify-attack' ||
  effect.kind === 'modify-damage-received' ||
  effect.kind === 'prevent-knockout' ||
  effect.kind === 'disable-flip' ||
  effect.kind === 'view-hp' ||
  effect.kind === 'battle-to-support'

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
      state.players[context.sourcePlayerId].battleArea.length < 2 &&
      state.players[context.sourcePlayerId].deck.length >= card.hp,
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
  if (effect.kind === 'modify-all-attack') {
    return (
      !effect.condition ||
      effect.condition.kind !== 'break-level-at-least' ||
      getBreakAreaLevel(state, context.sourcePlayerId) >=
        effect.condition.level
    )
  }

  if (isEffectUntargeted(effect)) return true

  if (effect.kind === 'break-to-trash') {
    return (
      !effect.condition ||
      effect.condition.kind !== 'break-level-at-least' ||
      getBreakAreaLevel(state, context.sourcePlayerId) >=
        effect.condition.level
    )
  }

  if (effect.kind === 'prevent-knockout') {
    return true
  }

  if (
    effect.kind === 'disable-flip' ||
    effect.kind === 'view-hp' ||
    effect.kind === 'battle-to-support'
  ) {
    return true
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
  departedCount: number,
): GameState => {
  const livingCookieIds = new Set(
    Object.values(state.players).flatMap((player) =>
      player.battleArea.map((cookie) => cookie.card.instanceId),
    ),
  )
  const updatedState = recordCookieDepartures({
    ...state,
    attackModifiers: state.attackModifiers.filter((modifier) =>
      livingCookieIds.has(modifier.targetInstanceId),
    ),
    damageReceivedModifiers: state.damageReceivedModifiers.filter(
      (modifier) => livingCookieIds.has(modifier.targetInstanceId),
    ),
  }, damagedPlayerId, departedCount)

  return resolveBreakLevelVictory(updatedState)
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
        ...takenCards.map((card) => ({
          card,
          rested: effect.rested ?? false,
        })),
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

  if (effect.kind === 'gain-hp') {
    throw new GameRuleError('增加 HP 必須在 FLIP 結算流程中執行。')
  }

  if (effect.kind === 'support-to-trash') {
    const player = state.players[context.sourcePlayerId]
    const uniqueIds = [...new Set(selectedTargetIds)]
    if (uniqueIds.length !== effect.amount) {
      throw new GameRuleError(
        `必須選擇 ${effect.amount} 張支援卡送入棄牌區。`,
      )
    }
    const selected = player.supportArea.filter((support) =>
      uniqueIds.includes(support.card.instanceId),
    )
    if (selected.length !== effect.amount) {
      throw new GameRuleError('只能選擇自己的支援區卡牌。')
    }
    return updatePlayer(state, {
      ...player,
      supportArea: player.supportArea.filter(
        (support) => !uniqueIds.includes(support.card.instanceId),
      ),
      discardPile: [
        ...player.discardPile,
        ...selected.map((support) => support.card),
      ],
    })
  }

  if (effect.kind === 'support-to-hand') {
    const player = state.players[context.sourcePlayerId]
    const uniqueIds = [...new Set(selectedTargetIds)]
    if (uniqueIds.length !== effect.amount) {
      throw new GameRuleError(`必須選擇 ${effect.amount} 張支援卡。`)
    }
    const selected = player.supportArea.filter((support) =>
      uniqueIds.includes(support.card.instanceId),
    )
    if (selected.length !== effect.amount) {
      throw new GameRuleError('選擇的卡片不在支援區。')
    }
    return updatePlayer(state, {
      ...player,
      supportArea: player.supportArea.filter(
        (support) => !uniqueIds.includes(support.card.instanceId),
      ),
      hand: [...player.hand, ...selected.map((support) => support.card)],
    })
  }

  if (effect.kind === 'modify-all-attack') {
    const playerId =
      effect.side === 'self'
        ? context.sourcePlayerId
        : getOpponentId(context.sourcePlayerId)
    const modifiers = state.players[playerId].battleArea.map((cookie) => ({
      sourceInstanceId: context.sourceInstanceId,
      targetInstanceId: cookie.card.instanceId,
      amount: effect.amount,
      expiresAfterTurn: getExpirationTurn(state, effect.duration),
    }))
    return {
      ...state,
      attackModifiers: [...state.attackModifiers, ...modifiers],
    }
  }

  if (effect.kind === 'trash-to-battle') {
    const candidates = getTrashCookieCandidates(state, context)
    const uniqueIds = [...new Set(selectedTargetIds)]
    if (uniqueIds.length !== effect.amount) {
      throw new GameRuleError(`必須選擇 ${effect.amount} 張棄牌區餅乾。`)
    }
    const selected = uniqueIds.map((id) =>
      candidates.find((card) => card.instanceId === id),
    )
    if (selected.some((card) => !card)) {
      throw new GameRuleError('選擇的餅乾無法從棄牌區登場。')
    }
    const player = state.players[context.sourcePlayerId]
    const cookie = selected[0]!
    const hpCards = player.deck.slice(0, cookie.hp)
    const updated = updatePlayer(state, {
      ...player,
      deck: player.deck.slice(cookie.hp),
      discardPile: player.discardPile.filter(
        (card) => card.instanceId !== cookie.instanceId,
      ),
      battleArea: [
        ...player.battleArea,
        {
          card: cookie,
          hpCards,
          rested: false,
          battleEntryId:
            `${cookie.instanceId}:battle:${state.nextBattleEntrySequence}`,
        },
      ],
    })
    const exhausted =
      updated.players[context.sourcePlayerId].deck.length === 0
    if (
      exhausted &&
      getRefreshCandidates(updated, context.sourcePlayerId).length === 0
    ) {
      return finishWithDefeat(
        updated,
        context.sourcePlayerId,
        'refresh-unavailable',
      )
    }
    return {
      ...updated,
      nextBattleEntrySequence: state.nextBattleEntrySequence + 1,
      pendingOnPlay: cookie.skill?.trigger === 'on-play'
        ? {
            playerId: context.sourcePlayerId,
            sourceInstanceId: cookie.instanceId,
          }
        : null,
      pendingRefresh:
        exhausted
          ? {
              playerId: context.sourcePlayerId,
              remainingDraws: 0,
            }
          : updated.pendingRefresh,
    }
  }

  const targets = selectEffectTargets(
    state,
    context,
    effect.target,
    selectedTargetIds,
  )
  const targetPlayerId = getTargetPlayerId(context, effect.target)

  if (effect.kind === 'damage') {
    const previousBattleAreaCount =
      state.players[targetPlayerId].battleArea.length
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
      previousBattleAreaCount - damagedPlayer.battleArea.length,
    )
  }

  if (effect.kind === 'prevent-knockout') {
    throw new GameRuleError('防止昏厥效果必須在陷阱戰鬥流程中執行。')
  }

  if (effect.kind === 'view-hp') {
    return { ...state }
  }

  if (effect.kind === 'disable-flip') {
    return {
      ...state,
      flipDisabledUntilTurn: {
        ...(state.flipDisabledUntilTurn ?? {}),
        ...Object.fromEntries(
          targets.map((target) => [
            target.card.instanceId,
            state.turnNumber,
          ]),
        ),
      },
    }
  }

  if (effect.kind === 'battle-to-support') {
    const player = state.players[targetPlayerId]
    const selectedIds = new Set(
      targets.map((target) => target.card.instanceId),
    )
    const movedCards = targets.map((target) => target.card)
    const hpCards = targets.flatMap((target) => target.hpCards)
    const nextState = updatePlayer(state, {
      ...player,
      battleArea: player.battleArea.filter(
        (cookie) => !selectedIds.has(cookie.card.instanceId),
      ),
      supportArea: [
        ...player.supportArea,
        ...movedCards.map((card) => ({ card, rested: false })),
      ],
      discardPile: [...player.discardPile, ...hpCards],
    })
    return recordCookieDepartures(
      nextState,
      targetPlayerId,
      movedCards.length,
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
