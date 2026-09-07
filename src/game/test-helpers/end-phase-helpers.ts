import { convertOfficialCardToGameCard } from '../../cards/official-card-adapter'
import { getCardPoolEntry } from '../card-pool'
import { createBattleState } from './battle-helpers'
import type { GameCard, GameState } from '../types'

const official = (id: string, instanceId: string): GameCard => {
  const entry = getCardPoolEntry(id)
  if (!entry) throw new Error(`Missing ${id}`)
  const result = convertOfficialCardToGameCard(entry)
  if (result.status !== 'converted') throw new Error(`Unconverted ${id}`)
  return { ...result.gameCard, instanceId }
}

/** Formal source cards in a bounded end-phase scenario, without an opening-game claim. */
export const createEndPhaseCostState = (id: string, supports: string[] = []): GameState => {
  const state = createBattleState()
  const source = official(id, 'end-source')
  if (source.type !== 'cookie') throw new Error('Expected Cookie')
  return {
    ...state,
    phase: 'end',
    activePlayerId: 'player-one',
    turnNumber: 3,
    players: {
      ...state.players,
      'player-one': {
        ...state.players['player-one'],
        battleArea: [{ card: source, hpCards: [official('BS8-020', 'hp')], rested: false }],
        supportArea: supports.map((card, index) => ({ card: official(card, `pay-${index}`), rested: false })),
        deck: Array.from({ length: 12 }, (_, index) => official('BS8-020', `deck-${index}`)),
        discardPile: [],
      },
    },
  }
}
