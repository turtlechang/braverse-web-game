import { GameRuleError } from './errors'
import { drawCards, getOpponentId, updatePlayer } from './helpers'
import { getRefreshCandidates } from './refresh'
import {
  executeCardEffect,
  isEffectConditionMet,
  requiresEffectCardSelection,
} from './effects'
import { hasBlockingPending } from './pending'
import type {
  CookieCard,
  EndPhaseScope,
  EffectContext,
  GameState,
  PlayerId,
  TurnPhase,
} from './types'
import { finishWithDefeat } from './victory'

const assertPlaying = (state: GameState) => {
  if (state.status !== 'playing') {
    throw new GameRuleError('只有進行中的遊戲可以推進回合。')
  }

  if (state.pendingReplacement) {
    throw new GameRuleError('必須先補充戰鬥區餅乾。')
  }

  if (state.pendingOnPlay) {
    throw new GameRuleError('必須先處理餅乾的登場效果。')
  }

  if (state.pendingRefresh) {
    throw new GameRuleError('必須先完成牌庫 Refresh。')
  }

  if (state.pendingBattle) {
    throw new GameRuleError('必須先完成目前的戰鬥。')
  }

  if (state.pendingAbilityEffect) {
    throw new GameRuleError('必須先完成目前的技能/道具/場景效果。')
  }

  if (state.pendingOpponentHandDiscard) {
    throw new GameRuleError('必須先處理對手棄牌。')
  }
}

/**
 * 消耗一個 BS8-076 型的條件式 active 阻止標記。玩家沒有棄牌（或已無法
 * 棄足）時，才把它轉入既有的一般 prevent map；有棄足時直接移除，交回普通
 * Active Phase 的全場設為 active 邏輯。
 */
const consumeConditionalCookieActivePrevention = (
  state: GameState,
  playerId: PlayerId,
  cookieInstanceId: string,
  keepRested: boolean,
): GameState => {
  const existing = state.conditionalCookieActivePreventions?.[playerId] ?? []
  const remaining = existing.filter(
    (entry) => entry.cookieInstanceId !== cookieInstanceId,
  )
  const remainingConditional = {
    ...(state.conditionalCookieActivePreventions ?? {}),
  }
  if (remaining.length > 0) {
    remainingConditional[playerId] = remaining
  } else {
    delete remainingConditional[playerId]
  }

  const existingPreventions = state.preventCookieActiveNextPhase?.[playerId] ?? []
  const nextPreventions = keepRested
    ? {
        ...(state.preventCookieActiveNextPhase ?? {}),
        [playerId]: [...new Set([...existingPreventions, cookieInstanceId])],
      }
    : state.preventCookieActiveNextPhase

  return {
    ...state,
    ...(Object.keys(remainingConditional).length > 0
      ? { conditionalCookieActivePreventions: remainingConditional }
      : { conditionalCookieActivePreventions: undefined }),
    ...(nextPreventions && Object.keys(nextPreventions).length > 0
      ? { preventCookieActiveNextPhase: nextPreventions }
      : { preventCookieActiveNextPhase: undefined }),
  }
}

