import { describe, expect, it } from 'vitest'
import {
  isEffectConditionMet,
  type CardEffect,
  type EffectContext,
  type GameCard,
  type GameState,
  type PlayerId,
} from '..'
import { cookie, createBattleState, item } from '../test-helpers/battle-helpers'

const context: EffectContext = {
  sourcePlayerId: 'player-one',
  sourceInstanceId: 'st8-017-trap',
}

const setSupportCount = (
  state: GameState,
  playerId: PlayerId,
  count: number,
) => {
  state.players[playerId].supportArea = Array.from({ length: count }, (_, index) => {
    const card: GameCard = index === 0
      ? cookie(`support-count-equal-${playerId}-${index}`)
      : item(`support-count-equal-${playerId}-${index}`)
    return { card, rested: index % 2 === 0 }
  })
}

describe('support-count-equal condition', () => {
  const effect: CardEffect = {
    kind: 'draw-up-to',
    max: 1,
    condition: { kind: 'support-count-equal' },
  }

  it.each([
    [0, 0, true],
    [2, 2, true],
    [3, 3, true],
    [2, 3, false],
    [3, 2, false],
  ] as const)(
    'compares exact support-area lengths (%i vs %i)',
    (ownCount, opponentCount, expected) => {
      const state = createBattleState()
      setSupportCount(state, 'player-one', ownCount)
      setSupportCount(state, 'player-two', opponentCount)
      const before = structuredClone(state)

      expect(isEffectConditionMet(state, context, effect)).toBe(expected)
      expect(state).toEqual(before)
    },
  )
})
