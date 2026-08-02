import {
  LOG_CATEGORY_BY_COMMAND_KIND,
  type CommandLogEntry,
  type GameCommand,
  type LogCategory,
  type PlayerId,
  type TurnPhase,
} from '../../game'

export interface CommandLogFilterState {
  turn: 'all' | string
  phase: 'all' | TurnPhase
  player: 'all' | PlayerId
  category: 'all' | LogCategory
  card: string
}

export const emptyCommandLogFilters = (): CommandLogFilterState => ({
  turn: 'all',
  phase: 'all',
  player: 'all',
  category: 'all',
  card: '',
})

/** 舊資料／外部資料沒有 `category` 欄位時，退回用 commandKind 對照表查。 */
export const resolveEntryCategory = (entry: CommandLogEntry): LogCategory =>
  entry.category ??
  LOG_CATEGORY_BY_COMMAND_KIND[entry.commandKind as GameCommand['kind']] ??
  'system'

export const matchesCommandLogFilters = (
  entry: CommandLogEntry,
  filters: CommandLogFilterState,
): boolean => {
  const cardQuery = filters.card.trim().toLocaleLowerCase()
  const text = `${entry.summary ?? ''} ${entry.commandKind}`.toLocaleLowerCase()
  return (
    (filters.turn === 'all' || String(entry.turnNumber) === filters.turn) &&
    (filters.phase === 'all' || entry.phase === filters.phase) &&
    (filters.player === 'all' || entry.playerId === filters.player) &&
    (filters.category === 'all' || resolveEntryCategory(entry) === filters.category) &&
    (!cardQuery || text.includes(cardQuery))
  )
}

export const filterCommandLogEntries = (
  entries: CommandLogEntry[],
  filters: CommandLogFilterState,
): CommandLogEntry[] =>
  entries.filter((entry) => matchesCommandLogFilters(entry, filters))