const activateCurrentPlayer = (state: GameState): GameState => {
  let activationState = state

  // 條件式標記要到「目標控制者下一個 Active Phase」才詢問。若沒有足夠手牌，
  // 沒有可作出的選擇，直接消耗標記並維持 rested；多個標記則依建立順序逐一處理。
  while (true) {
    const pending =
      activationState.conditionalCookieActivePreventions?.[
        activationState.activePlayerId
      ]?.[0]
    if (!pending) break

    const player = activationState.players[activationState.activePlayerId]
    const targetExists = player.battleArea.some(
      (cookie) => cookie.card.instanceId === pending.cookieInstanceId,
    )
    if (!targetExists || player.hand.length < pending.discardHandToSetActive) {
      activationState = consumeConditionalCookieActivePrevention(
        activationState,
        activationState.activePlayerId,
        pending.cookieInstanceId,
        targetExists,
      )
      continue
    }

    return {
      ...activationState,
      pendingOpponentHandDiscard: {
        playerId: activationState.activePlayerId,
        count: pending.discardHandToSetActive,
        optional: true,
        sourcePlayerId: pending.sourcePlayerId,
        sourceInstanceId: pending.sourceInstanceId,
        sourceCardName: pending.sourceCardName,
        effectText: pending.effectText,
        activePhaseCookieInstanceId: pending.cookieInstanceId,
      },
    }
  }

  const player = activationState.players[activationState.activePlayerId]
  const preventedCookieIds = new Set(
    activationState.preventCookieActiveNextPhase?.[activationState.activePlayerId] ?? [],
  )
  const preventedSupportIds = new Set(
    activationState.preventSupportActiveNextPhase?.[activationState.activePlayerId] ?? [],
  )
  const remainingPreventions = {
    ...(activationState.preventCookieActiveNextPhase ?? {}),
  }
  delete remainingPreventions[activationState.activePlayerId]
  const remainingSupportPreventions = {
    ...(activationState.preventSupportActiveNextPhase ?? {}),
  }
  delete remainingSupportPreventions[activationState.activePlayerId]

  const activatedState = updatePlayer(activationState, {
    ...player,
    battleArea: player.battleArea.map((cookie) => ({
      ...cookie,
      rested: preventedCookieIds.has(cookie.card.instanceId)
        ? cookie.rested
        : false,
    })),
    supportArea: player.supportArea.map((support) => ({
      ...support,
      rested: preventedSupportIds.has(support.card.instanceId)
        ? support.rested
        : false,
    })),
    stage: player.stage ? { ...player.stage, rested: false } : null,
  })

  return {
    ...activatedState,
    ...(Object.keys(remainingPreventions).length > 0
      ? { preventCookieActiveNextPhase: remainingPreventions }
      : { preventCookieActiveNextPhase: undefined }),
    ...(Object.keys(remainingSupportPreventions).length > 0
      ? { preventSupportActiveNextPhase: remainingSupportPreventions }
      : { preventSupportActiveNextPhase: undefined }),
    cookiesFaintedThisTurn: {
      ...(activatedState.cookiesFaintedThisTurn ?? {}),
      [activationState.activePlayerId]: 0,
      [getOpponentId(activationState.activePlayerId)]: 0,
    } as Record<PlayerId, number>,
    supportCardsTrashedThisTurn: {},
    arenaCookiesPlacedInBreakThisTurn: {},
    itemsActivatedThisTurn: {},
    cookiesHpReducedThisTurn: {},
    arenaCookieDealtEffectDamageThisTurn: {},
    cookiesPlayedFromTrashThisTurn: {},
    extraDeckPlayUsedThisTurn: false,
  }
}

const completeActivePhase = (state: GameState): GameState => {
  const activatedState = activateCurrentPlayer(state)
  if (activatedState.pendingOpponentHandDiscard) return activatedState

  if (activatedState.turnNumber === 1) {
    return { ...activatedState, phase: 'support' }
  }

  return enterDrawPhase({ ...activatedState, phase: 'draw' })
}

/**
 * BS8-076：處理選擇棄牌後，消耗該 Cookie 的唯一條件式標記並回到同一個
 * Active Phase。`discardedForActivation` 為 false 時，目標仍會留在 rested。
 */
export const resumeActivePhaseAfterCookieDiscard = (
  state: GameState,
  playerId: PlayerId,
  cookieInstanceId: string,
  discardedForActivation: boolean,
): GameState => {
  if (state.phase !== 'active' || state.activePlayerId !== playerId) {
    throw new GameRuleError('目前不是可恢復的 Active Phase。')
  }
  const pending = state.conditionalCookieActivePreventions?.[playerId]?.find(
    (entry) => entry.cookieInstanceId === cookieInstanceId,
  )
  if (!pending) {
    throw new GameRuleError('目前沒有等待此餅乾的 Active Phase 棄牌決策。')
  }

  return completeActivePhase(
    consumeConditionalCookieActivePrevention(
      state,
      playerId,
      cookieInstanceId,
      !discardedForActivation,
    ),
  )
}

const getEndPhaseSkills = (
  state: GameState,
  playerId: PlayerId,
  endingPlayerId: PlayerId,
): { cookie: CookieCard; index: number }[] =>
  state.players[playerId].battleArea
    .map((cookie, index) => ({ cookie: cookie.card, index }))
    .filter((item) => {
      const skill = item.cookie.skill
      const scope: EndPhaseScope = skill?.endPhaseScope ?? 'your-turn'
      const expectedScope: EndPhaseScope =
        playerId === endingPlayerId ? 'your-turn' : 'opponent-turn'
      return (
        skill?.endPhase &&
        scope === expectedScope &&
        !state.skillUsesThisTurn.includes(item.cookie.instanceId)
      )
    })

