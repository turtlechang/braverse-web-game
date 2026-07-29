import { collectAfterDamageEffectsFromIds } from '../afterDamage'
import { GameRuleError } from '../errors'
import { defaultShuffle, drawCards, getOpponentId, updatePlayer } from '../helpers'
import {
  clearDepartedCookieModifiers,
  recordCookieDepartures,
} from '../replacement'
import { getRefreshCandidates } from '../refresh'
import type {
  CardEffect,
  CookieCard,
  CookieInBattle,
  EffectContext,
  EffectDuration,
  GameState,
  PlayerId,
  PlayerState,
  Shuffle,
} from '../types'
import {
  finishWithDefeat,
  resolveBasicVictory,
  resolveBreakLevelVictory,
} from '../victory'
import {
  getBreakCount,
  getBreakToBattleCandidates,
  getBreakToHandBySumCandidates,
  getEffectTargetCandidates,
  getSupportEffectCandidates,
  getCookieOwnerId,
  getHandToBattleCandidates,
  getOpponentTrashToBreakCandidates,
  getTargetPlayerId,
  getTrashCookieCandidates,
  getTrashToBreakCandidates,
  getTrashToDeckCandidates,
  getTrashToHandCandidates,
  getTrashToSupportCandidates,
  isBlockedByOpponentEffectProtection,
  isEffectConditionMet,
  selectEffectTargets,
  validateBreakToTrashTargets,
} from './targeting'

const checkWindsweptValleyTrigger = (
  state: GameState,
  cookieOwnerId: PlayerId,
): GameState => {
  if (state.pendingStageTrigger) return state
  const stageOwnerId = getOpponentId(cookieOwnerId)
  const stageOwner = state.players[stageOwnerId]
  const stage = stageOwner.stage
  if (!stage) return state
  if (stage.card.id !== 'ST5-022') return state
  if (stage.rested) return state
  return {
    ...state,
    pendingStageTrigger: {
      playerId: stageOwnerId,
      sourceInstanceId: stage.card.instanceId,
      sourceCardName: stage.card.name,
      effectText: 'When your opponent places a Cookie from their battle area into the trash by effect, rest this card. You can draw 1 card from your deck.',
    },
  }
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
      discardPile: [
        ...player.discardPile,
        ...damagedCards,
        ...(target.equippedCards ?? []),
      ],
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
  const updatedState = recordCookieDepartures(
    clearDepartedCookieModifiers(state),
    damagedPlayerId,
    departedCount,
  )

  const departedCookies = departedCookieCards

  let faintState = updatedState
  for (const cookie of departedCookies) {
    const faintSkill = cookie.skill
    if (faintSkill && faintSkill.faint) {
      for (const effect of faintSkill.effects) {
        const context = {
          sourcePlayerId: damagedPlayerId,
          sourceInstanceId: cookie.instanceId,
          sourceCardName: cookie.name,
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
                  sourceCardName: cookie.name,
                  effect,
                  context,
                },
              ],
            }
          }
        } else {
          faintState = {
            ...faintState,
            pendingFaintEffects: [
              ...(faintState.pendingFaintEffects ?? []),
              {
                sourcePlayerId: damagedPlayerId,
                sourceInstanceId: cookie.instanceId,
                sourceCardName: cookie.name,
                effect,
                context,
              },
            ],
          }
        }
      }
    }
  }

  return faintState.pendingFaintEffects && faintState.pendingFaintEffects.length > 0
    ? faintState
    : resolveBreakLevelVictory(faintState)
}

const resolveNonFaintDepartureOutcome = (
  state: GameState,
  playerId: PlayerId,
  departedCount: number,
): GameState =>
  resolveBreakLevelVictory(
    recordCookieDepartures(
      clearDepartedCookieModifiers(state),
      playerId,
      departedCount,
    ),
  )

/**
 * `either` 目標可能同時包含雙方的餅乾，離場結算必須依擁有者分別套用，
 * 因此先依擁有者分組再逐一處理。
 */
