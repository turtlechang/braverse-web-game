import {
  Activity,
  BookOpen,
  ChevronRight,
  Copy,
  Heart,
  Layers3,
  Plus,
  ScrollText,
  Settings2,
  Sparkles,
  Swords,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type {
  CommandLogEntry,
  GameState,
  LogCategory,
  LogStepDetail,
  PlayerId,
} from '../../game'
import { serializeReplayIssueBundle } from '../../game'
import { buildIssueBundleFromProvider } from '../../hooks/issueBundleSource'
import { CardFace } from '../cards/CardVisuals'
import { copyTextToClipboard } from '../copyTextToClipboard'
import { logCategoryLabels, phaseLabels } from '../gameUiLabels'
import {
  CommandLogFilterBar,
} from './CommandLogFilters'
import {
  emptyCommandLogFilters,
  filterCommandLogEntries,
  matchesCommandLogFilters,
  resolveEntryCategory,
  type CommandLogFilterState,
} from './commandLogFilterUtils'
import { groupCommandLogEntries, type LogGroup } from './commandLogGrouping'
import './OnlineActivityFeed.css'

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

type ActivityEvent = {
  id: string
  kind: 'action' | 'faint'
  message: string
}

const playerIds = ['player-one', 'player-two'] as const

const actionEvent = (entry: CommandLogEntry, game: GameState): ActivityEvent => ({
  id: `command-${entry.id}`,
  kind: 'action',
  message:
    entry.summary ??
    `${game.players[entry.playerId]?.name ?? entry.playerId}：${entry.commandKind}`,
})

const battleStatus = (game: GameState, viewerPlayerId: PlayerId): string | null => {
  const replacement = game.pendingReplacement?.tasks[0]
  if (replacement) {
    const player = game.players[replacement.playerId]
    if (replacement.playerId !== viewerPlayerId) {
      return `對手 ${player.name} 正在補位餅乾（尚需 ${replacement.remaining} 張）。`
    }
  }

  const battle = game.pendingBattle
  if (battle) {
    const attacker = game.players[battle.attackerPlayerId].name
    const defender = game.players[battle.defenderPlayerId].name
    switch (battle.stage) {
      case 'trap':
        return `${attacker} 已宣告攻擊，等待 ${defender} 回應。`
      case 'damage':
        return '正在依序結算傷害。'
      case 'flip':
        return `${defender} 正在處理 FLIP 回應。`
      case 'attack-effect':
        return `${attacker} 正在處理攻擊效果。`
    }
  }

  const faint = game.pendingFaintEffects?.[0]
  if (faint) {
    const owner = game.players[faint.sourcePlayerId].name
    return `${owner} 的 ${faint.sourceCardName ?? '餅乾'} 昏厥效果等待處理。`
  }

  return null
}

export interface OnlineActivityFeedProps {
  game: GameState
  viewerPlayerId: PlayerId
}

/**
 * 線上對戰每次收到權威狀態後，比對指令紀錄與 Break 區，保留雙方都可知的
 * 動作與昏厥事件；不讀取或推導對手的隱藏資訊。
 */
export function OnlineActivityFeed({
  game,
  viewerPlayerId,
}: OnlineActivityFeedProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [filters, setFilters] = useState<CommandLogFilterState>(
    emptyCommandLogFilters,
  )
  const [copyResult, setCopyResult] = useState<'idle' | 'copied' | 'failed'>(
    'idle',
  )
  const [expandedGroupIds, setExpandedGroupIds] = useState<Set<number>>(
    () => new Set(),
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
  const handleCopyLog = () => {
    const bundle = buildIssueBundleFromProvider(null)
    if (!bundle) return
    void copyTextToClipboard(serializeReplayIssueBundle(bundle)).then((ok) => {
      setCopyResult(ok ? 'copied' : 'failed')
    })
  }
  const [events, setEvents] = useState<ActivityEvent[]>(() =>
    (game.commandLog ?? []).slice(-4).map((entry) => actionEvent(entry, game)),
  )
  const previousGameRef = useRef(game)
  const status = useMemo(
    () => battleStatus(game, viewerPlayerId),
    [game, viewerPlayerId],
  )
  const latestEvent = events.at(-1)
  const filteredEntries = useMemo(
    () => filterCommandLogEntries(game.commandLog ?? [], filters),
    [filters, game.commandLog],
  )
  const historyGroups = useMemo(
    () => groupCommandLogEntries(game.commandLog ?? []),
    [game.commandLog],
  )
  const visibleHistoryGroups = useMemo(
    () =>
      historyGroups.filter((group) =>
        group.entries.some((entry) => matchesCommandLogFilters(entry, filters)),
      ),
    [historyGroups, filters],
  )
  const renderedHistoryGroups = useMemo(
    () => [...visibleHistoryGroups].reverse(),
    [visibleHistoryGroups],
  )
  const replacementPending = Boolean(game.pendingReplacement?.tasks[0])
  const peekMessage =
    replacementPending && status ? status : latestEvent?.message

  useEffect(() => {
    const previous = previousGameRef.current
    const previousLastLogId = previous.commandLog?.at(-1)?.id ?? 0
    const newCommands = (game.commandLog ?? []).filter(
      (entry) => entry.id > previousLastLogId,
    )
    const addedEvents = newCommands.map((entry) => actionEvent(entry, game))

    const previousBattle = previous.pendingBattle
    const battle = game.pendingBattle
    if (battle?.stage === 'trap' && previousBattle?.stage !== 'trap') {
      const attacker = game.players[battle.attackerPlayerId].name
      const defender = game.players[battle.defenderPlayerId].name
      addedEvents.push({
        id: `trap-window-${battle.attackerInstanceId}-${game.turnNumber}`,
        kind: 'action',
        message: `${attacker} 已宣告攻擊，${defender} 可使用陷阱或阻擋。`,
      })
    }
    if (
      battle?.stage === 'flip' &&
      (previousBattle?.stage !== 'flip' ||
        previousBattle.revealedHpCard?.instanceId !== battle.revealedHpCard?.instanceId)
    ) {
      const owner = game.players[
        battle.damagePlayerId ?? battle.defenderPlayerId
      ].name
      const cardName = battle.revealedHpCard?.name
      addedEvents.push({
        id: `flip-${battle.revealedHpCard?.instanceId ?? game.turnNumber}`,
        kind: 'action',
        message: `${owner} 翻開${cardName ? ` ${cardName}` : '一張 HP 卡'}，FLIP 效果觸發。`,
      })
    }

    for (const playerId of playerIds) {
      const previousBreakIds = new Set(
        previous.players[playerId].breakArea.map((card) => card.instanceId),
      )
      for (const card of game.players[playerId].breakArea) {
        if (previousBreakIds.has(card.instanceId)) continue
        const owner = game.players[playerId].name
        addedEvents.push({
          id: `faint-${card.instanceId}-${game.turnNumber}`,
          kind: 'faint',
          message: `${owner} 的 ${card.name} 昏厥，移至 Break 區。`,
        })
      }
    }

    if (addedEvents.length > 0) {
      setEvents((current) => [...current, ...addedEvents].slice(-5))
    }
    previousGameRef.current = game
  }, [game, viewerPlayerId])

  return (
    <>
      <button
        type="button"
        className="online-activity-toggle"
        onClick={() => setIsOpen((value) => !value)}
        aria-expanded={isOpen}
        aria-label="開啟對戰紀錄"
        data-testid="online-activity-toggle"
      >
        <ScrollText size={16} aria-hidden="true" />
        <span>對戰紀錄</span>
        {game.commandLog && game.commandLog.length > 0 && (
          <em>{game.commandLog.length}</em>
        )}
      </button>

      {!isOpen && peekMessage && (
        <p
          className={`online-activity-peek ${replacementPending && status ? 'is-status' : `is-${latestEvent!.kind}`}`}
          role="status"
        >
          {peekMessage}
        </p>
      )}

      {isOpen && (
        <aside
          className="online-activity-panel"
          aria-label="對戰紀錄"
          data-testid="online-activity-feed"
        >
          <header>
            <span>
              <Swords size={15} aria-hidden="true" />
              <strong>對戰紀錄</strong>
            </span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              aria-label="關閉對戰紀錄"
            >
              <X size={15} aria-hidden="true" />
            </button>
          </header>

          <section className="online-activity-current" aria-live="polite">
            {status && <p className="online-activity-status">{status}</p>}
            <ol className="online-activity-list">
              {events.length === 0 ? (
                <li>等待第一個動作…</li>
              ) : (
                [...events].reverse().map((event) => (
                  <li key={event.id} className={`is-${event.kind}`}>
                    {event.message}
                  </li>
                ))
              )}
            </ol>
          </section>

          <CommandLogFilterBar
            entries={game.commandLog ?? []}
            playerNames={{
              'player-one': game.players['player-one'].name,
              'player-two': game.players['player-two'].name,
            }}
            value={filters}
            onChange={setFilters}
          />

          <section className="online-activity-history">
            <div className="online-activity-history-header">
              <strong>
                完整紀錄（{filteredEntries.length}/{game.commandLog?.length ?? 0}）
              </strong>
              <button
                type="button"
                className="online-activity-copy"
                onClick={handleCopyLog}
              >
                <Copy size={12} aria-hidden="true" />
                {copyResult === 'copied'
                  ? '已複製'
                  : copyResult === 'failed'
                    ? '複製失敗'
                    : '複製紀錄'}
              </button>
            </div>
            <ol>
              {renderedHistoryGroups.length ? (
                renderedHistoryGroups.map((group) => {
                  const category = resolveEntryCategory(group.header)
                  const Icon = CATEGORY_ICONS[category]
                  const stepLines = stepLinesForGroup(group)
                  const isExpanded = expandedGroupIds.has(group.groupId)
                  return (
                    <li key={group.groupId}>
                      <button
                        type="button"
                        className={`online-activity-history-entry${
                          stepLines.length > 0 ? ' is-expandable' : ''
                        }`}
                        onClick={() =>
                          stepLines.length > 0 && toggleGroup(group.groupId)
                        }
                        disabled={stepLines.length === 0}
                        aria-expanded={stepLines.length > 0 ? isExpanded : undefined}
                      >
                        <span className="online-activity-history-thumb">
                          {group.header.card ? (
                            <CardFace
                              card={group.header.card}
                              className="online-activity-card-face"
                            />
                          ) : (
                            <Icon size={14} aria-hidden="true" />
                          )}
                        </span>
                        <span className="online-activity-history-text">
                          <span>
                            {logCategoryLabels[category]}・第 {group.turnNumber} 回合・
                            {phaseLabels[group.header.phase]}
                            {stepLines.length > 0 && (
                              <ChevronRight size={11} aria-hidden="true" />
                            )}
                          </span>
                          <p>{group.header.summary ?? group.header.commandKind}</p>
                        </span>
                      </button>
                      {stepLines.length > 0 && isExpanded && (
                        <ol className="online-activity-history-steps">
                          {stepLines.map((line, index) => (
                            <li key={index}>
                              {line.cards && line.cards.length > 0 && (
                                <span className="online-activity-step-thumbs">
                                  {line.cards.map((card) => (
                                    <CardFace
                                      key={card.instanceId}
                                      card={card}
                                      className="online-activity-step-card-face"
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
                })
              ) : (
                <li className="is-empty">
                  {game.commandLog?.length ? '沒有符合篩選條件的紀錄。' : '尚無對戰紀錄。'}
                </li>
              )}
            </ol>
          </section>
        </aside>
      )}
    </>
  )
}
