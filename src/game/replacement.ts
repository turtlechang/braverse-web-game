import { getOpponentId } from './helpers'
import { hasBlockingPending } from './pending'
import type {
  CookieCard,
  GameState,
  PlayerId,
  ReplacementTask,
} from './types'
import { resolveBreakLevelVictory } from './victory'

const buildReplacementTasks = (
  state: GameState,
): ReplacementTask[] => {
  const remainingByPlayer: Record<PlayerId, number> = {
    'player-one': state.departedCookieCounts['player-one'],
    'player-two': state.departedCookieCounts['player-two'],
  }

  for (const task of state.pendingReplacement?.tasks ?? []) {
    remainingByPlayer[task.playerId] += task.remaining
  }

  return [
    state.activePlayerId,
    getOpponentId(state.activePlayerId),
  ].flatMap((playerId) =>
    remainingByPlayer[playerId] > 0
      ? [{ playerId, remaining: remainingByPlayer[playerId] }]
      : [],
  )
}

export const getCurrentReplacementTask = (
  state: GameState,
): ReplacementTask | null =>
  state.pendingReplacement?.tasks[0] ?? null

export const getReplacementCandidates = (
  state: GameState,
  playerId: PlayerId,
): CookieCard[] => {
  const player = state.players[playerId]
  if (player.battleArea.length >= 2) {
    return []
  }

  return player.hand.filter(
    (card): card is CookieCard => card.type === 'cookie',
  )
}

export const recordCookieDepartures = (
  state: GameState,
  playerId: PlayerId,
  count: number,
): GameState => {
  if (count <= 0) return state

  return {
    ...state,
    departedCookieCounts: {
      ...state.departedCookieCounts,
      [playerId]: state.departedCookieCounts[playerId] + count,
    },
  }
}

export const clearDepartedCookieModifiers = (state: GameState): GameState => {
  const livingCookieIds = new Set(
    Object.values(state.players).flatMap((player) =>
      player.battleArea.map((cookie) => cookie.card.instanceId),
    ),
  )

  return {
    ...state,
    attackModifiers: state.attackModifiers.filter((modifier) =>
      livingCookieIds.has(modifier.targetInstanceId),
    ),
    damageReceivedModifiers: state.damageReceivedModifiers.filter((modifier) =>
      livingCookieIds.has(modifier.targetInstanceId),
    ),
    attackCostModifiers: (state.attackCostModifiers ?? []).filter((modifier) =>
      livingCookieIds.has(modifier.targetInstanceId),
    ),
  }
}

export const continuePendingReplacements = (
  state: GameState,
): GameState => {
  if (state.status !== 'playing') {
    return state
  }

  // 先檢查所有尚未完成的效果，再建立補位任務。
  //
  // `pendingFaintEffects`、`pendingAbilityEffect` 與 effect-order 都可能是
  // 造成餅乾離場的同一條卡牌效果鏈的一部分。若在這裡先建立
  // `pendingReplacement`，UI 會先開補位／替代餅乾的登場視窗，原效果就會被
  // 掛起；特別是替代餅乾帶 OnPlay 時，會形成兩個同時待處理的決策。
  // 因此補位只在整條效果鏈清空後才建立，讓所有正式入口（離場代價、戰鬥傷害、
  // 昏厥效果、攻擊者擊倒觸發技能）共用相同優先序。
  const tempState = {
    ...state,
    pendingReplacement: null,
  }
  if (state.pendingEffectOrder || hasBlockingPending(tempState)) {
    return state
  }

  const tasks = buildReplacementTasks(state).filter(
    (task) => task.remaining > 0,
  )
  if (tasks.length === 0) {
    return {
      ...state,
      departedCookieCounts: {
        'player-one': 0,
        'player-two': 0,
      },
      pendingReplacement: null,
    }
  }

  const nextState = {
    ...state,
    departedCookieCounts: {
      'player-one': 0,
      'player-two': 0,
    },
    pendingReplacement: { tasks },
  }
  return nextState
}

export const finalizePendingReplacements = (
  state: GameState,
): GameState => {
  const victoryState = resolveBreakLevelVictory(state)
  if (victoryState.status !== 'playing') {
    return victoryState
  }

  return continuePendingReplacements(victoryState)
}

export const consumeReplacementTask = (
  state: GameState,
  playerId: PlayerId,
): GameState => {
  const tasks = state.pendingReplacement?.tasks ?? []
  const currentTask = tasks[0]
  if (!currentTask || currentTask.playerId !== playerId) {
    return state
  }

  const nextTasks =
    currentTask.remaining > 1
      ? [
          { ...currentTask, remaining: currentTask.remaining - 1 },
          ...tasks.slice(1),
        ]
      : tasks.slice(1)

  return {
    ...state,
    pendingReplacement:
      nextTasks.length > 0 ? { tasks: nextTasks } : null,
  }
}
