import { useMemo } from 'react'
import type { CommandLogEntry, LogCategory, PlayerId, TurnPhase } from '../../game'
import { logCategoryLabels, phaseLabels } from '../gameUiLabels'
import './CommandLogFilters.css'
import type { CommandLogFilterState } from './commandLogFilterUtils'

const LOG_CATEGORY_FILTER_ORDER: LogCategory[] = [
  'attack',
  'activate',
  'damage',
  'flip',
  'deploy',
  'draw',
  'phase',
  'system',
]

export interface CommandLogFilterBarProps {
  entries: CommandLogEntry[]
  playerNames?: Partial<Record<PlayerId, string>>
  value: CommandLogFilterState
  onChange: (next: CommandLogFilterState) => void
}

export function CommandLogFilterBar({
  entries,
  playerNames = {},
  value,
  onChange,
}: CommandLogFilterBarProps) {
  const turns = useMemo(
    () => [...new Set(entries.map((entry) => entry.turnNumber))].sort((a, b) => b - a),
    [entries],
  )

  return (
    <div className="command-log-filter-bar" data-testid="command-log-filters">
      <div className="command-log-category-chips" role="group" aria-label="紀錄分類篩選">
        <button
          type="button"
          className={value.category === 'all' ? 'is-active' : ''}
          onClick={() => onChange({ ...value, category: 'all' })}
        >
          全部
        </button>
        {LOG_CATEGORY_FILTER_ORDER.map((category) => (
          <button
            key={category}
            type="button"
            className={value.category === category ? 'is-active' : ''}
            onClick={() => onChange({ ...value, category })}
          >
            {logCategoryLabels[category]}
          </button>
        ))}
      </div>
      <label>
        <span>回合</span>
        <select
          aria-label="紀錄回合篩選"
          value={value.turn}
          onChange={(event) => onChange({ ...value, turn: event.target.value })}
        >
          <option value="all">全部</option>
          {turns.map((turn) => (
            <option key={turn} value={turn}>
              第 {turn} 回合
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>階段</span>
        <select
          aria-label="紀錄階段篩選"
          value={value.phase}
          onChange={(event) =>
            onChange({
              ...value,
              phase: event.target.value as CommandLogFilterState['phase'],
            })
          }
        >
          <option value="all">全部</option>
          {(Object.keys(phaseLabels) as TurnPhase[]).map((phase) => (
            <option key={phase} value={phase}>
              {phaseLabels[phase]}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>玩家</span>
        <select
          aria-label="紀錄玩家篩選"
          value={value.player}
          onChange={(event) =>
            onChange({
              ...value,
              player: event.target.value as CommandLogFilterState['player'],
            })
          }
        >
          <option value="all">全部</option>
          <option value="player-one">{playerNames['player-one'] ?? 'Player One'}</option>
          <option value="player-two">{playerNames['player-two'] ?? 'Player Two'}</option>
        </select>
      </label>
      <label className="command-log-card-filter">
        <span>卡牌</span>
        <input
          aria-label="紀錄卡牌搜尋"
          value={value.card}
          placeholder="名稱或指令"
          onChange={(event) => onChange({ ...value, card: event.target.value })}
        />
      </label>
    </div>
  )
}
