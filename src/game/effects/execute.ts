import { GameRuleError } from '../errors'
import { drawCards, getOpponentId, updatePlayer } from '../helpers'
import { recordCookieDepartures } from '../replacement'
import { getRefreshCandidates } from '../refresh'
import type {
  CardEffect,
  CookieCard,
  EffectContext,
  EffectDuration,
  GameState,
  PlayerId,
  PlayerState,
} from '../types'
import {
  finishWithDefeat,
  resolveBasicVictory,
  resolveBreakLevelVictory,
} from '../victory'
import {
  getEffectTargetCandidates,
  getTargetPlayerId,
  getTrashCookieCandidates,
  isEffectConditionMet,
  selectEffectTargets,
  validateBreakToTrashTargets,
} from './targeting'

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
  departedCookieCards: CookieCard[],
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

  const departedCookies = departedCookieCards

  let faintState = updatedState
  for (const cookie of departedCookies) {
    const faintSkill = cookie.skill
    if (faintSkill && faintSkill.faint) {
      for (const effect of faintSkill.effects) {
        const context = {
          sourcePlayerId: damagedPlayerId,
          sourceInstanceId: cookie.instanceId,
        }
        if (
          effect.kind === 'damage' ||
          effect.kind === 'modify-attack' ||
          effect.kind === 'modify-damage-received'
        ) {
          const candidates = getEffectTargetCandidates(
            faintState,
            context,
            effect.target,
          )
          if (candidates.length > 0) {
            faintState = {
              ...faintState,
              pendingFaintEffects: [
                ...(faintState.pendingFaintEffects ?? []),
                {
                  sourcePlayerId: damagedPlayerId,
                  sourceInstanceId: cookie.instanceId,
                  effect,
                  context,
                },
              ],
            }
          }
        } else {
          faintState = executeCardEffect(faintState, context, effect, [])
        }
      }
    }
  }

  return faintState.pendingFaintEffects && faintState.pendingFaintEffects.length > 0
    ? faintState
    : resolveBreakLevelVictory(faintState)
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
    const player = state.players[context.sourcePlayerId]
    const targetInstanceId =
      effect.target?.sourceOnly
        ? context.sourceInstanceId
        : selectedTargetIds[0] ??
          state.pendingBattle?.damageTargetInstanceId ??
          state.pendingBattle?.targetInstanceId
    if (!targetInstanceId) {
      throw new GameRuleError('增加 HP 需要明確目標餅乾。')
    }
    const targetIndex = player.battleArea.findIndex(
      (cookie) => cookie.card.instanceId === targetInstanceId,
    )
    const target = player.battleArea[targetIndex]
    if (!target || player.deck.length < effect.amount) {
      throw new GameRuleError('牌庫張數不足，無法增加 HP。')
    }
    const gainedCards = player.deck.slice(0, effect.amount)
    return updatePlayer(state, {
      ...player,
      deck: player.deck.slice(effect.amount),
      battleArea: player.battleArea.map((cookie, index) =>
        index === targetIndex
          ? { ...cookie, hpCards: [...cookie.hpCards, ...gainedCards] }
          : cookie,
      ),
    })
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
    const availableHpCards = player.deck.slice(0, cookie.hp)
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
          hpCards: availableHpCards,
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

  if (effect.kind === 'opponent-discard-hand') {
    const targetPlayerId = getOpponentId(context.sourcePlayerId)
    const targetPlayer = state.players[targetPlayerId]
    if (targetPlayer.hand.length < effect.count) {
      return { ...state }
    }
    return {
      ...state,
      pendingOpponentHandDiscard: {
        playerId: targetPlayerId,
        count: effect.count,
        sourcePlayerId: context.sourcePlayerId,
        sourceInstanceId: context.sourceInstanceId,
        sourceCardName: state.players[context.sourcePlayerId].battleArea.find(
          (c) => c.card.instanceId === context.sourceInstanceId,
        )?.card.name ?? 'Unknown',
        effectText: effect.kind,
      },
    }
  }

  if (effect.kind === 'opponent-battle-to-trash') {
    // TODO: implement opponent battle-to-trash pending flow
    return { ...state }
  }

  if (effect.kind === 'return-to-hand') {
    // TODO: implement return-to-hand pending flow
    return { ...state }
  }

  if (effect.kind === 'opponent-random-discard') {
    const targetPlayerId = getOpponentId(context.sourcePlayerId)
    const targetHand = state.players[targetPlayerId].hand
    if (targetHand.length === 0) return { ...state }
    const discardCount = Math.min(effect.count, targetHand.length)
    const shuffled = [...targetHand].sort(() => Math.random() - 0.5)
    const discarded = shuffled.slice(0, discardCount)
    const remaining = shuffled.slice(discardCount)
    return {
      ...state,
      players: {
        ...state.players,
        [targetPlayerId]: {
          ...state.players[targetPlayerId],
          hand: remaining,
          discardPile: [
            ...state.players[targetPlayerId].discardPile,
            ...discarded,
          ],
        },
      },
    }
  }

  if (effect.kind === 'set-active') {
    const player = state.players[context.sourcePlayerId]
    let unRested = 0
    return {
      ...state,
      players: {
        ...state.players,
        [context.sourcePlayerId]: {
          ...player,
          battleArea: player.battleArea.map((b) =>
            b.card.instanceId === context.sourceInstanceId
              ? { ...b, rested: false }
              : b,
          ),
          supportArea: player.supportArea.map((s) => {
            if (s.rested && unRested < effect.supportCount) {
              unRested++
              return { ...s, rested: false }
            }
            return s
          }),
        },
      },
    }
  }

  if (effect.kind === 'inspect-deck') {
    const player = state.players[context.sourcePlayerId]
    const deckCards = player.deck.slice(0, effect.lookCount)
    const remainingDeck = player.deck.slice(effect.lookCount)
    const updatedPlayer = { ...player, deck: remainingDeck }
    const nextState = updatePlayer(state, updatedPlayer)

    if (deckCards.length < effect.lookCount && !nextState.pendingRefresh) {
      const candidates = getRefreshCandidates(nextState, context.sourcePlayerId)
      if (candidates.length === 0) {
        return finishWithDefeat(nextState, context.sourcePlayerId, 'refresh-unavailable')
      }
      return {
        ...nextState,
        pendingRefresh: { playerId: context.sourcePlayerId, remainingDraws: 0 },
        pendingInspectDeck: {
          playerId: context.sourcePlayerId,
          sourceInstanceId: context.sourceInstanceId,
          sourceCardName:
            state.players[context.sourcePlayerId].battleArea.find(
              (c) => c.card.instanceId === context.sourceInstanceId,
            )?.card.name ?? 'Unknown',
          revealedCards: deckCards,
          lookCount: effect.lookCount,
          pickCount: effect.pickCount,
        },
      }
    }

    return {
      ...nextState,
      pendingInspectDeck: {
        playerId: context.sourcePlayerId,
        sourceInstanceId: context.sourceInstanceId,
        sourceCardName:
          state.players[context.sourcePlayerId].battleArea.find(
            (c) => c.card.instanceId === context.sourceInstanceId,
          )?.card.name ?? 'Unknown',
        revealedCards: deckCards,
        lookCount: effect.lookCount,
        pickCount: effect.pickCount,
      },
    }
  }

  if (
    effect.kind === 'optional-cost-attack'
  ) {
    return state
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

    const departedCount = previousBattleAreaCount - damagedPlayer.battleArea.length
    const departedCookieCards = targets
      .filter((target) => !damagedPlayer.battleArea.some(
        (cookie) => cookie.card.instanceId === target.card.instanceId,
      ))
      .map((target) => target.card)

    return resolveDamageOutcome(
      {
        ...state,
        players: {
          ...state.players,
          [targetPlayerId]: damagedPlayer,
        },
      },
      targetPlayerId,
      departedCount,
      departedCookieCards,
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
