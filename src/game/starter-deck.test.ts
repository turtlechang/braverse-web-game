import { describe, expect, it } from 'vitest'
import {
  AI_PRESET_BS2_BEAN_DECK,
  AI_PRESET_BS2_BLUE_DECK,
  AI_PRESET_BS2_PURPLE_DECK,
  AI_PRESET_BS2_RED_DECK,
  AI_PRESET_BS2_YELLOW_DECK,
  createAiPresetBs2BeanDeck,
  createAiPresetBs2BlueDeck,
  createAiPresetBs2PurpleDeck,
  createAiPresetBs2RedDeck,
  createAiPresetBs2YellowDeck,
  createDemoGame,
  createOfficialBlueStarterDeck,
  createOfficialGreenStarterDeck,
  createOfficialPurpleStarterDeck,
  createOfficialRedStarterDeck,
  createOfficialYellowStarterDeck,
  OFFICIAL_BLUE_STARTER_DECK,
  OFFICIAL_GREEN_STARTER_DECK,
  OFFICIAL_PURPLE_STARTER_DECK,
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
    const cardId = entry.cardNumber.replace(/@\d+$/, '')
    expect(counts[cardId]).toBe(entry.count)
  }
}

describe('official red starter deck', () => {
  it('contains 23 card numbers and exactly 60 cards', () => {
    expectStarterDeckRecipe(OFFICIAL_RED_STARTER_DECK, 23)
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
      expect(cards.filter((card) => card.id === 'ST1-001')).toHaveLength(2)
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
          { kind: 'draw-up-to', max: 1 },
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

describe('official blue starter deck', () => {
  it('contains 22 card numbers and exactly 60 cards', () => {
    expectStarterDeckRecipe(OFFICIAL_BLUE_STARTER_DECK, 22)
  })

  it('creates the official quantity for every card number', () => {
    expectCreatedDeckMatchesRecipe(
      createOfficialBlueStarterDeck('player-two'),
      OFFICIAL_BLUE_STARTER_DECK,
    )
  })

  it('creates blue cards from the official Starter Deck BLUE sample', () => {
    const deck = createOfficialBlueStarterDeck('player-one')
    const candyDiver = deck.find((card) => card.id === 'ST4-001')
    const skatingQueen = deck.find((card) => card.id === 'ST4-014')
    const sugarGlassDome = deck.find((card) => card.id === 'ST4-022')
    const octoInk = deck.find((card) => card.id === 'ST4-020')
    const fallenIce = deck.find((card) => card.id === 'ST4-021')

    expect(candyDiver).toMatchObject({
      name: 'Candy Diver Cookie',
      type: 'cookie',
      energyColor: 'wild',
      attackEnergyCost: { neutral: 1 },
    })
    expect(skatingQueen).toMatchObject({
      name: 'Skating Queen Cookie',
      type: 'cookie',
      flip: {
        text: 'Draw up to 1 card from your deck.',
        cost: { energy: {}, discardHand: 0 },
        effects: [{ kind: 'draw-up-to', max: 1 }],
      },
    })
    expect(sugarGlassDome).toMatchObject({
      name: 'Sugar Glass Dome',
      type: 'stage',
      stageAbility: {
        placementCost: { blue: 2 },
        cost: { blue: 1 },
        effects: [{ kind: 'draw-up-to', max: 1 }],
        restSource: true,
      },
    })
    expect(octoInk).toMatchObject({
      name: 'Octo-Ink Spray',
      type: 'trap',
      trap: {
        cost: { energy: { blue: 1 }, discardHand: 2 },
        effects: [
          {
            kind: 'modify-attack',
            amount: -3,
            target: { side: 'opponent', min: 0, max: 1 },
          },
        ],
      },
    })
    expect(fallenIce).toMatchObject({
      name: 'Fallen Ice Statue',
      type: 'trap',
      trap: {
        cost: { energy: { blue: 2 }, discardHand: 0 },
        effects: [
          {
            kind: 'modify-attack',
            amount: -2,
            target: { side: 'opponent', min: 0, max: 1 },
          },
          { kind: 'draw-up-to', max: 1 },
        ],
      },
    })
  })

  it('creates a demo game using the blue deck', () => {
    const state = createDemoGame(undefined, 'blue')

    for (const player of Object.values(state.players)) {
      const cards = [
        ...player.deck,
        ...player.hand,
        ...player.battleArea.map((cookie) => cookie.card),
        ...player.battleArea.flatMap((cookie) => cookie.hpCards),
      ]
      expect(cards).toHaveLength(60)
      expect(cards.filter((card) => card.id === 'ST4-001')).toHaveLength(4)
      expect(cards.filter((card) => card.id === 'ST4-022')).toHaveLength(2)
    }
  })
})

describe('official purple starter deck', () => {
  it('contains 22 card numbers and exactly 60 cards', () => {
    expectStarterDeckRecipe(OFFICIAL_PURPLE_STARTER_DECK, 22)
  })

  it('creates the official quantity for every card number', () => {
    expectCreatedDeckMatchesRecipe(
      createOfficialPurpleStarterDeck('player-two'),
      OFFICIAL_PURPLE_STARTER_DECK,
    )
  })

  it('creates purple cards from the official Starter Deck PURPLE sample', () => {
    const deck = createOfficialPurpleStarterDeck('player-one')
    const gingerBright = deck.find((card) => card.id === 'ST5-002')
    const skater = deck.find((card) => card.id === 'ST5-004')
    const fig = deck.find((card) => card.id === 'ST5-003')
    const fairy = deck.find((card) => card.id === 'ST5-008')
    const windsweptValley = deck.find((card) => card.id === 'ST5-022')

    expect(gingerBright).toMatchObject({
      name: 'GingerBright',
      type: 'cookie',
      energyColor: 'wild',
    })
    expect(skater).toMatchObject({
      name: 'Skater Cookie',
      type: 'cookie',
      skill: {
        trigger: 'passive',
        faint: true,
        effects: [{ kind: 'opponent-discard-hand', count: 1 }],
      },
    })
    expect(fig).toMatchObject({
      name: 'Fig Cookie',
      type: 'cookie',
      flip: {
        cost: { energy: {}, discardHand: 0 },
        effects: [{ kind: 'draw-up-to', max: 1 }],
      },
    })
    expect(fairy).toMatchObject({
      name: 'Fairy Cookie',
      type: 'cookie',
      flip: {
        cost: { energy: {}, discardHand: 1 },
        effects: [{ kind: 'gain-hp', amount: 1 }],
      },
    })
    expect(windsweptValley).toMatchObject({
      name: 'Windswept Valley',
      type: 'stage',
    })
  })

  it('creates a demo game using the purple deck', () => {
    const state = createDemoGame(undefined, 'purple')

    for (const player of Object.values(state.players)) {
      const cards = [
        ...player.deck,
        ...player.hand,
        ...player.battleArea.map((cookie) => cookie.card),
        ...player.battleArea.flatMap((cookie) => cookie.hpCards),
      ]
      expect(cards).toHaveLength(60)
      expect(cards.filter((card) => card.id === 'ST5-002')).toHaveLength(4)
      expect(cards.filter((card) => card.id === 'ST5-022')).toHaveLength(2)
    }
  })
})

describe('AI second set preset decks', () => {
  it('contains exactly 60 cards in every preset recipe', () => {
    expectStarterDeckRecipe(AI_PRESET_BS2_RED_DECK, 19)
    expectStarterDeckRecipe(AI_PRESET_BS2_YELLOW_DECK, 18)
    expectStarterDeckRecipe(AI_PRESET_BS2_BEAN_DECK, 19)
    expectStarterDeckRecipe(AI_PRESET_BS2_BLUE_DECK, 17)
    expectStarterDeckRecipe(AI_PRESET_BS2_PURPLE_DECK, 20)
  })

  it('creates the configured quantity for every preset card number', () => {
    expectCreatedDeckMatchesRecipe(
      createAiPresetBs2RedDeck('player-two'),
      AI_PRESET_BS2_RED_DECK,
    )
    expectCreatedDeckMatchesRecipe(
      createAiPresetBs2YellowDeck('player-two'),
      AI_PRESET_BS2_YELLOW_DECK,
    )
    expectCreatedDeckMatchesRecipe(
      createAiPresetBs2BeanDeck('player-two'),
      AI_PRESET_BS2_BEAN_DECK,
    )
    expectCreatedDeckMatchesRecipe(
      createAiPresetBs2BlueDeck('player-two'),
      AI_PRESET_BS2_BLUE_DECK,
    )
    expectCreatedDeckMatchesRecipe(
      createAiPresetBs2PurpleDeck('player-two'),
      AI_PRESET_BS2_PURPLE_DECK,
    )
  })

  it('can create demo games with a second set preset AI deck', () => {
    const state = createDemoGame(7, { player: 'red', ai: 'bs2-blue' })
    const allAiCards = [
      ...state.players['player-two'].deck,
      ...state.players['player-two'].hand,
      ...state.players['player-two'].battleArea.map((cookie) => cookie.card),
      ...state.players['player-two'].battleArea.flatMap(
        (cookie) => cookie.hpCards,
      ),
    ]

    expect(allAiCards).toHaveLength(60)
    expect(allAiCards.filter((card) => card.id === 'BS2-040')).toHaveLength(4)
    expect(allAiCards.filter((card) => card.id === 'ST4-021')).toHaveLength(4)
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
    expect(playerCards.filter((card) => card.id === 'ST1-001')).toHaveLength(2)
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
      createOfficialBlueStarterDeck,
      createOfficialPurpleStarterDeck,
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

  it('drives every converted starter-deck TRAP from attackText', () => {
    for (const createDeck of [
      createOfficialRedStarterDeck,
      createOfficialYellowStarterDeck,
      createOfficialGreenStarterDeck,
      createOfficialBlueStarterDeck,
    ]) {
      const convertedTraps = createDeck('player-two').filter(
        (card) => card.type === 'trap' && card.trap,
      )

      expect(convertedTraps.length).toBeGreaterThan(0)
      expect(convertedTraps.every((card) => Boolean(card.trap?.text))).toBe(
        true,
      )
      expect(
        convertedTraps.every(
          (card) => (card.trap?.effects.length ?? 0) > 0,
        ),
      ).toBe(true)
    }
  })

  it('parses FLIP costs and compound TRAP effects without card-number rules', () => {
    const red = createOfficialRedStarterDeck('player-one')
    const green = createOfficialGreenStarterDeck('player-one')
    const blue = createOfficialBlueStarterDeck('player-one')
    const gainHpFlip = red.find((card) => card.id === 'ST1-001')
    const drawFlip = red.find((card) => card.id === 'ST1-013')
    const compoundTrap = green.find((card) => card.id === 'ST3-019')
    const blueCompoundTrap = blue.find((card) => card.id === 'ST4-021')

    expect(gainHpFlip?.flip).toMatchObject({
      cost: { energy: {}, discardHand: 1 },
      effects: [{ kind: 'gain-hp', amount: 1 }],
    })
    expect(drawFlip?.flip).toMatchObject({
      cost: { energy: {}, discardHand: 0 },
      effects: [{ kind: 'draw-up-to', max: 1 }],
    })
    expect(compoundTrap?.trap).toMatchObject({
      cost: { energy: { green: 1 }, discardHand: 0 },
      effects: [
        { kind: 'modify-attack', amount: -3 },
        { kind: 'support-to-trash', amount: 1 },
      ],
    })
    expect(blueCompoundTrap?.trap).toMatchObject({
      cost: { energy: { blue: 2 }, discardHand: 0 },
      effects: [
        { kind: 'modify-attack', amount: -2 },
        { kind: 'draw-up-to', max: 1 },
      ],
    })
  })
})

describe('ST4-012 and ST4-013 card skills', () => {
  it('ST4-013 Captain Caviar OnPlay is inspect-deck effect', () => {
    const deck = createOfficialBlueStarterDeck('player-one')
    const caviar = deck.find((card) => card.id === 'ST4-013')
    expect(caviar).toBeDefined()
    expect(caviar!.skill).toBeDefined()
    expect(caviar!.skill!.trigger).toBe('on-play')
    expect(caviar!.skill!.effects).toEqual([
      { kind: 'inspect-deck', lookCount: 3, pickCount: 1, restToBottom: true },
    ])
  })

  it('ST4-013 Captain Caviar keeps its optional attack follow-up in the runtime deck', () => {
    const deck = createOfficialBlueStarterDeck('player-one')
    const caviar = deck.find((card) => card.id === 'ST4-013')

    expect(caviar?.type).toBe('cookie')
    if (!caviar || caviar.type !== 'cookie') {
      throw new Error('ST4-013 should be a runtime cookie card.')
    }

    expect(caviar.attackEffects).toEqual([
      {
        kind: 'optional-cost-attack',
        cost: { energy: {}, discardHand: 2 },
        effects: [
          {
            kind: 'damage',
            amount: 1,
            target: { side: 'opponent', min: 1, max: 1 },
          },
        ],
        effectText:
          'Discard 2 cards from your hand to deal 1 damage to 1 opponent cookie.',
      },
    ])
  })

  it('ST4-012 Werewolf Cookie skill has discardHand cost and modify-attack effect', () => {
    const deck = createOfficialBlueStarterDeck('player-one')
    const werewolf = deck.find((card) => card.id === 'ST4-012')
    expect(werewolf).toBeDefined()
    expect(werewolf!.skill).toBeDefined()
    expect(werewolf!.skill!.trigger).toBe('activate')
    expect(werewolf!.skill!.oncePerTurn).toBe(true)
    expect(werewolf!.skill!.yourTurn).toBe(false)
    expect(werewolf!.skill!.restSource).toBe(false)
    expect(werewolf!.skill!.cost).toEqual({ energy: {}, discardHand: 1 })
    expect(werewolf!.skill!.effects).toEqual([
      {
        kind: 'modify-attack',
        amount: 1,
        duration: 'this-turn',
        target: { side: 'self', min: 1, max: 1, sourceOnly: true },
      },
    ])
  })
})
