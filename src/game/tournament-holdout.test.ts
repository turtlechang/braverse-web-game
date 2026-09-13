import { describe, expect, it } from 'vitest'
import {
  classifyCrossPlayWinner,
  MAX_TOURNAMENT_ACTIONS,
  validateTournamentMaxActions,
} from './tournament'

describe('tournament cross-play guardrails', () => {
  it('classifies the strategy winner independently of the deck seat', () => {
    expect(classifyCrossPlayWinner('player-one', {
      baselinePlayerId: 'player-two',
      trainedPlayerId: 'player-one',
    })).toBe('trained')
    expect(classifyCrossPlayWinner('player-two', {
      baselinePlayerId: 'player-two',
      trainedPlayerId: 'player-one',
    })).toBe('baseline')
    expect(classifyCrossPlayWinner(null, {
      baselinePlayerId: 'player-one',
      trainedPlayerId: 'player-two',
    })).toBeNull()
  })

  it('keeps tournament matches within the project safety cap', () => {
    expect(MAX_TOURNAMENT_ACTIONS).toBe(500)
    expect(validateTournamentMaxActions()).toBe(500)
    expect(validateTournamentMaxActions(500)).toBe(500)
    expect(() => validateTournamentMaxActions(501)).toThrow(/500/)
  })
})
