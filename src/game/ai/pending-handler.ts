import {
  getAfterDamageEffectCandidates,
  getFaintEffectCardCandidates,
  getFaintEffectCandidates,
} from '../battle'
import {
  applyGameCommand,
  getPendingDecision,
  hasActiveEffectOrder,
} from '../commands'
import { getRemainingEnergyCost, selectEnergyPayment } from '../energy'
import {
  getEffectSelectionCandidates,
  getEffectSelectionLimits,
  getSupportEffectCandidates,
  requiresEffectCardSelection,
} from '../effects'
import { getRefreshCandidates } from '../refresh'
import {
  getDiscardHandCostCandidates,
  getHpToTrashCostCandidates,
  getTrashToDeckCostCandidates,
} from '../skills'
import { chooseAiEffectMode } from './choose-one-mode'
import { createPlayerView } from '../player-view'
import {
  createKnowledgeStateFromPlayerView,
  synchronizeKnowledgeWithPlayerView,
  type KnowledgeState,
} from './strategy/knowledge-state'
import { createPendingSelectionStrategy } from './strategy/pending-selection'
import { chooseSharedEffectTargets } from './shared-selection'
import type { EffectContext } from '../types'
import type { GameState, PlayerId } from '../types'
import type { AiDecision, AiLevel } from './types'

/**
 * 與 commands.ts 的 resolvePendingAbilityEffect 前置檢查一致。
 *
 * 不含 `pendingBattle`：BS3-076 這類「攻擊後可選代價 → reveal-top-deck →
 * 巢狀 damage(attackTargetOnly)」的效果，規則層會刻意保留 `pendingBattle`
 * 讓 attackTargetOnly 找得到攻擊目標；列進來的話 AI 會判定自己不能結算
 * pendingAbilityEffect，整個 AI 迴圈就卡在攻擊後階段。
 *
 * 例外：攻擊者擊倒觸發的佇列（trigger: 'attacker-faint'，例如 BS4-011）依
 * 規則必須等本次戰鬥收尾與對手的空場補位完成後才能結算，AI 在 pendingBattle
 * 期間不得嘗試結算（規則層會拒絕）。
 */
const hasBlockingAbilityPending = (state: GameState): boolean =>
  Boolean(
    state.pendingRefresh ||
      state.pendingOnPlay ||
      state.pendingReplacement ||
      hasActiveEffectOrder(state) ||
      (state.pendingFaintEffects && state.pendingFaintEffects.length > 0) ||
      (state.pendingAfterDamageEffects &&
        state.pendingAfterDamageEffects.length > 0) ||
      state.pendingOpponentHandDiscard ||
      state.pendingOpponentRestSupport ||
      state.pendingInspectDeck ||
      state.pendingRevealTopDeck ||
      state.pendingOptionalCostAttack ||
      state.pendingDrawUpTo ||
      state.pendingStageTrigger ||
      // 效果傷害序列由既有的 battle/FLIP handler 逐點結算；
      // 不能在中途搶先執行同一條 pendingAbilityEffect。
      state.pendingBattle?.effectDamageSequence ||
      // cycle-hp（BS4-030）第二階段等待放回手牌時，不能重跑第一階段。
      state.pendingAbilityEffect?.pendingPlace ||
      state.pendingAbilityEffect?.pendingReorderHp ||
      (state.pendingBattle &&
        state.pendingAbilityEffect?.trigger === 'attacker-faint'),
  )

export interface AiPendingDecisionOptions {
  level?: AiLevel
  knowledgeState?: KnowledgeState
}

