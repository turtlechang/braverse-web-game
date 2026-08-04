import {
  getAfterDamageEffectCandidates,
  getFaintEffectCardCandidates,
  getFaintEffectCandidates,
} from '../battle'
import { applyGameCommand, getPendingDecision } from '../commands'
import { getRemainingEnergyCost, selectEnergyPayment } from '../energy'
import {
  getEffectSelectionCandidates,
  getEffectSelectionLimits,
  requiresEffectCardSelection,
} from '../effects'
import { getRefreshCandidates } from '../refresh'
import type { EffectContext } from '../types'
import type { GameState, PlayerId } from '../types'
import type { AiDecision } from './types'

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
      // cycle-hp（BS4-030）第二階段等待放回手牌時，不能重跑第一階段。
      state.pendingAbilityEffect?.pendingPlace ||
      (state.pendingBattle &&
        state.pendingAbilityEffect?.trigger === 'attacker-faint'),
  )

export const handleAiPendingDecision = (
  state: GameState,
  playerId: PlayerId,
): AiDecision | null => {
  const pendingDecision = getPendingDecision(state)

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
    const targetIds = requiresEffectCardSelection(effect)
      ? getEffectSelectionCandidates(state, context, effect)
          .slice(0, getEffectSelectionLimits(effect)?.max ?? 0)
          .map((card) => card.instanceId)
      : []
    return {
      state: applyGameCommand(state, {
        kind: 'resolve-ability-effect',
        playerId,
        targetIds,
      }),
      action: 'idle',
      description: `${state.players[playerId].name}結算${pendingAbility.sourceCardName ?? '卡牌'}的效果。`,
    }
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

    const orderedIds = pendingDecision.items
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

    return {
      state: applyGameCommand(state, {
        kind: 'resolve-effect-order',
        playerId,
        orderedIds,
      }),
      action: 'resolve-effect-order',
      description: `${state.players[playerId].name}決定同時觸發效果順序。`,
    }
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
    const selectedPaymentIds = faintEnergyCost
      ? selectEnergyPayment(
          faintEnergyCost,
          state.players[playerId].supportArea,
        )
      : []
    const canPayFaintCost = selectedPaymentIds !== null
    const shouldPayFaintCost =
      Boolean(faintEnergyCost) && cardCandidates.length > 0 && canPayFaintCost
    const targetIds =
      cardCandidates.length > 0 && (!faintEnergyCost || shouldPayFaintCost)
        ? orderedCards
            .slice(0, pendingDecision.max)
            .map((card) => card.instanceId)
        : candidates.length >= pendingDecision.min
          ? ordered
              .slice(0, pendingDecision.max)
              .map((cookie) => cookie.card.instanceId)
          : []
    return {
      state: applyGameCommand(state, {
        kind: 'resolve-faint-effect',
        playerId,
        targetIds,
        ...(shouldPayFaintCost
          ? { paymentIds: selectedPaymentIds ?? [] }
          : {}),
      }),
      action: 'resolve-faint',
      description:
        targetIds.length > 0
          ? `${state.players[playerId].name}發動對${ordered[0]?.card.name ?? orderedCards[0]?.name ?? '目標'}的昏厥效果。`
          : `${state.players[playerId].name}略過昏厥效果。`,
    }
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
    const targetIds =
      candidates.length >= pendingDecision.min
        ? ordered
            .slice(0, pendingDecision.max)
            .map((cookie) => cookie.card.instanceId)
        : []
    return {
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
    }
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
    const handCard = state.players[playerId].hand[0]
    return {
      state: applyGameCommand(state, {
        kind: 'resolve-place-hand-hp',
        playerId,
        handCardInstanceId: handCard?.instanceId,
      }),
      action: 'idle',
      description: handCard
        ? `${state.players[playerId].name}將 1 張手牌放回目標餅乾的 HP。`
        : `${state.players[playerId].name}略過放置 HP。`,
    }
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
    const discardedCards = state.players[playerId].hand.slice(
      0,
      pendingDecision.count,
    )
    const discardIds = discardedCards.map((card) => card.instanceId)
    return {
      state: applyGameCommand(state, {
        kind: 'resolve-opponent-hand-discard',
        playerId,
        cardIds: discardIds,
      }),
      action: 'idle',
      revealedCards: discardedCards,
      description: `${state.players[playerId].name}棄置 ${pendingDecision.count} 張手牌。`,
    }
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
    const pickedIds: string[] =
      pendingDecision.pickCount === 0
        ? []
        : hasFilter
          ? revealed
              .filter(
                (card) =>
                  (pendingDecision.filterColor === undefined ||
                    card.energyColor === pendingDecision.filterColor) &&
                  (pendingDecision.filterType === undefined ||
                    card.type === pendingDecision.filterType),
              )
              .slice(0, pendingDecision.pickCount)
              .map((c) => c.instanceId)
          : allIds.slice(0, pendingDecision.pickCount)
    const pickedSet = new Set(pickedIds)
    const restIds = allIds.filter((id) => !pickedSet.has(id))
    return {
      state: applyGameCommand(state, {
        kind: 'resolve-inspect-deck',
        playerId,
        pickedCardIds: pickedIds,
        restOrder: restIds,
      }),
      action: 'resolve-inspect-deck',
      description: `${state.players[playerId].name}從檢視牌中選取卡片。`,
    }
  }

  if (pendingDecision?.kind === 'reveal-top-deck') {
    if (pendingDecision.playerId !== playerId) {
      return {
        state,
        action: 'idle',
        description: `等待 ${state.players[pendingDecision.playerId].name} 確認翻牌展示。`,
      }
    }
    return {
      state: applyGameCommand(state, {
        kind: 'resolve-reveal-top-deck',
        playerId,
      }),
      action: 'resolve-reveal-top-deck',
      description: `${state.players[playerId].name}確認翻牌展示結果。`,
    }
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
    const paymentIds = selectEnergyPayment(
      effectiveEnergyCost,
      state.players[playerId].supportArea,
    )
    const canPay =
      hand.length >= (pendingDecision.cost.discardHand ?? 0) &&
      Boolean(paymentIds)
    const targetedEffect = pendingDecision.effects.find((effect) =>
      requiresEffectCardSelection(effect),
    )
    const context: EffectContext = {
      sourcePlayerId: playerId,
      sourceInstanceId: pendingDecision.sourceInstanceId,
    }
    const targetIds = targetedEffect
      ? getEffectSelectionCandidates(
          state,
          context,
          targetedEffect,
        )
          .slice(0, getEffectSelectionLimits(targetedEffect)?.max ?? 0)
          .map((card) => card.instanceId)
      : []
    const hasTarget =
      targetedEffect
      ? targetIds.length >= (getEffectSelectionLimits(targetedEffect)?.min ?? 0)
        : true
    if (canPay && hasTarget) {
      return {
        state: applyGameCommand(state, {
          kind: 'resolve-optional-cost-attack',
          playerId,
          action: 'pay',
          discardCardIds: hand
            .slice(0, pendingDecision.cost.discardHand ?? 0)
            .map((card) => card.instanceId),
          targetIds,
          paymentIds: paymentIds ?? [],
        }),
        action: 'resolve-optional-cost-attack',
        description: `${state.players[playerId].name}支付棄手牌代價發動攻擊後續效果。`,
      }
    }
    return {
      state: applyGameCommand(state, {
        kind: 'resolve-optional-cost-attack',
        playerId,
        action: 'skip',
      }),
      action: 'resolve-optional-cost-attack',
      description: `${state.players[playerId].name}略過攻擊後續可選代價效果。`,
    }
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
    return {
      state: applyGameCommand(state, {
        kind: 'resolve-draw-up-to',
        playerId,
        drawCount,
      }),
      action: 'idle',
      description: `${state.players[playerId].name}從牌庫抽取 ${drawCount} 張牌。`,
    }
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
    return {
      state: applyGameCommand(state, {
        kind: 'resolve-stage-trigger',
        playerId,
        action: canDraw ? 'activate' : 'skip',
      }),
      action: 'resolve-stage-trigger',
      description: canDraw
        ? `${state.players[playerId].name}發動${pendingDecision.sourceCardName}效果抽 1 張牌。`
        : `${state.players[playerId].name}略過${pendingDecision.sourceCardName}效果。`,
    }
  }

  return null
}
