import { describe, expect, it } from 'vitest'
import {
  createDemoGame,
  createOfficialGreenStarterDeck,
  createOfficialRedStarterDeck,
  createOfficialYellowStarterDeck,
  OFFICIAL_GREEN_STARTER_DECK,
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

  it('ST2-001 Roguefort Cookie has opponent-discard-hand OnPlay skill', () => {
    const deck = createOfficialYellowStarterDeck('player-one')
    const roguefort = deck.find((card) => card.id === 'ST2-001')!
    expect(roguefort.skill).toBeTruthy()
    expect(roguefort.skill!.trigger).toBe('on-play')
    expect(roguefort.skill!.cost).toEqual({ energy: { yellow: 1 }, discardHand: 0 })
    expect(roguefort.effectText).toBeTruthy()
    expect(roguefort.skill!.effects).toEqual([
      { kind: 'opponent-discard-hand', count: 1 },
    ])
  })

  it('ST2-003 Wizard Cookie has its post-attack break-to-trash effect', () => {
    const deck = createOfficialYellowStarterDeck('player-one')
    const wizard = deck.find((card) => card.id === 'ST2-003')

    expect(wizard).toMatchObject({
      name: 'Wizard Cookie',
      type: 'cookie',
      attackEffects: [
        { kind: 'break-to-trash', max: 1, exactLevel: 1 },
      ],
    })
  })

  it('creates a demo game using the yellow deck', () => {
    const state = createDemoGame(undefined, 'yellow')

    for (const player of Object.values(state.players)) {
      const cards = [
        ...player.deck,
        ...player.hand,
        ...player.battleArea.map((cookie) => cookie.card),
        ...player.battleArea.flatMap((cookie) => cookie.hpCards),
      ]
      expect(cards).toHaveLength(60)
      expect(cards.filter((card) => card.id === 'ST2-001')).toHaveLength(2)
      expect(cards.filter((card) => card.id === 'ST2-020')).toHaveLength(2)
    }
  })
})

describe('official green starter deck', () => {
  it('contains 22 card numbers and exactly 60 cards', () => {
    expectStarterDeckRecipe(OFFICIAL_GREEN_STARTER_DECK, 22)
  })

  it('creates the official quantity for every card number', () => {
    expectCreatedDeckMatchesRecipe(
      createOfficialGreenStarterDeck('player-two'),
      OFFICIAL_GREEN_STARTER_DECK,
    )
  })

  it('creates green cards from the official Starter Deck GREEN sample', () => {
    const deck = createOfficialGreenStarterDeck('player-one')
    const muscle = deck.find((card) => card.id === 'ST3-001')
    const vampire = deck.find((card) => card.id === 'ST3-004')
    const gingerBright = deck.find((card) => card.id === 'ST3-003')
    const vineyVines = deck.find((card) => card.id === 'ST3-017')

    expect(muscle).toMatchObject({
      name: 'Muscle Cookie',
      type: 'cookie',
      energyColor: 'green',
      attackEnergyCost: { green: 1, neutral: 1 },
    })
    expect(vampire).toMatchObject({
      name: 'Vampire Cookie',
      type: 'cookie',
      energyColor: 'green',
      skill: {
        trigger: 'on-play',
        oncePerTurn: false,
        cost: {
          energy: { green: 3, neutral: 1 },
          discardHand: 0,
        },
        effects: [
          {
            kind: 'damage',
            amount: 2,
            target: { side: 'opponent', min: 0, max: 1 },
          },
          {
            kind: 'gain-hp',
            amount: 1,
            target: { side: 'self', min: 1, max: 1, sourceOnly: true },
          },
        ],
      },
    })
    expect(gingerBright).toMatchObject({
      name: 'GingerBright',
      type: 'cookie',
      energyColor: 'wild',
    })
    expect(vineyVines).toMatchObject({
      name: 'Viney Vines',
      type: 'item',
    })
    expect(vineyVines).toMatchObject({
      effects: [
        { kind: 'damage', amount: 1 },
        { kind: 'support-to-trash', amount: 1 },
      ],
      item: {
        cost: { green: 2 },
      },
    })

    const guardianTree = deck.find((card) => card.id === 'ST3-022')
    expect(guardianTree).toMatchObject({
      name: "Guardian Tree's Blessing",
      type: 'stage',
      stageAbility: {
        placementCost: { green: 1 },
        effects: [
          { kind: 'support-to-hand', amount: 1 },
          { kind: 'draw', amount: 1 },
        ],
        restSource: true,
      },
    })
  })

  it('creates a demo game using the green deck', () => {
    const state = createDemoGame(undefined, 'green')

    for (const player of Object.values(state.players)) {
      const cards = [
        ...player.deck,
        ...player.hand,
        ...player.battleArea.map((cookie) => cookie.card),
        ...player.battleArea.flatMap((cookie) => cookie.hpCards),
      ]
      expect(cards).toHaveLength(60)
      expect(cards.filter((card) => card.id === 'ST3-001')).toHaveLength(4)
      expect(cards.filter((card) => card.id === 'ST3-022')).toHaveLength(2)
    }
  })
})

