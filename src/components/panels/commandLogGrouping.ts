import type { CommandLogEntry, TurnPhase } from '../../game'

/**
 * 同一個 groupId 底下的所有 entry 聚合成一組可展開的動作。
 * header 是這組裡最早（id 最小）的 entry，steps 是其餘 entry（依 id 遞增），
 * entries 是完整成員（含 header），供篩選時判斷「這組裡有沒有任何一筆符合條件」用。
 */
export interface LogGroup {
  groupId: number
  header: CommandLogEntry
  steps: CommandLogEntry[]
  entries: CommandLogEntry[]
  turnNumber: number
  phase: TurnPhase
}

/**
 * 把（依 id 遞增排序的）command log 攤平陣列聚合成 LogGroup[]，維持輸入順序
 * （由舊到新）。呼叫端需要新到舊顯示時自行 `.reverse()`，維持跟現有
 * BattleLogSidebar 的排序習慣一致，這裡不預設顯示順序。
 *
 * 沒有 groupId 的舊資料／外部資料退回用自己的 id 當 groupId，等同「自成一組」。
 */
export const groupCommandLogEntries = (
  entries: CommandLogEntry[],
): LogGroup[] => {
  const groups: LogGroup[] = []

  for (const entry of entries) {
    const groupId = entry.groupId ?? entry.id
    const current = groups[groups.length - 1]

    if (current && current.groupId === groupId) {
      current.entries.push(entry)
      current.steps.push(entry)
      continue
    }

    groups.push({
      groupId,
      header: entry,
      steps: [],
      entries: [entry],
      turnNumber: entry.turnNumber,
      phase: entry.phase,
    })
  }

  return groups
}
