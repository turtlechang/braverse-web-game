import { describe, expect, it } from 'vitest'
import {
  advancePhase,
  attackCookie,
  createDemoGame,
  executeCardEffect,
  getAttackDamageAgainst,
  getEffectiveAttack,
  isEffectConditionMet,
  selectEffectTargets,
  type CardEffect,
  type GameCard,
  type GameState,
} from '.'

const context = {
  sourcePlayerId: 'player-one' as const,
  sourceInstanceId: 'player-one-starter-1',
}

const createSupport = (instanceId: string): GameCard => ({
  id: instanceId,
  instanceId,
  name: 'Effect payment',
  type: 'item',
})

const reachEndOfTurn = (state: GameState): GameState => {
  let current = state

  while (current.phase !== 'end') {
    current = advancePhase(current)
  }

  return current
}

describe('card effect engine', () => {
  it('validates target side, count, and remaining HP filters', () => {
    const state = createDemoGame()
    const opponent = state.players['player-two'].battleArea[0]
    const selector = {
      side: 'opponent' as const,
      min: 1,
      max: 1,
      remainingHp: opponent.hpCards.length,
    }

    expect(
      selectEffectTargets(state, context, selector, [
        opponent.card.instanceId,
      ]),
    ).toEqual([opponent])
    expect(() =>
      selectEffectTargets(state, context, selector, [
        state.players['player-one'].battleArea[0].card.instanceId,
      ]),
    ).toThrow('不是此效果的合法目標')
    expect(() =>
      selectEffectTargets(state, context, selector, []),
    ).toThrow('目標數量不合法')
  })

  it('deals direct damage to each selected target', () => {
    let state = createDemoGame()
    const firstTarget = state.players['player-two'].battleArea[0]
    const secondTarget = {
      ...firstTarget,
      card: {
        ...firstTarget.card,
        instanceId: 'player-two-second-cookie',
      },
      hpCards: [...firstTarget.hpCards],
    }
    state = {
      ...state,
      players: {
        ...state.players,
        'player-two': {
          ...state.players['player-two'],
          battleArea: [firstTarget, secondTarget],
        },
      },
    }
    const effect: CardEffect = {
      kind: 'damage',
      amount: 1,
      target: {
        side: 'opponent',
        min: 0,
        max: 2,
      },
    }

    state = executeCardEffect(state, context, effect, [
      firstTarget.card.instanceId,
      secondTarget.card.instanceId,
    ])

    expect(
      state.players['player-two'].battleArea.map(
        (cookie) => cookie.hpCards.length,
      ),
    ).toEqual([
      firstTarget.hpCards.length - 1,
      secondTarget.hpCards.length - 1,
    ])
  })

  it('applies positive and negative attack modifiers with a zero floor', () => {
    let state = createDemoGame()
    const ownCookie = state.players['player-one'].battleArea[0]
    const opponent = state.players['player-two'].battleArea[0]

    state = executeCardEffect(
      state,
      context,
      {
        kind: 'modify-attack',
        amount: 2,
        duration: 'this-turn',
        target: { side: 'self', min: 1, max: 1 },
      },
      [ownCookie.card.instanceId],
    )
    state = executeCardEffect(
      state,
      context,
      {
        kind: 'modify-attack',
        amount: -5,
        duration: 'this-turn',
        target: { side: 'opponent', min: 1, max: 1 },
      },
      [opponent.card.instanceId],
    )

    expect(getEffectiveAttack(state, ownCookie.card.instanceId)).toBe(
      ownCookie.card.attack + 2,
    )
    expect(getEffectiveAttack(state, opponent.card.instanceId)).toBe(0)
  })

  it('expires this-turn modifiers when the turn ends', () => {
    let state = createDemoGame()
    const ownCookie = state.players['player-one'].battleArea[0]

    state = executeCardEffect(
      state,
      context,
      {
        kind: 'modify-attack',
        amount: 1,
        duration: 'this-turn',
        target: { side: 'self', min: 1, max: 1 },
      },
      [ownCookie.card.instanceId],
    )
    state = advancePhase(reachEndOfTurn(state))

    expect(state.attackModifiers).toHaveLength(0)
    expect(getEffectiveAttack(state, ownCookie.card.instanceId)).toBe(
      ownCookie.card.attack,
    )
  })

  it('reduces attack damage received without changing attack power', () => {
    let state = createDemoGame()
    const attacker = state.players['player-two'].battleArea[0]
    const target = state.players['player-one'].battleArea[0]

    state = executeCardEffect(
      state,
      context,
      {
        kind: 'modify-damage-received',
        amount: -1,
        duration: 'opponent-next-turn',
        target: { side: 'self', min: 1, max: 1 },
      },
      [target.card.instanceId],
    )

    expect(getEffectiveAttack(state, target.card.instanceId)).toBe(
      target.card.attack,
    )
    expect(
      getAttackDamageAgainst(
        state,
        attacker.card.instanceId,
        target.card.instanceId,
      ),
    ).toBe(Math.max(0, attacker.card.attack - 1))
  })

  it('enforces break-level activation conditions', () => {
    let state = createDemoGame()
    const target = state.players['player-two'].battleArea[0]
    const effect: CardEffect = {
      kind: 'damage',
      amount: 1,
      condition: {
        kind: 'break-level-at-least',
        level: 6,
      },
      target: { side: 'opponent', min: 0, max: 1 },
    }

    expect(() =>
      executeCardEffect(state, context, effect, [
        target.card.instanceId,
      ]),
    ).toThrow('尚未滿足')
    expect(isEffectConditionMet(state, context, effect)).toBe(false)

    state = {
      ...state,
      players: {
        ...state.players,
        'player-one': {
          ...state.players['player-one'],
          breakArea: [
            { ...state.players['player-one'].battleArea[0].card, level: 6 },
          ],
        },
      },
    }

    expect(
      executeCardEffect(state, context, effect, [
        target.card.instanceId,
      ]).players['player-two'].battleArea[0].hpCards,
    ).toHaveLength(target.hpCards.length - 1)
    expect(isEffectConditionMet(state, context, effect)).toBe(true)
  })

  it('attaches supported official effects to demo cards', () => {
    const state = createDemoGame()
    const cards = Object.values(state.players).flatMap((player) => [
      ...player.deck,
      ...player.hand,
      ...player.battleArea.map((cookie) => cookie.card),
    ])
    const ninja = cards.find((card) => card.id === 'ST1-002')
    const jelly = cards.find((card) => card.id === 'ST1-016')

    expect(ninja?.effects?.[0]).toMatchObject({
      kind: 'damage',
      amount: 1,
    })
    expect(jelly?.effectText).toContain("opponent's Cookies")
  })

  it('uses modified attack damage for a basic attack', () => {
    let state = createDemoGame()
    const attacker = state.players['player-one'].battleArea[0]
    const target = state.players['player-two'].battleArea[0]
    const extendedTarget = {
      ...target,
      hpCards: [
        ...target.hpCards,
        createSupport('extra-hp-1'),
        createSupport('extra-hp-2'),
      ],
    }
    const payments = Array.from(
      { length: attacker.card.attackCost },
      (_, index) => createSupport(`effect-payment-${index + 1}`),
    )
    state = {
      ...state,
      turnNumber: 2,
      phase: 'main',
      players: {
        ...state.players,
        'player-one': {
          ...state.players['player-one'],
          supportArea: payments.map((card) => ({
            card,
            rested: false,
          })),
        },
        'player-two': {
          ...state.players['player-two'],
          battleArea: [extendedTarget],
        },
      },
    }
    state = executeCardEffect(
      state,
      context,
      {
        kind: 'modify-attack',
        amount: 1,
        duration: 'this-turn',
        target: { side: 'self', min: 1, max: 1 },
      },
      [attacker.card.instanceId],
    )
    state = attackCookie(
      state,
      attacker.card.instanceId,
      target.card.instanceId,
      payments.map((card) => card.instanceId),
    )

    expect(
      state.players['player-two'].battleArea[0].hpCards,
    ).toHaveLength(
      extendedTarget.hpCards.length - attacker.card.attack - 1,
    )
  })
})
