import { Pause, X } from 'lucide-react'
import type { DeckChoice, DefeatReason, GameCard } from '../../game'
import { OFFICIAL_DECK_RECIPES } from '../../game'
import { CardFace, CardEffectText, SkillCost } from '../cards/CardVisuals'
import { deckChoiceLabel } from '../gameUiLabels'
import { getSkillLabels } from '../effects/effectUiUtils'
import './GameModals.css'

export interface DecisionModalProps {
  isRefresh: boolean
  playerName: string
  options: GameCard[]
  isOptionDisabled: (card: GameCard) => boolean
  onSelect: (instanceId: string) => void
}

export function DecisionModal({
  isRefresh,
  playerName,
  options,
  isOptionDisabled,
  onSelect,
}: DecisionModalProps) {
  return (
    <div className="modal-backdrop" role="presentation">
      <section className="decision-modal" role="alertdialog">
        <div className="modal-title">
          {isRefresh ? '牌庫 Refresh' : '放置餅乾'}
        </div>
        <div className="modal-body">
          <strong>
            {isRefresh
              ? `${playerName}必須選擇一張餅乾放入休息區`
              : `${playerName}必須在戰鬥區放置新餅乾`}
          </strong>
          <div className="modal-card-options">
            {options.map((card) => (
              <button
                type="button"
                key={card.instanceId}
                disabled={isOptionDisabled(card)}
                onClick={() => onSelect(card.instanceId)}
              >
                <CardFace card={card} />
                <span>{card.name}</span>
              </button>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}

export interface CardDetailModalProps {
  card: GameCard
  onClose: () => void
}

export function CardDetailModal({
  card,
  onClose,
}: CardDetailModalProps) {
  return (
    <div className="modal-backdrop" role="presentation">
      <section className="card-detail-modal" role="dialog">
        <button
          className="close-modal"
          type="button"
          title="關閉"
          onClick={onClose}
        >
          <X aria-hidden="true" />
        </button>
        <CardFace card={card} className="detail-card" />
        <div>
          <span>{card.id}</span>
          <h2>{card.name}</h2>
          <p>
            {card.type === 'cookie'
              ? `LV ${card.level} · HP ${card.hp} · 攻擊 ${card.attack} · 費用 ${card.attackCost}`
              : `卡牌類型：${card.type.toUpperCase()}`}
          </p>
          {card.effectText && (
            <div className="card-effect-copy">
              <strong>卡牌效果</strong>
              {card.skill && (
                <>
                  <div className="skill-labels">
                    {getSkillLabels(card.skill).map((label) => (
                      <span key={label}>{label}</span>
                    ))}
                  </div>
                  <small>
                    費用：<SkillCost skill={card.skill} />
                  </small>
                </>
              )}
              <p>
                <CardEffectText text={card.effectText} />
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

export interface PauseModalProps {
  turnNumber: number
  phaseLabel: string
  onResume: () => void
}

export function PauseModal({
  turnNumber,
  phaseLabel,
  onResume,
}: PauseModalProps) {
  return (
    <div className="modal-backdrop" role="presentation">
      <section className="pause-modal" role="dialog">
        <Pause aria-hidden="true" />
        <span>對戰資訊</span>
        <h2>遊戲已暫停</h2>
        <p>目前為第 {turnNumber} 回合，{phaseLabel}。</p>
        <button type="button" onClick={onResume}>
          繼續對戰
        </button>
      </section>
    </div>
  )
}

export interface DeckListModalProps {
  deckListOwner: 'player' | 'ai'
  viewedDeck: DeckChoice
  onSetDeckListOwner: (owner: 'player' | 'ai') => void
  onClose: () => void
}

export function DeckListModal({
  deckListOwner,
  viewedDeck,
  onSetDeckListOwner,
  onClose,
}: DeckListModalProps) {
  return (
    <div className="modal-backdrop" role="presentation">
      <section className="deck-list-modal" role="dialog">
        <button
          className="close-modal"
          type="button"
          title="關閉"
          onClick={onClose}
        >
          <X aria-hidden="true" />
        </button>
        <div className="deck-reference-image">
          {viewedDeck === 'red' ? (
            <img
              src="/reference/starter-deck-red.webp"
              alt="官方紅色起始牌組套餐組合表"
            />
          ) : (
            <div className="deck-reference-placeholder">
              此牌組目前沒有本機官方組合圖，請參考下方卡牌清單。
            </div>
          )}
        </div>
        <div className="deck-list-content">
          <span>官方範例牌組</span>
          <div className="deck-inspect-toggle">
            <button
              type="button"
              className={deckListOwner === 'player' ? 'active' : ''}
              data-testid="view-player-deck"
              onClick={() => onSetDeckListOwner('player')}
            >
              查看玩家牌組
            </button>
            <button
              type="button"
              className={deckListOwner === 'ai' ? 'active' : ''}
              data-testid="view-ai-deck"
              onClick={() => onSetDeckListOwner('ai')}
            >
              查看 AI 牌組
            </button>
          </div>
          <h2>{deckChoiceLabel[viewedDeck]}起始牌組</h2>
          <p>
            共 {OFFICIAL_DECK_RECIPES[viewedDeck].length} 種卡、
            {OFFICIAL_DECK_RECIPES[viewedDeck].reduce((sum, e) => sum + e.count, 0)} 張。
          </p>
          <div className="deck-list-table">
            {OFFICIAL_DECK_RECIPES[viewedDeck].map((entry) => (
              <div key={entry.cardNumber}>
                <code>{entry.cardNumber}</code>
                <span>{entry.name}</span>
                <strong>{entry.count}</strong>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}

export interface ResultModalProps {
  winnerName: string
  reason: DefeatReason
  onRestart: () => void
}

export function ResultModal({
  winnerName,
  reason,
  onRestart,
}: ResultModalProps) {
  const reasonText =
    reason === 'break-level-limit'
      ? '對手休息區等級達到 10。'
      : reason === 'refresh-unavailable'
        ? '對手無法完成牌庫 Refresh。'
        : '對手沒有可登場的餅乾。'

  return (
    <div className="modal-backdrop result-backdrop" role="presentation">
      <section className="result-modal" role="alertdialog">
        <span>對局結束</span>
        <h2>{winnerName}勝利</h2>
        <p>{reasonText}</p>
        <button type="button" onClick={onRestart}>
          再來一局
        </button>
      </section>
    </div>
  )
}
