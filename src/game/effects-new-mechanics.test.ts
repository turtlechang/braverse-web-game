import { describe, expect, it } from 'vitest'
import {
  applyGameCommand,
  activateCookieSkill,
  beginAttack,
  createDemoGame,
  executeCardEffect,
  getForcedAttackTargetId,
  getEffectSelectionLimits,
  getEffectSelectionCandidates,
  getLegalTurnCommands,
  isEffectConditionMet,
  placeHandCardOnHp,
  resolveOpponentHandDiscard,
  resolveFlip,
  type CardEffect,
  type CookieCard,
  type EnergyColor,
  type FlipAbility,
  type GameCard,
  type GameState,
} from '.'
import { createCardCheckDemoState } from './demo'
import { GameRuleError } from './errors'

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

const makeEnergyCard = (
  instanceId: string,
  energyColor: EnergyColor,
  type: 'item' | 'stage' = 'item',
): GameCard => ({
  id: instanceId,
  instanceId,
  name: instanceId,
  type,
  energyColor,
})

describe('new card-effect mechanics', () => {
  it('filters support-to-hand candidates by card type before resolving the return', () => {
    const base = createDemoGame()
    const supportCookie = makeCookie({
      instanceId: 'support-cookie',
      energyColor: 'green',
    })
    const supportItem = makeEnergyCard('support-item', 'green')
    const state: GameState = {
      ...base,
      players: {
        ...base.players,
        'player-one': {
          ...base.players['player-one'],
          supportArea: [
            { card: supportCookie, rested: false },
            { card: supportItem, rested: false },
          ],
        },
      },
    }
    const effect: CardEffect = {
      kind: 'support-to-hand',
      amount: 1,
      cardType: 'cookie',
    }

    expect(
      getEffectSelectionCandidates(state, {
        sourcePlayerId: 'player-one',
        sourceInstanceId: 'source',
      }, effect).map((card) => card.instanceId),
    ).toEqual([supportCookie.instanceId])
    expect(() =>
      executeCardEffect(
        state,
        { sourcePlayerId: 'player-one', sourceInstanceId: 'source' },
        effect,
        [supportItem.instanceId],
      ),
    ).toThrow('選擇的卡片不在支援區。')

    const resolved = executeCardEffect(
      state,
      { sourcePlayerId: 'player-one', sourceInstanceId: 'source' },
      effect,
      [supportCookie.instanceId],
    )
    expect(resolved.players['player-one'].hand).toContainEqual(supportCookie)
    expect(resolved.players['player-one'].supportArea).toEqual([
      { card: supportItem, rested: false },
    ])
  })

  it('allows an optional support-to-hand effect to resolve without a selection', () => {
    const state = createDemoGame()
    const effect: CardEffect = {
      kind: 'support-to-hand',
      amount: 1,
      optional: true,
    }

    expect(
      executeCardEffect(
        state,
        { sourcePlayerId: 'player-one', sourceInstanceId: 'source' },
        effect,
        [],
      ),
    ).toEqual(state)
  })

  it('returns any number of matching-color support cards without offering other colors', () => {
    const base = createDemoGame()
    const greenFirst = makeEnergyCard('green-first', 'green')
    const red = makeEnergyCard('red', 'red')
    const greenSecond = makeEnergyCard('green-second', 'green', 'stage')
    const state: GameState = {
      ...base,
      players: {
        ...base.players,
        'player-one': {
          ...base.players['player-one'],
          supportArea: [
            { card: greenFirst, rested: false },
            { card: red, rested: false },
            { card: greenSecond, rested: true },
          ],
        },
      },
    }
    const effect: CardEffect = {
      kind: 'support-to-hand',
      amount: 0,
      anyNumber: true,
      optional: true,
      energyColor: 'green',
    }

    expect(
      getEffectSelectionCandidates(state, {
        sourcePlayerId: 'player-one',
        sourceInstanceId: 'source',
      }, effect).map((card) => card.instanceId),
    ).toEqual([greenFirst.instanceId, greenSecond.instanceId])

    const resolved = executeCardEffect(
      state,
      { sourcePlayerId: 'player-one', sourceInstanceId: 'source' },
      effect,
      [greenFirst.instanceId, greenSecond.instanceId],
    )
    expect(resolved.players['player-one'].hand).toEqual(
      expect.arrayContaining([greenFirst, greenSecond]),
    )
    expect(resolved.players['player-one'].supportArea).toEqual([
      { card: red, rested: false },
    ])
  })

  it('records Cookies played from trash for this-turn stage conditions', () => {
    const base = createDemoGame()
    const trashCookie = makeCookie({
      instanceId: 'trash-cookie',
      energyColor: 'purple',
    })
    const handCookie = makeCookie({
      instanceId: 'hand-cookie',
      energyColor: 'purple',
    })
    const state: GameState = {
      ...base,
      players: {
        ...base.players,
        'player-one': {
          ...base.players['player-one'],
          discardPile: [...base.players['player-one'].discardPile, trashCookie],
          hand: [...base.players['player-one'].hand, handCookie],
        },
      },
    }
    const context = {
      sourcePlayerId: 'player-one' as const,
      sourceInstanceId: 'source',
    }
    const played = executeCardEffect(
      state,
      context,
      { kind: 'trash-to-battle', amount: 1 },
      [trashCookie.instanceId],
    )

    expect(played.cookiesPlayedFromTrashThisTurn).toEqual({
      'player-one': true,
    })
    const playedFromHand = executeCardEffect(
      state,
      context,
      { kind: 'hand-to-battle', amount: 1 },
      [handCookie.instanceId],
    )
    expect(playedFromHand.cookiesPlayedFromTrashThisTurn).toBeUndefined()
    expect(
      isEffectConditionMet(played, context, {
        kind: 'damage-all',
        amount: 1,
        side: 'opponent',
        condition: { kind: 'cookie-played-from-trash-this-turn' },
      }),
    ).toBe(true)
    expect(
      isEffectConditionMet(state, context, {
        kind: 'damage-all',
        amount: 1,
        side: 'opponent',
        condition: { kind: 'cookie-played-from-trash-this-turn' },
      }),
    ).toBe(false)
  })

  it('limits BS6-030 draws to own break Cookies at the requested level', () => {
    const base = createDemoGame()
    const lowLevel = makeCookie({ instanceId: 'break-low', level: 1 })
    const levelTwo = makeCookie({ instanceId: 'break-two', level: 2 })
    const levelThree = makeCookie({ instanceId: 'break-three', level: 3 })
    const state: GameState = {
      ...base,
      players: {
        ...base.players,
        'player-one': {
          ...base.players['player-one'],
          breakArea: [lowLevel, levelTwo, levelThree],
        },
      },
    }

    const resolved = executeCardEffect(
      state,
      { sourcePlayerId: 'player-one', sourceInstanceId: 'source' },
      {
        kind: 'draw-up-to-break-cookie-count',
        minLevel: 2,
        amountPerCookie: 1,
      },
      [],
    )

    expect(resolved.pendingDrawUpTo).toMatchObject({
      playerId: 'player-one',
      max: 2,
    })
  })

  it('field-to-trash-all sends matching cookies from both battle areas to the trash', () => {
    const base = asMainPhase(createDemoGame())
    const lowLevel = makeCookie({ instanceId: 'low', level: 2 })
    const highLevel = makeCookie({ instanceId: 'high', level: 3 })
    const state: GameState = {
      ...base,
      players: {
        ...base.players,
        'player-one': {
          ...base.players['player-one'],
          battleArea: [{ card: lowLevel, hpCards: [], rested: false }],
        },
        'player-two': {
          ...base.players['player-two'],
          battleArea: [
            { card: highLevel, hpCards: [], rested: false },
            {
              card: base.players['player-two'].battleArea[0].card,
              hpCards: [],
              rested: false,
            },
          ],
        },
      },
    }

    const resolved = executeCardEffect(
      state,
      { sourcePlayerId: 'player-one', sourceInstanceId: 'source' },
      { kind: 'field-to-trash-all', maxLevel: 2 },
      [],
    )

    expect(resolved.players['player-one'].battleArea).toHaveLength(0)
    expect(resolved.players['player-one'].discardPile).toContainEqual(lowLevel)
    expect(resolved.players['player-two'].battleArea).toHaveLength(1)
    expect(resolved.players['player-two'].battleArea[0].card.instanceId).toBe(
      highLevel.instanceId,
    )
  })

  it('disable-attack marks a cookie so it cannot attack on the stored turn', () => {
    const base = createDemoGame()
    const opponentCookie = base.players['player-two'].battleArea[0]
    const resolved = executeCardEffect(
      base,
      { sourcePlayerId: 'player-one', sourceInstanceId: 'source' },
      {
        kind: 'disable-attack',
        duration: 'opponent-next-turn',
        target: { side: 'opponent', min: 0, max: 1 },
      },
      [opponentCookie.card.instanceId],
    )

    expect(
      resolved.attackDisabledUntilTurn?.[opponentCookie.card.instanceId],
    ).toBe(base.turnNumber + 1)
  })

  it('beginAttack rejects an attacker disabled for the current turn', () => {
    const base = createDemoGame()
    const attacker = base.players['player-one'].battleArea[0]
    const target = base.players['player-two'].battleArea[0]
    const state: GameState = {
      ...base,
      attackDisabledUntilTurn: {
        [attacker.card.instanceId]: base.turnNumber,
      },
    }

    expect(() =>
      beginAttack(state, attacker.card.instanceId, target.card.instanceId, []),
    ).toThrow(GameRuleError)
  })

  it('trash-to-hand returns selected discard cards to hand', () => {
    const base = asMainPhase(createDemoGame())
    const purpleCard: GameCard = {
      id: 'purple-card',
      instanceId: 'purple-card',
      name: 'Purple Card',
      type: 'item',
      energyColor: 'purple',
    }
    const state: GameState = {
      ...base,
      players: {
        ...base.players,
        'player-one': {
          ...base.players['player-one'],
          discardPile: [purpleCard],
        },
      },
    }

    const resolved = executeCardEffect(
      state,
      { sourcePlayerId: 'player-one', sourceInstanceId: 'source' },
      { kind: 'trash-to-hand', max: 1, energyColor: 'purple' },
      [purpleCard.instanceId],
    )

    expect(resolved.players['player-one'].hand).toContainEqual(purpleCard)
    expect(resolved.players['player-one'].discardPile).toHaveLength(0)
  })

  it('trash-to-deck shuffles selected cards back into the deck', () => {
    const base = asMainPhase(createDemoGame())
    const flipCard: GameCard = {
      id: 'flip-card',
      instanceId: 'flip-card',
      name: 'Flip Card',
      type: 'item',
      flip: { text: 'flip', cost: {}, effects: [] },
    }
    const plainCard: GameCard = {
      id: 'plain-card',
      instanceId: 'plain-card',
      name: 'Plain Card',
      type: 'item',
    }
    const state: GameState = {
      ...base,
      players: {
        ...base.players,
        'player-one': {
          ...base.players['player-one'],
          discardPile: [flipCard, plainCard],
        },
      },
    }

    const resolved = executeCardEffect(
      state,
      { sourcePlayerId: 'player-one', sourceInstanceId: 'source' },
      { kind: 'trash-to-deck', max: 3, excludeFlip: true },
      [plainCard.instanceId],
    )

    expect(resolved.players['player-one'].discardPile).toEqual([flipCard])
    expect(resolved.players['player-one'].deck).toContainEqual(plainCard)
  })

  it('trash-to-deck can place selected cards on the deck bottom in selection order', () => {
    const base = asMainPhase(createDemoGame())
    const firstCard: GameCard = {
      id: 'first-card',
      instanceId: 'first-card',
      name: 'First Card',
      type: 'item',
    }
    const secondCard: GameCard = {
      id: 'second-card',
      instanceId: 'second-card',
      name: 'Second Card',
      type: 'item',
    }
    const deckCard: GameCard = {
      id: 'deck-card',
      instanceId: 'deck-card',
      name: 'Deck Card',
      type: 'item',
    }
    const state: GameState = {
      ...base,
      players: {
        ...base.players,
        'player-one': {
          ...base.players['player-one'],
          deck: [deckCard],
          discardPile: [firstCard, secondCard],
        },
      },
    }

    const resolved = executeCardEffect(
      state,
      { sourcePlayerId: 'player-one', sourceInstanceId: 'source' },
      { kind: 'trash-to-deck', max: 2, destination: 'bottom' },
      [secondCard.instanceId, firstCard.instanceId],
    )

    expect(resolved.players['player-one'].deck).toEqual([
      deckCard,
      secondCard,
      firstCard,
    ])
    expect(resolved.players['player-one'].discardPile).toEqual([])
  })

  it('recognizes BS4 break-area and FLIP-count conditions', () => {
    const base = asMainPhase(createDemoGame())
    const yellowLv3 = makeCookie({
      instanceId: 'yellow-lv3',
      level: 3,
      energyColor: 'yellow',
    })
    const flipCards: GameCard[] = [1, 2, 3].map((index) => ({
      id: `flip-${index}`,
      instanceId: `flip-${index}`,
      name: `Flip ${index}`,
      type: 'item',
      flip: { text: 'flip', cost: {}, effects: [] },
    }))
    const state: GameState = {
      ...base,
      players: {
        ...base.players,
        'player-one': {
          ...base.players['player-one'],
          breakArea: [yellowLv3],
          discardPile: flipCards,
        },
      },
    }
    const context = {
      sourcePlayerId: 'player-one' as const,
      sourceInstanceId: 'source',
    }

    expect(
      isEffectConditionMet(state, context, {
        kind: 'damage',
        amount: 1,
        target: { side: 'opponent', min: 0, max: 1 },
        condition: {
          kind: 'break-area-has-card',
          side: 'self',
          color: 'yellow',
          minLevel: 3,
          maxLevel: 3,
        },
      }),
    ).toBe(true)
    expect(
      isEffectConditionMet(state, context, {
        kind: 'damage',
        amount: 1,
        target: { side: 'opponent', min: 0, max: 1 },
        condition: { kind: 'trash-flip-count-at-least', count: 3 },
      }),
    ).toBe(true)
  })

  it('resolves opponent hand cards to the deck bottom for BS4-069', () => {
    const base = asMainPhase(createDemoGame())
    const opponentHandCard: GameCard = {
      id: 'opponent-hand-card',
      instanceId: 'opponent-hand-card',
      name: 'Opponent Hand Card',
      type: 'item',
    }
    const opponentDeckCard: GameCard = {
      id: 'opponent-deck-card',
      instanceId: 'opponent-deck-card',
      name: 'Opponent Deck Card',
      type: 'item',
    }
    const pending = executeCardEffect(
      {
        ...base,
        players: {
          ...base.players,
          'player-two': {
            ...base.players['player-two'],
            hand: [opponentHandCard],
            deck: [opponentDeckCard],
          },
        },
      },
      { sourcePlayerId: 'player-one', sourceInstanceId: 'source' },
      { kind: 'opponent-discard-hand', count: 1, destination: 'deck-bottom' },
      [],
    )

    const resolved = resolveOpponentHandDiscard(
      pending,
      'player-two',
      [opponentHandCard.instanceId],
    )

    expect(resolved.players['player-two'].hand).toEqual([])
    expect(resolved.players['player-two'].deck).toEqual([
      opponentDeckCard,
      opponentHandCard,
    ])
    expect(resolved.players['player-two'].discardPile).not.toContainEqual(
      opponentHandCard,
    )
  })

  it('hp-to-support moves an attached HP card into the support area', () => {
    const base = asMainPhase(createDemoGame())
    const cookie = makeCookie({ instanceId: 'green-cookie', energyColor: 'green' })
    const hpCard: GameCard = {
      id: 'hp-card',
      instanceId: 'hp-card',
      name: 'HP Card',
      type: 'item',
    }
    const secondHpCard: GameCard = {
      id: 'hp-card-2',
      instanceId: 'hp-card-2',
      name: 'HP Card 2',
      type: 'item',
    }
    const state: GameState = {
      ...base,
      players: {
        ...base.players,
        'player-one': {
          ...base.players['player-one'],
          battleArea: [
            { card: cookie, hpCards: [secondHpCard, hpCard], rested: false },
          ],
        },
      },
    }

    const resolved = executeCardEffect(
      state,
      { sourcePlayerId: 'player-one', sourceInstanceId: 'source' },
      {
        kind: 'hp-to-support',
        amount: 1,
        target: { side: 'self', min: 0, max: 1, energyColor: 'green' },
      },
      [cookie.instanceId],
    )

    expect(resolved.players['player-one'].supportArea).toContainEqual({
      card: hpCard,
      rested: false,
    })
    expect(resolved.players['player-one'].battleArea[0].hpCards).toHaveLength(1)
  })

  it('break-to-battle plays a cookie from the break area', () => {
    const base = asMainPhase(createDemoGame())
    const breakCookie = makeCookie({
      instanceId: 'break-cookie',
      level: 1,
      hp: 2,
      energyColor: 'yellow',
    })
    const state: GameState = {
      ...base,
      players: {
        ...base.players,
        'player-one': {
          ...base.players['player-one'],
          breakArea: [breakCookie],
        },
      },
    }

    const resolved = executeCardEffect(
      state,
      { sourcePlayerId: 'player-one', sourceInstanceId: 'source' },
      { kind: 'break-to-battle', amount: 1, exactLevel: 1, energyColor: 'yellow' },
      [breakCookie.instanceId],
    )

    expect(resolved.players['player-one'].breakArea).toHaveLength(0)
    expect(
      resolved.players['player-one'].battleArea.some(
        (cookie) => cookie.card.instanceId === breakCookie.instanceId,
      ),
    ).toBe(true)
  })

  it('support-to-battle plays a cookie from the support area (BS4-058)', () => {
    const base = asMainPhase(createDemoGame())
    const supportCookie = makeCookie({
      instanceId: 'support-cookie',
      level: 2,
      hp: 3,
      energyColor: 'green',
    })
    const state: GameState = {
      ...base,
      players: {
        ...base.players,
        'player-one': {
          ...base.players['player-one'],
          supportArea: [{ card: supportCookie, rested: false }],
        },
      },
    }

    const resolved = executeCardEffect(
      state,
      { sourcePlayerId: 'player-one', sourceInstanceId: 'source' },
      { kind: 'support-to-battle', amount: 1, energyColor: 'green' },
      [supportCookie.instanceId],
    )

    expect(resolved.players['player-one'].supportArea).toHaveLength(0)
    expect(
      resolved.players['player-one'].battleArea.some(
        (cookie) => cookie.card.instanceId === supportCookie.instanceId,
      ),
    ).toBe(true)
  })

  it('battle-to-break moves a battling cookie into the break area (not the trash)', () => {
    const base = asMainPhase(createDemoGame())
    const cookie = makeCookie({ instanceId: 'to-break' })
    const hpCard: GameCard = {
      id: 'hp-card',
      instanceId: 'hp-card',
      name: 'HP Card',
      type: 'item',
    }
    const state: GameState = {
      ...base,
      players: {
        ...base.players,
        'player-one': {
          ...base.players['player-one'],
          battleArea: [
            ...base.players['player-one'].battleArea,
            { card: cookie, hpCards: [hpCard], rested: false },
          ],
        },
      },
    }

    const resolved = executeCardEffect(
      state,
      { sourcePlayerId: 'player-one', sourceInstanceId: 'source' },
      { kind: 'battle-to-break', target: { side: 'self', min: 1, max: 1 } },
      [cookie.instanceId],
    )

    expect(resolved.players['player-one'].breakArea).toContainEqual(cookie)
    expect(resolved.players['player-one'].discardPile).toContainEqual(hpCard)
    expect(
      resolved.players['player-one'].battleArea.some(
        (b) => b.card.instanceId === cookie.instanceId,
      ),
    ).toBe(false)
  })

  it('break-to-hand-by-level-sum requires the selected levels to sum exactly', () => {
    const base = asMainPhase(createDemoGame())
    const one = makeCookie({ instanceId: 'lv1', level: 1, energyColor: 'yellow' })
    const two = makeCookie({ instanceId: 'lv2', level: 2, energyColor: 'yellow' })
    const state: GameState = {
      ...base,
      players: {
        ...base.players,
        'player-one': {
          ...base.players['player-one'],
          breakArea: [one, two],
        },
      },
    }

    expect(() =>
      executeCardEffect(
        state,
        { sourcePlayerId: 'player-one', sourceInstanceId: 'source' },
        { kind: 'break-to-hand-by-level-sum', targetSum: 3, energyColor: 'yellow' },
        [one.instanceId],
      ),
    ).toThrow(GameRuleError)

    const resolved = executeCardEffect(
      state,
      { sourcePlayerId: 'player-one', sourceInstanceId: 'source' },
      { kind: 'break-to-hand-by-level-sum', targetSum: 3, energyColor: 'yellow' },
      [one.instanceId, two.instanceId],
    )

    expect(resolved.players['player-one'].breakArea).toHaveLength(0)
    expect(resolved.players['player-one'].hand).toEqual(
      expect.arrayContaining([one, two]),
    )
  })

  it('hand-to-break-by-level-sum requires the selected levels to sum exactly (BS3-047)', () => {
    const base = asMainPhase(createDemoGame())
    const one = makeCookie({ instanceId: 'lv1', level: 1, energyColor: 'yellow' })
    const two = makeCookie({ instanceId: 'lv2', level: 2, energyColor: 'yellow' })
    const offColor = makeCookie({ instanceId: 'lv1-red', level: 1, energyColor: 'red' })
    const state: GameState = {
      ...base,
      players: {
        ...base.players,
        'player-one': {
          ...base.players['player-one'],
          hand: [one, two, offColor],
        },
      },
    }

    // 選 1 張不足以達到目標總和 3。
    expect(() =>
      executeCardEffect(
        state,
        { sourcePlayerId: 'player-one', sourceInstanceId: 'source' },
        { kind: 'hand-to-break-by-level-sum', targetSum: 3, energyColor: 'yellow' },
        [one.instanceId],
      ),
    ).toThrow(GameRuleError)

    // 非黃色的卡不在合法候選範圍內，即使等級總和湊得起來也不能選。
    expect(() =>
      executeCardEffect(
        state,
        { sourcePlayerId: 'player-one', sourceInstanceId: 'source' },
        { kind: 'hand-to-break-by-level-sum', targetSum: 3, energyColor: 'yellow' },
        [two.instanceId, offColor.instanceId],
      ),
    ).toThrow(GameRuleError)

    const resolved = executeCardEffect(
      state,
      { sourcePlayerId: 'player-one', sourceInstanceId: 'source' },
      { kind: 'hand-to-break-by-level-sum', targetSum: 3, energyColor: 'yellow' },
      [one.instanceId, two.instanceId],
    )

    expect(resolved.players['player-one'].hand).toEqual(
      expect.arrayContaining([offColor]),
    )
    expect(resolved.players['player-one'].hand).toHaveLength(1)
    expect(resolved.players['player-one'].breakArea).toEqual(
      expect.arrayContaining([one, two]),
    )
  })

  it('break-to-trash now supports a maxLevel ceiling instead of only exact level', () => {
    const base = asMainPhase(createDemoGame())
    const low = makeCookie({ instanceId: 'low-break', level: 1 })
    const state: GameState = {
      ...base,
      players: {
        ...base.players,
        'player-one': {
          ...base.players['player-one'],
          breakArea: [low],
        },
      },
    }

    const resolved = executeCardEffect(
      state,
      { sourcePlayerId: 'player-one', sourceInstanceId: 'source' },
      { kind: 'break-to-trash', max: 1, maxLevel: 2 },
      [low.instanceId],
    )

    expect(resolved.players['player-one'].breakArea).toHaveLength(0)
    expect(resolved.players['player-one'].discardPile).toContainEqual(low)
  })

  it('trash-count-at-least condition gates a persistent modify-attack effect', () => {
    const base = createDemoGame()
    const source = base.players['player-one'].battleArea[0]
    const withFewTrash: GameState = {
      ...base,
      players: {
        ...base.players,
        'player-one': { ...base.players['player-one'], discardPile: [] },
      },
    }

    expect(() =>
      executeCardEffect(
        withFewTrash,
        {
          sourcePlayerId: 'player-one',
          sourceInstanceId: source.card.instanceId,
        },
        {
          kind: 'modify-attack',
          amount: 2,
          duration: 'persistent',
          target: { side: 'self', min: 1, max: 1, sourceOnly: true },
          condition: { kind: 'trash-count-at-least', count: 15 },
        },
        [source.card.instanceId],
      ),
    ).toThrow(GameRuleError)

    const filler: GameCard = {
      id: 'filler',
      instanceId: 'filler',
      name: 'filler',
      type: 'item',
    }
    const withEnoughTrash: GameState = {
      ...base,
      players: {
        ...base.players,
        'player-one': {
          ...base.players['player-one'],
          discardPile: Array.from({ length: 15 }, (_, i) => ({
            ...filler,
            instanceId: `${filler.instanceId}-${i}`,
          })),
        },
      },
    }

    const resolved = executeCardEffect(
      withEnoughTrash,
      { sourcePlayerId: 'player-one', sourceInstanceId: source.card.instanceId },
      {
        kind: 'modify-attack',
        amount: 2,
        duration: 'persistent',
        target: { side: 'self', min: 1, max: 1, sourceOnly: true },
        condition: { kind: 'trash-count-at-least', count: 15 },
      },
      [source.card.instanceId],
    )
    expect(resolved.attackModifiers).toHaveLength(1)
  })

  it('activateCookieSkill supports a sourceOnly trashBattleCookie cost', () => {
    const base = asMainPhase(createDemoGame())
    const skillCookie = makeCookie({
      instanceId: 'sacrifice-cookie',
      skill: {
        trigger: 'activate',
        oncePerTurn: false,
        yourTurn: true,
        restSource: false,
        cost: {
          energy: {},
          discardHand: 0,
          trashBattleCookie: { count: 1, sourceOnly: true },
        },
        text: 'sacrifice self, deal 1 damage',
        effects: [
          {
            kind: 'damage',
            amount: 1,
            target: { side: 'opponent', min: 0, max: 1 },
          },
        ],
      },
    })
    const hpCard: GameCard = {
      id: 'hp-card',
      instanceId: 'hp-card',
      name: 'HP Card',
      type: 'item',
    }
    const state: GameState = {
      ...base,
      players: {
        ...base.players,
        'player-one': {
          ...base.players['player-one'],
          battleArea: [
            ...base.players['player-one'].battleArea,
            { card: skillCookie, hpCards: [hpCard], rested: false },
          ],
        },
      },
    }

    const activated = activateCookieSkill(
      state,
      'player-one',
      skillCookie.instanceId,
      'activate',
      [],
    )

    expect(
      activated.players['player-one'].battleArea.some(
        (cookie) => cookie.card.instanceId === skillCookie.instanceId,
      ),
    ).toBe(false)
    expect(activated.players['player-one'].discardPile).toContainEqual(
      skillCookie,
    )
    expect(activated.players['player-one'].discardPile).toContainEqual(hpCard)
  })

  it('activateCookieSkill supports a selfToBreakArea cost', () => {
    const base = asMainPhase(createDemoGame())
    const skillCookie = makeCookie({
      instanceId: 'break-self-cookie',
      skill: {
        trigger: 'activate',
        oncePerTurn: false,
        yourTurn: true,
        restSource: false,
        cost: { energy: {}, discardHand: 0, selfToBreakArea: true },
        text: 'go to break area, deal 1 damage',
        effects: [
          {
            kind: 'damage',
            amount: 1,
            target: { side: 'opponent', min: 0, max: 1 },
          },
        ],
      },
    })
    const hpCard: GameCard = {
      id: 'hp-card',
      instanceId: 'hp-card',
      name: 'HP Card',
      type: 'item',
    }
    const state: GameState = {
      ...base,
      players: {
        ...base.players,
        'player-one': {
          ...base.players['player-one'],
          battleArea: [
            ...base.players['player-one'].battleArea,
            { card: skillCookie, hpCards: [hpCard], rested: false },
          ],
        },
      },
    }

    const activated = activateCookieSkill(
      state,
      'player-one',
      skillCookie.instanceId,
      'activate',
      [],
    )

    expect(activated.players['player-one'].breakArea).toContainEqual(
      skillCookie,
    )
    expect(activated.players['player-one'].discardPile).toContainEqual(hpCard)
    expect(
      activated.players['player-one'].battleArea.some(
        (cookie) => cookie.card.instanceId === skillCookie.instanceId,
      ),
    ).toBe(false)
  })

  it('activateCookieSkill pays an HP-to-trash skill cost from the selected Cookie', () => {
    const base = asMainPhase(createDemoGame())
    const skillCookie = makeCookie({
      instanceId: 'hp-cost-cookie',
      skill: {
        trigger: 'activate',
        oncePerTurn: false,
        yourTurn: true,
        restSource: false,
        cost: { energy: {}, discardHand: 0, hpToTrash: { amount: 1 } },
        text: 'place one HP card into the trash, draw one',
        effects: [{ kind: 'draw', amount: 1 }],
      },
    })
    const hpCardA: GameCard = {
      id: 'hp-card-a',
      instanceId: 'hp-card-a',
      name: 'HP Card A',
      type: 'item',
    }
    const hpCardB: GameCard = {
      id: 'hp-card-b',
      instanceId: 'hp-card-b',
      name: 'HP Card B',
      type: 'item',
    }
    const state: GameState = {
      ...base,
      players: {
        ...base.players,
        'player-one': {
          ...base.players['player-one'],
          battleArea: [
            ...base.players['player-one'].battleArea,
            { card: skillCookie, hpCards: [hpCardA, hpCardB], rested: false },
          ],
        },
      },
    }

    const activated = activateCookieSkill(
      state,
      'player-one',
      skillCookie.instanceId,
      'activate',
      [],
      [],
      [],
      [],
      [],
      [],
      undefined,
      [skillCookie.instanceId],
    )

    const activatedCookie = activated.players['player-one'].battleArea.find(
      (cookie) => cookie.card.instanceId === skillCookie.instanceId,
    )
    expect(activatedCookie?.hpCards).toEqual([hpCardA])
    expect(activated.players['player-one'].discardPile).toContainEqual(hpCardB)
  })

  it('activateCookieSkill supports a selfToDeckBottom cost (BS4-077)', () => {
    const base = asMainPhase(createDemoGame())
    const skillCookie = makeCookie({
      instanceId: 'deck-bottom-self-cookie',
      skill: {
        trigger: 'activate',
        oncePerTurn: false,
        yourTurn: true,
        restSource: false,
        cost: { energy: {}, discardHand: 0, selfToDeckBottom: true },
        text: 'go to the bottom of the deck, draw up to 2',
        effects: [{ kind: 'draw-up-to', max: 2 }],
      },
    })
    const hpCard: GameCard = {
      id: 'hp-card',
      instanceId: 'hp-card',
      name: 'HP Card',
      type: 'item',
    }
    const state: GameState = {
      ...base,
      players: {
        ...base.players,
        'player-one': {
          ...base.players['player-one'],
          battleArea: [
            ...base.players['player-one'].battleArea,
            { card: skillCookie, hpCards: [hpCard], rested: false },
          ],
        },
      },
    }

    const activated = activateCookieSkill(
      state,
      'player-one',
      skillCookie.instanceId,
      'activate',
      [],
    )

    expect(activated.players['player-one'].deck.at(-1)).toEqual(skillCookie)
    expect(activated.players['player-one'].discardPile).toContainEqual(hpCard)
    expect(
      activated.players['player-one'].battleArea.some(
        (cookie) => cookie.card.instanceId === skillCookie.instanceId,
      ),
    ).toBe(false)
  })

  it('resolveFlip places the flip card into support instead of discard when flip-to-support triggers', () => {
    const base = createDemoGame()
    const defenderCookie = base.players['player-two'].battleArea[0]
    const flipAbility: FlipAbility = {
      text: 'flip-to-support',
      cost: { energy: {}, discardHand: 0 },
      effects: [
        {
          kind: 'flip-to-support',
          rested: true,
          condition: { kind: 'support-count-at-least', count: 0 },
        },
      ],
    }
    const flipHpCard: GameCard = {
      id: 'flip-hp',
      instanceId: 'flip-hp',
      name: 'Flip HP',
      type: 'item',
      flip: flipAbility,
    }
    const state: GameState = {
      ...base,
      pendingBattle: {
        attackerPlayerId: 'player-one',
        defenderPlayerId: 'player-two',
        attackerInstanceId:
          base.players['player-one'].battleArea[0].card.instanceId,
        targetInstanceId: defenderCookie.card.instanceId,
        declaredDamage: 1,
        remainingDamage: 1,
        stage: 'flip',
        trapUsed: false,
        revealedHpCard: flipHpCard,
        preventKnockoutTargetIds: [],
        faintedColors: [],
        attackEffects: [],
        attackEffectIndex: 0,
        damageTargetInstanceId: defenderCookie.card.instanceId,
      },
    }

    const resolved = resolveFlip(state, 'player-two', { activate: true })

    expect(resolved.players['player-two'].supportArea).toContainEqual({
      card: flipHpCard,
      rested: true,
    })
    expect(resolved.players['player-two'].discardPile).not.toContainEqual(
      flipHpCard,
    )
  })

  it('BS4-030 cycle-hp phase 1: the target faints when it had 1 HP card, and no phase 2 runs', () => {
    const base = asMainPhase(createDemoGame())
    const source = makeCookie({
      instanceId: 'peach-blossom',
      energyColor: 'yellow',
    })
    const target = makeCookie({
      instanceId: 'yellow-target',
      energyColor: 'yellow',
    })
    const hpCard = makeEnergyCard('target-hp', 'yellow')
    const handCard = makeEnergyCard('replacement-hand-card', 'yellow')
    const state: GameState = {
      ...base,
      players: {
        ...base.players,
        'player-one': {
          ...base.players['player-one'],
          battleArea: [
            {
              card: source,
              hpCards: [makeEnergyCard('source-hp', 'yellow')],
              rested: false,
            },
            { card: target, hpCards: [hpCard], rested: false },
          ],
          hand: [handCard],
        },
      },
    }
    const effect = {
      kind: 'cycle-hp' as const,
      target: {
        side: 'self' as const,
        min: 0,
        max: 1,
        excludeSource: true,
        energyColor: 'yellow' as const,
      },
    }

    const resolved = executeCardEffect(
      state,
      { sourcePlayerId: 'player-one', sourceInstanceId: source.instanceId },
      effect,
      [target.instanceId],
    )

    expect(resolved.players['player-one'].battleArea).toHaveLength(1)
    expect(resolved.players['player-one'].breakArea).toContainEqual(target)
    expect(resolved.players['player-one'].hand).toEqual([handCard, hpCard])
    expect(resolved.players['player-one'].hand).not.toContainEqual(
      expect.objectContaining({ instanceId: target.instanceId }),
    )
  })

  it('BS4-030 cycle-hp two phases: return top HP, then place an optional hand card', () => {
    const base = asMainPhase(createDemoGame())
    const source = makeCookie({ instanceId: 'peach-blossom-2', energyColor: 'yellow' })
    const target = makeCookie({ instanceId: 'yellow-target-2', energyColor: 'yellow' })
    const lowerHp = makeEnergyCard('target-lower-hp', 'yellow')
    const topHp = makeEnergyCard('target-top-hp', 'yellow')
    const handCard = makeEnergyCard('replacement-hand-card-2', 'yellow')
    const state: GameState = {
      ...base,
      players: {
        ...base.players,
        'player-one': {
          ...base.players['player-one'],
          battleArea: [
            {
              card: source,
              hpCards: [makeEnergyCard('source-hp-2', 'yellow')],
              rested: false,
            },
            { card: target, hpCards: [lowerHp, topHp], rested: false },
          ],
          hand: [handCard],
        },
      },
    }
    const effect = {
      kind: 'cycle-hp' as const,
      target: {
        side: 'self' as const,
        min: 0,
        max: 1,
        excludeSource: true,
        energyColor: 'yellow' as const,
      },
    }
    const context = {
      sourcePlayerId: 'player-one' as const,
      sourceInstanceId: source.instanceId,
    }

    const phase1 = executeCardEffect(state, context, effect, [target.instanceId])
    expect(phase1.players['player-one'].hand).toEqual([handCard, topHp])
    const targetAfterPhase1 = phase1.players['player-one'].battleArea.find(
      (cookie) => cookie.card.instanceId === target.instanceId,
    )
    expect(targetAfterPhase1?.hpCards).toEqual([lowerHp])

    const phase2 = placeHandCardOnHp(
      phase1,
      context,
      target.instanceId,
      handCard.instanceId,
    )
    const resolvedTarget = phase2.players['player-one'].battleArea.find(
      (cookie) => cookie.card.instanceId === target.instanceId,
    )
    expect(resolvedTarget?.hpCards).toEqual([lowerHp, handCard])
    expect(phase2.players['player-one'].hand).toEqual([topHp])

    const skipped = placeHandCardOnHp(phase1, context, target.instanceId)
    expect(skipped).toEqual(phase1)
  })

  it('BS4-044 hand-to-hp two phases: select the Cookie, then place an optional hand card', () => {
    const base = asMainPhase(createDemoGame())
    const target = makeCookie({ instanceId: 'temple-target', energyColor: 'yellow' })
    const existingHp = makeEnergyCard('temple-existing-hp', 'yellow')
    const handCard = makeEnergyCard('temple-hand-card', 'yellow')
    const state: GameState = {
      ...base,
      players: {
        ...base.players,
        'player-one': {
          ...base.players['player-one'],
          battleArea: [{ card: target, hpCards: [existingHp], rested: false }],
          hand: [handCard],
        },
      },
    }
    const effect = {
      kind: 'hand-to-hp' as const,
      target: { side: 'self' as const, min: 0, max: 1 },
      selectTarget: true,
      optional: true,
    }
    const context = {
      sourcePlayerId: 'player-one' as const,
      sourceInstanceId: 'millennial-temple',
    }

    // 第一階段只選目標餅乾：規則層不改動狀態，等第二階段放牌。
    const phase1 = executeCardEffect(state, context, effect, [target.instanceId])
    expect(phase1.players['player-one'].battleArea[0].hpCards).toEqual([
      existingHp,
    ])
    expect(phase1.players['player-one'].hand).toEqual([handCard])

    // 未選目標：整個效果略過，狀態不變。
    expect(executeCardEffect(state, context, effect, [])).toEqual(state)

    const phase2 = placeHandCardOnHp(
      phase1,
      context,
      target.instanceId,
      handCard.instanceId,
    )
    expect(phase2.players['player-one'].battleArea[0].hpCards).toEqual([
      existingHp,
      handCard,
    ])
    expect(phase2.players['player-one'].hand).toEqual([])
  })

  it('BS4-062 rests only newly-rested green supports and deals damage equal to that count', () => {
    const base = asMainPhase(createDemoGame())
    const greenSupports = [1, 2, 3, 4].map((index) => ({
      card: makeEnergyCard(`green-support-${index}`, 'green'),
      rested: false,
    }))
    const alreadyRested = {
      card: makeEnergyCard('green-support-rested', 'green'),
      rested: true,
    }
    const redSupport = {
      card: makeEnergyCard('red-support', 'red'),
      rested: false,
    }
    const target = makeCookie({ instanceId: 'wind-gem-target', hp: 5, energyColor: 'blue' })
    const targetHp = [1, 2, 3, 4, 5].map((index) =>
      makeEnergyCard(`wind-target-hp-${index}`, 'blue'),
    )
    const state: GameState = {
      ...base,
      players: {
        ...base.players,
        'player-one': {
          ...base.players['player-one'],
          supportArea: [...greenSupports, alreadyRested, redSupport],
        },
        'player-two': {
          ...base.players['player-two'],
          battleArea: [{ card: target, hpCards: targetHp, rested: false }],
        },
      },
    }
    const effect = {
      kind: 'rest-support-and-damage' as const,
      supportSide: 'self' as const,
      supportAmount: 4,
      supportEnergyColor: 'green' as const,
      activeOnly: true,
      target: { side: 'opponent' as const, min: 0, max: 1 },
    }

    expect(
      getEffectSelectionCandidates(
        state,
        { sourcePlayerId: 'player-one', sourceInstanceId: 'wind-gems' },
        effect,
      ).map((card) => card.instanceId),
    ).toEqual([
      'green-support-1',
      'green-support-2',
      'green-support-3',
      'green-support-4',
      target.instanceId,
    ])

    const resolved = executeCardEffect(
      state,
      { sourcePlayerId: 'player-one', sourceInstanceId: 'wind-gems' },
      effect,
      [
        ...greenSupports.map((support) => support.card.instanceId),
        target.instanceId,
      ],
    )

    expect(
      resolved.players['player-one'].supportArea
        .filter((support) => support.card.energyColor === 'green')
        .every((support) => support.rested),
    ).toBe(true)
    expect(
      resolved.players['player-one'].supportArea.find(
        (support) => support.card.instanceId === redSupport.card.instanceId,
      )?.rested,
    ).toBe(false)
    expect(resolved.players['player-two'].battleArea[0].hpCards).toHaveLength(1)
  })

  it('BS4-062 pays 2 energy before offering the remaining supports for its effect', () => {
    const state = createCardCheckDemoState('BS4-062')
    const item = state.players['player-one'].hand.find(
      (card) => card.id === 'BS4-062',
    )!
    const paymentIds = state.players['player-one'].supportArea
      .slice(0, 2)
      .map((support) => support.card.instanceId)

    const paid = applyGameCommand(state, {
      kind: 'begin-play-item',
      playerId: 'player-one',
      instanceId: item.instanceId,
      paymentIds,
    })

    expect(
      paid.players['player-one'].supportArea
        .filter((support) => paymentIds.includes(support.card.instanceId))
        .every((support) => support.rested),
    ).toBe(true)

    const pending = paid.pendingAbilityEffect!
    const effect = pending.effects[pending.effectIndex]
    expect(effect.kind).toBe('rest-support-and-damage')
    const candidateIds = getEffectSelectionCandidates(
      paid,
      {
        sourcePlayerId: 'player-one',
        sourceInstanceId: item.instanceId,
      },
      effect,
    ).map((card) => card.instanceId)
    expect(candidateIds).not.toEqual(expect.arrayContaining(paymentIds))

    const effectSupportIds = paid.players['player-one'].supportArea
      .filter((support) => !support.rested)
      .slice(0, 4)
      .map((support) => support.card.instanceId)
    expect(
      paid.players['player-one'].supportArea.filter((support) => !support.rested),
    ).toHaveLength(6)

    const target = paid.players['player-two'].battleArea[0]
    const targetHpBefore = target.hpCards.length
    const resolved = applyGameCommand(paid, {
      kind: 'resolve-ability-effect',
      playerId: 'player-one',
      targetIds: [...effectSupportIds, target.card.instanceId],
    })

    expect(
      resolved.players['player-one'].supportArea.filter(
        (support) => support.rested,
      ),
    ).toHaveLength(6)
    expect(
      resolved.players['player-two'].battleArea.find(
        (cookie) => cookie.card.instanceId === target.card.instanceId,
      )?.hpCards,
    ).toHaveLength(targetHpBefore - 4)
  })

  it('BS4-043 deals the break-area level difference only when its condition is met', () => {
    const base = asMainPhase(createDemoGame())
    const target = makeCookie({ instanceId: 'lightning-target', hp: 5 })
    const targetHp = [1, 2, 3, 4, 5].map((index) =>
      makeEnergyCard(`lightning-target-hp-${index}`, 'blue'),
    )
    const state: GameState = {
      ...base,
      players: {
        ...base.players,
        'player-one': {
          ...base.players['player-one'],
          breakArea: [
            makeCookie({ instanceId: 'break-lv3', level: 3 }),
            makeCookie({ instanceId: 'break-lv2', level: 2 }),
          ],
        },
        'player-two': {
          ...base.players['player-two'],
          breakArea: [makeCookie({ instanceId: 'opponent-break-lv2', level: 2 })],
          battleArea: [{ card: target, hpCards: targetHp, rested: false }],
        },
      },
    }
    const effect = {
      kind: 'damage-by-break-level-difference' as const,
      target: { side: 'opponent' as const, min: 0, max: 1 },
      condition: { kind: 'break-level-higher-than-opponent' as const },
    }

    const resolved = executeCardEffect(
      state,
      { sourcePlayerId: 'player-one', sourceInstanceId: 'lightning' },
      effect,
      [target.instanceId],
    )

    expect(resolved.players['player-two'].battleArea[0].hpCards).toHaveLength(2)
    expect(
      isEffectConditionMet(
        {
          ...resolved,
          players: {
            ...resolved.players,
            'player-one': {
              ...resolved.players['player-one'],
              breakArea: [],
            },
          },
        },
        { sourcePlayerId: 'player-one', sourceInstanceId: 'lightning' },
        effect,
      ),
    ).toBe(false)
  })

  it('BS4-075 allows an opponent LV.1 Cookie or either Stage, but not a friendly Cookie', () => {
    const base = asMainPhase(createDemoGame())
    const friendlyCookie = makeCookie({ instanceId: 'friendly-lv1', level: 1 })
    const opponentCookie = makeCookie({ instanceId: 'opponent-lv1', level: 1 })
    const friendlyStage = makeEnergyCard('friendly-stage', 'blue', 'stage')
    const opponentStage = makeEnergyCard('opponent-stage', 'red', 'stage')
    const state: GameState = {
      ...base,
      players: {
        ...base.players,
        'player-one': {
          ...base.players['player-one'],
          battleArea: [{ card: friendlyCookie, hpCards: [], rested: false }],
          stage: { card: friendlyStage, rested: false },
        },
        'player-two': {
          ...base.players['player-two'],
          battleArea: [{ card: opponentCookie, hpCards: [], rested: false }],
          stage: { card: opponentStage, rested: false },
        },
      },
    }
    const effect = {
      kind: 'field-to-deck-bottom' as const,
      target: { side: 'either' as const, min: 1, max: 1, maxLevel: 1 },
      allowStage: true,
      battleSide: 'opponent' as const,
    }
    const candidates = getEffectSelectionCandidates(
      state,
      { sourcePlayerId: 'player-one', sourceInstanceId: 'black-pearl' },
      effect,
    ).map((card) => card.instanceId)

    expect(candidates).toEqual([
      opponentCookie.instanceId,
      friendlyStage.instanceId,
      opponentStage.instanceId,
    ])
    expect(() =>
      executeCardEffect(
        state,
        { sourcePlayerId: 'player-one', sourceInstanceId: 'black-pearl' },
        effect,
        [friendlyCookie.instanceId],
      ),
    ).toThrow()
  })

  it('BS4-111 places matching Cookies from both battle areas on each deck bottom', () => {
    const base = asMainPhase(createDemoGame())
    const lowOne = makeCookie({ instanceId: 'bs4-111-low-one', level: 2 })
    const highOne = makeCookie({ instanceId: 'bs4-111-high-one', level: 3 })
    const lowTwo = makeCookie({ instanceId: 'bs4-111-low-two', level: 1 })
    const highTwo = makeCookie({ instanceId: 'bs4-111-high-two', level: 3 })
    const hpCard = makeEnergyCard('bs4-111-hp', 'red')
    const equippedCard = makeEnergyCard('bs4-111-equipped', 'blue')
    const state: GameState = {
      ...base,
      players: {
        ...base.players,
        'player-one': {
          ...base.players['player-one'],
          battleArea: [
            { card: lowOne, hpCards: [hpCard], rested: false, equippedCards: [equippedCard] },
            { card: highOne, hpCards: [], rested: false },
          ],
          deck: [],
        },
        'player-two': {
          ...base.players['player-two'],
          battleArea: [
            { card: lowTwo, hpCards: [], rested: false },
            { card: highTwo, hpCards: [], rested: false },
          ],
          deck: [],
        },
      },
    }

    const resolved = executeCardEffect(
      state,
      { sourcePlayerId: 'player-one', sourceInstanceId: 'bs4-111-stage' },
      { kind: 'field-to-deck-bottom-all', maxLevel: 2 },
      [],
    )

    expect(resolved.players['player-one'].battleArea.map((cookie) => cookie.card)).toEqual([
      highOne,
    ])
    expect(resolved.players['player-two'].battleArea.map((cookie) => cookie.card)).toEqual([
      highTwo,
    ])
    expect(resolved.players['player-one'].deck).toEqual([lowOne])
    expect(resolved.players['player-two'].deck).toEqual([lowTwo])
    expect(resolved.players['player-one'].discardPile).toEqual([
      hpCard,
      equippedCard,
    ])
  })

  it('allows an optional field-to-deck-bottom effect to resolve with no target', () => {
    const state = asMainPhase(createDemoGame())
    const effect = {
      kind: 'field-to-deck-bottom' as const,
      target: { side: 'opponent' as const, min: 0, max: 1 },
    }

    expect(
      executeCardEffect(
        state,
        { sourcePlayerId: 'player-one', sourceInstanceId: 'optional-field-source' },
        effect,
        [],
      ),
    ).toEqual(state)
  })

  it('BS4-066 moves a selected green support onto the selected Cookie HP', () => {
    const base = asMainPhase(createDemoGame())
    const target = makeCookie({ instanceId: 'bs4-066-target', energyColor: 'green' })
    const support = makeEnergyCard('bs4-066-support', 'green')
    const state: GameState = {
      ...base,
      players: {
        ...base.players,
        'player-one': {
          ...base.players['player-one'],
          battleArea: [{ card: target, hpCards: [], rested: false }],
          supportArea: [{ card: support, rested: false }],
        },
      },
    }

    const resolved = executeCardEffect(
      state,
      { sourcePlayerId: 'player-one', sourceInstanceId: 'bs4-066-stage' },
      {
        kind: 'support-to-hp',
        target: { side: 'self', min: 0, max: 1 },
        energyColor: 'green',
        selectTarget: true,
        optional: true,
      },
      [support.instanceId, target.instanceId],
    )

    expect(resolved.players['player-one'].supportArea).toEqual([])
    expect(resolved.players['player-one'].battleArea[0].hpCards).toEqual([support])
  })

  it('BS4-074 discards the whole hand before later draw effects resolve', () => {
    const base = asMainPhase(createDemoGame())
    const handCards = [makeEnergyCard('bs4-074-hand-1', 'blue'), makeEnergyCard('bs4-074-hand-2', 'blue')]
    const state: GameState = {
      ...base,
      players: {
        ...base.players,
        'player-one': { ...base.players['player-one'], hand: handCards },
      },
    }

    const resolved = executeCardEffect(
      state,
      { sourcePlayerId: 'player-one', sourceInstanceId: 'bs4-074-cookie' },
      { kind: 'discard-hand-all' },
      [],
    )

    expect(resolved.players['player-one'].hand).toEqual([])
    expect(resolved.players['player-one'].discardPile).toEqual(handCards)
  })

  it('BS4-084 stops drawing exactly when its hand catches up without requiring a refresh', () => {
    const base = asMainPhase(createDemoGame())
    const drawCards = [makeEnergyCard('bs4-084-draw-1', 'blue'), makeEnergyCard('bs4-084-draw-2', 'blue')]
    const opponentHand = [makeEnergyCard('bs4-084-opponent-1', 'red'), makeEnergyCard('bs4-084-opponent-2', 'red')]
    const state: GameState = {
      ...base,
      players: {
        ...base.players,
        'player-one': { ...base.players['player-one'], hand: [], deck: drawCards },
        'player-two': { ...base.players['player-two'], hand: opponentHand },
      },
    }

    const resolved = executeCardEffect(
      state,
      { sourcePlayerId: 'player-one', sourceInstanceId: 'bs4-084-cookie' },
      { kind: 'draw-until-hand-equals-opponent' },
      [],
    )

    expect(resolved.status).toBe('playing')
    expect(resolved.pendingRefresh).toBeNull()
    expect(resolved.players['player-one'].hand).toEqual(drawCards)
    expect(resolved.players['player-one'].deck).toEqual([])
  })

  it('BS4-031 sends an activated FLIP card to the Break Area when its condition is met', () => {
    const base = asMainPhase(createDemoGame())
    const defenderCookie = base.players['player-two'].battleArea[0]
    const revealedCard: GameCard = {
      id: 'bs4-031-flip',
      instanceId: 'bs4-031-flip',
      name: 'BS4-031 FLIP',
      type: 'item',
      flip: {
        text: 'flip-to-break',
        cost: { energy: {}, discardHand: 0 },
        effects: [
          {
            kind: 'flip-to-break',
            condition: { kind: 'break-level-at-least', level: 5 },
          },
        ],
      },
    }
    const state: GameState = {
      ...base,
      players: {
        ...base.players,
        'player-two': {
          ...base.players['player-two'],
          breakArea: [
            makeCookie({ instanceId: 'bs4-031-break-1', level: 2 }),
            makeCookie({ instanceId: 'bs4-031-break-2', level: 3 }),
          ],
        },
      },
      pendingBattle: {
        attackerPlayerId: 'player-one',
        defenderPlayerId: 'player-two',
        attackerInstanceId: base.players['player-one'].battleArea[0].card.instanceId,
        targetInstanceId: defenderCookie.card.instanceId,
        declaredDamage: 1,
        remainingDamage: 1,
        stage: 'flip',
        trapUsed: false,
        revealedHpCard: revealedCard,
        preventKnockoutTargetIds: [],
        faintedColors: [],
        attackEffects: [],
        attackEffectIndex: 0,
        damageTargetInstanceId: defenderCookie.card.instanceId,
      },
    }

    const resolved = resolveFlip(state, 'player-two', { activate: true })

    expect(resolved.players['player-two'].breakArea).toContainEqual(revealedCard)
    expect(resolved.players['player-two'].discardPile).not.toContainEqual(revealedCard)
  })

  it('BS4-024 forces normal attacks to target the active passive Cookie', () => {
    const base = asMainPhase(createDemoGame())
    const attacker = makeCookie({ instanceId: 'attacker', attackCost: 0 })
    const forcedTarget = makeCookie({
      instanceId: 'kumiho-lv3',
      level: 3,
      energyColor: 'yellow',
      skill: {
        trigger: 'passive',
        oncePerTurn: false,
        yourTurn: false,
        restSource: false,
        cost: { energy: {}, discardHand: 0 },
        text: 'opponent Cookies can only attack this Cookie',
        effects: [
          {
            kind: 'redirect-attack',
            target: { side: 'self', min: 1, max: 1, sourceOnly: true },
            condition: {
              kind: 'battle-area-has-color',
              side: 'self',
              color: 'yellow',
              level: 3,
            },
          },
        ],
      },
    })
    const otherTarget = makeCookie({ instanceId: 'other-target' })
    const state: GameState = {
      ...base,
      turnNumber: 2,
      players: {
        ...base.players,
        'player-one': {
          ...base.players['player-one'],
          battleArea: [{ card: attacker, hpCards: [], rested: false }],
        },
        'player-two': {
          ...base.players['player-two'],
          battleArea: [
            { card: forcedTarget, hpCards: [], rested: false },
            { card: otherTarget, hpCards: [], rested: false },
          ],
        },
      },
    }

    expect(getForcedAttackTargetId(state, 'player-one')).toBe(
      forcedTarget.instanceId,
    )
    expect(() =>
      beginAttack(state, attacker.instanceId, otherTarget.instanceId, []),
    ).toThrow()
    expect(
      getLegalTurnCommands(state, 'player-one')
        .filter((command) => command.kind === 'attack')
        .map((command) => command.targetInstanceId),
    ).toEqual([forcedTarget.instanceId])
    expect(
      beginAttack(state, attacker.instanceId, forcedTarget.instanceId, [])
        .pendingBattle?.targetInstanceId,
    ).toBe(forcedTarget.instanceId)
  })

  it('allows an optional trash-to-battle effect to skip or select only eligible base HP', () => {
    const base = asMainPhase(createDemoGame())
    const eligible = makeCookie({
      instanceId: 'purple-hp-2',
      hp: 2,
      energyColor: 'purple',
    })
    const ineligible = makeCookie({
      instanceId: 'purple-hp-3',
      hp: 3,
      energyColor: 'purple',
    })
    const effect = {
      kind: 'trash-to-battle' as const,
      amount: 1,
      optional: true,
      energyColor: 'purple' as const,
      maxHp: 2,
    }
    const state: GameState = {
      ...base,
      players: {
        ...base.players,
        'player-one': {
          ...base.players['player-one'],
          discardPile: [eligible, ineligible],
        },
      },
    }
    const context = { sourcePlayerId: 'player-one' as const, sourceInstanceId: 'source' }

    expect(getEffectSelectionLimits(effect)).toEqual({ min: 0, max: 1 })
    expect(getEffectSelectionCandidates(state, context, effect)).toEqual([eligible])
    expect(executeCardEffect(state, context, effect, [])).toEqual(state)

    const resolved = executeCardEffect(state, context, effect, [eligible.instanceId])
    expect(resolved.players['player-one'].battleArea).toHaveLength(2)
    expect(resolved.players['player-one'].discardPile).toEqual([ineligible])
  })
})
