import { describe, expect, it, vi } from 'vitest'
import { createDemoGame } from './demo'
import { dispatchAiStep, type AiStepHandler } from './ai/dispatcher'

describe('dispatchAiStep', () => {
  it('returns the first decision and does not invoke lower-priority handlers', () => {
    const state = createDemoGame()
    const first = vi.fn<AiStepHandler>(() => ({
      state,
      action: 'idle',
      description: 'first',
    }))
    const second = vi.fn<AiStepHandler>(() => ({
      state,
      action: 'advance-phase',
      description: 'second',
    }))

    expect(dispatchAiStep(state, 'player-two', [first, second])?.description).toBe(
      'first',
    )
    expect(first).toHaveBeenCalledOnce()
    expect(second).not.toHaveBeenCalled()
  })
})
