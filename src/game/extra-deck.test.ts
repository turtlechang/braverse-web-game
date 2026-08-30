import { describe, expect, it } from 'vitest'
import {
  EXTRA_DECK_MAX_CARDS,
  applyGameCommand,
  canPlayExtraDeckCookie,
  createGame,
  createPlayerView,
  deployCookie,
  executeCardEffect,
  advancePhase,
  getLegalTurnCommands,
  maskGameStateForViewer,
  playExtraDeckCookie,
  reorderExtraDeck,
  validateExtraDeck,
  type CookieCard,
  type ExtraDeckCard,
  type GameCard,
} from '.'
import { createBattleState, item as battleItem } from './test-helpers/battle-helpers'

const identityShuffle = (cards: GameCard[]): GameCard[] => [...cards]

const cookie = (instanceId: string): CookieCard => ({
  id: `cookie-${instanceId}`,
  instanceId,
  name: `餅乾 ${instanceId}`,
  type: 'cookie',
  level: 1,
  hp: 3,
  attack: 1,
  attackCost: 0,
})

const item = (instanceId: string): GameCard => ({
  id: `item-${instanceId}`,
  instanceId,
  name: `道具 ${instanceId}`,
  type: 'item',
})

const deck = (prefix: string): GameCard[] => [
  cookie(`${prefix}-starter`),
  ...Array.from({ length: 59 }, (_, index) => item(`${prefix}-item-${index}`)),
]

const extra = (instanceId: string): ExtraDeckCard => ({
  id: `extra-${instanceId}`,
  instanceId,
  name: `EXTRA ${instanceId}`,
  type: 'extra',
})

const awakened = (instanceId: string): ExtraDeckCard => ({
  id: `awakened-${instanceId}`,
  instanceId,
  name: `Awakened ${instanceId}`,
  type: 'awakened',
})

const playableExtra = (instanceId = 'bs8-005-extra'): ExtraDeckCard => ({
  id: 'BS8-005',
  instanceId,
  name: 'Avatar of Ruin Cookie',
  type: 'extra',
  officialType: 'extra',
  cardColor: 'red',
  energyColor: 'red',
  level: 3,
  hp: 5,
  attack: 3,
  attackCost: 3,
  attackEnergyCost: { red: 3 },
  playRequirement: {
    kind: 'cookies-fainted-this-turn-at-least',
    side: 'self',
    count: 2,
  },
  skill: {
    trigger: 'on-play',
    oncePerTurn: false,
    yourTurn: false,
    restSource: false,
    cost: { energy: {}, discardHand: 0 },
    text: 'Deals 1 damage to all of your opponent\'s Cookies.',
    effects: [{ kind: 'damage-all', amount: 1, side: 'opponent' }],
  },
  attackEffects: [
    { kind: 'damage-all', amount: 1, side: 'opponent' },
    { kind: 'damage-all', amount: 1, side: 'self', excludeSource: true },
  ],
})

const peakOfApathyExtra = (instanceId = 'bs8-069-extra'): ExtraDeckCard => ({
  id: 'BS8-069',
  instanceId,
  name: 'Peak of Apathy Cookie',
  type: 'extra',
  officialType: 'extra',
  cardColor: 'green',
  energyColor: 'green',
  level: 3,
  hp: 4,
  attack: 3,
  attackCost: 3,
  attackEnergyCost: { green: 3 },
  playRequirement: {
    kind: 'support-count-less-than-opponent',
    difference: 2,
  },
  skill: {
    trigger: 'on-play',
    oncePerTurn: false,
    yourTurn: false,
    restSource: false,
    cost: { energy: {}, discardHand: 0 },
    text: 'Place up to 1 Green Cookie from your trash in your support area.',
    effects: [
      {
        kind: 'trash-to-support',
        amount: 1,
        rested: false,
        optional: true,
        energyColor: 'green',
      },
    ],
  },
})

const willOfNatureExtra = (instanceId = 'bs8-090-extra'): ExtraDeckCard => ({
  id: 'BS8-090',
  instanceId,
  name: 'Will of Nature Cookie',
  type: 'extra',
  officialType: 'extra',
  cardColor: 'blue',
  energyColor: 'blue',
  level: 3,
  hp: 5,
  attack: 3,
  attackCost: 3,
  attackEnergyCost: { blue: 3 },
  playRequirement: { kind: 'hand-count-at-most', count: 2 },
  skill: {
    trigger: 'on-play',
    oncePerTurn: false,
    yourTurn: false,
    restSource: false,
    cost: { energy: {}, discardHand: 0 },
    text: 'Return up to 1 of your Blue Level 2 or lower Cookies to your hand.',
    effects: [
      {
        kind: 'return-to-hand',
        target: {
          side: 'self',
          min: 0,
          max: 1,
          energyColor: 'blue',
          maxLevel: 2,
        },
      },
    ],
  },
})

