import { describe, expect, it } from 'vitest'
import {
  canActivateCookieSkill,
  createDemoGame,
  getCardPoolEntry,
  createCard,
  type CookieCard,
  type GameState,
} from '.'

const makeCookie = (
  overrides: Partial<CookieCard> & { instanceId: string },
): CookieCard => ({
  id: overrides.instanceId,
  name: overrides.instanceId,
  type: 'cookie',
  level: 1,
  hp: 2,
  attack: 1,
  attackCost: 0,
  ...overrides,
})

describe('BS1-036 Snake Fruit Cookie on-play skill respects the battle area cap', () => {
  it('does not offer the on-play skill when the battle area already holds 2 cookies', () => {
    const pool = getCardPoolEntry('BS1-036')!
    const snakeFruit = createCard(pool, 'player-one', 1) as CookieCard
    const other = makeCookie({ instanceId: 'other-cookie' })
    const breakCookie = makeCookie({ instanceId: 'break-cookie', level: 1, energyColor: 'yellow' })

    const base = createDemoGame()
    const state: GameState = {
      ...base,
      phase: 'main',
      activePlayerId: 'player-one',
      pendingOnPlay: { playerId: 'player-one', sourceInstanceId: snakeFruit.instanceId },
      players: {
        ...base.players,
        'player-one': {
          ...base.players['player-one'],
          battleArea: [
            { card: snakeFruit, hpCards: [], rested: false },
            { card: other, hpCards: [], rested: false },
          ],
          breakArea: [breakCookie],
          supportArea: [
            { card: { id: 'y1', instanceId: 'y1', name: 'y1', type: 'item', energyColor: 'yellow' }, rested: false },
            { card: { id: 'y2', instanceId: 'y2', name: 'y2', type: 'item', energyColor: 'yellow' }, rested: false },
          ],
        },
      },
    }

    expect(
      canActivateCookieSkill(state, 'player-one', snakeFruit.instanceId, 'on-play'),
    ).toBe(false)
  })

  it('offers the on-play skill when the battle area only has this Cookie', () => {
    const pool = getCardPoolEntry('BS1-036')!
    const snakeFruit = createCard(pool, 'player-one', 1) as CookieCard
    const breakCookie = makeCookie({ instanceId: 'break-cookie', level: 1, energyColor: 'yellow' })

    const base = createDemoGame()
    const state: GameState = {
      ...base,
      phase: 'main',
      activePlayerId: 'player-one',
      pendingOnPlay: { playerId: 'player-one', sourceInstanceId: snakeFruit.instanceId },
      players: {
        ...base.players,
        'player-one': {
          ...base.players['player-one'],
          battleArea: [{ card: snakeFruit, hpCards: [], rested: false }],
          breakArea: [breakCookie],
          supportArea: [
            { card: { id: 'y1', instanceId: 'y1', name: 'y1', type: 'item', energyColor: 'yellow' }, rested: false },
            { card: { id: 'y2', instanceId: 'y2', name: 'y2', type: 'item', energyColor: 'yellow' }, rested: false },
          ],
        },
      },
    }

    expect(
      canActivateCookieSkill(state, 'player-one', snakeFruit.instanceId, 'on-play'),
    ).toBe(true)
  })
})
