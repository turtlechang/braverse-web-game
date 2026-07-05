import { describe, expect, it } from 'vitest'
import { createDemoGame, executeCardEffect, type CookieCard, type GameState } from '.'

const makeBreakCookie = (instanceId: string): CookieCard => ({
  id: instanceId,
  instanceId,
  name: instanceId,
  type: 'cookie',
  level: 1,
  hp: 2,
  attack: 1,
  attackCost: 1,
  energyColor: 'yellow',
})

const makeTarget = (instanceId: string): CookieCard => ({
  id: instanceId,
  instanceId,
  name: instanceId,
  type: 'cookie',
  level: 2,
  hp: 3,
  attack: 2,
  attackCost: 3,
})

describe('BS1-048 Jelly Pom-Poms', () => {
  it.each([
    [0, 0],
    [1, 0],
    [2, 1],
    [3, 1],
    [4, 2],
    [5, 2],
  ])(
    '%i matching {Y} LV.1 break area cookies grants +%i attack (for every 2)',
    (breakCount, expectedBonus) => {
      const base = createDemoGame()
      const target = makeTarget('target-cookie')
      const state: GameState = {
        ...base,
        players: {
          ...base.players,
          'player-one': {
            ...base.players['player-one'],
            battleArea: [{ card: target, hpCards: [], rested: false }],
            breakArea: Array.from({ length: breakCount }, (_, i) =>
              makeBreakCookie(`break-${i}`),
            ),
          },
        },
      }

      const resolved = executeCardEffect(
        state,
        { sourcePlayerId: 'player-one', sourceInstanceId: 'jelly-pom-poms' },
        {
          kind: 'modify-attack-by-break-count',
          perCount: 1,
          groupSize: 2,
          exactBreakLevel: 1,
          breakEnergyColor: 'yellow',
          duration: 'this-turn',
          target: { side: 'self', min: 0, max: 1 },
        },
        [target.instanceId],
      )

      const modifier = resolved.attackModifiers.find(
        (m) => m.targetInstanceId === target.instanceId,
      )
      if (expectedBonus === 0) {
        expect(modifier?.amount ?? 0).toBe(0)
      } else {
        expect(modifier?.amount).toBe(expectedBonus)
      }
    },
  )
})