const awakenedGoldenCheese = (instanceId = 'bs8-027-awakened'): ExtraDeckCard => ({
  id: 'BS8-027',
  instanceId,
  name: 'Golden Cheese Cookie',
  type: 'extra',
  officialType: 'extra',
  cardColor: 'yellow',
  energyColor: 'yellow',
  level: 3,
  // Awakened cards show HP+2; this numeric field is only the adapter fallback
  // required by CookieCard, while the actual overlay uses awakenHpBonus.
  hp: 2,
  awakenHpBonus: 2,
  attack: 3,
  attackCost: 3,
  attackEnergyCost: { yellow: 3 },
  extraDeckPlayMode: 'awaken',
  awakenRequirement: {
    targetName: 'Golden Cheese Cookie',
    playedFrom: 'break',
  },
  attackEffects: [{ kind: 'damage-all', amount: 1, side: 'opponent' }],
})

const extraDeck = (prefix: string, count = EXTRA_DECK_MAX_CARDS) =>
  Array.from({ length: count }, (_, index) => extra(`${prefix}-${index + 1}`))

describe('EXTRA Deck core model', () => {
  it('keeps legacy PlayerSetup compatible by defaulting extraDeck to an empty list', () => {
    const state = createGame(
      { id: 'player-one', name: '玩家一', deck: deck('one') },
      { id: 'player-two', name: '玩家二', deck: deck('two') },
      'player-one',
      identityShuffle,
    )

    expect(state.players['player-one'].extraDeck).toEqual([])
    expect(state.players['player-two'].extraDeck).toEqual([])
  })

  it('keeps up to six EXTRA cards outside the shuffled opening hand and main deck', () => {
    const oneExtra = extraDeck('one')
    const twoExtra = extraDeck('two')
    const state = createGame(
      {
        id: 'player-one',
        name: '玩家一',
        deck: deck('one'),
        extraDeck: oneExtra,
      },
      {
        id: 'player-two',
        name: '玩家二',
        deck: deck('two'),
        extraDeck: twoExtra,
      },
      'player-one',
      identityShuffle,
    )

    expect(state.players['player-one'].extraDeck).toEqual(oneExtra)
    expect(state.players['player-one'].extraDeck).not.toBe(oneExtra)
    expect(state.players['player-one'].hand).toHaveLength(6)
    expect(state.players['player-one'].hand).not.toContainEqual(oneExtra[0])
    expect(state.players['player-one'].deck).toHaveLength(54)
    expect(state.players['player-one'].deck).not.toContainEqual(oneExtra[0])
  })

  it('accepts zero through six EXTRA cards but rejects a seventh card before game setup', () => {
    expect(validateExtraDeck([]).isValid).toBe(true)
    expect(validateExtraDeck(extraDeck('valid')).isValid).toBe(true)

    const invalid = validateExtraDeck(extraDeck('too-many', 7))
    expect(invalid).toMatchObject({ isValid: false, valid: false })
    expect(invalid.errors).toContain('EXTRA Deck 最多只能放入 6 張，目前為 7 張。')

    expect(() =>
      createGame(
        {
          id: 'player-one',
          name: '玩家一',
          deck: deck('one'),
          extraDeck: extraDeck('too-many', 7),
        },
        { id: 'player-two', name: '玩家二', deck: deck('two') },
        'player-one',
        identityShuffle,
      ),
    ).toThrow('EXTRA Deck 最多只能放入 6 張，目前為 7 張。')
  })

  it('accepts both EXTRA and Awakened Cookie cards, but rejects a fifth copy of one card number', () => {
    expect(validateExtraDeck([extra('extra'), awakened('awakened')])).toMatchObject({
      isValid: true,
      errors: [],
    })

    const fiveCopies = Array.from({ length: 5 }, (_, index) => ({
      ...extra(`copy-${index + 1}`),
      id: 'BS8-005',
    }))

    expect(validateExtraDeck(fiveCopies).errors).toContain(
      'EXTRA Deck 中 BS8-005 合計 5 張，超過每卡最多 4 張限制。',
    )
  })

  it('rejects duplicate runtime identities so a private reorder stays one-to-one', () => {
    expect(validateExtraDeck([extra('same-instance'), extra('same-instance')])).toMatchObject({
      isValid: false,
      errors: ['EXTRA Deck 內的卡片 instanceId 不可重複。'],
    })
  })

  it('reorders the private EXTRA Deck without changing its cards', () => {
    const original = [extra('first'), awakened('second'), extra('third')]

    const reordered = reorderExtraDeck(original, [
      'third',
      'first',
      'second',
    ])

    expect(reordered.map((card) => card.instanceId)).toEqual([
      'third',
      'first',
      'second',
    ])
    expect(original.map((card) => card.instanceId)).toEqual([
      'first',
      'second',
      'third',
    ])
    expect(() => reorderExtraDeck(original, ['first', 'second'])).toThrow(
      'EXTRA Deck 的重排結果必須剛好包含原本的每一張卡。',
    )
  })

  it('only exposes a viewer\'s own EXTRA cards while both sides receive the public count', () => {
    const oneExtra = extraDeck('one', 2)
    const twoExtra = extraDeck('two', 3)
    const state = createGame(
      {
        id: 'player-one',
        name: '玩家一',
        deck: deck('one'),
        extraDeck: oneExtra,
      },
      {
        id: 'player-two',
        name: '玩家二',
        deck: deck('two'),
        extraDeck: twoExtra,
      },
      'player-one',
      identityShuffle,
    )
    const view = createPlayerView(state, 'player-one')
    const masked = maskGameStateForViewer(state, 'player-one')

    expect(view.extraDeck).toEqual(oneExtra)
    expect(view.self.extraDeckCount).toBe(2)
    expect(view.opponent.extraDeckCount).toBe(3)
    expect(view.opponent as unknown as Record<string, unknown>).not.toHaveProperty(
      'extraDeck',
    )
    expect(masked.players['player-one'].extraDeck).toEqual(oneExtra)
    const maskedOpponentExtraDeck = masked.players['player-two'].extraDeck ?? []
    expect(maskedOpponentExtraDeck).toHaveLength(3)
    expect(maskedOpponentExtraDeck.every((card) => card.name === '???')).toBe(true)
  })
})

