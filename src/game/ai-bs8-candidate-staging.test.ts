import { describe, expect, it } from 'vitest'
import {
  OFFICIAL_RED_STARTER_DECK,
  createDemoGame,
  simulateAiMatch,
  type AiLevel,
  type Bs8CandidateStagingDeck,
} from '.'

const FIXED_SEED = 80_008

const createCandidateDeck = (): Bs8CandidateStagingDeck => ({
  id: 'ai-bs8-candidate-staging',
  name: 'BS8 AI Candidate Staging',
  entries: OFFICIAL_RED_STARTER_DECK.map(({ cardNumber, count }) => ({
    cardNumber,
    count,
  })),
  candidateStaging: {
    kind: 'bs8-candidate-staging',
    extraDeckEntries: [
      { cardNumber: 'BS8-005', count: 4 },
      { cardNumber: 'BS8-027', count: 2 },
    ],
  },
  createdAt: '2026-08-30T00:00:00.000Z',
  updatedAt: '2026-08-30T00:00:00.000Z',
})

describe('BS8 候選 EXTRA 固定 seed 全場 AI gate', () => {
  it.each([1, 2, 3, 4, 5] as const)(
    'Lv.%s 在候選 staging 牌組下能完整結束固定 seed 對局',
    (level: AiLevel) => {
      const state = createDemoGame(
        FIXED_SEED,
        { player: 'custom', ai: 'red' },
        createCandidateDeck(),
      )
      expect(state.players['player-one'].extraDeck).toHaveLength(6)

      const result = simulateAiMatch(state, 2_000, {
        levels: { 'player-one': level, 'player-two': level },
        seed: FIXED_SEED,
      })

      expect(result.stuck, `Lv.${level}: ${result.error ?? ''}`).toBe(false)
      expect(result.state.status).toBe('finished')
      expect(result.actions).toBeGreaterThan(0)
    },
  )
})
