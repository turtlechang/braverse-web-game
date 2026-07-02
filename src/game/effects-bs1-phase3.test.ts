import { describe, expect, it } from 'vitest'
import {
  createDemoGame,
  executeCardEffect,
  type CardEffect,
  type CookieCard,
} from '.'
import { GameRuleError } from './errors'

const context = {
  sourcePlayerId: 'player-one' as const,
  sourceInstanceId: 'player-one-bs1-source',
}

describe('BS1 Phase 3 shared effects', () => {
  it('damage-all damages every opponent battle cookie', () => {
    const base = createDemoGame()
    const opponent = base.players['player-two']
    const extraCookie = {
      ...(opponent.battleArea[0].card as CookieCard),
      instanceId: 'opponent-extra-cookie',
    }
    const hpCards = opponent.deck.slice(0, 4)
    const state = {
      ...base,
      players: {
        ...base.players,
        'player-two': {
          ...opponent,
          deck: opponent.deck.slice(4),
          battleArea: [
            {
              ...opponent.battleArea[0],
              hpCards: hpCards.slice(0, 2),
            },
            {
              card: extraCookie,
              hpCards: hpCards.slice(2, 4),
              rested: false,
              battleEntryId: 'opponent-extra-cookie:battle:99',
            },
          ],
        },
      },
    }
    const effect: CardEffect = {
      kind: 'damage-all',
      amount: 1,
      side: 'opponent',
    }

    const next = executeCardEffect(state, context, effect, [])

    expect(next.players['player-two'].battleArea).toHaveLength(2)
    expect(next.players['player-two'].battleArea[0].hpCards).toHaveLength(1)
    expect(next.players['player-two'].battleArea[1].hpCards).toHaveLength(1)
    expect(next.players['player-two'].discardPile).toHaveLength(
      opponent.discardPile.length + 2,
    )
  })

  it('damage-by-break-count calculates damage from matching break cookies', () => {
    const base = createDemoGame()
    const sourceCookie = base.players['player-one'].battleArea[0].card as CookieCard
    const breakCookies = [
      { ...sourceCookie, instanceId: 'break-lv2-a', level: 2 },
      { ...sourceCookie, instanceId: 'break-lv2-b', level: 2 },
    ]
    const target = base.players['player-two'].battleArea[0]
    const hpCards = base.players['player-two'].deck.slice(0, 3)
    const state = {
      ...base,
      players: {
        ...base.players,
        'player-one': {
          ...base.players['player-one'],
          breakArea: breakCookies,
        },
        'player-two': {
          ...base.players['player-two'],
          deck: base.players['player-two'].deck.slice(3),
          battleArea: [{ ...target, hpCards }],
        },
      },
    }
    const effect: CardEffect = {
      kind: 'damage-by-break-count',
      perCount: 1,
      minBreakLevel: 2,
      target: { side: 'opponent', min: 1, max: 1 },
    }

    const next = executeCardEffect(state, context, effect, [
      target.card.instanceId,
    ])

    expect(next.players['player-two'].battleArea[0].hpCards).toHaveLength(1)
    expect(next.players['player-two'].discardPile).toHaveLength(
      base.players['player-two'].discardPile.length + 2,
    )
  })

  it('discard-hand creates a discard pending for the source player', () => {
    const state = createDemoGame()
    const effect: CardEffect = { kind: 'discard-hand', count: 1 }

    const next = executeCardEffect(state, context, effect, [])

    expect(next.pendingOpponentHandDiscard).toMatchObject({
      playerId: 'player-one',
      count: 1,
      sourcePlayerId: 'player-one',
    })
  })

  it('support-to-hand can require a maximum cookie level', () => {
    const base = createDemoGame()
    const lv1Support = {
      ...(base.players['player-one'].battleArea[0].card as CookieCard),
      instanceId: 'support-lv1-cookie',
      level: 1,
    }
    const lv2Support = {
      ...lv1Support,
      instanceId: 'support-lv2-cookie',
      level: 2,
    }
    const state = {
      ...base,
      players: {
        ...base.players,
        'player-one': {
          ...base.players['player-one'],
          supportArea: [
            { card: lv1Support, rested: false },
            { card: lv2Support, rested: false },
          ],
        },
      },
    }
    const effect: CardEffect = {
      kind: 'support-to-hand',
      amount: 1,
      maxLevel: 1,
    }

    expect(() =>
      executeCardEffect(state, context, effect, [lv2Support.instanceId]),
    ).toThrow(GameRuleError)

    const next = executeCardEffect(state, context, effect, [
      lv1Support.instanceId,
    ])
    expect(next.players['player-one'].supportArea).toHaveLength(1)
    expect(next.players['player-one'].hand).toContainEqual(lv1Support)
  })
})
