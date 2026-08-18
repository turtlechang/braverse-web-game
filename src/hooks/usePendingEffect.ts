import { useCallback, useEffect, useState } from 'react'
import type {
  CardAbility,
  EnergyCost,
  EffectTargetSelector,
  GameCard,
  GameState,
  PlayerId,
  SkillTrigger,
} from '../game'
import {
  applyGameCommand,
  canActivateCookieSkill,
  getEnergyCostTotal,
  getBreakToBattleCandidates,
  getSupportToBattleCandidates,
  getBreakToHandBySumCandidates,
  getHandToBreakBySumCandidates,
  getBreakToTrashCandidates,
  getEffectSelectionCandidates,
  getEffectTargetCandidates,
  getEffectTargetCandidatesForEffect,
  getNestedSequentialDamageSelectionEffect,
  getFieldToDeckBottomBlocker,
  getEffectiveCardAbilityCost,
  getDiscardAllHandCostCandidates,
  getDiscardHandCostCandidates,
  getPendingDecision,
  hasRequiredEffectTargets,
  getSupportEffectCandidates,
  getTrashBattleCookieCostCandidates,
  getBattleCookieToHandCostCandidates,
  getHpToTrashCostCandidates,
  getTrashToDeckCostCandidates,
  getTrashToDeckBottomCostCandidates,
  getTrashCookieCandidates,
  getTrashToDeckCandidates,
  getTrashToHandCandidates,
  getTrashToSupportCandidates,
  isSkillEffectConditionDeferredUntilCost,
  isEnergyColorCompatibleWithCost,
  isEffectConditionMet,
  isEffectUntargeted,
  validateEnergyPayment,
} from '../game'
import { expandChooseOne } from '../game'
import { compileEffectDecisionDescriptor } from '../game/decision-descriptor-compiler'
import { describeEffectResult } from '../components/effects/effectUiUtils'
import type { PendingEffect } from '../components/effects/effectUiTypes'
import type { DispatchGameCommand } from './useBattleActions'

interface HpPileInfo {
  title: string
  cards: GameCard[]
}

const findCardInPlayerZones = (
  player: GameState['players'][PlayerId],
  instanceId: string,
): GameCard | undefined => {
  const cards: GameCard[] = [
    ...player.battleArea.map((cookie) => cookie.card),
    ...player.hand,
    ...player.breakArea,
    ...player.discardPile,
    ...player.supportArea.map((support) => support.card),
    ...(player.stage ? [player.stage.card] : []),
    ...player.deck,
  ]
  return cards.find((card) => card.instanceId === instanceId)
}

