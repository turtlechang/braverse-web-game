import { useEffect, useRef, useState } from 'react'
import { Check, Maximize2, Minimize2, Sparkles } from 'lucide-react'
import type { CardEffect, CardSkill, GameCard } from '../../game'
import { isEffectUntargeted } from '../../game'
import { CardEffectText, CardFace, SkillCost } from '../cards/CardVisuals'
import { getSkillCostTotal } from '../cards/cardVisualUtils'
import { describeEffect, getSkillLabels } from './effectUiUtils'
import type { PendingEffect } from './effectUiTypes'
import './EffectPanel.css'

export interface EffectPanelProps {
  pendingEffect: PendingEffect | null
  currentEffect: CardEffect | null
  effectHistory: string[]
  onConfirm: () => void
  onSkip: () => void
  onCancel?: () => void
  candidateCards?: GameCard[]
  onToggleCandidate?: (instanceId: string) => void
  costSupportCandidates?: GameCard[]
  selectedCostSupportIds?: Set<string>
  onToggleCostSupport?: (instanceId: string) => void
  discardHandCandidates?: GameCard[]
  selectedDiscardHandIds?: Set<string>
  onToggleDiscardHand?: (instanceId: string) => void
  discardHandCost?: number
  showCancelSkill?: boolean
  energyPaymentValid?: boolean
  paymentCandidates?: GameCard[]
  selectedPaymentIds?: Set<string>
  onTogglePayment?: (instanceId: string) => void
}

