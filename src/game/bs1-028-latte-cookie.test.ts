import { describe, expect, it } from 'vitest'
import {
  createDemoGame,
  executeCardEffect,
  type CookieCard,
  type GameCard,
  type GameState,
} from '.'

const makeCookie = (
  overrides: Partial<CookieCard> & { instanceId: string },
): CookieCard => ({
  id: overrides.instanceId,
  name: overrides.instanceId,
  type: 'cookie',
  level: 2,
  hp: 3,
  attack: 2,
  attackCost: 3,
  ...overrides,
})

describe("BS1-028 Latte Cookie ({ap} Select up to 1 of your other Cookies. That Cookie gains +1 HP.)", () => {
  it('resolves as a no-op instead of throwing when the source is the only Cookie in the battle area', () => {
    const base = createDemoGame()
    const source = makeCookie({ instanceId: 'latte-cookie' })
    const state: GameState = {
      ...base,
      players: {
        ...base.players,
        'player-one': {
          ...base.players['player-one'],
          battleArea: [{ card: source, hpCards: [], rested: false }],
        },
      },
    }

    const resolved = executeCardEffect(
      state,
      { sourcePlayerId: 'player-one', sourceInstanceId: source.instanceId },
      {
        kind: 'gain-hp',
        amount: 1,
        target: { side: 'self', min: 0, max: 1, excludeSource: true },
      },
      [],
    )

    expect(resolved.players['player-one'].battleArea[0].hpCards).toHaveLength(0)
  })

  it('still gains +1 HP when a valid other Cookie is selected', () => {
    const base = createDemoGame()
    const source = makeCookie({ instanceId: 'latte-cookie' })
    const other = makeCookie({ instanceId: 'other-cookie' })
    const hpCards: GameCard[] = base.players['player-one'].deck.slice(0, 3)
    const state: GameState = {
      ...base,
      players: {
        ...base.players,
        'player-one': {
          ...base.players['player-one'],
          battleArea: [
            { card: source, hpCards: [], rested: false },
            { card: other, hpCards, rested: false },
          ],
        },
      },
    }

    const resolved = executeCardEffect(
      state,
      { sourcePlayerId: 'player-one', sourceInstanceId: source.instanceId },
      {
        kind: 'gain-hp',
        amount: 1,
        target: { side: 'self', min: 0, max: 1, excludeSource: true },
      },
      [other.instanceId],
    )

    const updatedOther = resolved.players['player-one'].battleArea.find(
      (cookie) => cookie.card.instanceId === other.instanceId,
    )
    expect(updatedOther?.hpCards).toHaveLength(4)
  })
})
