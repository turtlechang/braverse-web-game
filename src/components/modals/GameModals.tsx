import { lazy, Suspense, useCallback, useState } from 'react'
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  Pause,
  X,
} from 'lucide-react'
import type {
  BuiltInDeckChoice,
  CardEffect,
  DeckChoice,
  EnergyCost,
  GameEndReason,
  GameCard,
  PlayerId,
} from '../../game'
import type { BattleUiTrapEffectTargetStep } from '../../hooks/battleUiContracts'
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

export { EffectOrderModal, OptionalCostAttackModal, InspectDeckModal, RevealTopDeckModal, DrawUpToResponseModal, HandDiscardResponseModal, OpponentRestSupportResponseModal, PlaceHandHpModal, ReorderHpModal } from './PendingDecisionModals'

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
          <div className="modal-card-options decision-card-options">
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
  equippedCards?: GameCard[]
  onInspectEquip?: (card: GameCard) => void
  onClose: () => void
}

const splitNormalAttackText = (attackText: string) => {
  const match = attackText.match(/^([\s\S]*?\{da\})\s*(\d+)([\s\S]*)$/i)

  if (!match) return null

  return {
    mainText: match[1],
    attackPower: Number(match[2]),
    followUpText: match[3].trim(),
  }
}

const splitStageEffectText = (effectText: string) =>
  effectText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

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
  trapCostOptionLabels?: string[]
  selectedTrapCostOptionIndex?: number
  onSelectTrapCostOption?: (index: number) => void
  alternativeCostCards?: GameCard[]
  alternativeCostAmount?: number
  selectedAlternativeCostIds?: string[]
  onToggleAlternativeCost?: (instanceId: string) => void
  paymentCards: GameCard[]
  trapEnergyCostTotal?: number
  trapPaymentValid?: boolean
  selectedPaymentIds?: string[]
  onTogglePayment?: (instanceId: string) => void
  targetCards: GameCard[]
  discardHandCards: GameCard[]
  discardHandCost: number
  selectedDiscardHandIds: string[]
  handToBreakCards?: GameCard[]
  handToBreakCost?: number
  selectedHandToBreakIds?: string[]
  onToggleHandToBreak?: (instanceId: string) => void
  battleCookieCostCards?: GameCard[]
  battleCookieCost?: number
  selectedBattleCookieIds?: string[]
  attackerCard?: GameCard | null
  attackTargetCard?: GameCard | null
  trapTargetCandidates?: CookieInBattle[]
  trapEffectTargetSteps?: BattleUiTrapEffectTargetStep[]
  selectedTrapTargetId?: string | null
  onSelectTrap: (instanceId: string) => void
  onSelectTrapTarget?: (instanceId: string) => void
  onSelectTrapEffectTarget?: (effectIndex: number, instanceId: string) => void
  onSkipTrapEffectTarget?: (effectIndex: number) => void
  trapSelfTargetCandidates?: CookieInBattle[]
  trapSelfTargetRequired?: boolean
  selectedTrapSelfTargetId?: string | null
  onSelectTrapSelfTarget?: (instanceId: string) => void
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
  /**
   * 目前選中的陷阱裡，有子效果的 condition 目前不成立時的提示文字。不會
   * 擋掉發動——玩家仍可能為了消耗手牌或觸發聯動而選擇發動，只是先讓玩家
   * 知道確認後這個子效果會被略過（跟 EffectPanel 對技能／物品／場景卡
   * 效果的「目前條件不成立，確認後會略過此效果」提示一致）。
   * damage-by-break-count／modify-attack-by-break-count 這兩種依休息區
   * 張數縮放的效果另外用更精確的文字說明「不會造成傷害／不會改變攻擊力」
   * （BS3-045 等卡的規則裁定），優先顯示。
   */
  unmetConditionWarning?: string | null
}

type TrapStep = 'select' | GuidedPhaseId

function AttackDeclarationSummary({
  attackerCard = null,
  attackTargetCard = null,
}: {
  attackerCard?: GameCard | null
  attackTargetCard?: GameCard | null
}) {
  if (!attackerCard && !attackTargetCard) return null

  return (
    <div className="attack-declaration-summary" aria-label="本次攻擊資訊">
      {attackerCard && (
        <div className="attack-declaration-card attack-declaration-attacker">
          <span>攻擊者</span>
          <CardFace card={attackerCard} />
          <strong>{attackerCard.name}</strong>
        </div>
      )}
      {attackerCard && attackTargetCard && (
        <ChevronRight className="attack-declaration-arrow" aria-hidden="true" />
      )}
      {attackTargetCard && (
        <div className="attack-declaration-card attack-declaration-target">
          <span>攻擊目標</span>
          <CardFace card={attackTargetCard} />
          <strong>{attackTargetCard.name}</strong>
        </div>
      )}
    </div>
  )
}

