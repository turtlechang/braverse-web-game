import { useState } from 'react'
import {
  ArrowRight,
  Check,
  ChevronLeft,
  Maximize2,
  Minimize2,
  Sparkles,
} from 'lucide-react'
import type { CardEffect, CardSkill, GameCard } from '../../game'
import { isEffectUntargeted } from '../../game'
import { CardEffectText, CardFace, EnergyCostIcons } from '../cards/CardVisuals'
import { getSkillCostTotal } from '../cards/cardVisualUtils'
import { describeEffect, getSkillLabels } from './effectUiUtils'
import {
  GuidedPhaseSteps,
  type GuidedPhase,
  type GuidedPhaseId,
} from './GuidedPhaseSteps'
import type { PendingEffect } from './effectUiTypes'
import {
  OptionalCostAttackModal,
  type OptionalCostAttackModalProps,
} from '../modals/PendingDecisionModals'
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
  hpToTrashCandidates?: GameCard[]
  selectedHpToTrashTargetIds?: Set<string>
  onToggleHpToTrash?: (instanceId: string) => void
  hpToTrashCost?: number
  showCancelSkill?: boolean
  energyPaymentValid?: boolean
  paymentCandidates?: GameCard[]
  selectedPaymentIds?: Set<string>
  onTogglePayment?: (instanceId: string) => void
  trashBattleCookieCandidates?: GameCard[]
  selectedTrashBattleCookieIds?: Set<string>
  onToggleTrashBattleCookie?: (instanceId: string) => void
  trashBattleCookieCost?: number
  trashToDeckBottomCandidates?: GameCard[]
  selectedTrashToDeckBottomIds?: Set<string>
  onToggleTrashToDeckBottom?: (instanceId: string) => void
  trashToDeckBottomCost?: number
  trashToDeckCandidates?: GameCard[]
  selectedTrashToDeckIds?: Set<string>
  onToggleTrashToDeck?: (instanceId: string) => void
  trashToDeckCost?: number
  showTargetSelection?: boolean
  effectConditionMet?: boolean
  optionalCostAttack?: Omit<OptionalCostAttackModalProps, 'embedded'> | null
  /** 目前效果是「選擇一項」時，由呼叫端接手展開選定的模式。 */
  onChooseMode?: (modeIndex: number) => void
}

