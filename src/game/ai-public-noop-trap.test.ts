import { describe, expect, it } from 'vitest'
import {
  createAiPublicNoopTrapPreview as fixture,
  type AiPublicNoopTrapScenario,
} from './ai-public-noop-trap-demo'
import { takeAiStep } from './ai'
import { getTrapCandidates } from './battle'

const scenarios: AiPublicNoopTrapScenario[] = [
  'missing',
  'black-non-arena',
  'yellow-arena',
  'black-arena',
  'rested-black-arena',
  'hand-black-arena',
]

describe('AI preserves a trap when its public battlefield condition is false', () => {
  it.each(([1, 2, 3, 4, 5] as const).flatMap(level =>
    scenarios.map(scenario => ({ level, scenario })),
  ))('Lv$level: $scenario', ({ level, scenario }) => {
    const state = fixture(scenario)
    const before = structuredClone(state)
    const valid = scenario === 'black-arena' || scenario === 'rested-black-arena'

    // Legal activation and whether its cost is strategically useful are separate.
    expect(getTrapCandidates(state, 'player-two').some(card => card.id === 'BS12-105')).toBe(true)

    const decision = takeAiStep(state, 'player-two', { level, searchNow: () => 0 })
    const next = decision.state

    expect(next.commandLog?.at(-1)?.payload.kind).toBe(valid ? 'play-trap' : 'skip-trap')
    expect(next.players['player-two'].hand.some(card => card.id === 'BS12-105')).toBe(!valid)
    expect(next.players['player-two'].supportArea[3]?.rested).toBe(valid)
    expect(next.pendingBattle?.remainingDamage).toBe(valid ? 2 : 4)
    expect(state).toEqual(before)
  })

  it('does not use unseen opponent card order to decide whether the witness exists', () => {
    const state = fixture('missing')
    const permuted = structuredClone(state)
    permuted.players['player-one'].deck.reverse()
    permuted.players['player-one'].hand.reverse()
    for (const cookie of permuted.players['player-one'].battleArea) cookie.hpCards.reverse()

    const decisions = ([1, 2, 5] as const).flatMap(level =>
      [state, permuted].map(current =>
        takeAiStep(current, 'player-two', { level, searchNow: () => 0 }),
      ),
    )

    expect(decisions.map(decision => decision.state.commandLog?.at(-1)?.payload)).toEqual(
      Array.from({ length: 6 }, () => ({ kind: 'skip-trap', playerId: 'player-two' })),
    )
  })

  it.each([1, 2] as const)(
    'Lv%s skips the blocked first trap and still chooses a valid later trap',
    (level) => {
      const state = fixture('missing-then-valid-trap')
      const before = structuredClone(state)
      const owner = state.players['player-two']

      expect(owner.hand.map(card => card.id)).toEqual(['BS12-105', 'ST8-018'])
      expect(getTrapCandidates(state, 'player-two').map(card => card.id)).toEqual([
        'BS12-105', 'ST8-018',
      ])

      const decision = takeAiStep(state, 'player-two', { level, searchNow: () => 0 })
      const next = decision.state

      expect(next.commandLog?.at(-1)?.payload.kind).toBe('play-trap')
      expect(next.players['player-two'].hand.map(card => card.id)).toEqual(['BS12-105'])
      expect(next.players['player-two'].supportArea[2]?.rested).toBe(true)
      expect(next.players['player-two'].supportArea[3]?.rested).toBe(false)
      expect(next.pendingBattle?.remainingDamage).toBe(3)
      expect(state).toEqual(before)
    },
  )
})
