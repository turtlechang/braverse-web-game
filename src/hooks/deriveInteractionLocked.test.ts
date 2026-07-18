import { describe, expect, it } from 'vitest'
import { createDemoGame, type GameState } from '../game'
import { deriveInteractionLocked } from './deriveInteractionLocked'

const baseGame = (): GameState => createDemoGame()

describe('deriveInteractionLocked', () => {
  it('is unlocked when nothing is pending', () => {
    expect(
      deriveInteractionLocked(baseGame(), 'player-one', false, false),
    ).toBe(false)
  })

  it('locks when the local pending effect flow is active', () => {
    expect(
      deriveInteractionLocked(baseGame(), 'player-one', true, false),
    ).toBe(true)
  })

  it('locks when faint replacement is active', () => {
    expect(
      deriveInteractionLocked(baseGame(), 'player-one', false, true),
    ).toBe(true)
  })

  it('locks on pendingOnPlay', () => {
    const game = {
      ...baseGame(),
      pendingOnPlay: { playerId: 'player-one', sourceInstanceId: 'x' },
    } as GameState
    expect(deriveInteractionLocked(game, 'player-one', false, false)).toBe(true)
  })

  it('locks on pendingBattle', () => {
    const game = { ...baseGame(), pendingBattle: {} as GameState['pendingBattle'] }
    expect(deriveInteractionLocked(game, 'player-one', false, false)).toBe(true)
  })

  it('locks on pendingOpponentHandDiscard regardless of which playerId it names', () => {
    const discard = {
      playerId: 'player-two',
      count: 1,
      sourcePlayerId: 'player-one',
      sourceInstanceId: 'x',
      sourceCardName: 'Card',
      effectText: 'text',
    }
    const game = {
      ...baseGame(),
      pendingOpponentHandDiscard: discard,
    } as GameState
    expect(deriveInteractionLocked(game, 'player-one', false, false)).toBe(true)
    expect(deriveInteractionLocked(game, 'player-two', false, false)).toBe(true)
  })

  const viewerScopedCases: {
    name: string
    field: keyof GameState
    value: Record<string, unknown>
  }[] = [
    {
      name: 'pendingInspectDeck',
      field: 'pendingInspectDeck',
      value: {
        playerId: 'player-one',
        sourceInstanceId: 'x',
        sourceCardName: 'Card',
        revealedCards: [],
        lookCount: 1,
        pickCount: 1,
      },
    },
    {
      name: 'pendingOptionalCostAttack',
      field: 'pendingOptionalCostAttack',
      value: {
        playerId: 'player-one',
        sourceInstanceId: 'x',
        sourceCardName: 'Card',
        cost: {},
        effects: [],
        effectText: 'text',
      },
    },
    {
      name: 'pendingDrawUpTo',
      field: 'pendingDrawUpTo',
      value: {
        playerId: 'player-one',
        max: 5,
        sourcePlayerId: 'player-one',
        sourceInstanceId: 'x',
        sourceCardName: 'Card',
      },
    },
    {
      name: 'pendingStageTrigger',
      field: 'pendingStageTrigger',
      value: {
        playerId: 'player-one',
        sourceInstanceId: 'x',
        sourceCardName: 'Card',
        effectText: 'text',
      },
    },
  ]

  for (const { name, field, value } of viewerScopedCases) {
    it(`locks on ${name} only for the named player's viewpoint`, () => {
      const game = { ...baseGame(), [field]: value } as GameState
      expect(deriveInteractionLocked(game, 'player-one', false, false)).toBe(
        true,
      )
      expect(deriveInteractionLocked(game, 'player-two', false, false)).toBe(
        false,
      )
    })
  }

  it('locks on an unresolved pendingEffectOrder for the named player, not once resolved', () => {
    const unresolved = {
      ...baseGame(),
      pendingEffectOrder: { playerId: 'player-one', items: [] },
    } as GameState
    expect(
      deriveInteractionLocked(unresolved, 'player-one', false, false),
    ).toBe(true)
    expect(
      deriveInteractionLocked(unresolved, 'player-two', false, false),
    ).toBe(false)

    const resolved = {
      ...baseGame(),
      pendingEffectOrder: {
        playerId: 'player-one',
        items: [],
        resolvedOrder: [],
      },
    } as GameState
    expect(
      deriveInteractionLocked(resolved, 'player-one', false, false),
    ).toBe(false)
  })

  it('locks when the local pendingAiDecision extra is set', () => {
    expect(
      deriveInteractionLocked(baseGame(), 'player-one', false, false, {
        pendingAiDecision: true,
      }),
    ).toBe(true)
  })

  it('locks when the local aiThinking extra is set', () => {
    expect(
      deriveInteractionLocked(baseGame(), 'player-one', false, false, {
        aiThinking: true,
      }),
    ).toBe(true)
  })

  it('locks when the local aiControlsCurrentState extra is set', () => {
    expect(
      deriveInteractionLocked(baseGame(), 'player-one', false, false, {
        aiControlsCurrentState: true,
      }),
    ).toBe(true)
  })

  it('locks when the online viewerControlsState extra is explicitly false', () => {
    expect(
      deriveInteractionLocked(baseGame(), 'player-one', false, false, {
        viewerControlsState: false,
      }),
    ).toBe(true)
  })

  it('does not lock when viewerControlsState is true or omitted', () => {
    expect(
      deriveInteractionLocked(baseGame(), 'player-one', false, false, {
        viewerControlsState: true,
      }),
    ).toBe(false)
    expect(
      deriveInteractionLocked(baseGame(), 'player-one', false, false, {}),
    ).toBe(false)
  })
})
