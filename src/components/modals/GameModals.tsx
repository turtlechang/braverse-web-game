import { lazy, Suspense, useCallback, useState } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  Pause,
  X,
} from 'lucide-react'
import type {
  BuiltInDeckChoice,
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
import {
  GuidedPhaseSteps,
  type GuidedPhase,
  type GuidedPhaseId,
} from '../effects/GuidedPhaseSteps'
import './GameModals.css'

const DeckEditorModal = lazy(async () => {
  const module = await import('./DeckEditorModal')
  return { default: module.DeckEditorModal }
})

export { EffectOrderModal, OptionalCostAttackModal, InspectDeckModal, DrawUpToResponseModal, HandDiscardResponseModal } from './PendingDecisionModals'

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
  deckConfig: { player: DeckChoice; ai: BuiltInDeckChoice }
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
      <Suspense
        fallback={
          <div className="modal-backdrop" role="presentation">
            <div className="modal-loading-fallback" role="status">
              載入畫面中…
            </div>
          </div>
        }
      >
        <DeckEditorModal
          initialDeck={savedCustomDeck ?? undefined}
          onSave={handleDeckEditorSave}
          onClose={() => setShowDeckEditor(false)}
        />
      </Suspense>
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
  trapEnergyCostTotal?: number
  selectedPaymentIds?: string[]
  onTogglePayment?: (instanceId: string) => void
  targetCards: GameCard[]
  discardHandCards: GameCard[]
  discardHandCost: number
  selectedDiscardHandIds: string[]
  battleCookieCostCards?: GameCard[]
  battleCookieCost?: number
  selectedBattleCookieIds?: string[]
  attackerCard?: GameCard | null
  trapTargetCandidates?: CookieInBattle[]
  selectedTrapTargetId?: string | null
  onSelectTrap: (instanceId: string) => void
  onSelectTrapTarget?: (instanceId: string) => void
  onToggleDiscardHand: (instanceId: string) => void
  onToggleBattleCookie?: (instanceId: string) => void
  onConfirm: () => void
  onSkip: () => void
  onInspectCard?: (card: GameCard) => void
  onBack?: () => void
  allowEmptyTarget?: boolean
  emptyTargetActive?: boolean
  onToggleEmptyTarget?: () => void
  supportTrashCards?: GameCard[]
  supportTrashAmount?: number
  selectedSupportTrashIds?: string[]
  onToggleSupportTrash?: (instanceId: string) => void
  supportToHandCards?: GameCard[]
  supportToHandAmount?: number
  selectedSupportToHandIds?: string[]
  onToggleSupportToHand?: (instanceId: string) => void
  handToSupportCards?: GameCard[]
  handToSupportAmount?: number
  selectedHandToSupportIds?: string[]
  onToggleHandToSupport?: (instanceId: string) => void
  trashToDeckCards?: GameCard[]
  trashToDeckAmount?: number
  selectedTrashToDeckIds?: string[]
  onToggleTrashToDeck?: (instanceId: string) => void
}

type TrapStep = 'select' | GuidedPhaseId