export function TrapResponseModal({
  cards,
  selectedTrapId,
  trapCostOptionLabels = [],
  selectedTrapCostOptionIndex = 0,
  onSelectTrapCostOption,
  alternativeCostCards = [],
  alternativeCostAmount = 0,
  selectedAlternativeCostIds = [],
  onToggleAlternativeCost,
  paymentCards,
  trapEnergyCostTotal = 0,
  trapPaymentValid = true,
  selectedPaymentIds = [],
  onTogglePayment,
  targetCards,
  discardHandCards,
  discardHandCost,
  selectedDiscardHandIds,
  handToBreakCards = [],
  handToBreakCost = 0,
  selectedHandToBreakIds = [],
  onToggleHandToBreak,
  battleCookieCostCards = [],
  battleCookieCost = 0,
  selectedBattleCookieIds = [],
  attackerCard = null,
  attackTargetCard = null,
  trapTargetCandidates = [],
  trapEffectTargetSteps = [],
  selectedTrapTargetId = null,
  onSelectTrap,
  onSelectTrapTarget,
  onSelectTrapEffectTarget,
  onSkipTrapEffectTarget,
  trapSelfTargetCandidates = [],
  trapSelfTargetRequired = true,
  selectedTrapSelfTargetId = null,
  onSelectTrapSelfTarget,
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
  unmetConditionWarning = null,
}: TrapResponseModalProps) {
  const [minimized, setMinimized] = useState(false)
  const [step, setStep] = useState<TrapStep>(() =>
    selectedTrapId
      ? trapCostOptionLabels.length > 1
        ? 'choice'
        : 'energy'
      : 'select',
  )
  const selectedTrap = cards.find((card) => card.instanceId === selectedTrapId)
  const selectedTrapText = selectedTrap?.trap?.text ?? selectedTrap?.effectText

  const hasEnergyPhase = trapEnergyCostTotal > 0
  const hasCostChoicePhase = trapCostOptionLabels.length > 1
  const hasCostPhase =
    discardHandCost > 0 || battleCookieCost > 0 || handToBreakCost > 0
  const hasTargetPhase =
    (trapEffectTargetSteps.length > 0 && Boolean(onSelectTrapEffectTarget)) ||
    (trapTargetCandidates.length > 0 && Boolean(onSelectTrapTarget)) ||
    supportTrashAmount > 0 ||
    supportToHandAmount > 0 ||
    handToSupportAmount > 0 ||
    trashToDeckAmount > 0 ||
    Boolean(allowEmptyTarget)
  const hasSelfTargetPhase =
    trapSelfTargetCandidates.length > 0 && Boolean(onSelectTrapSelfTarget)

  const phaseIds: GuidedPhaseId[] = [
    ...(hasCostChoicePhase ? (['choice'] as const) : []),
    ...(hasEnergyPhase ? (['energy'] as const) : []),
    ...(hasCostPhase ? (['cost'] as const) : []),
    ...(hasTargetPhase ? (['target'] as const) : []),
    ...(hasSelfTargetPhase ? (['selfTarget'] as const) : []),
  ]
  const activePhase =
    step !== 'select' && phaseIds.includes(step)
      ? step
      : (phaseIds[0] ?? null)
  const activePhaseIndex = activePhase ? phaseIds.indexOf(activePhase) : -1

  const energyReady =
    trapEnergyCostTotal === 0 ||
    (selectedPaymentIds.length === trapEnergyCostTotal && trapPaymentValid)
  const costReady =
    selectedDiscardHandIds.length === discardHandCost &&
    selectedHandToBreakIds.length === handToBreakCost &&
    selectedBattleCookieIds.length === battleCookieCost
  const costChoiceReady =
    !hasCostChoicePhase ||
    (selectedTrapCostOptionIndex >= 0 &&
      (alternativeCostAmount === 0 ||
        selectedAlternativeCostIds.length === alternativeCostAmount))
  const targetReady =
    (supportTrashAmount === 0 ||
      supportTrashCards.length === 0 ||
      selectedSupportTrashIds.length === supportTrashAmount) &&
    (supportToHandAmount === 0 ||
      supportToHandCards.length === 0 ||
      selectedSupportToHandIds.length === supportToHandAmount) &&
    (handToSupportAmount === 0 ||
      handToSupportCards.length === 0 ||
      selectedHandToSupportIds.length === handToSupportAmount) &&
    trapEffectTargetSteps.every(
      (targetStep) =>
        targetStep.selectedTargetIds.length >= targetStep.min ||
        targetStep.allowEmpty,
    )
  const selfTargetReady =
    !trapSelfTargetRequired ||
    trapSelfTargetCandidates.length === 0 ||
    Boolean(selectedTrapSelfTargetId)
  const activePhaseReady =
    activePhase === 'choice'
      ? costChoiceReady
      : activePhase === 'energy'
        ? energyReady
      : activePhase === 'cost'
        ? costReady
        : activePhase === 'target'
          ? targetReady
          : activePhase === 'selfTarget'
            ? selfTargetReady
            : true
  const phases: GuidedPhase[] = phaseIds.map((id, index) => ({
    id,
    label: id === 'energy' ? '能量' : id === 'cost' ? '代價' : id === 'selfTarget' ? '自身目標' : '目標',
    complete: index < activePhaseIndex,
  }))
  const hasPreviousPhase = activePhaseIndex > 0
  const hasNextPhase =
    activePhaseIndex >= 0 && activePhaseIndex < phaseIds.length - 1

  const handleSelectTrap = (instanceId: string) => {
    onSelectTrap(instanceId)
    // 若沒有替代支付，activePhase 會自動回到第一個實際階段（通常是 energy）。
    if (instanceId) setStep('choice')
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
    !targetReady ||
    !selfTargetReady ||
    !costChoiceReady

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
            <AttackDeclarationSummary
              attackerCard={attackerCard}
              attackTargetCard={attackTargetCard}
            />
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
            {selectedTrap && unmetConditionWarning && (
              <div className="trap-zero-effect-warning" role="alert">
                <AlertTriangle aria-hidden="true" />
                <span>{unmetConditionWarning}</span>
              </div>
            )}
            <GuidedPhaseSteps phases={phases} activePhase={activePhase} />
            <div className="trap-response-body">
            <AttackDeclarationSummary
              attackerCard={attackerCard}
              attackTargetCard={attackTargetCard}
            />

            {activePhase === 'choice' && (
              <div className="trap-guided-section">
                <span className="trap-response-col-label">支付方式</span>
                <div className="modal-card-options compact trap-discard-options">
                  {trapCostOptionLabels.map((label, index) => (
                    <button
                      type="button"
                      className={selectedTrapCostOptionIndex === index ? 'is-selected' : ''}
                      key={label}
                      onClick={() => onSelectTrapCostOption?.(index)}
                    >
                      <strong>{label}</strong>
                    </button>
                  ))}
                </div>
                {alternativeCostAmount > 0 && (
                  <>
                    <strong>選擇 {alternativeCostAmount} 張符合條件的棄牌區餅乾放入休息區</strong>
                    <div className="modal-card-options compact trap-discard-options">
                      {alternativeCostCards.map((card) => (
                        <button
                          type="button"
                          className={selectedAlternativeCostIds.includes(card.instanceId) ? 'is-selected' : ''}
                          key={card.instanceId}
                          onClick={() => onToggleAlternativeCost?.(card.instanceId)}
                        >
                          <CardFace
                            card={card}
                            selected={selectedAlternativeCostIds.includes(card.instanceId)}
                          />
                          <span>{card.name}</span>
                        </button>
                      ))}
                    </div>
                    <span>已選 {selectedAlternativeCostIds.length} / {alternativeCostAmount}</span>
                  </>
                )}
              </div>
            )}

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
                {handToBreakCost > 0 && (
                  <>
                    <strong>選擇 {handToBreakCost} 張手牌餅乾放入休息區</strong>
                    <div className="modal-card-options compact trap-discard-options">
                      {handToBreakCards.map((card) => (
                        <button
                          type="button"
                          className={selectedHandToBreakIds.includes(card.instanceId) ? 'is-selected' : ''}
                          key={card.instanceId}
                          onClick={() => onToggleHandToBreak?.(card.instanceId)}
                        >
                          <CardFace card={card} selected={selectedHandToBreakIds.includes(card.instanceId)} />
                          <span>{card.name}</span>
                        </button>
                      ))}
                    </div>
                    <span>已選 {selectedHandToBreakIds.length}／{handToBreakCost}</span>
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
                {trapEffectTargetSteps.length > 0 && onSelectTrapEffectTarget ? (
                  <>
                    <strong>依效果順序選擇目標餅乾</strong>
                    {trapEffectTargetSteps.map((targetStep, stepIndex) => (
                      <div className="trap-effect-target-step" key={targetStep.effectIndex}>
                        <span>
                          第 {stepIndex + 1} 段目標（最多 {targetStep.max} 張）
                        </span>
                        <div className="modal-card-options compact trap-target-options">
                          {targetStep.candidates.map((candidate) => {
                            const isAttacker =
                              attackerCard?.instanceId === candidate.card.instanceId
                            const selected = targetStep.selectedTargetIds.includes(
                              candidate.card.instanceId,
                            )
                            return (
                              <button
                                type="button"
                                className={[
                                  selected ? 'is-selected' : '',
                                  isAttacker ? 'is-attacker' : '',
                                ]
                                  .filter(Boolean)
                                  .join(' ')}
                                key={candidate.card.instanceId}
                                onClick={() =>
                                  onSelectTrapEffectTarget(
                                    targetStep.effectIndex,
                                    candidate.card.instanceId,
                                  )
                                }
                              >
                                <CardFace card={candidate.card} selected={selected} />
                                <span>{candidate.card.name}</span>
                                {isAttacker && (
                                  <small className="attacker-badge">⚔ 攻擊中</small>
                                )}
                              </button>
                            )
                          })}
                        </div>
                        <span>
                          已選 {targetStep.selectedTargetIds.length}／最多 {targetStep.max}
                        </span>
                        {targetStep.allowEmpty && (
                          <button
                            type="button"
                            className={
                              targetStep.selectedTargetIds.length === 0
                                ? 'is-selected trap-target-skip'
                                : 'trap-target-skip'
                            }
                            onClick={() =>
                              onSkipTrapEffectTarget?.(targetStep.effectIndex)
                            }
                          >
                            略過第 {stepIndex + 1} 段效果
                          </button>
                        )}
                      </div>
                    ))}
                  </>
                ) : trapTargetCandidates.length > 0 && onSelectTrapTarget ? (
                  <>
                    <strong>選擇目標餅乾</strong>
                    <div className="modal-card-options compact trap-target-options">
                      {trapTargetCandidates.map((candidate) => {
                        const isAttacker =
                          attackerCard?.instanceId === candidate.card.instanceId
                        return (
                          <button
                            type="button"
                            className={[
                              selectedTrapTargetId === candidate.card.instanceId
                                ? 'is-selected'
                                : '',
                              isAttacker ? 'is-attacker' : '',
                            ]
                              .filter(Boolean)
                              .join(' ')}
                            key={candidate.card.instanceId}
                            onClick={() =>
                              onSelectTrapTarget(candidate.card.instanceId)
                            }
                          >
                            <CardFace
                              card={candidate.card}
                              selected={
                                selectedTrapTargetId === candidate.card.instanceId
                              }
                            />
                            <span>{candidate.card.name}</span>
                            {isAttacker && (
                              <small className="attacker-badge">
                                ⚔ 攻擊中
                              </small>
                            )}
                          </button>
                        )
                      })}
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

            {activePhase === 'selfTarget' && trapSelfTargetCandidates.length > 0 && (
              <div>
                <strong>選擇自身目標餅乾</strong>
                <div className="modal-card-options compact trap-target-options">
                  {trapSelfTargetCandidates.map((candidate) => (
                    <button
                      type="button"
                      className={
                        selectedTrapSelfTargetId === candidate.card.instanceId
                          ? 'is-selected'
                          : ''
                      }
                      key={candidate.card.instanceId}
                      onClick={() =>
                        onSelectTrapSelfTarget?.(candidate.card.instanceId)
                      }
                    >
                      <CardFace
                        card={candidate.card}
                        selected={
                          selectedTrapSelfTargetId === candidate.card.instanceId
                        }
                      />
                      <span>{candidate.card.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {phaseIds.length === 0 && (
              <p className="trap-no-guided-step">此陷阱不需額外選擇，可直接確認發動。</p>
            )}
            </div>
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
  attackResponseSkills?: CookieInBattle[]
  attackerCard?: GameCard | null
  attackTargetCard?: GameCard | null
  onSelectTrap?: (instanceId: string) => void
  onSelectBlocker?: (instanceId: string) => void
  onSelectAttackResponse?: (instanceId: string) => void
  onSkip: () => void
  onInspectCard?: (card: GameCard) => void
}

export function AttackResponseModal({
  trapCards,
  blockerCards,
  attackResponseSkills = [],
  attackerCard,
  attackTargetCard,
  onSelectTrap,
  onSelectBlocker,
  onSelectAttackResponse,
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
            陷阱 {trapCards.length} 張 · Blocker {blockerCards.length} 張 ·
            攻擊回應技能 {attackResponseSkills.length} 張
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
        <p>每次攻擊只能發動一種回應，請選擇陷阱、Blocker 或攻擊回應技能。</p>
        <AttackDeclarationSummary
          attackerCard={attackerCard}
          attackTargetCard={attackTargetCard}
        />
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
        {attackResponseSkills.length > 0 && (
          <>
            <strong>攻擊回應技能</strong>
            <div className="modal-card-options">
              {attackResponseSkills.map((cookie) => (
                <button
                  type="button"
                  className="attack-response-skill-option"
                  data-card-id={cookie.card.id}
                  key={cookie.card.instanceId}
                  onClick={() => onSelectAttackResponse?.(cookie.card.instanceId)}
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
  selectedTargetIds?: string[]
  candidateCards?: GameCard[]
  candidateLabel?: string
  /**
   * 戰鬥區目標的卡面清單。原本戰鬥區只能靠 modal 穿透後點卡，
   * 在平板／小視窗容易被提示框遮住，因此同時提供可直接點選的目標入口。
   */
  targetCandidateCards?: GameCard[]
  onSelectTarget?: (instanceId: string) => void
  energyCost?: EnergyCost
  paymentCandidates?: GameCard[]
  selectedPaymentIds?: string[]
  paymentCostTotal?: number
  paymentValid?: boolean
  onSelectPayment?: (instanceId: string) => void
  /** 整組昏厥技能可選擇是否發動（例如 BS3-061）。 */
  optional?: boolean
  costHandAmount?: number
  costHandCandidates?: GameCard[]
  selectedCostHandIds?: string[]
  onSelectCostHand?: (instanceId: string) => void
  costSupportAmount?: number
  costSupportCandidates?: GameCard[]
  selectedCostSupportIds?: string[]
  onSelectCostSupport?: (instanceId: string) => void
  allowSkip?: boolean
  onSkip?: () => void
  onConfirm: () => void
}

export function FaintEffectResponseModal({
  card,
  minTargets,
  maxTargets,
  selectedTargetCount,
  selectedTargetName,
  selectedTargetIds = [],
  candidateCards = [],
  candidateLabel = '卡牌',
  targetCandidateCards = [],
  onSelectTarget,
  energyCost,
  paymentCandidates = [],
  selectedPaymentIds = [],
  paymentCostTotal = 0,
  paymentValid = false,
  onSelectPayment,
  optional = false,
  costHandAmount = 0,
  costHandCandidates = [],
  selectedCostHandIds = [],
  onSelectCostHand,
  costSupportAmount = 0,
  costSupportCandidates = [],
  selectedCostSupportIds = [],
  onSelectCostSupport,
  allowSkip = false,
  onSkip,
  onConfirm,
}: FaintEffectResponseModalProps) {
  const [minimized, setMinimized] = useState(false)
  const hasTargetChoice = maxTargets > 0
  const selectedTargetIdSet = new Set(selectedTargetIds)
  const selectedPaymentIdSet = new Set(selectedPaymentIds)
  const selectedCostHandIdSet = new Set(selectedCostHandIds)
  const selectedCostSupportIdSet = new Set(selectedCostSupportIds)
  const paymentReady = paymentCostTotal === 0 || paymentValid
  const faintCostReady =
    selectedCostHandIds.length === costHandAmount &&
    selectedCostSupportIds.length === costSupportAmount
  const canConfirm =
    selectedTargetCount >= minTargets && paymentReady && faintCostReady
  const targetHint = !hasTargetChoice
    ? '此效果沒有目標選擇，確認後會繼續結算效果。'
    : candidateCards.length > 0 || targetCandidateCards.length > 0
      ? minTargets === 0
        ? `可選擇最多 ${maxTargets} 張${candidateLabel}，也可以不選擇。`
        : `必須選擇 ${minTargets} 張${candidateLabel}。`
      : minTargets === 0
        ? `可選擇最多 ${maxTargets} 個對手餅乾作為目標，也可以不選擇目標。`
        : `必須選擇 ${minTargets} 個對手餅乾作為目標。`
  const confirmLabel = !hasTargetChoice
    ? '確認結算'
    : selectedTargetCount === 0
      ? '不選擇目標'
      : `確認 (${selectedTargetCount})`

  const displayTargetHint =
    minTargets > 0 &&
    candidateCards.length === 0 &&
    targetCandidateCards.length === 0
      ? `必須選擇 ${minTargets} 張${candidateLabel}，目前沒有合法候選。`
      : targetHint

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
        <h2>{card.name} {optional ? '是否發動昏厥效果？' : '發動昏厥效果'}</h2>
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
        {paymentCostTotal > 0 && energyCost && (
          <div className="faint-payment-section">
            <strong>支付昏厥效果費用</strong>
            <div className="faint-payment-cost">
              <EnergyCostIcons cost={energyCost} />
              <span>
                已選 {selectedPaymentIds.length}/{paymentCostTotal} 張支援卡
              </span>
            </div>
            {paymentCandidates.length > 0 ? (
              <div className="modal-card-options compact faint-payment-candidates">
                {paymentCandidates.map((candidate) => {
                  const selected = selectedPaymentIdSet.has(candidate.instanceId)
                  return (
                    <button
                      type="button"
                      key={candidate.instanceId}
                      className={selected ? 'is-selected' : ''}
                      onClick={() => onSelectPayment?.(candidate.instanceId)}
                    >
                      <CardFace card={candidate} selected={selected} />
                      <span>{candidate.name}</span>
                    </button>
                  )
                })}
              </div>
            ) : (
              <small>沒有可支付的支援區能量卡</small>
            )}
          </div>
        )}
        {(costHandAmount > 0 || costSupportAmount > 0) && (
          <div className="faint-cost-section">
            <strong>先支付昏厥技能代價</strong>
            {costHandAmount > 0 && (
              <div className="faint-cost-group">
                <span>
                  從手牌棄置 {costHandAmount} 張（已選{' '}
                  {selectedCostHandIds.length}/{costHandAmount}）
                </span>
                {costHandCandidates.length > 0 ? (
                  <div className="modal-card-options compact faint-cost-hand-candidates">
                    {costHandCandidates.map((candidate) => {
                      const selected = selectedCostHandIdSet.has(candidate.instanceId)
                      return (
                        <button
                          type="button"
                          key={candidate.instanceId}
                          className={selected ? 'is-selected' : ''}
                          aria-pressed={selected}
                          onClick={() => onSelectCostHand?.(candidate.instanceId)}
                        >
                          <CardFace card={candidate} selected={selected} />
                          <span>{candidate.name}</span>
                        </button>
                      )
                    })}
                  </div>
                ) : (
                  <small>沒有符合條件的手牌，無法支付此效果。</small>
                )}
              </div>
            )}
            {costSupportAmount > 0 && (
              <div className="faint-cost-group">
                <span>
                  從支援區放置 {costSupportAmount} 張到棄牌區（已選{' '}
                  {selectedCostSupportIds.length}/{costSupportAmount}）
                </span>
                {costSupportCandidates.length > 0 ? (
                  <div className="modal-card-options compact faint-cost-support-candidates">
                    {costSupportCandidates.map((candidate) => {
                      const selected = selectedCostSupportIdSet.has(candidate.instanceId)
                      return (
                        <button
                          type="button"
                          key={candidate.instanceId}
                          className={selected ? 'is-selected' : ''}
                          aria-pressed={selected}
                          onClick={() => onSelectCostSupport?.(candidate.instanceId)}
                        >
                          <CardFace card={candidate} selected={selected} />
                          <span>{candidate.name}</span>
                        </button>
                      )
                    })}
                  </div>
                ) : (
                  <small>沒有可支付的支援區卡牌，無法支付此效果。</small>
                )}
              </div>
            )}
          </div>
        )}
        {targetCandidateCards.length > 0 && (
          <div className="modal-card-options faint-target-candidates">
            {targetCandidateCards.map((candidate) => {
              const selected = selectedTargetIdSet.has(candidate.instanceId)
              return (
                <button
                  type="button"
                  key={candidate.instanceId}
                  className={selected ? 'is-selected' : ''}
                  aria-pressed={selected}
                  onClick={() => onSelectTarget?.(candidate.instanceId)}
                >
                  <CardFace card={candidate} selected={selected} />
                  <span>{candidate.name}</span>
                </button>
              )
            })}
          </div>
        )}
        <p className="faint-target-hint">
          {optional
            ? '可以選擇發動或不發動；若發動，請先完成顯示的代價。'
            : displayTargetHint}
        </p>
        {selectedTargetName && (
          <div className="battle-response-summary">
            <strong>效果目標</strong>
            <span>{selectedTargetName}</span>
          </div>
        )}
        {candidateCards.length > 0 && (
          <div className="modal-card-options faint-card-candidates">
            {candidateCards.map((candidate) => {
              const selected = selectedTargetIdSet.has(candidate.instanceId)
              return (
                <button
                  type="button"
                  key={candidate.instanceId}
                  className={selected ? 'is-selected' : ''}
                  aria-pressed={selected}
                  onClick={() => onSelectTarget?.(candidate.instanceId)}
                >
                  <CardFace card={candidate} selected={selected} />
                  <span>{candidate.name}</span>
                </button>
              )
            })}
          </div>
        )}
        <div className="modal-actions">
          {allowSkip && (
            <button type="button" onClick={onSkip}>
              不發動
            </button>
          )}
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
  attackerCard?: GameCard | null
  attackTargetCard?: GameCard | null
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
  attackerCard,
  attackTargetCard,
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
        <AttackDeclarationSummary
          attackerCard={attackerCard}
          attackTargetCard={attackTargetCard}
        />
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
  onActivate: (chooseOneModeIndex?: number, targetIds?: string[]) => void
  onSkip: () => void
  chooseOneModes?: Extract<CardEffect, { kind: 'choose-one' }>['modes']
  targetCandidates?: GameCard[]
  targetMin?: number
  targetMax?: number
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
  chooseOneModes,
  targetCandidates = [],
  targetMin = 0,
  targetMax = 1,
}: FlipResponseModalProps) {
  const [pageIndex, setPageIndex] = useState(0)
  const [minimized, setMinimized] = useState(false)
  const [selectedChooseOneMode, setSelectedChooseOneMode] = useState<number | null>(null)
  const [selectedTargetIds, setSelectedTargetIds] = useState<string[]>([])
  const pageCount = Math.max(1, Math.ceil(hand.length / FLIP_HAND_PAGE_SIZE))
  const visibleHand = hand.slice(
    pageIndex * FLIP_HAND_PAGE_SIZE,
    (pageIndex + 1) * FLIP_HAND_PAGE_SIZE,
  )
  const targetSelectionReady =
    selectedTargetIds.length >= targetMin && selectedTargetIds.length <= targetMax

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
        {chooseOneModes && chooseOneModes.length > 0 && (
          <div className="flip-choice-section">
            <strong>選擇一項</strong>
            <div className="flip-choice-options" role="group" aria-label="FLIP 效果選項">
              {chooseOneModes.map((mode, index) => (
                <button
                  type="button"
                  className={selectedChooseOneMode === index ? 'is-selected' : ''}
                  aria-pressed={selectedChooseOneMode === index}
                  key={`${mode.label}-${index}`}
                  onClick={() => setSelectedChooseOneMode(index)}
                >
                  {mode.label}
                </button>
              ))}
            </div>
          </div>
        )}
        {targetCandidates.length > 0 && (
          <div className="flip-choice-section">
            <strong>
              選擇目標{targetMin === 0 ? '（可不選）' : ''}
            </strong>
            <div className="flip-choice-options" role="group" aria-label="FLIP 效果目標">
              {targetCandidates.map((target) => {
                const selected = selectedTargetIds.includes(target.instanceId)
                return (
                  <button
                    type="button"
                    className={selected ? 'is-selected' : ''}
                    aria-pressed={selected}
                    key={target.instanceId}
                    onClick={() => {
                      setSelectedTargetIds((current) =>
                        selected
                          ? current.filter((id) => id !== target.instanceId)
                          : current.length < targetMax
                            ? [...current, target.instanceId]
                            : current,
                      )
                    }}
                  >
                    <CardFace card={target} />
                    <span>{target.name}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )}
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
            disabled={
              selectedDiscardIds.length !== discardCount ||
              (chooseOneModes && selectedChooseOneMode === null) ||
              !targetSelectionReady
            }
            onClick={() =>
              onActivate(selectedChooseOneMode ?? undefined, selectedTargetIds)
            }
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
  equippedCards,
  onInspectEquip,
  onClose,
}: CardDetailModalProps) {
  const normalAttack = card.type === 'cookie' && card.attackText
    ? splitNormalAttackText(card.attackText)
    : null
  const stageEffectLines =
    card.type === 'stage' && card.effectText
      ? splitStageEffectText(card.effectText)
      : null
  const hasSkillSection = Boolean(card.skill && card.effectText)
  const hasSecondaryAttackSection =
    card.type === 'cookie' && Boolean(card.effectText)
  const ruleSectionCount =
    (card.effectText ? 1 : 0) + (card.type === 'cookie' ? 1 : 0)
  const isFlipCard = Boolean(card.flip) || card.officialType === 'flip'
  const effectHeading = card.skill
    ? '技能'
    : isFlipCard
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
                  {stageEffectLines
                    ? stageEffectLines.map((line, index) => (
                        <span
                          className="card-stage-effect-line"
                          key={`${line}-${index}`}
                        >
                          <CardEffectText text={line} />
                        </span>
                      ))
                    : <CardEffectText text={card.effectText} />}
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
                  {normalAttack ? (
                    <>
                      <span className="card-attack-main">
                        <CardEffectText text={normalAttack.mainText} />
                        <span
                          className="attack-power-value"
                          title={`普通攻擊力 ${normalAttack.attackPower}`}
                        >
                          {normalAttack.attackPower}
                        </span>
                      </span>
                      {normalAttack.followUpText && (
                        <span className="card-attack-follow-up">
                          <CardEffectText text={normalAttack.followUpText} />
                        </span>
                      )}
                    </>
                  ) : card.attackText ? (
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
            {equippedCards && equippedCards.length > 0 && (
              <section className="card-rule-section card-equip-section">
                <strong>已裝備</strong>
                <div className="card-equip-list">
                  {equippedCards.map((equip) => (
                    <button
                      type="button"
                      key={equip.instanceId}
                      className="card-equip-item"
                      onClick={() => onInspectEquip?.(equip)}
                    >
                      <CardFace card={equip} />
                      <span>{equip.name}</span>
                    </button>
                  ))}
                </div>
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
  reason: GameEndReason
  onRestart: () => void
}

export interface SpecialPlayModalProps {
  sourceCard: GameCard
  candidates: CookieInBattle[]
  selectedCandidateId: string | null
  onSelectCandidate: (instanceId: string) => void
  onCancel: () => void
  onConfirm: () => void
}

export function SpecialPlayModal({
  sourceCard,
  candidates,
  selectedCandidateId,
  onSelectCandidate,
  onCancel,
  onConfirm,
}: SpecialPlayModalProps) {
  return (
    <div className="modal-backdrop" role="presentation">
      <section className="battle-response-modal special-play-modal" role="dialog" aria-modal="true">
        <span className="modal-eyebrow">Special Play 特殊登場</span>
        <h2>{sourceCard.name}</h2>
        <p>選擇 1 張符合條件的戰鬥區餅乾放置到棄牌區，完成特殊登場。</p>
        <div className="special-play-source">
          <CardFace card={sourceCard} className="special-play-source-card" />
          <div>
            <strong>{sourceCard.id}</strong>
            <p>{sourceCard.effectText ?? sourceCard.skill?.text}</p>
          </div>
        </div>
        <div className="special-play-candidates" role="list" aria-label="特殊登場代價餅乾">
          {candidates.map((candidate) => {
            const id = candidate.card.instanceId
            const selected = selectedCandidateId === id
            return (
              <button
                key={id}
                type="button"
                className={`special-play-candidate${selected ? ' is-selected' : ''}`}
                aria-pressed={selected}
                onClick={() => onSelectCandidate(id)}
              >
                <CardFace card={candidate.card} className="special-play-candidate-card" />
                <span>
                  <strong>{candidate.card.name}</strong>
                  <small>LV.{candidate.card.level}／HP {candidate.card.hp}</small>
                </span>
              </button>
            )
          })}
        </div>
        <div className="modal-actions">
          <button type="button" onClick={onCancel}>取消</button>
          <button type="button" disabled={!selectedCandidateId} onClick={onConfirm}>
            確認特殊登場
          </button>
        </div>
      </section>
    </div>
  )
}

export interface AttackResponseSkillModalProps {
  skills: CookieInBattle[]
  selectedSkillId: string | null
  trashToDeckCards?: GameCard[]
  trashToDeckAmount?: number
  selectedTrashToDeckIds?: string[]
  onSelectSkill: (instanceId: string) => void
  onToggleTrashToDeck?: (instanceId: string) => void
  discardHandCards?: GameCard[]
  discardHandAmount?: number
  selectedDiscardHandIds?: string[]
  onToggleDiscardHand?: (instanceId: string) => void
  attackerCard?: GameCard | null
  attackTargetCard?: GameCard | null
  onBack: () => void
  onSkip: () => void
  onConfirm: () => void
}

/**
 * 對手指攻回應技能的正式人類操作入口。代價候選由規則層 hook
 * 提供，Modal 只負責呈現與收集選取，確認後送出 play-attack-response；
 * 技能的後續目標則由共用 EffectPanel 結算。
 */
export function AttackResponseSkillModal({
  skills,
  selectedSkillId,
  trashToDeckCards = [],
  trashToDeckAmount = 0,
  selectedTrashToDeckIds = [],
  onSelectSkill,
  onToggleTrashToDeck,
  discardHandCards = [],
  discardHandAmount = 0,
  selectedDiscardHandIds = [],
  onToggleDiscardHand,
  attackerCard,
  attackTargetCard,
  onBack,
  onSkip,
  onConfirm,
}: AttackResponseSkillModalProps) {
  const selectedSkill = skills.find(
    (cookie) => cookie.card.instanceId === selectedSkillId,
  )
  const canConfirm = Boolean(
    selectedSkill &&
      selectedTrashToDeckIds.length === trashToDeckAmount &&
      selectedDiscardHandIds.length === discardHandAmount,
  )

  return (
    <div className="modal-backdrop" role="presentation">
      <section
        className="battle-response-modal attack-response-skill-modal"
        role="alertdialog"
      >
        <button type="button" className="return-response" onClick={onBack}>
          <ChevronLeft aria-hidden="true" />
          返回回應選擇
        </button>
        <span>攻擊宣告回應</span>
        <h2>發動攻擊回應技能</h2>
        <AttackDeclarationSummary
          attackerCard={attackerCard}
          attackTargetCard={attackTargetCard}
        />
        <p>先完成技能代價；確認後會進入共用目標選擇流程。</p>
        <div className="modal-card-options">
          {skills.map((cookie) => (
            <button
              type="button"
              className={
                selectedSkillId === cookie.card.instanceId ? 'is-selected' : ''
              }
              key={cookie.card.instanceId}
              onClick={() => onSelectSkill(cookie.card.instanceId)}
            >
              <CardFace card={cookie.card} />
              <span>{cookie.card.name}</span>
            </button>
          ))}
        </div>
        {selectedSkill && (
          <>
            {discardHandAmount > 0 && (
              <div className="trap-guided-section">
                <strong>
                  從手牌棄置 {discardHandAmount} 張（已選{' '}
                  {selectedDiscardHandIds.length}/{discardHandAmount}）
                </strong>
                <div className="modal-card-options compact">
                  <div className="attack-response-discard-candidates">
                  {discardHandCards.map((card) => (
                    <button
                      type="button"
                      className={
                        selectedDiscardHandIds.includes(card.instanceId)
                          ? 'is-selected'
                          : ''
                      }
                      key={card.instanceId}
                      onClick={() => onToggleDiscardHand?.(card.instanceId)}
                    >
                      <CardFace card={card} />
                      <span>{card.name}</span>
                    </button>
                  ))}
                  </div>
                </div>
              </div>
            )}
            {trashToDeckAmount > 0 && (
              <div className="trap-guided-section">
                <strong>
                  從棄牌區洗回牌庫 {trashToDeckAmount} 張（已選{' '}
                  {selectedTrashToDeckIds.length}/{trashToDeckAmount}）
                </strong>
                <div className="modal-card-options compact">
                  <div className="attack-response-trash-to-deck-candidates">
                  {trashToDeckCards.map((card) => (
                    <button
                      type="button"
                      className={
                        selectedTrashToDeckIds.includes(card.instanceId)
                          ? 'is-selected'
                          : ''
                      }
                      key={card.instanceId}
                      onClick={() => onToggleTrashToDeck?.(card.instanceId)}
                    >
                      <CardFace card={card} />
                      <span>{card.name}</span>
                    </button>
                  ))}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
        <div className="modal-actions">
          <button type="button" onClick={onSkip}>略過此回應</button>
          <button type="button" disabled={!canConfirm} onClick={onConfirm}>
            支付代價並發動
          </button>
        </div>
      </section>
    </div>
  )
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
    reason === 'special-victory'
      ? `${winnerName}達成了特殊勝利條件。`
      : reason === 'break-level-limit'
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
