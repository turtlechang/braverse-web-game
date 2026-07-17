import { useMemo, useState } from 'react'
import { ScrollText, X } from 'lucide-react'
import type { CommandLogEntry, PlayerId } from '../../game'
import { phaseLabels } from '../gameUiLabels'
import {
  CommandLogFilterBar,
} from './CommandLogFilters'
import {
  emptyCommandLogFilters,
  filterCommandLogEntries,
  type CommandLogFilterState,
} from './commandLogFilterUtils'
import './BattleLogSidebar.css'

export interface BattleLogSidebarProps {
  entries: CommandLogEntry[]
  playerNames?: Partial<Record<PlayerId, string>>
}

export function BattleLogSidebar({ entries, playerNames }: BattleLogSidebarProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [filters, setFilters] = useState<CommandLogFilterState>(
    emptyCommandLogFilters,
  )
  const filteredEntries = useMemo(
    () => filterCommandLogEntries(entries, filters),
    [entries, filters],
  )

  return (
    <>
      <button
        type="button"
        className="battle-log-toggle"
        onClick={() => setIsOpen((value) => !value)}
        aria-expanded={isOpen}
        aria-label="對戰紀錄"
        data-testid="battle-log-toggle"
      >
        <ScrollText size={16} />
        <span>對戰紀錄</span>
        {entries.length > 0 && (
          <em className="battle-log-count">{entries.length}</em>
        )}
      </button>

      {isOpen && (
        <aside
          className="battle-log-sidebar"
          aria-label="對戰紀錄側欄"
          data-testid="battle-log-sidebar"
        >
          <header>
            <strong>對戰紀錄</strong>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              aria-label="關閉對戰紀錄"
            >
              <X size={14} />
            </button>
          </header>
          <CommandLogFilterBar
            entries={entries}
            playerNames={playerNames}
            value={filters}
            onChange={setFilters}
          />
          <ol className="battle-log-list">
            {filteredEntries.length === 0 && (
              <li className="battle-log-empty">
                {entries.length === 0 ? '尚無對戰紀錄。' : '沒有符合篩選條件的紀錄。'}
              </li>
            )}
            {[...filteredEntries].reverse().map((entry) => (
              <li key={entry.id} className="battle-log-entry">
                <span className="battle-log-meta">
                  第 {entry.turnNumber} 回合 · {phaseLabels[entry.phase]}
                </span>
                <p>{entry.summary ?? entry.commandKind}</p>
              </li>
            ))}
          </ol>
        </aside>
      )}
    </>
  )
}
