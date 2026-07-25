import {
  getEffectTargetCandidatesForEffect,
  getEnergyCostTotal,
  isEnergyColorCompatibleWithCost,
  requiresTargetSelection,
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
  opponentBattleCards: { card: GameCard; instanceId: string }[]
  needsTarget: boolean
}

export function getOptionalCostAttackPrompt(
  game: GameState,
  viewerPlayerId: PlayerId,
): OptionalCostAttackPromptData | null {
  const pending = game.pendingOptionalCostAttack
  if (!pending || pending.playerId !== viewerPlayerId) return null

  const targetedEffect = pending.effects.find((effect) =>
    requiresTargetSelection(effect),
  )
  const needsTarget = Boolean(targetedEffect)
  const opponentId = viewerPlayerId === 'player-one' ? 'player-two' : 'player-one'
  const opponentBattleCards = (
    targetedEffect
      ? getEffectTargetCandidatesForEffect(
          game,
          {
            sourcePlayerId: viewerPlayerId,
            sourceInstanceId: pending.sourceInstanceId,
          },
          targetedEffect,
        ).map((cookie) => cookie.card)
      : game.players[opponentId].battleArea.map((cookie) => cookie.card)
  ).map((card) => ({ card, instanceId: card.instanceId }))

  const energyCost = pending.cost.energy ?? ({} as EnergyCost)
  const energyCostTotal = getEnergyCostTotal(energyCost)
  const supportCandidates = game.players[viewerPlayerId].supportArea
    .filter((support) => !support.rested)
    .filter((support) => {
      if (energyCostTotal <= 0) return true
      return isEnergyColorCompatibleWithCost(
        energyCost,
        support.card.energyColor,
      )
    })
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
    opponentBattleCards,
    needsTarget,
  }
}
