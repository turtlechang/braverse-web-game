import { describe, expect, it } from 'vitest'
import {
  activateCookieSkill,
  beginAttack,
  createDemoGame,
  executeCardEffect,
  resolveFlip,
  type CookieCard,
  type FlipAbility,
  type GameCard,
  type GameState,
} from '.'
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

describe('new card-effect mechanics', () => {
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
})
