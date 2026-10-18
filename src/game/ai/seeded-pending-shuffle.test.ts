import { describe, expect, it, vi } from 'vitest'
import { createCustomDeckMatch, type SwissRosterDeck } from '../tournament'
import { BS12_DECK_PRESETS } from '../bs12-deck-recipes'
import { takeAiStep } from '../ai'
import { getActingPlayerId } from '../controller'
import type { AiStrategyMemory } from './strategy/session'
import type { PlayerId } from '../types'

describe('seeded AI pending commands', () => {
  it('resolves the purple Yew Village Scroll mirror without ambient randomness and repeats the same result', () => {
    const deck: SwissRosterDeck = {
      ...BS12_DECK_PRESETS['bs12-purple-arena'], color: 'purple', id: 'purple', format: 'standard',
      createdAt: '', updatedAt: '',
    }
    const seed = 202610114
    const state = createCustomDeckMatch(seed, deck, deck)
    const before = structuredClone(state)
    const random = vi.spyOn(Math, 'random').mockImplementation(() => {
      throw new Error('AI pending commands must use the injected shuffle seed')
    })
    try {
      const run = () => {
        let current = state
        const memories: Partial<Record<PlayerId, AiStrategyMemory>> = {}
        const traps: string[] = []
        for (let step = 0; step < 500 && current.status !== 'finished'; step++) {
          const player = getActingPlayerId(current)
          const decision = takeAiStep(current, player, {
            level: 5, seed, searchNow: () => 0, memory: memories[player],
          })
          expect(decision.error).toBeUndefined()
          expect(decision.state).not.toBe(current)
          if (decision.reason?.strategyMemory) memories[player] = decision.reason.strategyMemory
          if (decision.action === 'play-trap' && decision.revealedCard) traps.push(decision.revealedCard.id)
          current = decision.state
        }
        return { state: current, traps }
      }
      const first = run()
      expect(first.state.status).toBe('finished')
      expect(first.traps).toContain('BS2-079')
      expect(run()).toEqual(first)
      expect(random).not.toHaveBeenCalled()
      expect(state).toEqual(before)
    } finally {
      random.mockRestore()
    }
  }, 30000)
})
