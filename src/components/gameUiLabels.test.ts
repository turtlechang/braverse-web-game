import { describe, expect, it } from 'vitest'
import { phaseAdvanceLabels, onlineMatchStatusLabels, matchEndedReasonLabels } from './gameUiLabels'

describe('phase advance labels', () => {
  it('describes the exact result of each player-controlled phase action', () => {
    expect(phaseAdvanceLabels.support).toBe('略過支援階段')
    expect(phaseAdvanceLabels.main).toBe('結束主要階段')
    expect(phaseAdvanceLabels.end).toBe('結束回合')
  })
})

describe('online match status labels', () => {
  it('maps every status to a non-empty Chinese label', () => {
    const expectedKeys = [
      'idle',
      'connecting',
      'waiting-for-opponent',
      'in-progress',
      'ended',
      'error',
    ]
    for (const key of expectedKeys) {
      const label = onlineMatchStatusLabels[key as keyof typeof onlineMatchStatusLabels]
      expect(label, `status ${key} must have a label`).toBeTruthy()
      expect(label, `status ${key} label must not contain raw status key`).not.toContain(key)
    }
  })
})

describe('match ended reason labels', () => {
  it('maps known reasons to Chinese labels', () => {
    expect(matchEndedReasonLabels.victory).toBe('勝利')
    expect(matchEndedReasonLabels.defeat).toBe('敗北')
    expect(matchEndedReasonLabels['opponent-disconnected']).toBe('對手已離線')
  })
})
