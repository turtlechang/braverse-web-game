import { describe, expect, it } from 'vitest'
import { hasBlockingPending, type GameState } from '.'

const createState = (): GameState => ({
  players: {
    'player-one': {
      id: 'player-one',
      name: '玩家一',
      deck: [],
      hand: [],
      battleArea: [],
      supportArea: [],
      breakArea: [],
      discardPile: [],
      stage: null,
      hasMulliganed: true,
      startingCookieSelected: true,
    },
    'player-two': {
      id: 'player-two',
      name: '玩家二',
      deck: [],
      hand: [],
      battleArea: [],
      supportArea: [],
      breakArea: [],
      discardPile: [],
      stage: null,
      hasMulliganed: true,
      startingCookieSelected: true,
    },
  },
  firstPlayerId: 'player-one',
  activePlayerId: 'player-one',
  turnNumber: 1,
  phase: 'main',
  status: 'playing',
  result: null,
  supportPlacedThisTurn: false,
  skillUsesThisTurn: [],
  nextBattleEntrySequence: 1,
  attackModifiers: [],
  damageReceivedModifiers: [],
  pendingReplacement: null,
  departedCookieCounts: {
    'player-one': 0,
    'player-two': 0,
  },
  pendingOnPlay: null,
  pendingRefresh: null,
  pendingBattle: null,
  pendingFaintEffects: [],
  pendingOpponentHandDiscard: null,
})

describe('hasBlockingPending', () => {
  it('returns false when no blocking pending state exists', () => {
    expect(hasBlockingPending(createState())).toBe(false)
  })

  it('returns true when any blocking pending state exists', () => {
    const base = createState()

    expect(
      hasBlockingPending({
        ...base,
        pendingReplacement: {
          tasks: [{ playerId: 'player-one', remaining: 1 }],
        },
      }),
    ).toBe(true)
    expect(
      hasBlockingPending({
        ...base,
        pendingOnPlay: {
          playerId: 'player-one',
          sourceInstanceId: 'cookie-1',
        },
      }),
    ).toBe(true)
    expect(
      hasBlockingPending({
        ...base,
        pendingRefresh: { playerId: 'player-one', remainingDraws: 0 },
      }),
    ).toBe(true)
    expect(
      hasBlockingPending({
        ...base,
        pendingBattle: {
          attackerPlayerId: 'player-one',
          defenderPlayerId: 'player-two',
          attackerInstanceId: 'attacker',
          targetInstanceId: 'target',
          declaredDamage: 1,
          remainingDamage: 1,
          stage: 'damage',
          trapUsed: false,
          revealedHpCard: null,
          preventKnockoutTargetIds: [],
          faintedColors: [],
          attackEffects: [],
          attackEffectIndex: 0,
        },
      }),
    ).toBe(true)
    expect(
      hasBlockingPending({
        ...base,
        pendingFaintEffects: [
          {
            sourcePlayerId: 'player-one',
            sourceInstanceId: 'source',
            context: {
              sourcePlayerId: 'player-one',
              sourceInstanceId: 'source',
            },
            effect: {
              kind: 'damage',
              amount: 1,
              target: { side: 'opponent', min: 0, max: 1 },
            },
          },
        ],
      }),
    ).toBe(true)
    expect(
      hasBlockingPending({
        ...base,
        pendingOpponentHandDiscard: {
          playerId: 'player-two',
          count: 1,
          sourcePlayerId: 'player-one',
          sourceInstanceId: 'source',
          sourceCardName: 'source',
          effectText: 'discard',
        },
      }),
    ).toBe(true)
  })
})
