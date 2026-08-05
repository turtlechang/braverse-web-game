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

  // 排除 pendingFaintEffects 與攻擊者擊倒觸發的技能佇列後，檢查是否有其他
  // 阻塞性狀態。
  // 根據規則：餅乾昏厥後應先補位，再處理昏厥效果；攻擊者「擊倒觸發」型技能
  // （例如 BS4-011 甜辣醬餅乾）同樣必須等對手的空場補位完成後才結算，因此
  // 不阻塞補位任務的建立（`resolvePendingAbilityEffect` 本身仍會拒絕在補位
  // 完成前結算）。
  const tempState = {
    ...state,
    pendingReplacement: null,
    pendingFaintEffects: [],
    pendingAbilityEffect:
      state.pendingAbilityEffect?.trigger === 'attacker-faint'
        ? undefined
        : state.pendingAbilityEffect,
  }
  if (hasBlockingPending(tempState)) {
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
