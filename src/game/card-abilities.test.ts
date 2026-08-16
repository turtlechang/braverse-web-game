import { describe, expect, it } from 'vitest'
import {
  activateStage,
  applyGameCommand,
  canActivateStage,
  canPlayItem,
  createDemoGame,
  executeCardEffect,
  finalizePendingReplacements,
  playItem,
  playStage,
  type GameCard,
  type GameState,
} from '.'

const support = (instanceId: string): GameCard => ({
  id: instanceId,
  instanceId,
  name: instanceId,
  type: 'item',
  energyColor: 'red',
})

const readyState = (): GameState => {
  const state = createDemoGame(7)
  const player = state.players['player-one']
  return {
    ...state,
    activePlayerId: 'player-one',
    phase: 'main',
    players: {
      ...state.players,
      'player-one': {
        ...player,
        supportArea: [
          { card: support('pay-1'), rested: false },
          { card: support('pay-2'), rested: false },
          { card: support('pay-3'), rested: false },
        ],
      },
    },
  }
}

describe('item and stage actions', () => {
  it('pays for an item and moves it from hand to trash', () => {
    const item: GameCard = {
      id: 'item',
      instanceId: 'item-1',
      name: 'Item',
      type: 'item',
      item: {
        cost: { red: 2 },
        text: 'item',
        effects: [{ kind: 'draw', amount: 1 }],
      },
    }
    const state = readyState()
    state.players['player-one'].hand = [item]

    const next = playItem(state, 'player-one', item.instanceId, [
      'pay-1',
      'pay-2',
    ])

    expect(next.players['player-one'].hand).toHaveLength(0)
    expect(next.players['player-one'].discardPile).toContain(item)
    expect(
      next.players['player-one'].supportArea.slice(0, 2)
        .every((card) => card.rested),
    ).toBe(true)
  })

  it('enforces a Cookie-only support return cost for items', () => {
    const item: GameCard = {
      id: 'time-rend-scissors',
      instanceId: 'time-rend-scissors-1',
      name: 'Time Rend Scissors',
      type: 'item',
      item: {
        cost: {
          energy: { red: 1 },
          supportToHand: 1,
          supportToHandType: 'cookie',
        },
        text: 'item',
        effects: [{ kind: 'draw', amount: 1 }],
      },
    }
    const returnedCookie: GameCard = {
      id: 'return-cookie',
      instanceId: 'return-cookie',
      name: 'return-cookie',
      type: 'cookie',
      level: 1,
      hp: 1,
      attack: 1,
      attackCost: 1,
      energyColor: 'red',
    }
    const state = readyState()
    state.players['player-one'].hand = [item]
    state.players['player-one'].supportArea = [
      { card: support('pay-1'), rested: false },
      { card: support('pay-2'), rested: false },
      { card: returnedCookie, rested: false },
    ]

    expect(() =>
      playItem(state, 'player-one', item.instanceId, ['pay-1'], [], ['pay-2']),
    ).toThrow('支援區回手費用必須選擇 cookie')

    const next = playItem(
      state,
      'player-one',
      item.instanceId,
      ['pay-1'],
      [],
      [returnedCookie.instanceId],
    )
    expect(next.players['player-one'].hand).toContainEqual(returnedCookie)
    expect(next.players['player-one'].supportArea).toHaveLength(2)
    expect(
      next.players['player-one'].supportArea.map((entry) => entry.card.instanceId),
    ).toEqual(['pay-1', 'pay-2'])
  })

  it('does not expose a Cookie-return item when no Cookie can pay its extra cost', () => {
    const item: GameCard = {
      id: 'time-rend-scissors',
      instanceId: 'time-rend-scissors-2',
      name: 'Time Rend Scissors',
      type: 'item',
      item: {
        cost: {
          energy: { red: 1 },
          supportToHand: 1,
          supportToHandType: 'cookie',
        },
        text: 'item',
        effects: [{ kind: 'draw', amount: 1 }],
      },
    }
    const state = readyState()
    state.players['player-one'].hand = [item]

    expect(canPlayItem(state, 'player-one', item.instanceId)).toBe(false)
  })

  it('requires and pays a trashBattleCookie item cost (BS2-077 regression)', () => {
    const item: GameCard = {
      id: 'item',
      instanceId: 'item-1',
      name: 'Item',
      type: 'item',
      item: {
        cost: {
          energy: { red: 1 },
          trashBattleCookie: { count: 1, level: 1, energyColor: 'purple' },
        },
        text: 'item',
        effects: [{ kind: 'damage', amount: 2, target: { side: 'opponent', min: 0, max: 1 } }],
      },
    }
    const state = readyState()
    state.players['player-one'].hand = [item]
    state.players['player-one'].battleArea = [
      {
        card: {
          id: 'cookie',
          instanceId: 'cookie-1',
          name: 'Cookie',
          type: 'cookie',
          level: 1,
          energyColor: 'purple',
          hp: 1,
          attack: 1,
          attackCost: 1,
        },
        hpCards: [
          {
            id: 'hp',
            instanceId: 'hp-1',
            name: 'HP',
            type: 'cookie',
            level: 1,
            hp: 1,
            attack: 1,
            attackCost: 1,
          },
        ],
        rested: false,
      },
    ]

    expect(() =>
      playItem(state, 'player-one', item.instanceId, ['pay-1']),
    ).toThrow('必須選擇 1 張戰鬥區餅乾作為代價。')

    const next = playItem(state, 'player-one', item.instanceId, ['pay-1'], [], [], [], [], [
      'cookie-1',
    ])
    expect(next.players['player-one'].battleArea).toHaveLength(0)
    expect(
      next.players['player-one'].discardPile.map((card) => card.instanceId),
    ).toEqual(expect.arrayContaining(['cookie-1', 'hp-1']))
  })

  it('uses P-084 neutral activation cost after a friendly Cookie faints this turn', () => {
    const item: GameCard = {
      id: 'P-084',
      instanceId: 'p-084-test',
      name: 'Magic Lettering Pens',
      type: 'item',
      item: {
        cost: { green: 1 },
        activationCostOverride: {
          condition: 'friendly-cookie-fainted-this-turn',
          cost: { energy: { neutral: 1 } },
        },
        text: 'P-084',
        effects: [{ kind: 'draw', amount: 1 }],
      },
    }
    const state = readyState()
    state.players['player-one'].hand = [item]
    state.cookiesFaintedThisTurn = { 'player-one': 1, 'player-two': 0 }

    expect(canPlayItem(state, 'player-one', item.instanceId)).toBe(true)

    const next = playItem(state, 'player-one', item.instanceId, ['pay-1'])
    expect(next.players['player-one'].supportArea[0].rested).toBe(true)
    expect(next.players['player-one'].discardPile).toContainEqual(item)
  })

  it('does not apply P-084 neutral activation cost before a friendly Cookie faints', () => {
    const item: GameCard = {
      id: 'P-084',
      instanceId: 'p-084-test-unmet',
      name: 'Magic Lettering Pens',
      type: 'item',
      item: {
        cost: { green: 1 },
        activationCostOverride: {
          condition: 'friendly-cookie-fainted-this-turn',
          cost: { energy: { neutral: 1 } },
        },
        text: 'P-084',
        effects: [{ kind: 'draw', amount: 1 }],
      },
    }
    const state = readyState()
    state.players['player-one'].hand = [item]

    expect(canPlayItem(state, 'player-one', item.instanceId)).toBe(false)
  })

  it('allows BS6-084 to pay one-or-more hand cards before checking its hand limit', () => {
    const item: GameCard = {
      id: 'BS6-084',
      instanceId: 'bs6-084-test',
      name: 'Time Manipulator',
      type: 'item',
      item: {
        cost: {
          energy: { blue: 1 },
          discardHand: 1,
          discardHandAtLeast: true,
        },
        text: '<{B}> <Discard 1 card or more.> If there are 5 cards or less in your hand, select up to 1 of your opponent\'s Cookies. That Cookie receives 1 damage.',
        effects: [
          {
            kind: 'damage',
            amount: 1,
            target: { side: 'opponent', min: 0, max: 1 },
            condition: { kind: 'hand-count-at-most', count: 5 },
          },
        ],
      },
    }
    const fillerCards = Array.from({ length: 7 }, (_, index) => ({
      id: `bs6-084-filler-${index}`,
      instanceId: `bs6-084-filler-${index}`,
      name: `BS6-084 filler ${index}`,
      type: 'item' as const,
    }))
    const state = readyState()
    const initialTarget = state.players['player-two'].battleArea[0]
    state.players['player-two'].battleArea = [
      {
        ...initialTarget,
        hpCards: [
          ...initialTarget.hpCards,
          support('bs6-084-target-hp'),
        ],
      },
    ]
    const target = state.players['player-two'].battleArea[0]
    const blueSupport = { ...support('blue-pay'), energyColor: 'blue' as const }
    state.players['player-one'].supportArea = [
      { card: blueSupport, rested: false },
    ]
    state.players['player-one'].hand = [item, ...fillerCards]

    // The item itself is still legal to use while the pre-payment hand has 8 cards.
    expect(canPlayItem(state, 'player-one', item.instanceId)).toBe(true)

    const oneDiscard = applyGameCommand(state, {
      kind: 'begin-play-item',
      playerId: 'player-one',
      instanceId: item.instanceId,
      paymentIds: ['blue-pay'],
      discardHandIds: [fillerCards[0].instanceId],
      targetIds: [],
    })
    expect(oneDiscard.players['player-one'].hand).toHaveLength(6)
    expect(oneDiscard.pendingAbilityEffect).toBeUndefined()
    expect(
      oneDiscard.players['player-two'].battleArea[0].hpCards,
    ).toHaveLength(target.hpCards.length)

    const twoDiscards = playItem(
      state,
      'player-one',
      item.instanceId,
      ['blue-pay'],
      [],
      [],
      fillerCards.slice(0, 2).map((card) => card.instanceId),
    )
    expect(twoDiscards.players['player-one'].hand).toHaveLength(5)
    const resolved = executeCardEffect(
      twoDiscards,
      { sourcePlayerId: 'player-one', sourceInstanceId: item.instanceId },
      item.item!.effects[0],
      [target.card.instanceId],
    )
    expect(
      resolved.players['player-two'].battleArea[0].hpCards,
    ).toHaveLength(target.hpCards.length - 1)
  })

  it('replaces an existing stage and activates the new stage once', () => {
    const oldStage: GameCard = {
      id: 'old-stage',
      instanceId: 'old-stage-1',
      name: 'Old Stage',
      type: 'stage',
    }
    const stage: GameCard = {
      id: 'stage',
      instanceId: 'stage-1',
      name: 'Stage',
      type: 'stage',
      stageAbility: {
        placementCost: { red: 1 },
        cost: { red: 1 },
        text: 'stage',
        restSource: true,
        effects: [
          {
            kind: 'modify-attack',
            amount: 1,
            duration: 'this-turn',
            target: { side: 'self', min: 1, max: 1 },
          },
        ],
      },
    }
    const state = readyState()
    state.players['player-one'].hand = [stage]
    state.players['player-one'].stage = {
      card: oldStage,
      rested: false,
    }

    const placed = playStage(state, 'player-one', stage.instanceId, ['pay-1'])
    expect(placed.players['player-one'].stage?.card).toBe(stage)
    expect(placed.players['player-one'].discardPile).toContain(oldStage)

    const activated = activateStage(placed, 'player-one', ['pay-2'])
    expect(activated.players['player-one'].stage?.rested).toBe(true)
  })

  it('rejects item usage when not in main phase', () => {
    const item: GameCard = {
      id: 'item',
      instanceId: 'item-1',
      name: 'Item',
      type: 'item',
      item: {
        cost: { red: 1 },
        text: 'item',
        effects: [{ kind: 'draw', amount: 1 }],
      },
    }
    const state = readyState()
    state.phase = 'support'
    state.players['player-one'].hand = [item]

    expect(canPlayItem(state, 'player-one', item.instanceId)).toBe(false)
    expect(() =>
      playItem(state, 'player-one', item.instanceId, ['pay-1']),
    ).toThrow('目前無法使用物品或場景卡。')
  })

  it('rejects item usage when payment is insufficient', () => {
    const item: GameCard = {
      id: 'item',
      instanceId: 'item-1',
      name: 'Item',
      type: 'item',
      item: {
        cost: { red: 3 },
        text: 'item',
        effects: [{ kind: 'draw', amount: 1 }],
      },
    }
    const state = readyState()
    state.players['player-one'].hand = [item]

    expect(() =>
      playItem(state, 'player-one', item.instanceId, ['pay-1']),
    ).toThrow('能量付款不合法')
  })

  it('rejects stage activation when stage is already rested', () => {
    const stage: GameCard = {
      id: 'stage',
      instanceId: 'stage-1',
      name: 'Stage',
      type: 'stage',
      stageAbility: {
        placementCost: { red: 1 },
        cost: { red: 1 },
        text: 'stage',
        restSource: true,
        effects: [
          {
            kind: 'modify-attack',
            amount: 1,
            duration: 'this-turn',
            target: { side: 'self', min: 1, max: 1 },
          },
        ],
      },
    }
    const state = readyState()
    state.players['player-one'].stage = { card: stage, rested: true }

    expect(canActivateStage(state, 'player-one')).toBe(false)
    expect(() =>
      activateStage(state, 'player-one', ['pay-1']),
    ).toThrow('目前無法啟動場景卡。')
  })

  it('rejects stage activation when payment is insufficient', () => {
    const stage: GameCard = {
      id: 'stage',
      instanceId: 'stage-1',
      name: 'Stage',
      type: 'stage',
      stageAbility: {
        placementCost: { red: 1 },
        cost: { red: 3 },
        text: 'stage',
        restSource: true,
        effects: [
          {
            kind: 'modify-attack',
            amount: 1,
            duration: 'this-turn',
            target: { side: 'self', min: 1, max: 1 },
          },
        ],
      },
    }
    const state = readyState()
    state.players['player-one'].stage = { card: stage, rested: false }

    expect(() =>
      activateStage(state, 'player-one', ['pay-1']),
    ).toThrow('能量付款不合法')
  })

  it('does not offer stage activation when its energy cost cannot be paid', () => {
    const stage: GameCard = {
      id: 'stage',
      instanceId: 'stage-1',
      name: 'Stage',
      type: 'stage',
      stageAbility: {
        placementCost: { red: 1 },
        cost: { red: 4 },
        text: 'stage',
        restSource: true,
        effects: [{ kind: 'draw', amount: 1 }],
      },
    }
    const state = readyState()
    state.players['player-one'].stage = { card: stage, rested: false }

    expect(canActivateStage(state, 'player-one')).toBe(false)
  })

  it('does not offer stage activation when a required target is unavailable', () => {
    const stage: GameCard = {
      id: 'stage',
      instanceId: 'stage-1',
      name: 'Stage',
      type: 'stage',
      stageAbility: {
        placementCost: { red: 1 },
        cost: { red: 1 },
        text: 'stage',
        restSource: true,
        effects: [
          {
            kind: 'modify-attack',
            amount: 1,
            duration: 'this-turn',
            target: { side: 'opponent', min: 1, max: 1, minLevel: 99 },
          },
        ],
      },
    }
    const state = readyState()
    state.players['player-one'].stage = { card: stage, rested: false }

    expect(canActivateStage(state, 'player-one')).toBe(false)
  })

  it('offers a stage whose follow-up targets the Cookie selected for its HP cost', () => {
    const stage: GameCard = {
      id: 'stage-cost-selected',
      instanceId: 'stage-cost-selected-1',
      name: 'Stage Cost Selected',
      type: 'stage',
      stageAbility: {
        placementCost: { red: 1 },
        cost: { energy: { red: 1 }, hpToTrash: { minLevel: 2 } },
        text: 'stage',
        restSource: true,
        effects: [
          {
            kind: 'modify-attack',
            amount: 1,
            duration: 'this-turn',
            target: { side: 'self', min: 1, max: 1, costSelected: true },
          },
        ],
      },
    }
    const state = readyState()
    const target = state.players['player-one'].battleArea[0]
    state.players['player-one'].battleArea = [
      {
        ...target,
        card: { ...target.card, level: 2 },
        hpCards: [support('stage-hp-1')],
      },
    ]
    state.players['player-one'].stage = { card: stage, rested: false }

    expect(canActivateStage(state, 'player-one')).toBe(true)
  })

  it('executes item effect with modify-attack targeting own cookie', () => {
    const item: GameCard = {
      id: 'item',
      instanceId: 'item-1',
      name: 'Item',
      type: 'item',
      item: {
        cost: { red: 2 },
        text: 'item',
        effects: [
          {
            kind: 'modify-attack',
            amount: 2,
            duration: 'this-turn',
            target: { side: 'self', min: 1, max: 1 },
          },
        ],
      },
    }
    const state = readyState()
    state.players['player-one'].hand = [item]
    const targetCookie = state.players['player-one'].battleArea[0]

    expect(canPlayItem(state, 'player-one', item.instanceId)).toBe(true)

    const paid = playItem(state, 'player-one', item.instanceId, [
      'pay-1',
      'pay-2',
    ])
    expect(paid.players['player-one'].discardPile).toContain(item)

    const next = executeCardEffect(
      paid,
      {
        sourcePlayerId: 'player-one',
        sourceInstanceId: item.instanceId,
      },
      item.item!.effects[0],
      [targetCookie.card.instanceId],
    )
    expect(next.attackModifiers).toHaveLength(1)
    expect(next.attackModifiers[0].targetInstanceId).toBe(
      targetCookie.card.instanceId,
    )
    expect(next.attackModifiers[0].amount).toBe(2)
  })

  it('executes stage effect and rests the stage card', () => {
    const stage: GameCard = {
      id: 'stage',
      instanceId: 'stage-1',
      name: 'Stage',
      type: 'stage',
      stageAbility: {
        placementCost: { red: 1 },
        cost: { red: 2 },
        text: 'stage',
        restSource: true,
        effects: [
          {
            kind: 'modify-attack',
            amount: 3,
            duration: 'this-turn',
            target: { side: 'self', min: 1, max: 1 },
          },
        ],
      },
    }
    const state = readyState()
    state.players['player-one'].stage = { card: stage, rested: false }
    const targetCookie = state.players['player-one'].battleArea[0]

    const activated = activateStage(state, 'player-one', [
      'pay-1',
      'pay-2',
    ])
    expect(activated.players['player-one'].stage?.rested).toBe(true)

    const next = executeCardEffect(
      activated,
      {
        sourcePlayerId: 'player-one',
        sourceInstanceId: stage.instanceId,
      },
      stage.stageAbility!.effects[0],
      [targetCookie.card.instanceId],
    )
    expect(next.attackModifiers).toHaveLength(1)
    expect(next.attackModifiers[0].amount).toBe(3)
  })

  it('rejects item usage when no valid targets exist for its effects', () => {
    const item: GameCard = {
      id: 'item',
      instanceId: 'item-1',
      name: 'Item',
      type: 'item',
      item: {
        cost: { red: 1 },
        text: 'item',
        effects: [
          {
            kind: 'modify-attack',
            amount: 1,
            duration: 'this-turn',
            target: { side: 'self', min: 1, max: 1 },
          },
        ],
      },
    }
    const state = readyState()
    state.players['player-one'].hand = [item]
    state.players['player-one'].battleArea = []

    expect(canPlayItem(state, 'player-one', item.instanceId)).toBe(false)
  })
})

