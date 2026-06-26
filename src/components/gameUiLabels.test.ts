import { describe, expect, it } from 'vitest'
import { phaseAdvanceLabels } from './gameUiLabels'

describe('phase advance labels', () => {
  it('describes the exact result of each player-controlled phase action', () => {
    expect(phaseAdvanceLabels.support).toBe('略過支援階段')
    expect(phaseAdvanceLabels.main).toBe('結束主要階段')
    expect(phaseAdvanceLabels.end).toBe('結束回合')
  })
})
