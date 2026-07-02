import { Check, Sparkles } from 'lucide-react'
import type { CardEffect, CardSkill, GameCard } from '../../game'
import { isEffectUntargeted } from '../../game'
import { CardEffectText, SkillCost } from '../cards/CardVisuals'
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
}: EffectPanelProps) {
  const skill: CardSkill | undefined = pendingEffect?.skill
  const totalEnergyCost = skill ? getSkillCostTotal(skill) : 0
  const supportAreaCost =
    (skill?.cost.supportToTrash ?? 0) + (skill?.cost.supportToHand ?? 0)
  const selectionLimits =
    currentEffect?.kind === 'break-to-trash'
      ? { min: 0, max: currentEffect.max }
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
            currentEffect.kind !== 'disable-block'
          ? currentEffect.target
          : null

  const hasCostPhase =
    !pendingEffect?.skillActivated &&
    (totalEnergyCost > 0 || supportAreaCost > 0 || discardHandCost > 0)

  const energyPaid = pendingEffect?.selectedPaymentIds.length === totalEnergyCost
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

  if (pendingEffect && currentEffect) {
    return (
      <>
        <span>{pendingEffect.triggerLabel}</span>
        <strong>{pendingEffect.sourceCard.name}</strong>
        <div className="skill-labels">
          {getSkillLabels(pendingEffect.skill).map((label) => (
            <span key={label}>{label}</span>
          ))}
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

        {!pendingEffect.skillActivated && (
          <div className="skill-cost">
            <strong>技能費用</strong>
            <SkillCost skill={pendingEffect.skill} />
            <small>
              已選 {pendingEffect.selectedPaymentIds.length}／
              {totalEnergyCost} 張能量支援卡
            </small>
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
          </div>
        )}
        {costSupportCandidates.length > 0 && !pendingEffect.skillActivated && (
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
                  {card.name}
                </button>
              ))}
            </div>
          </>
        )}
        {discardHandCandidates.length > 0 && !pendingEffect.skillActivated && (
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
                  {card.name}
                </button>
              ))}
            </div>
          </>
        )}
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
                {card.name}
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
        <button
          type="button"
          disabled={!costReady || !targetReady}
          onClick={onConfirm}
        >
          <Check aria-hidden="true" />
          確認效果
        </button>
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
  if (!props.pendingEffect && props.effectHistory.length === 0) {
    return null
  }

  return (
    <aside
      className={`effect-panel${props.pendingEffect ? '' : ' is-complete'}`}
      aria-live="polite"
    >
      <EffectPanelContent {...props} />
      {props.effectHistory.length > 0 && (
        <ol>
          {props.effectHistory.map((entry, index) => (
            <li key={`${entry}-${index}`}>{entry}</li>
          ))}
        </ol>
      )}
    </aside>
  )
}
