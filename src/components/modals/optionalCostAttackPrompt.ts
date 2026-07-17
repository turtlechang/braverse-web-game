import {
  getEffectTargetCandidates,
  getEnergyCostTotal,
  isEffectTargeted,
  type EnergyColor,
  type EnergyCost,
  type GameCard,
  type GameState,
  type PlayerId,
} from '../../game'

export interface OptionalCostAttackPromptData {
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

  const targetedEffect = pending.effects.find(
    (effect) =>
      isEffectTargeted(effect) || effect.kind === 'opponent-battle-to-trash',
  )
  const needsTarget = Boolean(targetedEffect)
  const opponentId = viewerPlayerId === 'player-one' ? 'player-two' : 'player-one'
  const opponentBattleCards = (
    targetedEffect
      ? targetedEffect.kind === 'opponent-battle-to-trash'
        ? (() => {
            const effect = targetedEffect as {
              kind: 'opponent-battle-to-trash'
              maxLevel?: number
              minLevel?: number
              remainingHp?: number
            }
            return getEffectTargetCandidates(
              game,
              {
                sourcePlayerId: viewerPlayerId,
                sourceInstanceId: pending.sourceInstanceId,
              },
              {
                side: 'opponent',
                min: 1,
                max: 1,
                ...(effect.maxLevel !== undefined
                  ? { maxLevel: effect.maxLevel }
                  : {}),
                ...(effect.minLevel !== undefined
                  ? { minLevel: effect.minLevel }
                  : {}),
                ...(effect.remainingHp !== undefined
                  ? { remainingHp: effect.remainingHp }
                  : {}),
              },
            ).map((cookie) => cookie.card)
          })()
        : getEffectTargetCandidates(
            game,
            {
              sourcePlayerId: viewerPlayerId,
              sourceInstanceId: pending.sourceInstanceId,
            },
            (targetedEffect as { target: import('../../game').EffectTargetSelector })
              .target,
          ).map((cookie) => cookie.card)
      : game.players[opponentId].battleArea.map((cookie) => cookie.card)
  ).map((card) => ({ card, instanceId: card.instanceId }))

  const energyCost = pending.cost.energy ?? ({} as EnergyCost)
  const energyCostTotal = getEnergyCostTotal(energyCost)
  const requiredColors = new Set(
    (Object.keys(energyCost) as (EnergyColor | 'neutral')[]).filter(
      (key) => (energyCost[key] ?? 0) > 0,
    ),
  )
  const supportCandidates = game.players[viewerPlayerId].supportArea
    .filter((support) => !support.rested)
    .filter((support) => {
      if (energyCostTotal <= 0) return true
      if (!support.card.energyColor) return false
      if (support.card.energyColor === 'wild') return true
      if (requiredColors.size === 0) return false
      if (requiredColors.size === 1 && requiredColors.has('neutral')) return true
      return requiredColors.has(support.card.energyColor)
    })
    .map((support) => ({ card: support.card, instanceId: support.card.instanceId }))

  return {
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
