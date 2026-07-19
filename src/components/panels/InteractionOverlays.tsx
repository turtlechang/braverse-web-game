import { useEffect, useState } from 'react'
import type { GameCard } from '../../game'
import { CardEffectText, CardFace } from '../cards/CardVisuals'
import './InteractionOverlays.css'

export interface CardPreviewPanelProps {
  card: GameCard | null
  contextLabel?: string
}

export function CardPreviewPanel({
  card,
  contextLabel,
}: CardPreviewPanelProps) {
  if (!card) {
    return (
      <aside className="card-preview-panel is-empty" aria-label="卡片預覽">
        <div className="card-preview-empty-hint">
          <small>Hover Preview</small>
          <small>滑鼠移到卡牌顯示大圖</small>
        </div>
      </aside>
    )
  }

  const effectText =
    card.effectText ??
    card.skill?.text ??
    card.item?.text ??
    card.trap?.text ??
    card.stageAbility?.text ??
    (card.type === 'cookie' ? card.attackText : undefined)

  return (
    <aside
      className="card-preview-panel"
      aria-label={`${card.name}快速預覽`}
      data-testid="card-preview-panel"
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
