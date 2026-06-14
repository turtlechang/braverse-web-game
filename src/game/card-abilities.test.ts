import { describe, expect, it } from 'vitest'
import {
  activateStage,
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
        cost: {},
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
