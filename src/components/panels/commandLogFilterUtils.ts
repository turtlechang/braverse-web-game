import type { CommandLogEntry, PlayerId, TurnPhase } from '../../game'

export interface CommandLogFilterState {
  turn: 'all' | string
  phase: 'all' | TurnPhase
  player: 'all' | PlayerId
  card: string
}

export const emptyCommandLogFilters = (): CommandLogFilterState => ({
  turn: 'all',
  phase: 'all',
  player: 'all',
  card: '',
})

export const filterCommandLogEntries = (
  entries: CommandLogEntry[],
  filters: CommandLogFilterState,
): CommandLogEntry[] => {
  const cardQuery = filters.card.trim().toLocaleLowerCase()
  return entries.filter((entry) => {
    const text = `${entry.summary ?? ''} ${entry.commandKind}`.toLocaleLowerCase()
    return (
      (filters.turn === 'all' || String(entry.turnNumber) === filters.turn) &&
      (filters.phase === 'all' || entry.phase === filters.phase) &&
      (filters.player === 'all' || entry.playerId === filters.player) &&
      (!cardQuery || text.includes(cardQuery))
    )
  })
}
