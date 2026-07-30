import {
  getEffectSelectionCandidates,
  getEffectSelectionLimits,
  getEnergyCostTotal,
  getRemainingEnergyCost,
  isEnergyColorCompatibleWithCost,
  requiresEffectCardSelection,
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

  const targetedEffect = pending.effects.find((effect) =>
    requiresEffectCardSelection(effect),
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
  }
}