describe('EXTRA Deck direct-play rule path', () => {
  const createExtraPlayState = () => {
    const state = createBattleState()
    const card = playableExtra()
    return {
      state: {
        ...state,
        players: {
          ...state.players,
          'player-two': {
            ...state.players['player-two'],
            extraDeck: [card],
            deck: [
              battleItem('extra-hp-a'),
              battleItem('extra-hp-b'),
              battleItem('extra-hp-c'),
              battleItem('extra-hp-d'),
              battleItem('extra-hp-e'),
              battleItem('extra-deck-remaining'),
            ],
          },
        },
        cookiesFaintedThisTurn: { 'player-one': 0, 'player-two': 2 },
      },
      card,
    }
  }

  it('plays a qualifying EXTRA Cookie only from its owner\'s EXTRA Deck, sets HP, and queues its On Play skill', () => {
    const { state, card } = createExtraPlayState()

    expect(canPlayExtraDeckCookie(state, 'player-two', card.instanceId)).toBe(true)

    const next = playExtraDeckCookie(state, 'player-two', card.instanceId)
    const player = next.players['player-two']
    const deployed = player.battleArea.find(
      (entry) => entry.card.instanceId === card.instanceId,
    )

    expect(player.extraDeck).toEqual([])
    expect(deployed?.card).toMatchObject({
      id: 'BS8-005',
      type: 'cookie',
      extraDeckOrigin: 'extra',
    })
    expect(deployed?.hpCards).toHaveLength(5)
    expect(next.extraDeckPlayUsedThisTurn).toBe(true)
    expect(next.pendingOnPlay).toEqual({
      playerId: 'player-two',
      sourceInstanceId: card.instanceId,
      origin: 'extra-deck',
    })
  })

  it('routes EXTRA deployment and its On Play damage through the command boundary', () => {
    const { state, card } = createExtraPlayState()
    const deployed = applyGameCommand(state, {
      kind: 'play-extra-deck-cookie',
      playerId: 'player-two',
      instanceId: card.instanceId,
    })

    const resolved = applyGameCommand(deployed, {
      kind: 'activate-skill',
      playerId: 'player-two',
      sourceInstanceId: card.instanceId,
      trigger: 'on-play',
      paymentIds: [],
    })

    expect(resolved.players['player-one'].battleArea[0].hpCards).toHaveLength(2)
    expect(resolved.commandLog?.map((entry) => entry.commandKind)).toEqual([
      'play-extra-deck-cookie',
      'activate-skill',
    ])
    expect(resolved.commandLog?.[0].summary).toContain('Avatar of Ruin Cookie')
  })

  it('resolves a directly playable EXTRA Cookie\'s printed attack Then effects', () => {
    const { state, card } = createExtraPlayState()
    const prepared: typeof state = {
      ...state,
      players: {
        ...state.players,
        'player-one': {
          ...state.players['player-one'],
          battleArea: [
            {
              ...state.players['player-one'].battleArea[0],
              hpCards: Array.from({ length: 5 }, (_, index) =>
                battleItem(`defender-hp-${index}`),
              ),
            },
          ],
        },
        'player-two': {
          ...state.players['player-two'],
          battleArea: [],
          deck: Array.from({ length: 6 }, (_, index) =>
            battleItem(`avatar-hp-${index}`),
          ),
          supportArea: Array.from({ length: 3 }, (_, index) => ({
            card: battleItem(`avatar-energy-${index}`),
            rested: false,
          })),
        },
      },
    }
    const deployed = applyGameCommand(prepared, {
      kind: 'play-extra-deck-cookie',
      playerId: 'player-two',
      instanceId: card.instanceId,
    })
    const ready = applyGameCommand(deployed, {
      kind: 'skip-on-play',
      playerId: 'player-two',
      sourceInstanceId: card.instanceId,
    })

    const resolved = applyGameCommand(ready, {
      kind: 'attack',
      playerId: 'player-two',
      attackerInstanceId: card.instanceId,
      targetInstanceId: 'defender',
      supportPaymentIds: ['avatar-energy-0', 'avatar-energy-1', 'avatar-energy-2'],
    })

    expect(resolved.players['player-one'].battleArea[0].hpCards).toHaveLength(1)
  })

  it('only enumerates a qualifying EXTRA command during its owner\'s Main Phase', () => {
    const { state, card } = createExtraPlayState()

    expect(getLegalTurnCommands(state, 'player-two')).toContainEqual({
      kind: 'play-extra-deck-cookie',
      playerId: 'player-two',
      instanceId: card.instanceId,
    })
    expect(
      getLegalTurnCommands(
        { ...state, phase: 'support' },
        'player-two',
      ),
    ).not.toContainEqual({
      kind: 'play-extra-deck-cookie',
      playerId: 'player-two',
      instanceId: card.instanceId,
    })
  })

  it('resolves Peak of Apathy\'s selected Green trash-to-support On Play effect', () => {
    const state = createBattleState()
    const card = peakOfApathyExtra()
    const greenDiscard: CookieCard = {
      ...cookie('green-discard'),
      energyColor: 'green',
    }
    const eligibleState = {
      ...state,
      players: {
        ...state.players,
        'player-one': {
          ...state.players['player-one'],
          supportArea: [
            ...state.players['player-one'].supportArea,
            { card: battleItem('p1-extra-support'), rested: false },
          ],
        },
        'player-two': {
          ...state.players['player-two'],
          extraDeck: [card],
          discardPile: [greenDiscard],
          deck: Array.from({ length: 5 }, (_, index) =>
            battleItem(`peak-hp-${index + 1}`),
          ),
        },
      },
    }

    const deployed = applyGameCommand(eligibleState, {
      kind: 'play-extra-deck-cookie',
      playerId: 'player-two',
      instanceId: card.instanceId,
    })
    const resolved = applyGameCommand(deployed, {
      kind: 'activate-skill',
      playerId: 'player-two',
      sourceInstanceId: card.instanceId,
      trigger: 'on-play',
      paymentIds: [],
      effectTargets: [[greenDiscard.instanceId]],
    })

    expect(resolved.players['player-two'].discardPile).toEqual([])
    expect(resolved.players['player-two'].supportArea.at(-1)).toMatchObject({
      card: { instanceId: greenDiscard.instanceId },
      rested: false,
    })
  })

  it('resolves Will of Nature\'s selected Blue Level 2-or-lower return On Play effect', () => {
    const state = createBattleState()
    const card = willOfNatureExtra()
    const blueCookie: CookieCard = {
      ...state.players['player-two'].battleArea[0].card,
      instanceId: 'blue-lv1-cookie',
      energyColor: 'blue',
      level: 1,
    }
    const eligibleState = {
      ...state,
      players: {
        ...state.players,
        'player-two': {
          ...state.players['player-two'],
          extraDeck: [card],
          battleArea: [
            {
              ...state.players['player-two'].battleArea[0],
              card: blueCookie,
            },
          ],
          deck: Array.from({ length: 6 }, (_, index) =>
            battleItem(`will-hp-${index + 1}`),
          ),
        },
      },
    }

    const deployed = applyGameCommand(eligibleState, {
      kind: 'play-extra-deck-cookie',
      playerId: 'player-two',
      instanceId: card.instanceId,
    })
    const resolved = applyGameCommand(deployed, {
      kind: 'activate-skill',
      playerId: 'player-two',
      sourceInstanceId: card.instanceId,
      trigger: 'on-play',
      paymentIds: [],
      effectTargets: [[blueCookie.instanceId]],
    })

    expect(
      resolved.players['player-two'].battleArea.map((entry) => entry.card.instanceId),
    ).toEqual([card.instanceId])
    expect(resolved.players['player-two'].hand).toContainEqual(blueCookie)
  })

  it('rejects an unmet card condition, a second use in the same turn, and an Awaken-only card', () => {
    const { state, card } = createExtraPlayState()
    const unmet = {
      ...state,
      cookiesFaintedThisTurn: { 'player-one': 0, 'player-two': 1 },
    }
    expect(canPlayExtraDeckCookie(unmet, 'player-two', card.instanceId)).toBe(false)
    expect(() => playExtraDeckCookie(unmet, 'player-two', card.instanceId)).toThrow()

    const used = { ...state, extraDeckPlayUsedThisTurn: true }
    expect(canPlayExtraDeckCookie(used, 'player-two', card.instanceId)).toBe(false)
    expect(() => playExtraDeckCookie(used, 'player-two', card.instanceId)).toThrow()

    const awakenedCard: ExtraDeckCard = {
      ...card,
      instanceId: 'awaken-only',
      extraDeckPlayMode: 'awaken',
    }
    const awakenedOnly = {
      ...state,
      players: {
        ...state.players,
        'player-two': {
          ...state.players['player-two'],
          extraDeck: [awakenedCard],
        },
      },
    }
    expect(canPlayExtraDeckCookie(awakenedOnly, 'player-two', 'awaken-only')).toBe(false)
    expect(() => playExtraDeckCookie(awakenedOnly, 'player-two', 'awaken-only')).toThrow()
  })

  it('Awakens a same-turn break Cookie, adds HP+2, preserves equip, and clears prior effects', () => {
    const state = createBattleState()
    const goldenBase: CookieCard = {
      ...state.players['player-two'].battleArea[0].card,
      id: 'BS8-026',
      instanceId: 'golden-base',
      name: 'Golden Cheese Cookie',
      hp: 4,
    }
    const awakened = awakenedGoldenCheese()
    const prepared = {
      ...state,
      attackModifiers: [
        {
          sourceInstanceId: 'prior-effect',
          targetInstanceId: goldenBase.instanceId,
          amount: -1,
          expiresAfterTurn: state.turnNumber,
        },
      ],
      players: {
        ...state.players,
        'player-two': {
          ...state.players['player-two'],
          deck: [
            battleItem('awaken-hp-1'),
            battleItem('awaken-hp-2'),
            battleItem('awaken-deck-remaining'),
          ],
          extraDeck: [awakened],
          battleArea: [
            {
              card: goldenBase,
              hpCards: [battleItem('golden-existing-hp')],
              rested: true,
              enteredFrom: 'break' as const,
              enteredTurn: state.turnNumber,
              battleEntryId: 'golden-base:battle:2',
              equippedCards: [battleItem('soul-jam')],
            },
          ],
        },
      },
    }

    expect(canPlayExtraDeckCookie(prepared, 'player-two', awakened.instanceId)).toBe(true)

    const next = playExtraDeckCookie(prepared, 'player-two', awakened.instanceId)
    const entry = next.players['player-two'].battleArea[0]

    expect(next.players['player-two'].extraDeck).toEqual([])
    expect(entry.card).toMatchObject({
      instanceId: awakened.instanceId,
      extraDeckOrigin: 'awakened',
      awakenHpBonus: 2,
    })
    expect(entry.hpCards.map((card) => card.instanceId)).toEqual([
      'golden-existing-hp',
      'awaken-hp-1',
      'awaken-hp-2',
    ])
    expect(entry.rested).toBe(false)
    expect(entry.equippedCards?.map((card) => card.instanceId)).toEqual(['soul-jam'])
    expect(entry.awakenedUnderlay).toEqual([goldenBase])
    expect(next.attackModifiers).toEqual([])
  })

  it('rejects Awaken when the named Cookie was not played from the required zone this turn', () => {
    const state = createBattleState()
    const awakened = awakenedGoldenCheese()
    const base = {
      ...state.players['player-two'].battleArea[0],
      card: {
        ...state.players['player-two'].battleArea[0].card,
        name: 'Golden Cheese Cookie',
      },
      enteredFrom: 'hand' as const,
      enteredTurn: state.turnNumber,
    }
    const prepared = {
      ...state,
      players: {
        ...state.players,
        'player-two': {
          ...state.players['player-two'],
          extraDeck: [awakened],
          battleArea: [base],
        },
      },
    }

    expect(canPlayExtraDeckCookie(prepared, 'player-two', awakened.instanceId)).toBe(false)
    expect(() => playExtraDeckCookie(prepared, 'player-two', awakened.instanceId)).toThrow(
      '覆蓋目標',
    )
  })

  it('puts the Awakened card in break and the underlay, HP, and equip in trash when it faints', () => {
    const state = createBattleState()
    const awakened = awakenedGoldenCheese()
    const base: CookieCard = {
      ...state.players['player-two'].battleArea[0].card,
      instanceId: 'golden-base',
      name: 'Golden Cheese Cookie',
    }
    const prepared = {
      ...state,
      players: {
        ...state.players,
        'player-two': {
          ...state.players['player-two'],
          deck: [
            battleItem('awaken-hp-1'),
            battleItem('awaken-hp-2'),
            battleItem('awaken-deck-remaining'),
          ],
          extraDeck: [awakened],
          battleArea: [
            {
              card: base,
              hpCards: [battleItem('golden-existing-hp')],
              rested: false,
              enteredFrom: 'break' as const,
              enteredTurn: state.turnNumber,
              equippedCards: [battleItem('soul-jam')],
            },
          ],
        },
      },
    }
    const awakenedState = playExtraDeckCookie(prepared, 'player-two', awakened.instanceId)
    const fainted = executeCardEffect(
      awakenedState,
      { sourcePlayerId: 'player-one', sourceInstanceId: 'effect-source' },
      {
        kind: 'hp-to-trash',
        amount: 3,
        target: { side: 'opponent', min: 1, max: 1 },
      },
      [awakened.instanceId],
    )

    expect(fainted.players['player-two'].breakArea).toMatchObject([
      { instanceId: awakened.instanceId },
    ])
    expect(fainted.players['player-two'].discardPile.map((card) => card.instanceId)).toEqual([
      'golden-existing-hp',
      'awaken-hp-1',
      'awaken-hp-2',
      'golden-base',
      'soul-jam',
    ])
  })

  it('does not allow an EXTRA-origin Cookie to be replayed from hand', () => {
    const { state, card } = createExtraPlayState()
    const deployed = playExtraDeckCookie(state, 'player-two', card.instanceId)
    const extraCookie = deployed.players['player-two'].battleArea.find(
      (entry) => entry.card.instanceId === card.instanceId,
    )!.card
    const replayState = {
      ...deployed,
      extraDeckPlayUsedThisTurn: false,
      pendingOnPlay: null,
      players: {
        ...deployed.players,
        'player-two': {
          ...deployed.players['player-two'],
          battleArea: [],
          hand: [extraCookie],
        },
      },
    }

    expect(() => deployCookie(replayState, card.instanceId)).toThrow()
  })

  it('resets the once-per-turn EXTRA allowance as its owner enters an Active Phase', () => {
    const { state } = createExtraPlayState()
    const next = advancePhase({
      ...state,
      phase: 'active',
      extraDeckPlayUsedThisTurn: true,
    })

    expect(next.extraDeckPlayUsedThisTurn).toBe(false)
  })
})
