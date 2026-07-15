import { describe, expect, it } from 'vitest'
import { applyGameCommand, createItemUsageDemoState, type GameState } from '.'

describe('guided ability begin commands', () => {
  it('can pay and resolve the first effect in one final confirmation', () => {
    const base = createItemUsageDemoState(true)
    const originalSource = base.players['player-one'].battleArea[0]
    const drawCard = {
      ...base.players['player-one'].hand[0],
      instanceId: 'guided-draw-card',
    }
    const sourceCard = {
      ...originalSource.card,
      skill: {
        trigger: 'activate' as const,
        oncePerTurn: false,
        yourTurn: true,
        restSource: false,
        cost: { energy: {} },
        text: 'Draw 1 card.',
        effects: [{ kind: 'draw' as const, amount: 1 }],
      },
    }
    const game: GameState = {
      ...base,
      activePlayerId: 'player-one',
      phase: 'main',
      pendingAbilityEffect: undefined,
      players: {
        ...base.players,
        'player-one': {
          ...base.players['player-one'],
          battleArea: [{ ...originalSource, card: sourceCard }],
          deck: [drawCard, ...base.players['player-one'].deck],
        },
      },
    }
    const handCount = game.players['player-one'].hand.length

    const result = applyGameCommand(game, {
      kind: 'begin-activate-skill',
      playerId: 'player-one',
      sourceInstanceId: sourceCard.instanceId,
      trigger: 'activate',
      paymentIds: [],
      targetIds: [],
    })

    expect(result.players['player-one'].hand).toHaveLength(handCount + 1)
    expect(result.players['player-one'].hand).toContainEqual(drawCard)
    expect(result.pendingAbilityEffect).toBeUndefined()
  })
})
