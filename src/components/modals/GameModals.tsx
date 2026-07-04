import { useCallback, useState } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  Pause,
  X,
} from 'lucide-react'
import type {
  DeckChoice,
  DefeatReason,
  GameCard,
  PlayerId,
} from '../../game'
import type { CookieInBattle } from '../../game'
import { OFFICIAL_DECK_RECIPES } from '../../game'
import type { CustomDeck } from '../../game/custom-deck'
import { loadCustomDecks } from '../../game/custom-deck'
import { getCardPoolEntry } from '../../game/card-pool'
import {
  CardFace,
  CardEffectText,
  EnergyCostIcons,
} from '../cards/CardVisuals'
import { deckChoiceLabel } from '../gameUiLabels'
import { DeckEditorModal } from './DeckEditorModal'
import './GameModals.css'

export { EffectOrderModal, OptionalCostAttackModal, InspectDeckModal, DrawUpToSelector } from './PendingDecisionModals'

export type OpeningSetupStep =
  | 'deck-selection'
  | 'rps'
  | 'choose-order'
  | 'mulligan'
  | 'starting-cookie'

export interface OpeningSetupModalProps {
  step: OpeningSetupStep
  message: string
  hand: GameCard[]
  deckConfig: { player: DeckChoice; ai: DeckChoice }
  onSelectDeck: (deck: DeckChoice, customDeck?: CustomDeck) => void
  onRps: (choice: 'rock' | 'paper' | 'scissors') => void
  onChooseFirstPlayer: (playerFirst: boolean) => void
  onMulligan: (replaceAll: boolean) => void
  onSelectStartingCookie: (instanceId: string) => void
}

