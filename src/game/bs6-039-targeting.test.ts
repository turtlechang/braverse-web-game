import { describe, expect, it } from 'vitest'
import {
  canActivateCookieSkill,
  createCard,
  createDemoGame,
  getCardPoolEntry,
  takeAiStep,
  type CookieCard,
  type GameState,
} from '.'

const makeCookie = (instanceId: string): CookieCard => ({
  id: instanceId,
  instanceId,
  name: instanceId,
  type: 'cookie',
  level: 1,
  hp: 2,
  attack: 1,
  attackCost: 0,
  energyColor: 'yellow',
})

const buildState = (opponentBreakArea: CookieCard[]): {
  state: GameState
  source: CookieCard
} => {
  const base = createDemoGame()
  const source = createCard(
    getCardPoolEntry('BS6-039')!,
    'player-one',
    1,
  ) as CookieCard

  return {
    source,
    state: {
      ...base,
      phase: 'main',
      activePlayerId: 'player-one',
      pendingOnPlay: {
        playerId: 'player-one',
        sourceInstanceId: source.instanceId,
      },
      players: {
        ...base.players,
        'player-one': {
          ...base.players['player-one'],
          battleArea: [{ card: source, hpCards: [], rested: false }],
          supportArea: [
            {
              card: {
                id: 'yellow-support',
                instanceId: 'yellow-support',
                name: 'Yellow Support',
                type: 'item',
                energyColor: 'yellow',
              },
              rested: false,
            },
          ],
        },
        'player-two': {
          ...base.players['player-two'],
          breakArea: opponentBreakArea,
        },
      },
    },
  }
}

describe('BS6-039 Croissant Cookie target availability', () => {
  it('does not offer On Play when the opponent has no Cookie in the break area', () => {
    const { state, source } = buildState([])

    expect(
      canActivateCookieSkill(
        state,
        'player-one',
        source.instanceId,
        'on-play',
      ),
    ).toBe(false)
  })

  it('offers On Play when the mandatory break-area Cookie exists', () => {
    const { state, source } = buildState([makeCookie('opponent-break-cookie')])

    expect(
      canActivateCookieSkill(
        state,
        'player-one',
        source.instanceId,
        'on-play',
      ),
    ).toBe(true)
  })

  it('lets AI resolve the mandatory and optional steps without throwing', () => {
    const { state, source } = buildState([makeCookie('opponent-break-cookie')])

    const activated = takeAiStep(state, 'player-one', { level: 4, seed: 7 })
    expect(activated.action).toBe('activate-skill')
    expect(activated.error).toBeUndefined()
    expect(activated.state.pendingAbilityEffect?.sourceInstanceId).toBe(
      source.instanceId,
    )

    const firstSelection = takeAiStep(activated.state, 'player-one', {
      level: 4,
      seed: 7,
    })
    expect(firstSelection.action).not.toBe('error')

    const secondSelection = takeAiStep(firstSelection.state, 'player-one', {
      level: 4,
      seed: 7,
    })
    expect(secondSelection.action).not.toBe('error')
  })
})
