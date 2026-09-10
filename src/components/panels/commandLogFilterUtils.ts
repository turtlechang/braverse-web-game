import {
  LOG_CATEGORY_BY_COMMAND_KIND,
  type CommandLogEntry,
  type GameCommand,
  type LogCategory,
} from '../../game'

/** 舊資料／外部資料沒有 `category` 欄位時，退回用 commandKind 對照表查。 */
export const resolveEntryCategory = (entry: CommandLogEntry): LogCategory =>
  entry.category ??
  LOG_CATEGORY_BY_COMMAND_KIND[entry.commandKind as GameCommand['kind']] ??
  'system'
