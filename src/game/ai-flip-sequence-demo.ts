import { COMMUNITY_DECK_PRESETS } from './community-deck-recipes'
import { createCustomDeckMatch } from './tournament'
import { applyGameCommand } from './commands'
import { AI_FLIP_SEQUENCE_PARENT_COMMANDS } from './ai-flip-sequence-commands'
import type { SwissRosterDeck } from './tournament'

export const createAiFlipSequenceOpening = () => {
  const deck = (id: 'cookierift-83' | 'cookierift-1035'): SwissRosterDeck => ({
    ...COMMUNITY_DECK_PRESETS[id], id, format: 'standard',
    color: id === 'cookierift-83' ? 'red' : 'yellow',
    createdAt: '2026-10-10', updatedAt: '2026-10-10',
  })
  return createCustomDeckMatch(2026194017, deck('cookierift-83'), deck('cookierift-1035'), 'player-one')
}

/** Actual seeded opening for the historical Cookierift 83 vs. 1035 trace. */
export const createAiFlipSequencePreview = () => {
  let state = createAiFlipSequenceOpening()
  for (const command of AI_FLIP_SEQUENCE_PARENT_COMMANDS) {
    state = applyGameCommand(state, command)
  }
  if (!(state.pendingBattle?.effectDamageSequence?.afterCurrentDamageResolved &&
      state.pendingAbilityEffect?.sourceKind === 'flip' &&
      state.pendingAbilityEffect.battleContinuation === 'flip-damage')) {
    throw new Error('Historical sourced-deck trace no longer reaches its nested FLIP interruption')
  }
  return state
}
