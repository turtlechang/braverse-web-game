import { Clock3, LoaderCircle, Sparkles, Wifi } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { ActionStatus, ActionStatusMode } from './actionStatus'
import './RemoteActionBanner.css'

export interface RemoteActionBannerProps {
  status: ActionStatus | null
  compact?: boolean
  connectionNotice?: string | null
}

const modeLabels: Record<ActionStatusMode, string> = {
  'opponent-thinking': '對手動作',
  'awaiting-local-decision': '等待你的選擇',
  'awaiting-opponent-decision': '等待對手回應',
  resolving: '效果結算中',
  syncing: '同步中',
  reconnecting: '重新連線中',
}

const iconFor = (mode: ActionStatusMode) => {
  if (mode === 'syncing' || mode === 'reconnecting') {
    return <Wifi aria-hidden="true" />
  }
  if (mode === 'resolving') return <LoaderCircle aria-hidden="true" />
  if (mode === 'awaiting-local-decision') return <Sparkles aria-hidden="true" />
  return <Clock3 aria-hidden="true" />
}

const formatRemaining = (remainingMs: number): string => {
  if (remainingMs <= 0) return '已到時限'
  const totalSeconds = Math.ceil(remainingMs / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return minutes > 0
    ? `剩餘 ${minutes}:${seconds.toString().padStart(2, '0')}`
    : `剩餘 ${seconds} 秒`
}

export function RemoteActionBanner({
  status,
  compact = false,
  connectionNotice = null,
}: RemoteActionBannerProps) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!status?.expiresAt) return
    const timer = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(timer)
  }, [status?.expiresAt])

  if (!status) return null

  const expiryMs = status.expiresAt ? Date.parse(status.expiresAt) : Number.NaN
  const remainingMs = Number.isFinite(expiryMs)
    ? Math.max(0, expiryMs - now)
    : null

  return (
    <aside
      className={`remote-action-banner is-${status.mode}${compact ? ' is-compact' : ''}`}
      role="status"
      aria-live="polite"
    >
      <div className="remote-action-banner-heading">
        {iconFor(status.mode)}
        <strong>{status.headline}</strong>
        <span className="remote-action-banner-mode">{modeLabels[status.mode]}</span>
      </div>
      <div className={`remote-action-banner-detail${compact ? ' is-compact' : ''}`}>
        <span>
          {status.actorLabel} · {status.phaseLabel}
          {status.sourceCard ? ` · ${status.sourceCard.name}` : ''}
        </span>
        {status.detail && <small>{status.detail}</small>}
        {connectionNotice && connectionNotice !== status.detail && (
          <small className="remote-action-banner-connection">
            {connectionNotice}
          </small>
        )}
        {remainingMs !== null && (
          <time
            className={remainingMs <= 0 ? 'is-expired' : undefined}
            dateTime={status.expiresAt}
          >
            {formatRemaining(remainingMs)}
          </time>
        )}
      </div>
      {status.progress && status.progress.length > 0 && (
        <ol className="remote-action-banner-progress" aria-label="操作進度">
          {status.progress.map((step) => (
            <li key={step.key} className={`is-${step.state}`}>
              {step.label}
            </li>
          ))}
        </ol>
      )}
    </aside>
  )
}
