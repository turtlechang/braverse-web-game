import { useEffect, useRef, useState } from 'react'
import {
  canActivateCookieSkill,
  canPlayItem,
  canActivateStage,
  compileEffectDecisionDescriptor,
  getEffectSelectionCandidates,
  getEffectSelectionLimits,
  getEffectTargetCandidates,
  getNestedSequentialDamageSelectionEffect,
  getSupportEffectCandidates,
  hasRequiredEffectTargets as hasRequiredTargetsForEffect,
  getEnergyCostTotal,
  getDiscardAllHandCostCandidates,
  getDiscardHandCostCandidates,
  getHpToTrashCostCandidates,
  getTrashBattleCookieCostCandidates,
  getBattleCookieToHandCostCandidates,
  isEffectConditionMet,
  isEffectUntargeted,
  requiresEffectCardSelection,
  selectEnergyPayment,
  validateEnergyPayment,
  type CardAbility,
  type CardEffect,
  type CardSkill,
  type EffectContext,
  type EffectTargetSelector,
  type GameCard,
  type GameState,
  type PlayerId,
} from '../game'
import { expandChooseOneSequence } from '../game'
import type { DispatchGameCommand } from './useBattleActions'
import type { PendingEffect } from '../components/effects/effectUiTypes'

interface HpPileInfo {
  title: string
  cards: GameCard[]
}

type AbilityCostDraft = {
  sourceKind: 'cookie' | 'item' | 'stage'
  card: GameCard
  ability: CardAbility | CardSkill
  trigger: 'activate' | 'on-play'
  selectedPaymentIds: string[]
  selectedCostSupportToTrashIds: string[]
  selectedDiscardHandIds: string[]
  selectedHpToTrashTargetIds: string[]
  selectedTrashBattleCookieIds: string[]
  selectedBattleToHandIds: string[]
  /** 玩家為「選擇一項」挑過的模式，依序累積後隨 begin-* 指令送出。 */
  chooseOneModes: number[]
}

const getTargetSelector = (
  effect: CardEffect | null,
): EffectTargetSelector | null => {
  if (!effect) return null
  if (effect.kind === 'damage-all' && effect.sequential) {
    return effect.target ?? null
  }
  if (effect.kind === 'gain-hp') {
    return effect.target?.sourceOnly ? null : (effect.target ?? null)
  }
  if (
    effect.kind === 'break-to-battle' ||
    effect.kind === 'support-to-battle' ||
    effect.kind === 'trash-to-battle' ||
    effect.kind === 'support-to-trash' ||
    effect.kind === 'hand-to-break' ||
    effect.kind === 'break-to-hand' ||
    effect.kind === 'hand-to-hp' ||
    effect.kind === 'rest-support' ||
    effect.kind === 'support-to-hp' ||
    effect.kind === 'cycle-hp' ||
    effect.kind === 'rest-support-and-damage' ||
    effect.kind === 'field-to-deck-bottom' ||
    effect.kind === 'hand-to-battle' ||
    effect.kind === 'opponent-trash-to-break' ||
    effect.kind === 'trash-to-break' ||
    effect.kind === 'trash-to-deck' ||
    (effect.kind === 'set-active' && effect.selectable)
  ) {
    return null
  }
  if (isEffectUntargeted(effect)) return null
  if (effect.kind === 'opponent-battle-to-trash') {
    return {
      side: 'opponent',
      min: 1,
      max: 1,
      ...(effect.maxLevel !== undefined ? { maxLevel: effect.maxLevel } : {}),
      ...(effect.minLevel !== undefined ? { minLevel: effect.minLevel } : {}),
      ...(effect.remainingHp !== undefined
        ? { remainingHp: effect.remainingHp }
        : {}),
    }
  }
  return 'target' in effect ? (effect.target ?? null) : null
}

const findCardByInstanceId = (
  game: GameState,
  instanceId: string,
): GameCard | undefined => {
  for (const player of Object.values(game.players)) {
    const battleCard = player.battleArea.find(
      (cookie) => cookie.card.instanceId === instanceId,
    )?.card
    if (battleCard) return battleCard
    const handCard = player.hand.find((card) => card.instanceId === instanceId)
    if (handCard) return handCard
    const supportCard = player.supportArea.find(
      (support) => support.card.instanceId === instanceId,
    )?.card
    if (supportCard) return supportCard
    const discardCard = player.discardPile.find(
      (card) => card.instanceId === instanceId,
    )
    if (discardCard) return discardCard
    const breakCard = player.breakArea.find(
      (card) => card.instanceId === instanceId,
    )
    if (breakCard) return breakCard
    if (player.stage?.card.instanceId === instanceId) return player.stage.card
  }
  return undefined
}

/**
 * 線上對戰版的技能/道具/場景卡效果解析。與本地 usePendingEffect 的差異:
 *
 * 1. 代價支付改成自動計算(比照既有 selectEnergyPayment/攻擊付款的自動選取
 *    邏輯,並非新規則),不提供手動選擇要用哪幾張支援卡付款的精靈 UI——
 *    線上模式沒有同步結果可以即時驗證每一步選擇是否合法,把「決定要不要
 *    發動」跟「怎麼付款」黏在一起會需要伺服器來回確認,MVP 階段先簡化掉。
 * 2. 效果目標選擇改成從 GameState.pendingAbilityEffect / pendingBattle
 *    (M0 已經是權威狀態)直接推導,而不是本地維護 effectIndex/suspendedEffect
 *    ——伺服器才是「現在是第幾個效果」的真相來源,中途暫停恢復也自然正確
 *    (該欄位在其他待處理決策清空前就是保持不變)。
 * 3. 目前只支援「一般目標選擇」（target: EffectTargetSelector 的效果，如
 *    damage/gain-hp/modify-attack/prevent-knockout/redirect-attack/
 *    view-hp/disable-block 等）；break-to-trash、support-to-trash/hand、
 *    trash-to-*、flip-to-support、field-to-trash、inspect-deck 等需要
 *    專屬候選清單的效果類型,目前會以空目標送出(已知的縮小範圍,留待後續
 *    里程碑補齊,不影響大多數技能/道具/場景卡的基本目標選擇)。
 */