export function TrapResponseModal({
  cards,
  selectedTrapId,
  paymentCards,
  trapEnergyCostTotal = 0,
  selectedPaymentIds = [],
  onTogglePayment,
  targetCards,
  discardHandCards,
  discardHandCost,
  selectedDiscardHandIds,
  battleCookieCostCards = [],
  battleCookieCost = 0,
  selectedBattleCookieIds = [],
  attackerCard = null,
  trapTargetCandidates = [],
  selectedTrapTargetId = null,
  onSelectTrap,
  onSelectTrapTarget,
  onToggleDiscardHand,
  onToggleBattleCookie,
  onConfirm,
  onSkip,
  onBack,
  allowEmptyTarget,
  emptyTargetActive,
  onToggleEmptyTarget,
  supportTrashCards = [],
  supportTrashAmount = 0,
  selectedSupportTrashIds = [],
  onToggleSupportTrash,
  supportToHandCards = [],
  supportToHandAmount = 0,
  selectedSupportToHandIds = [],
  onToggleSupportToHand,
  handToSupportCards = [],
  handToSupportAmount = 0,
  selectedHandToSupportIds = [],
  onToggleHandToSupport,
  trashToDeckCards = [],
  trashToDeckAmount = 0,
  selectedTrashToDeckIds = [],
  onToggleTrashToDeck,
}: TrapResponseModalProps) {
  const [minimized, setMinimized] = useState(false)
  const [step, setStep] = useState<TrapStep>(() =>
    selectedTrapId ? 'energy' : 'select',
  )
  const selectedTrap = cards.find((card) => card.instanceId === selectedTrapId)
  const selectedTrapText = selectedTrap?.trap?.text ?? selectedTrap?.effectText

  const hasEnergyPhase = trapEnergyCostTotal > 0
  const hasCostPhase = discardHandCost > 0 || battleCookieCost > 0
  const hasTargetPhase =
    (trapTargetCandidates.length > 0 && Boolean(onSelectTrapTarget)) ||
    supportTrashAmount > 0 ||
    supportToHandAmount > 0 ||
    handToSupportAmount > 0 ||
    trashToDeckAmount > 0 ||
    Boolean(allowEmptyTarget)

  const phaseIds: GuidedPhaseId[] = [
    ...(hasEnergyPhase ? (['energy'] as const) : []),
    ...(hasCostPhase ? (['cost'] as const) : []),
    ...(hasTargetPhase ? (['target'] as const) : []),
  ]
  const activePhase =
    step !== 'select' && phaseIds.includes(step)
      ? step
      : (phaseIds[0] ?? null)
  const activePhaseIndex = activePhase ? phaseIds.indexOf(activePhase) : -1

  const energyReady =
    trapEnergyCostTotal === 0 ||
    selectedPaymentIds.length === trapEnergyCostTotal
  const costReady =
    selectedDiscardHandIds.length === discardHandCost &&
    selectedBattleCookieIds.length === battleCookieCost
  const targetReady =
    (supportTrashAmount === 0 ||
      supportTrashCards.length === 0 ||
      selectedSupportTrashIds.length === supportTrashAmount) &&
    (supportToHandAmount === 0 ||
      supportToHandCards.length === 0 ||
      selectedSupportToHandIds.length === supportToHandAmount) &&
    (handToSupportAmount === 0 ||
      handToSupportCards.length === 0 ||
      selectedHandToSupportIds.length === handToSupportAmount)
  const activePhaseReady =
    activePhase === 'energy'
      ? energyReady
      : activePhase === 'cost'
        ? costReady
        : activePhase === 'target'
          ? targetReady
          : true
  const phases: GuidedPhase[] = phaseIds.map((id, index) => ({
    id,
    label: id === 'energy' ? '能量' : id === 'cost' ? '代價' : '目標',
    complete: index < activePhaseIndex,
  }))
  const hasPreviousPhase = activePhaseIndex > 0
  const hasNextPhase =
    activePhaseIndex >= 0 && activePhaseIndex < phaseIds.length - 1

  const handleSelectTrap = (instanceId: string) => {
    onSelectTrap(instanceId)
    if (instanceId) setStep('energy')
  }

  const handleBackToSelect = () => {
    setStep('select')
  }

  const handlePrevious = () => {
    if (hasPreviousPhase) {
      setStep(phaseIds[activePhaseIndex - 1])
      return
    }
    handleBackToSelect()
  }

  const handlePrimary = () => {
    if (hasNextPhase) {
      setStep(phaseIds[activePhaseIndex + 1])
      return
    }
    onConfirm()
  }

  const confirmDisabled =
    !selectedTrapId ||
    !energyReady ||
    !costReady ||
    !targetReady

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

        {step === 'select' ? (
          <>
            {onBack && (
              <button
                type="button"
                className="return-response"
                onClick={onBack}
                title="返回選擇回應方式"
              >
                <ChevronLeft aria-hidden="true" />
                返回
              </button>
            )}
            <span>攻擊宣告回應</span>
            <h2>是否發動陷阱？</h2>
            {attackerCard && (
              <div className="trap-attacker-info">
                <span>對方正在攻擊的餅乾：</span>
                <CardFace card={attackerCard} />
                <strong>{attackerCard.name}</strong>
              </div>
            )}
            <p>每次攻擊最多發動一張陷阱。選擇卡牌後會顯示付款與目標。</p>
            <div className="modal-card-options">
              {cards.map((card) => (
                <button
                  type="button"
                  className={selectedTrapId === card.instanceId ? 'is-selected' : ''}
                  key={card.instanceId}
                  onClick={() => handleSelectTrap(card.instanceId)}
                >
                  <CardFace card={card} selected={selectedTrapId === card.instanceId} />
                  <span>{card.name}</span>
                </button>
              ))}
            </div>
            <div className="modal-actions">
              <button type="button" onClick={onSkip}>不發動</button>
            </div>
          </>
        ) : (
          <>
            <span>攻擊宣告回應</span>
            <h2>發動 {selectedTrap?.name ?? '陷阱'}</h2>
            {selectedTrap && (
              <div className="trap-selected-card-detail">
                <CardFace card={selectedTrap} />
                <div>
                  <span>{selectedTrap.id}</span>
                  <strong>{selectedTrap.name}</strong>
                  {selectedTrapText && (
                    <p>
                      <CardEffectText text={selectedTrapText} />
                    </p>
                  )}
                </div>
              </div>
            )}
            <GuidedPhaseSteps phases={phases} activePhase={activePhase} />

            {activePhase === 'energy' && (
              <div className="trap-guided-section">
                <span className="trap-response-col-label">能量支付</span>
                {selectedTrap?.trap && (
                  <EnergyCostIcons
                    cost={selectedTrap.trap.cost.energy ?? selectedTrap.trap.cost}
                  />
                )}
                <strong>選擇 {trapEnergyCostTotal} 張支援卡支付能量</strong>
                <div className="modal-card-options compact trap-discard-options">
                  {paymentCards.map((card) => (
                    <button
                      type="button"
                      className={selectedPaymentIds.includes(card.instanceId) ? 'is-selected' : ''}
                      key={card.instanceId}
                      onClick={() => onTogglePayment?.(card.instanceId)}
                    >
                      <CardFace card={card} selected={selectedPaymentIds.includes(card.instanceId)} />
                      <span>{card.name}</span>
                    </button>
                  ))}
                </div>
                <span>已選 {selectedPaymentIds.length}／{trapEnergyCostTotal}</span>
              </div>
            )}

            {activePhase === 'cost' && (
              <div className="trap-guided-section">
                <span className="trap-response-col-label">額外代價</span>
                {discardHandCost > 0 && (
                  <>
                    <strong>選擇 {discardHandCost} 張手牌棄置</strong>
                    <div className="modal-card-options compact trap-discard-options">
                      {discardHandCards.map((card) => (
                        <button
                          type="button"
                          className={selectedDiscardHandIds.includes(card.instanceId) ? 'is-selected' : ''}
                          key={card.instanceId}
                          onClick={() => onToggleDiscardHand(card.instanceId)}
                        >
                          <CardFace card={card} selected={selectedDiscardHandIds.includes(card.instanceId)} />
                          <span>{card.name}</span>
                        </button>
                      ))}
                    </div>
                    <span>已選 {selectedDiscardHandIds.length}／{discardHandCost}</span>
                  </>
                )}
                {battleCookieCost > 0 && (
                  <>
                    <strong>選擇 {battleCookieCost} 張戰鬥區餅乾送入棄牌區</strong>
                    <div className="modal-card-options compact">
                      {battleCookieCostCards.map((card) => (
                        <button
                          type="button"
                          className={selectedBattleCookieIds.includes(card.instanceId) ? 'is-selected' : ''}
                          key={card.instanceId}
                          onClick={() => onToggleBattleCookie?.(card.instanceId)}
                        >
                          <CardFace card={card} selected={selectedBattleCookieIds.includes(card.instanceId)} />
                          <span>{card.name}</span>
                        </button>
                      ))}
                    </div>
                    <span>已選 {selectedBattleCookieIds.length}／{battleCookieCost}</span>
                  </>
                )}
              </div>
            )}

            {activePhase === 'target' && (
              <div className="trap-guided-section">
                <span className="trap-response-col-label">目標</span>
                {supportTrashAmount > 0 && supportTrashCards.length > 0 && (
                  <>
                    <strong>選擇 {supportTrashAmount} 張支援區卡牌置入棄牌區</strong>
                    <div className="modal-card-options compact trap-discard-options">
                      {supportTrashCards.map((card) => (
                        <button
                          type="button"
                          className={selectedSupportTrashIds.includes(card.instanceId) ? 'is-selected' : ''}
                          key={card.instanceId}
                          onClick={() => onToggleSupportTrash?.(card.instanceId)}
                        >
                          <CardFace card={card} selected={selectedSupportTrashIds.includes(card.instanceId)} />
                          <span>{card.name}</span>
                        </button>
                      ))}
                    </div>
                    <span>已選 {selectedSupportTrashIds.length}／{supportTrashAmount}</span>
                  </>
                )}
                {supportToHandAmount > 0 && supportToHandCards.length > 0 && (
                  <>
                    <strong>選擇 {supportToHandAmount} 張支援卡返回手牌</strong>
                    <div className="modal-card-options compact trap-discard-options">
                      {supportToHandCards.map((card) => (
                        <button
                          type="button"
                          className={selectedSupportToHandIds.includes(card.instanceId) ? 'is-selected' : ''}
                          key={card.instanceId}
                          onClick={() => onToggleSupportToHand?.(card.instanceId)}
                        >
                          <CardFace card={card} selected={selectedSupportToHandIds.includes(card.instanceId)} />
                          <span>{card.name}</span>
                        </button>
                      ))}
                    </div>
                    <span>已選 {selectedSupportToHandIds.length}／{supportToHandAmount}</span>
                  </>
                )}
                {handToSupportAmount > 0 && handToSupportCards.length > 0 && (
                  <>
                    <strong>選擇 {handToSupportAmount} 張手牌以橫置置入支援區</strong>
                    <div className="modal-card-options compact trap-discard-options">
                      {handToSupportCards.map((card) => (
                        <button
                          type="button"
                          className={selectedHandToSupportIds.includes(card.instanceId) ? 'is-selected' : ''}
                          key={card.instanceId}
                          onClick={() => onToggleHandToSupport?.(card.instanceId)}
                        >
                          <CardFace card={card} selected={selectedHandToSupportIds.includes(card.instanceId)} />
                          <span>{card.name}</span>
                        </button>
                      ))}
                    </div>
                    <span>已選 {selectedHandToSupportIds.length}／{handToSupportAmount}</span>
                  </>
                )}
                {trashToDeckAmount > 0 && trashToDeckCards.length > 0 && (
                  <>
                    <strong>選擇最多 {trashToDeckAmount} 張棄牌區卡牌洗回牌庫</strong>
                    <div className="modal-card-options compact trap-discard-options">
                      {trashToDeckCards.map((card) => (
                        <button
                          type="button"
                          className={selectedTrashToDeckIds.includes(card.instanceId) ? 'is-selected' : ''}
                          key={card.instanceId}
                          onClick={() => onToggleTrashToDeck?.(card.instanceId)}
                        >
                          <CardFace card={card} selected={selectedTrashToDeckIds.includes(card.instanceId)} />
                          <span>{card.name}</span>
                        </button>
                      ))}
                    </div>
                    <span>已選 {selectedTrashToDeckIds.length}／最多 {trashToDeckAmount}</span>
                  </>
                )}
                {trapTargetCandidates.length > 0 && onSelectTrapTarget ? (
                  <>
                    <strong>選擇目標餅乾</strong>
                    <div className="modal-card-options compact trap-target-options">
                      {trapTargetCandidates.map((candidate) => (
                        <button
                          type="button"
                          className={selectedTrapTargetId === candidate.card.instanceId ? 'is-selected' : ''}
                          key={candidate.card.instanceId}
                          onClick={() => onSelectTrapTarget(candidate.card.instanceId)}
                        >
                          <CardFace card={candidate.card} selected={selectedTrapTargetId === candidate.card.instanceId} />
                          <span>{candidate.card.name}</span>
                          {attackerCard?.instanceId === candidate.card.instanceId && <small>（攻擊中）</small>}
                        </button>
                      ))}
                    </div>
                  </>
                ) : targetCards.length > 0 ? (
                  <span>效果目標：{targetCards.map((card) => card.name).join('、')}</span>
                ) : null}
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

            {phaseIds.length === 0 && (
              <p className="trap-no-guided-step">此陷阱不需額外選擇，可直接確認發動。</p>
            )}
            <div className="modal-actions modal-actions-sticky">
              <button type="button" onClick={onSkip}>不發動</button>
              <button type="button" onClick={handlePrevious}>
                <ChevronLeft aria-hidden="true" />
                上一步
              </button>
              <button
                type="button"
                disabled={activePhase ? !activePhaseReady : confirmDisabled}
                onClick={handlePrimary}
              >
                {hasNextPhase ? (
                  <>
                    下一步
                    <ChevronRight aria-hidden="true" />
                  </>
                ) : '確認發動'}
              </button>
            </div>
          </>
        )}
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
}: AttackResponseModalProps) {
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
            陷阱 {trapCards.length} 張 · Blocker {blockerCards.length} 張
          </small>
        </span>
        <Maximize2 aria-hidden="true" />
      </button>
    )
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section
        className="battle-response-modal attack-response-modal"
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
                  onClick={() => onSelectTrap?.(card.instanceId)}
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
                  onClick={() => onSelectBlocker?.(cookie.card.instanceId)}
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

export interface FaintEffectResponseModalProps {
  card: GameCard
  minTargets: number
  maxTargets: number
  selectedTargetCount: number
  selectedTargetName?: string
  onConfirm: () => void
}

export function FaintEffectResponseModal({
  card,
  minTargets,
  maxTargets,
  selectedTargetCount,
  selectedTargetName,
  onConfirm,
}: FaintEffectResponseModalProps) {
  const [minimized, setMinimized] = useState(false)
  const hasTargetChoice = maxTargets > 0
  const canConfirm = selectedTargetCount >= minTargets
  const targetHint = !hasTargetChoice
    ? '此效果沒有目標選擇，確認後會繼續結算效果。'
    : minTargets === 0
      ? `可選擇最多 ${maxTargets} 個對手餅乾作為目標，也可以不選擇目標。`
      : `必須選擇 ${minTargets} 個對手餅乾作為目標。`
  const confirmLabel = !hasTargetChoice
    ? '確認結算'
    : selectedTargetCount === 0
      ? '不選擇目標'
      : `確認 (${selectedTargetCount})`

  if (minimized) {
    return (
      <button
        type="button"
        className="card-reveal-dock decision-reveal-dock"
        onClick={() => setMinimized(false)}
      >
        <span>
          <strong>{card.name}</strong>
          <small>
            {hasTargetChoice
              ? `已選擇 ${selectedTargetCount}/${maxTargets} 個目標`
              : '昏厥效果待結算'}
          </small>
        </span>
        <Maximize2 aria-hidden="true" />
      </button>
    )
  }

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      style={hasTargetChoice ? { pointerEvents: 'none' } : undefined}
    >
      <section
        className="battle-response-modal faint-response-modal"
        role="alertdialog"
        style={hasTargetChoice ? { pointerEvents: 'auto' } : undefined}
      >
        <button
          type="button"
          className="minimize-reveal"
          onClick={() => setMinimized(true)}
          title="縮小昏厥效果提示"
        >
          <Minimize2 aria-hidden="true" />
          縮小
        </button>
        <span>昏厥效果</span>
        <h2>{card.name} 發動昏厥效果</h2>
        <div className="faint-effect-card-detail">
          <CardFace card={card} />
          <div>
            <span>{card.id}</span>
            <strong>{card.name}</strong>
            <p>
              <CardEffectText
                text={card.effectText ?? card.skill?.text ?? '昏厥效果'}
              />
            </p>
          </div>
        </div>
        <p className="faint-target-hint">{targetHint}</p>
        {selectedTargetName && (
          <div className="battle-response-summary">
            <strong>效果目標</strong>
            <span>{selectedTargetName}</span>
          </div>
        )}
        <div className="modal-actions">
          <button type="button" disabled={!canConfirm} onClick={onConfirm}>
            {confirmLabel}
          </button>
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
  onBack?: () => void
}

export function BlockerResponseModal({
  blockerCards,
  selectedBlockerId,
  paymentCards,
  onSelectBlocker,
  onConfirm,
  onSkip,
  onBack,
}: BlockerResponseModalProps) {
  const [minimized, setMinimized] = useState(false)

  if (minimized) {
    return (
      <button
        type="button"
        className="card-reveal-dock decision-reveal-dock"
        onClick={() => setMinimized(false)}
      >
        <span>
          <strong>Blocker 回應</strong>
          <small>
            {selectedBlockerId
              ? `已選擇 ${
                  blockerCards.find(
                    (cookie) => cookie.card.instanceId === selectedBlockerId,
                  )?.card.name ?? ''
                }`
              : `可使用 ${blockerCards.length} 張`}
          </small>
        </span>
        <Maximize2 aria-hidden="true" />
      </button>
    )
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section
        className="battle-response-modal blocker-response-modal"
        role="alertdialog"
      >
        <button
          type="button"
          className="minimize-reveal"
          onClick={() => setMinimized(true)}
          title="縮小 Blocker 回應"
        >
          <Minimize2 aria-hidden="true" />
          縮小
        </button>
        {onBack && (
          <button
            type="button"
            className="return-response"
            onClick={onBack}
            title="返回選擇回應方式"
          >
            <ChevronLeft aria-hidden="true" />
            返回
          </button>
        )}
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
              onClick={() => onSelectBlocker(cookie.card.instanceId)}
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
  deckConfig: { player: DeckChoice; ai: BuiltInDeckChoice }
  aiActionCount: number
  onRunSimulation: () => void
  onResume: () => void
  /** 複製 ReplayIssueBundleV1 JSON 到剪貼簿；resolve 為是否成功。 */
  onCopyIssueBundle?: () => Promise<boolean>
}

export function PauseModal({
  turnNumber,
  phaseLabel,
  deckConfig,
  aiActionCount,
  onRunSimulation,
  onResume,
  onCopyIssueBundle,
}: PauseModalProps) {
  const [copyResult, setCopyResult] = useState<'idle' | 'copied' | 'failed'>(
    'idle',
  )
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
        {onCopyIssueBundle && (
          <button
            className="pause-simulation-button"
            type="button"
            onClick={() => {
              void onCopyIssueBundle().then((ok) => {
                setCopyResult(ok ? 'copied' : 'failed')
              })
            }}
          >
            {copyResult === 'copied'
              ? '已複製問題包'
              : copyResult === 'failed'
                ? '複製失敗，請再試一次'
                : '複製問題包'}
          </button>
        )}
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
