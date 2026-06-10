import { useState } from 'react'
import { ChevronLeft, ChevronRight, Pause, X } from 'lucide-react'
import type {
  DeckChoice,
  DefeatReason,
  GameCard,
  PlayerId,
} from '../../game'
import { OFFICIAL_DECK_RECIPES } from '../../game'
import {
  CardFace,
  CardEffectText,
  EnergyCostIcons,
} from '../cards/CardVisuals'
import { deckChoiceLabel } from '../gameUiLabels'
import './GameModals.css'

export type OpeningSetupStep =
  | 'rps'
  | 'choose-order'
  | 'mulligan'
  | 'starting-cookie'

export interface OpeningSetupModalProps {
  step: OpeningSetupStep
  message: string
  hand: GameCard[]
  onRps: (choice: 'rock' | 'paper' | 'scissors') => void
  onChooseFirstPlayer: (playerFirst: boolean) => void
  onMulligan: (replaceAll: boolean) => void
  onSelectStartingCookie: (instanceId: string) => void
}

export function OpeningSetupModal({
  step,
  message,
  hand,
  onRps,
  onChooseFirstPlayer,
  onMulligan,
  onSelectStartingCookie,
}: OpeningSetupModalProps) {
  const title =
    step === 'rps'
      ? '猜拳決定選擇權'
      : step === 'choose-order'
        ? '選擇先攻或後攻'
        : step === 'mulligan'
          ? '第一次調度'
          : '放置起始餅乾'

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="opening-setup-modal" role="alertdialog">
        <span>對戰開始前設定</span>
        <h2>{title}</h2>
        <p>{message}</p>
        {step === 'rps' && (
          <div className="setup-choice-grid">
            <button type="button" onClick={() => onRps('rock')}>石頭</button>
            <button type="button" onClick={() => onRps('paper')}>布</button>
            <button type="button" onClick={() => onRps('scissors')}>剪刀</button>
          </div>
        )}
        {step === 'choose-order' && (
          <div className="setup-choice-grid">
            <button type="button" onClick={() => onChooseFirstPlayer(true)}>
              選擇先攻
            </button>
            <button type="button" onClick={() => onChooseFirstPlayer(false)}>
              選擇後攻
            </button>
          </div>
        )}
        {(step === 'mulligan' || step === 'starting-cookie') && (
          <div className="modal-card-options setup-hand">
            {hand.map((card) => {
              const canSelect =
                step === 'starting-cookie' && card.type === 'cookie'
              return (
                <button
                  type="button"
                  key={card.instanceId}
                  disabled={step === 'starting-cookie' && !canSelect}
                  onClick={
                    canSelect
                      ? () => onSelectStartingCookie(card.instanceId)
                      : undefined
                  }
                >
                  <CardFace card={card} />
                  <span>{card.name}</span>
                </button>
              )
            })}
          </div>
        )}
        {step === 'mulligan' && (
          <div className="modal-actions">
            <button type="button" onClick={() => onMulligan(false)}>
              保留手牌
            </button>
            <button type="button" onClick={() => onMulligan(true)}>
              全部調度
            </button>
          </div>
        )}
      </section>
    </div>
  )
}

export interface DecisionModalProps {
  isRefresh: boolean
  playerName: string
  replacementCount?: number
  options: GameCard[]
  isOptionDisabled: (card: GameCard) => boolean
  onSelect: (instanceId: string) => void
  onSkipReplacement?: () => void
}

