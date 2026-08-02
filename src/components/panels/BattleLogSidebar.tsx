import { useMemo, useState } from 'react'
import {
  Activity,
  BookOpen,
  ChevronRight,
  Heart,
  Layers3,
  Plus,
  ScrollText,
  Settings2,
  Sparkles,
  Swords,
  X,
} from 'lucide-react'
import type { CommandLogEntry, LogCategory, LogStepDetail, PlayerId } from '../../game'
import { CardFace } from '../cards/CardVisuals'
import { logCategoryLabels, phaseLabels } from '../gameUiLabels'
import {
  CommandLogFilterBar,
} from './CommandLogFilters'
import {
  emptyCommandLogFilters,
  matchesCommandLogFilters,
  resolveEntryCategory,
  type CommandLogFilterState,
} from './commandLogFilterUtils'
import { groupCommandLogEntries, type LogGroup } from './commandLogGrouping'
import './BattleLogSidebar.css'

export interface BattleLogSidebarProps {
  entries: CommandLogEntry[]
  playerNames?: Partial<Record<PlayerId, string>>
}

const CATEGORY_ICONS: Record<LogCategory, typeof Swords> = {
  draw: BookOpen,
  deploy: Plus,
  attack: Swords,
  activate: Sparkles,
  damage: Heart,
  flip: Layers3,
  phase: Activity,
  system: Settings2,
}

const stepLinesForGroup = (group: LogGroup): LogStepDetail[] =>
  group.steps.length > 0
    ? group.steps.map((entry) => ({
        text: entry.summary ?? entry.commandKind,
        cards: entry.card ? [entry.card] : undefined,
      }))
    : (group.header.steps ?? [])

export function BattleLogSidebar({ entries, playerNames }: BattleLogSidebarProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [filters, setFilters] = useState<CommandLogFilterState>(
    emptyCommandLogFilters,
  )
  const [expandedGroupIds, setExpandedGroupIds] = useState<Set<number>>(
    () => new Set(),
  )

  const groups = useMemo(() => groupCommandLogEntries(entries), [entries])
  const visibleGroups = useMemo(
    () =>
      groups.filter((group) =>
        group.entries.some((entry) => matchesCommandLogFilters(entry, filters)),
      ),
    [groups, filters],
  )
  const renderedGroups = useMemo(
    () => [...visibleGroups].reverse(),
    [visibleGroups],
  )

  const toggleGroup = (groupId: number) => {
    setExpandedGroupIds((current) => {
      const next = new Set(current)
      if (next.has(groupId)) {
        next.delete(groupId)
      } else {
        next.add(groupId)
      }
      return next
    })
  }

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
            {renderedGroups.length === 0 && (
              <li className="battle-log-empty">
                {entries.length === 0 ? '尚無對戰紀錄。' : '沒有符合篩選條件的紀錄。'}
              </li>
            )}
            {renderedGroups.map((group, index) => {
              const previousGroup = renderedGroups[index - 1]
              const showTurnDivider =
                !previousGroup || previousGroup.turnNumber !== group.turnNumber
              const category = resolveEntryCategory(group.header)
              const Icon = CATEGORY_ICONS[category]
              const stepLines = stepLinesForGroup(group)
              const isExpanded = expandedGroupIds.has(group.groupId)
              const actorName =
                playerNames?.[group.header.playerId] ?? group.header.playerId

              return (
                <li key={group.groupId} className="battle-log-group">
                  {showTurnDivider && (
                    <div className="battle-log-turn-divider">
                      <span className="battle-log-turn-badge">
                        第 {group.turnNumber} 回合
                      </span>
                      {group.header.breakLevel && (
                        <span className="battle-log-turn-levels">
                          {Object.entries(group.header.breakLevel).map(
                            ([playerId, level]) => (
                              <span key={playerId}>
                                {playerNames?.[playerId as PlayerId] ?? playerId}{' '}
                                LV.{level}/10
                              </span>
                            ),
                          )}
                        </span>
                      )}
                    </div>
                  )}
                  <button
                    type="button"
                    className={`battle-log-entry category-${category}${
                      stepLines.length > 0 ? ' is-expandable' : ''
                    }`}
                    onClick={() =>
                      stepLines.length > 0 && toggleGroup(group.groupId)
                    }
                    disabled={stepLines.length === 0}
                    aria-expanded={stepLines.length > 0 ? isExpanded : undefined}
                  >
                    <span className="battle-log-thumb">
                      {group.header.card ? (
                        <CardFace
                          card={group.header.card}
                          className="battle-log-card-face"
                        />
                      ) : (
                        <Icon size={16} aria-hidden="true" />
                      )}
                    </span>
                    <span className="battle-log-entry-text">
                      <span className="battle-log-entry-head">
                        <span className="battle-log-category-tag">
                          {logCategoryLabels[category]}
                        </span>
                        <span className="battle-log-meta">
                          {actorName} · {phaseLabels[group.header.phase]}
                        </span>
                        {stepLines.length > 0 && (
                          <ChevronRight
                            size={12}
                            className="battle-log-expand-chevron"
                            aria-hidden="true"
                          />
                        )}
                      </span>
                      <p>{group.header.summary ?? group.header.commandKind}</p>
                    </span>
                  </button>
                  {stepLines.length > 0 && isExpanded && (
                    <ol className="battle-log-steps">
                      {stepLines.map((line, stepIndex) => (
                        <li key={stepIndex}>
                          {line.cards && line.cards.length > 0 && (
                            <span className="battle-log-step-thumbs">
                              {line.cards.map((card) => (
                                <CardFace
                                  key={card.instanceId}
                                  card={card}
                                  className="battle-log-step-card-face"
                                />
                              ))}
                            </span>
                          )}
                          <span>{line.text}</span>
                        </li>
                      ))}
                    </ol>
                  )}
                </li>
              )
            })}
          </ol>
        </aside>
      )}
    </>
  )
}
