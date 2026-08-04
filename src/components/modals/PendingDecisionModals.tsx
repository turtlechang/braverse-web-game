import { useState, useCallback } from 'react'
import { AlertTriangle, ChevronDown, ChevronUp, Maximize2, Minimize2 } from 'lucide-react'
import type {
  EnergyColor,
  GameCard,
  InspectDeckRestDestination,
  PendingEffectOrderItem,
} from '../../game'
import { CardEffectText, CardFace } from '../cards/CardVisuals'
import {
  GuidedPhaseSteps,
  type GuidedPhase,
  type GuidedPhaseId,
} from '../effects/GuidedPhaseSteps'
import './PendingDecisionModals.css'

const effectOrderLabels: Record<PendingEffectOrderItem['kind'], string> = {
  'faint-effect': '昏厥效果',
  'after-damage-effect': '受傷後效果',
  'draw-up-to': '抽牌效果',
  'inspect-deck': '檢視牌庫',
  'reveal-top-deck': '展示牌庫頂',
  'stage-trigger': '場景效果',
}

export interface EffectOrderModalProps {
  items: PendingEffectOrderItem[]
  onConfirm: (orderedIds: string[]) => void
}

export function EffectOrderModal({
  items,
  onConfirm,
}: EffectOrderModalProps) {
  const chooseFirst = (firstId: string) => {
    onConfirm([
      firstId,
      ...items
        .filter((item) => item.id !== firstId)
        .map((item) => item.id),
    ])
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section
        className="battle-response-modal effect-order-modal"
        role="alertdialog"
      >
        <span>同時觸發</span>
        <h2>選擇效果處理順序</h2>
        <p className="faint-effect-text">
          這些效果屬於同一位玩家，請選擇要先處理的效果。
        </p>
        <div className="modal-card-options">
          {items.map((item) => (
            <button
              type="button"
              key={item.id}
              onClick={() => chooseFirst(item.id)}
            >
              <strong>{item.sourceCardName}</strong>
              <span>{effectOrderLabels[item.kind]}</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  )
}

export interface DrawUpToSelectorProps {
  max: number
  deckSize: number
  onConfirm: (drawCount: number) => void
}

export function DrawUpToSelector({
  max,
  deckSize,
  onConfirm,
}: DrawUpToSelectorProps) {
  const [drawCount, setDrawCount] = useState(0)
  const effectiveMax = Math.min(max, deckSize)

  return (
    <div className="draw-up-to-selector">
      <div className="draw-up-to-options">
        {Array.from({ length: effectiveMax + 1 }, (_, i) => (
          <button
            key={i}
            type="button"
            className={`draw-up-to-option ${drawCount === i ? 'is-selected' : ''}`}
            onClick={() => setDrawCount(i)}
          >
            <span className="draw-up-to-option-label">
              {i === 0 ? '不抽' : `抽 ${i} 張`}
            </span>
            {i > 0 && (
              <span className="draw-up-to-option-hint">
                從牌庫頂抽取
              </span>
            )}
          </button>
        ))}
      </div>
      <div className="modal-actions draw-up-to-actions">
        <button
          type="button"
          onClick={() => onConfirm(drawCount)}
        >
          {drawCount === 0 ? '略過抽牌' : `抽取 ${drawCount} 張牌`}
        </button>
      </div>
    </div>
  )
}

export interface DrawUpToResponseModalProps {
  sourceCardName: string
  sourceCard?: GameCard
  effectText?: string
  max: number
  deckSize: number
  onConfirm: (drawCount: number) => void
  /**
   * 這次抽牌之後還會接一個棄牌步驟（BS3-070／BS3-088 的
   * draw-up-to-then-discard）。顯示「步驟 1/2」讓玩家知道等下彈出的棄牌
   * 提示是同一個效果的下一步，不是另一張卡的新效果。
   */
  followedByDiscard?: boolean
}

export function DrawUpToResponseModal({
  sourceCardName,
  sourceCard,
  effectText,
  max,
  deckSize,
  onConfirm,
  followedByDiscard = false,
}: DrawUpToResponseModalProps) {
  const [minimized, setMinimized] = useState(false)
  const effectiveMax = Math.min(max, deckSize)

  if (minimized) {
    return (
      <button
        type="button"
        className="card-reveal-dock decision-reveal-dock"
        onClick={() => setMinimized(false)}
      >
        <span>
          <strong>{sourceCardName}</strong>
          <small>最多抽 {effectiveMax} 張牌</small>
        </span>
        <Maximize2 aria-hidden="true" />
      </button>
    )
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section
        className="battle-response-modal draw-up-to-modal"
        role="alertdialog"
      >
        <button
          type="button"
          className="minimize-reveal"
          onClick={() => setMinimized(true)}
          title="縮小抽牌效果提示"
        >
          <Minimize2 aria-hidden="true" />
          縮小
        </button>
        {followedByDiscard && (
          <GuidedPhaseSteps
            phases={[
              { id: 'draw', label: '抽牌', complete: false },
              { id: 'discard', label: '棄牌', complete: false },
            ]}
            activePhase="draw"
          />
        )}
        <span>抽牌效果</span>
        <h2>{sourceCardName}</h2>
        <div className="draw-up-to-source-card">
          {sourceCard && <CardFace card={sourceCard} />}
          <div className="draw-up-to-source-info">
            <span className="draw-up-to-source-label">效果來源</span>
            {effectText && (
              <p className="faint-effect-text draw-up-to-effect">
                <CardEffectText text={effectText} />
              </p>
            )}
          </div>
        </div>
        <p className="faint-target-hint">
          可以從牌庫抽取最多 {max} 張牌。選擇要抽取的牌數。
        </p>
        <DrawUpToSelector
          max={max}
          deckSize={deckSize}
          onConfirm={onConfirm}
        />
      </section>
    </div>
  )
}

export interface HandDiscardResponseModalProps {
  sourceCardName: string
  sourceCard?: GameCard
  effectText?: string
  hand: GameCard[]
  requiredCount: number
  selectedIds: string[]
  onToggleCard: (instanceId: string) => void
  onConfirm: () => void
  /**
   * 這個棄牌決策是同一張卡的抽牌步驟之後接著出現的（BS3-070／BS3-088 的
   * draw-up-to-then-discard）。顯示「步驟 2/2」讓玩家知道這不是另一張卡
   * 觸發的新效果，而是剛剛那個效果的下一步。
   */
  continuesFromDraw?: boolean
}

export function HandDiscardResponseModal({
  sourceCardName,
  sourceCard,
  effectText,
  hand,
  requiredCount,
  selectedIds,
  onToggleCard,
  onConfirm,
  continuesFromDraw = false,
}: HandDiscardResponseModalProps) {
  const [minimized, setMinimized] = useState(false)
  const canConfirm = selectedIds.length === requiredCount

  if (minimized) {
    return (
      <button
        type="button"
        className="card-reveal-dock decision-reveal-dock"
        onClick={() => setMinimized(false)}
      >
        <span>
          <strong>{sourceCardName}</strong>
          <small>
            已選擇 {selectedIds.length}/{requiredCount} 張手牌
          </small>
        </span>
        <Maximize2 aria-hidden="true" />
      </button>
    )
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section
        className="battle-response-modal hand-discard-modal"
        role="alertdialog"
      >
        <button
          type="button"
          className="minimize-reveal"
          onClick={() => setMinimized(true)}
          title="縮小棄置手牌提示"
        >
          <Minimize2 aria-hidden="true" />
          縮小
        </button>
        {continuesFromDraw && (
          <GuidedPhaseSteps
            phases={[
              { id: 'draw', label: '抽牌', complete: true },
              { id: 'discard', label: '棄牌', complete: false },
            ]}
            activePhase="discard"
          />
        )}
        <span>棄置手牌</span>
        <h2>{sourceCardName} 要求你棄置手牌</h2>
        <div className="draw-up-to-source-card hand-discard-source-card">
          {sourceCard && <CardFace card={sourceCard} />}
          <div className="draw-up-to-source-info">
            <span className="draw-up-to-source-label">效果來源</span>
            {effectText && (
              <p className="faint-effect-text draw-up-to-effect">
                <CardEffectText text={effectText} />
              </p>
            )}
          </div>
        </div>
        <p className="faint-target-hint">
          必須選擇 {requiredCount} 張手牌棄置。
        </p>
        <div className="modal-card-options hand-discard-options">
          {hand.map((card) => (
            <button
              type="button"
              key={card.instanceId}
              className={
                selectedIds.includes(card.instanceId) ? 'is-selected' : ''
              }
              onClick={() => onToggleCard(card.instanceId)}
            >
              <CardFace
                card={card}
                selected={selectedIds.includes(card.instanceId)}
              />
              <span>{card.name}</span>
            </button>
          ))}
        </div>
        <div className="modal-actions hand-discard-actions">
          <button type="button" disabled={!canConfirm} onClick={onConfirm}>
            確認棄置 ({selectedIds.length})
          </button>
        </div>
      </section>
    </div>
  )
}

export interface PlaceHandHpModalProps {
  sourceCardName: string
  sourceCard?: GameCard
  effectText?: string
  targetCardName: string
  hand: GameCard[]
  selectedId?: string
  onToggleCard: (instanceId: string) => void
  onConfirm: () => void
  onSkip: () => void
}

/**
 * 兩階段選擇的第二階段（cycle-hp BS4-030 世外桃源 / hand-to-hp BS4-044
 * 千年寺）：第一階段選定目標餅乾後，選擇最多 1 張手牌放回該餅乾 HP 最上方。
 * 牌名不公開，只顯示手牌給持有者自己選。
 */
export function PlaceHandHpModal({
  sourceCardName,
  sourceCard,
  effectText,
  targetCardName,
  hand,
  selectedId,
  onToggleCard,
  onConfirm,
  onSkip,
}: PlaceHandHpModalProps) {
  const [minimized, setMinimized] = useState(false)

  if (minimized) {
    return (
      <button
        type="button"
        className="card-reveal-dock decision-reveal-dock"
        onClick={() => setMinimized(false)}
      >
        <span>
          <strong>{sourceCardName}</strong>
          <small>等待放置 HP 手牌</small>
        </span>
        <Maximize2 aria-hidden="true" />
      </button>
    )
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section
        className="battle-response-modal hand-discard-modal"
        role="alertdialog"
      >
        <button
          type="button"
          className="minimize-reveal"
          onClick={() => setMinimized(true)}
          title="縮小放置 HP 提示"
        >
          <Minimize2 aria-hidden="true" />
          縮小
        </button>
        <GuidedPhaseSteps
          phases={[
            { id: 'target', label: '選擇目標', complete: true },
            { id: 'place', label: '放回 HP', complete: false },
          ]}
          activePhase="place"
        />
        <span>放置 HP</span>
        <h2>{sourceCardName}：請選擇最多 1 張手牌放置到「{targetCardName}」的 HP 最上方</h2>
        <div className="draw-up-to-source-card hand-discard-source-card">
          {sourceCard && <CardFace card={sourceCard} />}
          {effectText && (
            <div className="draw-up-to-source-info">
              <span className="draw-up-to-source-label">效果說明</span>
              <p className="faint-effect-text draw-up-to-effect">
                <CardEffectText text={effectText} />
              </p>
            </div>
          )}
        </div>
        <p className="faint-target-hint">放置的手牌不會公開內容。</p>
        <div className="modal-card-options hand-discard-options">
          {hand.map((card) => (
            <button
              type="button"
              key={card.instanceId}
              className={selectedId === card.instanceId ? 'is-selected' : ''}
              onClick={() => onToggleCard(card.instanceId)}
            >
              <CardFace
                card={card}
                selected={selectedId === card.instanceId}
              />
              <span>{card.name}</span>
            </button>
          ))}
        </div>
        <div className="modal-actions hand-discard-actions">
          <button type="button" className="modal-button" onClick={onSkip}>
            略過放置
          </button>
          <button
            type="button"
            className="modal-button primary"
            disabled={!selectedId}
            onClick={onConfirm}
          >
            確認放置 ({selectedId ? 1 : 0})
          </button>
        </div>
      </section>
    </div>
  )
}

export interface OptionalCostAttackModalProps {
  sourceCardName: string
  sourceCard?: GameCard
  effectText: string
  discardHandCost: number
  energyCostTotal: number
  /** 代價的完整說明；省略時退回依張數自行組字（來源餅乾自付的能量會顯示不出來）。 */
  costText?: string
  playerHand: GameCard[]
  supportCandidates: { card: GameCard; instanceId: string }[]
  targetCandidates: { card: GameCard; instanceId: string }[]
  needsTarget: boolean
  targetMin: number
  targetLabel: string
  onSkip: () => void
  onPay: (discardIds: string[], targetId: string, paymentIds: string[]) => void
  embedded?: boolean
  /**
   * 這個「Then, 付代價」攻擊附加效果裡，有子效果的 condition 目前不成立時
   * 的提示文字。不會擋掉付款——玩家仍可能為了消耗手牌而選擇付，只是先讓
   * 玩家知道確認後這個子效果會被略過，跟陷阱／技能效果的提示一致。
   */
  unmetConditionWarning?: string | null
}

type AttackPayStep = 'decision' | 'pay'

export function OptionalCostAttackModal({
  sourceCardName,
  effectText,
  discardHandCost,
  energyCostTotal,
  costText,
  playerHand,
  supportCandidates,
  targetCandidates,
  needsTarget,
  targetMin,
  targetLabel,
  onSkip,
  onPay,
  embedded = false,
  unmetConditionWarning = null,
}: OptionalCostAttackModalProps) {
  const [minimized, setMinimized] = useState(false)
  const [step, setStep] = useState<AttackPayStep>('decision')
  const [phaseIndex, setPhaseIndex] = useState(0)
  const [selectedDiscardIds, setSelectedDiscardIds] = useState<string[]>([])
  const [selectedPaymentIds, setSelectedPaymentIds] = useState<string[]>([])
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null)

  const canPay =
    playerHand.length >= discardHandCost &&
    supportCandidates.length >= energyCostTotal &&
    (!needsTarget || targetCandidates.length >= targetMin)

  const toggleDiscard = useCallback((instanceId: string) => {
    setSelectedDiscardIds((current) =>
      current.includes(instanceId)
        ? current.filter((id) => id !== instanceId)
        : current.length < discardHandCost
          ? [...current, instanceId]
          : current,
    )
  }, [discardHandCost])

  const togglePayment = useCallback((instanceId: string) => {
    setSelectedPaymentIds((current) =>
      current.includes(instanceId)
        ? current.filter((id) => id !== instanceId)
        : current.length < energyCostTotal
          ? [...current, instanceId]
          : current,
    )
  }, [energyCostTotal])

  const toggleTarget = useCallback((instanceId: string) => {
    setSelectedTargetId((current) =>
      current === instanceId ? null : instanceId,
    )
  }, [])

  const readyToConfirm =
    selectedDiscardIds.length === discardHandCost &&
    selectedPaymentIds.length === energyCostTotal &&
    (!needsTarget || targetMin === 0 || Boolean(selectedTargetId))

  const handlePay = useCallback(() => {
    if (!readyToConfirm) return
    onPay(selectedDiscardIds, selectedTargetId ?? '', selectedPaymentIds)
  }, [readyToConfirm, selectedDiscardIds, selectedTargetId, selectedPaymentIds, onPay])

  // 比照其他效果提示框的能量／代價／目標分步流程(見 EffectPanel.tsx 的
  // GuidedPhaseSteps),一次只處理一件事,而非把代價與目標塞進同一畫面。
  const phaseIds: GuidedPhaseId[] = [
    ...(energyCostTotal > 0 ? (['energy'] as const) : []),
    ...(discardHandCost > 0 ? (['cost'] as const) : []),
    ...(needsTarget ? (['target'] as const) : []),
  ]
  const activePhase = phaseIds[phaseIndex] ?? null
  const phases: GuidedPhase[] = phaseIds.map((id, index) => ({
    id,
    label: id === 'energy' ? '能量' : id === 'cost' ? '代價' : '目標',
    complete: index < phaseIndex,
  }))
  const activePhaseReady =
    activePhase === 'energy'
      ? selectedPaymentIds.length === energyCostTotal
      : activePhase === 'cost'
        ? selectedDiscardIds.length === discardHandCost
        : activePhase === 'target'
          ? targetMin === 0 || Boolean(selectedTargetId)
          : true
  const hasPreviousPhase = phaseIndex > 0
  const hasNextPhase = phaseIndex < phaseIds.length - 1

  const startPay = () => {
    setPhaseIndex(0)
    setStep('pay')
  }

  const goBack = () => {
    if (hasPreviousPhase) {
      setPhaseIndex((index) => index - 1)
      return
    }
    setSelectedDiscardIds([])
    setSelectedPaymentIds([])
    setSelectedTargetId(null)
    setPhaseIndex(0)
    setStep('decision')
  }

  const handlePrimaryAction = () => {
    if (hasNextPhase) {
      setPhaseIndex((index) => index + 1)
      return
    }
    handlePay()
  }

  if (minimized) {
    return (
      <button
        type="button"
        className="card-reveal-dock decision-reveal-dock"
        onClick={() => setMinimized(false)}
      >
        <span>
          <strong>攻擊可選效果</strong>
          <small>{sourceCardName}</small>
        </span>
        <Maximize2 aria-hidden="true" />
      </button>
    )
  }

  // costText 未提供時退回依張數組字；兩者都沒有內容就顯示「無」，
  // 避免畫面出現一個空白的「代價：」看起來像壞掉。
  const fallbackCostText = [
    energyCostTotal > 0 ? `支付 ${energyCostTotal} 張能量支援卡` : null,
    discardHandCost > 0 ? `棄置 ${discardHandCost} 張手牌` : null,
  ]
    .filter(Boolean)
    .join('、')
  const resolvedCostText = costText ?? (fallbackCostText || '無')

  const optionalCostAttackContent = (
    <>
      {!embedded && (
        <button
          type="button"
          className="minimize-reveal"
          onClick={() => setMinimized(true)}
          title="縮小攻擊可選效果"
        >
          <Minimize2 aria-hidden="true" />
          縮小
        </button>
      )}
        <span>攻擊可選效果</span>
        {!embedded && <h2>{sourceCardName}</h2>}
        {!embedded && (
          <p className="optional-cost-attack-text">{effectText}</p>
        )}
        <p className="optional-cost-attack-cost">代價：{resolvedCostText}</p>
        {unmetConditionWarning && (
          <div className="optional-cost-attack-condition-warning" role="alert">
            <AlertTriangle aria-hidden="true" />
            <span>{unmetConditionWarning}</span>
          </div>
        )}

        {step === 'decision' && (
          <div className="modal-actions modal-actions-decision">
            <button type="button" onClick={onSkip}>
              略過
            </button>
            <button
              type="button"
              disabled={!canPay}
              onClick={startPay}
            >
              支付
            </button>
          </div>
        )}

        {step === 'pay' && (
          <>
            <GuidedPhaseSteps phases={phases} activePhase={activePhase} />

            {activePhase === 'energy' && (
              <div className="optional-cost-col">
                <span className="optional-cost-col-label">能量</span>
                <strong>
                  選擇 {energyCostTotal} 張支援區能量卡作為代價
                </strong>
                <div className="modal-card-options">
                  {supportCandidates.map((entry) => (
                    <button
                      type="button"
                      key={entry.instanceId}
                      className={
                        selectedPaymentIds.includes(entry.instanceId)
                          ? 'is-selected'
                          : ''
                      }
                      onClick={() => togglePayment(entry.instanceId)}
                    >
                      <CardFace card={entry.card} selected={selectedPaymentIds.includes(entry.instanceId)} />
                      <span>{entry.card.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {activePhase === 'cost' && (
              <div className="optional-cost-col">
                <span className="optional-cost-col-label">代價</span>
                <strong>
                  選擇 {discardHandCost} 張手牌棄置
                </strong>
                <div className="modal-card-options">
                  {playerHand.map((card) => (
                    <button
                      type="button"
                      key={card.instanceId}
                      className={
                        selectedDiscardIds.includes(card.instanceId)
                          ? 'is-selected'
                          : ''
                      }
                      onClick={() => toggleDiscard(card.instanceId)}
                    >
                      <CardFace card={card} selected={selectedDiscardIds.includes(card.instanceId)} />
                      <span>{card.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {activePhase === 'target' && (
              <div className="optional-cost-col">
                <span className="optional-cost-col-label">目標</span>
                <strong>
                  {targetMin === 0
                    ? `最多選擇 1 個${targetLabel}作為目標`
                    : `選擇 1 個${targetLabel}作為目標`}
                </strong>
                <div className="modal-card-options">
                  {targetCandidates.map((entry) => (
                    <button
                      type="button"
                      key={entry.instanceId}
                      className={
                        selectedTargetId === entry.instanceId
                          ? 'is-selected'
                          : ''
                      }
                      onClick={() => toggleTarget(entry.instanceId)}
                    >
                      <CardFace card={entry.card} selected={selectedTargetId === entry.instanceId} />
                      <span>{entry.card.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="modal-actions modal-actions-sticky modal-actions-decision">
              <button type="button" onClick={goBack}>
                {hasPreviousPhase ? '上一步' : '返回'}
              </button>
              <button
                type="button"
                disabled={!activePhaseReady}
                onClick={handlePrimaryAction}
              >
                {hasNextPhase ? '下一步' : '確認'}
              </button>
            </div>
          </>
        )}
    </>
  )

  if (embedded) {
    return (
      <div className="optional-cost-attack-inline">
        {optionalCostAttackContent}
      </div>
    )
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section
        className="battle-response-modal optional-cost-attack-modal"
        role="alertdialog"
      >
        {optionalCostAttackContent}
      </section>
    </div>
  )
}

export interface InspectDeckModalProps {
  sourceCardName: string
  revealedCards: GameCard[]
  pickCount: number
  restDestination?: InspectDeckRestDestination
  pickDestination?: 'hand' | 'battle'
  filterColor?: EnergyColor
  filterType?: GameCard['type']
  optionalPick?: boolean
  onConfirm: (pickedCardIds: string[], restOrder: string[]) => void
}

const REST_DESTINATION_LABEL: Record<InspectDeckRestDestination, string> = {
  bottom: '牌庫底',
  top: '牌庫頂',
  trash: '棄牌區',
}

export function InspectDeckModal({
  sourceCardName,
  revealedCards,
  pickCount,
  restDestination = 'bottom',
  pickDestination = 'hand',
  filterColor,
  filterType,
  optionalPick,
  onConfirm,
}: InspectDeckModalProps) {
  const [minimized, setMinimized] = useState(false)
  const [pickedIds, setPickedIds] = useState<string[]>([])
  // restOrder 只保存「未被選走」的卡，順序就是玩家決定的放回順序。
  const [restOrder, setRestOrder] = useState<string[]>(
    () => revealedCards.map((card) => card.instanceId),
  )

  const canPick = pickCount > 0
  const isPickable = (card: GameCard) =>
    (filterColor == null || card.energyColor === filterColor) &&
    (filterType == null || card.type === filterType)
  const hasNoPickableCard = !revealedCards.some(isPickable)
  const restLabel = REST_DESTINATION_LABEL[restDestination]
  const showReorder = restDestination !== 'trash' && restOrder.length > 1

  const resetPick = () => {
    setPickedIds([])
    setRestOrder(revealedCards.map((card) => card.instanceId))
  }

  const handlePick = (instanceId: string) => {
    setPickedIds((prev) => {
      if (prev.includes(instanceId)) {
        const next = prev.filter((id) => id !== instanceId)
        setRestOrder(
          revealedCards
            .map((card) => card.instanceId)
            .filter((id) => !next.includes(id)),
        )
        return next
      }
      if (prev.length >= pickCount) return prev
      const next = [...prev, instanceId]
      setRestOrder(
        revealedCards
          .map((card) => card.instanceId)
          .filter((id) => !next.includes(id)),
      )
      return next
    })
  }

  const swap = (index: number, otherIndex: number) => {
    if (otherIndex < 0 || otherIndex >= restOrder.length) return
    const next = [...restOrder]
    ;[next[index], next[otherIndex]] = [next[otherIndex], next[index]]
    setRestOrder(next)
  }

  const canConfirm =
    !canPick || optionalPick || hasNoPickableCard || pickedIds.length > 0

  const handleConfirm = () => {
    if (!canConfirm) return
    onConfirm(pickedIds, restOrder)
  }

  if (minimized) {
    return (
      <button
        type="button"
        className="card-reveal-dock decision-reveal-dock"
        onClick={() => setMinimized(false)}
      >
        <span>
          <strong>{sourceCardName}</strong>
          <small>
            {pickedIds.length > 0
              ? `已選 ${pickedIds.length} 張，等待確認`
              : `查看 ${revealedCards.length} 張牌`}
          </small>
        </span>
        <Maximize2 aria-hidden="true" />
      </button>
    )
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section
        className="battle-response-modal inspect-deck-modal"
        role="alertdialog"
      >
        <button
          type="button"
          className="minimize-reveal"
          onClick={() => setMinimized(true)}
          title="縮小牌庫檢視提示"
        >
          <Minimize2 aria-hidden="true" />
          縮小
        </button>
        <span>牌庫檢視</span>
        <h2>{sourceCardName}</h2>
        <p>
          查看 {revealedCards.length} 張牌
          {canPick
            ? `，${optionalPick ? '最多選' : '選擇'} ${pickCount} 張${
                pickDestination === 'battle' ? '登場' : '加入手牌'
              }`
            : ''}
          ，其餘
          {restDestination === 'trash' ? '放入' : '以指定順序放回'}
          {restLabel}。
        </p>
        {canPick && hasNoPickableCard && (
          <p className="inspect-deck-no-match">
            沒有符合條件的卡牌，將全部放入{restLabel}。
          </p>
        )}
        {canPick && (
          <div className="inspect-deck-grid">
            {revealedCards.map((card) => (
              <button
                type="button"
                key={card.instanceId}
                className={pickedIds.includes(card.instanceId) ? 'is-selected' : ''}
                disabled={!isPickable(card) || (!pickedIds.includes(card.instanceId) && pickedIds.length >= pickCount)}
                onClick={() => handlePick(card.instanceId)}
                aria-label={`選擇${card.name}`}
              >
                <CardFace card={card} />
                <span>{card.name}</span>
              </button>
            ))}
          </div>
        )}
        {showReorder && (
          <div className="inspect-deck-sort">
            <strong>排序剩餘牌（上到下 = {restLabel}方向由先到後）</strong>
            <div className="inspect-deck-sort-list">
              {restOrder.map((id, index) => {
                const card = revealedCards.find((c) => c.instanceId === id)
                return (
                  <div key={id} className="inspect-deck-sort-row">
                    <CardFace card={card ?? { id: '', instanceId: id, name: id, type: 'item' }} />
                    <div className="inspect-deck-sort-info">
                      <span>{card?.name ?? id}</span>
                      <div className="inspect-deck-sort-actions">
                        <button
                          type="button"
                          aria-label={`${card?.name ?? id} 上移`}
                          disabled={index === 0}
                          onClick={() => swap(index, index - 1)}
                        >
                          <ChevronUp aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          aria-label={`${card?.name ?? id} 下移`}
                          disabled={index === restOrder.length - 1}
                          onClick={() => swap(index, index + 1)}
                        >
                          <ChevronDown aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
        <div className="modal-actions">
          {pickedIds.length > 0 && (
            <button
              type="button"
              onClick={resetPick}
            >
              返回
            </button>
          )}
          <button
            type="button"
            disabled={!canConfirm}
            onClick={handleConfirm}
          >
            確認並放回
          </button>
        </div>
      </section>
    </div>
  )
}

export interface RevealTopDeckModalProps {
  sourceCardName: string
  revealedCard: GameCard
  matched: boolean
  /**
   * 檢視者是不是這次翻牌的擁有者。翻牌是公開資訊，對手也看得到同一張卡，
   * 但只有擁有者能按確認——非擁有者若照樣顯示可按的按鈕，按下去只會靜靜地
   * 什麼都不發生。
   */
  canConfirm?: boolean
  onConfirm: () => void
}

export function RevealTopDeckModal({
  sourceCardName,
  revealedCard,
  matched,
  canConfirm = true,
  onConfirm,
}: RevealTopDeckModalProps) {
  const [minimized, setMinimized] = useState(false)

  if (minimized) {
    return (
      <button
        type="button"
        className="card-reveal-dock"
        onClick={() => setMinimized(false)}
      >
        <CardFace card={revealedCard} />
        <span>
          <strong>{revealedCard.name}</strong>
          <small>翻牌展示</small>
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
        <span>{sourceCardName} — 翻開牌庫頂</span>
        <h2>{matched ? '條件匹配！' : '條件未匹配'}</h2>
        <CardFace card={revealedCard} className="reveal-card" />
        <strong>{revealedCard.name}</strong>
        <p>{matched ? '翻到的卡牌符合條件，效果發動。' : '翻到的卡牌不符合條件，效果不發動。'}</p>
        <button
          type="button"
          className="reveal-confirm"
          onClick={canConfirm ? onConfirm : undefined}
          disabled={!canConfirm}
        >
          {canConfirm ? '確認並繼續' : '等待對手確認…'}
        </button>
      </section>
    </div>
  )
}
