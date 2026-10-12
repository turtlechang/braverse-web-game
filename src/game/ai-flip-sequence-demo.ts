import { COMMUNITY_DECK_PRESETS } from './community-deck-recipes'
import { createCustomDeckMatch } from './tournament'
import { getActingPlayerId } from './controller'
import { takeAiStep } from './ai'
import type { SwissRosterDeck } from './tournament'
import type { AiStepOptions } from './ai/types'
import type { PlayerId } from './types'

export const createAiFlipSequenceOpening = () => {
  const deck = (id: 'cookierift-83' | 'cookierift-1035'): SwissRosterDeck => ({
    ...COMMUNITY_DECK_PRESETS[id], id, format: 'standard',
    color: id === 'cookierift-83' ? 'red' : 'yellow',
    createdAt: '2026-10-10', updatedAt: '2026-10-10',
  })
  return createCustomDeckMatch(2026194017, deck('cookierift-83'), deck('cookierift-1035'), 'player-one')
}

/** Actual seeded opening and commands from the 13-recipe holdout failure. */
export const createAiFlipSequencePreview = () => {
  const seed = 2026194017
  let state = createAiFlipSequenceOpening()
  const memories: Partial<Record<PlayerId, AiStepOptions['memory']>> = {}
  for (let step = 0; step < 200; step++) {
    if (state.pendingBattle?.effectDamageSequence?.afterCurrentDamageResolved &&
        state.pendingAbilityEffect?.sourceKind === 'flip' &&
        state.pendingAbilityEffect.battleContinuation === 'flip-damage') return state
    const playerId = getActingPlayerId(state)
    const decision = takeAiStep(state, playerId, {
      level: 5, seed, searchNow: () => 0, memory: memories[playerId],
    })
    if (decision.action === 'error' || decision.state === state || state.status !== 'playing') {
      throw new Error('Failed to reach original nested FLIP interruption: '+decision.description)
    }
    memories[playerId] = decision.reason?.strategyMemory
    state = decision.state
  }
  throw new Error('Original nested FLIP interruption not reached within200 actual actions')
}
