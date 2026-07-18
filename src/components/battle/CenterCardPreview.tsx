import type { GameCard } from '../../game'
import { CardEffectText, CardFace } from '../cards/CardVisuals'
import './CenterCardPreview.css'

export interface CenterCardPreviewProps {
  card: GameCard
  label?: string
}

/**
 * 中央分隔列的動態卡片預覽:對手出牌/發動技能等有明確來源卡的動作進行時
 * 顯示放大卡面與效果摘要,取代原本大片空白的分隔列。效果文字推導沿用
 * CardPreviewPanel 既有的欄位優先序,維持兩處顯示邏輯一致。
 */
export function CenterCardPreview({ card, label }: CenterCardPreviewProps) {
  const effectText =
    card.effectText ??
    card.skill?.text ??
    card.item?.text ??
    card.trap?.text ??
    card.stageAbility?.text ??
    (card.type === 'cookie' ? card.attackText : undefined)

  return (
    <div className="center-card-preview" role="status" aria-live="polite">
      <CardFace card={card} className="center-card-preview-face" />
      <div className="center-card-preview-body">
        {label && <small className="center-card-preview-label">{label}</small>}
        <strong className="center-card-preview-name">{card.name}</strong>
        {effectText && (
          <p className="center-card-preview-effect">
            <CardEffectText text={effectText} />
          </p>
        )}
      </div>
    </div>
  )
}