describe('item and stage effects', () => {
  it('moves a battle Cookie and its HP cards to the correct zones', () => {
    const state = readyState()
    const cookie = state.players['player-one'].battleArea[0]
    const hpCards = [...cookie.hpCards]
    const next = executeCardEffect(
      state,
      {
        sourcePlayerId: 'player-one',
        sourceInstanceId: 'ST3-016',
      },
      {
        kind: 'battle-to-support',
        target: {
          side: 'self',
          min: 1,
          max: 1,
          maxLevel: cookie.card.level,
        },
      },
      [cookie.card.instanceId],
    )

    expect(next.players['player-one'].battleArea).not.toContain(cookie)
    expect(
      next.players['player-one'].supportArea.at(-1)?.card,
    ).toBe(cookie.card)
    expect(next.players['player-one'].discardPile).toEqual(
      expect.arrayContaining(hpCards),
    )
    expect(
      finalizePendingReplacements(next).pendingReplacement,
    ).not.toBeNull()
  })

  it('plays a Cookie from trash with HP and an OnPlay window', () => {
    const state = readyState()
    const cookie = state.players['player-one'].battleArea[0].card
    const onPlayCookie = {
      ...cookie,
      instanceId: 'trash-cookie',
      skill: {
        trigger: 'on-play' as const,
        oncePerTurn: false,
        yourTurn: false,
        restSource: false,
        cost: { energy: {}, discardHand: 0 },
        text: 'OnPlay',
        effects: [{ kind: 'draw' as const, amount: 1 }],
      },
    }
    state.players['player-one'].battleArea = []
    state.players['player-one'].discardPile = [onPlayCookie]

    const next = executeCardEffect(
      state,
      {
        sourcePlayerId: 'player-one',
        sourceInstanceId: 'ST3-018',
      },
      { kind: 'trash-to-battle', amount: 1 },
      [onPlayCookie.instanceId],
    )

    expect(next.players['player-one'].battleArea[0].card).toBe(onPlayCookie)
    expect(next.players['player-one'].battleArea[0].hpCards).toHaveLength(
      onPlayCookie.hp,
    )
    expect(next.pendingOnPlay).toMatchObject({
      sourceInstanceId: onPlayCookie.instanceId,
    })
  })

  it('records FLIP prevention and returns support to hand', () => {
    let state = readyState()
    const opponent = state.players['player-two'].battleArea[0]
    state = executeCardEffect(
      state,
      {
        sourcePlayerId: 'player-one',
        sourceInstanceId: 'ST2-016',
      },
      {
        kind: 'disable-flip',
        duration: 'this-turn',
        target: { side: 'opponent', min: 1, max: 1 },
      },
      [opponent.card.instanceId],
    )
    expect(
      state.flipDisabledUntilTurn?.[opponent.card.instanceId],
    ).toBe(state.turnNumber)

    const returned = state.players['player-one'].supportArea[0].card
    state = executeCardEffect(
      state,
      {
        sourcePlayerId: 'player-one',
        sourceInstanceId: 'ST3-022',
      },
      { kind: 'support-to-hand', amount: 1 },
      [returned.instanceId],
    )
    expect(state.players['player-one'].hand).toContain(returned)
  })
})
