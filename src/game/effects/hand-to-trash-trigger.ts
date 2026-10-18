import type { CardEffect, GameCard, GameState, PlayerId } from '../types'

type HandToTrashTriggerDefinition = {
  sourceCardName: string
  effects: CardEffect[]
}

const getTriggerDefinition = (effect: CardEffect): HandToTrashTriggerDefinition | null => {
  if (effect.kind === 'hand-to-trash-trigger') {
    return { sourceCardName: effect.sourceCardName, effects: effect.effects }
  }
  if (effect.kind === 'shadow-milk-discard-trigger') {
    return { sourceCardName: 'Shadow Milk Cookie', effects: effect.effects }
  }
  return null
}

const normalizeCardName = (name: string): string => name.trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-US')

/** Queue passives only for cards actually moved from their owner's hand by the named source Cookie. */
export const queueHandToTrashTriggers = (
  state: GameState,
  playerId: PlayerId,
  sourceCardName: string,
  discardedCards: GameCard[],
): GameState => {
  const normalizedSourceName = normalizeCardName(sourceCardName)
  if (!normalizedSourceName || discardedCards.length === 0) return state

  const triggers = discardedCards.flatMap(card =>
    [...(card.skill?.effects ?? []), ...(card.skill?.passiveEffects ?? [])]
      .flatMap(effect => {
        const definition = getTriggerDefinition(effect)
        return definition && normalizeCardName(definition.sourceCardName) === normalizedSourceName
          ? [{
              playerId,
              sourceInstanceId: card.instanceId,
              sourceCardName: card.name,
              effects: definition.effects,
            }]
          : []
      }),
  )

  return triggers.length > 0
    ? {
        ...state,
        pendingHandToTrashTriggers: [
          ...(state.pendingHandToTrashTriggers ?? []),
          ...triggers,
        ],
      }
    : state
}