export function useOnlinePendingEffect(params: {
  game: GameState
  viewerPlayerId: PlayerId
  dispatch: DispatchGameCommand
  hasFaint: boolean
  hasAfterDamage: boolean
  setInspectedHpPile?: (info: HpPileInfo) => void
}) {
  const { game, viewerPlayerId, dispatch, hasFaint, hasAfterDamage, setInspectedHpPile } = params
  const [effectHistory, setEffectHistory] = useState<string[]>([])
  const [abilityCostDraft, setAbilityCostDraft] =
    useState<AbilityCostDraft | null>(null)

  const pendingAbility = game.pendingAbilityEffect
  // 與本地端 usePendingEffect 的面板建立條件一致：補位／Refresh／OnPlay
  // 期間不顯示效果面板；攻擊者擊倒觸發的佇列（trigger: 'attacker-faint'，
  // 例如 BS4-011）還要等本次戰鬥收尾與對手補位完成後才能結算。
  const abilityActiveForViewer = Boolean(
    pendingAbility &&
      pendingAbility.playerId === viewerPlayerId &&
      // 兩階段選擇（cycle-hp BS4-030 / hand-to-hp BS4-044）第二階段等待
      // 放回手牌時，面板交給 PendingDecisionModals 的 place-hand-hp 提示。
      !pendingAbility.pendingPlace &&
      !game.pendingReplacement &&
      !game.pendingRefresh &&
      !game.pendingOnPlay &&
      !game.pendingBattle?.effectDamageSequence &&
      !(pendingAbility.trigger === 'attacker-faint' && game.pendingBattle),
  )

  const attackBattle = game.pendingBattle
  const attackEffectActive = Boolean(
    attackBattle?.stage === 'attack-effect' &&
      attackBattle.attackerPlayerId === viewerPlayerId,
  )

  const currentEffect = attackEffectActive
    ? (attackBattle!.attackEffects[attackBattle!.attackEffectIndex] ?? null)
    : abilityActiveForViewer
      ? (pendingAbility!.effects[pendingAbility!.effectIndex] ?? null)
      : null

  const context: EffectContext | null = attackEffectActive
    ? {
        sourcePlayerId: viewerPlayerId,
        sourceInstanceId: attackBattle!.attackerInstanceId,
      }
    : abilityActiveForViewer
      ? {
          sourcePlayerId: pendingAbility!.sourcePlayerId,
          sourceInstanceId: pendingAbility!.sourceInstanceId,
          sourceCardName: pendingAbility!.sourceCardName,
        }
      : null

  const draftSkill: CardSkill | null = abilityCostDraft
    ? abilityCostDraft.sourceKind === 'cookie'
      ? (abilityCostDraft.ability as CardSkill)
      : {
          trigger: 'activate',
          oncePerTurn: false,
          yourTurn: true,
          restSource: false,
          cost: abilityCostDraft.ability.cost,
          text: abilityCostDraft.ability.text,
          effects: abilityCostDraft.ability.effects,
        }
    : null
  const draftEffects = draftSkill
    ? expandChooseOneSequence(
        draftSkill.effects,
        abilityCostDraft?.chooseOneModes,
      )
    : []
  const draftEffect = draftEffects[0] ?? null
  const draftContext: EffectContext | null = abilityCostDraft
    ? {
        sourcePlayerId: viewerPlayerId,
        sourceInstanceId: abilityCostDraft.card.instanceId,
        sourceCardName: abilityCostDraft.card.name,
      }
    : null
  const displayedEffect = currentEffect ?? draftEffect
  const displayedContext = context ?? draftContext
  // Keep the composite setup effect as the command being resolved, while the
  // panel exposes its nested sequential damage so the player can order every
  // target before that setup is executed.
  const selectionEffect =
    getNestedSequentialDamageSelectionEffect(displayedEffect) ?? displayedEffect
  const effectKey = attackEffectActive
    ? `attack:${attackBattle?.attackerInstanceId}:${attackBattle?.attackEffectIndex}`
    : abilityActiveForViewer
      ? `ability:${pendingAbility?.sourceInstanceId}:${pendingAbility?.effectIndex}`
      : abilityCostDraft
        ? `draft:${abilityCostDraft.card.instanceId}:0`
        : 'none'
  const [selectedTargetState, setSelectedTargetState] = useState<{
    key: string
    ids: string[]
  }>({ key: effectKey, ids: [] })
  const selectedTargetIds =
    selectedTargetState.key === effectKey ? selectedTargetState.ids : []
  const displayedEffectConditionMet =
    displayedEffect && displayedContext
      ? isEffectConditionMet(game, displayedContext, displayedEffect)
      : true

  const currentTargetSelector = getTargetSelector(selectionEffect)
  const displayedSelectionLimits = selectionEffect
    ? getEffectSelectionLimits(selectionEffect)
    : null

  const displayedDescriptor =
    displayedEffect && displayedContext && !abilityCostDraft
      ? compileEffectDecisionDescriptor({
          state: game,
          playerId: viewerPlayerId,
          sourcePlayerId: displayedContext.sourcePlayerId,
          sourceInstanceId: displayedContext.sourceInstanceId,
          sourceCardName: displayedContext.sourceCardName,
          context: displayedContext,
          effect: selectionEffect ?? displayedEffect,
          commandKind: attackEffectActive
            ? 'resolve-attack-effect'
            : 'resolve-ability-effect',
          viewerPlayerId,
        })
      : null
  const descriptorTargetIds = new Set(
    displayedDescriptor?.steps
      .filter((step) => step.kind === 'target')
      .flatMap((step) => step.candidateIds) ?? [],
  )
  const descriptorControlsTargets = Boolean(
    displayedDescriptor?.steps.some((step) => step.kind === 'target'),
  )

  const restSupportAndDamageSupportCandidates =
    displayedEffect?.kind === 'rest-support-and-damage' && displayedContext
      ? getSupportEffectCandidates(game, displayedContext, {
          side: displayedEffect.supportSide,
          activeOnly: displayedEffect.activeOnly,
        })
          .filter(
            (support) =>
              (displayedEffect.supportEnergyColor === undefined ||
                support.card.energyColor ===
                  displayedEffect.supportEnergyColor) &&
              !(
                abilityCostDraft?.selectedPaymentIds.includes(
                  support.card.instanceId,
                ) ?? false
              ),
          )
          .map((support) => support.card)
      : []

  const restSupportAndDamageTargetCandidates =
    displayedEffect?.kind === 'rest-support-and-damage' && displayedContext
      ? getEffectTargetCandidates(
          game,
          displayedContext,
          displayedEffect.target,
        ).map((candidate) => candidate.card)
      : []

  const candidateCards: GameCard[] = displayedContext
    ? displayedEffect?.kind === 'rest-support-and-damage'
      ? [
          ...restSupportAndDamageSupportCandidates,
          ...restSupportAndDamageTargetCandidates,
        ]
      : currentTargetSelector
        ? getEffectTargetCandidates(game, displayedContext, currentTargetSelector)
          .filter((candidate) => {
            if (!descriptorControlsTargets) return true
            if (displayedDescriptor?.status === 'needs-review') return false
            return (
              descriptorTargetIds.size === 0 ||
              descriptorTargetIds.has(candidate.card.instanceId)
            )
          })
          .map((candidate) => candidate.card)
      : selectionEffect &&
          (selectionEffect.kind === 'support-to-battle' ||
            requiresEffectCardSelection(selectionEffect) ||
            selectionEffect.kind === 'trash-to-deck')
        ? getEffectSelectionCandidates(game, displayedContext, selectionEffect).filter(
            (card) =>
              !descriptorControlsTargets ||
              displayedDescriptor?.status !== 'needs-review' &&
              (descriptorTargetIds.size === 0 ||
                descriptorTargetIds.has(card.instanceId)),
          )
        : []
    : []
  const isEffectPending = Boolean(currentEffect)
  const draftDiscardHandCandidates = abilityCostDraft
    ? abilityCostDraft.ability.cost.discardAllHand
      ? getDiscardAllHandCostCandidates(
          abilityCostDraft.ability.cost,
          game.players[viewerPlayerId].hand,
          abilityCostDraft.card.instanceId,
        )
      : getDiscardHandCostCandidates(
          abilityCostDraft.ability.cost,
          game.players[viewerPlayerId].hand,
          abilityCostDraft.card.instanceId,
        )
    : []
  const draftDiscardHandCost = abilityCostDraft?.ability.cost.discardAllHand
    ? draftDiscardHandCandidates.length
    : abilityCostDraft?.ability.cost.discardHand ?? 0
  const draftDiscardHandSelectionLimit =
    abilityCostDraft?.ability.cost.discardAllHand ||
    abilityCostDraft?.ability.cost.discardHandAtLeast
      ? draftDiscardHandCandidates.length
      : draftDiscardHandCost
  const draftEnergyCost = abilityCostDraft
    ? (abilityCostDraft.ability.cost.energy ?? abilityCostDraft.ability.cost)
    : {}
  const draftEnergyTotal = getEnergyCostTotal(draftEnergyCost)
  const draftPaymentCandidates = abilityCostDraft
    ? game.players[viewerPlayerId].supportArea
        .filter(
          (support) =>
            !support.rested &&
            !selectedTargetIds.includes(support.card.instanceId),
        )
        .map((support) => support.card)
    : []
  const draftPaymentValid = abilityCostDraft
    ? validateEnergyPayment(
        draftEnergyCost,
        game.players[viewerPlayerId].supportArea,
        abilityCostDraft.selectedPaymentIds,
      ).valid
    : false
  const draftSupportAreaCost = abilityCostDraft
    ? (abilityCostDraft.ability.cost.supportToTrash ?? 0) +
      (abilityCostDraft.ability.cost.supportToHand ?? 0)
    : 0
  const draftCostSupportCandidates = abilityCostDraft
    ? game.players[viewerPlayerId].supportArea
        .filter(
          (support) =>
            !abilityCostDraft.selectedPaymentIds.includes(
              support.card.instanceId,
            ) &&
            (abilityCostDraft.selectedCostSupportToTrashIds.length <
              draftSupportAreaCost ||
              abilityCostDraft.selectedCostSupportToTrashIds.includes(
                support.card.instanceId,
              )),
        )
        .map((support) => support.card)
    : []
  const draftHpToTrashCost = abilityCostDraft?.ability.cost.hpToTrash ? 1 : 0
  const draftHpToTrashCandidates = abilityCostDraft
    ? getHpToTrashCostCandidates(
        abilityCostDraft.ability.cost,
        game.players[viewerPlayerId].battleArea,
        abilityCostDraft.card.instanceId,
      ).map((cookie) => cookie.card)
    : []
  const draftTrashBattleCookieCost =
    abilityCostDraft?.ability.cost.trashBattleCookie?.count ?? 0
  const draftTrashBattleCookieCandidates = abilityCostDraft
    ? getTrashBattleCookieCostCandidates(
        abilityCostDraft.ability.cost,
        game.players[viewerPlayerId].battleArea,
        abilityCostDraft.card.instanceId,
      ).map((cookie) => cookie.card)
    : []
  const draftBattleCookieToHandCost =
    abilityCostDraft?.ability.cost.battleCookieToHand?.count ?? 0
  const draftBattleCookieToHandCandidates = abilityCostDraft
    ? getBattleCookieToHandCostCandidates(
        abilityCostDraft.ability.cost,
        game.players[viewerPlayerId].battleArea,
        abilityCostDraft.card.instanceId,
      ).map((cookie) => cookie.card)
    : []

  const toggleDraftDiscardHand = (instanceId: string) => {
    setAbilityCostDraft((draft) => {
      if (!draft) return draft
      const selected = draft.selectedDiscardHandIds
      if (!draftDiscardHandCandidates.some((card) => card.instanceId === instanceId)) {
        return draft
      }
      if (selected.includes(instanceId)) {
        return {
          ...draft,
          selectedDiscardHandIds: selected.filter((id) => id !== instanceId),
        }
      }
      if (selected.length >= draftDiscardHandSelectionLimit) {
        return draft
      }
      return {
        ...draft,
        selectedDiscardHandIds: [...selected, instanceId],
      }
    })
  }

  const toggleDraftPayment = (instanceId: string) => {
    setAbilityCostDraft((draft) => {
      if (!draft) return draft
      const selected = draft.selectedPaymentIds
      if (
        draft.selectedCostSupportToTrashIds.includes(instanceId) ||
        selectedTargetIds.includes(instanceId)
      ) {
        return draft
      }
      if (selected.includes(instanceId)) {
        return { ...draft, selectedPaymentIds: selected.filter((id) => id !== instanceId) }
      }
      if (selected.length >= getEnergyCostTotal(draft.ability.cost.energy ?? draft.ability.cost)) {
        return draft
      }
      return { ...draft, selectedPaymentIds: [...selected, instanceId] }
    })
  }

  const toggleDraftCostSupport = (instanceId: string) => {
    setAbilityCostDraft((draft) => {
      if (!draft || draft.selectedPaymentIds.includes(instanceId)) return draft
      const max =
        (draft.ability.cost.supportToTrash ?? 0) +
        (draft.ability.cost.supportToHand ?? 0)
      const selected = draft.selectedCostSupportToTrashIds
      if (selected.includes(instanceId)) {
        return {
          ...draft,
          selectedCostSupportToTrashIds: selected.filter(
            (id) => id !== instanceId,
          ),
        }
      }
      if (selected.length >= max) return draft
      return {
        ...draft,
        selectedCostSupportToTrashIds: [...selected, instanceId],
      }
    })
  }

  const toggleDraftHpToTrash = (instanceId: string) => {
    setAbilityCostDraft((draft) => {
      if (!draft || !draft.ability.cost.hpToTrash) return draft
      const candidateIds = new Set(
        getHpToTrashCostCandidates(
          draft.ability.cost,
          game.players[viewerPlayerId].battleArea,
          draft.card.instanceId,
        ).map((cookie) => cookie.card.instanceId),
      )
      if (!candidateIds.has(instanceId)) return draft
      return {
        ...draft,
        selectedHpToTrashTargetIds:
          draft.selectedHpToTrashTargetIds.includes(instanceId) ? [] : [instanceId],
      }
    })
  }

  const toggleDraftTrashBattleCookie = (instanceId: string) => {
    setAbilityCostDraft((draft) => {
      if (!draft) return draft
      const selected = draft.selectedTrashBattleCookieIds
      if (selected.includes(instanceId)) {
        return {
          ...draft,
          selectedTrashBattleCookieIds: selected.filter((id) => id !== instanceId),
        }
      }
      if (selected.length >= (draft.ability.cost.trashBattleCookie?.count ?? 0)) {
        return draft
      }
      return { ...draft, selectedTrashBattleCookieIds: [...selected, instanceId] }
    })
  }

  const toggleDraftBattleCookieToHand = (instanceId: string) => {
    setAbilityCostDraft((draft) => {
      if (!draft || !draft.ability.cost.battleCookieToHand) return draft
      const candidateIds = new Set(
        getBattleCookieToHandCostCandidates(
          draft.ability.cost,
          game.players[viewerPlayerId].battleArea,
          draft.card.instanceId,
        ).map((cookie) => cookie.card.instanceId),
      )
      if (!candidateIds.has(instanceId)) return draft
      const selected = draft.selectedBattleToHandIds
      if (selected.includes(instanceId)) {
        return {
          ...draft,
          selectedBattleToHandIds: selected.filter((id) => id !== instanceId),
        }
      }
      if (selected.length >= draft.ability.cost.battleCookieToHand.count) {
        return draft
      }
      return {
        ...draft,
        selectedBattleToHandIds: [...selected, instanceId],
      }
    })
  }

  const submittedEffectKeyRef = useRef<string | null>(null)
  const autoSkippedAttackEffectKeyRef = useRef<string | null>(null)

  useEffect(() => {
    submittedEffectKeyRef.current = null
  }, [effectKey])

  useEffect(() => {
    if (
      !attackEffectActive ||
      !attackBattle ||
      !currentEffect ||
      game.pendingOptionalCostAttack
    ) {
      return
    }

    const attackContext: EffectContext = {
      sourcePlayerId: viewerPlayerId,
      sourceInstanceId: attackBattle.attackerInstanceId,
    }
    const hasApplicableEffect =
      currentEffect.kind === 'optional-cost-attack'
        ? currentEffect.effects.some(
            (effect) =>
              isEffectConditionMet(game, attackContext, effect) &&
              hasRequiredTargetsForEffect(game, attackContext, effect),
          )
        : isEffectConditionMet(game, attackContext, currentEffect) &&
          hasRequiredTargetsForEffect(game, attackContext, currentEffect)
    if (hasApplicableEffect || autoSkippedAttackEffectKeyRef.current === effectKey) {
      return
    }

    autoSkippedAttackEffectKeyRef.current = effectKey
    dispatch(
      {
        kind: 'resolve-attack-effect',
        playerId: viewerPlayerId,
        targetIds: [],
      },
      '已略過攻擊後續效果。',
    )
  }, [
    attackBattle,
    attackEffectActive,
    currentEffect,
    dispatch,
    effectKey,
    game,
    viewerPlayerId,
  ])

  const toggleTarget = (instanceId: string) => {
    if (displayedEffect?.kind === 'rest-support-and-damage') {
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

      setSelectedTargetState((currentState) => {
        const current =
          currentState.key === effectKey ? currentState.ids : []
        if (current.includes(instanceId)) {
          return {
            key: effectKey,
            ids: current.filter((id) => id !== instanceId),
          }
        }

        const groupCandidateIds = isSupport
          ? supportCandidateIds
          : targetCandidateIds
        const selectedInGroup = current.filter((id) =>
          groupCandidateIds.has(id),
        )
        const max = isSupport
          ? displayedEffect.supportAmount
          : displayedEffect.target.max
        if (selectedInGroup.length >= max) {
          return { key: effectKey, ids: current }
        }
        return { key: effectKey, ids: [...current, instanceId] }
      })
      return
    }

    const max = currentTargetSelector?.max ?? displayedSelectionLimits?.max ?? 1
    setSelectedTargetState((currentState) => {
      const current =
        currentState.key === effectKey ? currentState.ids : []
      if (current.includes(instanceId)) {
        return {
          key: effectKey,
          ids: current.filter((id) => id !== instanceId),
        }
      }
      if (max <= 1) return { key: effectKey, ids: [instanceId] }
      if (current.length >= max) return { key: effectKey, ids: current }
      return { key: effectKey, ids: [...current, instanceId] }
    })
  }

  const confirmEffect = () => {
    if (abilityCostDraft) {
      const cost = abilityCostDraft.ability.cost
      const sequentialAllTargets =
        selectionEffect?.kind === 'damage-all' && selectionEffect.sequential
      const targetMin = sequentialAllTargets
        ? candidateCards.length
        : (currentTargetSelector?.min ?? displayedSelectionLimits?.min ?? 0)
      const targetMax = sequentialAllTargets
        ? candidateCards.length
        : (currentTargetSelector?.max ?? displayedSelectionLimits?.max ?? 0)
      const requiresTargetSelection =
        currentTargetSelector !== null || displayedSelectionLimits !== null
      const restSupportAndDamageSelectionValid =
        displayedEffect?.kind !== 'rest-support-and-damage' ||
        (selectedTargetIds.filter((id) =>
          restSupportAndDamageSupportCandidates.some(
            (card) => card.instanceId === id,
          ),
        ).length <= displayedEffect.supportAmount &&
          selectedTargetIds.filter((id) =>
            restSupportAndDamageTargetCandidates.some(
              (card) => card.instanceId === id,
            ),
          ).length >= displayedEffect.target.min &&
          selectedTargetIds.filter((id) =>
            restSupportAndDamageTargetCandidates.some(
              (card) => card.instanceId === id,
            ),
          ).length <= displayedEffect.target.max)
      const discardHandRequired = cost.discardHand ?? 0
      const discardHandPaid = cost.discardAllHand
        ? abilityCostDraft.selectedDiscardHandIds.length ===
          draftDiscardHandCost
        : cost.discardHandAtLeast
          ? abilityCostDraft.selectedDiscardHandIds.length >= discardHandRequired
          : abilityCostDraft.selectedDiscardHandIds.length === discardHandRequired
      if (
        !draftPaymentValid ||
        abilityCostDraft.selectedCostSupportToTrashIds.length !==
          ((cost.supportToTrash ?? 0) + (cost.supportToHand ?? 0)) ||
        !discardHandPaid ||
        abilityCostDraft.selectedHpToTrashTargetIds.length !==
          (cost.hpToTrash ? 1 : 0) ||
        abilityCostDraft.selectedTrashBattleCookieIds.length !==
          (cost.trashBattleCookie?.count ?? 0) ||
        abilityCostDraft.selectedBattleToHandIds.length !==
          (cost.battleCookieToHand?.count ?? 0) ||
        !restSupportAndDamageSelectionValid ||
        (requiresTargetSelection &&
          (selectedTargetIds.length < targetMin ||
            selectedTargetIds.length > targetMax))
      ) {
        return
      }
      const sharedCost = {
        playerId: viewerPlayerId,
        paymentIds: abilityCostDraft.selectedPaymentIds,
        discardHandIds: abilityCostDraft.selectedDiscardHandIds,
        ...(cost.hpToTrash
          ? { hpToTrashTargetIds: abilityCostDraft.selectedHpToTrashTargetIds }
          : {}),
        trashBattleCookieIds: abilityCostDraft.selectedTrashBattleCookieIds,
        ...(cost.battleCookieToHand
          ? { battleToHandIds: abilityCostDraft.selectedBattleToHandIds }
          : {}),
        targetIds: selectedTargetIds,
        // 沒有「選擇一項」時就不要多送一個空陣列上線。
        ...(abilityCostDraft.chooseOneModes.length > 0
          ? { chooseOneModes: abilityCostDraft.chooseOneModes }
          : {}),
      }
      if (abilityCostDraft.sourceKind === 'cookie') {
        dispatch(
          {
            kind: 'begin-activate-skill',
            ...sharedCost,
            sourceInstanceId: abilityCostDraft.card.instanceId,
            trigger: abilityCostDraft.trigger,
            costSupportToTrashIds:
              abilityCostDraft.selectedCostSupportToTrashIds,
          },
          `${abilityCostDraft.card.name}已確認代價與效果目標。`,
        )
      } else if (abilityCostDraft.sourceKind === 'item') {
        dispatch(
          {
            kind: 'begin-play-item',
            ...sharedCost,
            instanceId: abilityCostDraft.card.instanceId,
            supportToTrashIds: abilityCostDraft.selectedCostSupportToTrashIds,
          },
          `${abilityCostDraft.card.name}已確認使用代價與效果目標。`,
        )
      } else {
        dispatch(
          {
            kind: 'begin-activate-stage',
            ...sharedCost,
            supportToTrashIds: abilityCostDraft.selectedCostSupportToTrashIds,
          },
          `${abilityCostDraft.card.name}已確認場景代價與效果目標。`,
        )
      }
      setAbilityCostDraft(null)
      return
    }
    if (!currentEffect || !context) return
    if (submittedEffectKeyRef.current === effectKey) return
    submittedEffectKeyRef.current = effectKey
    window.setTimeout(() => {
      if (submittedEffectKeyRef.current === effectKey) {
        submittedEffectKeyRef.current = null
      }
    }, 1500)
    if (
      setInspectedHpPile &&
      currentEffect?.kind === 'view-hp' &&
      selectedTargetIds.length === 1 &&
      currentTargetSelector
    ) {
      const target = getEffectTargetCandidates(
        game,
        context,
        currentTargetSelector,
      ).find((candidate) => candidate.card.instanceId === selectedTargetIds[0])
      if (target) {
        setInspectedHpPile({
          title: `${target.card.name}的 HP 卡`,
          cards: target.hpCards,
        })
      }
    }
    if (attackEffectActive) {
      dispatch(
        {
          kind: 'resolve-attack-effect',
          playerId: viewerPlayerId,
          targetIds: selectedTargetIds,
        },
        '已決定攻擊後續效果的目標。',
      )
    } else if (abilityActiveForViewer) {
      dispatch(
        {
          kind: 'resolve-ability-effect',
          playerId: viewerPlayerId,
          targetIds: selectedTargetIds,
        },
        '已決定效果目標。',
      )
    }
    setEffectHistory((history) => [
      `${context.sourceCardName ?? '效果'}已結算。`,
      ...history,
    ].slice(0, 4))
  }

  const skipOnPlay = (sourceInstanceId: string) => {
    setAbilityCostDraft(null)
    dispatch(
      { kind: 'skip-on-play', playerId: viewerPlayerId, sourceInstanceId },
      '未發動 OnPlay 技能。',
    )
  }

  const hasRequiredEffectTargets = (
    sourceInstanceId: string,
    effects: CardAbility['effects'],
  ) => {
    const effectContext: EffectContext = {
      sourcePlayerId: viewerPlayerId,
      sourceInstanceId,
    }
    return effects.every((effect) => {
      if (!isEffectConditionMet(game, effectContext, effect)) return true
      if (effect.kind === 'opponent-battle-to-trash') {
        return getEffectTargetCandidates(game, effectContext, {
          side: 'opponent',
          min: 1,
          max: 1,
          ...(effect.maxLevel !== undefined ? { maxLevel: effect.maxLevel } : {}),
          ...(effect.minLevel !== undefined ? { minLevel: effect.minLevel } : {}),
          ...(effect.remainingHp !== undefined
            ? { remainingHp: effect.remainingHp }
            : {}),
        }).length > 0
      }
      if (effect.kind === 'field-to-deck-bottom') {
        return hasRequiredTargetsForEffect(game, effectContext, effect)
      }
      if (!isEffectUntargeted(effect) && 'target' in effect && effect.target) {
        if ((effect.target.min ?? 0) === 0) return true
        const candidates = getEffectTargetCandidates(game, effectContext, effect.target)
        const hasStageTarget =
          effect.kind === 'field-to-trash' &&
          (effect.allowStage || effect.stageOnly) &&
          game.players[
            effect.target.side === 'self'
              ? viewerPlayerId
              : viewerPlayerId === 'player-one'
                ? 'player-two'
                : 'player-one'
          ].stage !== null
        return candidates.length + Number(hasStageTarget) >= effect.target.min
      }
      return true
    })
  }

  const requiresManualCostSelection = (ability: CardAbility | CardSkill) => {
    const cost = ability.cost
    return (
      getEnergyCostTotal(cost.energy ?? cost) > 0 ||
      (cost.supportToTrash ?? 0) > 0 ||
      (cost.supportToHand ?? 0) > 0 ||
      (cost.discardHand ?? 0) > 0 ||
      Boolean(cost.discardAllHand) ||
      Boolean(cost.discardHandAtLeast) ||
      Boolean(cost.hpToTrash) ||
      (cost.trashBattleCookie?.count ?? 0) > 0 ||
      (cost.battleCookieToHand?.count ?? 0) > 0
    )
  }

  const openAbilityCostDraft = (
    sourceKind: AbilityCostDraft['sourceKind'],
    card: GameCard,
    ability: CardAbility | CardSkill,
    trigger: AbilityCostDraft['trigger'],
  ) => {
    setAbilityCostDraft((draft) =>
      draft?.card.instanceId === card.instanceId
        ? draft
        : {
            sourceKind,
            card,
            ability,
            trigger,
            selectedPaymentIds: [],
            selectedCostSupportToTrashIds: [],
            selectedDiscardHandIds: [],
            selectedHpToTrashTargetIds: [],
            selectedTrashBattleCookieIds: [],
            selectedBattleToHandIds: [],
            chooseOneModes: [],
          },
    )
  }

  const beginCookieSkill = (
    card: GameCard,
    trigger: 'activate' | 'on-play',
  ) => {
    if (!card.skill || card.skill.trigger !== trigger) return
    if (!canActivateCookieSkill(game, viewerPlayerId, card.instanceId, trigger)) {
      if (trigger === 'on-play' && game.pendingOnPlay) {
        skipOnPlay(card.instanceId)
      }
      return
    }
    const cost = card.skill.cost
    if (!hasRequiredEffectTargets(card.instanceId, card.skill.effects)) {
      if (trigger === 'on-play' && game.pendingOnPlay) skipOnPlay(card.instanceId)
      return
    }
    if (trigger === 'on-play' || requiresManualCostSelection(card.skill)) {
      openAbilityCostDraft('cookie', card, card.skill, trigger)
      return
    }
    const paymentIds = selectEnergyPayment(
      cost.energy ?? cost,
      game.players[viewerPlayerId].supportArea,
    )
    if (!paymentIds) {
      return
    }
    dispatch(
      {
        kind: 'begin-activate-skill',
        playerId: viewerPlayerId,
        sourceInstanceId: card.instanceId,
        trigger,
        paymentIds,
        costSupportToTrashIds: autoPickSupportToTrash(
          game,
          viewerPlayerId,
          cost.supportToTrash,
          paymentIds,
        ),
        discardHandIds: autoPickDiscardHand(
          game,
          viewerPlayerId,
          cost.discardHand,
          cost.discardHandColor,
          card.instanceId,
        ),
        trashBattleCookieIds: autoPickTrashBattleCookie(game, viewerPlayerId, cost),
      },
      `${card.name}已發動技能。`,
    )
  }

  // 補位(refresh-deck/replace-cookie)完成後若觸發 OnPlay 技能,伺服器送來的
  // 下一份遮罩狀態會帶著 pendingOnPlay——用這個 effect 主動觸發技能精靈,
  // 取代本地版本仰賴 onSuccess 同步拿到 nextGame 的做法(線上沒有同步結果)。
  useEffect(() => {
    const historyTimer = !isEffectPending && effectHistory.length > 0
      ? window.setTimeout(() => setEffectHistory([]), 1000)
      : null
    const onPlay = game.pendingOnPlay
    const onPlayTimer =
      onPlay && onPlay.playerId === viewerPlayerId
        ? window.setTimeout(() => {
            const card = game.players[onPlay.playerId].battleArea.find(
              (cookie) => cookie.card.instanceId === onPlay.sourceInstanceId,
            )?.card
            if (card) beginCookieSkill(card, 'on-play')
          }, 0)
        : null
    return () => {
      if (historyTimer !== null) window.clearTimeout(historyTimer)
      if (onPlayTimer !== null) window.clearTimeout(onPlayTimer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectHistory, game.pendingOnPlay, isEffectPending])

  /** 本地版本仰賴同步拿到指令套用後的狀態才能檢查 OnPlay;線上模式已經有
   * 上面的 effect 主動處理,這裡維持相同呼叫介面但不需要做任何事。 */
  const handleOnPlayTrigger: (state: GameState) => void = () => {}

  const beginPlayItem = (card: GameCard) => {
    if (!card.item || !canPlayItem(game, viewerPlayerId, card.instanceId)) return
    const cost = card.item.cost
    if (!hasRequiredEffectTargets(card.instanceId, card.item.effects)) return
    if (requiresManualCostSelection(card.item)) {
      openAbilityCostDraft('item', card, card.item, 'activate')
      return
    }
    const paymentIds = selectEnergyPayment(
      cost.energy ?? cost,
      game.players[viewerPlayerId].supportArea,
    )
    if (!paymentIds) return
    dispatch(
      {
        kind: 'begin-play-item',
        playerId: viewerPlayerId,
        instanceId: card.instanceId,
        paymentIds,
        supportToTrashIds: autoPickSupportToTrash(
          game,
          viewerPlayerId,
          cost.supportToTrash,
          paymentIds,
        ),
        discardHandIds: autoPickDiscardHand(
          game,
          viewerPlayerId,
          cost.discardHand,
          cost.discardHandColor,
          card.instanceId,
        ),
      },
      `已使用${card.name}。`,
    )
  }

  const beginActivateStage = () => {
    const stage = game.players[viewerPlayerId].stage
    const ability = stage?.card.stageAbility
    if (!stage || !ability || !canActivateStage(game, viewerPlayerId)) return
    const cost = ability.cost
    if (!hasRequiredEffectTargets(stage.card.instanceId, ability.effects)) return
    if (requiresManualCostSelection(ability)) {
      openAbilityCostDraft('stage', stage.card, ability, 'activate')
      return
    }
    const paymentIds = selectEnergyPayment(
      cost.energy ?? cost,
      game.players[viewerPlayerId].supportArea,
    )
    if (!paymentIds) return
    dispatch(
      {
        kind: 'begin-activate-stage',
        playerId: viewerPlayerId,
        paymentIds,
        supportToTrashIds: autoPickSupportToTrash(
          game,
          viewerPlayerId,
          cost.supportToTrash,
          paymentIds,
        ),
        discardHandIds: autoPickDiscardHand(
          game,
          viewerPlayerId,
          cost.discardHand,
          cost.discardHandColor,
          undefined,
        ),
      },
      `${stage.card.name}已發動場景效果。`,
    )
  }

  /**
   * 建構與本地 usePendingEffect 相容的 PendingEffect 物件,讓 EffectPanel
   * 元件能原樣重用。因為代價已經在 begin-* 指令送出前自動付清(見上方
   * 檔案註解),這裡固定 skillActivated:true,EffectPanel 會自動跳過整個
   * 代價選擇 UI、直接顯示目標選擇畫面。
   */
  const pendingEffectView: PendingEffect | null =
    abilityCostDraft && draftEffect && draftContext && draftSkill
      ? {
          sourceCard: abilityCostDraft.card,
          context: draftContext,
          skill: draftSkill,
          trigger: abilityCostDraft.trigger,
          effects: expandChooseOneSequence(
            draftSkill.effects,
            abilityCostDraft.chooseOneModes,
          ),
          effectIndex: 0,
          selectedTargetIds,
          selectedPaymentIds: abilityCostDraft.selectedPaymentIds,
          selectedCostSupportToTrashIds:
            abilityCostDraft.selectedCostSupportToTrashIds,
          selectedDiscardHandIds: abilityCostDraft.selectedDiscardHandIds,
          selectedHpToTrashTargetIds:
            abilityCostDraft.selectedHpToTrashTargetIds,
          selectedTrashBattleCookieIds:
            abilityCostDraft.selectedTrashBattleCookieIds,
          selectedBattleToHandIds: abilityCostDraft.selectedBattleToHandIds,
          chooseOneModes: abilityCostDraft.chooseOneModes,
          skillActivated: false,
          optional: false,
          triggerLabel:
            abilityCostDraft.sourceKind === 'item'
              ? '使用物品'
              : abilityCostDraft.sourceKind === 'stage'
                ? '啟動場景'
                : abilityCostDraft.trigger === 'on-play'
                  ? 'OnPlay 登場觸發'
                  : 'Activate 主動發動',
          sourceKind: abilityCostDraft.sourceKind,
        }
      : currentEffect && context
      ? {
          sourceCard:
            findCardByInstanceId(game, context.sourceInstanceId) ?? {
              id: 'unknown',
              instanceId: context.sourceInstanceId,
              name: context.sourceCardName ?? '效果來源',
              type: 'item',
            },
          context,
          skill: attackEffectActive
            ? ({
                trigger: 'activate',
                oncePerTurn: false,
                yourTurn: true,
                restSource: false,
                cost: {},
                text: '',
                effects: attackBattle?.attackEffects ?? [],
              } satisfies CardSkill)
            : ({
                trigger:
                  pendingAbility?.trigger === 'on-play' ? 'on-play' : 'activate',
                oncePerTurn: false,
                yourTurn: true,
                restSource: false,
                cost: {},
                text: '',
                effects: pendingAbility?.effects ?? [],
              } satisfies CardSkill),
          trigger: attackEffectActive
            ? 'activate'
            : (pendingAbility?.trigger === 'on-play' ? 'on-play' : 'activate'),
          effects: attackEffectActive
            ? (attackBattle?.attackEffects ?? [])
            : (pendingAbility?.effects ?? []),
          effectIndex: attackEffectActive
            ? (attackBattle?.attackEffectIndex ?? 0)
            : (pendingAbility?.effectIndex ?? 0),
          selectedTargetIds,
          selectedPaymentIds: [],
          selectedCostSupportToTrashIds: [],
          selectedDiscardHandIds: [],
          selectedHpToTrashTargetIds: [],
          selectedTrashBattleCookieIds: [],
          selectedBattleToHandIds: [],
          skillActivated: true,
          optional: false,
          triggerLabel: attackEffectActive
            ? '攻擊後續效果'
            : pendingAbility?.sourceKind === 'item'
              ? '使用物品'
              : pendingAbility?.sourceKind === 'stage'
                ? '啟動場景'
                : pendingAbility?.trigger === 'on-play'
                  ? 'OnPlay 登場觸發'
                  : 'Activate 主動發動',
          sourceKind: attackEffectActive
            ? 'attack'
            : pendingAbility?.sourceKind === 'item'
              ? 'item'
              : pendingAbility?.sourceKind === 'stage'
                ? 'stage'
                : 'cookie',
        }
      : null

  /**
   * 「選擇一項」：代價草稿階段只記在本機，模式索引會隨 begin-* 指令送進規則層；
   * 能力已啟動時改送 `resolve-choose-one`，由伺服器端的
   * `pendingAbilityEffect` 展開後同步回來。
   */
  const chooseEffectMode = (modeIndex: number) => {
    if (displayedEffect?.kind !== 'choose-one') return
    if (abilityCostDraft) {
      setAbilityCostDraft({
        ...abilityCostDraft,
        chooseOneModes: [...abilityCostDraft.chooseOneModes, modeIndex],
      })
      return
    }
    dispatch(
      { kind: 'resolve-choose-one', playerId: viewerPlayerId, modeIndex },
      `已選擇「${displayedEffect.modes[modeIndex]?.label ?? ''}」。`,
    )
  }

  return {
    currentEffect: selectionEffect,
    effectConditionMet: displayedEffectConditionMet,
    candidateCards,
    restSupportAndDamageSupportCandidates,
    restSupportAndDamageTargetCandidates,
    selectedTargetIds,
    toggleTarget,
    chooseEffectMode,
    confirmEffect,
    beginCookieSkill,
    handleOnPlayTrigger,
    beginPlayItem,
    beginActivateStage,
    skipOnPlay,
    effectHistory,
    isEffectPending: isEffectPending || Boolean(abilityCostDraft),
    draftDiscardHandCost,
    draftDiscardHandCandidates,
    selectedDraftDiscardHandIds: new Set(
      abilityCostDraft?.selectedDiscardHandIds ?? [],
    ),
    toggleDraftDiscardHand,
    draftPaymentCandidates,
    selectedDraftPaymentIds: new Set(
      abilityCostDraft?.selectedPaymentIds ?? [],
    ),
    draftPaymentValid,
    draftEnergyTotal,
    toggleDraftPayment,
    draftCostSupportCandidates,
    selectedDraftCostSupportIds: new Set(
      abilityCostDraft?.selectedCostSupportToTrashIds ?? [],
    ),
    toggleDraftCostSupport,
    draftHpToTrashCandidates,
    selectedDraftHpToTrashTargetIds: new Set(
      abilityCostDraft?.selectedHpToTrashTargetIds ?? [],
    ),
    toggleDraftHpToTrash,
    draftHpToTrashCost,
    draftTrashBattleCookieCandidates,
    selectedDraftTrashBattleCookieIds: new Set(
      abilityCostDraft?.selectedTrashBattleCookieIds ?? [],
    ),
    draftTrashBattleCookieCost,
    toggleDraftTrashBattleCookie,
    draftBattleCookieToHandCandidates,
    selectedDraftBattleToHandIds: new Set(
      abilityCostDraft?.selectedBattleToHandIds ?? [],
    ),
    draftBattleCookieToHandCost,
    toggleDraftBattleCookieToHand,
    abilityCostDraft,
    cancelAbilityCostDraft: () => setAbilityCostDraft(null),
    // 與本地 usePendingEffect 對齊的欄位名,讓 EffectPanel/BattleResponseModals/
    // DamageEffectModals/PendingDecisionModals 能原樣重用。
    pendingEffect: pendingEffectView,
    faintActive:
      hasFaint &&
      !isEffectPending &&
      !game.pendingReplacement &&
      !game.pendingRefresh &&
      !game.pendingOnPlay,
    afterDamageActive:
      hasAfterDamage &&
      !isEffectPending &&
      !game.pendingReplacement &&
      !game.pendingRefresh &&
      !game.pendingOnPlay,
  } as const
}

const autoPickSupportToTrash = (
  game: GameState,
  playerId: PlayerId,
  count: number | undefined,
  excludeIds: string[],
): string[] => {
  if (!count) return []
  return game.players[playerId].supportArea
    .filter((support) => !excludeIds.includes(support.card.instanceId))
    .slice(0, count)
    .map((support) => support.card.instanceId)
}

const autoPickDiscardHand = (
  game: GameState,
  playerId: PlayerId,
  count: number | undefined,
  color: string | undefined,
  excludeInstanceId: string | undefined,
): string[] => {
  if (!count) return []
  return game.players[playerId].hand
    .filter(
      (card) =>
        card.instanceId !== excludeInstanceId &&
        (!color || card.energyColor === color),
    )
    .slice(0, count)
    .map((card) => card.instanceId)
}

const autoPickTrashBattleCookie = (
  game: GameState,
  playerId: PlayerId,
  cost: CardAbility['cost'],
): string[] => {
  const count = cost.trashBattleCookie?.count
  if (!count) return []
  return getTrashBattleCookieCostCandidates(
    cost,
    game.players[playerId].battleArea,
  )
    .slice(0, count)
    .map((cookie) => cookie.card.instanceId)
}
