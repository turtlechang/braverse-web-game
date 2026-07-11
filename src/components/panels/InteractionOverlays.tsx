import { useEffect, useState } from 'react'
import type { GameCard } from '../../game'
import { CardFace } from '../cards/CardVisuals'
import './InteractionOverlays.css'

export interface CardPreviewPanelProps {
  card: GameCard | null
  position: 'top' | 'bottom'
}

export function CardPreviewPanel({ card, position }: CardPreviewPanelProps) {
  if (!card) return null

  return (
    <aside
      className={`card-preview-panel is-${position}`}
      aria-label={`${card.name}快速預覽`}
      data-testid="card-preview-panel"
    >
      <CardFace card={card} className="preview-card" />
      <div>
        <strong>{card.name}</strong>
        <small>{card.id} · {card.type.toUpperCase()}</small>
      </div>
    </aside>
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