function CandidateButtons({
  cards,
  selectedIds,
  onToggle,
  className,
}: {
  cards: GameCard[]
  selectedIds: Set<string>
  onToggle?: (instanceId: string) => void
  className: string
}) {
  if (cards.length === 0) return null

  return (
    <div className={`effect-candidates ${className}`}>
      {cards.map((card) => {
        const selected = selectedIds.has(card.instanceId)
        return (
          <button
            type="button"
            className={selected ? 'is-selected' : ''}
            key={card.instanceId}
            onClick={() => onToggle?.(card.instanceId)}
          >
            <CardFace card={card} selected={selected} />
            <span>{card.name}</span>
          </button>
        )
      })}
    </div>
  )
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
  hpToTrashCandidates = [],
  selectedHpToTrashTargetIds = new Set<string>(),
  onToggleHpToTrash,
  hpToTrashCost = 0,
  showCancelSkill = false,
  energyPaymentValid,
  paymentCandidates = [],
  selectedPaymentIds = new Set<string>(),
  onTogglePayment,
  trashBattleCookieCandidates = [],
  selectedTrashBattleCookieIds = new Set<string>(),
  onToggleTrashBattleCookie,
  trashBattleCookieCost = 0,
  trashToDeckBottomCandidates = [],
  selectedTrashToDeckBottomIds = new Set<string>(),
  onToggleTrashToDeckBottom,
  trashToDeckBottomCost = 0,
  trashToDeckCandidates = [],
  selectedTrashToDeckIds = new Set<string>(),
  onToggleTrashToDeck,
  trashToDeckCost = 0,
  showTargetSelection = true,
  effectConditionMet = true,
  optionalCostAttack = null,
  onChooseMode,
}: EffectPanelProps) {
  const skill: CardSkill | undefined = pendingEffect?.skill
  const totalEnergyCost = skill ? getSkillCostTotal(skill) : 0
  const supportAreaCost =
    (skill?.cost.supportToTrash ?? 0) + (skill?.cost.supportToHand ?? 0)
  const selectionLimits =
    currentEffect?.kind === 'break-to-trash' ||
      currentEffect?.kind === 'trash-to-hand' ||
      currentEffect?.kind === 'trash-to-deck'
      ? { min: 0, max: currentEffect.max }
      : currentEffect?.kind === 'opponent-battle-to-trash'
        ? { min: 1, max: 1 }
      : currentEffect?.kind === 'break-to-battle' ||
          currentEffect?.kind === 'support-to-battle'
        ? { min: 0, max: currentEffect.amount }
        : currentEffect?.kind === 'hand-to-break-by-level-sum' ||
          currentEffect?.kind === 'break-to-hand-by-level-sum'
          ? { min: 1, max: candidateCards.length }
        : currentEffect?.kind === 'hand-to-break' ||
            currentEffect?.kind === 'break-to-hand' ||
            currentEffect?.kind === 'rest-support'
          ? {
              min: currentEffect.optional ? 0 : currentEffect.amount,
              max: currentEffect.amount,
            }
          : currentEffect?.kind === 'hand-to-hp' ||
              currentEffect?.kind === 'support-to-hp'
            ? currentEffect.selectTarget
              ? { min: currentEffect.optional ? 0 : 1, max: 2 }
              : { min: currentEffect.optional ? 0 : 1, max: 1 }
          : currentEffect?.kind === 'cycle-hp'
            ? { min: 0, max: 2 }
          : currentEffect?.kind === 'rest-support-and-damage'
            ? { min: 0, max: currentEffect.supportAmount + currentEffect.target.max }
            : currentEffect?.kind === 'set-active' && currentEffect.selectable
              ? { min: 0, max: currentEffect.supportCount }
        : currentEffect?.kind === 'support-to-trash' ||
          currentEffect?.kind === 'support-to-hand' ||
          currentEffect?.kind === 'hand-to-support' ||
          currentEffect?.kind === 'trash-to-battle' ||
          currentEffect?.kind === 'trash-to-support' ||
          currentEffect?.kind === 'trash-to-break'
        ? { min: currentEffect.amount, max: currentEffect.amount }
        : currentEffect?.kind === 'gain-hp' &&
            currentEffect.target &&
            !currentEffect.target.sourceOnly
          ? currentEffect.target
        : currentEffect && !isEffectUntargeted(currentEffect) &&
        currentEffect.kind !== 'inspect-deck' &&
            currentEffect.kind !== 'optional-cost-attack' &&
            currentEffect.kind !== 'disable-block' &&
            currentEffect.kind !== 'hand-to-battle' &&
            currentEffect.kind !== 'opponent-trash-to-break' &&
            currentEffect.kind !== 'flip-to-support'
          ? currentEffect.target
          : null

  const energyPaid = totalEnergyCost > 0
    ? energyPaymentValid === true
    : true
  const supportPaid =
    supportAreaCost === 0 ||
    pendingEffect?.selectedCostSupportToTrashIds.length === supportAreaCost
  const discardPaid =
    discardHandCost === 0 ||
    pendingEffect?.selectedDiscardHandIds.length === discardHandCost
  const hpToTrashPaid =
    hpToTrashCost === 0 ||
    (pendingEffect?.selectedHpToTrashTargetIds.length ?? 0) === hpToTrashCost
  const trashBattleCookiePaid =
    trashBattleCookieCost === 0 ||
    pendingEffect?.selectedTrashBattleCookieIds.length === trashBattleCookieCost
  const trashToDeckBottomPaid =
    trashToDeckBottomCost === 0 ||
    (pendingEffect?.selectedTrashToDeckBottomIds ?? []).length ===
      trashToDeckBottomCost
  const trashToDeckPaid =
    trashToDeckCost === 0 ||
    (pendingEffect?.selectedTrashToDeckIds ?? []).length === trashToDeckCost
  const extraCostReady =
    supportPaid &&
    discardPaid &&
    hpToTrashPaid &&
    trashBattleCookiePaid &&
    trashToDeckBottomPaid &&
    trashToDeckPaid

  const isLevelSumEffect =
    currentEffect?.kind === 'hand-to-break-by-level-sum' ||
    currentEffect?.kind === 'break-to-hand-by-level-sum'

  const selectedLevelSum = isLevelSumEffect
    ? candidateCards
        .filter((card) =>
          pendingEffect?.selectedTargetIds.includes(card.instanceId),
        )
        .reduce(
          (sum, card) => sum + (card.type === 'cookie' ? card.level : 0),
          0,
        )
    : 0

  const targetReady =
    !showTargetSelection ||
    (isLevelSumEffect
      ? selectedLevelSum === currentEffect.targetSum
      : !selectionLimits ||
        Boolean(
          pendingEffect &&
            pendingEffect.selectedTargetIds.length >= selectionLimits.min &&
            pendingEffect.selectedTargetIds.length <= selectionLimits.max,
        ))

  const isChooseOneEffect =
    currentEffect?.kind === 'choose-one' && Boolean(onChooseMode)
  const hasSelectedChooseOneMode =
    (pendingEffect?.chooseOneModes?.length ?? 0) > 0
  const chooseOneModes = isChooseOneEffect ? currentEffect.modes : null
  const chooseOneSignature = pendingEffect
    ? `${pendingEffect.sourceCard.instanceId}:${pendingEffect.effectIndex}`
    : 'none'
  const [chooseOneSelection, setChooseOneSelection] = useState<{
    signature: string
    modeIndex: number | null
  }>({ signature: '', modeIndex: null })
  const selectedChooseOneMode =
    chooseOneSelection.signature === chooseOneSignature
      ? chooseOneSelection.modeIndex
      : null

  const hasPaymentContent =
    !pendingEffect?.skillActivated &&
    totalEnergyCost > 0
  const automaticCostDescriptions = pendingEffect?.skillActivated
    ? []
    : [
        ...(skill?.restSource ? ['將效果來源卡橫置'] : []),
        ...(skill?.cost.hpToTrash?.amount
          ? [`棄置 ${skill.cost.hpToTrash.amount} 張 HP 卡`]
          : []),
        ...(skill?.cost.hpToTrash?.untilRemainingHp !== undefined
          ? [`棄置 HP 卡直到剩餘 ${skill.cost.hpToTrash.untilRemainingHp} HP`]
          : []),
        ...(skill?.cost.selfToBreakArea ? ['將效果來源餅乾放到休息區'] : []),
      ]
  const hasExtraCostContent =
    !pendingEffect?.skillActivated &&
    (costSupportCandidates.length > 0 ||
      discardHandCandidates.length > 0 ||
      hpToTrashCandidates.length > 0 ||
      trashBattleCookieCandidates.length > 0 ||
      supportAreaCost > 0 ||
      discardHandCost > 0 ||
      trashBattleCookieCost > 0 ||
      trashToDeckBottomCandidates.length > 0 ||
      trashToDeckBottomCost > 0 ||
      trashToDeckCandidates.length > 0 ||
      trashToDeckCost > 0 ||
      automaticCostDescriptions.length > 0)
  const hasTargetContent =
    effectConditionMet && showTargetSelection && selectionLimits !== null
  const hasChooseOneContent =
    chooseOneModes !== null && !hasSelectedChooseOneMode
  const visiblePaymentPhase = hasPaymentContent && !hasSelectedChooseOneMode
  const visibleExtraCostPhase = hasExtraCostContent && !hasSelectedChooseOneMode

  const phaseIds: GuidedPhaseId[] = [
    ...(visiblePaymentPhase ? (['energy'] as const) : []),
    ...(visibleExtraCostPhase ? (['cost'] as const) : []),
    ...(hasChooseOneContent ? (['choice'] as const) : []),
    ...(hasTargetContent ? (['target'] as const) : []),
  ]
  const progressPhaseIds: GuidedPhaseId[] = hasSelectedChooseOneMode
    ? [
        ...(hasPaymentContent ? (['energy'] as const) : []),
        ...(hasExtraCostContent ? (['cost'] as const) : []),
        ...(['choice'] as const),
        ...(hasTargetContent ? (['target'] as const) : []),
      ]
    : phaseIds
  const phaseSignature = pendingEffect
    ? `${pendingEffect.sourceCard.instanceId}:${pendingEffect.effectIndex}:${pendingEffect.skillActivated}:${phaseIds.join('-')}`
    : 'none'
  const [phaseState, setPhaseState] = useState<{
    signature: string
    phase: GuidedPhaseId | null
  }>({ signature: '', phase: null })
  const activePhase =
    phaseState.signature === phaseSignature &&
    phaseState.phase !== null &&
    phaseIds.includes(phaseState.phase)
      ? phaseState.phase
      : (phaseIds[0] ?? null)
  const activePhaseIndex = activePhase ? phaseIds.indexOf(activePhase) : -1
  const progressActivePhaseIndex = activePhase
    ? progressPhaseIds.indexOf(activePhase)
    : -1
  const phases: GuidedPhase[] = progressPhaseIds.map((id, index) => ({
    id,
    label:
      id === 'energy'
        ? '能量'
        : id === 'cost'
          ? '代價'
          : id === 'choice'
            ? '效果'
            : '目標',
    complete: index < progressActivePhaseIndex,
  }))
  const activePhaseReady =
    activePhase === 'energy'
      ? energyPaid
      : activePhase === 'cost'
        ? extraCostReady
        : activePhase === 'choice'
          ? selectedChooseOneMode !== null
          : activePhase === 'target'
            ? targetReady
            : true
  const hasPreviousPhase = activePhaseIndex > 0
  const hasNextPhase =
    activePhaseIndex >= 0 && activePhaseIndex < phaseIds.length - 1
  const hasOptionalSkip =
    pendingEffect !== null &&
    (pendingEffect.sourceKind === 'attack' ||
      (!pendingEffect.skillActivated &&
        (pendingEffect.optional === true ||
          (currentEffect !== null &&
            'optional' in currentEffect &&
            currentEffect.optional === true))))
  const hasSecondaryAction =
    Boolean(showCancelSkill) || hasOptionalSkip || hasPreviousPhase
  const goToPhase = (phase: GuidedPhaseId) => {
    setPhaseState({ signature: phaseSignature, phase })
  }
  const handlePrimaryAction = () => {
    if (activePhase === 'choice') {
      if (selectedChooseOneMode === null) return
      onChooseMode?.(selectedChooseOneMode)
      return
    }
    if (hasNextPhase) {
      goToPhase(phaseIds[activePhaseIndex + 1])
      return
    }
    onConfirm()
  }

  if (optionalCostAttack) {
    return (
      <>
        <div className="effect-panel-body">
          <div className="effect-panel-heading">
            <span>攻擊後續效果</span>
            <strong>{optionalCostAttack.sourceCardName}</strong>
          </div>
          {optionalCostAttack.sourceCard && (
            <div className="effect-source-card">
              <CardFace card={optionalCostAttack.sourceCard} />
              <div className="effect-source-copy">
                <span>{optionalCostAttack.sourceCard.id}</span>
                <strong>{optionalCostAttack.sourceCard.name}</strong>
                <p className="effect-source-description">
                  <CardEffectText text={optionalCostAttack.effectText} />
                </p>
              </div>
            </div>
          )}
          <div className="effect-panel-guided-content">
            <OptionalCostAttackModal
              {...optionalCostAttack}
              embedded
            />
          </div>
        </div>
      </>
    )
  }

  if (pendingEffect && currentEffect) {
    return (
      <>
        <div className="effect-panel-body">
          <div className="effect-panel-heading">
            <span>{pendingEffect.triggerLabel}</span>
            <strong>{pendingEffect.sourceCard.name}</strong>
          </div>
          <div className="effect-source-card">
            <CardFace card={pendingEffect.sourceCard} />
            <div className="effect-source-copy">
              <span>{pendingEffect.sourceCard.id}</span>
              <strong>{pendingEffect.sourceCard.name}</strong>
              <div className="skill-labels">
                {getSkillLabels(pendingEffect.skill).map((label) => (
                  <span key={label}>{label}</span>
                ))}
              </div>
              <p className="effect-source-description">
                <CardEffectText text={pendingEffect.skill.text} />
              </p>
            </div>
          </div>

          <GuidedPhaseSteps phases={phases} activePhase={activePhase} />

          {phaseIds.length === 0 && (
            <div className="effect-instruction effect-resolution-summary">
              <Sparkles aria-hidden="true" />
              <span>
                {effectConditionMet
                  ? describeEffect(currentEffect)
                  : '目前條件不成立，確認後會略過此效果。'}
              </span>
            </div>
          )}

          <div className="effect-panel-guided-content">
            {activePhase === 'energy' && (
              <section className="effect-panel-col effect-panel-payment-col">
                <span className="effect-panel-col-label">能量支付</span>
                <div className="skill-cost">
                  <EnergyCostIcons
                    cost={pendingEffect.skill.cost.energy ?? pendingEffect.skill.cost}
                  />
                </div>
                <small>
                  已選 {pendingEffect.selectedPaymentIds.length}／
                  {totalEnergyCost} 張能量支援卡
                </small>
                {paymentCandidates.length > 0 ? (
                  <CandidateButtons
                    cards={paymentCandidates}
                    selectedIds={selectedPaymentIds}
                    onToggle={onTogglePayment}
                    className="effect-candidates-payment"
                  />
                ) : (
                  <small>沒有可支付的支援卡</small>
                )}
              </section>
            )}

            {activePhase === 'cost' && (
              <section className="effect-panel-col effect-panel-extra-cost-col">
                <span className="effect-panel-col-label">額外代價</span>
                {automaticCostDescriptions.map((description) => (
                  <div className="effect-auto-cost" key={description}>
                    <Check aria-hidden="true" />
                    <span>{description}</span>
                  </div>
                ))}
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
                {hpToTrashCost > 0 && (
                  <small>
                    已選 {pendingEffect.selectedHpToTrashTargetIds.length} 張／
                    {hpToTrashCost} 張 HP 費用
                  </small>
                )}
                {trashBattleCookieCost > 0 && (
                  <small>
                    已選 {pendingEffect.selectedTrashBattleCookieIds.length}／
                    {trashBattleCookieCost} 張戰鬥區餅乾代價
                  </small>
                )}
                {costSupportCandidates.length > 0 && (
                  <>
                    <small>選擇要作為代價移動的支援區卡牌</small>
                    <CandidateButtons
                      cards={costSupportCandidates}
                      selectedIds={selectedCostSupportIds}
                      onToggle={onToggleCostSupport}
                      className="effect-candidates-cost-support"
                    />
                  </>
                )}
                {discardHandCandidates.length > 0 && (
                  <>
                    <small>選擇要作為代價棄置的手牌</small>
                    <CandidateButtons
                      cards={discardHandCandidates}
                      selectedIds={selectedDiscardHandIds}
                      onToggle={onToggleDiscardHand}
                      className="effect-candidates-discard-hand"
                    />
                  </>
                )}
                {hpToTrashCandidates.length > 0 && (
                  <>
                    <small>選擇要支付 HP 費用的餅乾</small>
                    <CandidateButtons
                      cards={hpToTrashCandidates}
                      selectedIds={selectedHpToTrashTargetIds}
                      onToggle={onToggleHpToTrash}
                      className="effect-candidates-hp-cost"
                    />
                  </>
                )}
                {trashBattleCookieCandidates.length > 0 && (
                  <>
                    <small>選擇要作為代價送入棄牌區的戰鬥區餅乾</small>
                    <CandidateButtons
                      cards={trashBattleCookieCandidates}
                      selectedIds={selectedTrashBattleCookieIds}
                      onToggle={onToggleTrashBattleCookie}
                      className="effect-candidates-trash-battle"
                    />
                  </>
                )}
                {trashToDeckBottomCost > 0 && (
                  <small>
                    已選 {(pendingEffect.selectedTrashToDeckBottomIds ?? []).length}／
                    {trashToDeckBottomCost} 張棄牌區代價（依選取順序放到牌庫底）
                  </small>
                )}
                {trashToDeckBottomCandidates.length > 0 && (
                  <>
                    <small>選擇要作為代價放到牌庫底的棄牌區卡牌</small>
                    <CandidateButtons
                      cards={trashToDeckBottomCandidates}
                      selectedIds={selectedTrashToDeckBottomIds}
                      onToggle={onToggleTrashToDeckBottom}
                      className="effect-candidates-trash-deck-bottom"
                    />
                  </>
                )}
                {trashToDeckCost > 0 && (
                  <small>
                    已選 {(pendingEffect.selectedTrashToDeckIds ?? []).length}／
                    {trashToDeckCost} 張符合條件的棄牌區卡牌（洗回牌庫）
                  </small>
                )}
                {trashToDeckCandidates.length > 0 && (
                  <>
                    <small>
                      選擇要作為代價洗回牌庫的紫色、非 FLIP 棄牌區卡牌
                    </small>
                    <CandidateButtons
                      cards={trashToDeckCandidates}
                      selectedIds={selectedTrashToDeckIds}
                      onToggle={onToggleTrashToDeck}
                      className="effect-candidates-trash-deck"
                    />
                  </>
                )}
              </section>
            )}

            {activePhase === 'choice' && chooseOneModes && (
              <section className="effect-panel-col effect-panel-choice-col">
                <span className="effect-panel-col-label">選擇一項效果</span>
                <div className="effect-instruction">
                  <Sparkles aria-hidden="true" />
                  <span>請選擇一項效果，再按下一步繼續。</span>
                </div>
                <div
                  className="effect-candidates-choice"
                  role="group"
                  aria-label="選擇一項效果"
                >
                  {chooseOneModes.map((mode, modeIndex) => {
                    const selected = selectedChooseOneMode === modeIndex
                    return (
                      <button
                        key={`${chooseOneSignature}-${modeIndex}`}
                        type="button"
                        className={selected ? 'is-selected' : ''}
                        aria-pressed={selected}
                        onClick={() =>
                          setChooseOneSelection({
                            signature: chooseOneSignature,
                            modeIndex,
                          })
                        }
                      >
                        <span className="effect-choice-option-number">
                          {modeIndex + 1}
                        </span>
                        <span className="effect-choice-option-label">
                          {mode.label}
                        </span>
                        {selected ? (
                          <Check aria-hidden="true" />
                        ) : (
                          <ArrowRight aria-hidden="true" />
                        )}
                      </button>
                    )
                  })}
                </div>
              </section>
            )}

            {activePhase === 'target' && (
              <section className="effect-panel-col effect-panel-target-col">
                <span className="effect-panel-col-label">目標</span>
                <div className="effect-instruction">
                  <Sparkles aria-hidden="true" />
                  <span>{describeEffect(currentEffect)}</span>
                </div>
                <CandidateButtons
                  cards={candidateCards}
                  selectedIds={new Set(pendingEffect.selectedTargetIds)}
                  onToggle={onToggleCandidate}
                  className="effect-candidates-target"
                />
                {currentEffect.kind === 'hand-to-break-by-level-sum' ||
                currentEffect.kind === 'break-to-hand-by-level-sum' ? (
                  <small>
                    已選等級總和 {selectedLevelSum}／{currentEffect.targetSum}
                  </small>
                ) : (
                  selectionLimits && (
                    <small>
                      已選 {pendingEffect.selectedTargetIds.length}／
                      {selectionLimits.max}
                    </small>
                  )
                )}
              </section>
            )}
          </div>
        </div>

        <div
          className={`effect-panel-sticky-actions${
            hasSecondaryAction ? '' : ' is-confirm-only'
          }`}
        >
          {showCancelSkill && (
            <button
              className="skip-effect"
              type="button"
              onClick={onCancel}
            >
              取消技能
            </button>
          )}
          {hasOptionalSkip ? (
            <button
              className="skip-effect"
              type="button"
              onClick={onSkip}
            >
              <span className="effect-skip-label">
                {pendingEffect.sourceKind === 'attack' ? '略過' : '不發動'}
              </span>
              不發動
            </button>
          ) : null}
          {hasPreviousPhase && (
            <button
              className="effect-panel-back-action"
              type="button"
              onClick={() => goToPhase(phaseIds[activePhaseIndex - 1])}
            >
              <ChevronLeft aria-hidden="true" />
              上一步
            </button>
          )}
          <button
            className="effect-panel-primary-action"
            type="button"
            disabled={!activePhaseReady}
            onClick={handlePrimaryAction}
          >
            {hasNextPhase || activePhase === 'choice' ? (
              <>
                下一步
                <ArrowRight aria-hidden="true" />
              </>
            ) : (
              <>
                <Check aria-hidden="true" />
                確認發動
              </>
            )}
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
  const hasPendingPrompt = Boolean(props.pendingEffect || props.optionalCostAttack)
  const minimizedSourceName =
    props.pendingEffect?.sourceCard.name ??
    props.optionalCostAttack?.sourceCardName
  const minimizedPromptLabel =
    props.pendingEffect?.triggerLabel ?? '攻擊後續效果'

  if (
    !props.pendingEffect &&
    props.effectHistory.length === 0 &&
    !props.optionalCostAttack
  ) {
    return null
  }

  if (
    minimized &&
    (props.pendingEffect || props.optionalCostAttack) &&
    minimizedSourceName
  ) {
    return (
      <button
        type="button"
        className="effect-panel-dock"
        onClick={() => setMinimized(false)}
      >
        <span>
          <strong>{minimizedSourceName}</strong>
          <small>{minimizedPromptLabel}</small>
        </span>
        <Maximize2 aria-hidden="true" />
      </button>
    )
  }

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      style={hasPendingPrompt ? undefined : { pointerEvents: 'none' }}
    >
      <section
        className={`battle-response-modal effect-panel${hasPendingPrompt ? '' : ' is-complete'}`}
        role={hasPendingPrompt ? 'alertdialog' : 'status'}
        aria-live="polite"
      >
        {(props.pendingEffect || props.optionalCostAttack) && (
          <button
            type="button"
            className="minimize-reveal"
            onClick={() => setMinimized(true)}
            title={
              props.pendingEffect ? '縮小技能效果' : '縮小攻擊後續效果'
            }
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
