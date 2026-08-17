import { describe, expect, it } from 'vitest'
import {
  compileEffectDecisionDescriptor,
  compilePendingDecisionDescriptor,
} from './decision-descriptor-compiler'
import { createDemoGame } from './demo'
import type { CardEffect, GameState } from './types'

const damageEffect = (side: 'self' | 'opponent'): CardEffect => ({
  kind: 'damage',
  amount: 1,
  target: { side, min: 1, max: 1 },
})

const withPublicSupport = (state: GameState): GameState => {
  const player = state.players['player-one']
  const support = player.deck.find((card) => card.type !== 'cookie')
  if (!support) throw new Error('fixture needs a support card')
  return {
    ...state,
    players: {
      ...state.players,
      'player-one': {
        ...player,
        deck: player.deck.filter((card) => card.instanceId !== support.instanceId),
        supportArea: [{ card: support, rested: false }],
      },
    },
  }
}

describe('runtime decision descriptor compiler', () => {
  it('compiles payment, cost, target, then resolve from public rules candidates', () => {
    const state = withPublicSupport(createDemoGame(21))
    const source = state.players['player-one'].battleArea[0]
    const target = state.players['player-two'].battleArea[0]
    const descriptor = compileEffectDecisionDescriptor({
      state,
      playerId: 'player-one',
      sourcePlayerId: 'player-one',
      sourceInstanceId: source.card.instanceId,
      sourceCardName: source.card.name,
      context: {
        sourcePlayerId: 'player-one',
        sourceInstanceId: source.card.instanceId,
      },
      payment: { red: 1 },
      cost: { discardHand: 1 },
      effect: damageEffect('opponent'),
      viewerPlayerId: 'player-one',
    })

    expect(descriptor.status).toBe('ready')
    expect(descriptor.steps.map((step) => step.kind)).toEqual([
      'payment',
      'cost',
      'target',
      'resolve',
    ])
    expect(descriptor.steps[0]).toMatchObject({
      candidateSource: 'public-support',
      payment: { red: 1 },
    })
    expect(descriptor.steps[1]).toMatchObject({
      candidateSource: 'private-hand',
      min: 1,
      max: 1,
    })
    expect(descriptor.steps[2]).toMatchObject({
      candidateIds: [target.card.instanceId],
      candidateSource: 'public-battle',
    })
  })

  it('does not expose a private hand when compiling for the other player', () => {
    const state = createDemoGame(22)
    const decision = {
      kind: 'opponent-hand-discard' as const,
      playerId: 'player-two' as const,
      sourcePlayerId: 'player-one' as const,
      sourceInstanceId: state.players['player-one'].battleArea[0].card.instanceId,
      sourceCardName: 'public effect',
      effectText: 'discard',
      count: 1,
    }
    const descriptor = compilePendingDecisionDescriptor(state, decision, {
      viewerPlayerId: 'player-one',
    })

    expect(descriptor?.steps[0].candidateIds).toEqual([])
    expect(descriptor?.status).toBe('needs-review')
    expect(descriptor?.blockers).toContain(
      'private hand candidates are withheld from a non-owner view',
    )
  })

  it('uses only explicitly revealed cards for inspect-deck candidates', () => {
    const state = createDemoGame(24)
    const source = state.players['player-one'].battleArea[0]
    const hiddenDeckId = state.players['player-one'].deck[0]?.instanceId
    const decision = {
      kind: 'inspect-deck' as const,
      playerId: 'player-one' as const,
      sourcePlayerId: 'player-one' as const,
      sourceInstanceId: source.card.instanceId,
      sourceCardName: source.card.name,
      lookCount: 3,
      pickCount: 1,
      revealedCardIds: ['known-reveal'],
    }

    const descriptor = compilePendingDecisionDescriptor(state, decision, {
      viewerPlayerId: 'player-one',
    })

    expect(descriptor?.steps[0].candidateIds).toEqual(['known-reveal'])
    expect(descriptor?.steps[0].candidateIds).not.toContain(hiddenDeckId)
  })

  it('adds the attack target step to an optional-cost attack without guessing hidden cards', () => {
    const state = withPublicSupport(createDemoGame(23))
    const source = state.players['player-one'].battleArea[0]
    const target = state.players['player-two'].battleArea[0]
    const next: GameState = {
      ...state,
      pendingOptionalCostAttack: {
        playerId: 'player-one',
        sourceInstanceId: source.card.instanceId,
        sourceCardName: source.card.name,
        cost: { energy: { red: 1 } },
        effects: [damageEffect('opponent')],
        effectText: 'optional attack effect',
      },
    }

    const descriptor = compilePendingDecisionDescriptor(next, undefined, {
      viewerPlayerId: 'player-one',
    })

    expect(descriptor?.steps[0]).toMatchObject({
      kind: 'payment',
      candidateIds: [next.players['player-one'].supportArea[0].card.instanceId],
      payment: { red: 1 },
    })
    expect(descriptor?.steps.find((step) => step.kind === 'target')).toMatchObject({
      candidateIds: [target.card.instanceId],
    })
  })
})
