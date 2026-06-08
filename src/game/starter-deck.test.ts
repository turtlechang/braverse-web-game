import { describe, expect, it } from 'vitest'
import {
  createDemoGame,
  createOfficialRedStarterDeck,
  createOfficialYellowStarterDeck,
  OFFICIAL_RED_STARTER_DECK,
  OFFICIAL_YELLOW_STARTER_DECK,
  type StarterDeckEntry,
} from '.'

const expectStarterDeckRecipe = (
  recipe: StarterDeckEntry[],
  expectedDistinctCards: number,
) => {
  expect(recipe).toHaveLength(expectedDistinctCards)
  expect(
    recipe.reduce((total, entry) => total + entry.count, 0),
  ).toBe(60)
}

const expectCreatedDeckMatchesRecipe = (
  deck: ReturnType<typeof createOfficialRedStarterDeck>,
  recipe: StarterDeckEntry[],
) => {
  const counts = deck.reduce<Record<string, number>>((result, card) => {
    result[card.id] = (result[card.id] ?? 0) + 1
    return result
  }, {})

  expect(deck).toHaveLength(60)
  for (const entry of recipe) {
    expect(counts[entry.cardNumber]).toBe(entry.count)
  }
}

describe('official red starter deck', () => {
  it('contains 22 card numbers and exactly 60 cards', () => {
    expectStarterDeckRecipe(OFFICIAL_RED_STARTER_DECK, 22)
  })

  it('creates the official quantity for every card number', () => {
    expectCreatedDeckMatchesRecipe(
      createOfficialRedStarterDeck('player-one'),
      OFFICIAL_RED_STARTER_DECK,
    )
  })

  it('uses the official red recipe for both demo players', () => {
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

describe('official yellow starter deck', () => {
  it('contains 20 card numbers and exactly 60 cards', () => {
    expectStarterDeckRecipe(OFFICIAL_YELLOW_STARTER_DECK, 20)
    expect(
      OFFICIAL_YELLOW_STARTER_DECK.map((entry) => entry.cardNumber),
    ).not.toContain('ST2-017')
  })

  it('creates the official quantity for every card number', () => {
    expectCreatedDeckMatchesRecipe(
      createOfficialYellowStarterDeck('player-two'),
      OFFICIAL_YELLOW_STARTER_DECK,
    )
  })

  it('creates yellow cards from the official Starter Deck YELLOW sample', () => {
    const deck = createOfficialYellowStarterDeck('player-one')
    const roguefort = deck.find((card) => card.id === 'ST2-001')
    const strawberry = deck.find((card) => card.id === 'ST2-002')
    const windingKeyShield = deck.find((card) => card.id === 'ST2-020')

    expect(roguefort).toMatchObject({
      name: 'Roguefort Cookie',
      type: 'cookie',
      energyColor: 'yellow',
    })
    expect(strawberry).toMatchObject({
      name: 'Strawberry Cookie',
      type: 'cookie',
      energyColor: 'wild',
    })
    expect(windingKeyShield).toMatchObject({
      name: 'Winding Key Shield',
      type: 'trap',
      effects: [
        {
          kind: 'modify-attack',
          amount: -3,
          condition: {
            kind: 'break-level-at-least',
            level: 5,
          },
        },
      ],
    })
  })
})
