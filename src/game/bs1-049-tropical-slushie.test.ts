import { describe, expect, it } from 'vitest'
import {
  canPlayItem,
  createDemoGame,
  getCardPoolEntry,
  createCard,
  type CookieCard,
  type GameCard,
  type GameState,
} from '.'

const asMainPhase = (state: GameState): GameState => ({
  ...state,
  phase: 'main',
  activePlayerId: 'player-one',
})

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

describe('BS1-049 Tropical Slushie requires a qualifying break-area count', () => {
  it('cannot be played when the break area has no LV.2+ yellow cookie', () => {
    const pool = getCardPoolEntry('BS1-049')!
    const itemCard = createCard(pool, 'player-one', 1)
    const base = asMainPhase(createDemoGame())
    const yellowSupport: GameCard = {
      id: 'y1',
      instanceId: 'y1',
      name: 'y1',
      type: 'item',
      energyColor: 'yellow',
    }
    const state: GameState = {
      ...base,
      players: {
        ...base.players,
        'player-one': {
          ...base.players['player-one'],
          hand: [itemCard],
          supportArea: [
            { card: yellowSupport, rested: false },
            { card: { ...yellowSupport, instanceId: 'y2' }, rested: false },
          ],
          breakArea: [makeCookie({ instanceId: 'low', level: 1, energyColor: 'yellow' })],
        },
      },
    }

    expect(canPlayItem(state, 'player-one', itemCard.instanceId)).toBe(false)
  })

  it('can be played once a LV.2+ yellow cookie is in the break area', () => {
    const pool = getCardPoolEntry('BS1-049')!
    const itemCard = createCard(pool, 'player-one', 1)
    const base = asMainPhase(createDemoGame())
    const yellowSupport: GameCard = {
      id: 'y1',
      instanceId: 'y1',
      name: 'y1',
      type: 'item',
      energyColor: 'yellow',
    }
    const state: GameState = {
      ...base,
      players: {
        ...base.players,
        'player-one': {
          ...base.players['player-one'],
          hand: [itemCard],
          supportArea: [
            { card: yellowSupport, rested: false },
            { card: { ...yellowSupport, instanceId: 'y2' }, rested: false },
          ],
          breakArea: [makeCookie({ instanceId: 'high', level: 2, energyColor: 'yellow' })],
        },
      },
    }

    expect(canPlayItem(state, 'player-one', itemCard.instanceId)).toBe(true)
  })
})