describe('different decks for player and AI', () => {
  it('supports separate deck choices for each side', () => {
    const state = createDemoGame(undefined, {
      player: 'red',
      ai: 'yellow',
    })

    const playerCards = [
      ...state.players['player-one'].deck,
      ...state.players['player-one'].hand,
      ...state.players['player-one'].battleArea.map((cookie) => cookie.card),
      ...state.players['player-one'].battleArea.flatMap((cookie) => cookie.hpCards),
    ]
    const aiCards = [
      ...state.players['player-two'].deck,
      ...state.players['player-two'].hand,
      ...state.players['player-two'].battleArea.map((cookie) => cookie.card),
      ...state.players['player-two'].battleArea.flatMap((cookie) => cookie.hpCards),
    ]

    expect(playerCards).toHaveLength(60)
    expect(aiCards).toHaveLength(60)
    expect(playerCards.filter((card) => card.id === 'ST1-001')).toHaveLength(4)
    expect(aiCards.filter((card) => card.id === 'ST2-001')).toHaveLength(2)
    expect(aiCards.filter((card) => card.id === 'ST1-001')).toHaveLength(0)
  })

  it('accepts a single string for backward compatibility', () => {
    const state = createDemoGame(undefined, 'yellow')

    for (const player of Object.values(state.players)) {
      const cards = [
        ...player.deck,
        ...player.hand,
        ...player.battleArea.map((cookie) => cookie.card),
        ...player.battleArea.flatMap((cookie) => cookie.hpCards),
      ]
      expect(cards.filter((card) => card.id === 'ST2-001')).toHaveLength(2)
    }
  })
})

describe('official FLIP and TRAP abilities', () => {
  it('drives every starter-deck FLIP from flipText', () => {
    for (const createDeck of [
      createOfficialRedStarterDeck,
      createOfficialYellowStarterDeck,
      createOfficialGreenStarterDeck,
    ]) {
      const flipCards = createDeck('player-one').filter(
        (card) => card.officialType === 'flip',
      )

      expect(flipCards.length).toBeGreaterThan(0)
      expect(flipCards.every((card) => Boolean(card.flip?.text))).toBe(true)
      expect(
        flipCards.every((card) => (card.flip?.effects.length ?? 0) > 0),
      ).toBe(true)
    }
  })

  it('drives every starter-deck TRAP from attackText', () => {
    for (const createDeck of [
      createOfficialRedStarterDeck,
      createOfficialYellowStarterDeck,
      createOfficialGreenStarterDeck,
    ]) {
      const trapCards = createDeck('player-two').filter(
        (card) => card.type === 'trap',
      )

      expect(trapCards.length).toBeGreaterThan(0)
      expect(trapCards.every((card) => Boolean(card.trap?.text))).toBe(true)
      expect(
        trapCards.every((card) => (card.trap?.effects.length ?? 0) > 0),
      ).toBe(true)
    }
  })

  it('parses FLIP costs and compound TRAP effects without card-number rules', () => {
    const red = createOfficialRedStarterDeck('player-one')
    const green = createOfficialGreenStarterDeck('player-one')
    const gainHpFlip = red.find((card) => card.id === 'ST1-001')
    const drawFlip = red.find((card) => card.id === 'ST1-013')
    const compoundTrap = green.find((card) => card.id === 'ST3-019')

    expect(gainHpFlip?.flip).toMatchObject({
      cost: { energy: {}, discardHand: 1 },
      effects: [{ kind: 'gain-hp', amount: 1 }],
    })
    expect(drawFlip?.flip).toMatchObject({
      cost: { energy: {}, discardHand: 0 },
      effects: [{ kind: 'draw', amount: 1 }],
    })
    expect(compoundTrap?.trap).toMatchObject({
      cost: { energy: { green: 1 }, discardHand: 0 },
      effects: [
        { kind: 'modify-attack', amount: -3 },
        { kind: 'support-to-trash', amount: 1 },
      ],
    })
  })
})