export function DecisionModal({
  isRefresh,
  playerName,
  replacementCount,
  options,
  isOptionDisabled,
  onSelect,
  onSkipReplacement,
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
              : `${playerName}是否要在戰鬥區放置新餅乾？（尚可補 ${
                  replacementCount ?? 1
                } 張）`}
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
          {!isRefresh && onSkipReplacement && (
            <div className="modal-actions decision-modal-actions">
              <button type="button" onClick={onSkipReplacement}>
                不補餅乾
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

export interface CardDetailModalProps {
  card: GameCard
  onClose: () => void
}

export interface CardPileModalProps {
  title: string
  cards: GameCard[]
  onInspect: (card: GameCard) => void
  onClose: () => void
}

export function CardPileModal({
  title,
  cards,
  onInspect,
  onClose,
}: CardPileModalProps) {
  return (
    <div className="modal-backdrop" role="presentation">
      <section className="card-pile-modal" role="dialog">
        <button
          className="close-modal"
          type="button"
          title="關閉"
          onClick={onClose}
        >
          <X aria-hidden="true" />
        </button>
        <span>公開區域</span>
        <h2>{title}</h2>
        <p>共 {cards.length} 張，最右側為目前最上方的卡牌。</p>
        <div className="card-pile-grid">
          {cards.map((card) => (
            <button
              type="button"
              key={card.instanceId}
              onClick={() => onInspect(card)}
            >
              <CardFace card={card} />
              <span>{card.name}</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  )
}

export interface TrapResponseModalProps {
  cards: GameCard[]
  selectedTrapId: string | null
  paymentCards: GameCard[]
  targetCards: GameCard[]
  onSelectTrap: (instanceId: string) => void
  onConfirm: () => void
  onSkip: () => void
}

export function TrapResponseModal({
  cards,
  selectedTrapId,
  paymentCards,
  targetCards,
  onSelectTrap,
  onConfirm,
  onSkip,
}: TrapResponseModalProps) {
  return (
    <div className="modal-backdrop" role="presentation">
      <section className="battle-response-modal" role="alertdialog">
        <span>攻擊宣告回應</span>
        <h2>是否發動陷阱？</h2>
        <p>每次攻擊最多發動一張陷阱。選擇卡牌後會顯示付款與目標。</p>
        <div className="modal-card-options">
          {cards.map((card) => (
            <button
              type="button"
              className={selectedTrapId === card.instanceId ? 'is-selected' : ''}
              key={card.instanceId}
              onClick={() => onSelectTrap(card.instanceId)}
            >
              <CardFace card={card} />
              <span>{card.name}</span>
            </button>
          ))}
        </div>
        {selectedTrapId && (
          <div className="battle-response-summary">
            <strong>付款支援卡</strong>
            <span>{paymentCards.map((card) => card.name).join('、') || '不需能量'}</span>
            <strong>效果目標</strong>
            <span>{targetCards.map((card) => card.name).join('、') || '不需目標'}</span>
          </div>
        )}
        <div className="modal-actions">
          <button type="button" onClick={onSkip}>不發動</button>
          <button type="button" disabled={!selectedTrapId} onClick={onConfirm}>
            支付並發動
          </button>
        </div>
      </section>
    </div>
  )
}

export interface FlipResponseModalProps {
  card: GameCard
  hand: GameCard[]
  discardCount: number
  selectedDiscardIds: string[]
  onToggleDiscard: (instanceId: string) => void
  onActivate: () => void
  onSkip: () => void
}

const FLIP_HAND_PAGE_SIZE = 3

export function FlipResponseModal({
  card,
  hand,
  discardCount,
  selectedDiscardIds,
  onToggleDiscard,
  onActivate,
  onSkip,
}: FlipResponseModalProps) {
  const [pageIndex, setPageIndex] = useState(0)
  const pageCount = Math.max(1, Math.ceil(hand.length / FLIP_HAND_PAGE_SIZE))
  const visibleHand = hand.slice(
    pageIndex * FLIP_HAND_PAGE_SIZE,
    (pageIndex + 1) * FLIP_HAND_PAGE_SIZE,
  )

  return (
    <div className="modal-backdrop" role="presentation">
      <section
        className="battle-response-modal flip-response-modal"
        role="alertdialog"
      >
        <span>HP 卡翻開</span>
        <h2>{card.name} FLIP</h2>
        <CardFace card={card} className="flip-reveal-card" />
        <p>{card.flip?.text}</p>
        {discardCount > 0 && (
          <>
            <strong>選擇 {discardCount} 張手牌棄置</strong>
            <div
              className={`flip-hand-carousel ${
                pageCount === 1 ? 'single-page' : ''
              }`}
            >
              {pageCount > 1 && (
                <button
                  type="button"
                  className="flip-page-arrow"
                  aria-label="上一頁手牌"
                  disabled={pageIndex === 0}
                  onClick={() => setPageIndex((current) => current - 1)}
                >
                  <ChevronLeft aria-hidden="true" />
                </button>
              )}
              <div className="modal-card-options compact flip-card-page">
                {visibleHand.map((handCard) => (
                  <button
                    type="button"
                    className={
                      selectedDiscardIds.includes(handCard.instanceId)
                        ? 'is-selected'
                        : ''
                    }
                    key={handCard.instanceId}
                    onClick={() => onToggleDiscard(handCard.instanceId)}
                  >
                    <CardFace card={handCard} />
                    <span>{handCard.name}</span>
                  </button>
                ))}
              </div>
              {pageCount > 1 && (
                <button
                  type="button"
                  className="flip-page-arrow"
                  aria-label="下一頁手牌"
                  disabled={pageIndex === pageCount - 1}
                  onClick={() => setPageIndex((current) => current + 1)}
                >
                  <ChevronRight aria-hidden="true" />
                </button>
              )}
            </div>
            {pageCount > 1 && (
              <span className="flip-page-indicator">
                {pageIndex + 1} / {pageCount}
              </span>
            )}
          </>
        )}
        <div className="modal-actions">
          <button type="button" onClick={onSkip}>不發動</button>
          <button
            type="button"
            disabled={selectedDiscardIds.length !== discardCount}
            onClick={onActivate}
          >
            發動 FLIP
          </button>
        </div>
      </section>
    </div>
  )
}

export function CardDetailModal({
  card,
  onClose,
}: CardDetailModalProps) {
  const hasSkillSection = Boolean(card.skill && card.effectText)
  const hasSecondaryAttackSection =
    card.type === 'cookie' && Boolean(card.effectText)
  const ruleSectionCount =
    (card.effectText ? 1 : 0) + (card.type === 'cookie' ? 1 : 0)
  const effectHeading = card.skill
    ? '技能'
    : card.officialType === 'flip'
      ? 'FLIP'
      : card.type === 'trap'
        ? '陷阱效果'
        : card.type === 'item'
          ? '物品效果'
          : card.type === 'stage'
            ? '場景效果'
            : '卡牌效果'

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
          <div
            className={`card-detail-rules ${
              ruleSectionCount === 1 ? 'single-rule' : ''
            }`}
          >
            {card.effectText && (
              <section className="card-rule-section card-skill-section">
                <strong>{effectHeading}</strong>
                <p>
                  <CardEffectText text={card.effectText} />
                </p>
              </section>
            )}
            {card.type === 'cookie' && (
              <section
                className={`card-rule-section card-attack-section ${
                  !hasSkillSection && !hasSecondaryAttackSection
                    ? 'primary-rule'
                    : ''
                }`}
              >
                <strong>攻擊</strong>
                <p className="card-attack-copy">
                  {card.attackText ? (
                    <CardEffectText text={card.attackText} />
                  ) : (
                    <>
                      <EnergyCostIcons
                        cost={card.attackEnergyCost ?? {}}
                      />{' '}
                      Deals {card.attack} damage.
                    </>
                  )}
                </p>
              </section>
            )}
          </div>
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
  loserId: PlayerId
  viewerPlayerId: PlayerId
  reason: DefeatReason
  onRestart: () => void
}

export function ResultModal({
  winnerName,
  loserId,
  viewerPlayerId,
  reason,
  onRestart,
}: ResultModalProps) {
  const defeatedSide = loserId === viewerPlayerId ? '我方' : '對方'
  const reasonText =
    reason === 'break-level-limit'
      ? `${defeatedSide}休息區的等級達到 10。`
      : reason === 'refresh-unavailable'
        ? `${defeatedSide}無法完成牌庫 Refresh。`
        : `${defeatedSide}沒有可登場的餅乾。`

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