const enterDrawPhase = (state: GameState): GameState => {
  const activePlayer = state.players[state.activePlayerId]
  const drawAmount = Math.min(activePlayer.deck.length, 2)
  const updatedState = updatePlayer(
    state,
    drawCards(activePlayer, drawAmount),
  )
  const remainingDraws = 2 - drawAmount

  if (updatedState.players[state.activePlayerId].deck.length > 0) {
    return updatedState
  }

  if (getRefreshCandidates(updatedState, state.activePlayerId).length === 0) {
    return finishWithDefeat(
      updatedState,
      state.activePlayerId,
      'refresh-unavailable',
    )
  }

  return {
    ...updatedState,
    pendingRefresh: {
      playerId: state.activePlayerId,
      remainingDraws,
    },
  }
}

export const processEndPhaseEffects = (state: GameState): GameState => {
  if (hasBlockingPending(state)) {
    return state
  }

  const players = [
    state.activePlayerId,
    getOpponentId(state.activePlayerId),
  ]

  let nextState = state

  for (const playerId of players) {
    const skills = getEndPhaseSkills(nextState, playerId, state.activePlayerId)
    for (const { cookie } of skills) {
      const skill = cookie.skill!
      const context = {
        sourcePlayerId: playerId,
        sourceInstanceId: cookie.instanceId,
      }

      for (const [effectIndex, effect] of skill.effects.entries()) {
        if (!isEffectConditionMet(nextState, context, effect)) {
          continue
        }

        if (requiresEffectCardSelection(effect)) {
          // End-phase skills used to silently drop targeted effects because
          // the old path only executed effects classified as untargeted. Put
          // the remaining effect chain into the same pending channel used by
          // activated skills so the UI/AI can choose and resolve targets.
          return {
            ...nextState,
            skillUsesThisTurn: [
              ...nextState.skillUsesThisTurn,
              cookie.instanceId,
            ],
            pendingAbilityEffect: {
              playerId,
              sourcePlayerId: playerId,
              sourceInstanceId: cookie.instanceId,
              sourceCardName: cookie.name,
              sourceKind: 'skill',
              trigger: 'passive',
              effects: skill.effects.slice(effectIndex),
              effectIndex: 0,
            },
          }
        }

        nextState = executeCardEffect(nextState, context, effect, [])
        if (nextState.status !== 'playing') {
          return nextState
        }
        if (hasBlockingPending(nextState)) {
          return {
            ...nextState,
            skillUsesThisTurn: [
              ...nextState.skillUsesThisTurn,
              cookie.instanceId,
            ],
          }
        }
      }

      nextState = {
        ...nextState,
        skillUsesThisTurn: [
          ...nextState.skillUsesThisTurn,
          cookie.instanceId,
        ],
      }
    }

    // 場景卡的「When your turn ends, ...」被動觸發（BS5-066 Longan Palace）。
    // 效果鏈一律交進 pendingAbilityEffect 佇列，讓回合結束流程能在棄牌、抽牌
    // 等互動決策之間存活，不會因為第一個效果就卡住而丟掉後續效果。
    const stage = nextState.players[playerId].stage
    const stageAbility = stage?.card.stageAbility
    if (
      stage &&
      stageAbility?.endPhase &&
      (stageAbility.endPhaseScope ?? 'your-turn') ===
        (playerId === state.activePlayerId ? 'your-turn' : 'opponent-turn') &&
      !nextState.skillUsesThisTurn.includes(stage.card.instanceId)
    ) {
      const stageContext: EffectContext = {
        sourcePlayerId: playerId,
        sourceInstanceId: stage.card.instanceId,
        sourceCardName: stage.card.name,
      }
      const applicableEffects = stageAbility.effects.filter((effect) =>
        isEffectConditionMet(nextState, stageContext, effect),
      )
      if (applicableEffects.length > 0) {
        return {
          ...nextState,
          skillUsesThisTurn: [
            ...nextState.skillUsesThisTurn,
            stage.card.instanceId,
          ],
          pendingAbilityEffect: {
            playerId,
            sourcePlayerId: playerId,
            sourceInstanceId: stage.card.instanceId,
            sourceCardName: stage.card.name,
            sourceKind: 'stage',
            trigger: 'passive',
            effects: applicableEffects,
            effectIndex: 0,
          },
        }
      }
      nextState = {
        ...nextState,
        skillUsesThisTurn: [
          ...nextState.skillUsesThisTurn,
          stage.card.instanceId,
        ],
      }
    }
  }

  // 排空「Then, when your turn ends, ...」的延遲效果（BS5-056／060）。
  const deferred = nextState.pendingEndOfTurnEffects ?? []
  if (
    deferred.length > 0 &&
    deferred[0].sourcePlayerId === state.activePlayerId
  ) {
    const entry = deferred[0]
    const context: EffectContext = {
      sourcePlayerId: entry.sourcePlayerId,
      sourceInstanceId: entry.sourceInstanceId,
      sourceCardName: entry.sourceCardName,
    }
    for (let index = entry.effectIndex; index < entry.effects.length; index += 1) {
      const effect = entry.effects[index]
      if (!isEffectConditionMet(nextState, context, effect)) {
        continue
      }
      if (requiresEffectCardSelection(effect)) {
        // 剩餘效果鏈交由 pendingAbilityEffect 佇列逐步處理，入口移出佇列。
        return {
          ...nextState,
          pendingEndOfTurnEffects: deferred.slice(1),
          pendingAbilityEffect: {
            playerId: entry.playerId,
            sourcePlayerId: entry.sourcePlayerId,
            sourceInstanceId: entry.sourceInstanceId,
            sourceCardName: entry.sourceCardName,
            sourceKind: 'skill',
            effects: entry.effects.slice(index),
            effectIndex: 0,
          },
        }
      }
      nextState = executeCardEffect(nextState, context, effect, [])
      if (nextState.status !== 'playing') {
        return nextState
      }
      if (hasBlockingPending(nextState)) {
        // 目前效果產生互動決策（抽牌、棄牌等）：保留剩餘效果，決策解決後
        // 重新進入回合結束流程時從下一個效果繼續。
        return {
          ...nextState,
          pendingEndOfTurnEffects: [
            { ...entry, effectIndex: index + 1 },
            ...deferred.slice(1),
          ],
        }
      }
    }
    nextState = {
      ...nextState,
      pendingEndOfTurnEffects: deferred.slice(1),
    }
  }

  return nextState
}

