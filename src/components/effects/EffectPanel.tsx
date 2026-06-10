import { Check, Sparkles } from 'lucide-react'
import type { CardEffect, CardSkill } from '../../game'
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
}

function EffectPanelContent({
  pendingEffect,
  currentEffect,
  effectHistory,
  onConfirm,
  onSkip,
}: EffectPanelProps) {
  const skill: CardSkill | undefined = pendingEffect?.skill
  const totalCost = skill ? getSkillCostTotal(skill) : 0

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
        {!isEffectUntargeted(currentEffect) && (
          <small>
            已選 {pendingEffect.selectedTargetIds.length}／
            {currentEffect.kind === 'break-to-trash'
              ? currentEffect.max
              : currentEffect.target.max}
          </small>
        )}
        <button
          type="button"
          disabled={
            (!pendingEffect.skillActivated &&
              pendingEffect.selectedPaymentIds.length !== totalCost) ||
            (!isEffectUntargeted(currentEffect) &&
              (pendingEffect.selectedTargetIds.length <
                (currentEffect.kind === 'break-to-trash'
                  ? 0
                  : currentEffect.target.min) ||
              pendingEffect.selectedTargetIds.length >
                (currentEffect.kind === 'break-to-trash'
                  ? currentEffect.max
                  : currentEffect.target.max)))
          }
          onClick={onConfirm}
        >
          <Check aria-hidden="true" />
          確認效果
        </button>
        {pendingEffect.optional && !pendingEffect.skillActivated && (
          <button
            className="skip-effect"
            type="button"
            onClick={onSkip}
          >
            不發動
          </button>
        )}
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
