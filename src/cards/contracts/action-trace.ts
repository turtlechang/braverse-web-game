import type { CommandLogEntry } from '../../game'

export interface CardContractActionTraceEntry {
  id: number
  groupId?: number
  commandKind: string
  category?: string
  summary?: string
  steps: string[]
}
/**
 * 將正式 command log 壓縮成可保存的卡牌驗證 trace。
 * 只保留公開摘要與步驟文字，不複製 payload，避免把手牌／牌庫等私有資訊
 * 變成 Browser artifact。Browser 驗證可用這份 trace 檢查支付→代價→目標→
 * 結算順序，但最終合法性仍由規則層 command 驗證。
 */
export const buildCardContractActionTrace = (
  entries: readonly CommandLogEntry[],
  cardId: string,
): CardContractActionTraceEntry[] =>
  entries
    .filter((entry) => entry.card?.id === cardId)
    .map((entry) => ({
      id: entry.id,
      ...(entry.groupId !== undefined ? { groupId: entry.groupId } : {}),
      commandKind: entry.commandKind,
      ...(entry.category ? { category: entry.category } : {}),
      ...(entry.summary ? { summary: entry.summary } : {}),
      steps: (entry.steps ?? []).map((step) => step.text),
    }))

export const traceContainsCommandKinds = (
  trace: readonly CardContractActionTraceEntry[],
  kinds: readonly string[],
): boolean => {
  const actual = new Set(trace.map((entry) => entry.commandKind))
  return kinds.every((kind) => actual.has(kind))
}
