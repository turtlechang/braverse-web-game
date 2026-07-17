import { ScrollText, Swords, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { CommandLogEntry, GameState, PlayerId } from '../../game'
import { phaseLabels } from '../gameUiLabels'
import {
  CommandLogFilterBar,
} from './CommandLogFilters'
import {
  emptyCommandLogFilters,
  filterCommandLogEntries,
  type CommandLogFilterState,
} from './commandLogFilterUtils'
import './OnlineActivityFeed.css'

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
        aria-label="開啟對戰動態與紀錄"
        data-testid="online-activity-toggle"
      >
        <ScrollText size={16} aria-hidden="true" />
        <span>對戰動態</span>
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
          aria-label="對戰動態與紀錄"
          data-testid="online-activity-feed"
        >
          <header>
            <span>
              <Swords size={15} aria-hidden="true" />
              <strong>對戰動態</strong>
            </span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              aria-label="關閉對戰動態與紀錄"
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
            <strong>
              完整紀錄（{filteredEntries.length}/{game.commandLog?.length ?? 0}）
            </strong>
            <ol>
              {filteredEntries.length ? (
                [...filteredEntries].reverse().map((entry) => (
                  <li key={entry.id}>
                    <span>
                      第 {entry.turnNumber} 回合・{phaseLabels[entry.phase]}
                    </span>
                    <p>{entry.summary ?? entry.commandKind}</p>
                  </li>
                ))
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