export function OpeningSetupModal({
  step,
  message,
  hand,
  deckConfig,
  onSelectDeck,
  onRps,
  onChooseFirstPlayer,
  onMulligan,
  onSelectStartingCookie,
}: OpeningSetupModalProps) {
  const [showDeckEditor, setShowDeckEditor] = useState(false)
  const [savedCustomDeck, setSavedCustomDeck] = useState<CustomDeck | null>(
    null,
  )

  const title =
    step === 'deck-selection'
      ? '選擇牌組'
      : step === 'rps'
      ? '猜拳決定選擇權'
      : step === 'choose-order'
        ? '選擇先攻或後攻'
        : step === 'mulligan'
          ? '第一次調度'
          : '放置起始餅乾'

  const handleDeckEditorSave = useCallback(
    (deck: CustomDeck) => {
      setSavedCustomDeck(deck)
      setShowDeckEditor(false)
      onSelectDeck('custom', deck)
    },
    [onSelectDeck],
  )

  const savedDecks = loadCustomDecks()

  if (showDeckEditor) {
    return (
      <DeckEditorModal
        initialDeck={savedCustomDeck ?? undefined}
        onSave={handleDeckEditorSave}
        onClose={() => setShowDeckEditor(false)}
      />
    )
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="opening-setup-modal" role="alertdialog">
        <span>對戰開始前設定</span>
        <h2>{title}</h2>
        <p>{message}</p>
        {step === 'deck-selection' && (
          <>
            <div className="setup-deck-grid">
              {(['red', 'yellow', 'green', 'blue', 'purple'] as const).map((deck) => (
                <button
                  type="button"
                  key={deck}
                  onClick={() => onSelectDeck(deck)}
                >
                  <strong>{deckChoiceLabel[deck]}起始牌組</strong>
                  <span>選擇此牌組</span>
                </button>
              ))}
              <button
                type="button"
                className="setup-deck-custom-btn"
                onClick={() => setShowDeckEditor(true)}
              >
                <strong>{deckChoiceLabel.custom}牌組</strong>
                <span>建立或編輯牌組</span>
              </button>
            </div>
            {savedDecks.length > 0 && (
              <div className="setup-saved-custom-decks">
                <span>已儲存的自訂牌組</span>
                <div className="setup-saved-deck-list">
                  {savedDecks.map((deck) => (
                    <button
                      type="button"
                      key={deck.id}
                      className="setup-saved-deck-btn"
                      onClick={() => onSelectDeck('custom', deck)}
                    >
                      <strong>{deck.name}</strong>
                      <span>
                        {deck.entries.reduce((s, e) => s + e.count, 0)} 張
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
        {step === 'rps' && (
          <>
            <div className="setup-matchup">
              <span>我方：{deckChoiceLabel[deckConfig.player]}</span>
              <span>AI：{deckChoiceLabel[deckConfig.ai]}</span>
            </div>
            <div className="setup-choice-grid">
              <button type="button" onClick={() => onRps('rock')}>石頭</button>
              <button type="button" onClick={() => onRps('paper')}>布</button>
              <button type="button" onClick={() => onRps('scissors')}>剪刀</button>
            </div>
          </>
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
  const [minimized, setMinimized] = useState(false)

  if (!isRefresh && minimized) {
    return (
      <button
        type="button"
        className="card-reveal-dock decision-reveal-dock"
        onClick={() => setMinimized(false)}
      >
        <span>
          <strong>放置餅乾</strong>
          <small>
            {playerName}尚可補 {replacementCount ?? 1} 張
          </small>
        </span>
        <Maximize2 aria-hidden="true" />
      </button>
    )
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section
        className={`decision-modal ${!isRefresh ? 'minimizable-decision-modal' : ''}`}
        role="alertdialog"
      >
        {!isRefresh && (
          <button
            type="button"
            className="minimize-reveal"
            onClick={() => setMinimized(true)}
            title="縮小放置餅乾提示"
          >
            <Minimize2 aria-hidden="true" />
            縮小
          </button>
        )}
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
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <section
        className="card-pile-modal"
        role="dialog"
        onClick={(event) => event.stopPropagation()}
      >
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

export interface CardRevealModalProps {
  card: GameCard
  title: string
  description?: string
  confirmLabel?: string
  onConfirm: () => void
}

export function CardRevealModal({
  card,
  title,
  description,
  confirmLabel = '確認並繼續',
  onConfirm,
}: CardRevealModalProps) {
  const [minimized, setMinimized] = useState(false)

  if (minimized) {
    return (
      <button
        type="button"
        className="card-reveal-dock"
        onClick={() => setMinimized(false)}
      >
        <CardFace card={card} />
        <span>
          <strong>{card.name}</strong>
          <small>效果待確認</small>
        </span>
        <Maximize2 aria-hidden="true" />
      </button>
    )
  }

  return (
    <div className="modal-backdrop card-reveal-backdrop" role="presentation">
      <section className="card-reveal-modal" role="alertdialog">
        <button
          type="button"
          className="minimize-reveal"
          onClick={() => setMinimized(true)}
          title="縮小卡牌展示"
        >
          <Minimize2 aria-hidden="true" />
          縮小
        </button>
        <span>公開卡牌效果</span>
        <h2>{title}</h2>
        <CardFace card={card} className="reveal-card" />
        <strong>{card.name}</strong>
        <p>{description ?? card.effectText}</p>
        <button type="button" className="reveal-confirm" onClick={onConfirm}>
          {confirmLabel}
        </button>
      </section>
    </div>
  )
}

export interface DiscardRevealModalProps {
  cards: GameCard[]
  onConfirm: () => void
}

export function DiscardRevealModal({
  cards,
  onConfirm,
}: DiscardRevealModalProps) {
  const [minimized, setMinimized] = useState(false)

  if (minimized) {
    return (
      <button
        type="button"
        className="card-reveal-dock"
        onClick={() => setMinimized(false)}
      >
        {cards[0] && <CardFace card={cards[0]} />}
        <span>
          <strong>對手棄置 {cards.length} 張卡牌</strong>
          <small>公開資訊待確認</small>
        </span>
        <Maximize2 aria-hidden="true" />
      </button>
    )
  }

  return (
    <div className="modal-backdrop card-reveal-backdrop" role="presentation">
      <section
        className="card-reveal-modal discard-reveal-modal"
        role="alertdialog"
        aria-labelledby="discard-reveal-title"
      >
        <button
          type="button"
          className="minimize-reveal"
          onClick={() => setMinimized(true)}
          title="縮小棄牌展示"
        >
          <Minimize2 aria-hidden="true" />
          縮小
        </button>
        <span>公開資訊</span>
        <h2 id="discard-reveal-title">對手棄置的卡牌</h2>
        <div className="discard-reveal-cards">
          {cards.map((card) => (
            <article key={card.instanceId}>
              <CardFace card={card} />
              <strong>{card.name}</strong>
            </article>
          ))}
        </div>
        <p>對手因卡牌效果棄置以上 {cards.length} 張卡牌。</p>
        <button type="button" className="reveal-confirm" onClick={onConfirm}>
          確認並繼續
        </button>
      </section>
    </div>
  )
}

export interface TrapResponseModalProps {
  cards: GameCard[]
  selectedTrapId: string | null
  paymentCards: GameCard[]
  targetCards: GameCard[]
  discardHandCards: GameCard[]
  discardHandCost: number
  selectedDiscardHandIds: string[]
  battleCookieCostCards?: GameCard[]
  battleCookieCost?: number
  selectedBattleCookieIds?: string[]
  onSelectTrap: (instanceId: string) => void
  onToggleDiscardHand: (instanceId: string) => void
  onToggleBattleCookie?: (instanceId: string) => void
  onConfirm: () => void
  onSkip: () => void
  onInspectCard?: (card: GameCard) => void
  allowEmptyTarget?: boolean
  emptyTargetActive?: boolean
  onToggleEmptyTarget?: () => void
}

export function TrapResponseModal({
  cards,
  selectedTrapId,
  paymentCards,
  targetCards,
  discardHandCards,
  discardHandCost,
  selectedDiscardHandIds,
  battleCookieCostCards = [],
  battleCookieCost = 0,
  selectedBattleCookieIds = [],
  onSelectTrap,
  onToggleDiscardHand,
  onToggleBattleCookie,
  onConfirm,
  onSkip,
  onInspectCard,
  allowEmptyTarget,
  emptyTargetActive,
  onToggleEmptyTarget,
}: TrapResponseModalProps) {
  const [minimized, setMinimized] = useState(false)

  if (minimized) {
    return (
      <button
        type="button"
        className="card-reveal-dock decision-reveal-dock"
        onClick={() => setMinimized(false)}
      >
        <span>
          <strong>攻擊宣告回應</strong>
          <small>
            {selectedTrapId
              ? `已選擇 ${cards.find((c) => c.instanceId === selectedTrapId)?.name ?? ''}`
              : `可發動 ${cards.length} 張陷阱`}
          </small>
        </span>
        <Maximize2 aria-hidden="true" />
      </button>
    )
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section
        className="battle-response-modal trap-response-modal minimizable-decision-modal"
        role="alertdialog"
      >
        <button
          type="button"
          className="minimize-reveal"
          onClick={() => setMinimized(true)}
          title="縮小攻擊宣告回應"
        >
          <Minimize2 aria-hidden="true" />
          縮小
        </button>
        <span>攻擊宣告回應</span>
        <h2>是否發動陷阱？</h2>
        <p>每次攻擊最多發動一張陷阱。選擇卡牌後會顯示付款與目標。</p>
        <div className="modal-card-options">
          {cards.map((card) => (
            <button
              type="button"
              className={selectedTrapId === card.instanceId ? 'is-selected' : ''}
              key={card.instanceId}
              onClick={() => {
                onSelectTrap(card.instanceId)
                onInspectCard?.(card)
              }}
            >
              <CardFace card={card} selected={selectedTrapId === card.instanceId} />
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
            {discardHandCost > 0 && (
              <>
                <strong>選擇 {discardHandCost} 張手牌棄置</strong>
                <div className="modal-card-options compact trap-discard-options">
                  {discardHandCards.map((card) => (
                    <button
                      type="button"
                      className={
                        selectedDiscardHandIds.includes(card.instanceId)
                          ? 'is-selected'
                          : ''
                      }
                      key={card.instanceId}
                      onClick={() => onToggleDiscardHand(card.instanceId)}
                    >
                      <CardFace card={card} selected={selectedDiscardHandIds.includes(card.instanceId)} />
                      <span>{card.name}</span>
                    </button>
                  ))}
                </div>
                <span>
                  已選 {selectedDiscardHandIds.length}／{discardHandCost}
                </span>
              </>
            )}
            {battleCookieCost > 0 && (
              <>
                <strong>選擇 {battleCookieCost} 張戰鬥區餅乾送入棄牌區</strong>
                <div className="modal-card-options compact">
                  {battleCookieCostCards.map((card) => (
                    <button
                      type="button"
                      className={
                        selectedBattleCookieIds.includes(card.instanceId)
                          ? 'is-selected'
                          : ''
                      }
                      key={card.instanceId}
                      onClick={() => onToggleBattleCookie?.(card.instanceId)}
                    >
                      <CardFace card={card} selected={selectedBattleCookieIds.includes(card.instanceId)} />
                      <span>{card.name}</span>
                    </button>
                  ))}
                </div>
                <span>
                  已選 {selectedBattleCookieIds.length}／{battleCookieCost}
                </span>
              </>
            )}
            {allowEmptyTarget && (
              <label className="trap-target-toggle">
                <input
                  type="checkbox"
                  checked={emptyTargetActive ?? false}
                  onChange={() => onToggleEmptyTarget?.()}
                />
                不選擇目標（略過傷害效果）
              </label>
            )}
          </div>
        )}
        <div className="modal-actions">
          <button type="button" onClick={onSkip}>不發動</button>
          <button
            type="button"
            disabled={
              !selectedTrapId ||
              selectedDiscardHandIds.length !== discardHandCost ||
              selectedBattleCookieIds.length !== battleCookieCost
            }
            onClick={onConfirm}
          >
            支付並發動
          </button>
        </div>
      </section>
    </div>
  )
}

export interface AttackResponseModalProps {
  trapCards: GameCard[]
  blockerCards: CookieInBattle[]
  onSelectTrap?: (instanceId: string) => void
  onSelectBlocker?: (instanceId: string) => void
  onSkip: () => void
  onInspectCard?: (card: GameCard) => void
}

export function AttackResponseModal({
  trapCards,
  blockerCards,
  onSelectTrap,
  onSelectBlocker,
  onSkip,
  onInspectCard,
}: AttackResponseModalProps) {
  return (
    <div className="modal-backdrop" role="presentation">
      <section
        className="battle-response-modal attack-response-modal"
        role="alertdialog"
      >
        <span>攻擊宣告回應</span>
        <h2>選擇回應方式</h2>
        <p>每次攻擊只能發動一種回應，請選擇使用陷阱卡或 Blocker。</p>
        {trapCards.length > 0 && (
          <>
            <strong>陷阱卡</strong>
            <div className="modal-card-options">
              {trapCards.map((card) => (
                <button
                  type="button"
                  key={card.instanceId}
                  onClick={() => {
                    onSelectTrap?.(card.instanceId)
                    onInspectCard?.(card)
                  }}
                >
                  <CardFace card={card} />
                  <span>{card.name}</span>
                </button>
              ))}
            </div>
          </>
        )}
        {blockerCards.length > 0 && (
          <>
            <strong>Blocker</strong>
            <div className="modal-card-options">
              {blockerCards.map((cookie) => (
                <button
                  type="button"
                  key={cookie.card.instanceId}
                  onClick={() => {
                    onSelectBlocker?.(cookie.card.instanceId)
                    onInspectCard?.(cookie.card)
                  }}
                >
              <CardFace card={cookie.card} />
                  <span>{cookie.card.name}</span>
                </button>
              ))}
            </div>
          </>
        )}
        <div className="modal-actions">
          <button type="button" onClick={onSkip}>不發動</button>
        </div>
      </section>
    </div>
  )
}

export interface BlockerResponseModalProps {
  blockerCards: CookieInBattle[]
  selectedBlockerId: string | null
  paymentCards: GameCard[]
  onSelectBlocker: (instanceId: string) => void
  onConfirm: () => void
  onSkip: () => void
  onInspectCard?: (card: GameCard) => void
}

export function BlockerResponseModal({
  blockerCards,
  selectedBlockerId,
  paymentCards,
  onSelectBlocker,
  onConfirm,
  onSkip,
  onInspectCard,
}: BlockerResponseModalProps) {
  return (
    <div className="modal-backdrop" role="presentation">
      <section
        className="battle-response-modal blocker-response-modal"
        role="alertdialog"
      >
        <span>攻擊宣告回應</span>
        <h2>是否使用 Blocker 阻擋？</h2>
        <p>選擇要阻擋攻擊的餅乾，攻擊將轉移至該餅乾。</p>
        <div className="modal-card-options">
          {blockerCards.map((cookie) => (
            <button
              type="button"
              className={
                selectedBlockerId === cookie.card.instanceId ? 'is-selected' : ''
              }
              key={cookie.card.instanceId}
              onClick={() => {
                onSelectBlocker(cookie.card.instanceId)
                onInspectCard?.(cookie.card)
              }}
            >
              <CardFace card={cookie.card} />
              <span>{cookie.card.name}</span>
            </button>
          ))}
        </div>
        {selectedBlockerId && (
          <div className="battle-response-summary">
            <strong>付款支援卡</strong>
            <span>
              {paymentCards.map((card) => card.name).join('、') || '不需能量'}
            </span>
          </div>
        )}
        <div className="modal-actions">
          <button type="button" onClick={onSkip}>
            不使用
          </button>
          <button
            type="button"
            disabled={!selectedBlockerId}
            onClick={onConfirm}
          >
            使用 Blocker
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
  const [minimized, setMinimized] = useState(false)
  const pageCount = Math.max(1, Math.ceil(hand.length / FLIP_HAND_PAGE_SIZE))
  const visibleHand = hand.slice(
    pageIndex * FLIP_HAND_PAGE_SIZE,
    (pageIndex + 1) * FLIP_HAND_PAGE_SIZE,
  )

  if (minimized) {
    return (
      <button
        type="button"
        className="card-reveal-dock"
        onClick={() => setMinimized(false)}
      >
        <CardFace card={card} />
        <span>
          <strong>{card.name}</strong>
          <small>FLIP 效果待確認</small>
        </span>
        <Maximize2 aria-hidden="true" />
      </button>
    )
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section
        className="battle-response-modal flip-response-modal"
        role="alertdialog"
      >
        <button
          type="button"
          className="minimize-reveal"
          onClick={() => setMinimized(true)}
          title="縮小卡牌展示"
        >
          <Minimize2 aria-hidden="true" />
          縮小
        </button>
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
                    <CardFace card={handCard} selected={selectedDiscardIds.includes(handCard.instanceId)} />
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
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <section
        className="card-detail-modal"
        role="dialog"
        onClick={(event) => event.stopPropagation()}
      >
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
  deckConfig: { player: DeckChoice; ai: DeckChoice }
  aiActionCount: number
  onRunSimulation: () => void
  onResume: () => void
}

export function PauseModal({
  turnNumber,
  phaseLabel,
  deckConfig,
  aiActionCount,
  onRunSimulation,
  onResume,
}: PauseModalProps) {
  return (
    <div className="modal-backdrop" role="presentation">
      <section className="pause-modal" role="dialog">
        <Pause aria-hidden="true" />
        <span>對戰資訊</span>
        <h2>遊戲已暫停</h2>
        <p>目前為第 {turnNumber} 回合，{phaseLabel}。</p>
        <div className="pause-match-details">
          <span>玩家 {deckChoiceLabel[deckConfig.player]}</span>
          <b>VS</b>
          <span>AI {deckChoiceLabel[deckConfig.ai]}</span>
        </div>
        <small>AI 已執行 {aiActionCount} 個動作</small>
        <button
          className="pause-simulation-button"
          type="button"
          onClick={onRunSimulation}
        >
          執行 20 場 AI 驗證
        </button>
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
  customDeck?: CustomDeck | null
  onSetDeckListOwner: (owner: 'player' | 'ai') => void
  onClose: () => void
}

export function DeckListModal({
  deckListOwner,
  viewedDeck,
  customDeck,
  onSetDeckListOwner,
  onClose,
}: DeckListModalProps) {
  const showCustomDeck = viewedDeck === 'custom' && customDeck
  const officialRecipe = viewedDeck === 'custom' ? null : OFFICIAL_DECK_RECIPES[viewedDeck]

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
          {showCustomDeck ? (
            <div className="deck-reference-placeholder">
              自訂牌組使用卡池資料，請參考右側卡牌清單。
            </div>
          ) : viewedDeck === 'red' ? (
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
          <h2>
            {showCustomDeck
              ? customDeck.name
              : `${deckChoiceLabel[viewedDeck]}起始牌組`}
          </h2>
          {showCustomDeck ? (
            <>
              <p>
                共 {customDeck.entries.length} 種卡、
                {customDeck.entries.reduce((sum, e) => sum + e.count, 0)} 張。
              </p>
              <div className="deck-list-table">
                {customDeck.entries.map((entry) => {
                  const poolEntry = getCardPoolEntry(entry.cardNumber)
                  return (
                    <div key={entry.cardNumber}>
                      <code>{entry.cardNumber}</code>
                      <span>{poolEntry?.name ?? entry.cardNumber}</span>
                      <strong>{entry.count}</strong>
                    </div>
                  )
                })}
              </div>
            </>
          ) : officialRecipe ? (
            <>
              <p>
                共 {officialRecipe.length} 種卡、
                {officialRecipe.reduce((sum, e) => sum + e.count, 0)} 張。
              </p>
              <div className="deck-list-table">
                {officialRecipe.map((entry) => (
                  <div key={entry.cardNumber}>
                    <code>{entry.cardNumber}</code>
                    <span>{entry.name}</span>
                    <strong>{entry.count}</strong>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p>目前沒有可顯示的牌組清單。</p>
          )}
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
