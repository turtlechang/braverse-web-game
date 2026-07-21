import { useEffect, useState } from 'react'
import type { GameCard } from '../../game'
import { CardEffectText, CardFace } from '../cards/CardVisuals'
import './InteractionOverlays.css'

export interface CardPreviewPanelProps {
  card: GameCard | null
  contextLabel?: string
  onDismiss?: () => void
}

export function CardPreviewPanel({
  card,
  contextLabel,
  onDismiss,
}: CardPreviewPanelProps) {
  if (!card) return null

  const effectText =
    card.effectText ??
    card.skill?.text ??
    card.item?.text ??
    card.trap?.text ??
    card.stageAbility?.text ??
    (card.type === 'cookie' ? card.attackText : undefined)

  const preview = (
    <aside
      className={`card-preview-panel${onDismiss ? ' is-transient' : ''}`}
      aria-label={`${card.name}快速預覽`}
      data-testid="card-preview-panel"
      onPointerDown={onDismiss ? (event) => event.stopPropagation() : undefined}
    >
      <CardFace card={card} className="preview-card" />
      <div>
        {contextLabel && <small className="card-preview-context">{contextLabel}</small>}
        <strong>{card.name}</strong>
        <small>{card.id} · {card.type.toUpperCase()}</small>
        {effectText && (
          <p className="card-preview-effect">
            <CardEffectText text={effectText} />
          </p>
        )}
      </div>
    </aside>
  )

  if (!onDismiss) return preview

  return (
    <div
      className="card-preview-dismiss-layer"
      data-testid="card-preview-dismiss-layer"
      role="presentation"
      onPointerDown={onDismiss}
    >
      {preview}
    </div>
  )
}

export interface StatusToastProps {
  message: string
  duration?: number
}

export function StatusToast({ message, duration = 2800 }: StatusToastProps) {
  const [dismissedMessage, setDismissedMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!message) return
    const timer = window.setTimeout(() => setDismissedMessage(message), duration)
    return () => window.clearTimeout(timer)
  }, [duration, message])

  if (!message || message === dismissedMessage) return null

  return (
    <div
      className="status-toast battle-status-message"
      role="status"
      aria-live="polite"
    >
      {message}
    </div>
  )
}
