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
  candidateCards?: GameCard[]
  onToggleCandidate?: (instanceId: string) => void
}

function EffectPanelContent({
  pendingEffect,
  currentEffect,
  effectHistory,
  onConfirm,
  onSkip,
  candidateCards = [],
  onToggleCandidate,
}: EffectPanelProps) {
  const skill: CardSkill | undefined = pendingEffect?.skill
  const totalCost = skill ? getSkillCostTotal(skill) : 0
  const selectionLimits =
    currentEffect?.kind === 'break-to-trash'
      ? { min: 0, max: currentEffect.max }
      : currentEffect?.kind === 'support-to-trash' ||
          currentEffect?.kind === 'support-to-hand' ||
          currentEffect?.kind === 'trash-to-battle'
        ? { min: currentEffect.amount, max: currentEffect.amount }
        : currentEffect && !isEffectUntargeted(currentEffect)
          ? currentEffect.target
          : null

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
        {!pendingEffect.skillActivated && (
          <div className="skill-cost">
            <strong>技能費用</strong>
            <SkillCost skill={pendingEffect.skill} />
            <small>
              已選 {pendingEffect.selectedPaymentIds.length} 張支援卡
            </small>
          </div>
        )}
        <div className="effect-instruction">
          <Sparkles aria-hidden="true" />
          <span>{describeEffect(currentEffect)}</span>
        </div>
        {candidateCards.length > 0 && (
          <div className="effect-candidates">
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
          disabled={
            (!pendingEffect.skillActivated &&
              pendingEffect.selectedPaymentIds.length !== totalCost) ||
            (Boolean(selectionLimits) &&
              (pendingEffect.selectedTargetIds.length <
                selectionLimits!.min ||
              pendingEffect.selectedTargetIds.length >
                selectionLimits!.max))
          }
          onClick={onConfirm}
        >
          <Check aria-hidden="true" />
          確認效果
        </button>
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
