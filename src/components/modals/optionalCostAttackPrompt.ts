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

  const energyCost = getRemainingEnergyCost(
    pending.cost.energy ?? ({} as EnergyCost),
    pending.sourceEnergy,
  )
  const energyCostTotal = getEnergyCostTotal(energyCost)
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
    discardHandCost: pending.cost.discardHand ?? 0,
    energyCostTotal,
    playerHand: game.players[viewerPlayerId].hand,
    supportCandidates,
    targetCandidates,
    needsTarget,
    targetMin,
    targetLabel,
  }
}
