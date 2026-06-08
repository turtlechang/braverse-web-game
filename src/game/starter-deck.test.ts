import { describe, expect, it } from 'vitest'
import {
  createDemoGame,
  createOfficialStarterDeck,
  OFFICIAL_STARTER_DECK_RED,
} from '.'

describe('official Starter Deck RED', () => {
  it('contains 22 card numbers and exactly 60 cards', () => {
    expect(OFFICIAL_STARTER_DECK_RED).toHaveLength(22)
    expect(
      OFFICIAL_STARTER_DECK_RED.reduce(
        (total, entry) => total + entry.count,
        0,
      ),
    ).toBe(60)
  })

  it('creates the official quantity for every card number', () => {
    const deck = createOfficialStarterDeck('player-one')
    const counts = deck.reduce<Record<string, number>>((result, card) => {
      result[card.id] = (result[card.id] ?? 0) + 1
      return result
    }, {})

    expect(deck).toHaveLength(60)
    for (const entry of OFFICIAL_STARTER_DECK_RED) {
      expect(counts[entry.cardNumber]).toBe(entry.count)
    }
  })

  it('uses the official recipe for both demo players', () => {
    const state = createDemoGame()

    for (const player of Object.values(state.players)) {
      const cards = [
        ...player.deck,
        ...player.hand,
        ...player.battleArea.map((cookie) => cookie.card),
        ...player.battleArea.flatMap((cookie) => cookie.hpCards),
      ]
      expect(cards).toHaveLength(60)
      expect(cards.filter((card) => card.id === 'ST1-001')).toHaveLength(4)
      expect(cards.filter((card) => card.id === 'ST1-022')).toHaveLength(2)
    }
  })

  it('recreates the same opening state from the same seed', () => {
    const first = createDemoGame(7)
    const repeated = createDemoGame(7)
    const different = createDemoGame(8)
    const getOpeningSignature = (state: ReturnType<typeof createDemoGame>) =>
      Object.values(state.players).map((player) => ({
        battle: player.battleArea[0].card.instanceId,
        hand: player.hand.map((card) => card.instanceId),
        deck: player.deck.map((card) => card.instanceId),
      }))

    expect(getOpeningSignature(first)).toEqual(getOpeningSignature(repeated))
    expect(getOpeningSignature(different)).not.toEqual(
      getOpeningSignature(first),
    )
  })
})