export const advancePhase = (state: GameState): GameState => {
  assertPlaying(state)

  switch (state.phase) {
    case 'active':
      return completeActivePhase(state)
    case 'draw':
      return { ...state, phase: 'support' }
    case 'support':
      return { ...state, phase: 'main' }
    case 'main':
      return { ...state, phase: 'end' }
    case 'end': {
      const endPhaseState = processEndPhaseEffects(state)
      if (hasBlockingPending(endPhaseState)) {
        return endPhaseState
      }
      return {
        ...endPhaseState,
        attackModifiers: endPhaseState.attackModifiers.filter(
          (modifier) =>
            modifier.expiresAfterTurn === null ||
            modifier.expiresAfterTurn > state.turnNumber,
        ),
        damageReceivedModifiers: endPhaseState.damageReceivedModifiers.filter(
          (modifier) =>
            modifier.expiresAfterTurn === null ||
            modifier.expiresAfterTurn > state.turnNumber,
        ),
        attackCostModifiers: (endPhaseState.attackCostModifiers ?? []).filter(
          (modifier) =>
            modifier.expiresAfterTurn === null ||
            modifier.expiresAfterTurn > state.turnNumber,
        ),
        flipDisabledUntilTurn: Object.fromEntries(
          Object.entries(endPhaseState.flipDisabledUntilTurn ?? {}).filter(
            ([, turn]) => turn > state.turnNumber,
          ),
        ),
        attackDisabledUntilTurn: Object.fromEntries(
          Object.entries(endPhaseState.attackDisabledUntilTurn ?? {}).filter(
            ([, turn]) => turn > state.turnNumber,
          ),
        ),
        blockDisabledUntilTurn: Object.fromEntries(
          Object.entries(endPhaseState.blockDisabledUntilTurn ?? {}).filter(
            ([, turn]) => turn > state.turnNumber,
          ),
        ),
        activePlayerId: getOpponentId(state.activePlayerId),
        turnNumber: state.turnNumber + 1,
        phase: 'active',
        supportPlacedThisTurn: false,
        supportAreaDecreasedThisTurn: {},
        cookiesGainedHpThisTurn: {},
        cookiesPlayedFromTrashThisTurn: {},
        skillUsesThisTurn: [],
      }
    }
  }
}

export const canAttack = (state: GameState): boolean =>
  state.status === 'playing' &&
  !hasBlockingPending(state) &&
  state.phase === 'main' &&
  !(state.turnNumber === 1 && state.activePlayerId === state.firstPlayerId)

export const TURN_PHASES: TurnPhase[] = [
  'active',
  'draw',
  'support',
  'main',
  'end',
]
