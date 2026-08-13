import { describe, expect, it } from 'vitest'
import {
  applyGameCommand,
  createCard,
  createDemoGame,
  getCardPoolEntry,
  takeAiStep,
  type GameState,
} from '.'

describe('BS6-043 Timecraft Garage pending effects', () => {
  it('skips the mandatory hand-to-break step when no yellow Cookie is in hand', () => {
    const base = createDemoGame()
    const stage = createCard(
      getCardPoolEntry('BS6-043')!,
      'player-one',
      1,
    )
    const state: GameState = {
      ...base,
      phase: 'end',
      activePlayerId: 'player-one',
      players: {
        ...base.players,
        'player-one': {
          ...base.players['player-one'],
          hand: [],
          stage: {
            card: {
              ...stage,
              stageAbility: { ...stage.stageAbility!, triggered: true },
            },
            rested: false,
          },
        },
      },
      pendingStageTrigger: {
        playerId: 'player-one',
        sourceInstanceId: stage.instanceId,
        sourceCardName: stage.name,
        effectText: stage.stageAbility?.text ?? '',
      },
    }

    const activated = applyGameCommand(state, {
      kind: 'resolve-stage-trigger',
      playerId: 'player-one',
      action: 'activate',
    })
    expect(activated.pendingAbilityEffect?.effectIndex).toBe(0)

    const skipped = takeAiStep(activated, 'player-one', {
      level: 4,
      seed: 20260814,
    })
    expect(skipped.action).not.toBe('error')
    expect(skipped.state.pendingAbilityEffect?.effectIndex).toBe(1)
  })
})
