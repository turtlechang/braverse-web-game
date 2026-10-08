import { expect, it } from 'vitest'
import { createBs12KouignDemoState, createBs12ClottedDemoState } from './demo'
it.each(['BS12-035', 'BS12-035@1'] as const)('%s uses the actual printed 6HP Sugar Swan in every ordinary/R002 scene', number => {
  for (const scenario of ['positive', 'attack', 'then-four', 'then-three', 'then-non-arena', 'then-opponent', 'then-level'] as const) {
    const target = createBs12KouignDemoState(scenario, number).players['player-two'].battleArea[0]
    expect(target.card.id).toBe('BS6-008')
    expect(target.card.hp).toBe(6)
    expect(target.hpCards).toHaveLength(target.card.hp)
  }
})
it.each(['BS12-036', 'BS12-036@1'] as const)('%s uses actual printed 6HP Sugar Swan in initial and real EXTRA parent scenes', number => {
  for (const scenario of ['positive', 'attack', 'then-positive', 'then-rested', 'then-no-target'] as const) {
    const target = createBs12ClottedDemoState(scenario, number).players['player-two'].battleArea[0]
    expect(target.card.id).toBe('BS6-008')
    expect(target.card.hp).toBe(6)
    expect(target.hpCards).toHaveLength(target.card.hp)
  }
})
