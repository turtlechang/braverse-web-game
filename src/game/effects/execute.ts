import { collectAfterDamageEffectsFromIds } from '../afterDamage'
import { GameRuleError } from '../errors'
import {
  defaultShuffle,
  drawCards,
  getCookieEffectiveHp,
  getOpponentId,
  updatePlayer,
} from '../helpers'
import {
  clearDepartedCookieModifiers,
  recordCookieDepartures,
} from '../replacement'
import { getFaintTriggeredCost, markSupportAreaDecreased } from '../skills'
import { getRefreshCandidates } from '../refresh'
import type {
  CardEffect,
  CookieCard,
  CookieInBattle,
  EffectContext,
  EffectDuration,
  EffectDamageContinuation,
  EffectDamageTarget,
  GameState,
  PendingBattle,
  PlayerId,
  PlayerState,
  Shuffle,
} from '../types'
import {
  finishWithDefeat,
  getBreakAreaLevel,
  resolveBasicVictory,
  resolveBreakLevelVictory,
} from '../victory'
import {
  getBreakCount,
  getBreakToBattleCandidates,
  getSupportToBattleCandidates,
  getBreakToHandBySumCandidates,
  getHandToBreakBySumCandidates,
  getEffectTargetCandidates,
  getEffectSelectionCandidates,
  getEffectSelectionLimits,
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
  isOpponentBattleMovementPrevented,
  requiresEffectCardSelection,
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

const markCookieHpReduced = (
  state: GameState,
  playerId: PlayerId,
  instanceIds: readonly string[],
): GameState => {
  if (instanceIds.length === 0) return state
  const previous = state.cookiesHpReducedThisTurn?.[playerId] ?? {}
  return {
    ...state,
    cookiesHpReducedThisTurn: {
      ...(state.cookiesHpReducedThisTurn ?? {}),
      [playerId]: {
        ...previous,
        ...Object.fromEntries(instanceIds.map((instanceId) => [instanceId, true])),
      },
    },
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
      const faintCost = getFaintTriggeredCost(faintSkill)
      let faintCostAttached = false
      let faintOptionalAttached = false
      for (const effect of faintSkill.effects) {
        const context = {
          sourcePlayerId: damagedPlayerId,
          sourceInstanceId: cookie.instanceId,
          sourceCardName: cookie.name,
        }
        // A faint trigger is queued only while its condition is true.  The
        // condition is checked again when the queued effect resolves because
        // an earlier effect in the same trigger may change the game state
        // (for example, BS3-061 sacrifices support before checking 5+).
        if (!isEffectConditionMet(faintState, context, effect)) continue
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
          const selectionLimits = getEffectSelectionLimits(effect)
          if (
            requiresEffectCardSelection(effect) &&
            selectionLimits &&
            getEffectSelectionCandidates(faintState, context, effect).length <
              selectionLimits.min
          ) {
            // A mandatory card cost/selection with no legal cards cannot be
            // paid.  Do not leave an impossible faint decision on screen and
            // lock the match; the effect simply has no legal resolution.
            continue
          }
          faintState = {
            ...faintState,
            pendingFaintEffects: [
              ...(faintState.pendingFaintEffects ?? []),
              {
                sourcePlayerId: damagedPlayerId,
                sourceInstanceId: cookie.instanceId,
                sourceCardName: cookie.name,
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

// BS3-082「若手牌 5 張以下，此餅乾不受任何效果傷害」是 trigger: 'passive'
// 的持續性條件被動，沒有任何玩家操作或系統事件會把它送進 executeCardEffect
// 去寫入 effectDamagePreventedUntilTurn 快照（那個欄位/duration 是設計給
// 一次性觸發、保護到某個回合為止的效果用的）。所以除了讀快照，這裡還要
// 即時重新檢查目標身上「trigger: 'passive' 且以自己為目標」的
// prevent-effect-damage 技能，條件成立就視為保護中，不然這張卡的被動永遠不會生效。
const isEffectDamagePrevented = (
  state: GameState,
  target: CookieInBattle,
  ownerId: PlayerId,
): boolean => {
  const expiration = state.effectDamagePreventedUntilTurn?.[target.card.instanceId]
  if (expiration !== undefined && state.turnNumber <= expiration) {
    return true
  }

  const skill = target.card.skill
  if (!skill || skill.trigger !== 'passive') {
    return false
  }

  const context: EffectContext = {
    sourcePlayerId: ownerId,
    sourceInstanceId: target.card.instanceId,
  }
  return skill.effects.some(
    (effect) =>
      effect.kind === 'prevent-effect-damage' &&
      effect.target.sourceOnly &&
      isEffectConditionMet(state, context, effect),
  )
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

  if (effect.kind === 'draw-until-hand-equals-opponent') {
    const playerId = context.sourcePlayerId
    const opponentId = getOpponentId(playerId)
    const player = state.players[playerId]
    const opponent = state.players[opponentId]
    const needed = Math.max(0, opponent.hand.length - player.hand.length)
    if (needed === 0) return state

    const drawAmount = Math.min(player.deck.length, needed)
    const updatedState = updatePlayer(
      state,
      drawCards(player, drawAmount),
    )
    const remainingDraws = needed - drawAmount
    if (remainingDraws <= 0) return updatedState
    if (updatedState.players[playerId].deck.length > 0) {
      return updatedState
    }
    if (getRefreshCandidates(updatedState, playerId).length === 0) {
      return finishWithDefeat(updatedState, playerId, 'refresh-unavailable')
    }
    return {
      ...updatedState,
      pendingRefresh: {
        playerId,
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
        sourceCardId: sourceCard?.id,
        effectText: effectText ?? itemText,
        condition: effect.condition,
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
        sourceCardId: sourceCard?.id,
        effectText:
          sourceCard && 'item' in sourceCard && sourceCard.item
            ? sourceCard.item.text
            : undefined,
      },
    }
  }

  if (effect.kind === 'draw-up-to-break-cookie-count') {
    const sourcePlayer = state.players[context.sourcePlayerId]
    const matchingCookies = sourcePlayer.breakArea.filter(
      (cookie) =>
        effect.minLevel === undefined || cookie.level >= effect.minLevel,
    ).length
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
        sourceCardId: sourceCard?.id,
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
        sourceCardId: sourceCard?.id,
        effectText: effectText ?? itemText,
        condition: effect.condition,
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
        !isEffectDamagePrevented(state, cookie, targetPlayerId) &&
        (!effect.excludeSource || cookie.card.instanceId !== context.sourceInstanceId),
    )

    if (effect.sequential) {
      if (!effect.target) {
        throw new GameRuleError('Sequential damage requires a target selector.')
      }
      if (state.pendingBattle) {
        throw new GameRuleError('Cannot begin sequential damage during a battle.')
      }

      const candidateIds = targets.map((target) => target.card.instanceId)
      const selectedIds = [...new Set(selectedTargetIds)]
      const selectedAllCandidates =
        selectedIds.length === selectedTargetIds.length &&
        selectedIds.length === candidateIds.length &&
        selectedIds.every((instanceId) => candidateIds.includes(instanceId))
      if (!selectedAllCandidates) {
        throw new GameRuleError(
          'Select every legal damage target exactly once, in resolution order.',
        )
      }

      const [targetInstanceId, ...remainingTargetInstanceIds] = selectedIds
      if (!targetInstanceId) return state

      const pendingBattle: PendingBattle = {
        attackerPlayerId: context.sourcePlayerId,
        defenderPlayerId: targetPlayerId,
        // 代價可能正好讓來源昏厥離場；已成功啟動的技能仍要完整結算。
        attackerInstanceId: context.sourceInstanceId,
        targetInstanceId,
        declaredDamage: effect.amount,
        remainingDamage: effect.amount,
        stage: 'damage',
        trapUsed: true,
        revealedHpCard: null,
        preventKnockoutTargetIds: [],
        faintedColors: [],
        attackEffects: [],
        attackEffectIndex: 0,
        damagePlayerId: targetPlayerId,
        damageTargetInstanceId: targetInstanceId,
        effectDamageSequence: {
          remainingTargetInstanceIds,
          damage: effect.amount,
          remainingTargets: remainingTargetInstanceIds.map((instanceId) => ({
            playerId: targetPlayerId,
            instanceId,
            damage: effect.amount,
          })),
          continuation: state.pendingAbilityEffect
            ? 'ability-effect'
            : 'finish-battle',
          resumeBattleAfterAbility: Boolean(state.pendingBattle),
        },
      }
      return { ...state, pendingBattle }
    }

    const effectDamageTargets: EffectDamageTarget[] = targets.map((target) => ({
      playerId: targetPlayerId,
      instanceId: target.card.instanceId,
      damage: effect.amount,
    }))
    const pendingEffectDamage = beginEffectDamageSequence(
      state,
      context,
      effectDamageTargets,
    )
    if (pendingEffectDamage) return pendingEffectDamage

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

    let damageState = markCookieHpReduced(
      {
        ...state,
        players: {
          ...state.players,
          [targetPlayerId]: damagedPlayer,
        },
      },
      targetPlayerId,
      targets
        .filter(() => effect.amount > 0)
        .map((target) => target.card.instanceId),
    )
    const sourceCookie = state.players[context.sourcePlayerId].battleArea.find(
      (cookie) => cookie.card.instanceId === context.sourceInstanceId,
    )
    if (
      sourceCookie?.card.keywords?.includes('arena') &&
      effect.amount > 0
    ) {
      damageState = {
        ...damageState,
        arenaCookieDealtEffectDamageThisTurn: {
          ...(damageState.arenaCookieDealtEffectDamageThisTurn ?? {}),
          [context.sourcePlayerId]: true,
        },
      }
    }
    damageState = resolveDamageOutcome(
      damageState,
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

  if (effect.kind === 'flip-to-break') {
    return { ...state }
  }

  if (effect.kind === 'place-source-to-support') {
    const player = state.players[context.sourcePlayerId]
    const sourceFromBattle = player.battleArea.find(
      (cookie) => cookie.card.instanceId === context.sourceInstanceId,
    )
    if (
      sourceFromBattle &&
      isOpponentBattleMovementPrevented(state, context.sourcePlayerId)
    ) {
      return { ...state }
    }
    const sourceFromDiscard = player.discardPile.find(
      (card) => card.instanceId === context.sourceInstanceId,
    )
    const sourceFromHand = player.hand.find(
      (card) => card.instanceId === context.sourceInstanceId,
    )
    const source = sourceFromBattle?.card ?? sourceFromDiscard ?? sourceFromHand
    const battleHpCards = sourceFromBattle?.hpCards ?? []
    const battleEquippedCards = sourceFromBattle?.equippedCards ?? []
    // A Cookie moved out of battle takes its HP/equipment cards to the trash.
    if (!source) {
      throw new GameRuleError('找不到可放入支援區的來源卡。')
    }
    return updatePlayer(state, {
      ...player,
      battleArea: player.battleArea.filter(
        (cookie) => cookie.card.instanceId !== context.sourceInstanceId,
      ),
      hand: player.hand.filter(
        (card) => card.instanceId !== context.sourceInstanceId,
      ),
      discardPile: [
        ...player.discardPile.filter(
          (card) => card.instanceId !== context.sourceInstanceId,
        ),
        ...battleHpCards,
        ...battleEquippedCards,
      ],
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
    const gainedAmount = effect.perBreakCard
      ? getBreakCount(state, context.sourcePlayerId, {
          minBreakLevel: effect.perBreakCard.minLevel,
          exactBreakLevel: effect.perBreakCard.exactLevel,
          breakEnergyColor: effect.perBreakCard.energyColor,
        }) *
        effect.amount
      : effect.amount
    if (gainedAmount === 0) return { ...state }
    const targetPlayerId = getTargetPlayerId(
      context,
      effect.target ?? { side: 'self', min: 0, max: 1 },
    )
    const player = state.players[targetPlayerId]
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
    if (!target || player.deck.length < gainedAmount) {
      if (isOptionalTarget) return { ...state }
      throw new GameRuleError('牌庫張數不足，無法增加 HP。')
    }
    const gainedCards = player.deck.slice(0, gainedAmount)
    const updatedState = updatePlayer(state, {
      ...player,
      deck: player.deck.slice(gainedAmount),
      battleArea: player.battleArea.map((cookie, index) =>
        index === targetIndex
          ? { ...cookie, hpCards: [...cookie.hpCards, ...gainedCards] }
          : cookie,
      ),
    })
    return {
      ...updatedState,
      cookiesGainedHpThisTurn: {
        ...(updatedState.cookiesGainedHpThisTurn ?? {}),
        [context.sourcePlayerId]: true,
      },
    }
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
      if (effect.keyword !== undefined && !card.keywords?.includes(effect.keyword)) return false
      if (effect.minLevel !== undefined && card.level < effect.minLevel) return false
      if (effect.maxLevel !== undefined && card.level > effect.maxLevel) return false
      return true
    })
    if (selected.length !== uniqueIds.length) {
      throw new GameRuleError('Invalid hand target.')
    }
    const updatedState = updatePlayer(state, {
      ...player,
      hand: player.hand.filter((card) => !uniqueIds.includes(card.instanceId)),
      breakArea: [...player.breakArea, ...(selected as CookieCard[])],
    })
    const arenaCount = selected.filter((card) =>
      card.keywords?.includes('arena'),
    ).length
    return arenaCount > 0
      ? {
          ...updatedState,
          arenaCookiesPlacedInBreakThisTurn: {
            ...(updatedState.arenaCookiesPlacedInBreakThisTurn ?? {}),
            [context.sourcePlayerId]:
              (updatedState.arenaCookiesPlacedInBreakThisTurn?.[
                context.sourcePlayerId
              ] ?? 0) + arenaCount,
          },
        }
      : updatedState
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
              origin: 'hand',
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
    if (effect.selectTarget) {
      // 兩階段（BS4-044 千年寺）：第一階段只選目標餅乾，驗證合法後即結束；
      // 放置手牌由第二階段（pendingAbilityEffect.pendingPlace → placeHandCardOnHp）
      // 執行，未選目標則整個效果略過。
      const targetCandidates = getEffectTargetCandidates(
        state,
        context,
        effect.target,
      )
      const selectedTargets = targetCandidates.filter((cookie) =>
        selectedTargetIds.includes(cookie.card.instanceId),
      )
      if (
        selectedTargets.length > effect.target.max ||
        selectedTargets.length < effect.target.min ||
        selectedTargets.length !== selectedTargetIds.length
      ) {
        throw new GameRuleError('Invalid HP target.')
      }
      return state
    }
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

  if (effect.kind === 'cycle-hp') {
    const targetCandidates = getEffectTargetCandidates(
      state,
      context,
      effect.target,
    )
    const player = state.players[context.sourcePlayerId]
    const selectedTargets = targetCandidates.filter((cookie) =>
      selectedTargetIds.includes(cookie.card.instanceId),
    )
    if (
      selectedTargets.length > effect.target.max ||
      selectedTargets.length < effect.target.min ||
      selectedTargets.length !== selectedTargetIds.length
    ) {
      throw new GameRuleError('Invalid HP cycle target.')
    }
    // 第一階段「最多 1 個」：不選目標時整個技能直接結束（不進入第二階段）。
    if (selectedTargets.length === 0) return state

    const target = selectedTargets[0]
    const moved = target.hpCards.slice(-1)
    const remaining = target.hpCards.slice(0, -1)
    if (remaining.length === 0) {
      const updated = updatePlayer(state, {
        ...player,
        battleArea: player.battleArea.filter(
          (cookie) => cookie.card.instanceId !== target.card.instanceId,
        ),
        breakArea: [...player.breakArea, target.card],
        hand: [...player.hand, ...moved],
        discardPile: [...player.discardPile, ...(target.equippedCards ?? [])],
      })
      return resolveDamageOutcome(updated, context.sourcePlayerId, 1, [target.card])
    }

    return updatePlayer(state, {
      ...player,
      hand: [...player.hand, ...moved],
      battleArea: player.battleArea.map((cookie) =>
        cookie.card.instanceId === target.card.instanceId
          ? { ...cookie, hpCards: remaining }
          : cookie,
      ),
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
    if (effect.selectTarget) {
      const player = state.players[context.sourcePlayerId]
      const supportCandidates = player.supportArea.filter(
        (support) =>
          effect.energyColor === undefined ||
          support.card.energyColor === effect.energyColor,
      )
      const targetCandidates = getEffectTargetCandidates(
        state,
        context,
        effect.target,
      )
      const selectedSupports = supportCandidates.filter((support) =>
        selectedTargetIds.includes(support.card.instanceId),
      )
      const selectedTargets = targetCandidates.filter((cookie) =>
        selectedTargetIds.includes(cookie.card.instanceId),
      )
      if (
        selectedSupports.length !== 1 ||
        selectedTargets.length !== 1 ||
        selectedSupports.length + selectedTargets.length !== selectedTargetIds.length
      ) {
        if (effect.optional && selectedTargetIds.length === 0) return state
        throw new GameRuleError('Invalid support or HP target.')
      }
      const support = selectedSupports[0]
      const target = selectedTargets[0]
      return updatePlayer(state, {
        ...player,
        supportArea: player.supportArea.filter(
          (entry) => entry.card.instanceId !== support.card.instanceId,
        ),
        battleArea: player.battleArea.map((cookie) =>
          cookie.card.instanceId === target.card.instanceId
            ? { ...cookie, hpCards: [...cookie.hpCards, support.card] }
            : cookie,
        ),
      })
    }
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
    if (isOpponentBattleMovementPrevented(state, context.sourcePlayerId)) {
      return { ...state }
    }
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
      uniqueIds.includes(support.card.instanceId) &&
      (!effect.activeOnly || !support.rested) &&
      (effect.energyColor === undefined ||
        support.card.energyColor === effect.energyColor),
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

  if (effect.kind === 'rest-support-and-damage') {
    const supportPlayerId =
      effect.supportSide === 'opponent'
        ? getOpponentId(context.sourcePlayerId)
        : context.sourcePlayerId
    const supportPlayer = state.players[supportPlayerId]
    const targetPlayerId = getTargetPlayerId(context, effect.target)
    const targetPlayer = state.players[targetPlayerId]
    const uniqueIds = [...new Set(selectedTargetIds)]
    if (uniqueIds.length > effect.supportAmount + effect.target.max) {
      throw new GameRuleError('Invalid support or damage target.')
    }

    const selectedSupports = supportPlayer.supportArea.filter(
      (support) =>
        uniqueIds.includes(support.card.instanceId) &&
        (!effect.activeOnly || !support.rested) &&
        (effect.supportEnergyColor === undefined ||
          support.card.energyColor === effect.supportEnergyColor),
    )
    const selectedTargets = targetPlayer.battleArea.filter((cookie) =>
      uniqueIds.includes(cookie.card.instanceId),
    )
    if (
      selectedSupports.length + selectedTargets.length !== uniqueIds.length ||
      selectedSupports.length > effect.supportAmount ||
      selectedTargets.length > effect.target.max ||
      selectedTargets.length < effect.target.min
    ) {
      throw new GameRuleError('Invalid support or damage target.')
    }

    let nextState = updatePlayer(state, {
      ...supportPlayer,
      supportArea: supportPlayer.supportArea.map((support) =>
        selectedSupports.some(
          (selected) => selected.card.instanceId === support.card.instanceId,
        )
          ? { ...support, rested: true }
          : support,
      ),
    })
    if (selectedTargets.length === 0 || selectedSupports.length === 0) {
      return nextState
    }

    const amount = selectedSupports.length
    const currentTarget = nextState.players[targetPlayerId].battleArea.find(
      (cookie) => cookie.card.instanceId === selectedTargets[0].card.instanceId,
    )
    if (!currentTarget) return nextState
    if (isEffectDamagePrevented(nextState, currentTarget, targetPlayerId)) {
      return nextState
    }
    const pendingEffectDamage = beginEffectDamageSequence(
      nextState,
      context,
      [
        {
          playerId: targetPlayerId,
          instanceId: currentTarget.card.instanceId,
          damage: amount,
        },
      ],
    )
    if (pendingEffectDamage) return pendingEffectDamage

    const previousBattleAreaCount = nextState.players[targetPlayerId].battleArea.length
    const damagedPlayer = damagePlayerCookie(
      nextState.players[targetPlayerId],
      currentTarget.card.instanceId,
      amount,
    )
    const departedCount = previousBattleAreaCount - damagedPlayer.battleArea.length
    const departedCards = damagedPlayer.battleArea.some(
      (cookie) => cookie.card.instanceId === currentTarget.card.instanceId,
    )
      ? []
      : [currentTarget.card]
    nextState = {
      ...nextState,
      players: {
        ...nextState.players,
        [targetPlayerId]: damagedPlayer,
      },
    }
    const damageState = resolveDamageOutcome(
      nextState,
      targetPlayerId,
      departedCount,
      departedCards,
    )
    return collectAfterDamageEffectsFromIds(
      damageState,
      [currentTarget.card.instanceId],
      'effect',
    )
  }

  if (effect.kind === 'equip-source') {
    const targets = selectEffectTargets(state, context, effect.target, selectedTargetIds)
    if (targets.length === 0) return { ...state }
    const target = targets[0]
    if (
      (effect.requiredCookieId !== undefined &&
        target.card.id !== effect.requiredCookieId) ||
      (effect.requiredKeyword !== undefined &&
        !target.card.keywords?.includes(effect.requiredKeyword)) ||
      (effect.maxRemainingHp !== undefined &&
        getCookieEffectiveHp(target) > effect.maxRemainingHp)
    ) {
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
    const attackModifier = effect.attackBonus !== undefined
      ? {
          sourceInstanceId: source.instanceId,
          targetInstanceId: targetId,
          amount: effect.attackBonus,
          expiresAfterTurn: null,
          ...(effect.bonusMaxRemainingHp === undefined
            ? {}
            : { maxTargetRemainingHp: effect.bonusMaxRemainingHp }),
        }
      : undefined
    const damageReceivedModifier = effect.damageReceivedReduction !== undefined
      ? {
          sourceInstanceId: source.instanceId,
          targetInstanceId: targetId,
          amount: -effect.damageReceivedReduction,
          expiresAfterTurn: null,
          ...(effect.bonusMaxRemainingHp === undefined
            ? {}
            : { maxTargetRemainingHp: effect.bonusMaxRemainingHp }),
        }
      : undefined
    return {
      ...updatedState,
      attackModifiers: attackModifier
        ? [...updatedState.attackModifiers, attackModifier]
        : updatedState.attackModifiers,
      damageReceivedModifiers: damageReceivedModifier
        ? [...updatedState.damageReceivedModifiers, damageReceivedModifier]
        : updatedState.damageReceivedModifiers,
    }
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
    }), targetPlayerId, {
      triggerSkill: selected.length > 0,
      trashedCount: effect.side === 'self' ? selected.length : 0,
    })
  }

  if (effect.kind === 'support-to-hand') {
    const player = state.players[context.sourcePlayerId]
    const uniqueIds = [...new Set(selectedTargetIds)]
    const minimum = effect.keepCount ?? (effect.optional ? 0 : effect.amount)
    const maximum = effect.keepCount ?? (effect.anyNumber ? Number.MAX_SAFE_INTEGER : effect.amount)
    if (uniqueIds.length < minimum || uniqueIds.length > maximum) {
      throw new GameRuleError(
        effect.anyNumber
          ? '只能選擇支援區中的合法卡牌。'
          : effect.optional
            ? `最多選擇 ${effect.amount} 張支援卡。`
          : `必須選擇 ${effect.amount} 張支援卡。`,
      )
    }
    const selected = player.supportArea.filter(
      (support) =>
        uniqueIds.includes(support.card.instanceId) &&
        (effect.cardType === undefined ||
          support.card.type === effect.cardType) &&
        (effect.energyColor === undefined ||
          support.card.energyColor === effect.energyColor) &&
        (effect.maxLevel === undefined ||
          (support.card.type === 'cookie' &&
            support.card.level <= effect.maxLevel)),
    )
    if (selected.length !== uniqueIds.length) {
      throw new GameRuleError('選擇的卡片不在支援區。')
    }
    if (effect.keepCount !== undefined) {
      const returned = player.supportArea.filter(
        (support) => !uniqueIds.includes(support.card.instanceId),
      )
      if (returned.length === 0) return state
      return markSupportAreaDecreased(updatePlayer(state, {
        ...player,
        supportArea: selected,
        hand: [...player.hand, ...returned.map((support) => support.card)],
      }), context.sourcePlayerId)
    }
    if (selected.length === 0) return state
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
    const minimum = effect.optional ? 0 : effect.amount
    if (uniqueIds.length < minimum || uniqueIds.length > effect.amount) {
      throw new GameRuleError(
        effect.optional
          ? `最多選擇 ${effect.amount} 張手牌。`
          : `必須選擇 ${effect.amount} 張手牌。`,
      )
    }
    const selected = player.hand.filter(
      (card) =>
        card.instanceId !== context.sourceInstanceId &&
        uniqueIds.includes(card.instanceId) &&
        (effect.energyColor === undefined ||
          card.energyColor === effect.energyColor),
    )
    if (selected.length !== uniqueIds.length) {
      throw new GameRuleError('選擇的卡片不在手牌中。')
    }
    if (selected.length === 0) return state
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
    const candidates = getTrashCookieCandidates(state, context, effect)
    const uniqueIds = [...new Set(selectedTargetIds)]
    if (
      uniqueIds.length !== effect.amount &&
      !(effect.optional && uniqueIds.length === 0)
    ) {
      throw new GameRuleError(`必須選擇 ${effect.amount} 張棄牌區餅乾。`)
    }
    if (uniqueIds.length === 0) {
      return { ...state }
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
      cookiesPlayedFromTrashThisTurn: {
        ...(updated.cookiesPlayedFromTrashThisTurn ?? {}),
        [context.sourcePlayerId]: true,
      },
      nextBattleEntrySequence: state.nextBattleEntrySequence + 1,
      pendingOnPlay: cookie.skill?.trigger === 'on-play'
          ? {
              playerId: context.sourcePlayerId,
              sourceInstanceId: cookie.instanceId,
              origin: 'trash',
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
    const cookieCandidates = getTrashToSupportCandidates(state, context, effect)
    const uniqueIds = [...new Set(selectedTargetIds)]
    const min = effect.optional ? 0 : effect.amount
    if (uniqueIds.length < min || uniqueIds.length > effect.amount) {
      throw new GameRuleError(
        effect.optional
          ? `最多選擇 ${effect.amount} 張棄牌區餅乾。`
          : `必須選擇 ${effect.amount} 張棄牌區餅乾。`,
      )
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
        destination: effect.destination,
      },
    }
  }

  if (effect.kind === 'deferred-end-of-turn') {
    // 「Then, when your turn ends, ...」：現在只排隊，回合結束階段才結算。
    return {
      ...state,
      pendingEndOfTurnEffects: [
        ...(state.pendingEndOfTurnEffects ?? []),
        {
          playerId: context.sourcePlayerId,
          sourcePlayerId: context.sourcePlayerId,
          sourceInstanceId: context.sourceInstanceId,
          sourceCardName: context.sourceCardName ??
            state.players[context.sourcePlayerId].battleArea.find(
              (c) => c.card.instanceId === context.sourceInstanceId,
            )?.card.name ?? 'Unknown',
          effects: effect.effects,
          effectIndex: 0,
        },
      ],
    }
  }

  if (effect.kind === 'opponent-rests-support') {
    const targetPlayerId = getOpponentId(context.sourcePlayerId)
    const targetPlayer = state.players[targetPlayerId]
    const candidates = targetPlayer.supportArea.filter(
      (support) => !effect.activeOnly || !support.rested,
    )
    if (candidates.length < effect.amount) {
      return { ...state }
    }
    return {
      ...state,
      pendingOpponentRestSupport: {
        playerId: targetPlayerId,
        count: effect.amount,
        activeOnly: effect.activeOnly,
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

  if (effect.kind === 'discard-hand-all') {
    const player = state.players[context.sourcePlayerId]
    if (player.hand.length === 0) return state
    return updatePlayer(state, {
      ...player,
      hand: [],
      discardPile: [...player.discardPile, ...player.hand],
    })
  }

  if (effect.kind === 'opponent-battle-to-trash') {
    if (isOpponentBattleMovementPrevented(state, context.sourcePlayerId)) {
      return { ...state }
    }
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

  if (effect.kind === 'make-faint') {
    const candidates = getEffectTargetCandidates(state, context, effect.target)
    const uniqueIds = [...new Set(selectedTargetIds)]
    if (uniqueIds.length !== selectedTargetIds.length) {
      throw new GameRuleError('選擇的效果目標數量不合法。')
    }
    const min = effect.target.min
    const max = effect.target.max
    if (uniqueIds.length < min || uniqueIds.length > max) {
      throw new GameRuleError('選擇的效果目標數量不合法。')
    }
    if (uniqueIds.length === 0) {
      return { ...state }
    }
    const selectedCookies = uniqueIds.map((instanceId) =>
      candidates.find((cookie) => cookie.card.instanceId === instanceId),
    )
    if (selectedCookies.some((cookie) => !cookie)) {
      throw new GameRuleError('選擇的卡牌不是此效果的合法目標。')
    }
    const targets = selectedCookies as CookieInBattle[]

    let nextState = state
    for (const [ownerId, group] of groupTargetsByOwner(nextState, targets)) {
      const player = nextState.players[ownerId]
      const movedIds = new Set(group.map((c) => c.card.instanceId))
      const departedCards = group.map((c) => c.card)
      const hpCards = group.flatMap((c) => c.hpCards)
      const equippedCards = group.flatMap((c) => c.equippedCards ?? [])
      const updatedPlayer: PlayerState = {
        ...player,
        battleArea: player.battleArea.filter(
          (c) => !movedIds.has(c.card.instanceId),
        ),
        breakArea: [...player.breakArea, ...departedCards],
        discardPile: [
          ...player.discardPile,
          ...hpCards,
          ...equippedCards,
        ],
      }
      const updatedState = updatePlayer(nextState, updatedPlayer)
      const faintState = resolveDamageOutcome(
        updatedState,
        ownerId,
        group.length,
        departedCards,
      )
      nextState = checkWindsweptValleyTrigger(faintState, ownerId)
    }
    return nextState
  }

  if (effect.kind === 'field-to-trash') {
    const targetPlayerId = getTargetPlayerId(context, effect.target)
    const targetPlayer = state.players[targetPlayerId]

    const stageOnly = effect.stageOnly ?? false
    const battleMovementPrevented = isOpponentBattleMovementPrevented(
      state,
      context.sourcePlayerId,
    )
    const battleCandidates =
      stageOnly || battleMovementPrevented
        ? []
        : targetPlayer.battleArea.filter((cookie) => {
      if (
        isBlockedByOpponentEffectProtection(
          cookie,
          targetPlayerId,
          context.sourcePlayerId,
          {
            attackTargetOnly: effect.target.attackTargetOnly,
            attackTargetInstanceId: state.pendingBattle?.targetInstanceId,
          },
        )
      ) {
        return false
      }
      if (
        effect.target.attackTargetOnly &&
        cookie.card.instanceId !== state.pendingBattle?.targetInstanceId
      ) {
        return false
      }
      if (
        effect.target.excludeAttackTarget &&
        cookie.card.instanceId === state.pendingBattle?.targetInstanceId
      ) {
        return false
      }
      if (effect.target.maxLevel !== undefined && cookie.card.level > effect.target.maxLevel) return false
      if (effect.target.minLevel !== undefined && cookie.card.level < effect.target.minLevel) return false
      if (
        effect.target.remainingHp !== undefined &&
        cookie.hpCards.length > effect.target.remainingHp
      ) return false
      if (
        effect.target.maxRemainingHp !== undefined &&
        cookie.hpCards.length > effect.target.maxRemainingHp
      ) return false
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

    if (battleMovementPrevented) {
      return { ...state }
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
    if (isOpponentBattleMovementPrevented(state, context.sourcePlayerId)) {
      return { ...state }
    }
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

  if (effect.kind === 'field-to-deck-bottom-all') {
    if (isOpponentBattleMovementPrevented(state, context.sourcePlayerId)) {
      return { ...state }
    }
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
      const movedIds = new Set(matching.map((cookie) => cookie.card.instanceId))
      nextState = updatePlayer(nextState, {
        ...player,
        battleArea: player.battleArea.filter(
          (cookie) => !movedIds.has(cookie.card.instanceId),
        ),
        deck: [...player.deck, ...matching.map((cookie) => cookie.card)],
        discardPile: [
          ...player.discardPile,
          ...matching.flatMap((cookie) => cookie.hpCards),
          ...matching.flatMap((cookie) => cookie.equippedCards ?? []),
        ],
      })
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
    if (uniqueIds.length < (effect.min ?? 0)) {
      throw new GameRuleError(`至少必須選擇 ${effect.min ?? 0} 張棄牌區卡牌。`)
    }
    if (uniqueIds.length === 0) {
      return { ...state }
    }
    const candidateIds = new Set(candidates.map((card) => card.instanceId))
    if (uniqueIds.some((id) => !candidateIds.has(id))) {
      throw new GameRuleError('選擇的卡牌不在棄牌區的合法範圍內。')
    }
    const selectedSet = new Set(uniqueIds)
    const selected = effect.destination === 'bottom'
      ? uniqueIds.map((id) =>
          player.discardPile.find((card) => card.instanceId === id)!,
        )
      : player.discardPile.filter((card) =>
          selectedSet.has(card.instanceId),
        )
    return updatePlayer(state, {
      ...player,
      discardPile: player.discardPile.filter(
        (card) => !selectedSet.has(card.instanceId),
      ),
      deck:
        effect.destination === 'bottom'
          ? [...player.deck, ...selected]
          : shuffle([...player.deck, ...selected]),
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
        markCookieHpReduced(
          updatePlayer(state, updatedPlayer),
          targetPlayerId,
          [target.card.instanceId],
        ),
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
    return markCookieHpReduced(
      updatePlayer(state, updatedPlayer),
      targetPlayerId,
      [target.card.instanceId],
    )
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
          ? {
              playerId: context.sourcePlayerId,
              sourceInstanceId: cookie.instanceId,
              origin: 'break',
            }
          : null,
      pendingRefresh: exhausted
        ? { playerId: context.sourcePlayerId, remainingDraws: 0 }
        : updated.pendingRefresh,
    }
  }

  if (effect.kind === 'support-to-battle') {
    const player = state.players[context.sourcePlayerId]
    const candidates = getSupportToBattleCandidates(state, context, effect)
    const uniqueIds = [...new Set(selectedTargetIds)]
    if (uniqueIds.length > effect.amount) {
      throw new GameRuleError(`最多只能選擇 ${effect.amount} 張支援區餅乾。`)
    }
    if (uniqueIds.length === 0) {
      return { ...state }
    }
    const candidateIds = new Set(candidates.map((card) => card.instanceId))
    if (uniqueIds.some((id) => !candidateIds.has(id))) {
      throw new GameRuleError('選擇的餅乾不符合支援區登場條件。')
    }
    const cookie = candidates.find((card) => card.instanceId === uniqueIds[0])!
    const availableHpCards = player.deck.slice(0, cookie.hp)
    const updated = updatePlayer(state, {
      ...player,
      deck: player.deck.slice(cookie.hp),
      supportArea: player.supportArea.filter(
        (support) => support.card.instanceId !== cookie.instanceId,
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
          ? {
              playerId: context.sourcePlayerId,
              sourceInstanceId: cookie.instanceId,
              origin: 'support',
            }
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
          ? {
              playerId: context.sourcePlayerId,
              sourceInstanceId: sourceInBreak.instanceId,
              origin: 'break',
            }
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
    if (isOpponentBattleMovementPrevented(state, context.sourcePlayerId)) {
      return { ...state }
    }
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

  if (effect.kind === 'hand-to-break-by-level-sum') {
    const player = state.players[context.sourcePlayerId]
    const candidates = getHandToBreakBySumCandidates(state, context, effect)
    const uniqueIds = [...new Set(selectedTargetIds)]
    if (uniqueIds.length === 0) {
      return { ...state }
    }
    const candidateIds = new Set(candidates.map((card) => card.instanceId))
    if (uniqueIds.some((id) => !candidateIds.has(id))) {
      throw new GameRuleError('選擇的卡牌不在手牌的合法範圍內。')
    }
    const selectedSet = new Set(uniqueIds)
    const selected = candidates.filter((card) => selectedSet.has(card.instanceId)) as CookieCard[]
    const levelSum = selected.reduce((sum, card) => sum + card.level, 0)
    if (levelSum !== effect.targetSum) {
      throw new GameRuleError(`選擇的餅乾等級總和必須恰好為 ${effect.targetSum}。`)
    }
    return updatePlayer(state, {
      ...player,
      hand: player.hand.filter((card) => !selectedSet.has(card.instanceId)),
      breakArea: [...player.breakArea, ...selected],
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

    const nextState: GameState = markCookieHpReduced({
      ...state,
      players: {
        ...state.players,
        [targetPlayerId]: updatedPlayer,
      },
    }, targetPlayerId, [target.card.instanceId])

    if (departedCount > 0) {
      return resolveDamageOutcome(nextState, targetPlayerId, departedCount, [
        target.card,
      ])
    }

    return nextState
  }

  if (effect.kind === 'return-to-hand') {
    const candidates = getEffectTargetCandidates(state, context, effect.target)
    // 昏厥技能（When this Cookie faints）的「Return this Cookie to your
    // hand」：來源已離場躺在休息區，戰鬥區沒有候選，直接從休息區返回手牌
    // （BS5-026 DJ Cookie 的第二個昏厥效果）。
    if (
      effect.target.sourceOnly &&
      candidates.length === 0 &&
      context.sourceInstanceId
    ) {
      const player = state.players[context.sourcePlayerId]
      const breakSource = player.breakArea.find(
        (card) => card.instanceId === context.sourceInstanceId,
      )
      if (breakSource) {
        return updatePlayer(state, {
          ...player,
          breakArea: player.breakArea.filter(
            (card) => card.instanceId !== context.sourceInstanceId,
          ),
          hand: [...player.hand, breakSource],
        })
      }
    }
    if (isOpponentBattleMovementPrevented(state, context.sourcePlayerId)) {
      return { ...state }
    }
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
    if (isOpponentBattleMovementPrevented(state, context.sourcePlayerId)) {
      return { ...state }
    }
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
      // 自我返回（BS5-051 Beet Cookie 的回合結束效果）：若自己是最後一張
      // 餅乾，官方規則下應觸發補位流程，但引擎維持「戰鬥區至少 1 張」的
      // 既有約束，這種情況直接略過效果；對手的返回目標維持拋錯。
      if (effect.target.sourceOnly) {
        return { ...state }
      }
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

  if (effect.kind === 'field-to-deck-bottom') {
    const candidates = getEffectSelectionCandidates(state, context, effect)
    const uniqueIds = [...new Set(selectedTargetIds)]
    if (uniqueIds.length === 0 && effect.target.min === 0) {
      return state
    }
    if (uniqueIds.length < effect.target.min) {
      if (candidates.length === 0) return state
      throw new GameRuleError('Invalid field target.')
    }
    if (uniqueIds.length > effect.target.max || uniqueIds.length !== 1) {
      throw new GameRuleError('Invalid field target.')
    }
    const selectedId = uniqueIds[0]
    if (!candidates.some((card) => card.instanceId === selectedId)) {
      throw new GameRuleError('Invalid field target.')
    }

    for (const ownerId of ['player-one', 'player-two'] as PlayerId[]) {
      const owner = state.players[ownerId]
      if (owner.stage?.card.instanceId === selectedId) {
        return updatePlayer(state, {
          ...owner,
          stage: null,
          deck: [...owner.deck, owner.stage.card],
        })
      }
      const target = owner.battleArea.find(
        (cookie) => cookie.card.instanceId === selectedId,
      )
      if (target) {
        if (isOpponentBattleMovementPrevented(state, context.sourcePlayerId)) {
          return { ...state }
        }
        const updated = updatePlayer(state, {
          ...owner,
          battleArea: owner.battleArea.filter(
            (cookie) => cookie.card.instanceId !== selectedId,
          ),
          deck: [...owner.deck, target.card],
          discardPile: [
            ...owner.discardPile,
            ...target.hpCards,
            ...(target.equippedCards ?? []),
          ],
        })
        return checkWindsweptValleyTrigger(
          resolveNonFaintDepartureOutcome(updated, ownerId, 1),
          ownerId,
        )
      }
    }
    throw new GameRuleError('Invalid field target.')
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
        selectedIds.size > effect.supportCount ||
        (effect.optional === false && selectedIds.size !== effect.supportCount)
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
          extraHp: effect.extraHp,
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
        extraHp: effect.extraHp,
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
        condition: effect.condition,
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
    effect.kind === 'disable-block' ||
    effect.kind === 'disable-traps' ||
    effect.kind === 'multiply-attack-damage'
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
    if (effect.kind === 'disable-traps' && state.pendingBattle) {
      return {
        ...state,
        pendingBattle: {
          ...state.pendingBattle,
          trapsDisabled: true,
        },
      }
    }
    return state
  }

  if (effect.kind === 'hp-to-trash-all') {
    const targetPlayerId =
      effect.side === 'self'
        ? context.sourcePlayerId
        : getOpponentId(context.sourcePlayerId)
    const targetIds = state.players[targetPlayerId].battleArea.map(
      (cookie) => cookie.card.instanceId,
    )
    let nextState = state
    for (const targetId of targetIds) {
      nextState = executeCardEffect(
        nextState,
        context,
        {
          kind: 'hp-to-trash',
          amount: effect.amount,
          target: { side: effect.side, min: 1, max: 1 },
        },
        [targetId],
        shuffle,
      )
      if (nextState.status !== 'playing') break
    }
    return nextState
  }

  if (effect.kind === 'rest-cookie') {
    const targets = selectEffectTargets(
      state,
      context,
      effect.target,
      selectedTargetIds,
    )
    if (targets.length === 0) return state
    let nextState = state
    for (const [ownerId, ownedTargets] of groupTargetsByOwner(state, targets)) {
      const targetIds = new Set(
        ownedTargets.map((target) => target.card.instanceId),
      )
      nextState = updatePlayer(nextState, {
        ...nextState.players[ownerId],
        battleArea: nextState.players[ownerId].battleArea.map((cookie) =>
          targetIds.has(cookie.card.instanceId)
            ? { ...cookie, rested: true }
            : cookie,
        ),
      })
    }
    return nextState
  }

  if (effect.kind === 'break-source-to-trash') {
    const player = state.players[context.sourcePlayerId]
    const source = player.breakArea.find(
      (card) => card.instanceId === context.sourceInstanceId,
    )
    if (!source) return state
    return updatePlayer(state, {
      ...player,
      battleArea: player.battleArea.filter(
        (cookie) => cookie.card.instanceId !== context.sourceInstanceId,
      ),
      breakArea: player.breakArea.filter(
        (card) => card.instanceId !== context.sourceInstanceId,
      ),
      discardPile: [...player.discardPile, source],
    })
  }

  if (effect.kind === 'reveal-hand') {
    const cards = state.players[context.sourcePlayerId].hand.filter(
      (card) =>
        effect.keyword === undefined || card.keywords?.includes(effect.keyword),
    )
    if (cards.length < effect.amount) return state
    return state
  }

  if (!('target' in effect)) {
    throw new GameRuleError('此效果需要目標。')
  }

  if (
    effect.kind === 'battle-to-support' &&
    isOpponentBattleMovementPrevented(state, context.sourcePlayerId)
  ) {
    return { ...state }
  }

  const targets = selectEffectTargets(
    state,
    context,
    effect.target,
    selectedTargetIds,
  )
  const targetPlayerId = getTargetPlayerId(context, effect.target)

  if (
    effect.kind === 'damage' ||
    effect.kind === 'damage-by-break-count' ||
    effect.kind === 'damage-by-break-level-difference'
  ) {
    const amount =
      effect.kind === 'damage'
        ? effect.amount
        : effect.kind === 'damage-by-break-count'
          ? getBreakCount(state, context.sourcePlayerId, effect) *
            effect.perCount
          : Math.max(
              0,
              getBreakAreaLevel(state, context.sourcePlayerId) -
                getBreakAreaLevel(state, getOpponentId(context.sourcePlayerId)),
            )
    const previousBattleAreaCount =
      state.players[targetPlayerId].battleArea.length
    const protectedTargets = targets.filter(
      (target) => !isEffectDamagePrevented(state, target, targetPlayerId),
    )
    const effectDamageTargets: EffectDamageTarget[] = protectedTargets.map(
      (target) => ({
        playerId: targetPlayerId,
        instanceId: target.card.instanceId,
        damage: amount,
      }),
    )
    const pendingEffectDamage = beginEffectDamageSequence(
      state,
      context,
      effectDamageTargets,
    )
    if (pendingEffectDamage) return pendingEffectDamage

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
      markCookieHpReduced(
        {
        ...state,
        players: {
          ...state.players,
          [targetPlayerId]: damagedPlayer,
        },
        },
        targetPlayerId,
        protectedTargets.map((target) => target.card.instanceId),
      ),
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
      targets[0] && !isEffectDamagePrevented(state, targets[0], targetPlayerId)
        ? targets[0]
        : undefined,
      targets[1] && !isEffectDamagePrevented(state, targets[1], targetPlayerId)
        ? targets[1]
        : undefined,
    ] as const
    const amounts = [effect.primaryAmount, effect.secondaryAmount] as const
    const appliedList = appliedTargets.flatMap((target, index) =>
      target ? [{ target, amount: amounts[index] }] : [],
    )
    const effectDamageTargets: EffectDamageTarget[] = appliedList.map(
      ({ target, amount }) => ({
        playerId: targetPlayerId,
        instanceId: target.card.instanceId,
        damage: amount,
      }),
    )
    const pendingEffectDamage = beginEffectDamageSequence(
      state,
      context,
      effectDamageTargets,
    )
    if (pendingEffectDamage) return pendingEffectDamage

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
      markCookieHpReduced(
        {
          ...state,
          players: {
            ...state.players,
            [targetPlayerId]: damagedPlayer,
          },
        },
        targetPlayerId,
        appliedList
          .filter(({ amount }) => amount > 0)
          .map(({ target }) => target.card.instanceId),
      ),
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
    const nextState: GameState = {
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
    if (
      effect.trashSourceIfTargetLevel !== undefined &&
      targets.some((target) => target.card.level === effect.trashSourceIfTargetLevel)
    ) {
      const sourcePlayer = nextState.players[context.sourcePlayerId]
      const sourceStage = sourcePlayer.stage
      if (sourceStage?.card.instanceId === context.sourceInstanceId) {
        return updatePlayer(nextState, {
          ...sourcePlayer,
          stage: null,
          discardPile: [...sourcePlayer.discardPile, sourceStage.card],
        })
      }
    }
    return nextState
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
        ...movedCards.map((card) => ({ card, rested: effect.rested ?? false })),
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

  if (effect.kind === 'modify-attack-cost') {
    return {
      ...state,
      attackCostModifiers: [
        ...(state.attackCostModifiers ?? []),
        ...targets.map((target) => ({
          sourceInstanceId: context.sourceInstanceId,
          targetInstanceId: target.card.instanceId,
          energyCost: { ...effect.energyCost },
          expiresAfterTurn: getExpirationTurn(state, effect.duration),
        })),
      ],
    }
  }

  if (
    effect.kind === 'modify-attack' ||
    effect.kind === 'modify-attack-by-break-count'
  ) {
    const updatedState: GameState = {
      ...state,
      attackModifiers: [...state.attackModifiers, ...modifiers],
    }
    if (
      effect.kind === 'modify-attack' &&
      effect.thenDrawUpToIfTargetRemainingHp &&
      targets.some(
        (target) =>
          getCookieEffectiveHp(target) ===
          effect.thenDrawUpToIfTargetRemainingHp!.remainingHp,
      )
    ) {
      return {
        ...updatedState,
        pendingDrawUpTo: {
          playerId: context.sourcePlayerId,
          max: effect.thenDrawUpToIfTargetRemainingHp.max,
          sourcePlayerId: context.sourcePlayerId,
          sourceInstanceId: context.sourceInstanceId,
          sourceCardName: context.sourceCardName ?? 'Unknown',
        },
      }
    }
    return updatedState
  }

  return {
    ...state,
    damageReceivedModifiers: [
      ...state.damageReceivedModifiers,
      ...modifiers,
    ],
  }
}

/**
 * 效果傷害必須沿用戰鬥的逐點傷害流程，才能在每一張 HP 卡翻開時觸發
 * FLIP。沒有可翻開的 FLIP 卡時仍可沿用原本的同步路徑，避免讓不需要玩家
 * 決策的效果平白多出一個戰鬥視窗。
 */
const hasEffectDamageFlip = (
  state: GameState,
  targets: readonly EffectDamageTarget[],
): boolean =>
  targets.some(({ playerId, instanceId, damage }) => {
    if (damage <= 0) return false
    const cookie = state.players[playerId].battleArea.find(
      (candidate) => candidate.card.instanceId === instanceId,
    )
    if (!cookie) return false
    const firstRemovedIndex = Math.max(0, cookie.hpCards.length - damage)
    return cookie.hpCards
      .slice(firstRemovedIndex)
      .some((card) => Boolean(card.flip?.effects.length))
  })

const getEffectDamageContinuation = (
  state: GameState,
): EffectDamageContinuation => {
  if (state.pendingAbilityEffect) return 'ability-effect'
  if (state.pendingBattle?.stage === 'attack-effect') {
    return 'attack-effect'
  }
  if (state.pendingBattle?.stage === 'trap') return 'after-trap'
  return 'finish-battle'
}

/**
 * 建立效果傷害的 PendingBattle。這個 helper 只負責把傷害交給既有的
 * resolveNextDamage／resolveFlip state machine；非傷害 HP 移動不會經過這裡。
 */
export const beginEffectDamageSequence = (
  state: GameState,
  context: EffectContext,
  targets: readonly EffectDamageTarget[],
): GameState | null => {
  const normalizedTargets = targets.filter((target) => target.damage > 0)
  if (
    normalizedTargets.length === 0 ||
    !hasEffectDamageFlip(state, normalizedTargets)
  ) {
    return null
  }

  const [first, ...remainingTargets] = normalizedTargets
  const existingBattle = state.pendingBattle
  const continuation = getEffectDamageContinuation(state)
  const pendingBattle: PendingBattle = existingBattle
    ? {
        ...existingBattle,
        targetInstanceId: first.instanceId,
        declaredDamage: first.damage,
        remainingDamage: first.damage,
        stage: 'damage',
        revealedHpCard: null,
        damagePlayerId: first.playerId,
        damageTargetInstanceId: first.instanceId,
        damagedInstanceIds: [],
      }
    : {
        attackerPlayerId: context.sourcePlayerId,
        defenderPlayerId: first.playerId,
        attackerInstanceId: context.sourceInstanceId,
        targetInstanceId: first.instanceId,
        declaredDamage: first.damage,
        remainingDamage: first.damage,
        stage: 'damage',
        trapUsed: true,
        revealedHpCard: null,
        preventKnockoutTargetIds: [],
        faintedColors: [],
        attackEffects: [],
        attackEffectIndex: 0,
        damagePlayerId: first.playerId,
        damageTargetInstanceId: first.instanceId,
        damagedInstanceIds: [],
      }

  return {
    ...state,
    pendingBattle: {
      ...pendingBattle,
      effectDamageSequence: {
        remainingTargetInstanceIds: remainingTargets.map(
          (target) => target.instanceId,
        ),
        damage: first.damage,
        remainingTargets: remainingTargets.map((target) => ({ ...target })),
        continuation,
        resumeBattleAfterAbility:
          continuation === 'ability-effect' && Boolean(existingBattle),
      },
    },
  }
}

/**
 * 兩階段選擇的第二階段（cycle-hp BS4-030 / hand-to-hp BS4-044）：把最多
 * 1 張手牌放回目標餅乾 HP 最上方。目標在第一階段昏厥離場時不允許呼叫
 * （引擎不會建立該決策），`handCardInstanceId` 省略時視為略過放置。
 */
export const placeHandCardOnHp = (
  state: GameState,
  context: EffectContext,
  targetInstanceId: string,
  handCardInstanceId?: string,
): GameState => {
  if (state.status !== 'playing') {
    throw new GameRuleError('只有進行中的遊戲可以執行卡牌效果。')
  }
  const player = state.players[context.sourcePlayerId]
  const target = player.battleArea.find(
    (cookie) => cookie.card.instanceId === targetInstanceId,
  )
  if (!target) {
    throw new GameRuleError('目標餅乾已不在戰鬥區，無法放置 HP。')
  }
  const selectedCard = handCardInstanceId
    ? player.hand.find((card) => card.instanceId === handCardInstanceId)
    : undefined
  if (handCardInstanceId && !selectedCard) {
    throw new GameRuleError('手牌中沒有這張卡。')
  }
  return updatePlayer(state, {
    ...player,
    hand: selectedCard
      ? player.hand.filter(
          (card) => card.instanceId !== selectedCard.instanceId,
        )
      : player.hand,
    battleArea: player.battleArea.map((cookie) =>
      cookie.card.instanceId === targetInstanceId
        ? {
            ...cookie,
            hpCards: selectedCard
              ? [...cookie.hpCards, selectedCard]
              : cookie.hpCards,
          }
        : cookie,
    ),
  })
}
