import { Clock3, LoaderCircle, Sparkles, Wifi } from 'lucide-react'
import type { ActionStatus, ActionStatusMode } from './actionStatus'
import './RemoteActionBanner.css'

export interface RemoteActionBannerProps {
  status: ActionStatus | null
  compact?: boolean
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

export function RemoteActionBanner({
  status,
  compact = false,
}: RemoteActionBannerProps) {
  if (!status) return null

  const progress = status.progress?.filter((step) => step.state !== 'pending')

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
      {!compact && (
        <div className="remote-action-banner-detail">
          <span>
            {status.actorLabel} · {status.phaseLabel}
            {status.sourceCard ? ` · ${status.sourceCard.name}` : ''}
          </span>
          {status.detail && <small>{status.detail}</small>}
        </div>
      )}
      {progress && progress.length > 0 && (
        <ol className="remote-action-banner-progress" aria-label="操作進度">
          {progress.map((step) => (
            <li key={step.key} className={`is-${step.state}`}>
              {step.label}
            </li>
          ))}
        </ol>
      )}
    </aside>
  )
}
