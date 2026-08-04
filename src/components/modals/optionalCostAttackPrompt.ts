import {
  getBreakCount,
  getEffectSelectionCandidates,
  getEffectSelectionLimits,
  getEnergyCostTotal,
  getRemainingEnergyCost,
  isEffectConditionMet,
  isEnergyColorCompatibleWithCost,
  requiresEffectCardSelection,
  type CardEffect,
  type EnergyCost,
  type GameCard,
  type GameState,
  type PlayerId,
} from '../../game'
import { energyColorLabel } from '../gameUiLabels'

export interface OptionalCostAttackPromptData {
  sourceCard?: GameCard
  sourceCardName: string
  effectText: string
  discardHandCost: number
  energyCostTotal: number
  playerHand: GameCard[]
  supportCandidates: { card: GameCard; instanceId: string }[]
  targetCandidates: { card: GameCard; instanceId: string }[]
  needsTarget: boolean
  targetMin: number
  targetLabel: string
  /**
   * 代價的完整說明文字。含來源餅乾自付的能量（BS3-076「Use this Cookie as
   * {B}」這類寫法）——這部分不會出現在 `energyCostTotal`（那是扣掉來源能量後
   * 「還要從支援區付」的張數），少了它玩家會看到一個空白的「代價：」。
   */
  costText: string
  /**
   * 子效果的 condition 目前不成立時的提示文字。跟陷阱的
   * getUnmetTrapConditionWarning 同一套邏輯：resolveOptionalCostAttack
   * 本來就會用 isEffectConditionMet 過濾掉條件不成立的子效果（不會拋錯），
   * 但玩家付款前完全看不到任何說明，只會覺得「付了代價卻什麼事都沒發生」。
   */
  unmetConditionWarning: string | null
}

const getUnmetConditionWarning = (
  game: GameState,
  viewerPlayerId: PlayerId,
  sourceInstanceId: string,
  effects: CardEffect[],
): string | null => {
  const context = { sourcePlayerId: viewerPlayerId, sourceInstanceId }
  for (const effect of effects) {
    if (effect.kind === 'damage-by-break-count' || effect.kind === 'modify-attack-by-break-count') {
      if (getBreakCount(game, viewerPlayerId, effect) <= 0) {
        return effect.kind === 'damage-by-break-count'
          ? '目前休息區沒有符合條件的餅乾，這個效果將不會造成任何傷害。'
          : '目前休息區沒有符合條件的餅乾，這個效果不會改變攻擊力。'
      }
      continue
    }
    if ('condition' in effect && effect.condition && !isEffectConditionMet(game, context, effect)) {
      return '目前條件不成立，確認後會略過此效果。'
    }
  }
  return null
}

/**
 * 代價說明文字。能量要標出顏色——只寫「支付 N 張能量支援卡」玩家不知道該挑
 * 哪一色，得回頭看卡面英文。
 */
const describeCost = (
  remainingEnergy: EnergyCost,
  discardHandCost: number,
): string => {
  const parts: string[] = []

  const energyParts = (Object.keys(remainingEnergy) as (keyof EnergyCost)[])
    .filter((key) => (remainingEnergy[key] ?? 0) > 0)
    .map(
      (key) =>
        `${remainingEnergy[key]} 點${energyColorLabel[key] ?? String(key)}能量`,
    )
  if (energyParts.length > 0) {
    parts.push(`支付支援區 ${energyParts.join('、')}`)
  }
  if (discardHandCost > 0) parts.push(`棄置 ${discardHandCost} 張手牌`)

  return parts.length > 0 ? parts.join('、') : '無'
}

export function getOptionalCostAttackPrompt(
  game: GameState,
  viewerPlayerId: PlayerId,
): OptionalCostAttackPromptData | null {
  const pending = game.pendingOptionalCostAttack
  if (!pending || pending.playerId !== viewerPlayerId) return null

  // A source-only battle-to-break effect is an automatic cost step (the
  // attacking Cookie itself), not the card the player is asked to choose.
  // Skip it so chained effects such as BS4-029 expose the following
  // break-to-battle candidate in the payment flow.
  const targetedEffect = pending.effects.find(
    (effect) =>
      requiresEffectCardSelection(effect) &&
      !(effect.kind === 'battle-to-break' && effect.target.sourceOnly),
  )
  const needsTarget = Boolean(targetedEffect)
  const targetCandidates = (
    targetedEffect
      ? getEffectSelectionCandidates(
          game,
          {
            sourcePlayerId: viewerPlayerId,
            sourceInstanceId: pending.sourceInstanceId,
          },
          targetedEffect,
        )
      : []
  ).map((card) => ({ card, instanceId: card.instanceId }))
  const targetMin = targetedEffect
    ? getEffectSelectionLimits(targetedEffect)?.min ?? 0
    : 0
  const targetSelector =
    targetedEffect && 'target' in targetedEffect ? targetedEffect.target : undefined
  const targetLabel = targetedEffect?.kind === 'opponent-battle-to-trash'
    ? '對手餅乾'
    : targetSelector?.side === 'self'
      ? '己方餅乾'
      : '對手餅乾'

  const costEnergy = pending.cost.energy ?? ({} as EnergyCost)
  const energyCost = getRemainingEnergyCost(costEnergy, pending.sourceEnergy)
  const energyCostTotal = getEnergyCostTotal(energyCost)
  const discardHandCost = pending.cost.discardHand ?? 0
  const supportCandidates = energyCostTotal === 0
    ? []
    : game.players[viewerPlayerId].supportArea
    .filter((support) => !support.rested)
    .filter((support) =>
      isEnergyColorCompatibleWithCost(
        energyCost,
        support.card.energyColor,
      ),
    )
    .map((support) => ({ card: support.card, instanceId: support.card.instanceId }))

  return {
    sourceCard: game.players[viewerPlayerId].battleArea.find(
      (cookie) => cookie.card.instanceId === pending.sourceInstanceId,
    )?.card,
    sourceCardName: pending.sourceCardName,
    effectText: pending.effectText,
    discardHandCost,
    energyCostTotal,
    costText: describeCost(energyCost, discardHandCost),
    playerHand: game.players[viewerPlayerId].hand,
    supportCandidates,
    targetCandidates,
    needsTarget,
    targetMin,
    targetLabel,
    unmetConditionWarning: getUnmetConditionWarning(
      game,
      viewerPlayerId,
      pending.sourceInstanceId,
      pending.effects,
    ),
  }
}
