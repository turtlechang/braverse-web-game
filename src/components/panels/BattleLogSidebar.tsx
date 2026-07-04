import { useState } from 'react'
import { ScrollText, X } from 'lucide-react'
import type { CommandLogEntry } from '../../game'
import { phaseLabels } from '../gameUiLabels'
import './BattleLogSidebar.css'

export interface BattleLogSidebarProps {
  entries: CommandLogEntry[]
}

export function BattleLogSidebar({ entries }: BattleLogSidebarProps) {
  const [isOpen, setIsOpen] = useState(false)

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
          <ol className="battle-log-list">
            {entries.length === 0 && (
              <li className="battle-log-empty">尚無對戰紀錄。</li>
            )}
            {[...entries].reverse().map((entry) => (
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
