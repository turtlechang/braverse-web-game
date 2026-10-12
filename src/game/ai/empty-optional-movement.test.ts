import { describe, expect, it } from 'vitest'
import empty from './fixtures/bs12-green-empty-optional-movement.json'
import rescue from './fixtures/bs12-green-rescue-optional-movement.json'
import type { GameState } from '../types'
import { takeAiStep } from '../ai'

// Snapshots from a complete original-card green/black game, seed 2026111997.
// Preserve the original card faces, zones, HP and complete command history.
const fixture = (positive = false) =>
  structuredClone(positive ? rescue.state : empty.state) as unknown as GameState

describe('AI optional movement Then from an actual complete game', () => {
  for (const level of [3, 4, 5] as const) {
    it(`Lv${level} skips payment when no Cookie can be moved`, () => {
      const state = fixture(), before = structuredClone(state)
      const own = state.players['player-one']
      expect(state.pendingOptionalCostAttack?.effects).toEqual([
        { kind: 'battle-to-support', target: { side: 'self', min: 0, max: 1, energyColor: 'green', maxLevel: 2 }, rested: false },
      ])
      expect(own.battleArea.every(cookie => cookie.card.level > 2)).toBe(true)
      const next = takeAiStep(state, 'player-one', { level, seed: empty.seed, searchNow: () => 0 })
      expect(next.state.commandLog?.at(-1)?.payload).toMatchObject({ kind: 'resolve-optional-cost-attack', action: 'skip' })
      expect(next.state.players['player-one'].supportArea).toEqual(own.supportArea)
      expect(next.state.players['player-one'].discardPile).toEqual(own.discardPile)
      expect(state).toEqual(before)
    })

    it(`Lv${level} preserves the available injured Cookie rescue`, () => {
      const state = fixture(true), before = structuredClone(state)
      const targetId = 'player-one-P-113-2'
      expect(state.players['player-one'].battleArea.find(cookie => cookie.card.instanceId === targetId)?.hpCards).toHaveLength(1)
      const next = takeAiStep(state, 'player-one', { level, seed: rescue.seed, searchNow: () => 0 })
      expect(next.state.commandLog?.at(-1)?.payload).toMatchObject({ kind: 'resolve-optional-cost-attack', action: 'pay', targetIds: [targetId] })
      expect(next.state.players['player-one'].supportArea.some(support => support.card.instanceId === targetId)).toBe(true)
      expect(state).toEqual(before)
    })

    it(`Lv${level} decides from public targets under hidden-card permutations`, () => {
      const state = fixture(), changed = structuredClone(state)
      for (const player of Object.values(changed.players)) {
        player.deck.reverse()
        for (const cookie of player.battleArea) cookie.hpCards.reverse()
      }
      const options = { level, seed: empty.seed, searchNow: () => 0 }
      expect(takeAiStep(state, 'player-one', options).state.commandLog?.at(-1)?.payload)
        .toEqual(takeAiStep(changed, 'player-one', options).state.commandLog?.at(-1)?.payload)
    })
  }

  it.each([1, 2] as const)('preserves existing Lv%i behavior', level => {
    const next = takeAiStep(fixture(), 'player-one', { level, seed: empty.seed, searchNow: () => 0 })
    expect(next.state.commandLog?.at(-1)?.payload).toMatchObject({ kind: 'resolve-optional-cost-attack', action: 'pay', targetIds: [] })
  })
})
