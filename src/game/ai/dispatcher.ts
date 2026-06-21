import type { GameState, PlayerId } from '../types'
import type { AiDecision } from './types'

export type AiStepHandler = (
  state: GameState,
  playerId: PlayerId,
) => AiDecision | null

export const dispatchAiStep = (
  state: GameState,
  playerId: PlayerId,
  handlers: readonly AiStepHandler[],
): AiDecision | null => {
  for (const handler of handlers) {
    const decision = handler(state, playerId)
    if (decision) return decision
  }
  return null
}