const groupTargetsByOwner = (
  state: GameState,
  targets: CookieInBattle[],
): [PlayerId, CookieInBattle[]][] => {
  const byOwner = new Map<PlayerId, CookieInBattle[]>()
  for (const target of targets) {
    const ownerId = getCookieOwnerId(state, target.card.instanceId)
    if (!ownerId) continue
    byOwner.set(ownerId, [...(byOwner.get(ownerId) ?? []), target])
  }
  return [...byOwner]
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

const isEffectDamagePrevented = (
  state: GameState,
  targetInstanceId: string,
): boolean => {
  const expiration = state.effectDamagePreventedUntilTurn?.[targetInstanceId]
  return expiration !== undefined && state.turnNumber <= expiration
}

export const executeCardEffect = (
  state: GameState,
  context: EffectContext,
  effect: CardEffect,
  selectedTargetIds: string[],
  shuffle: Shuffle = defaultShuffle,
): GameState => {
  if (state.status !== 'playing') {
    throw new GameRuleError('只有進行中的遊戲可以執行卡牌效果。')
  }

  assertCondition(state, context, effect)

  if (effect.kind === 'draw') {
    const targetPlayerId =
      effect.side === 'opponent'
        ? context.sourcePlayerId === 'player-one'
          ? 'player-two'
          : 'player-one'
        : context.sourcePlayerId
    const player = state.players[targetPlayerId]
    const drawAmount = Math.min(player.deck.length, effect.amount)
    const updatedState = updatePlayer(
      state,
      drawCards(player, drawAmount),
    )
    const remainingDraws = effect.amount - drawAmount

    if (
      updatedState.players[targetPlayerId].deck.length > 0
    ) {
      return updatedState
    }

    if (
      getRefreshCandidates(
        updatedState,
        targetPlayerId,
      ).length === 0
    ) {
      return finishWithDefeat(
        updatedState,
        targetPlayerId,
        'refresh-unavailable',
      )
    }

    return {
      ...updatedState,
      pendingRefresh: {
        playerId: targetPlayerId,
        remainingDraws,
      },
    }
  }

  if (effect.kind === 'draw-up-to') {
    const sourcePlayer = state.players[context.sourcePlayerId]
    const battleCard = sourcePlayer.battleArea.find(
      (cookie) => cookie.card.instanceId === context.sourceInstanceId,
    )
    const handCard = sourcePlayer.hand.find(
      (card) => card.instanceId === context.sourceInstanceId,
    )
    const discardCard = sourcePlayer.discardPile.find(
      (card) => card.instanceId === context.sourceInstanceId,
    )
    const supportCard = sourcePlayer.supportArea.find(
      (card) => card.card.instanceId === context.sourceInstanceId,
    )
    const sourceCard = battleCard?.card ?? handCard ?? discardCard ?? supportCard?.card
    const effectText =
      sourceCard && 'effectText' in sourceCard
        ? sourceCard.effectText
        : undefined
    const itemText =
      sourceCard && 'item' in sourceCard && sourceCard.item
        ? sourceCard.item.text
        : undefined
    const sourceCardName =
      context.sourceCardName ??
      battleCard?.card.name ?? handCard?.name ?? discardCard?.name ?? supportCard?.card.name ?? 'Unknown'
    return {
      ...state,
      pendingDrawUpTo: {
        playerId: context.sourcePlayerId,
        max: effect.max,
        sourcePlayerId: context.sourcePlayerId,
        sourceInstanceId: context.sourceInstanceId,
        sourceCardName,
        effectText: effectText ?? itemText,
      },
    }
  }

  if (effect.kind === 'draw-up-to-battle-cookie-count') {
    const sourcePlayer = state.players[context.sourcePlayerId]
    const opponentId = getOpponentId(context.sourcePlayerId)
    const matchingCookies = [
      ...sourcePlayer.battleArea,
      ...state.players[opponentId].battleArea,
    ].filter((cookie) => cookie.card.level === effect.level).length
    const max = matchingCookies * effect.amountPerCookie
    if (max === 0) return { ...state }
    const supportCard = sourcePlayer.supportArea.find(
      (support) => support.card.instanceId === context.sourceInstanceId,
    )
    const sourceCard =
      sourcePlayer.battleArea.find(
        (cookie) => cookie.card.instanceId === context.sourceInstanceId,
      )?.card ??
      sourcePlayer.hand.find(
        (card) => card.instanceId === context.sourceInstanceId,
      ) ??
      sourcePlayer.discardPile.find(
        (card) => card.instanceId === context.sourceInstanceId,
      ) ??
      supportCard?.card
    return {
      ...state,
      pendingDrawUpTo: {
        playerId: context.sourcePlayerId,
        max,
        sourcePlayerId: context.sourcePlayerId,
        sourceInstanceId: context.sourceInstanceId,
        sourceCardName: context.sourceCardName ?? sourceCard?.name ?? 'Unknown',
        effectText:
          sourceCard && 'item' in sourceCard && sourceCard.item
            ? sourceCard.item.text
            : undefined,
      },
    }
  }

  if (effect.kind === 'draw-up-to-then-discard') {
    const sourcePlayer = state.players[context.sourcePlayerId]
    const battleCard = sourcePlayer.battleArea.find(
      (cookie) => cookie.card.instanceId === context.sourceInstanceId,
    )
    const handCard = sourcePlayer.hand.find(
      (card) => card.instanceId === context.sourceInstanceId,
    )
    const discardCard = sourcePlayer.discardPile.find(
      (card) => card.instanceId === context.sourceInstanceId,
    )
    const supportCard = sourcePlayer.supportArea.find(
      (card) => card.card.instanceId === context.sourceInstanceId,
    )
    const sourceCard = battleCard?.card ?? handCard ?? discardCard ?? supportCard?.card
    const effectText =
      sourceCard && 'effectText' in sourceCard
        ? sourceCard.effectText
        : undefined
    const itemText =
      sourceCard && 'item' in sourceCard && sourceCard.item
        ? sourceCard.item.text
        : undefined
    const sourceCardName =
      context.sourceCardName ??
      battleCard?.card.name ?? handCard?.name ?? discardCard?.name ?? supportCard?.card.name ?? 'Unknown'
    return {
      ...state,
      pendingDrawUpTo: {
        playerId: context.sourcePlayerId,
        max: effect.max,
        sourcePlayerId: context.sourcePlayerId,
        sourceInstanceId: context.sourceInstanceId,
        sourceCardName,
        effectText: effectText ?? itemText,
        afterEffects: [
          {
            kind: 'discard-hand',
            count: effect.discardCount,
            destination: effect.handDestination,
          },
        ],
        afterEffectContext: context,
        afterEffectsRequireDraw: true,
      },
    }
  }

  if (effect.kind === 'damage-all') {
    const targetPlayerId =
      effect.side === 'self'
        ? context.sourcePlayerId
        : getOpponentId(context.sourcePlayerId)
    const targetPlayer = state.players[targetPlayerId]
    const previousBattleAreaCount = targetPlayer.battleArea.length
    // 官方裁定：即使不「選擇」目標的全場效果，仍屬對手效果，不能影響 BS3-115 保護餅乾。
    // BS3-082：prevent-effect-damage 保護的餅乾也不受效果傷害。
    const targets = targetPlayer.battleArea.filter(
      (cookie) =>
        !isBlockedByOpponentEffectProtection(
          cookie,
          targetPlayerId,
          context.sourcePlayerId,
        ) &&
        !isEffectDamagePrevented(state, cookie.card.instanceId) &&
        (!effect.excludeSource || cookie.card.instanceId !== context.sourceInstanceId),
    )
    const damagedPlayer = targets.reduce(
      (player, target) =>
        damagePlayerCookie(player, target.card.instanceId, effect.amount),
      targetPlayer,
    )
    const departedCount =
      previousBattleAreaCount - damagedPlayer.battleArea.length
    const departedCookieCards = targets
      .filter(
        (target) =>
          !damagedPlayer.battleArea.some(
            (cookie) => cookie.card.instanceId === target.card.instanceId,
          ),
      )
      .map((target) => target.card)

    const damageState = resolveDamageOutcome(
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
    const damagedInstanceIds = targets.map((t) => t.card.instanceId)
    return collectAfterDamageEffectsFromIds(damageState, damagedInstanceIds, 'effect')
  }

  if (effect.kind === 'redirect-attack') {
    return { ...state }
  }

  if (effect.kind === 'flip-to-support') {
    return { ...state }
  }

  if (effect.kind === 'place-source-to-support') {
    const player = state.players[context.sourcePlayerId]
    const sourceFromDiscard = player.discardPile.find(
      (card) => card.instanceId === context.sourceInstanceId,
    )
    const sourceFromHand = player.hand.find(
      (card) => card.instanceId === context.sourceInstanceId,
    )
    const source = sourceFromDiscard ?? sourceFromHand
    if (!source) {
      throw new GameRuleError('找不到可放入支援區的來源卡。')
    }
    return updatePlayer(state, {
      ...player,
      hand: player.hand.filter(
        (card) => card.instanceId !== context.sourceInstanceId,
      ),
      discardPile: player.discardPile.filter(
        (card) => card.instanceId !== context.sourceInstanceId,
      ),
      supportArea: [
        ...player.supportArea,
        { card: source, rested: effect.rested ?? false },
      ],
    })
  }

  if (effect.kind === 'hand-to-deck-and-draw') {
    const playerId = context.sourcePlayerId
    const player = state.players[playerId]
    const drawCount = player.hand.length
    const shuffledDeck = shuffle([...player.deck, ...player.hand])
    const updatedState = updatePlayer(state, {
      ...player,
      hand: shuffledDeck.slice(0, drawCount),
      deck: shuffledDeck.slice(drawCount),
    })

    if (updatedState.players[playerId].deck.length > 0) {
      return resolveBasicVictory(updatedState)
    }
    if (getRefreshCandidates(updatedState, playerId).length === 0) {
      return finishWithDefeat(updatedState, playerId, 'refresh-unavailable')
    }
    return {
      ...updatedState,
      pendingRefresh: { playerId, remainingDraws: 0 },
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

  if (effect.kind === 'deck-to-trash') {
    const targetPlayerId =
      effect.side === 'self'
        ? context.sourcePlayerId
        : getOpponentId(context.sourcePlayerId)
    const targetPlayer = state.players[targetPlayerId]
    const movedCards = targetPlayer.deck.slice(0, effect.amount)
    return updatePlayer(state, {
      ...targetPlayer,
      deck: targetPlayer.deck.slice(movedCards.length),
      discardPile: [...targetPlayer.discardPile, ...movedCards],
    })
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

  if (effect.kind === 'trash-to-break') {
    const uniqueIds = [...new Set(selectedTargetIds)]
    if (uniqueIds.length !== effect.amount) {
      throw new GameRuleError('選擇的棄牌區餅乾數量不合法。')
    }
    const candidates = getTrashToBreakCandidates(state, context, effect)
    const candidateIds = new Set(candidates.map((card) => card.instanceId))
    if (uniqueIds.some((id) => !candidateIds.has(id))) {
      throw new GameRuleError('選擇的棄牌區餅乾不合法。')
    }
    const player = state.players[context.sourcePlayerId]
    const selected = player.discardPile.filter((card) =>
      uniqueIds.includes(card.instanceId),
    ) as CookieCard[]
    return updatePlayer(state, {
      ...player,
      discardPile: player.discardPile.filter(
        (card) => !uniqueIds.includes(card.instanceId),
      ),
      breakArea: [...player.breakArea, ...selected],
    })
  }

  if (effect.kind === 'gain-hp') {
    const player = state.players[context.sourcePlayerId]
    const isOptionalTarget =
      !effect.target?.sourceOnly && (effect.target?.min ?? 1) === 0
    const targetInstanceId =
      effect.target?.sourceOnly
        ? context.sourceInstanceId
        : selectedTargetIds[0] ??
          state.pendingBattle?.damageTargetInstanceId ??
          state.pendingBattle?.targetInstanceId
    if (!targetInstanceId) {
      if (isOptionalTarget) return { ...state }
      throw new GameRuleError('增加 HP 需要明確目標餅乾。')
    }
    const targetIndex = player.battleArea.findIndex(
      (cookie) => cookie.card.instanceId === targetInstanceId,
    )
    const target = player.battleArea[targetIndex]
    if (!target || player.deck.length < effect.amount) {
      if (isOptionalTarget) return { ...state }
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

  if (effect.kind === 'hand-to-break') {
    const player = state.players[context.sourcePlayerId]
    const uniqueIds = [...new Set(selectedTargetIds)]
    const minimum = effect.optional ? 0 : effect.amount
    if (uniqueIds.length < minimum || uniqueIds.length > effect.amount) {
      throw new GameRuleError('Invalid hand target.')
    }
    const selected = player.hand.filter((card) => {
      if (!uniqueIds.includes(card.instanceId)) return false
      if (card.type !== 'cookie') return false
      if (effect.nonCookieOnly) return false
      if (effect.energyColor !== undefined && card.energyColor !== effect.energyColor) return false
      if (effect.minLevel !== undefined && card.level < effect.minLevel) return false
      if (effect.maxLevel !== undefined && card.level > effect.maxLevel) return false
      return true
    })
    if (selected.length !== uniqueIds.length) {
      throw new GameRuleError('Invalid hand target.')
    }
    return updatePlayer(state, {
      ...player,
      hand: player.hand.filter((card) => !uniqueIds.includes(card.instanceId)),
      breakArea: [...player.breakArea, ...(selected as CookieCard[])],
    })
  }

  if (effect.kind === 'hand-to-battle') {
    const player = state.players[context.sourcePlayerId]
    const uniqueIds = [...new Set(selectedTargetIds)]
    const minimum = effect.optional ? 0 : effect.amount
    if (uniqueIds.length < minimum || uniqueIds.length > effect.amount) {
      throw new GameRuleError('選擇的手牌數量不合法。')
    }
    if (uniqueIds.length === 0) return { ...state }
    const candidateIds = new Set(
      getHandToBattleCandidates(state, context, effect).map(
        (card) => card.instanceId,
      ),
    )
    if (uniqueIds.some((id) => !candidateIds.has(id))) {
      throw new GameRuleError('選擇的手牌無法登場。')
    }
    const cookie = player.hand.find(
      (card) => card.instanceId === uniqueIds[0],
    ) as CookieCard
    // 登場的 HP 卡取自牌庫頂，gainHp 是官方文字「Then, that Cookie gains +N HP」的額外補牌。
    const hpCount = cookie.hp + (effect.gainHp ?? 0)
    const hpCards = player.deck.slice(0, hpCount)
    const updated = updatePlayer(state, {
      ...player,
      hand: player.hand.filter((card) => card.instanceId !== cookie.instanceId),
      deck: player.deck.slice(hpCards.length),
      battleArea: [
        ...player.battleArea,
        {
          card: cookie,
          hpCards,
          rested: false,
          battleEntryId: `${cookie.instanceId}:battle:${state.nextBattleEntrySequence}`,
        },
      ],
    })
    const exhausted = updated.players[context.sourcePlayerId].deck.length === 0
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
      pendingOnPlay:
        cookie.skill?.trigger === 'on-play'
          ? {
              playerId: context.sourcePlayerId,
              sourceInstanceId: cookie.instanceId,
            }
          : null,
      pendingRefresh: exhausted
        ? { playerId: context.sourcePlayerId, remainingDraws: 0 }
        : updated.pendingRefresh,
    }
  }

  if (effect.kind === 'opponent-trash-to-break') {
    const opponentId = getOpponentId(context.sourcePlayerId)
    const uniqueIds = [...new Set(selectedTargetIds)]
    if (uniqueIds.length > effect.max) {
      throw new GameRuleError(`最多只能選擇 ${effect.max} 張對手棄牌區卡牌。`)
    }
    if (uniqueIds.length === 0) return { ...state }
    const candidateIds = new Set(
      getOpponentTrashToBreakCandidates(state, context, effect).map(
        (card) => card.instanceId,
      ),
    )
    if (uniqueIds.some((id) => !candidateIds.has(id))) {
      throw new GameRuleError('選擇的卡牌不在對手棄牌區的合法範圍內。')
    }
    const opponent = state.players[opponentId]
    const selectedSet = new Set(uniqueIds)
    const moved = opponent.discardPile.filter((card) =>
      selectedSet.has(card.instanceId),
    ) as CookieCard[]
    // 進入休息區會推進對手的 break 等級，必須走與其他休息區移動相同的勝負判定。
    return resolveBreakLevelVictory(
      updatePlayer(state, {
        ...opponent,
        discardPile: opponent.discardPile.filter(
          (card) => !selectedSet.has(card.instanceId),
        ),
        breakArea: [...opponent.breakArea, ...moved],
      }),
    )
  }

  if (effect.kind === 'choose-one') {
    // 選擇一項必須先由 expandChooseOne 換成選定模式，執行到這裡代表某條路徑漏了展開。
    throw new GameRuleError(
      '「選擇一項」必須先展開成選定的模式才能執行。',
    )
  }

  if (effect.kind === 'reveal-bottom-deck') {
    const player = state.players[context.sourcePlayerId]
    const bottomCard = player.deck[player.deck.length - 1]
    if (!bottomCard) return { ...state }
    const remaining = player.deck.slice(0, player.deck.length - 1)
    const destination =
      bottomCard.type === 'cookie'
        ? effect.cookieDestination
        : effect.otherwiseDestination
    return updatePlayer(
      state,
      destination === 'hand'
        ? { ...player, deck: remaining, hand: [...player.hand, bottomCard] }
        : { ...player, deck: [bottomCard, ...remaining] },
    )
  }

  if (effect.kind === 'break-to-hand') {
    const player = state.players[context.sourcePlayerId]
    const uniqueIds = [...new Set(selectedTargetIds)]
    const minimum = effect.optional ? 0 : effect.amount
    if (uniqueIds.length < minimum || uniqueIds.length > effect.amount) {
      throw new GameRuleError('Invalid break target.')
    }
    const selected = player.breakArea.filter((card) =>
      uniqueIds.includes(card.instanceId) &&
      (effect.energyColor === undefined || card.energyColor === effect.energyColor) &&
      (effect.minLevel === undefined || card.level >= effect.minLevel) &&
      (effect.maxLevel === undefined || card.level <= effect.maxLevel),
    )
    if (selected.length !== uniqueIds.length) {
      throw new GameRuleError('Invalid break target.')
    }
    return updatePlayer(state, {
      ...player,
      breakArea: player.breakArea.filter((card) => !uniqueIds.includes(card.instanceId)),
      hand: [...player.hand, ...selected],
    })
  }

  if (effect.kind === 'hand-to-hp') {
    const player = state.players[context.sourcePlayerId]
    const selectedId = selectedTargetIds[0]
    const selected = player.hand.find((card) => card.instanceId === selectedId)
    const targetId = effect.target.sourceOnly
      ? context.sourceInstanceId
      : state.pendingBattle?.targetInstanceId
    if (!selected || !targetId) {
      if (effect.optional) return { ...state }
      throw new GameRuleError('Invalid hand target.')
    }
    if (effect.energyColor !== undefined && selected.energyColor !== effect.energyColor) {
      throw new GameRuleError('Invalid hand target.')
    }
    const targetPlayerId = getTargetPlayerId(context, effect.target)
    const targetPlayer = state.players[targetPlayerId]
    if (!targetPlayer.battleArea.some((cookie) => cookie.card.instanceId === targetId)) {
      throw new GameRuleError('Invalid HP target.')
    }
    return updatePlayer(state, {
      ...player,
      hand: player.hand.filter((card) => card.instanceId !== selectedId),
      ...(targetPlayerId === context.sourcePlayerId
        ? {
            battleArea: player.battleArea.map((cookie) =>
              cookie.card.instanceId === targetId
                ? { ...cookie, hpCards: [...cookie.hpCards, selected] }
                : cookie,
            ),
          }
        : {}),
    })
  }

  if (effect.kind === 'hp-to-hand') {
    const targets = selectEffectTargets(state, context, effect.target, selectedTargetIds)
    if (targets.length === 0) return { ...state }
    const target = targets[0]
    const targetPlayerId = getTargetPlayerId(context, effect.target)
    const player = state.players[targetPlayerId]
    const moved = target.hpCards.slice(-effect.amount)
    const remaining = target.hpCards.slice(0, Math.max(0, target.hpCards.length - moved.length))
    if (remaining.length === 0) {
      const updated = updatePlayer(state, {
        ...player,
        battleArea: player.battleArea.filter((cookie) => cookie.card.instanceId !== target.card.instanceId),
        breakArea: [...player.breakArea, target.card],
        hand: [...player.hand, ...moved],
      })
      return resolveDamageOutcome(updated, targetPlayerId, 1, [target.card])
    }
    return updatePlayer(state, {
      ...player,
      battleArea: player.battleArea.map((cookie) =>
        cookie.card.instanceId === target.card.instanceId
          ? { ...cookie, hpCards: remaining }
          : cookie,
      ),
      hand: [...player.hand, ...moved],
    })
  }

  if (effect.kind === 'transfer-hp') {
    // HP 卡最終會回到卡主的棄牌區，跨玩家搬移會弄錯歸屬，因此只支援我方之間。
    if (effect.target.side !== 'self') {
      throw new GameRuleError('transfer-hp 只支援我方餅乾之間搬移 HP 卡。')
    }
    const targets = selectEffectTargets(
      state,
      context,
      effect.target,
      selectedTargetIds,
    )
    if (targets.length === 0) return { ...state }
    const playerId = context.sourcePlayerId
    const player = state.players[playerId]
    const source = player.battleArea.find(
      (cookie) => cookie.card.instanceId === context.sourceInstanceId,
    )
    if (!source) return { ...state }
    const target = targets[0]
    const donor = effect.direction === 'to-source' ? target : source
    const receiver = effect.direction === 'to-source' ? source : target
    if (donor.card.instanceId === receiver.card.instanceId) return { ...state }
    const moved = donor.hpCards.slice(-effect.amount)
    if (moved.length === 0) return { ...state }
    const donorRemaining = donor.hpCards.slice(
      0,
      donor.hpCards.length - moved.length,
    )
    const donorFaints = donorRemaining.length === 0
    const updated = updatePlayer(state, {
      ...player,
      battleArea: player.battleArea.flatMap((cookie) => {
        if (cookie.card.instanceId === donor.card.instanceId) {
          return donorFaints ? [] : [{ ...cookie, hpCards: donorRemaining }]
        }
        if (cookie.card.instanceId === receiver.card.instanceId) {
          return [{ ...cookie, hpCards: [...cookie.hpCards, ...moved] }]
        }
        return [cookie]
      }),
      breakArea: donorFaints
        ? [...player.breakArea, donor.card]
        : player.breakArea,
    })
    return donorFaints
      ? resolveDamageOutcome(updated, playerId, 1, [donor.card])
      : updated
  }

  if (effect.kind === 'set-cookie-active') {
    const targets = selectEffectTargets(
      state,
      context,
      effect.target,
      selectedTargetIds,
    )
    if (targets.length === 0) return { ...state }
    const targetPlayerId = getTargetPlayerId(context, effect.target)
    const player = state.players[targetPlayerId]
    const activatedIds = new Set(
      targets.map((target) => target.card.instanceId),
    )
    return updatePlayer(state, {
      ...player,
      battleArea: player.battleArea.map((cookie) =>
        activatedIds.has(cookie.card.instanceId)
          ? { ...cookie, rested: false }
          : cookie,
      ),
    })
  }

  if (effect.kind === 'trash-to-deck-all') {
    const player = state.players[context.sourcePlayerId]
    let nextState =
      player.discardPile.length === 0
        ? { ...state }
        : updatePlayer(state, {
            ...player,
            discardPile: [],
            deck: shuffle([...player.deck, ...player.discardPile]),
          })
    for (const thenEffect of effect.thenEffects ?? []) {
      nextState = executeCardEffect(
        nextState,
        context,
        thenEffect,
        selectedTargetIds,
        shuffle,
      )
      if (nextState.status !== 'playing') break
    }
    return nextState
  }

  if (effect.kind === 'support-to-hp') {
    const player = state.players[context.sourcePlayerId]
    const selectedId = selectedTargetIds[0]
    const support = player.supportArea.find((entry) => entry.card.instanceId === selectedId)
    const targetId = effect.target.sourceOnly
      ? context.sourceInstanceId
      : selectedTargetIds[1]
    if (!support || !targetId) {
      if (effect.optional) return { ...state }
      throw new GameRuleError('Invalid support target.')
    }
    if (effect.energyColor !== undefined && support.card.energyColor !== effect.energyColor) {
      throw new GameRuleError('Invalid support target.')
    }
    const target = player.battleArea.find((cookie) => cookie.card.instanceId === targetId)
    if (!target) throw new GameRuleError('Invalid HP target.')
    return updatePlayer(state, {
      ...player,
      supportArea: player.supportArea.filter((entry) => entry.card.instanceId !== selectedId),
      battleArea: player.battleArea.map((cookie) =>
        cookie.card.instanceId === targetId
          ? { ...cookie, hpCards: [...cookie.hpCards, support.card] }
          : cookie,
      ),
    })
  }

  if (effect.kind === 'battle-to-deck-top') {
    const targets = selectEffectTargets(state, context, effect.target, selectedTargetIds)
    if (targets.length === 0) return { ...state }
    let nextState = state
    for (const [ownerId, ownedTargets] of groupTargetsByOwner(state, targets)) {
      const player = nextState.players[ownerId]
      const movedIds = new Set(ownedTargets.map((target) => target.card.instanceId))
      const movedCards = ownedTargets.map((target) => target.card)
      const hpCards = ownedTargets.flatMap((target) => target.hpCards)
      const updated = updatePlayer(nextState, {
        ...player,
        battleArea: player.battleArea.filter((cookie) => !movedIds.has(cookie.card.instanceId)),
        deck: [...movedCards, ...player.deck],
        discardPile: [...player.discardPile, ...hpCards],
      })
      nextState = resolveNonFaintDepartureOutcome(
        updated,
        ownerId,
        ownedTargets.length,
      )
      if (nextState.status !== 'playing') break
    }
    return nextState
  }

  if (effect.kind === 'rest-support') {
    const targetPlayerId = effect.side === 'opponent'
      ? getOpponentId(context.sourcePlayerId)
      : context.sourcePlayerId
    const player = state.players[targetPlayerId]
    const uniqueIds = [...new Set(selectedTargetIds)]
    const minimum = effect.optional ? 0 : effect.amount
    if (uniqueIds.length < minimum || uniqueIds.length > effect.amount) {
      throw new GameRuleError('Invalid support target.')
    }
    const selected = player.supportArea.filter((support) =>
      uniqueIds.includes(support.card.instanceId) && (!effect.activeOnly || !support.rested),
    )
    if (selected.length !== uniqueIds.length) throw new GameRuleError('Invalid support target.')
    return updatePlayer(state, {
      ...player,
      supportArea: player.supportArea.map((support) =>
        uniqueIds.includes(support.card.instanceId)
          ? { ...support, rested: true }
          : support,
      ),
    })
  }

  if (effect.kind === 'equip-source') {
    const targets = selectEffectTargets(state, context, effect.target, selectedTargetIds)
    if (targets.length === 0) return { ...state }
    const target = targets[0]
    if (target.card.id !== effect.requiredCookieId) {
      throw new GameRuleError('Invalid Equip target.')
    }
    const player = state.players[context.sourcePlayerId]
    const source = player.discardPile.find(
      (card) => card.instanceId === context.sourceInstanceId,
    )
    if (!source) throw new GameRuleError('Equip source must be in the trash.')
    const previousEquip = target.equippedCards ?? []
    const targetId = target.card.instanceId
    const targetIndex = player.battleArea.findIndex(
      (cookie) => cookie.card.instanceId === targetId,
    )
    const gainedHp = effect.gainHp
      ? player.deck.slice(0, effect.gainHp)
      : []
    const updatedState = updatePlayer(state, {
      ...player,
      deck: gainedHp.length > 0 ? player.deck.slice(gainedHp.length) : player.deck,
      discardPile: [
        ...player.discardPile.filter((card) => card.instanceId !== source.instanceId),
        ...previousEquip,
      ],
      battleArea: player.battleArea.map((cookie, index) =>
        index === targetIndex
          ? {
              ...cookie,
              hpCards: [...cookie.hpCards, ...gainedHp],
              equippedCards: [source],
            }
          : cookie,
      ),
    })
    return effect.attackBonus
      ? {
          ...updatedState,
          attackModifiers: [
            ...updatedState.attackModifiers,
            {
              sourceInstanceId: source.instanceId,
              targetInstanceId: targetId,
              amount: effect.attackBonus,
              expiresAfterTurn: null,
            },
          ],
        }
      : updatedState
  }

  if (effect.kind === 'support-to-trash') {
    const targetPlayerId =
      effect.side === 'opponent'
        ? getOpponentId(context.sourcePlayerId)
        : context.sourcePlayerId
    const player = state.players[targetPlayerId]
    const uniqueIds = [...new Set(selectedTargetIds)]
    const minimum = effect.optional ? 0 : effect.amount
    if (uniqueIds.length < minimum || uniqueIds.length > effect.amount) {
      throw new GameRuleError(
        `必須選擇 ${effect.amount} 張支援卡送入棄牌區。`,
      )
    }
    const candidateIds = new Set(
      getSupportEffectCandidates(state, context, {
        side: effect.side,
        activeOnly: effect.activeOnly,
      }).map((support) => support.card.instanceId),
    )
    if (uniqueIds.some((id) => !candidateIds.has(id))) {
      throw new GameRuleError('Invalid support target.')
    }
    const selected = player.supportArea.filter((support) =>
      uniqueIds.includes(support.card.instanceId),
    )
    if (selected.length !== uniqueIds.length) {
      throw new GameRuleError('只能選擇自己的支援區卡牌。')
    }
    return markSupportAreaDecreased(updatePlayer(state, {
      ...player,
      supportArea: player.supportArea.filter(
        (support) => !uniqueIds.includes(support.card.instanceId),
      ),
      discardPile: [
        ...player.discardPile,
        ...selected.map((support) => support.card),
      ],
    }), targetPlayerId)
  }

    if (effect.kind === 'support-to-hand') {
    const player = state.players[context.sourcePlayerId]
    const uniqueIds = [...new Set(selectedTargetIds)]
    if (uniqueIds.length !== effect.amount) {
      throw new GameRuleError(`必須選擇 ${effect.amount} 張支援卡。`)
    }
    const selected = player.supportArea.filter(
      (support) =>
        uniqueIds.includes(support.card.instanceId) &&
        (effect.maxLevel === undefined ||
          (support.card.type === 'cookie' &&
            support.card.level <= effect.maxLevel)),
    )
    if (selected.length !== effect.amount) {
      throw new GameRuleError('選擇的卡片不在支援區。')
    }
    return markSupportAreaDecreased(updatePlayer(state, {
      ...player,
      supportArea: player.supportArea.filter(
        (support) => !uniqueIds.includes(support.card.instanceId),
      ),
      hand: [...player.hand, ...selected.map((support) => support.card)],
    }), context.sourcePlayerId)
  }

  if (effect.kind === 'hand-to-support') {
    const player = state.players[context.sourcePlayerId]
    const uniqueIds = [...new Set(selectedTargetIds)]
    if (uniqueIds.length !== effect.amount) {
      throw new GameRuleError(`必須選擇 ${effect.amount} 張手牌。`)
    }
    const selected = player.hand.filter(
      (card) => uniqueIds.includes(card.instanceId),
    )
    if (selected.length !== effect.amount) {
      throw new GameRuleError('選擇的卡片不在手牌中。')
    }
    return updatePlayer(state, {
      ...player,
      hand: player.hand.filter(
        (card) => !uniqueIds.includes(card.instanceId),
      ),
      supportArea: [
        ...player.supportArea,
        ...selected.map((card) => ({ card, rested: effect.rested ?? true })),
      ],
    })
  }

  if (effect.kind === 'modify-all-attack') {
    const playerId =
      effect.side === 'self'
        ? context.sourcePlayerId
        : getOpponentId(context.sourcePlayerId)
    const modifiers = state.players[playerId].battleArea
      .filter(
        (cookie) =>
          !isBlockedByOpponentEffectProtection(
            cookie,
            playerId,
            context.sourcePlayerId,
          ) &&
          (!effect.energyColor || cookie.card.energyColor === effect.energyColor) &&
          (!effect.minLevel || cookie.card.level >= effect.minLevel),
      )
      .map((cookie) => ({
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

  if (effect.kind === 'trash-to-support') {
    const player = state.players[context.sourcePlayerId]
    const cookieCandidates = getTrashToSupportCandidates(state, context)
    const uniqueIds = [...new Set(selectedTargetIds)]
    if (uniqueIds.length !== effect.amount) {
      throw new GameRuleError(`必須選擇 ${effect.amount} 張棄牌區餅乾。`)
    }
    const selected = uniqueIds.map((id) =>
      cookieCandidates.find((card) => card.instanceId === id),
    )
    if (selected.some((card) => !card)) {
      throw new GameRuleError('選擇的餅乾不在棄牌區。')
    }
    const selectedIds = new Set(uniqueIds)
    const cookies = selected as CookieCard[]
    const updated = updatePlayer(state, {
      ...player,
      discardPile: player.discardPile.filter(
        (card) => !selectedIds.has(card.instanceId),
      ),
      supportArea: [
        ...player.supportArea,
        ...cookies.map((card) => ({
          card,
          rested: effect.rested ?? false,
        })),
      ],
    })
    return updated
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
        sourceCardName: context.sourceCardName ??
          state.players[context.sourcePlayerId].battleArea.find(
            (c) => c.card.instanceId === context.sourceInstanceId,
          )?.card.name ?? 'Unknown',
        effectText: effect.kind,
      },
    }
  }

  if (effect.kind === 'discard-hand') {
    const player = state.players[context.sourcePlayerId]
    if (player.hand.length < effect.count) {
      return { ...state }
    }
    return {
      ...state,
      pendingOpponentHandDiscard: {
        playerId: context.sourcePlayerId,
        count: effect.count,
        destination: effect.destination,
        sourcePlayerId: context.sourcePlayerId,
        sourceInstanceId: context.sourceInstanceId,
        sourceCardName: context.sourceCardName ??
          player.battleArea.find(
            (c) => c.card.instanceId === context.sourceInstanceId,
          )?.card.name ?? 'Unknown',
        effectText: effect.kind,
      },
    }
  }

  if (effect.kind === 'opponent-battle-to-trash') {
    const targetPlayerId = getOpponentId(context.sourcePlayerId)
    const targetPlayer = state.players[targetPlayerId]
    const candidates = targetPlayer.battleArea.filter((cookie) => {
      if (
        isBlockedByOpponentEffectProtection(
          cookie,
          targetPlayerId,
          context.sourcePlayerId,
        )
      ) {
        return false
      }
      if (effect.maxLevel !== undefined && cookie.card.level > effect.maxLevel) return false
      if (effect.minLevel !== undefined && cookie.card.level < effect.minLevel) return false
      if (effect.remainingHp !== undefined && cookie.hpCards.length > effect.remainingHp) return false
      return true
    })
    const min = effect.min ?? 1
    if (candidates.length === 0 && selectedTargetIds.length === 0) {
      return { ...state }
    }
    if (
      selectedTargetIds.length < min ||
      selectedTargetIds.length > 1 ||
      new Set(selectedTargetIds).size !== selectedTargetIds.length
    ) {
      throw new GameRuleError('選擇的效果目標數量不合法。')
    }

    const selectedIds = new Set(selectedTargetIds)
    const selected = candidates.filter((c) => selectedIds.has(c.card.instanceId))
    if (selectedTargetIds.length === 0 && min === 0) return { ...state }
    if (selected.length === 0) throw new GameRuleError('選擇的卡牌不是合法目標。')

    const movedIds = new Set(selected.map((c) => c.card.instanceId))
    const movedCards = selected.map((c) => c.card)
    const hpCards = selected.flatMap((c) => c.hpCards)
    const toBreak = effect.destination === 'break'
    const updatedPlayer: PlayerState = {
      ...targetPlayer,
      battleArea: targetPlayer.battleArea.filter((c) => !movedIds.has(c.card.instanceId)),
      ...(toBreak
        ? { breakArea: [...targetPlayer.breakArea, ...movedCards] }
        : {}),
      discardPile: [...targetPlayer.discardPile, ...(toBreak ? hpCards : [...movedCards, ...hpCards])],
    }
    const nextState = updatePlayer(state, updatedPlayer)
    const departedCount = selected.length
    const afterDeparture = resolveNonFaintDepartureOutcome(
      nextState,
      targetPlayerId,
      departedCount,
    )
    return checkWindsweptValleyTrigger(
      afterDeparture,
      targetPlayerId,
    )
  }

  if (effect.kind === 'field-to-trash') {
    const targetPlayerId = getTargetPlayerId(context, effect.target)
    const targetPlayer = state.players[targetPlayerId]

    const stageOnly = effect.stageOnly ?? false
    const battleCandidates = stageOnly ? [] : targetPlayer.battleArea.filter((cookie) => {
      if (
        isBlockedByOpponentEffectProtection(
          cookie,
          targetPlayerId,
          context.sourcePlayerId,
        )
      ) {
        return false
      }
      if (effect.target.maxLevel !== undefined && cookie.card.level > effect.target.maxLevel) return false
      if (effect.target.minLevel !== undefined && cookie.card.level < effect.target.minLevel) return false
      if (effect.target.remainingHp !== undefined && cookie.hpCards.length > effect.target.remainingHp) return false
      return true
    })

    const hasStageOption = (effect.allowStage || stageOnly) && targetPlayer.stage !== null
    const hasBattleOption = battleCandidates.length > 0

    const effectiveTargetIds =
      effect.autoSelect && selectedTargetIds.length === 0 && (hasBattleOption || hasStageOption)
        ? [hasStageOption ? targetPlayer.stage!.card.instanceId : battleCandidates[0].card.instanceId]
        : selectedTargetIds

    if (!hasBattleOption && !hasStageOption && effectiveTargetIds.length === 0) {
      return { ...state }
    }
    const uniqueIds = new Set(effectiveTargetIds)
    if (
      uniqueIds.size !== effectiveTargetIds.length ||
      effectiveTargetIds.length < effect.target.min ||
      effectiveTargetIds.length > effect.target.max
    ) {
      throw new GameRuleError('選擇的效果目標數量不合法。')
    }

    const selectedId = effectiveTargetIds[0]
    const isStageTarget = selectedId === targetPlayer.stage?.card.instanceId

    if (isStageTarget) {
      if (!hasStageOption) throw new GameRuleError('對手沒有場景卡可移除。')
      const stageCard = targetPlayer.stage!.card
      const updatedPlayer: PlayerState = {
        ...targetPlayer,
        stage: null,
        discardPile: [...targetPlayer.discardPile, stageCard],
      }
      return updatePlayer(state, updatedPlayer)
    }

    if (stageOnly) {
      throw new GameRuleError('此效果只能選擇場景卡。')
    }

    const selectedCookie = battleCandidates.find((c) => c.card.instanceId === selectedId)
    if (!selectedCookie) throw new GameRuleError('選擇的卡牌不是合法目標。')

    const movedIds = new Set([selectedCookie.card.instanceId])
    const hpCards = selectedCookie.hpCards
    const updatedPlayer: PlayerState = {
      ...targetPlayer,
      battleArea: targetPlayer.battleArea.filter((c) => !movedIds.has(c.card.instanceId)),
      discardPile: [...targetPlayer.discardPile, selectedCookie.card, ...hpCards],
    }
    const nextState = updatePlayer(state, updatedPlayer)
    const afterDeparture = resolveNonFaintDepartureOutcome(nextState, targetPlayerId, 1)
    return checkWindsweptValleyTrigger(
      afterDeparture,
      targetPlayerId,
    )
  }

  if (effect.kind === 'field-to-trash-all') {
    const playerIds: PlayerId[] = ['player-one', 'player-two']
    let nextState = state
    for (const playerId of playerIds) {
      const player = nextState.players[playerId]
      const matching = player.battleArea.filter((cookie) => {
        if (
          isBlockedByOpponentEffectProtection(
            cookie,
            playerId,
            context.sourcePlayerId,
          )
        ) {
          return false
        }
        if (effect.maxLevel !== undefined && cookie.card.level > effect.maxLevel) return false
        if (effect.minLevel !== undefined && cookie.card.level < effect.minLevel) return false
        return true
      })
      if (matching.length === 0) continue
      const movedIds = new Set(matching.map((c) => c.card.instanceId))
      const hpCards = matching.flatMap((c) => c.hpCards)
      const updatedPlayer: PlayerState = {
        ...player,
        battleArea: player.battleArea.filter((c) => !movedIds.has(c.card.instanceId)),
        discardPile: [
          ...player.discardPile,
          ...matching.map((c) => c.card),
          ...hpCards,
        ],
      }
      nextState = updatePlayer(nextState, updatedPlayer)
      nextState = resolveNonFaintDepartureOutcome(nextState, playerId, matching.length)
      nextState = checkWindsweptValleyTrigger(nextState, playerId)
    }
    return nextState
  }

  if (effect.kind === 'disable-attack') {
    const targets = selectEffectTargets(
      state,
      context,
      effect.target,
      selectedTargetIds,
    )
    if (targets.length === 0) {
      return { ...state }
    }
    const expirationTurn = getExpirationTurn(state, effect.duration) ?? state.turnNumber
    return {
      ...state,
      attackDisabledUntilTurn: {
        ...(state.attackDisabledUntilTurn ?? {}),
        ...Object.fromEntries(
          targets.map((target) => [target.card.instanceId, expirationTurn]),
        ),
      },
    }
  }

  if (effect.kind === 'trash-to-hand') {
    const player = state.players[context.sourcePlayerId]
    const candidates = getTrashToHandCandidates(state, context, effect)
    const uniqueIds = [...new Set(selectedTargetIds)]
    if (uniqueIds.length > effect.max) {
      throw new GameRuleError(`最多只能選擇 ${effect.max} 張棄牌區卡牌。`)
    }
    if (uniqueIds.length === 0) {
      return { ...state }
    }
    const candidateIds = new Set(candidates.map((card) => card.instanceId))
    if (uniqueIds.some((id) => !candidateIds.has(id))) {
      throw new GameRuleError('選擇的卡牌不在棄牌區的合法範圍內。')
    }
    const selectedSet = new Set(uniqueIds)
    const selected = player.discardPile.filter((card) =>
      selectedSet.has(card.instanceId),
    )
    return updatePlayer(state, {
      ...player,
      discardPile: player.discardPile.filter(
        (card) => !selectedSet.has(card.instanceId),
      ),
      hand: [...player.hand, ...selected],
    })
  }

  if (effect.kind === 'trash-to-deck') {
    const player = state.players[context.sourcePlayerId]
    const candidates = getTrashToDeckCandidates(state, context, effect)
    const uniqueIds = [...new Set(selectedTargetIds)]
    if (uniqueIds.length > effect.max) {
      throw new GameRuleError(`最多只能選擇 ${effect.max} 張棄牌區卡牌。`)
    }
    if (uniqueIds.length === 0) {
      return { ...state }
    }
    const candidateIds = new Set(candidates.map((card) => card.instanceId))
    if (uniqueIds.some((id) => !candidateIds.has(id))) {
      throw new GameRuleError('選擇的卡牌不在棄牌區的合法範圍內。')
    }
    const selectedSet = new Set(uniqueIds)
    const selected = player.discardPile.filter((card) =>
      selectedSet.has(card.instanceId),
    )
    return updatePlayer(state, {
      ...player,
      discardPile: player.discardPile.filter(
        (card) => !selectedSet.has(card.instanceId),
      ),
      deck: shuffle([...player.deck, ...selected]),
    })
  }

  if (effect.kind === 'hp-to-support') {
    const targets = selectEffectTargets(
      state,
      context,
      effect.target,
      selectedTargetIds,
    )
    if (targets.length === 0) {
      return { ...state }
    }
    const target = targets[0]
    const targetPlayerId = getTargetPlayerId(context, effect.target)
    const player = state.players[targetPlayerId]
    const targetIndex = player.battleArea.findIndex(
      (cookie) => cookie.card.instanceId === target.card.instanceId,
    )
    const removeCount = Math.min(effect.amount, target.hpCards.length)
    if (removeCount === 0) {
      return { ...state }
    }
    const removedHpCards = target.hpCards.slice(-removeCount)
    const remainingHpCards = target.hpCards.slice(
      0,
      Math.max(0, target.hpCards.length - removeCount),
    )

    if (remainingHpCards.length === 0) {
      const updatedPlayer: PlayerState = {
        ...player,
        battleArea: player.battleArea.filter(
          (_, index) => index !== targetIndex,
        ),
        breakArea: [...player.breakArea, target.card],
        supportArea: [
          ...player.supportArea,
          ...removedHpCards.map((card) => ({ card, rested: effect.rested ?? false })),
        ],
      }
      return resolveDamageOutcome(
        updatePlayer(state, updatedPlayer),
        targetPlayerId,
        1,
        [target.card],
      )
    }

    const updatedPlayer: PlayerState = {
      ...player,
      battleArea: player.battleArea.map((cookie, index) =>
        index === targetIndex
          ? { ...cookie, hpCards: remainingHpCards }
          : cookie,
      ),
      supportArea: [
        ...player.supportArea,
        ...removedHpCards.map((card) => ({ card, rested: effect.rested ?? false })),
      ],
    }
    return updatePlayer(state, updatedPlayer)
  }

  if (effect.kind === 'break-to-battle') {
    const player = state.players[context.sourcePlayerId]
    const candidates = getBreakToBattleCandidates(state, context, effect)
    const uniqueIds = [...new Set(selectedTargetIds)]
    if (uniqueIds.length > effect.amount) {
      throw new GameRuleError(`最多只能選擇 ${effect.amount} 張 break 區餅乾。`)
    }
    if (uniqueIds.length === 0) {
      return { ...state }
    }
    const candidateIds = new Set(candidates.map((card) => card.instanceId))
    if (uniqueIds.some((id) => !candidateIds.has(id))) {
      throw new GameRuleError('選擇的餅乾不符合 break 區登場條件。')
    }
    const cookie = candidates.find((card) => card.instanceId === uniqueIds[0])!
    const availableHpCards = player.deck.slice(0, cookie.hp)
    const updated = updatePlayer(state, {
      ...player,
      deck: player.deck.slice(cookie.hp),
      breakArea: player.breakArea.filter(
        (card) => card.instanceId !== cookie.instanceId,
      ),
      battleArea: [
        ...player.battleArea,
        {
          card: cookie,
          hpCards: availableHpCards,
          rested: false,
          battleEntryId: `${cookie.instanceId}:battle:${state.nextBattleEntrySequence}`,
        },
      ],
    })
    const exhausted = updated.players[context.sourcePlayerId].deck.length === 0
    if (
      exhausted &&
      getRefreshCandidates(updated, context.sourcePlayerId).length === 0
    ) {
      return finishWithDefeat(updated, context.sourcePlayerId, 'refresh-unavailable')
    }
    return {
      ...updated,
      nextBattleEntrySequence: state.nextBattleEntrySequence + 1,
      pendingOnPlay:
        cookie.skill?.trigger === 'on-play'
          ? { playerId: context.sourcePlayerId, sourceInstanceId: cookie.instanceId }
          : null,
      pendingRefresh: exhausted
        ? { playerId: context.sourcePlayerId, remainingDraws: 0 }
        : updated.pendingRefresh,
    }
  }

  if (effect.kind === 'break-source-to-battle') {
    const player = state.players[context.sourcePlayerId]
    const sourceInBreak = player.breakArea.find(
      (card) => card.instanceId === context.sourceInstanceId,
    )
    if (!sourceInBreak) {
      throw new GameRuleError('來源餅乾不在休息區中。')
    }
    if (player.battleArea.length >= 2) {
      throw new GameRuleError('戰鬥區已滿。')
    }
    const hpCount = Math.min(effect.hpCount, player.deck.length)
    const availableHpCards = player.deck.slice(0, hpCount)
    const updated = updatePlayer(state, {
      ...player,
      deck: player.deck.slice(hpCount),
      breakArea: player.breakArea.filter(
        (card) => card.instanceId !== sourceInBreak.instanceId,
      ),
      battleArea: [
        ...player.battleArea,
        {
          card: sourceInBreak,
          hpCards: availableHpCards,
          rested: false,
          battleEntryId: `${sourceInBreak.instanceId}:battle:${state.nextBattleEntrySequence}`,
        },
      ],
    })
    const exhausted = updated.players[context.sourcePlayerId].deck.length === 0
    if (
      exhausted &&
      getRefreshCandidates(updated, context.sourcePlayerId).length === 0
    ) {
      return finishWithDefeat(updated, context.sourcePlayerId, 'refresh-unavailable')
    }
    return {
      ...updated,
      nextBattleEntrySequence: state.nextBattleEntrySequence + 1,
      pendingOnPlay:
        sourceInBreak.skill?.trigger === 'on-play'
          ? { playerId: context.sourcePlayerId, sourceInstanceId: sourceInBreak.instanceId }
          : null,
      pendingRefresh: exhausted
        ? { playerId: context.sourcePlayerId, remainingDraws: 0 }
        : updated.pendingRefresh,
    }
  }

  if (effect.kind === 'stage-source-to-deck') {
    const player = state.players[context.sourcePlayerId]
    const sourceStage = player.stage
    if (!sourceStage || sourceStage.card.instanceId !== context.sourceInstanceId) {
      throw new GameRuleError('來源場景卡不在場景區中。')
    }
    return updatePlayer(state, {
      ...player,
      stage: null,
      deck:
        effect.destination === 'top'
          ? [sourceStage.card, ...player.deck]
          : [...player.deck, sourceStage.card],
    })
  }

  if (effect.kind === 'stage-source-to-trash') {
    const player = state.players[context.sourcePlayerId]
    const sourceStage = player.stage
    if (!sourceStage || sourceStage.card.instanceId !== context.sourceInstanceId) {
      throw new GameRuleError('來源場景卡不在場景區中。')
    }
    return updatePlayer(state, {
      ...player,
      stage: null,
      discardPile: [...player.discardPile, sourceStage.card],
    })
  }

  if (effect.kind === 'battle-to-break') {
    const targets = selectEffectTargets(
      state,
      context,
      effect.target,
      selectedTargetIds,
    )
    if (targets.length === 0) {
      return { ...state }
    }
    let nextState = state
    for (const [ownerId, ownedTargets] of groupTargetsByOwner(state, targets)) {
      const player = nextState.players[ownerId]
      const movedIds = new Set(
        ownedTargets.map((target) => target.card.instanceId),
      )
      const hpCards = ownedTargets.flatMap((target) => target.hpCards)
      const updatedPlayer: PlayerState = {
        ...player,
        battleArea: player.battleArea.filter(
          (cookie) => !movedIds.has(cookie.card.instanceId),
        ),
        breakArea: [
          ...player.breakArea,
          ...ownedTargets.map((target) => target.card),
        ],
        discardPile: [...player.discardPile, ...hpCards],
      }
      nextState = resolveNonFaintDepartureOutcome(
        updatePlayer(nextState, updatedPlayer),
        ownerId,
        ownedTargets.length,
      )
      if (nextState.status !== 'playing') break
    }
    return nextState
  }

  if (effect.kind === 'break-to-hand-by-level-sum') {
    const player = state.players[context.sourcePlayerId]
    const candidates = getBreakToHandBySumCandidates(state, context, effect)
    const uniqueIds = [...new Set(selectedTargetIds)]
    if (uniqueIds.length === 0) {
      return { ...state }
    }
    const candidateIds = new Set(candidates.map((card) => card.instanceId))
    if (uniqueIds.some((id) => !candidateIds.has(id))) {
      throw new GameRuleError('選擇的卡牌不在 break 區的合法範圍內。')
    }
    const selectedSet = new Set(uniqueIds)
    const selected = candidates.filter((card) => selectedSet.has(card.instanceId))
    const levelSum = selected.reduce((sum, card) => sum + card.level, 0)
    if (levelSum !== effect.targetSum) {
      throw new GameRuleError(`選擇的餅乾等級總和必須恰好為 ${effect.targetSum}。`)
    }
    return updatePlayer(state, {
      ...player,
      breakArea: player.breakArea.filter(
        (card) => !selectedSet.has(card.instanceId),
      ),
      hand: [...player.hand, ...selected],
    })
  }

  if (effect.kind === 'hp-to-trash') {
    const targets = selectEffectTargets(
      state,
      context,
      effect.target,
      selectedTargetIds,
    )
    if (targets.length === 0) {
      return { ...state }
    }
    if (targets.length > 1) {
      let nextState = state
      for (const target of targets) {
        nextState = executeCardEffect(
          nextState,
          context,
          {
            ...effect,
            target: { ...effect.target, min: 1, max: 1 },
          },
          [target.card.instanceId],
          shuffle,
        )
        if (nextState.status !== 'playing') break
      }
      return nextState
    }
    const target = targets[0]
    const targetPlayerId = getTargetPlayerId(context, effect.target)
    const player = state.players[targetPlayerId]
    const targetIndex = player.battleArea.findIndex(
      (cookie) => cookie.card.instanceId === target.card.instanceId,
    )

    // 官方裁定（BS3-100 vs ST3-020）：prevent-knockout 保護的是「這次戰鬥中 HP
    // 不會變 0」，戰鬥還沒結束前即使是非傷害的 HP 移除（如攻擊後續效果的
    // hp-to-trash）也受它保護，不是只擋一般傷害。保護生效且只剩最後 1 張時
    // 直接不移除，不能靠 removeCount 算成 0 再走原本的 slice(-removeCount)
    // ——JS 的 slice(-0) 等同 slice(0)，會整疊當成被移除，導致卡片同時留在
    // hpCards 又被複製進棄牌區。
    const protectedFromKnockout =
      state.pendingBattle?.preventKnockoutTargetIds.includes(
        target.card.instanceId,
      ) && target.hpCards.length <= effect.amount
    if (protectedFromKnockout) {
      return { ...state }
    }
    const removeCount = Math.min(effect.amount, target.hpCards.length)
    const removedHpCards = target.hpCards.slice(-removeCount)
    const remainingHpCards = target.hpCards.slice(
      0,
      Math.max(0, target.hpCards.length - removeCount),
    )

    let updatedPlayer: PlayerState
    let departedCount = 0

    if (remainingHpCards.length === 0) {
      departedCount = 1
      updatedPlayer = {
        ...player,
        battleArea: player.battleArea.filter(
          (_, index) => index !== targetIndex,
        ),
        breakArea: [...player.breakArea, target.card],
        discardPile: [
          ...player.discardPile,
          ...removedHpCards,
          ...(target.equippedCards ?? []),
        ],
      }
    } else {
      updatedPlayer = {
        ...player,
        battleArea: player.battleArea.map((cookie, index) =>
          index === targetIndex
            ? { ...cookie, hpCards: remainingHpCards }
            : cookie,
        ),
        discardPile: [...player.discardPile, ...removedHpCards],
      }
    }

    const nextState: GameState = {
      ...state,
      players: {
        ...state.players,
        [targetPlayerId]: updatedPlayer,
      },
    }

    if (departedCount > 0) {
      return resolveDamageOutcome(nextState, targetPlayerId, departedCount, [
        target.card,
      ])
    }

    return nextState
  }

  if (effect.kind === 'return-to-hand') {
    const candidates = getEffectTargetCandidates(state, context, effect.target)
    if (candidates.length < effect.target.min && selectedTargetIds.length === 0) {
      return { ...state }
    }
    const selected = selectEffectTargets(
      state,
      context,
      effect.target,
      selectedTargetIds,
    )
    const targetPlayerId = getTargetPlayerId(context, effect.target)
    const targetPlayer = state.players[targetPlayerId]
    if (targetPlayer.battleArea.length - selected.length < 1) {
      throw new GameRuleError('返回手牌後，戰鬥區必須至少保留 1 張餅乾。')
    }
    const selectedIds = new Set(selected.map((cookie) => cookie.card.instanceId))
    const updatedState = updatePlayer(state, {
      ...targetPlayer,
      battleArea: targetPlayer.battleArea.filter(
        (cookie) => !selectedIds.has(cookie.card.instanceId),
      ),
      hand: [...targetPlayer.hand, ...selected.map((cookie) => cookie.card)],
      discardPile: [
        ...targetPlayer.discardPile,
        ...selected.flatMap((cookie) => cookie.hpCards),
      ],
    })
    return updatedState
  }

  if (effect.kind === 'return-to-deck-bottom') {
    const candidates = getEffectTargetCandidates(state, context, effect.target)
    if (candidates.length < effect.target.min && selectedTargetIds.length === 0) {
      return { ...state }
    }
    const selected = selectEffectTargets(
      state,
      context,
      effect.target,
      selectedTargetIds,
    )
    const targetPlayerId = getTargetPlayerId(context, effect.target)
    const targetPlayer = state.players[targetPlayerId]
    if (targetPlayer.battleArea.length - selected.length < 1) {
      throw new GameRuleError('返回牌庫底後，戰鬥區必須至少保留 1 張餅乾。')
    }
    const selectedIds = new Set(selected.map((cookie) => cookie.card.instanceId))
    const returnedCards = selected.map((cookie) => cookie.card)
    const hpCardsToDiscard = selected.flatMap((cookie) => cookie.hpCards)
    const updatedState = updatePlayer(state, {
      ...targetPlayer,
      battleArea: targetPlayer.battleArea.filter(
        (cookie) => !selectedIds.has(cookie.card.instanceId),
      ),
      deck: [...targetPlayer.deck, ...returnedCards],
      discardPile: [
        ...targetPlayer.discardPile,
        ...hpCardsToDiscard,
      ],
    })
    return updatedState
  }

  if (effect.kind === 'opponent-random-discard') {
    const targetPlayerId = getOpponentId(context.sourcePlayerId)
    const targetHand = state.players[targetPlayerId].hand
    if (targetHand.length === 0) return { ...state }
    const discardCount = Math.min(effect.count, targetHand.length)
    const shuffled = shuffle([...targetHand])
    const discarded = shuffled.slice(0, discardCount)
    const discardedIds = new Set(discarded.map((card) => card.instanceId))
    const remaining = targetHand.filter(
      (card) => !discardedIds.has(card.instanceId),
    )
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
    if (effect.selectable) {
      const selectedIds = new Set(selectedTargetIds)
      if (
        selectedIds.size !== selectedTargetIds.length ||
        selectedIds.size > effect.supportCount
      ) {
        throw new GameRuleError('Invalid support target.')
      }
      const selected = player.supportArea.filter(
        (support) => support.rested && selectedIds.has(support.card.instanceId),
      )
      if (selected.length !== selectedIds.size) {
        throw new GameRuleError('Invalid support target.')
      }
      return {
        ...state,
        players: {
          ...state.players,
          [context.sourcePlayerId]: {
            ...player,
            supportArea: player.supportArea.map((support) =>
              selectedIds.has(support.card.instanceId)
                ? { ...support, rested: false }
                : support,
            ),
          },
        },
      }
    }
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

  if (effect.kind === 'reveal-top-deck') {
    const player = state.players[context.sourcePlayerId]
    const topCard = player.deck[0]
    if (!topCard) return { ...state }

    const matched =
      (effect.match.type === undefined || topCard.type === effect.match.type) &&
      (effect.match.energyColor === undefined ||
        topCard.energyColor === effect.match.energyColor) &&
      (effect.match.level === undefined ||
        (topCard.type === 'cookie' && topCard.level === effect.match.level))

    const sourceCardName =
      context.sourceCardName ??
      player.battleArea.find(
        (c) => c.card.instanceId === context.sourceInstanceId,
      )?.card.name ??
      'Unknown'

    return {
      ...state,
      pendingRevealTopDeck: {
        playerId: context.sourcePlayerId,
        sourceInstanceId: context.sourceInstanceId,
        sourceCardName,
        revealedCard: topCard,
        matched,
        nestedEffects: matched ? effect.effects : [],
      },
    }
  }

  if (effect.kind === 'inspect-deck') {
    const player = state.players[context.sourcePlayerId]
    const deckCards = player.deck.slice(0, effect.lookCount)
    const remainingDeck = player.deck.slice(effect.lookCount)
    const updatedPlayer = { ...player, deck: remainingDeck }
    const nextState = updatePlayer(state, updatedPlayer)
    const sourceCardName =
      context.sourceCardName ??
      state.players[context.sourcePlayerId].battleArea.find(
        (c) => c.card.instanceId === context.sourceInstanceId,
      )?.card.name ??
      'Unknown'

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
          sourceCardName,
          revealedCards: deckCards,
          lookCount: effect.lookCount,
          pickCount: effect.pickCount,
          restDestination: effect.restDestination,
          pickDestination: effect.pickDestination,
          filterColor: effect.filterColor,
          filterType: effect.filterType,
          optionalPick: effect.optionalPick,
        },
      }
    }

    return {
      ...nextState,
      pendingInspectDeck: {
        playerId: context.sourcePlayerId,
        sourceInstanceId: context.sourceInstanceId,
        sourceCardName,
        revealedCards: deckCards,
        lookCount: effect.lookCount,
        pickCount: effect.pickCount,
        restDestination: effect.restDestination,
        pickDestination: effect.pickDestination,
        filterColor: effect.filterColor,
        filterType: effect.filterType,
        optionalPick: effect.optionalPick,
      },
    }
  }

  if (effect.kind === 'draw-up-to-opponent-fainted-this-turn') {
    const opponentId = getOpponentId(context.sourcePlayerId)
    const faintedCount = state.cookiesFaintedThisTurn?.[opponentId] ?? 0
    const drawMax = faintedCount * effect.amountPerFainted
    if (drawMax <= 0) {
      return state
    }
    return {
      ...state,
      pendingDrawUpTo: {
        playerId: context.sourcePlayerId,
        max: drawMax,
        sourcePlayerId: context.sourcePlayerId,
        sourceInstanceId: context.sourceInstanceId,
        sourceCardName: context.sourceCardName ?? 'Unknown',
      },
    }
  }

  if (effect.kind === 'prevent-effect-damage') {
    const targets = selectEffectTargets(
      state,
      context,
      effect.target,
      selectedTargetIds,
    )
    const expirationTurn =
      effect.duration === 'until-source-next-turn'
        ? state.turnNumber + 1
        : state.turnNumber
    return {
      ...state,
      effectDamagePreventedUntilTurn: {
        ...(state.effectDamagePreventedUntilTurn ?? {}),
        ...Object.fromEntries(
          targets.map((target) => [target.card.instanceId, expirationTurn]),
        ),
      },
    }
  }

  if (
    effect.kind === 'optional-cost-attack' ||
    effect.kind === 'disable-block'
  ) {
    if (effect.kind === 'disable-block') {
      const opponentId = context.sourcePlayerId === 'player-one' ? 'player-two' : 'player-one'
      return {
        ...state,
        blockDisabledUntilTurn: {
          ...(state.blockDisabledUntilTurn ?? {}),
          [opponentId]: state.turnNumber,
        },
      }
    }
    return state
  }

  if (!effect.target) {
    throw new GameRuleError('此效果需要目標。')
  }

  const targets = selectEffectTargets(
    state,
    context,
    effect.target,
    selectedTargetIds,
  )
  const targetPlayerId = getTargetPlayerId(context, effect.target)

  if (effect.kind === 'damage' || effect.kind === 'damage-by-break-count') {
    const amount =
      effect.kind === 'damage'
        ? effect.amount
        : getBreakCount(state, context.sourcePlayerId, effect) *
          effect.perCount
    const previousBattleAreaCount =
      state.players[targetPlayerId].battleArea.length
    const protectedTargets = targets.filter(
      (target) => !isEffectDamagePrevented(state, target.card.instanceId),
    )
    const damagedPlayer = protectedTargets.reduce(
      (player, target) =>
        damagePlayerCookie(player, target.card.instanceId, amount),
      state.players[targetPlayerId],
    )

    const departedCount = previousBattleAreaCount - damagedPlayer.battleArea.length
    const departedCookieCards = protectedTargets
      .filter((target) => !damagedPlayer.battleArea.some(
        (cookie) => cookie.card.instanceId === target.card.instanceId,
      ))
      .map((target) => target.card)

    const damageState = resolveDamageOutcome(
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
    const damagedInstanceIds = protectedTargets.map((t) => t.card.instanceId)
    return collectAfterDamageEffectsFromIds(damageState, damagedInstanceIds, 'effect')
  }

  if (effect.kind === 'split-damage') {
    const previousBattleAreaCount =
      state.players[targetPlayerId].battleArea.length
    let damagedPlayer = state.players[targetPlayerId]

    // 保護篩掉的目標直接跳過，不重新編號——primary/secondary 傷害量是綁在
    // 玩家選擇的第一/第二個目標上，若把被保護者濾掉後重新從 0 編號，會讓
    // 原本該拿 secondaryAmount 的第二目標錯拿成 primaryAmount。
    const appliedTargets = [
      targets[0] && !isEffectDamagePrevented(state, targets[0].card.instanceId)
        ? targets[0]
        : undefined,
      targets[1] && !isEffectDamagePrevented(state, targets[1].card.instanceId)
        ? targets[1]
        : undefined,
    ] as const
    const amounts = [effect.primaryAmount, effect.secondaryAmount] as const
    const appliedList = appliedTargets.flatMap((target, index) =>
      target ? [{ target, amount: amounts[index] }] : [],
    )
    for (const { target, amount } of appliedList) {
      damagedPlayer = damagePlayerCookie(
        damagedPlayer,
        target.card.instanceId,
        amount,
      )
    }

    const departedCount = previousBattleAreaCount - damagedPlayer.battleArea.length
    const departedCookieCards = appliedList
      .map(({ target }) => target)
      .filter((target) => !damagedPlayer.battleArea.some(
        (cookie) => cookie.card.instanceId === target.card.instanceId,
      ))
      .map((target) => target.card)

    const damageState = resolveDamageOutcome(
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
    const damagedInstanceIds = appliedList.map(({ target }) => target.card.instanceId)
    return collectAfterDamageEffectsFromIds(damageState, damagedInstanceIds, 'effect')
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
    amount:
      effect.kind === 'modify-attack-by-break-count'
        ? Math.floor(
            getBreakCount(state, context.sourcePlayerId, effect) /
              (effect.groupSize ?? 1),
          ) * effect.perCount
        : effect.kind === 'modify-attack' || effect.kind === 'modify-damage-received'
          ? effect.amount
          : 0,
    expiresAfterTurn: 'duration' in effect ? getExpirationTurn(state, effect.duration) : null,
    minimumDamage:
      effect.kind === 'modify-damage-received'
        ? effect.minimumDamage
        : undefined,
    setDamageTo:
      effect.kind === 'modify-damage-received'
        ? effect.setDamageTo
        : undefined,
  }))

  return effect.kind === 'modify-attack' ||
    effect.kind === 'modify-attack-by-break-count'
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
