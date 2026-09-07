import { describe, expect, it } from 'vitest'
import {
  getLegalTurnCommands,
  type ExtraDeckCard,
  type GameState,
} from '.'
import { handleAiRandomTurnState } from './ai/random-turn-handler'
import { handleAiTurnState, type AiTurnStrategy } from './ai/turn-handler'
import { createBattleState, item } from './test-helpers/battle-helpers'

const minimalStrategy: AiTurnStrategy = {
  chooseEffectTargets: () => [],
  resolveCardAbility: () => null,
  resolveSkill: () => null,
  chooseReplacement: () => undefined,
  chooseAttackTarget: () => undefined,
}

const avatar = (requirement?: ExtraDeckCard['playRequirement']): ExtraDeckCard => ({
  id: 'BS8-005',
  instanceId: 'bs8-avatar-extra',
  name: 'Avatar of Ruin Cookie',
  type: 'extra',
  level: 3,
  hp: 5,
  attack: 3,
  attackCost: 3,
  ...(requirement ? { playRequirement: requirement } : {}),
})

const createAiExtraState = (
  requirement?: ExtraDeckCard['playRequirement'],
): GameState => {
  const state = createBattleState()
  return {
    ...state,
    players: {
      ...state.players,
      'player-two': {
        ...state.players['player-two'],
        hand: [],
        deck: Array.from({ length: 5 }, (_, index) => item(`extra-hp-${index}`)),
        extraDeck: [avatar(requirement)],
      },
    },
  }
}

describe('AI EXTRA Deck command handling', () => {
  it('lets Lv.1 choose a legal EXTRA deployment and reports the card name', () => {
    const state = createAiExtraState()
    const commands = getLegalTurnCommands(state, 'player-two')
    const extraIndex = commands.findIndex(
      (command) => command.kind === 'play-extra-deck-cookie',
    )

    expect(extraIndex).toBeGreaterThanOrEqual(0)

    const decision = handleAiRandomTurnState(
      state,
      'player-two',
      () => extraIndex / commands.length,
    )

    expect(decision.action).toBe('deploy-cookie')
    expect(decision.description).toContain('Avatar of Ruin Cookie')
    expect(
      decision.state.players['player-two'].battleArea.some(
        (entry) => entry.card.instanceId === 'bs8-avatar-extra',
      ),
    ).toBe(true)
  })

  it('lets Lv.2 use a legal direct-play EXTRA when it has no hand deployment', () => {
    const decision = handleAiTurnState(createAiExtraState(), 'player-two', minimalStrategy)

    expect(decision.action).toBe('deploy-cookie')
    expect(decision.description).toContain('Avatar of Ruin Cookie')
    expect(
      decision.state.players['player-two'].battleArea.some(
        (entry) => entry.card.instanceId === 'bs8-avatar-extra',
      ),
    ).toBe(true)
  })

  it('does not let Lv.2 bypass an unmet EXTRA play requirement', () => {
    const decision = handleAiTurnState(
      createAiExtraState({
        kind: 'cookies-fainted-this-turn-at-least',
        side: 'self',
        count: 2,
      }),
      'player-two',
      minimalStrategy,
    )

    expect(decision.action).toBe('advance-phase')
    expect(
      decision.state.players['player-two'].battleArea.some(
        (entry) => entry.card.instanceId === 'bs8-avatar-extra',
      ),
    ).toBe(false)
  })
})