export function usePendingEffect(params: {
  game: GameState
  setGame: (value: GameState | ((prev: GameState) => GameState)) => void
  dispatch: DispatchGameCommand
  viewerPlayerId: PlayerId
  setMessage: (value: string) => void
  clearAttacker: () => void
  setInspectedHpPile: (info: HpPileInfo) => void
  hasFaint: boolean
  faintTargetIds: Set<string>
  selectedFaintTargetIds: string[]
  faintMinMax: { min: number; max: number }
  setSelectedFaintTargetIds: React.Dispatch<React.SetStateAction<string[]>>
  hasAfterDamage: boolean
  afterDamageTargetIds: Set<string>
  selectedAfterDamageTargetIds: string[]
  afterDamageMinMax: { min: number; max: number }
  setSelectedAfterDamageTargetIds: React.Dispatch<React.SetStateAction<string[]>>
}) {
  const {
    game,
    setGame,
    dispatch,
    viewerPlayerId,
    setMessage,
    clearAttacker,
    setInspectedHpPile,
    hasFaint,
    faintTargetIds,
    selectedFaintTargetIds,
    faintMinMax,
    setSelectedFaintTargetIds,
    hasAfterDamage,
    afterDamageTargetIds,
    selectedAfterDamageTargetIds,
    afterDamageMinMax,
    setSelectedAfterDamageTargetIds,
  } = params

  const [pendingEffect, setPendingEffect] =
    useState<PendingEffect | null>(null)
  const [suspendedEffect, setSuspendedEffect] =
    useState<PendingEffect | null>(null)
  const [effectHistory, setEffectHistory] = useState<string[]>([])

  const faintActive =
    hasFaint &&
    !pendingEffect &&
    !game.pendingRefresh &&
    !game.pendingOnPlay
  const afterDamageActive = hasAfterDamage && !pendingEffect

  const currentEffect =
    pendingEffect?.effects[pendingEffect.effectIndex] ?? null
  const currentEffectConditionMet =
    pendingEffect && currentEffect
      ? isEffectConditionMet(game, pendingEffect.context, currentEffect)
      : true
  // Keep the composite setup effect as the command payload. For a nested
  // sequential all-target damage, the panel must instead expose its targets
  // now, so the chosen order travels with that outer command.
  const selectionEffect =
    getNestedSequentialDamageSelectionEffect(currentEffect) ?? currentEffect
  const currentTargetSelector: EffectTargetSelector | null =
    selectionEffect?.kind === 'opponent-break-to-trash-then-battle-to-break'
      ? {
          side: 'opponent',
          min: game.pendingAbilityEffect?.pendingOpponentBreakToTrashThenBattleToBreak
            ? 0
            : 1,
          max: 1,
        }
      : selectionEffect?.kind === 'damage-all' && selectionEffect.sequential
      ? selectionEffect.target ?? null
      : selectionEffect?.kind === 'gain-hp'
      ? selectionEffect.target?.sourceOnly
        ? null
        : selectionEffect.target ?? null
      : selectionEffect && !isEffectUntargeted(selectionEffect)
        ? selectionEffect.kind === 'opponent-battle-to-trash'
          ? {
              side: 'opponent',
              min: 1,
              max: 1,
              ...(selectionEffect.maxLevel !== undefined
                ? { maxLevel: selectionEffect.maxLevel }
                : {}),
              ...(selectionEffect.minLevel !== undefined
                ? { minLevel: selectionEffect.minLevel }
                : {}),
              ...(selectionEffect.remainingHp !== undefined
                ? { remainingHp: selectionEffect.remainingHp }
                : {}),
            }
          : selectionEffect.kind === 'break-to-trash' ||
          selectionEffect.kind === 'trash-to-break' ||
          selectionEffect.kind === 'support-to-trash' ||
          selectionEffect.kind === 'support-to-hand' ||
          selectionEffect.kind === 'hand-to-support' ||
          selectionEffect.kind === 'trash-to-battle' ||
          selectionEffect.kind === 'trash-to-support' ||
          selectionEffect.kind === 'trash-to-hand' ||
          selectionEffect.kind === 'trash-to-deck' ||
          selectionEffect.kind === 'flip-to-support' ||
          selectionEffect.kind === 'hand-to-battle' ||
          selectionEffect.kind === 'opponent-trash-to-break' ||
          selectionEffect.kind === 'rest-support' ||
          selectionEffect.kind === 'hand-to-hp' ||
          selectionEffect.kind === 'support-to-hp' ||
          selectionEffect.kind === 'cycle-hp' ||
          selectionEffect.kind === 'rest-support-and-damage' ||
          selectionEffect.kind === 'field-to-deck-bottom' ||
          selectionEffect.kind === 'inspect-deck' ||
          selectionEffect.kind === 'optional-cost-attack' ||
          selectionEffect.kind === 'disable-block'
          ? null
          : ('target' in selectionEffect ? selectionEffect.target ?? null : null)
        : null

  // P3 bridge: use the same shadow descriptor that pending modals, online
  // effects, and AI consume. The existing arrays below remain the UI fallback
  // for a descriptor that is not ready; a ready descriptor can only narrow
  // candidates, never broaden them or bypass applyGameCommand validation.
  const effectDecisionDescriptor =
    pendingEffect && selectionEffect
      ? compileEffectDecisionDescriptor({
          state: game,
          playerId: pendingEffect.context.sourcePlayerId,
          sourcePlayerId: pendingEffect.context.sourcePlayerId,
          sourceInstanceId: pendingEffect.context.sourceInstanceId,
          sourceCardName: pendingEffect.sourceCard.name,
          context: pendingEffect.context,
          effect: selectionEffect,
          cost: pendingEffect.skillActivated
            ? undefined
            : pendingEffect.skill.cost,
          commandKind:
            pendingEffect.sourceKind === 'attack'
              ? 'resolve-attack-effect'
              : 'resolve-ability-effect',
          viewerPlayerId,
        })
      : null
  const descriptorTargetStep = effectDecisionDescriptor?.steps.find(
    (step) => step.kind === 'target',
  )
  const stagedCostSelectionPending = Boolean(
    pendingEffect &&
      !pendingEffect.skillActivated &&
      pendingEffect.selectedHpToTrashTargetIds.length > 0 &&
      currentTargetSelector?.costSelected,
  )
  const useDescriptorCandidates =
    effectDecisionDescriptor?.status === 'ready' &&
    Boolean(descriptorTargetStep) &&
    !stagedCostSelectionPending
  const isDescriptorCandidate = (instanceId: string): boolean =>
    !useDescriptorCandidates || descriptorTargetStep!.candidateIds.includes(instanceId)

  const stagedCostSelectedTargetId =
    pendingEffect &&
    currentTargetSelector?.costSelected &&
    !pendingEffect.skillActivated
      ? pendingEffect.selectedHpToTrashTargetIds[0]
      : undefined
  const rawEffectTargetCandidates =
    pendingEffect &&
    selectionEffect &&
    currentTargetSelector
      ? selectionEffect.kind === 'opponent-break-to-trash-then-battle-to-break'
        ? []
        : (selectionEffect.kind === 'field-to-trash' && selectionEffect.stageOnly)
        ? []
        : selectionEffect.kind === 'equip-source'
          ? getEffectTargetCandidatesForEffect(
              game,
              pendingEffect.context,
              selectionEffect,
            )
          : (() => {
              // A stage/item/cookie ability keeps all costs in local pending
              // UI state until the final confirmation. `costSelected` effects
              // therefore cannot rely on GameState.costRecord yet; bridge the
              // selected HP-cost Cookie into the regular target candidates.
              const selector = stagedCostSelectedTargetId
                ? { ...currentTargetSelector, costSelected: false }
                : currentTargetSelector
              const candidates = stagedCostSelectedTargetId
                ? getEffectTargetCandidates(
                    game,
                    pendingEffect.context,
                    selector,
                  )
                : getEffectTargetCandidatesForEffect(
                  game,
                  pendingEffect.context,
                  selectionEffect,
                  )
              return stagedCostSelectedTargetId
                ? candidates.filter(
                    (cookie) =>
                      cookie.card.instanceId === stagedCostSelectedTargetId,
                  )
                : candidates
            })()
      : []
  const effectTargetCandidates = rawEffectTargetCandidates.filter((cookie) =>
    isDescriptorCandidate(cookie.card.instanceId),
  )

  const supportEffectCandidates =
    pendingEffect &&
    currentEffect &&
    (currentEffect.kind === 'support-to-trash' ||
      currentEffect.kind === 'support-to-hand')
      ? getSupportEffectCandidates(game, pendingEffect.context).filter(
          (support) =>
            currentEffect.kind !== 'support-to-hand' ||
            ((currentEffect.cardType === undefined ||
              support.card.type === currentEffect.cardType) &&
              (currentEffect.energyColor === undefined ||
                support.card.energyColor === currentEffect.energyColor) &&
              (currentEffect.maxLevel === undefined ||
                (support.card.type === 'cookie' &&
                  support.card.level <= currentEffect.maxLevel))),
        )
        .filter((support) => isDescriptorCandidate(support.card.instanceId))
      : []

  const trashCookieCandidates =
    pendingEffect &&
    (currentEffect?.kind === 'trash-to-battle' ||
      currentEffect?.kind === 'trash-to-support')
      ? currentEffect.kind === 'trash-to-battle'
        ? getTrashCookieCandidates(game, pendingEffect.context, currentEffect).filter(
            (card) => isDescriptorCandidate(card.instanceId),
          )
        : getTrashToSupportCandidates(game, pendingEffect.context, currentEffect).filter(
            (card) => isDescriptorCandidate(card.instanceId),
          )
      : []

  const fieldToTrashStageCandidate =
    pendingEffect &&
    currentEffect &&
    currentEffect.kind === 'field-to-trash' &&
    (currentEffect.allowStage || currentEffect.stageOnly)
      ? (() => {
          const targetPlayerId =
            currentEffect.target.side === 'self'
              ? pendingEffect.context.sourcePlayerId
              : pendingEffect.context.sourcePlayerId === 'player-one'
                ? 'player-two'
                : 'player-one'
          const targetPlayer = game.players[targetPlayerId]
          return targetPlayer.stage
            ? isDescriptorCandidate(targetPlayer.stage.card.instanceId)
              ? [targetPlayer.stage.card]
              : []
            : []
        })()
      : []

  const genericEffectCandidateCards =
    pendingEffect &&
    currentEffect &&
    (currentEffect.kind === 'hand-to-break' ||
      currentEffect.kind === 'break-to-hand' ||
      currentEffect.kind === 'hand-to-support' ||
      currentEffect.kind === 'hand-to-hp' ||
      currentEffect.kind === 'rest-support' ||
      currentEffect.kind === 'support-to-hp' ||
      currentEffect.kind === 'cycle-hp' ||
      currentEffect.kind === 'field-to-deck-bottom' ||
      currentEffect.kind === 'hand-to-battle' ||
      currentEffect.kind === 'opponent-trash-to-break' ||
      currentEffect.kind === 'opponent-break-to-trash-then-battle-to-break' ||
      (currentEffect.kind === 'set-active' && currentEffect.selectable))
          ? getEffectSelectionCandidates(
              game,
              pendingEffect.context,
              currentEffect,
        ).filter((card) => isDescriptorCandidate(card.instanceId))
      : []
  const nonBattleEffectCandidateCards = [
    ...supportEffectCandidates.map((support) => support.card),
    ...trashCookieCandidates,
    ...fieldToTrashStageCandidate,
    ...genericEffectCandidateCards,
  ]

  const breakToTrashCandidates =
    pendingEffect && currentEffect?.kind === 'break-to-trash'
      ? getBreakToTrashCandidates(
          game,
          pendingEffect.context,
          currentEffect,
        ).filter((card) => isDescriptorCandidate(card.instanceId))
      : []

  const breakToBattleCandidates =
    pendingEffect && currentEffect?.kind === 'break-to-battle'
      ? getBreakToBattleCandidates(game, pendingEffect.context, currentEffect)
          .filter((card) => isDescriptorCandidate(card.instanceId))
      : []

  const supportToBattleCandidates =
    pendingEffect && currentEffect?.kind === 'support-to-battle'
      ? getSupportToBattleCandidates(game, pendingEffect.context, currentEffect)
          .filter((card) => isDescriptorCandidate(card.instanceId))
      : []

  const breakToHandBySumCandidates =
    pendingEffect && currentEffect?.kind === 'break-to-hand-by-level-sum'
      ? getBreakToHandBySumCandidates(game, pendingEffect.context, currentEffect)
          .filter((card) => isDescriptorCandidate(card.instanceId))
      : []

  const handToBreakBySumCandidates =
    pendingEffect && currentEffect?.kind === 'hand-to-break-by-level-sum'
      ? getHandToBreakBySumCandidates(game, pendingEffect.context, currentEffect)
          .filter((card) => isDescriptorCandidate(card.instanceId))
      : []

  const trashToHandCandidates =
    pendingEffect && currentEffect?.kind === 'trash-to-hand'
      ? getTrashToHandCandidates(game, pendingEffect.context, currentEffect)
          .filter((card) => isDescriptorCandidate(card.instanceId))
      : []

  const trashToDeckCandidates =
    pendingEffect && currentEffect?.kind === 'trash-to-deck'
      ? getTrashToDeckCandidates(game, pendingEffect.context, currentEffect)
          .filter((card) => isDescriptorCandidate(card.instanceId))
      : []

  const restSupportAndDamageSupportCandidates =
    pendingEffect && currentEffect?.kind === 'rest-support-and-damage'
      ? getSupportEffectCandidates(game, pendingEffect.context, {
          side: currentEffect.supportSide,
          activeOnly: currentEffect.activeOnly,
        })
          .filter(
            (support) =>
              isDescriptorCandidate(support.card.instanceId) &&
              (currentEffect.supportEnergyColor === undefined ||
                support.card.energyColor ===
                  currentEffect.supportEnergyColor) &&
              !pendingEffect.selectedPaymentIds.includes(
                support.card.instanceId,
              ),
          )
          .map((support) => support.card)
      : []

  const restSupportAndDamageTargetCandidates =
    pendingEffect && currentEffect?.kind === 'rest-support-and-damage'
      ? getEffectTargetCandidates(
          game,
          pendingEffect.context,
          currentEffect.target,
        )
          .filter((cookie) => isDescriptorCandidate(cookie.card.instanceId))
          .map((cookie) => cookie.card)
      : []

  const effectTargetIds = faintActive
    ? faintTargetIds
    : afterDamageActive
      ? afterDamageTargetIds
      : new Set([
          ...effectTargetCandidates.map((cookie) => cookie.card.instanceId),
          ...fieldToTrashStageCandidate.map((c) => c.instanceId),
          ...genericEffectCandidateCards.map((card) => card.instanceId),
          ...restSupportAndDamageSupportCandidates.map(
            (card) => card.instanceId,
          ),
          ...restSupportAndDamageTargetCandidates.map(
            (card) => card.instanceId,
          ),
          ...handToBreakBySumCandidates.map((card) => card.instanceId),
        ])

  const breakEffectTargetIds = faintActive
    ? new Set<string>()
    : new Set([
        ...breakToTrashCandidates.map((card) => card.instanceId),
        ...breakToBattleCandidates.map((card) => card.instanceId),
        ...breakToHandBySumCandidates.map((card) => card.instanceId),
      ])

  const supportEffectTargetIds = faintActive
    ? new Set<string>()
    : new Set([
        ...supportEffectCandidates.map((support) => support.card.instanceId),
        ...supportToBattleCandidates.map((card) => card.instanceId),
      ])

  const trashEffectTargetIds = faintActive
    ? new Set<string>()
    : new Set([
        ...trashCookieCandidates.map((card) => card.instanceId),
        ...trashToHandCandidates.map((card) => card.instanceId),
        ...trashToDeckCandidates.map((card) => card.instanceId),
      ])

  const selectedEffectTargetIds: Set<string> = faintActive
    ? new Set(selectedFaintTargetIds)
    : afterDamageActive
      ? new Set(selectedAfterDamageTargetIds)
      : new Set(pendingEffect?.selectedTargetIds ?? [])

  const selectedSkillPaymentIds = new Set(
    pendingEffect?.selectedPaymentIds ?? [],
  )

  const pendingSupportArea = pendingEffect
    ? game.players[pendingEffect.context.sourcePlayerId].supportArea
    : []
  const skillEnergyCostTotal = pendingEffect
    ? getEnergyCostTotal(
        pendingEffect.skill.cost.energy ?? pendingEffect.skill.cost,
      )
    : 0
  const skillEnergyCost = pendingEffect
    ? (pendingEffect.skill.cost.energy ?? pendingEffect.skill.cost)
    : ({} as EnergyCost)
  const skillEnergyPaymentValid = pendingEffect
    ? validateEnergyPayment(
        pendingEffect.skill.cost.energy ?? pendingEffect.skill.cost,
        pendingSupportArea,
        pendingEffect.selectedPaymentIds,
      ).valid
    : false
  const skillPaymentLabel =
    pendingEffect?.sourceKind === 'item'
      ? '物品' as const
      : pendingEffect?.sourceKind === 'stage'
        ? '場景' as const
        : '技能' as const
  const isSkillEnergyColorCompatible = (
    cardColor: GameCard['energyColor'],
  ): boolean => isEnergyColorCompatibleWithCost(skillEnergyCost, cardColor)
  const skillPaymentTargetIds = new Set(
    pendingEffect && !pendingEffect.skillActivated && skillEnergyCostTotal > 0
      ? pendingSupportArea
          .filter(
            (support) =>
              !support.rested &&
              !pendingEffect.selectedCostSupportToTrashIds.includes(
                support.card.instanceId,
              ) &&
              !pendingEffect.selectedTargetIds.includes(
                support.card.instanceId,
              ) &&
              (pendingEffect.selectedPaymentIds.includes(
                support.card.instanceId,
              ) ||
                isSkillEnergyColorCompatible(support.card.energyColor)) &&
              (pendingEffect.selectedPaymentIds.length <
                skillEnergyCostTotal ||
                pendingEffect.selectedPaymentIds.includes(
                  support.card.instanceId,
                )),
          )
          .map((support) => support.card.instanceId)
      : [],
  )

  const supportToTrashCost =
    pendingEffect?.skill.cost.supportToTrash ?? 0
  const supportToHandCost =
    pendingEffect?.skill.cost.supportToHand ?? 0
  const supportAreaCost = supportToTrashCost + supportToHandCost
  const skillCostSupportCandidates =
    pendingEffect &&
    supportAreaCost > 0 &&
    skillEnergyPaymentValid
      ? getSupportEffectCandidates(game, pendingEffect.context).filter(
          (support) =>
            !pendingEffect.selectedPaymentIds.includes(
              support.card.instanceId,
            ) &&
            (pendingEffect.skill.cost.supportToHandType === undefined ||
              support.card.type === pendingEffect.skill.cost.supportToHandType) &&
            (pendingEffect.selectedCostSupportToTrashIds.length <
              supportAreaCost ||
              pendingEffect.selectedCostSupportToTrashIds.includes(
                support.card.instanceId,
              )),
        )
      : []

  const skillCostSupportTargetIds = new Set(
    skillCostSupportCandidates.map(
      (support) => support.card.instanceId,
    ),
  )

  const selectedSkillCostSupportToTrashIds = new Set(
    pendingEffect?.selectedCostSupportToTrashIds ?? [],
  )

  const discardAllHand = Boolean(pendingEffect?.skill.cost.discardAllHand)
  const discardHandAtLeast = Boolean(
    pendingEffect?.skill.cost.discardHandAtLeast,
  )
  const discardHandCandidates = pendingEffect
    ? discardAllHand
      ? getDiscardAllHandCostCandidates(
          pendingEffect.skill.cost,
          game.players[pendingEffect.context.sourcePlayerId].hand,
          pendingEffect.context.sourceInstanceId,
        )
      : getDiscardHandCostCandidates(
          pendingEffect.skill.cost,
          game.players[pendingEffect.context.sourcePlayerId].hand,
          pendingEffect.context.sourceInstanceId,
        )
    : []
  const discardHandCost = discardAllHand
    ? discardHandCandidates.length
    : pendingEffect?.skill.cost.discardHand ?? 0
  const discardHandSelectionLimit =
    discardAllHand || discardHandAtLeast
      ? discardHandCandidates.length
      : discardHandCost
  const skillCostDiscardHandCandidates =
    pendingEffect &&
    (discardAllHand || discardHandCost > 0) &&
    !pendingEffect.skillActivated
      ? discardHandCandidates.filter(
          (card) =>
            pendingEffect.selectedDiscardHandIds.length <
              discardHandSelectionLimit ||
            pendingEffect.selectedDiscardHandIds.includes(card.instanceId),
        )
      : []

  const skillDiscardHandTargetIds = new Set(
    skillCostDiscardHandCandidates.map((card) => card.instanceId),
  )
  const selectedSkillDiscardHandIds = new Set(
    pendingEffect?.selectedDiscardHandIds ?? [],
  )

  const selectedSkillHpToTrashTargetIds = new Set(
    pendingEffect?.selectedHpToTrashTargetIds ?? [],
  )
  const skillHpToTrashCandidates =
    pendingEffect &&
    !pendingEffect.skillActivated &&
    pendingEffect.skill.cost.hpToTrash
      ? getHpToTrashCostCandidates(
          pendingEffect.skill.cost,
          game.players[pendingEffect.context.sourcePlayerId].battleArea,
          pendingEffect.context.sourceInstanceId,
        ).map((cookie) => cookie.card)
      : []
  const skillHpToTrashTargetIds = new Set(
    skillHpToTrashCandidates.map((card) => card.instanceId),
  )
  const hpToTrashCost = pendingEffect?.skill.cost.hpToTrash ? 1 : 0

  const selectedSkillTrashBattleCookieIds = new Set(
    pendingEffect?.selectedTrashBattleCookieIds ?? [],
  )
  const skillTrashBattleCookieCandidates =
    pendingEffect &&
    !pendingEffect.skillActivated &&
    pendingEffect.skill.cost.trashBattleCookie
      ? getTrashBattleCookieCostCandidates(
          pendingEffect.skill.cost,
          game.players[pendingEffect.context.sourcePlayerId].battleArea,
          pendingEffect.context.sourceInstanceId,
        ).map((cookie) => cookie.card)
      : []
  const skillTrashBattleCookieTargetIds = new Set(
    skillTrashBattleCookieCandidates.map((card) => card.instanceId),
  )

  const selectedSkillBattleToHandIds = new Set(
    pendingEffect?.selectedBattleToHandIds ?? [],
  )
  const skillBattleToHandCandidates =
    pendingEffect &&
    !pendingEffect.skillActivated &&
    pendingEffect.skill.cost.battleCookieToHand
      ? getBattleCookieToHandCostCandidates(
          pendingEffect.skill.cost,
          game.players[pendingEffect.context.sourcePlayerId].battleArea,
          pendingEffect.context.sourceInstanceId,
        ).map((cookie) => cookie.card)
      : []
  const skillBattleToHandTargetIds = new Set(
    skillBattleToHandCandidates.map((card) => card.instanceId),
  )
  const battleToHandCost =
    pendingEffect?.skill.cost.battleCookieToHand?.count ?? 0

  const selectedSkillTrashToDeckBottomIds = new Set(
    pendingEffect?.selectedTrashToDeckBottomIds ?? [],
  )
  const skillTrashToDeckBottomCandidates =
    pendingEffect &&
    !pendingEffect.skillActivated &&
    pendingEffect.skill.cost.trashToDeckBottom
      ? getTrashToDeckBottomCostCandidates(
          pendingEffect.skill.cost,
          game.players[pendingEffect.context.sourcePlayerId].discardPile,
        )
      : []
  const skillTrashToDeckBottomTargetIds = new Set(
    skillTrashToDeckBottomCandidates.map((card) => card.instanceId),
  )
  const trashToDeckBottomCost =
    pendingEffect?.skill.cost.trashToDeckBottom?.count ?? 0
  const selectedSkillTrashToDeckIds = new Set(
    pendingEffect?.selectedTrashToDeckIds ?? [],
  )
  const skillTrashToDeckCandidates =
    pendingEffect &&
    !pendingEffect.skillActivated &&
    pendingEffect.skill.cost.trashToDeck
      ? getTrashToDeckCostCandidates(
          pendingEffect.skill.cost,
          game.players[pendingEffect.context.sourcePlayerId].discardPile,
        )
      : []
  const skillTrashToDeckTargetIds = new Set(
    skillTrashToDeckCandidates.map((card) => card.instanceId),
  )
  const trashToDeckCost = pendingEffect?.skill.cost.trashToDeck?.count ?? 0

  useEffect(() => {
    if (pendingEffect || effectHistory.length === 0) return

    const timer = window.setTimeout(() => setEffectHistory([]), 1000)
    return () => window.clearTimeout(timer)
  }, [effectHistory, pendingEffect])

  /**
   * 規則層直接設定 `pendingAbilityEffect` 時（陷阱延遲效果、reveal-top-deck 巢狀
   * 目標選擇），UI 必須從規則層補建本機的 pendingEffect，否則玩家看不到選擇畫面。
   * 技能／物品的一般啟動由本機 UI 先建 pendingEffect，這裡不會觸發。
   *
   * 這裡的前置條件必須與 `commands.ts` 的 `resolvePendingAbilityEffect` 一致。
   * 特別是**不能**擋 `pendingBattle`：BS3-076 這類「攻擊後可選代價 →
   * reveal-top-deck → 巢狀 damage(attackTargetOnly)」的效果，規則層會刻意保留
   * `pendingBattle` 讓 `attackTargetOnly` 找得到攻擊目標，戰鬥要等巢狀效果結算
   * 完才由 `resolvePendingAbilityEffect` 收尾。擋掉的話這個 pendingEffect 永遠
   * 建不起來，玩家看不到追加傷害的目標選擇畫面，整局就卡死在攻擊後階段。
   */
  useEffect(() => {
    const pendingAbility = game.pendingAbilityEffect
    if (
      !pendingAbility ||
      pendingAbility.playerId !== viewerPlayerId ||
      pendingEffect ||
      suspendedEffect ||
      game.status !== 'playing' ||
      game.pendingRefresh ||
      game.pendingOnPlay ||
      // 效果傷害正在由 battle/FLIP state machine 逐點結算，
      // 先隱藏效果選擇面板，待序列完成後再依 effectIndex 恢復。
      game.pendingBattle?.effectDamageSequence ||
      // 攻擊者擊倒觸發的佇列（例如 BS4-011）必須等本次戰鬥收尾後結算；
      // 完整效果鏈完成後規則層才會建立對手補位。若仍在 pendingBattle，
      // 這裡先不顯示效果面板，避免玩家點下去被規則層拒絕。
      (pendingAbility.trigger === 'attacker-faint' && game.pendingBattle) ||
      // 兩階段選擇第二階段等待放回手牌，面板交給
      // PendingDecisionModals 的 place-hand-hp 提示，不重開第一階段選目標。
      Boolean(pendingAbility.pendingPlace) ||
      // BS6-034：目標確認後由 PendingDecisionModals 顯示完整 HP 重排面板，
      // 不能再次開啟第一段的 EffectPanel。
      Boolean(pendingAbility.pendingReorderHp)
    ) {
      return
    }

    const playerId = pendingAbility.playerId
    const player = game.players[playerId]
    const sourceCard =
      player.discardPile.find(
        (card) => card.instanceId === pendingAbility.sourceInstanceId,
      ) ??
      player.supportArea.find(
        (support) => support.card.instanceId === pendingAbility.sourceInstanceId,
      )?.card ??
      player.hand.find(
        (card) => card.instanceId === pendingAbility.sourceInstanceId,
      ) ??
      player.battleArea.find(
        (cookie) => cookie.card.instanceId === pendingAbility.sourceInstanceId,
      )?.card ??
      (player.stage?.card.instanceId === pendingAbility.sourceInstanceId
        ? player.stage.card
        : null) ?? {
        id: 'unknown',
        instanceId: pendingAbility.sourceInstanceId,
        name: pendingAbility.sourceCardName ?? '效果',
        type: 'item' as const,
      }

    const isEndPhaseEffect = pendingAbility.trigger === 'passive'
    const pendingTrigger: SkillTrigger = isEndPhaseEffect
      ? 'passive'
      : 'activate'
    const triggerLabel = isEndPhaseEffect
      ? '回合結束效果'
      : pendingAbility.sourceKind === 'trap'
        ? '陷阱效果'
        : pendingAbility.sourceKind === 'stage'
          ? '場景效果'
          : pendingAbility.sourceKind === 'skill'
            ? '技能效果'
            : '物品效果'

    const timer = window.setTimeout(() => {
      setPendingEffect({
        sourceCard,
        context: {
          sourcePlayerId: pendingAbility.sourcePlayerId,
          sourceInstanceId: pendingAbility.sourceInstanceId,
          sourceCardName: pendingAbility.sourceCardName,
        },
        skill: {
          trigger: pendingTrigger,
          oncePerTurn: false,
          yourTurn: false,
          restSource: false,
          cost: {},
          text: '',
          effects: pendingAbility.effects,
        },
        trigger: pendingTrigger,
        effects: pendingAbility.effects,
        effectIndex: pendingAbility.effectIndex,
        selectedTargetIds: [],
        selectedPaymentIds: [],
        selectedCostSupportToTrashIds: [],
        selectedDiscardHandIds: [],
        selectedHpToTrashTargetIds: [],
        selectedTrashBattleCookieIds: [],
        selectedBattleToHandIds: [],
        // 代價在 playTrap 就付清了，這裡只剩效果結算。
        skillActivated: true,
        optional: false,
        triggerLabel,
        sourceKind: pendingAbility.sourceKind === 'trap' ? 'item'
          : pendingAbility.sourceKind === 'skill' ? 'cookie'
          : pendingAbility.sourceKind,
        endPhase: isEndPhaseEffect,
      })
    }, 0)
    return () => window.clearTimeout(timer)
  }, [
    game,
    pendingEffect,
    suspendedEffect,
    viewerPlayerId,
  ])

  useEffect(() => {
    if (
      !suspendedEffect ||
      pendingEffect ||
      game.status !== 'playing'
    ) {
      return
    }

    const hasBlockingDecision = Boolean(
      game.pendingRefresh ||
        game.pendingOnPlay ||
        getPendingDecision(game),
    )
    if (hasBlockingDecision) return

    const timer = window.setTimeout(() => {
      setPendingEffect(suspendedEffect)
      setSuspendedEffect(null)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [
    suspendedEffect,
    pendingEffect,
    game,
    viewerPlayerId,
  ])

  const beginCookieSkill = useCallback(
    (
      nextGame: GameState,
      card: GameCard | undefined,
      playerId: PlayerId,
      trigger: SkillTrigger,
      triggerLabel: string,
      optional = false,
    ) => {
    if (
      !card?.skill ||
      card.skill.trigger !== trigger ||
      nextGame.status !== 'playing'
    ) {
      return
    }

    const context = {
      sourcePlayerId: playerId,
      sourceInstanceId: card.instanceId,
    }
    const availableEffects = card.skill.effects.filter((effect) =>
      isEffectConditionMet(nextGame, context, effect) ||
      isSkillEffectConditionDeferredUntilCost(card.skill!, effect),
    )

    if (availableEffects.length === 0) {
      if (trigger === 'on-play' && nextGame.pendingOnPlay) {
        setGame(
          applyGameCommand(nextGame, {
            kind: 'skip-on-play',
            playerId,
            sourceInstanceId: card.instanceId,
          }),
        )
      }
      setMessage(`${card.name}的效果尚未滿足發動條件。`)
      return
    }

    const hasRequiredTargets = availableEffects.every((effect) => {
      if (effect.kind === 'opponent-battle-to-trash') {
        // 這類效果不能只用一般 selector 判定：BS6-010 的移動封鎖與
        // BS3-115 的 Soul Jam 保護都必須在同一份規則候選中排除，否則
        // UI 會先讓玩家進入選擇流程，最後才發現沒有合法目標。
        return getEffectTargetCandidatesForEffect(nextGame, context, effect).length > 0
      }
      if (effect.kind === 'support-to-hand') {
        return (
          getEffectSelectionCandidates(nextGame, context, effect).length >=
          (effect.optional ? 0 : effect.amount)
        )
      }
      if (effect.kind === 'field-to-deck-bottom') {
        return hasRequiredEffectTargets(nextGame, context, effect)
      }
      if (isEffectUntargeted(effect) || !('target' in effect) || !effect.target) {
        return true
      }
      // cycle-hp（BS4-030）：整個效果都依賴目標餅乾，沒有其他黃色餅乾時
      // 直接視為無合法目標，不彈發動權詢問。
      if (effect.kind === 'cycle-hp') {
        return (
          getEffectTargetCandidates(nextGame, context, effect.target).length > 0
        )
      }
      if ((effect.target.min ?? 0) === 0) return true
      const candidates = getEffectTargetCandidates(nextGame, context, effect.target)
      const opponentId: PlayerId =
        playerId === 'player-one' ? 'player-two' : 'player-one'
      const targetPlayerId =
        effect.target.side === 'self' ? playerId : opponentId
      const hasStageTarget =
        effect.kind === 'field-to-trash' &&
        (effect.allowStage || effect.stageOnly) &&
        nextGame.players[targetPlayerId].stage !== null
      return candidates.length + Number(hasStageTarget) >= effect.target.min
    })

    if (!hasRequiredTargets) {
      const movementBlocker = availableEffects
        .map((effect) =>
          effect.kind === 'field-to-deck-bottom'
            ? getFieldToDeckBottomBlocker(nextGame, context, effect)
            : undefined,
        )
        .find((blocker): blocker is NonNullable<typeof blocker> => Boolean(blocker))
      if (trigger === 'on-play' && nextGame.pendingOnPlay) {
        setGame(
          applyGameCommand(nextGame, {
            kind: 'skip-on-play',
            playerId,
            sourceInstanceId: card.instanceId,
          }),
        )
      }
      setMessage(
        movementBlocker
          ? `${card.name}的登場效果被「${movementBlocker.card.name}」阻止：無法將餅乾移出戰鬥區。`
          : `${card.name}目前沒有合法的效果目標。`,
      )
      return
    }

    if (
      !canActivateCookieSkill(
        nextGame,
        playerId,
        card.instanceId,
        trigger,
      )
    ) {
      if (trigger === 'on-play' && nextGame.pendingOnPlay) {
        setGame(
          applyGameCommand(nextGame, {
            kind: 'skip-on-play',
            playerId,
            sourceInstanceId: card.instanceId,
          }),
        )
      }
      setMessage(`${card.name}目前無法支付或發動技能。`)
      return
    }

    clearAttacker()
    setPendingEffect({
      sourceCard: card,
      context,
      skill: card.skill,
      trigger,
      effects: availableEffects,
      effectIndex: 0,
      selectedTargetIds: [],
      selectedPaymentIds: [],
      selectedCostSupportToTrashIds: [],
      selectedDiscardHandIds: [],
      selectedHpToTrashTargetIds: [],
      selectedTrashBattleCookieIds: [],
      selectedBattleToHandIds: [],
      skillActivated: false,
      optional,
      triggerLabel,
      sourceKind: 'cookie',
    })
    setMessage(`${card.name}的技能等待支付技能代價並選擇目標。`)
    },
    [setGame, setMessage, clearAttacker, setPendingEffect],
  )

  /**
   * 補位(refresh-deck/replace-cookie)完成後,若剛好觸發了 OnPlay 技能,
   * 呼叫 beginCookieSkill 開始那個技能的精靈。傳入的 state 必須是指令
   * 套用後的最新結果(本地模式下同步可得)。線上模式沒有同步結果,改用
   * 監看 game.pendingOnPlay 變化的 effect 主動觸發,此函式在那邊是no-op。
   */
  const handleOnPlayTrigger = (state: GameState) => {
    const onPlay = state.pendingOnPlay
    if (!onPlay) return
    const card = state.players[onPlay.playerId].battleArea.find(
      (cookie) => cookie.card.instanceId === onPlay.sourceInstanceId,
    )?.card
    beginCookieSkill(
      state,
      card,
      onPlay.playerId,
      'on-play',
      'OnPlay 登場觸發',
      true,
    )
  }

  const beginCardAbility = (
    card: GameCard,
    ability: CardAbility,
    sourceKind: 'item' | 'stage',
    triggerLabel: string,
  ) => {
    const context = {
      sourcePlayerId: viewerPlayerId,
      sourceInstanceId: card.instanceId,
    }
    const effectiveCost =
      sourceKind === 'item'
        ? getEffectiveCardAbilityCost(game, viewerPlayerId, ability)
        : ability.cost
    const effects = ability.effects.filter((effect) =>
      isEffectConditionMet(game, context, effect),
    )
    if (effects.length === 0) {
      setMessage(`${card.name}目前未滿足使用條件。`)
      return
    }
    setPendingEffect({
      sourceCard: card,
      context,
      skill: {
        trigger: 'activate',
        oncePerTurn: false,
        yourTurn: true,
        restSource: sourceKind === 'stage',
        cost: effectiveCost,
        text: ability.text,
        effects,
      },
      trigger: 'activate',
      effects,
      effectIndex: 0,
      selectedTargetIds: [],
      selectedPaymentIds: [],
      selectedCostSupportToTrashIds: [],
      selectedDiscardHandIds: [],
      selectedHpToTrashTargetIds: [],
      selectedTrashBattleCookieIds: [],
      selectedBattleToHandIds: [],
      skillActivated: false,
      optional: false,
      triggerLabel,
      sourceKind,
    })
    clearAttacker()
    setMessage(`${card.name}等待支付能量並選擇目標。`)
  }

  useEffect(() => {
    const battle = game.pendingBattle
    if (
      !battle ||
      battle.stage !== 'attack-effect' ||
      battle.attackerPlayerId !== viewerPlayerId ||
      game.pendingOptionalCostAttack ||
      pendingEffect ||
      faintActive ||
      // resolve-attack-effect 是 player-action 指令，規則層的
      // assertNoPendingDecision 要求「完全沒有待處理決策」才放行。這裡必須用
      // 同一份判斷，不能只看 faintActive——faintActive 只在昏厥效果屬於**檢視者**
      // 時為真，攻擊打死帶昏厥觸發的對手餅乾時（如 Cherry Cookie），決策擁有者
      // 是對手，檢視者這邊看起來一片乾淨，於是照送指令、直接被規則層擋下拋錯，
      // 而且是在 setGame updater 裡拋出，整個 App 會被 error boundary 接走。
      // 有待處理決策時就先讓出，等擁有者（AI 或對手）解完再由本 effect 接手。
      getPendingDecision(game)
    ) {
      return
    }

    // 攻擊後 Then 仍要依序結算，即使前一段效果讓攻擊者昏厥（例如
    // BS5-098 將自身最後一張 HP 送入棄牌區）。攻擊者此時會離開戰鬥區，
    // 但完整卡牌資料仍在休息區／棄牌區，必須沿用該資料建立下一段提示。
    const sourceCard = findCardInPlayerZones(
      game.players[viewerPlayerId],
      battle.attackerInstanceId,
    )
    const currentAttackEffect =
      battle.attackEffects[battle.attackEffectIndex]
    if (!sourceCard || !currentAttackEffect) return

    const attackContext = {
      sourcePlayerId: viewerPlayerId,
      sourceInstanceId: battle.attackerInstanceId,
    }
    const hasApplicableEffect =
      currentAttackEffect.kind === 'optional-cost-attack'
        ? currentAttackEffect.effects.some(
            (effect) =>
              isEffectConditionMet(game, attackContext, effect) &&
              hasRequiredEffectTargets(game, attackContext, effect),
          )
        : isEffectConditionMet(game, attackContext, currentAttackEffect) &&
          hasRequiredEffectTargets(game, attackContext, currentAttackEffect) &&
          !(
            'target' in currentAttackEffect &&
            currentAttackEffect.target &&
            (currentAttackEffect.target.min ?? 0) === 0 &&
            getEffectTargetCandidatesForEffect(
              game,
              attackContext,
              currentAttackEffect,
            ).length === 0
          )

    if (!hasApplicableEffect) {
      const timer = window.setTimeout(() => {
        setGame((current) => {
          const currentBattle = current.pendingBattle
          if (
            !currentBattle ||
            currentBattle.stage !== 'attack-effect' ||
            currentBattle.attackerPlayerId !== viewerPlayerId ||
            currentBattle.attackerInstanceId !== battle.attackerInstanceId ||
            currentBattle.attackEffectIndex !== battle.attackEffectIndex
          ) {
            return current
          }
          return applyGameCommand(current, {
            kind: 'resolve-attack-effect',
            playerId: viewerPlayerId,
            targetIds: [],
          })
        })
        setMessage(`已略過 ${sourceCard.name} 的攻擊後續效果。`)
      }, 0)
      return () => window.clearTimeout(timer)
    }

    if (currentAttackEffect.kind === 'optional-cost-attack') {
      const timer = window.setTimeout(() => {
        setGame((current) => {
          const currentBattle = current.pendingBattle
          if (
            current.pendingOptionalCostAttack ||
            !currentBattle ||
            currentBattle.stage !== 'attack-effect' ||
            currentBattle.attackerPlayerId !== viewerPlayerId ||
            currentBattle.attackerInstanceId !== battle.attackerInstanceId ||
            currentBattle.attackEffectIndex !== battle.attackEffectIndex
          ) {
            return current
          }
          return applyGameCommand(current, {
            kind: 'resolve-attack-effect',
            playerId: viewerPlayerId,
            targetIds: [],
          })
        })
        setMessage(`${sourceCard.name}等待決定是否支付攻擊後續效果代價。`)
      }, 0)
      return () => window.clearTimeout(timer)
    }

    const timer = window.setTimeout(() => {
      setPendingEffect({
        sourceCard,
        context: {
          sourcePlayerId: viewerPlayerId,
          sourceInstanceId: battle.attackerInstanceId,
        },
        skill: {
          trigger: 'activate',
          oncePerTurn: false,
          yourTurn: true,
          restSource: false,
          cost: { energy: {}, discardHand: 0 },
          text:
            sourceCard && 'attackText' in sourceCard
              ? sourceCard.attackText ?? ''
              : '',
          effects: battle.attackEffects,
        },
        trigger: 'activate',
        effects: battle.attackEffects,
        effectIndex: battle.attackEffectIndex,
        selectedTargetIds: [],
        selectedPaymentIds: [],
        selectedCostSupportToTrashIds: [],
        selectedDiscardHandIds: [],
        selectedHpToTrashTargetIds: [],
        selectedTrashBattleCookieIds: [],
        selectedBattleToHandIds: [],
        skillActivated: true,
        optional: false,
        triggerLabel: '攻擊後續效果',
        sourceKind: 'attack',
      })
      setMessage(`${sourceCard.name}等待選擇攻擊後續效果目標。`)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [
    game,
    viewerPlayerId,
    setGame,
    pendingEffect,
    faintActive,
    setMessage,
  ])

  useEffect(() => {
    if (
      !game.pendingOnPlay ||
      game.pendingOnPlay.playerId !== viewerPlayerId ||
      pendingEffect ||
      faintActive ||
      game.pendingOpponentHandDiscard
    ) {
      return
    }

    const timer = window.setTimeout(() => {
      const card = game.players[viewerPlayerId].battleArea.find(
        (cookie) =>
          cookie.card.instanceId === game.pendingOnPlay?.sourceInstanceId,
      )?.card
      if (card) {
        beginCookieSkill(
          game,
          card,
          viewerPlayerId,
          'on-play',
          'OnPlay 登場觸發',
          true,
        )
      }
    }, 0)
    return () => window.clearTimeout(timer)
  }, [
    game.pendingOnPlay,
    game.pendingOpponentHandDiscard,
    pendingEffect,
    faintActive,
    viewerPlayerId,
    game,
    beginCookieSkill,
  ])

  const toggleEffectTarget = (instanceId: string) => {
    if (faintActive) {
      if (!effectTargetIds.has(instanceId)) return
      setSelectedFaintTargetIds((current) =>
        current.includes(instanceId)
          ? current.filter((id) => id !== instanceId)
          : current.length < faintMinMax.max
            ? [...current, instanceId]
            : current,
      )
      return
    }

    if (afterDamageActive) {
      if (!afterDamageTargetIds.has(instanceId)) return
      setSelectedAfterDamageTargetIds((current) =>
        current.includes(instanceId)
          ? current.filter((id) => id !== instanceId)
          : current.length < afterDamageMinMax.max
            ? [...current, instanceId]
            : current,
      )
      return
    }

    if (
      !pendingEffect ||
      !currentEffect ||
      (!effectTargetIds.has(instanceId) &&
        !breakEffectTargetIds.has(instanceId) &&
        !supportEffectTargetIds.has(instanceId) &&
        !trashEffectTargetIds.has(instanceId))
    ) {
      return
    }

    if (currentEffect.kind === 'rest-support-and-damage') {
      const supportCandidateIds = new Set(
        restSupportAndDamageSupportCandidates.map(
          (card) => card.instanceId,
        ),
      )
      const targetCandidateIds = new Set(
        restSupportAndDamageTargetCandidates.map(
          (card) => card.instanceId,
        ),
      )
      const isSupport = supportCandidateIds.has(instanceId)
      const isTarget = targetCandidateIds.has(instanceId)
      if (!isSupport && !isTarget) return

      const isSelected = pendingEffect.selectedTargetIds.includes(instanceId)
      const selectedInGroup = pendingEffect.selectedTargetIds.filter((id) =>
        isSupport ? supportCandidateIds.has(id) : targetCandidateIds.has(id),
      )
      const max = isSupport
        ? currentEffect.supportAmount
        : currentEffect.target.max
      const selectedTargetIds = isSelected
        ? pendingEffect.selectedTargetIds.filter((id) => id !== instanceId)
        : selectedInGroup.length < max
          ? [...pendingEffect.selectedTargetIds, instanceId]
          : pendingEffect.selectedTargetIds

      setPendingEffect({ ...pendingEffect, selectedTargetIds })
      return
    }

    const max =
      selectionEffect?.kind === 'damage-all' && selectionEffect.sequential
        ? effectTargetCandidates.length
        : currentEffect.kind === 'break-to-trash' ||
        currentEffect.kind === 'trash-to-hand' ||
        currentEffect.kind === 'trash-to-deck'
        ? currentEffect.max
        : currentEffect.kind === 'break-to-hand-by-level-sum' ||
            currentEffect.kind === 'hand-to-break-by-level-sum'
          ? Number.MAX_SAFE_INTEGER
        : currentEffect.kind === 'support-to-trash' ||
            currentEffect.kind === 'support-to-hand' ||
            currentEffect.kind === 'hand-to-support' ||
            currentEffect.kind === 'trash-to-battle' ||
            currentEffect.kind === 'trash-to-support' ||
            currentEffect.kind === 'trash-to-break' ||
            currentEffect.kind === 'break-to-battle' ||
            currentEffect.kind === 'support-to-battle'
          ? currentEffect.kind === 'support-to-hand'
            ? currentEffect.keepCount ??
              (currentEffect.anyNumber
                ? supportEffectCandidates.length
                : currentEffect.amount)
            : currentEffect.amount
        : currentEffect.kind === 'hand-to-break' ||
            currentEffect.kind === 'break-to-hand' ||
            currentEffect.kind === 'rest-support'
          ? currentEffect.amount
        : currentEffect.kind === 'support-to-hp'
          ? currentEffect.selectTarget
            ? 2
            : 1
        : currentEffect.kind === 'hand-to-hp'
          ? 1
        : currentEffect.kind === 'cycle-hp'
          ? 1
        : currentEffect.kind === 'field-to-deck-bottom'
          ? currentEffect.target.max
        : currentEffect.kind === 'set-active' && currentEffect.selectable
          ? currentEffect.supportCount
        : isEffectUntargeted(currentEffect)
          ? currentEffect.kind === 'gain-hp'
            ? currentEffect.target?.max ?? 0
            : 0
          : currentEffect.kind === 'opponent-battle-to-trash'
            ? 1
            : currentEffect.kind === 'opponent-break-to-trash-then-battle-to-break'
              ? 1
            : currentEffect.kind === 'inspect-deck' ||
              currentEffect.kind === 'optional-cost-attack' ||
              currentEffect.kind === 'disable-block' ||
              currentEffect.kind === 'flip-to-support'
            ? 0
            : currentEffect.kind === 'hand-to-battle'
            ? currentEffect.amount
            : currentEffect.kind === 'opponent-trash-to-break'
            ? currentEffect.max
          : ('target' in currentEffect ? currentEffect.target?.max ?? 0 : 0)

    const isSelected = pendingEffect.selectedTargetIds.includes(instanceId)
    const selectedTargetIds = isSelected
      ? pendingEffect.selectedTargetIds.filter((id) => id !== instanceId)
      : pendingEffect.selectedTargetIds.length < max
        ? [...pendingEffect.selectedTargetIds, instanceId]
        : pendingEffect.selectedTargetIds

    setPendingEffect({ ...pendingEffect, selectedTargetIds })
  }

  const toggleSkillPayment = (instanceId: string) => {
    if (!pendingEffect || pendingEffect.skillActivated) return
    if (
      pendingEffect.selectedCostSupportToTrashIds.includes(instanceId) ||
      pendingEffect.selectedTargetIds.includes(instanceId)
    ) {
      return
    }

    const isSelected =
      pendingEffect.selectedPaymentIds.includes(instanceId)
    if (
      !isSelected &&
      pendingEffect.selectedPaymentIds.length >= skillEnergyCostTotal
    ) {
      return
    }
    if (
      !isSelected &&
      !isSkillEnergyColorCompatible(
        pendingSupportArea.find(
          (s) => s.card.instanceId === instanceId,
        )?.card.energyColor,
      )
    ) {
      return
    }
    const selectedPaymentIds = isSelected
      ? pendingEffect.selectedPaymentIds.filter((id) => id !== instanceId)
      : [...pendingEffect.selectedPaymentIds, instanceId]

    setPendingEffect({ ...pendingEffect, selectedPaymentIds })
  }

  const toggleSkillCostSupport = (instanceId: string) => {
    if (!pendingEffect || pendingEffect.skillActivated) return
    if (
      !skillCostSupportTargetIds.has(instanceId) ||
      pendingEffect.selectedPaymentIds.includes(instanceId)
    ) {
      return
    }

    const max =
      (pendingEffect.skill.cost.supportToTrash ?? 0) +
      (pendingEffect.skill.cost.supportToHand ?? 0)
    const isSelected =
      pendingEffect.selectedCostSupportToTrashIds.includes(instanceId)
    const selectedCostSupportToTrashIds = isSelected
      ? pendingEffect.selectedCostSupportToTrashIds.filter(
          (id) => id !== instanceId,
        )
      : pendingEffect.selectedCostSupportToTrashIds.length < max
        ? [...pendingEffect.selectedCostSupportToTrashIds, instanceId]
        : pendingEffect.selectedCostSupportToTrashIds

    setPendingEffect({ ...pendingEffect, selectedCostSupportToTrashIds })
  }

  const toggleSkillDiscardHand = (instanceId: string) => {
    if (!pendingEffect || pendingEffect.skillActivated) return
    const cost = pendingEffect.skill.cost
    const discardHandCost = cost.discardHand ?? 0
    if (!cost.discardAllHand && discardHandCost <= 0) return
    if (!skillDiscardHandTargetIds.has(instanceId)) return
    const selectionLimit =
      cost.discardAllHand || cost.discardHandAtLeast
        ? skillDiscardHandTargetIds.size
        : discardHandCost

    const isSelected =
      pendingEffect.selectedDiscardHandIds.includes(instanceId)
    if (
      !isSelected &&
      pendingEffect.selectedDiscardHandIds.length >= selectionLimit
    ) {
      return
    }
    const selectedDiscardHandIds = isSelected
      ? pendingEffect.selectedDiscardHandIds.filter((id) => id !== instanceId)
      : [...pendingEffect.selectedDiscardHandIds, instanceId]

    setPendingEffect({ ...pendingEffect, selectedDiscardHandIds })
  }

  const toggleSkillTrashToDeckBottom = (instanceId: string) => {
    if (!pendingEffect || pendingEffect.skillActivated) return
    const cost = pendingEffect.skill.cost.trashToDeckBottom
    if (!cost) return
    if (!skillTrashToDeckBottomTargetIds.has(instanceId)) return
    const selected = pendingEffect.selectedTrashToDeckBottomIds ?? []
    const isSelected = selected.includes(instanceId)
    if (!isSelected && selected.length >= cost.count) return
    setPendingEffect({
      ...pendingEffect,
      selectedTrashToDeckBottomIds: isSelected
        ? selected.filter((id) => id !== instanceId)
        : [...selected, instanceId],
    })
  }

  const toggleSkillTrashToDeck = (instanceId: string) => {
    if (!pendingEffect || pendingEffect.skillActivated) return
    const cost = pendingEffect.skill.cost.trashToDeck
    if (!cost || !skillTrashToDeckTargetIds.has(instanceId)) return
    const selected = pendingEffect.selectedTrashToDeckIds ?? []
    const isSelected = selected.includes(instanceId)
    if (!isSelected && selected.length >= cost.count) return
    setPendingEffect({
      ...pendingEffect,
      selectedTrashToDeckIds: isSelected
        ? selected.filter((id) => id !== instanceId)
        : [...selected, instanceId],
    })
  }

  const toggleSkillTrashBattleCookie = (instanceId: string) => {
    if (!pendingEffect || pendingEffect.skillActivated) return
    const trashCost = pendingEffect.skill.cost.trashBattleCookie
    if (!trashCost) return
    const player = game.players[pendingEffect.context.sourcePlayerId]
    const cookie = player.battleArea.find(
      (c) => c.card.instanceId === instanceId,
    )
    if (!cookie) return
    if (
      trashCost.level !== undefined &&
      cookie.card.level !== trashCost.level
    ) return
    if (
      trashCost.energyColor !== undefined &&
      cookie.card.energyColor !== trashCost.energyColor
    ) return

    const isSelected =
      pendingEffect.selectedTrashBattleCookieIds.includes(instanceId)
    if (
      !isSelected &&
      pendingEffect.selectedTrashBattleCookieIds.length >= trashCost.count
    ) {
      return
    }
    const selectedTrashBattleCookieIds = isSelected
      ? pendingEffect.selectedTrashBattleCookieIds.filter(
          (id) => id !== instanceId,
        )
      : [...pendingEffect.selectedTrashBattleCookieIds, instanceId]

    setPendingEffect({ ...pendingEffect, selectedTrashBattleCookieIds })
  }

  const toggleSkillBattleToHand = (instanceId: string) => {
    if (!pendingEffect || pendingEffect.skillActivated) return
    if (!pendingEffect.skill.cost.battleCookieToHand) return
    if (!skillBattleToHandTargetIds.has(instanceId)) return

    const selectedIds = pendingEffect.selectedBattleToHandIds ?? []
    const isSelected = selectedIds.includes(instanceId)
    if (
      !isSelected &&
      selectedIds.length >= battleToHandCost
    ) {
      return
    }
    const selectedBattleToHandIds = isSelected
      ? selectedIds.filter((id) => id !== instanceId)
      : [...selectedIds, instanceId]

    setPendingEffect({ ...pendingEffect, selectedBattleToHandIds })
  }

  const toggleSkillHpToTrash = (instanceId: string) => {
    if (!pendingEffect || pendingEffect.skillActivated) return
    if (!pendingEffect.skill.cost.hpToTrash || !skillHpToTrashTargetIds.has(instanceId)) {
      return
    }
    const selected = pendingEffect.selectedHpToTrashTargetIds
    setPendingEffect({
      ...pendingEffect,
      selectedHpToTrashTargetIds: selected.includes(instanceId) ? [] : [instanceId],
    })
  }

  const cancelPendingSkill = () => {
    if (!pendingEffect) return
    if (
      (pendingEffect.sourceKind !== 'cookie' &&
        pendingEffect.sourceKind !== 'item' &&
        pendingEffect.sourceKind !== 'stage') ||
      pendingEffect.trigger !== 'activate' ||
      pendingEffect.skillActivated
    ) {
      return
    }
    setPendingEffect(null)
    setMessage(`已取消${pendingEffect.sourceCard.name}的技能發動。`)
  }

  const skipOptionalSkill = () => {
    if (
      pendingEffect &&
      currentEffect &&
      'optional' in currentEffect &&
      currentEffect.optional
    ) {
      const nextEffectIndex = pendingEffect.effectIndex + 1
      const nextEffect =
        nextEffectIndex < pendingEffect.effects.length
          ? pendingEffect.effects[nextEffectIndex]
          : null
      const skipNextEquip =
        nextEffect?.kind === 'equip-source' &&
        getEffectTargetCandidatesForEffect(
          game,
          pendingEffect.context,
          nextEffect,
        ).length === 0
      const effectiveNextIndex = skipNextEquip
        ? nextEffectIndex + 1
        : nextEffectIndex
      const hasNextEffect =
        effectiveNextIndex < pendingEffect.effects.length
      const viewerMustAct =
        (game.pendingRefresh?.playerId === viewerPlayerId) ||
        (game.pendingOnPlay?.playerId === viewerPlayerId) ||
        (game.pendingInspectDeck?.playerId === viewerPlayerId) ||
        (game.pendingRevealTopDeck?.playerId === viewerPlayerId) ||
        (game.pendingOptionalCostAttack?.playerId === viewerPlayerId) ||
        (game.pendingDrawUpTo?.playerId === viewerPlayerId) ||
        (game.pendingStageTrigger?.playerId === viewerPlayerId) ||
        (game.pendingAfterDamageEffects &&
          game.pendingAfterDamageEffects.length > 0 &&
          game.pendingAfterDamageEffects[0].sourcePlayerId === viewerPlayerId)

      if (hasNextEffect && viewerMustAct) {
        setPendingEffect(null)
        setSuspendedEffect({
          ...pendingEffect,
          effectIndex: effectiveNextIndex,
          selectedTargetIds: [],
          skillActivated: true,
          selectedDiscardHandIds: [],
          selectedHpToTrashTargetIds: [],
          selectedTrashBattleCookieIds: [],
        })
        setMessage('已略過可選效果。')
        return
      }

      setPendingEffect(
        hasNextEffect
          ? {
              ...pendingEffect,
              effectIndex: effectiveNextIndex,
              selectedTargetIds: [],
              selectedDiscardHandIds: [],
              selectedHpToTrashTargetIds: [],
              selectedTrashBattleCookieIds: [],
              skillActivated: true,
            }
          : null,
      )
      setMessage('已略過可選效果。')
      return
    }

    if (!pendingEffect?.optional) return

    dispatch(
      {
        kind: 'skip-on-play',
        playerId: pendingEffect.context.sourcePlayerId,
        sourceInstanceId: pendingEffect.sourceCard.instanceId,
      },
      `${pendingEffect.sourceCard.name}的 OnPlay 技能未發動。`,
    )
    setPendingEffect(null)
  }

  const skipAttackEffect = () => {
    if (!pendingEffect || pendingEffect.sourceKind !== 'attack') return
    dispatch(
      {
        kind: 'resolve-attack-effect',
        playerId: pendingEffect.context.sourcePlayerId,
        targetIds: [],
      },
      `已略過 ${pendingEffect.sourceCard.name} 的攻擊後續效果。`,
    )
    setPendingEffect(null)
  }

  const confirmEffect = () => {
    if (!pendingEffect || !currentEffect) return

    const currentConditionMet = isEffectConditionMet(
      game,
      pendingEffect.context,
      currentEffect,
    )

    const targetNames =
      currentEffect.kind === 'break-to-trash'
        ? pendingEffect.selectedTargetIds.map(
            (instanceId) =>
              breakToTrashCandidates.find(
                (card) => card.instanceId === instanceId,
              )?.name ?? instanceId,
          )
        : currentEffect.kind === 'support-to-trash' ||
            currentEffect.kind === 'support-to-hand'
          ? pendingEffect.selectedTargetIds.map(
              (instanceId) =>
                supportEffectCandidates.find(
                  (support) => support.card.instanceId === instanceId,
                )?.card.name ?? instanceId,
            )
          : currentEffect.kind === 'hand-to-support' ||
              currentEffect.kind === 'opponent-break-to-trash-then-battle-to-break'
            ? pendingEffect.selectedTargetIds.map(
                (instanceId) =>
                  genericEffectCandidateCards.find(
                    (card) => card.instanceId === instanceId,
                  )?.name ?? instanceId,
              )
          : currentEffect.kind === 'trash-to-battle' ||
              currentEffect.kind === 'trash-to-support'
            ? pendingEffect.selectedTargetIds.map(
                (instanceId) =>
                  trashCookieCandidates.find(
                    (card) => card.instanceId === instanceId,
                  )?.name ?? instanceId,
              )
        : pendingEffect.selectedTargetIds.map(
            (instanceId) =>
              effectTargetCandidates.find(
                (cookie) => cookie.card.instanceId === instanceId,
              )?.card.name ?? instanceId,
          )

    try {
      if (pendingEffect.sourceKind === 'attack') {
        const result = currentConditionMet
          ? describeEffectResult(currentEffect, targetNames)
          : `${pendingEffect.sourceCard.name} 的效果條件未滿足，已略過。`
        dispatch(
          {
            kind: 'resolve-attack-effect',
            playerId: pendingEffect.context.sourcePlayerId,
            targetIds: pendingEffect.selectedTargetIds,
          },
          result,
        )
        setEffectHistory((history) => [result, ...history].slice(0, 4))
        setPendingEffect(null)
        return
      }

      const paymentIds = pendingEffect.selectedPaymentIds
      const supportToTrashIds = pendingEffect.skill.cost.supportToTrash
        ? pendingEffect.selectedCostSupportToTrashIds
        : []
      const supportToHandIds = pendingEffect.skill.cost.supportToHand
        ? pendingEffect.selectedCostSupportToTrashIds
        : []
      const discardHandIds = pendingEffect.selectedDiscardHandIds

      // 技能/道具/場景效果是多步驟精靈(逐一支付代價、逐一選目標),
      // 只有第一次呼叫才需要支付代價(begin-*指令),之後每步都走 resolve-ability-effect。
      const activatedGame = pendingEffect.skillActivated
        ? game
        : pendingEffect.sourceKind === 'item'
          ? applyGameCommand(game, {
              kind: 'begin-play-item',
              playerId: pendingEffect.context.sourcePlayerId,
              instanceId: pendingEffect.sourceCard.instanceId,
              paymentIds,
              supportToTrashIds,
              supportToHandIds,
              discardHandIds,
              ...(pendingEffect.skill.cost.hpToTrash
                ? { hpToTrashTargetIds: pendingEffect.selectedHpToTrashTargetIds }
                : {}),
              trashBattleCookieIds: pendingEffect.selectedTrashBattleCookieIds,
              chooseOneModes: pendingEffect.chooseOneModes,
            })
          : pendingEffect.sourceKind === 'stage'
            ? applyGameCommand(game, {
                kind: 'begin-activate-stage',
                playerId: pendingEffect.context.sourcePlayerId,
                paymentIds,
                supportToTrashIds,
                supportToHandIds,
                discardHandIds,
                ...(pendingEffect.skill.cost.hpToTrash
                  ? { hpToTrashTargetIds: pendingEffect.selectedHpToTrashTargetIds }
                  : {}),
                trashBattleCookieIds: pendingEffect.selectedTrashBattleCookieIds,
                chooseOneModes: pendingEffect.chooseOneModes,
              })
            : applyGameCommand(game, {
                kind: 'begin-activate-skill',
                playerId: pendingEffect.context.sourcePlayerId,
                sourceInstanceId: pendingEffect.sourceCard.instanceId,
                trigger: pendingEffect.trigger as 'activate' | 'on-play',
                paymentIds,
                costSupportToTrashIds: pendingEffect.skill.cost.supportToTrash
                  ? pendingEffect.selectedCostSupportToTrashIds
                  : [],
                supportToHandIds,
                discardHandIds,
                ...(pendingEffect.skill.cost.hpToTrash
                  ? { hpToTrashTargetIds: pendingEffect.selectedHpToTrashTargetIds }
                  : {}),
                trashBattleCookieIds: pendingEffect.selectedTrashBattleCookieIds,
                battleToHandIds: pendingEffect.selectedBattleToHandIds ?? [],
                trashToDeckBottomIds: pendingEffect.selectedTrashToDeckBottomIds,
                trashToDeckIds: pendingEffect.selectedTrashToDeckIds,
                chooseOneModes: pendingEffect.chooseOneModes,
              })
      const activationInterrupted =
        !pendingEffect.skillActivated &&
        (activatedGame.status !== 'playing' ||
          Boolean(
            activatedGame.pendingRefresh ||
              activatedGame.pendingOnPlay ||
              getPendingDecision(activatedGame),
          ))

      if (activationInterrupted) {
        setGame(activatedGame)
        setPendingEffect(null)

        if (activatedGame.status !== 'playing') {
          setSuspendedEffect(null)
          setMessage(
            activatedGame.result?.reason === 'no-cookie-available'
              ? `${pendingEffect.sourceCard.name}支付代價後，戰鬥區沒有餅乾且手牌沒有可補位的餅乾，對戰結束。`
              : `${pendingEffect.sourceCard.name}支付代價後，對戰已結束。`,
          )
          return
        }

        setSuspendedEffect({
          ...pendingEffect,
          selectedTargetIds: [],
          selectedPaymentIds: [],
          selectedCostSupportToTrashIds: [],
          selectedDiscardHandIds: [],
          selectedHpToTrashTargetIds: [],
          selectedTrashBattleCookieIds: [],
          selectedTrashToDeckBottomIds: [],
          selectedTrashToDeckIds: [],
          skillActivated: true,
        })
        setMessage(
          `${pendingEffect.sourceCard.name}已支付代價；請先完成目前的待處理操作，再繼續處理效果。`,
        )
        return
      }

      const deferredAfterHpCost =
        !pendingEffect.skillActivated &&
        pendingEffect.sourceKind === 'cookie' &&
        isSkillEffectConditionDeferredUntilCost(pendingEffect.skill, currentEffect)

      if (deferredAfterHpCost) {
        const hpCardId = activatedGame.costRecord?.hpTrashTopCardInstanceId
        const revealedHpCard = hpCardId
          ? activatedGame.players[
              pendingEffect.context.sourcePlayerId
            ].discardPile.find((card) => card.instanceId === hpCardId)
          : undefined
        const revealedType =
          revealedHpCard?.type ?? activatedGame.costRecord?.hpTrashTopCardType
        const typeLabel =
          revealedType === 'cookie'
            ? '餅乾'
            : revealedType === 'item'
              ? '物品'
              : revealedType === 'trap'
                ? '陷阱'
                : revealedType === 'stage'
                  ? '場景'
                  : '未知'
        const costResult = revealedHpCard
          ? `${pendingEffect.sourceCard.name} 支付 HP 費用，丟棄的 HP 卡是「${revealedHpCard.name}」（${typeLabel}）。`
          : `${pendingEffect.sourceCard.name} 支付 HP 費用，丟棄的 HP 卡類型是「${typeLabel}」。`

        setGame(activatedGame)
        setMessage(costResult)
        setEffectHistory((history) => [costResult, ...history].slice(0, 4))

        if (!activatedGame.pendingAbilityEffect) {
          setPendingEffect(null)
          return
        }

        setPendingEffect({
          ...pendingEffect,
          selectedTargetIds: [],
          selectedHpToTrashTargetIds: [],
          skillActivated: true,
          ...(revealedHpCard ? { revealedHpCard } : {}),
        })
        return
      }

      const nextGame = applyGameCommand(activatedGame, {
        kind: 'resolve-ability-effect',
        playerId: pendingEffect.context.sourcePlayerId,
        targetIds: pendingEffect.selectedTargetIds,
      })
      const result = currentConditionMet
        ? describeEffectResult(currentEffect, targetNames)
        : `${pendingEffect.sourceCard.name} 的效果條件未滿足，已略過。`

      if (nextGame.pendingBattle?.effectDamageSequence) {
        setGame(nextGame)
        setMessage(result)
        setEffectHistory((history) => [result, ...history].slice(0, 4))
        setPendingEffect(null)
        return
      }

      // 兩階段選擇（cycle-hp BS4-030 / hand-to-hp BS4-044）第一階段完成：
      // 目標存活時規則層停在第二階段（pendingPlace），把提示交給
      // PendingDecisionModals；未選目標或目標昏厥時規則層直接結束，
      // 這裡照常走 hasNextEffect 收尾。
      if (
        currentEffect.kind === 'reorder-hp' &&
        nextGame.pendingAbilityEffect?.pendingReorderHp
      ) {
        setGame(nextGame)
        setMessage(result)
        setEffectHistory((history) => [result, ...history].slice(0, 4))
        setPendingEffect(null)
        return
      }

      if (
        currentEffect.kind === 'opponent-break-to-trash-then-battle-to-break' &&
        nextGame.pendingAbilityEffect
          ?.pendingOpponentBreakToTrashThenBattleToBreak
      ) {
        setGame(nextGame)
        setMessage(result)
        setEffectHistory((history) => [result, ...history].slice(0, 4))
        setPendingEffect({
          ...pendingEffect,
          selectedTargetIds: [],
          selectedDiscardHandIds: [],
          selectedHpToTrashTargetIds: [],
          selectedTrashBattleCookieIds: [],
          skillActivated: true,
          compoundEffectStep: 'follow-up',
        })
        return
      }

      if (
        (currentEffect.kind === 'cycle-hp' ||
          (currentEffect.kind === 'hand-to-hp' &&
            currentEffect.selectTarget)) &&
        nextGame.pendingAbilityEffect?.pendingPlace
      ) {
        setGame(nextGame)
        setMessage(result)
        setEffectHistory((history) => [result, ...history].slice(0, 4))
        setPendingEffect(null)
        return
      }
      if (
        currentEffect.kind === 'view-hp' &&
        pendingEffect.selectedTargetIds.length === 1
      ) {
        const target = effectTargetCandidates.find(
          (cookie) =>
            cookie.card.instanceId === pendingEffect.selectedTargetIds[0],
        )
        if (target) {
          setInspectedHpPile({
            title: `${target.card.name}的 HP 卡`,
            cards: target.hpCards,
          })
        }
      }
      const nextEffectIndex = pendingEffect.effectIndex + 1
      // 規則層可能在本步成功後才展開條件式 thenEffects（例如 BS2-014
      // 的「If you did」）；下一個面板必須使用更新後的效果佇列，不能沿用
      // 本機啟動時快取的舊陣列。
      const nextEffectQueue =
        nextGame.pendingAbilityEffect?.effects ?? pendingEffect.effects
      const nextEffect =
        nextGame.status === 'playing' &&
        nextEffectIndex < nextEffectQueue.length
          ? nextEffectQueue[nextEffectIndex]
          : null
      const skipNextEquip =
        nextEffect?.kind === 'equip-source' &&
        getEffectTargetCandidatesForEffect(
          nextGame,
          pendingEffect.context,
          nextEffect,
        ).length === 0
      const effectiveNextIndex = skipNextEquip
        ? nextEffectIndex + 1
        : nextEffectIndex
      const hasNextEffect =
        nextGame.status === 'playing' &&
        effectiveNextIndex < nextEffectQueue.length
      const viewerMustAct =
        (nextGame.pendingRefresh?.playerId === viewerPlayerId) ||
        (nextGame.pendingOnPlay?.playerId === viewerPlayerId) ||
        (nextGame.pendingInspectDeck?.playerId === viewerPlayerId) ||
        (nextGame.pendingRevealTopDeck?.playerId === viewerPlayerId) ||
        (nextGame.pendingOptionalCostAttack?.playerId === viewerPlayerId) ||
        (nextGame.pendingDrawUpTo?.playerId === viewerPlayerId) ||
        (nextGame.pendingOpponentHandDiscard?.playerId === viewerPlayerId) ||
        (nextGame.pendingStageTrigger?.playerId === viewerPlayerId) ||
        (nextGame.pendingAfterDamageEffects &&
          nextGame.pendingAfterDamageEffects.length > 0 &&
          nextGame.pendingAfterDamageEffects[0].sourcePlayerId === viewerPlayerId)

      if (hasNextEffect && viewerMustAct) {
        setGame(nextGame)
        setMessage(result)
        setEffectHistory((history) => [result, ...history].slice(0, 4))
        setPendingEffect(null)
        setSuspendedEffect({
          ...pendingEffect,
          effects: nextEffectQueue,
          effectIndex: effectiveNextIndex,
          selectedTargetIds: [],
          selectedDiscardHandIds: [],
          selectedHpToTrashTargetIds: [],
          selectedTrashBattleCookieIds: [],
          skillActivated: true,
        })

        if (nextGame.pendingOnPlay?.playerId === viewerPlayerId) {
          const onPlayCard = nextGame.players[viewerPlayerId].battleArea.find(
            (cookie) =>
              cookie.card.instanceId === nextGame.pendingOnPlay!.sourceInstanceId,
          )?.card
          if (onPlayCard) {
            beginCookieSkill(
              nextGame,
              onPlayCard,
              viewerPlayerId,
              'on-play',
              'OnPlay 登場觸發',
              true,
            )
          }
        }

        return
      }

      const resolvedGame = nextGame

      setGame(resolvedGame)
      setMessage(result)
      setEffectHistory((history) => [result, ...history].slice(0, 4))
      setPendingEffect(
        hasNextEffect
          ? {
              ...pendingEffect,
              effects: nextEffectQueue,
              effectIndex: effectiveNextIndex,
              selectedTargetIds: [],
              selectedDiscardHandIds: [],
              selectedHpToTrashTargetIds: [],
              selectedTrashBattleCookieIds: [],
              skillActivated: true,
            }
          : null,
      )

      if (!hasNextEffect && resolvedGame.status === 'playing') {
        const onPlay = resolvedGame.pendingOnPlay
        if (onPlay && onPlay.playerId === viewerPlayerId) {
          const onPlayCard = resolvedGame.players[viewerPlayerId].battleArea.find(
            (cookie) =>
              cookie.card.instanceId === onPlay.sourceInstanceId,
          )?.card
          if (onPlayCard) {
            beginCookieSkill(
              resolvedGame,
              onPlayCard,
              viewerPlayerId,
              'on-play',
              'OnPlay 登場觸發',
              true,
            )
          }
        }
      }
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : '效果無法執行。',
      )
    }
  }

  const resetEffectContext = () => {
    setPendingEffect(null)
    setSuspendedEffect(null)
    setEffectHistory([])
  }

  /**
   * 「選擇一項」：把佇列就地展開成選定模式的效果。
   * 能力尚未啟動時只改本機佇列，模式索引會隨之後的 `begin-*` 指令送進規則層；
   * 已啟動時（choose-one 不是第一個效果）則要另外送 `resolve-choose-one`
   * 讓規則層的 `pendingAbilityEffect` 一起展開。
   */
  const chooseEffectMode = (modeIndex: number) => {
    if (!pendingEffect || currentEffect?.kind !== 'choose-one') return
    const expanded = expandChooseOne(
      pendingEffect.effects,
      pendingEffect.effectIndex,
      modeIndex,
    )
    if (pendingEffect.skillActivated) {
      dispatch(
        {
          kind: 'resolve-choose-one',
          playerId: pendingEffect.context.sourcePlayerId,
          modeIndex,
        },
        `已選擇「${currentEffect.modes[modeIndex]?.label ?? ''}」。`,
      )
    }
    setPendingEffect(
      pendingEffect.skillActivated && pendingEffect.effectIndex >= expanded.length
        ? null
        : {
            ...pendingEffect,
            effects: expanded,
            chooseOneModes: [...(pendingEffect.chooseOneModes ?? []), modeIndex],
            selectedTargetIds: [],
          },
    )
  }

  return {
    pendingEffect,
    setPendingEffect,
    chooseEffectMode,
    suspendedEffect,
    setSuspendedEffect,
    effectHistory,
    setEffectHistory,
    resetEffectContext,
    effectDecisionDescriptor,
    beginCookieSkill,
    handleOnPlayTrigger,
    beginCardAbility,
    toggleEffectTarget,
    toggleSkillPayment,
    toggleSkillCostSupport,
    toggleSkillDiscardHand,
    toggleSkillHpToTrash,
    toggleSkillTrashBattleCookie,
    toggleSkillBattleToHand,
    toggleSkillTrashToDeckBottom,
    toggleSkillTrashToDeck,
    confirmEffect,
    skipOptionalSkill,
    skipAttackEffect,
    cancelPendingSkill,
    currentEffect: selectionEffect,
    currentEffectConditionMet,
    effectTargetCandidates,
    supportEffectCandidates,
    trashCookieCandidates,
    nonBattleEffectCandidateCards,
    breakToTrashCandidates,
    breakToBattleCandidates,
    supportToBattleCandidates,
    breakToHandBySumCandidates,
    handToBreakBySumCandidates,
    trashToHandCandidates,
    trashToDeckCandidates,
    genericEffectCandidateCards,
    restSupportAndDamageSupportCandidates,
    restSupportAndDamageTargetCandidates,
    skillCostSupportCandidates,
    skillEnergyPaymentValid,
    skillPaymentLabel,
    skillPaymentTargetIds,
    skillCostSupportTargetIds,
    skillCostDiscardHandCandidates,
    skillDiscardHandTargetIds,
    selectedSkillDiscardHandIds,
    discardHandCost,
    selectedSkillHpToTrashTargetIds,
    skillHpToTrashCandidates,
    skillHpToTrashTargetIds,
    hpToTrashCost,
    effectTargetIds,
    breakEffectTargetIds,
    supportEffectTargetIds,
    selectedEffectTargetIds,
    selectedSkillPaymentIds,
    selectedSkillCostSupportToTrashIds,
    selectedSkillTrashBattleCookieIds,
    skillTrashBattleCookieCandidates,
    skillTrashBattleCookieTargetIds,
    selectedSkillBattleToHandIds,
    skillBattleToHandCandidates,
    skillBattleToHandTargetIds,
    battleToHandCost,
    selectedSkillTrashToDeckBottomIds,
    skillTrashToDeckBottomCandidates,
    skillTrashToDeckBottomTargetIds,
    trashToDeckBottomCost,
    selectedSkillTrashToDeckIds,
    skillTrashToDeckCandidates,
    skillTrashToDeckTargetIds,
    trashToDeckCost,
    faintActive,
    afterDamageActive,
  } as const
}