export const handleAiPendingDecision = (
  state: GameState,
  playerId: PlayerId,
  options: AiPendingDecisionOptions = {},
): AiDecision | null => {
  const pendingDecision = getPendingDecision(state)
  const view = createPlayerView(state, playerId)
  const knowledgeState = options.knowledgeState?.observerId === playerId
    ? synchronizeKnowledgeWithPlayerView(options.knowledgeState, view)
    : createKnowledgeStateFromPlayerView(view)
  const universal = createPendingSelectionStrategy(
    view,
    knowledgeState,
    options.level,
  )
  const withPendingReason = (
    decision: AiDecision,
    kind: Parameters<typeof universal.telemetry>[0],
    sourceInstanceId?: string,
    effect?: import('../types').CardEffect,
  ): AiDecision => universal.enabled
    ? {
        ...decision,
        reason: {
          ...(decision.reason ?? { level: options.level ?? 2 }),
          pendingStrategy: universal.telemetry(kind, sourceInstanceId, effect),
        },
      }
    : decision

  // 陷阱的延遲效果會留下 pendingAbilityEffect（BS3-046 的休息區登場）。
  // 技能／物品走的是批次的 activate-skill／play-item，只有這條路徑會讓 AI
  // 面對逐步的效果佇列，沒有處理的話 AI 迴圈會卡住。
  const pendingAbility = state.pendingAbilityEffect
  if (pendingAbility && !hasBlockingAbilityPending(state)) {
    if (pendingAbility.playerId !== playerId) {
      return {
        state,
        action: 'idle',
        description: `等待 ${state.players[pendingAbility.playerId].name} 處理卡牌效果。`,
      }
    }
    const effect = pendingAbility.effects[pendingAbility.effectIndex]
    const context: EffectContext = {
      sourcePlayerId: pendingAbility.sourcePlayerId,
      sourceInstanceId: pendingAbility.sourceInstanceId,
      sourceCardName: pendingAbility.sourceCardName,
    }
    if (effect.kind === 'choose-one') {
      return withPendingReason({
        state: applyGameCommand(state, {
          kind: 'resolve-choose-one',
          playerId,
          modeIndex: chooseAiEffectMode(
            state,
            context,
            effect,
            universal.enabled
              ? universal.preferredModeIndices(effect, pendingAbility.sourceInstanceId)
              : [],
          ),
        }),
        action: 'idle',
        description: `${state.players[playerId].name}選擇${pendingAbility.sourceCardName ?? '卡牌'}的一項效果。`,
      }, 'choose-one', pendingAbility.sourceInstanceId, effect)
    }
    if (effect.kind === 'reorder-hp') {
      // G2 禁止 AI 讀取未翻開 HP 身分，因此不能組出 orderedCardIds。
      // BS6-034 的目標是「最多 1」；以空目標宣告略過是既有規則層接受的
      // 合法 command，保留玩家可重排的流程但不讓 AI 偷看 HP 卡面。
      return withPendingReason({
        state: applyGameCommand(state, {
          kind: 'resolve-ability-effect',
          playerId,
          targetIds: [],
        }),
        action: 'idle',
        description: `${state.players[playerId].name}略過未翻開 HP 的重排效果。`,
      }, 'multi-stage', pendingAbility.sourceInstanceId, effect)
    }
    const candidates = requiresEffectCardSelection(effect)
      ? getEffectSelectionCandidates(state, context, effect)
          .map((card) => card.instanceId)
      : []
    const targetIds = universal.enabled
      ? universal.selectEffectTargetIds(
          effect,
          candidates,
          getEffectSelectionLimits(effect)?.max ?? 0,
        )
      : candidates.slice(0, getEffectSelectionLimits(effect)?.max ?? 0)
    return withPendingReason({
      state: applyGameCommand(state, {
        kind: 'resolve-ability-effect',
        playerId,
        targetIds,
      }),
      action: 'idle',
      description: `${state.players[playerId].name}結算${pendingAbility.sourceCardName ?? '卡牌'}的效果。`,
    }, 'effect-target', pendingAbility.sourceInstanceId, effect)
  }

  if (
    state.pendingReplacement &&
    (
      pendingDecision?.kind === 'faint-effect' ||
      pendingDecision?.kind === 'effect-order'
    )
  ) {
    return null
  }

  if (pendingDecision?.kind === 'effect-order') {
    if (pendingDecision.playerId !== playerId) {
      return {
        state,
        action: 'idle',
        description: `等待 ${state.players[pendingDecision.playerId].name} 決定同時觸發效果順序。`,
      }
    }

    const orderedIds = universal.enabled
      ? universal.orderEffectIds(pendingDecision.items)
      : pendingDecision.items
      .slice()
      .sort((left, right) => {
        const priority = {
          'draw-up-to': 0,
          'inspect-deck': 1,
          'reveal-top-deck': 2,
          'faint-effect': 3,
          'after-damage-effect': 4,
          'stage-trigger': 5,
        } as const
        return priority[left.kind] - priority[right.kind]
      })
      .map((item) => item.id)

    return withPendingReason({
      state: applyGameCommand(state, {
        kind: 'resolve-effect-order',
        playerId,
        orderedIds,
      }),
      action: 'resolve-effect-order',
      description: `${state.players[playerId].name}決定同時觸發效果順序。`,
    }, 'effect-order', pendingDecision.sourceInstanceId)
  }

  if (
    pendingDecision?.kind === 'faint-effect' &&
    !state.pendingReplacement &&
    !state.pendingRefresh &&
    !state.pendingOnPlay
  ) {
    if (pendingDecision.playerId !== playerId) {
      return {
        state,
        action: 'idle',
        description: `等待 ${state.players[pendingDecision.playerId].name} 選擇昏厥效果目標。`,
      }
    }
    const cardCandidates = getFaintEffectCardCandidates(state)
    const candidates = getFaintEffectCandidates(state)
    const ordered = [...candidates].sort(
      (left, right) => left.hpCards.length - right.hpCards.length,
    )
    const orderedCards = [...cardCandidates].sort((left, right) =>
      left.name.localeCompare(right.name),
    )
    const faintEffect = state.pendingFaintEffects?.[0]?.effect
    const faintEnergyCost =
      faintEffect?.kind === 'hand-to-battle'
        ? faintEffect.energyCost
        : undefined
    const pendingFaint = state.pendingFaintEffects?.[0]
    const faintTriggeredCost = pendingFaint?.cost
    const faintCostHandCandidates = faintTriggeredCost
      ? getDiscardHandCostCandidates(
          faintTriggeredCost,
          state.players[playerId].hand,
          pendingFaint.sourceInstanceId,
        )
      : []
    const faintCostSupportCandidates = faintTriggeredCost
      ? getSupportEffectCandidates(state, pendingFaint.context)
      : []
    const faintPaymentSupports = universal.enabled
      ? universal.orderPaymentIds(
          state.players[playerId].supportArea.map((support) => support.card.instanceId),
        ).map((instanceId) => state.players[playerId].supportArea.find(
          (support) => support.card.instanceId === instanceId,
        )!)
      : state.players[playerId].supportArea
    const selectedPaymentIds = faintEnergyCost
      ? selectEnergyPayment(faintEnergyCost, faintPaymentSupports)
      : []
    // 同一張支援卡不能同時支付能量又作為送棄牌區代價；先由規則層付款
    // 選擇排除已選能量，再交給通用選擇器決定剩餘合法成本。
    const faintSupportToTrashCandidates = faintCostSupportCandidates.filter(
      (support) => !selectedPaymentIds?.includes(support.card.instanceId),
    )
    const canPayTriggeredCost =
      !faintTriggeredCost ||
      (faintCostHandCandidates.length >= (faintTriggeredCost.discardHand ?? 0) &&
        faintSupportToTrashCandidates.length >=
          (faintTriggeredCost.supportToTrash ?? 0))
    const canPayFaintCost = selectedPaymentIds !== null
    const shouldPayFaintCost =
      Boolean(faintEnergyCost) && cardCandidates.length > 0 && canPayFaintCost
    const shouldPayTriggeredCost = Boolean(faintTriggeredCost) && canPayTriggeredCost
    const faintDiscardHandIds = universal.enabled
      ? universal.orderCostIds(
          faintCostHandCandidates.map((card) => card.instanceId),
          faintTriggeredCost?.discardHand ?? 0,
        )
      : faintCostHandCandidates
          .slice(0, faintTriggeredCost?.discardHand ?? 0)
          .map((card) => card.instanceId)
    const faintSupportToTrashIds = universal.enabled
      ? universal.orderCostIds(
          faintSupportToTrashCandidates.map((support) => support.card.instanceId),
          faintTriggeredCost?.supportToTrash ?? 0,
        )
      : faintSupportToTrashCandidates
          .slice(0, faintTriggeredCost?.supportToTrash ?? 0)
          .map((support) => support.card.instanceId)
    const legalTargetIds =
      canPayTriggeredCost &&
      cardCandidates.length > 0 && (!faintEnergyCost || shouldPayFaintCost)
        ? orderedCards
            .map((card) => card.instanceId)
        : candidates.length >= pendingDecision.min
          ? ordered
              .map((cookie) => cookie.card.instanceId)
          : []
    const fallbackTargetIds = legalTargetIds.slice(0, pendingDecision.max)
    const targetIds = universal.enabled && faintEffect
      ? universal.selectEffectTargetIds(
          faintEffect,
          legalTargetIds,
          pendingDecision.max,
        )
      : fallbackTargetIds
    return withPendingReason({
      state: applyGameCommand(state, {
        kind: 'resolve-faint-effect',
        playerId,
        targetIds,
        ...(shouldPayFaintCost
          ? { paymentIds: selectedPaymentIds ?? [] }
          : {}),
        ...(shouldPayTriggeredCost
          ? {
              discardHandIds: faintDiscardHandIds,
              supportToTrashIds: faintSupportToTrashIds,
            }
          : {}),
      }),
      action: 'resolve-faint',
      description:
        targetIds.length > 0
          ? `${state.players[playerId].name}發動對${ordered[0]?.card.name ?? orderedCards[0]?.name ?? '目標'}的昏厥效果。`
          : `${state.players[playerId].name}略過昏厥效果。`,
    }, 'effect-target', pendingDecision.sourceInstanceId, faintEffect)
  }

  if (
    pendingDecision?.kind === 'after-damage-effect' &&
    !state.pendingRefresh &&
    !state.pendingOnPlay
  ) {
    if (pendingDecision.playerId !== playerId) {
      return {
        state,
        action: 'idle',
        description: `等待 ${state.players[pendingDecision.playerId].name} 選擇受傷後效果目標。`,
      }
    }
    const candidates = getAfterDamageEffectCandidates(state)
    const ordered = [...candidates].sort(
      (left, right) => left.hpCards.length - right.hpCards.length,
    )
    const legalTargetIds =
      candidates.length >= pendingDecision.min
        ? ordered
            .map((cookie) => cookie.card.instanceId)
        : []
    const fallbackTargetIds = legalTargetIds.slice(0, pendingDecision.max)
    const afterDamageEffect = state.pendingAfterDamageEffects?.[0]?.effect
    const targetIds = universal.enabled && afterDamageEffect
      ? universal.selectEffectTargetIds(
          afterDamageEffect,
          legalTargetIds,
          pendingDecision.max,
        )
      : fallbackTargetIds
    return withPendingReason({
      state: applyGameCommand(state, {
        kind: 'resolve-after-damage-effect',
        playerId,
        targetIds,
      }),
      action: 'resolve-after-damage',
      description:
        targetIds.length > 0
          ? `${state.players[playerId].name}發動對${ordered[0].card.name}的受傷後效果。`
          : `${state.players[playerId].name}略過受傷後效果。`,
    }, 'effect-target', pendingDecision.sourceInstanceId, afterDamageEffect)
  }

  if (
    pendingDecision?.kind === 'place-hand-hp' &&
    !state.pendingRefresh
  ) {
    if (pendingDecision.playerId !== playerId) {
      return {
        state,
        action: 'idle',
        description: `等待 ${state.players[pendingDecision.playerId].name} 選擇放回 HP 的手牌。`,
      }
    }
    const handCards = state.players[playerId].hand
    const handCard = universal.enabled
      ? handCards.find((card) =>
          universal.orderCostIds(handCards.map((candidate) => candidate.instanceId), 1)
            .includes(card.instanceId),
        )
      : handCards[0]
    return withPendingReason({
      state: applyGameCommand(state, {
        kind: 'resolve-place-hand-hp',
        playerId,
        handCardInstanceId: handCard?.instanceId,
      }),
      action: 'idle',
      description: handCard
        ? `${state.players[playerId].name}將 1 張手牌放回目標餅乾的 HP。`
        : `${state.players[playerId].name}略過放置 HP。`,
    }, 'multi-stage', pendingDecision.sourceInstanceId)
  }

  if (
    pendingDecision?.kind === 'opponent-hand-discard' &&
    !state.pendingRefresh
  ) {
    if (pendingDecision.playerId !== playerId) {
      return {
        state,
        action: 'idle',
        description: `等待 ${state.players[pendingDecision.playerId].name} 選擇棄置手牌。`,
      }
    }
    const hand = state.players[playerId].hand
    const discardedCards = universal.enabled
      ? universal.orderCostIds(
          hand.map((card) => card.instanceId),
          pendingDecision.count,
        ).map((instanceId) => hand.find((card) => card.instanceId === instanceId)!)
      : hand.slice(0, pendingDecision.count)
    const discardIds = discardedCards.map((card) => card.instanceId)
    return withPendingReason({
      state: applyGameCommand(state, {
        kind: 'resolve-opponent-hand-discard',
        playerId,
        cardIds: discardIds,
      }),
      action: 'idle',
      revealedCards: discardedCards,
      description: `${state.players[playerId].name}棄置 ${pendingDecision.count} 張手牌。`,
    }, 'discard', pendingDecision.sourceInstanceId)
  }

  if (
    pendingDecision?.kind === 'opponent-rest-support' &&
    !state.pendingRefresh
  ) {
    if (pendingDecision.playerId !== playerId) {
      return {
        state,
        action: 'idle',
        description: `等待 ${state.players[pendingDecision.playerId].name} 選擇橫置支援卡。`,
      }
    }
    const candidates = state.players[playerId].supportArea
      .filter((support) => !pendingDecision.activeOnly || !support.rested)
    const candidateIds = candidates.map((support) => support.card.instanceId)
    const selectedIds = universal.enabled
      ? universal.orderCostIds(candidateIds, pendingDecision.count)
      : candidateIds.slice(0, pendingDecision.count)
    return withPendingReason({
      state: applyGameCommand(state, {
        kind: 'resolve-opponent-rest-support',
        playerId,
        cardIds: selectedIds,
      }),
      action: 'idle',
      description: `${state.players[playerId].name}橫置 ${pendingDecision.count} 張支援卡。`,
    }, 'effect-target', pendingDecision.sourceInstanceId)
  }

  if (pendingDecision?.kind === 'inspect-deck' && !state.pendingRefresh) {
    if (pendingDecision.playerId !== playerId) {
      return {
        state,
        action: 'idle',
        description: `等待 ${state.players[pendingDecision.playerId].name} 處理牌庫檢視。`,
      }
    }
    const allIds = pendingDecision.revealedCardIds
    const revealed = state.pendingInspectDeck?.revealedCards ?? []
    const hasFilter =
      pendingDecision.filterColor !== undefined ||
      pendingDecision.filterType !== undefined
    // pickCount 為 0 的檢視（例如只重排牌庫頂）不選任何一張。
    const candidateCards = hasFilter
      ? revealed.filter(
          (card) =>
            (pendingDecision.filterColor === undefined ||
              card.energyColor === pendingDecision.filterColor) &&
            (pendingDecision.filterType === undefined ||
              card.type === pendingDecision.filterType),
        )
      : revealed
    const candidateIds = candidateCards.map((card) => card.instanceId)
    const pickedIds: string[] =
      pendingDecision.pickCount === 0
        ? []
        : universal.enabled
          ? universal.selectRevealedCardIds(
              revealed,
              candidateIds,
              pendingDecision.pickCount,
            )
          : candidateIds.slice(0, pendingDecision.pickCount)
    const pickedSet = new Set(pickedIds)
    const restIds = allIds.filter((id) => !pickedSet.has(id))
    return withPendingReason({
      state: applyGameCommand(state, {
        kind: 'resolve-inspect-deck',
        playerId,
        pickedCardIds: pickedIds,
        restOrder: restIds,
      }),
      action: 'resolve-inspect-deck',
      description: `${state.players[playerId].name}從檢視牌中選取卡片。`,
    }, 'multi-stage', pendingDecision.sourceInstanceId)
  }

  if (pendingDecision?.kind === 'reveal-top-deck') {
    if (pendingDecision.playerId !== playerId) {
      return {
        state,
        action: 'idle',
        description: `等待 ${state.players[pendingDecision.playerId].name} 確認翻牌展示。`,
      }
    }
    return withPendingReason({
      state: applyGameCommand(state, {
        kind: 'resolve-reveal-top-deck',
        playerId,
      }),
      action: 'resolve-reveal-top-deck',
      description: `${state.players[playerId].name}確認翻牌展示結果。`,
    }, 'multi-stage', pendingDecision.sourceInstanceId)
  }

  if (
    pendingDecision?.kind === 'optional-cost-attack' &&
    !state.pendingRefresh
  ) {
    if (pendingDecision.playerId !== playerId) {
      return {
        state,
        action: 'idle',
        description: `等待 ${state.players[pendingDecision.playerId].name} 決定是否支付代價。`,
      }
    }
    const hand = state.players[playerId].hand
    const effectiveEnergyCost = getRemainingEnergyCost(
      pendingDecision.cost.energy ?? pendingDecision.cost,
      pendingDecision.sourceEnergy,
    )
    const supports = state.players[playerId].supportArea
    const orderedSupports = universal.enabled
      ? universal.orderPaymentIds(supports.map((support) => support.card.instanceId))
          .map((instanceId) => supports.find(
            (support) => support.card.instanceId === instanceId,
          )!)
      : supports
    const paymentIds = selectEnergyPayment(effectiveEnergyCost, orderedSupports)
    const supportToHandAmount = pendingDecision.cost.supportToHand ?? 0
    const supportToHandCandidateIds = state.players[playerId].supportArea
      .filter(
        (support) =>
          !paymentIds?.includes(support.card.instanceId) &&
          (pendingDecision.cost.supportToHandType === undefined ||
            support.card.type === pendingDecision.cost.supportToHandType),
      )
      .map((support) => support.card.instanceId)
    const supportToHandIds = universal.enabled
      ? universal.orderCostIds(supportToHandCandidateIds, supportToHandAmount)
      : supportToHandCandidateIds.slice(0, supportToHandAmount)
    const canPay =
      hand.length >= (pendingDecision.cost.discardHand ?? 0) &&
      Boolean(paymentIds) &&
      supportToHandIds.length >= supportToHandAmount
    const hpToTrashCandidateIds = pendingDecision.cost.hpToTrash
      ? getHpToTrashCostCandidates(
          pendingDecision.cost,
          state.players[playerId].battleArea,
          pendingDecision.sourceInstanceId,
        )
          .map((cookie) => cookie.card.instanceId)
      : []
    const hpToTrashIds = universal.enabled
      ? universal.orderCostIds(hpToTrashCandidateIds, 1)
      : hpToTrashCandidateIds.slice(0, 1)
    const canPayHpToTrash = pendingDecision.cost.hpToTrash
      ? hpToTrashIds.length === 1
      : true
    const trashToDeckCandidateIds = pendingDecision.cost.trashToDeck
      ? getTrashToDeckCostCandidates(
          pendingDecision.cost,
          state.players[playerId].discardPile,
        )
          .map((card) => card.instanceId)
      : []
    const trashToDeckIds = pendingDecision.cost.trashToDeck
      ? universal.enabled
        ? universal.orderCostIds(
            trashToDeckCandidateIds,
            pendingDecision.cost.trashToDeck.count,
          )
        : trashToDeckCandidateIds.slice(0, pendingDecision.cost.trashToDeck.count)
      : []
    const canPayTrashToDeck = pendingDecision.cost.trashToDeck
      ? trashToDeckIds.length === pendingDecision.cost.trashToDeck.count
      : true
    const context: EffectContext = {
      sourcePlayerId: playerId,
      sourceInstanceId: pendingDecision.sourceInstanceId,
    }
    const sharedSelection = chooseSharedEffectTargets(
      state,
      context,
      pendingDecision.effects,
      universal,
    )
    const targetIds = sharedSelection.targetIds ?? []
    const hasTarget = sharedSelection.valid
    const targetedEffect = pendingDecision.effects.find((effect) =>
      requiresEffectCardSelection(effect),
    )
    if (canPay && canPayHpToTrash && canPayTrashToDeck && hasTarget) {
      const discardCardIds = universal.enabled
        ? universal.orderCostIds(
            hand.map((card) => card.instanceId),
            pendingDecision.cost.discardHand ?? 0,
          )
        : hand
            .slice(0, pendingDecision.cost.discardHand ?? 0)
            .map((card) => card.instanceId)
      return withPendingReason({
        state: applyGameCommand(state, {
          kind: 'resolve-optional-cost-attack',
          playerId,
          action: 'pay',
          discardCardIds,
          targetIds,
          paymentIds: paymentIds ?? [],
          supportToHandIds,
          hpToTrashIds,
          trashToDeckIds,
        }),
        action: 'resolve-optional-cost-attack',
        description: `${state.players[playerId].name}支付攻擊後續效果代價。`,
      }, 'payment', pendingDecision.sourceInstanceId, targetedEffect)
    }
    return withPendingReason({
      state: applyGameCommand(state, {
        kind: 'resolve-optional-cost-attack',
        playerId,
        action: 'skip',
      }),
      action: 'resolve-optional-cost-attack',
      description: `${state.players[playerId].name}略過攻擊後續可選代價效果。`,
    }, 'payment', pendingDecision.sourceInstanceId, targetedEffect)
  }

  if (
    pendingDecision?.kind === 'draw-up-to' &&
    !state.pendingRefresh
  ) {
    if (pendingDecision.playerId !== playerId) {
      return {
        state,
        action: 'idle',
        description: `等待 ${state.players[pendingDecision.playerId].name} 選擇抽牌數量。`,
      }
    }
    const player = state.players[playerId]
    const drawCount = Math.min(pendingDecision.max, player.deck.length)
    return withPendingReason({
      state: applyGameCommand(state, {
        kind: 'resolve-draw-up-to',
        playerId,
        drawCount,
      }),
      action: 'idle',
      description: `${state.players[playerId].name}從牌庫抽取 ${drawCount} 張牌。`,
    }, 'multi-stage', pendingDecision.sourceInstanceId)
  }

  if (
    pendingDecision?.kind === 'stage-trigger' &&
    !state.pendingRefresh
  ) {
    if (pendingDecision.playerId !== playerId) {
      return {
        state,
        action: 'idle',
        description: `等待 ${state.players[pendingDecision.playerId].name} 決定是否發動場景效果。`,
      }
    }
    const player = state.players[playerId]
    const canDraw =
      player.deck.length > 0 || getRefreshCandidates(state, playerId).length > 0
    return withPendingReason({
      state: applyGameCommand(state, {
        kind: 'resolve-stage-trigger',
        playerId,
        action: canDraw ? 'activate' : 'skip',
      }),
      action: 'resolve-stage-trigger',
      description: canDraw
        ? `${state.players[playerId].name}發動${pendingDecision.sourceCardName}效果抽 1 張牌。`
        : `${state.players[playerId].name}略過${pendingDecision.sourceCardName}效果。`,
    }, 'multi-stage', pendingDecision.sourceInstanceId)
  }

  return null
}