function EffectPanelContent({
  pendingEffect,
  currentEffect,
  effectHistory,
  onConfirm,
  onSkip,
  onCancel,
  candidateCards = [],
  onToggleCandidate,
  costSupportCandidates = [],
  selectedCostSupportIds = new Set<string>(),
  onToggleCostSupport,
  discardHandCandidates = [],
  selectedDiscardHandIds = new Set<string>(),
  onToggleDiscardHand,
  discardHandCost = 0,
  showCancelSkill = false,
  energyPaymentValid,
  paymentCandidates = [],
  selectedPaymentIds = new Set<string>(),
  onTogglePayment,
}: EffectPanelProps) {
  const targetRef = useRef<HTMLDivElement>(null)
  const hasScrolledRef = useRef(false)
  const skill: CardSkill | undefined = pendingEffect?.skill
  const totalEnergyCost = skill ? getSkillCostTotal(skill) : 0
  const supportAreaCost =
    (skill?.cost.supportToTrash ?? 0) + (skill?.cost.supportToHand ?? 0)
  const selectionLimits =
    currentEffect?.kind === 'break-to-trash' ||
      currentEffect?.kind === 'trash-to-hand' ||
      currentEffect?.kind === 'trash-to-deck'
      ? { min: 0, max: currentEffect.max }
      : currentEffect?.kind === 'break-to-battle'
        ? { min: 0, max: currentEffect.amount }
        : currentEffect?.kind === 'support-to-trash' ||
          currentEffect?.kind === 'support-to-hand' ||
          currentEffect?.kind === 'trash-to-battle' ||
          currentEffect?.kind === 'trash-to-support'
        ? { min: currentEffect.amount, max: currentEffect.amount }
        : currentEffect?.kind === 'gain-hp' &&
            currentEffect.target &&
            !currentEffect.target.sourceOnly
          ? currentEffect.target
        : currentEffect && !isEffectUntargeted(currentEffect) &&
            currentEffect.kind !== 'inspect-deck' &&
            currentEffect.kind !== 'optional-cost-attack' &&
            currentEffect.kind !== 'disable-block' &&
            currentEffect.kind !== 'flip-to-support' &&
            currentEffect.kind !== 'opponent-battle-to-trash'
          ? currentEffect.target
          : null

  const hasCostPhase =
    !pendingEffect?.skillActivated &&
    (totalEnergyCost > 0 || supportAreaCost > 0 || discardHandCost > 0)

  const energyPaid = totalEnergyCost > 0
    ? energyPaymentValid === true
    : true
  const supportPaid =
    supportAreaCost === 0 ||
    pendingEffect?.selectedCostSupportToTrashIds.length === supportAreaCost
  const discardPaid =
    discardHandCost === 0 ||
    pendingEffect?.selectedDiscardHandIds.length === discardHandCost
  const costReady = !hasCostPhase || (energyPaid && supportPaid && discardPaid)

  const targetReady =
    !selectionLimits ||
    (pendingEffect &&
      pendingEffect.selectedTargetIds.length >= selectionLimits.min &&
      pendingEffect.selectedTargetIds.length <= selectionLimits.max)

  const hasPaymentContent =
    !pendingEffect?.skillActivated && totalEnergyCost > 0
  const hasExtraCostContent =
    costSupportCandidates.length > 0 ||
    discardHandCandidates.length > 0 ||
    supportAreaCost > 0 ||
    discardHandCost > 0
  const hasTargetContent = candidateCards.length > 0 || Boolean(currentEffect)

  const visibleColumnCount =
    [hasPaymentContent, hasExtraCostContent, hasTargetContent].filter(Boolean).length
  const gridClass =
    visibleColumnCount >= 3
      ? 'cols-3'
      : visibleColumnCount === 2
        ? 'cols-2'
        : 'cols-1'

  useEffect(() => {
    if (costReady && hasTargetContent) {
      if (targetRef.current && !hasScrolledRef.current) {
        hasScrolledRef.current = true
        targetRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      }
    }
  }, [costReady, hasTargetContent])

  useEffect(() => {
    hasScrolledRef.current = false
  }, [currentEffect?.kind])

  if (pendingEffect && currentEffect) {
    return (
      <>
        <div className="effect-panel-body">
          <span>{pendingEffect.triggerLabel}</span>
          <strong>{pendingEffect.sourceCard.name}</strong>
          <div className="skill-labels">
            {getSkillLabels(pendingEffect.skill).map((label) => (
              <span key={label}>{label}</span>
            ))}
          </div>
          <div className="effect-source-card">
            <CardFace card={pendingEffect.sourceCard} />
            <div>
              <span>{pendingEffect.sourceCard.id}</span>
              <strong>{pendingEffect.sourceCard.name}</strong>
            </div>
          </div>
          <p>
            <CardEffectText
              text={pendingEffect.sourceCard.effectText ?? ''}
            />
          </p>

          {hasCostPhase && (
            <div className="phase-progress">
              <span className={`phase-step${energyPaid && supportPaid && discardPaid ? ' is-done' : ' is-active'}`}>
                1 費用
              </span>
              <span className="phase-divider" />
              <span className={`phase-step${costReady ? ' is-active' : ''}`}>
                2 目標
              </span>
            </div>
          )}

          <div className={`effect-panel-interaction-grid ${gridClass}`}>
            {hasPaymentContent && (
              <section className="effect-panel-col effect-panel-payment-col">
                <span className="effect-panel-col-label">能量支付</span>
                <div className="skill-cost">
                  <SkillCost skill={pendingEffect.skill} />
                </div>
                <small>
                  已選 {pendingEffect.selectedPaymentIds.length}／
                  {totalEnergyCost} 張能量支援卡
                </small>
                {paymentCandidates.length > 0 ? (
                  <div className="effect-candidates effect-candidates-payment">
                    {paymentCandidates.map((card) => (
                      <button
                        type="button"
                        className={
                          selectedPaymentIds.has(card.instanceId)
                            ? 'is-selected'
                            : ''
                        }
                        key={card.instanceId}
                        onClick={() => onTogglePayment?.(card.instanceId)}
                      >
                        <CardFace card={card} selected={selectedPaymentIds.has(card.instanceId)} />
                        <span>{card.name}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <small>沒有可支付的支援卡</small>
                )}
              </section>
            )}

            {hasExtraCostContent && (
              <section className="effect-panel-col effect-panel-extra-cost-col">
                <span className="effect-panel-col-label">額外代價</span>
                {supportAreaCost > 0 && (
                  <small>
                    已選 {pendingEffect.selectedCostSupportToTrashIds.length}／
                    {supportAreaCost} 張支援區代價
                  </small>
                )}
                {discardHandCost > 0 && (
                  <small>
                    已選 {pendingEffect.selectedDiscardHandIds.length}／
                    {discardHandCost} 張手牌代價
                  </small>
                )}
                {costSupportCandidates.length > 0 && (
                  <>
                    <small>選擇要作為代價棄置的支援區卡牌</small>
                    <div className="effect-candidates effect-candidates-cost-support">
                      {costSupportCandidates.map((card) => (
                        <button
                          type="button"
                          className={
                            selectedCostSupportIds.has(card.instanceId)
                              ? 'is-selected'
                              : ''
                          }
                          key={card.instanceId}
                          onClick={() => onToggleCostSupport?.(card.instanceId)}
                        >
                          <CardFace card={card} selected={selectedCostSupportIds.has(card.instanceId)} />
                          <span>{card.name}</span>
                        </button>
                      ))}
                    </div>
                  </>
                )}
                {discardHandCandidates.length > 0 && (
                  <>
                    <small>選擇要作為代價棄置的手牌</small>
                    <div className="effect-candidates effect-candidates-discard-hand">
                      {discardHandCandidates.map((card) => (
                        <button
                          type="button"
                          className={
                            selectedDiscardHandIds.has(card.instanceId)
                              ? 'is-selected'
                              : ''
                          }
                          key={card.instanceId}
                          onClick={() => onToggleDiscardHand?.(card.instanceId)}
                        >
                          <CardFace card={card} selected={selectedDiscardHandIds.has(card.instanceId)} />
                          <span>{card.name}</span>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </section>
            )}

            {hasTargetContent && (
              <section
                className="effect-panel-col effect-panel-target-col"
                ref={targetRef}
              >
                <span className="effect-panel-col-label">目標</span>
                <div className="effect-instruction">
                  <Sparkles aria-hidden="true" />
                  <span>{describeEffect(currentEffect)}</span>
                </div>
                {candidateCards.length > 0 && (
                  <div className="effect-candidates effect-candidates-target">
                    {candidateCards.map((card) => (
                      <button
                        type="button"
                        className={
                          pendingEffect.selectedTargetIds.includes(card.instanceId)
                            ? 'is-selected'
                            : ''
                        }
                        key={card.instanceId}
                        onClick={() => onToggleCandidate?.(card.instanceId)}
                      >
                        <CardFace
                          card={card}
                          selected={pendingEffect.selectedTargetIds.includes(card.instanceId)}
                        />
                        <span>{card.name}</span>
                      </button>
                    ))}
                  </div>
                )}
                {selectionLimits && (
                  <small>
                    已選 {pendingEffect.selectedTargetIds.length}／
                    {selectionLimits.max}
                  </small>
                )}
              </section>
            )}
          </div>
        </div>

        <div className="effect-panel-sticky-actions">
          {showCancelSkill && (
            <button
              className="skip-effect"
              type="button"
              onClick={onCancel}
            >
              取消技能
            </button>
          )}
          {(pendingEffect.optional && !pendingEffect.skillActivated) ||
          ('optional' in currentEffect && currentEffect.optional) ? (
            <button
              className="skip-effect"
              type="button"
              onClick={onSkip}
            >
              不發動
            </button>
          ) : null}
          <button
            type="button"
            disabled={!costReady || !targetReady}
            onClick={onConfirm}
          >
            <Check aria-hidden="true" />
            確認效果
          </button>
        </div>
      </>
    )
  }

  if (effectHistory.length > 0) {
    return (
      <>
        <span>效果紀錄</span>
        <strong>{effectHistory[0]}</strong>
      </>
    )
  }

  return null
}

export function EffectPanel(props: EffectPanelProps) {
  const [minimized, setMinimized] = useState(false)

  if (!props.pendingEffect && props.effectHistory.length === 0) {
    return null
  }

  if (minimized && props.pendingEffect) {
    return (
      <button
        type="button"
        className="effect-panel-dock"
        onClick={() => setMinimized(false)}
      >
        <span>
          <strong>{props.pendingEffect.sourceCard.name}</strong>
          <small>{props.pendingEffect.triggerLabel}</small>
        </span>
        <Maximize2 aria-hidden="true" />
      </button>
    )
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section
        className={`battle-response-modal effect-panel${props.pendingEffect ? '' : ' is-complete'}`}
        role="alertdialog"
        aria-live="polite"
      >
        {props.pendingEffect && (
          <button
            type="button"
            className="minimize-reveal"
            onClick={() => setMinimized(true)}
            title="縮小技能效果"
          >
            <Minimize2 aria-hidden="true" />
            縮小
          </button>
        )}
        <EffectPanelContent {...props} />
        {props.effectHistory.length > 0 && (
          <ol>
            {props.effectHistory.map((entry, index) => (
              <li key={`${entry}-${index}`}>{entry}</li>
            ))}
          </ol>
        )}
      </section>
    </div>
  )
}
