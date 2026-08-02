import { describe, expect, it } from 'vitest'
import {
  advancePhase,
  attackCookie,
  createDemoGame,
  executeCardEffect,
  getAttackDamageAgainst,
  getEffectiveAttack,
  getEffectiveAttackBreakdown,
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
  energyColor: 'red',
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
    const firstTarget = {
      ...state.players['player-two'].battleArea[0],
      hpCards: [
        ...state.players['player-two'].battleArea[0].hpCards,
        createSupport('first-target-extra-hp'),
      ],
    }
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

  it('names the source of each active attack modifier for the UI tooltip', () => {
    let state = createDemoGame()
    const ownCookie = state.players['player-one'].battleArea[0]
    const opponent = state.players['player-two'].battleArea[0]

    // context.sourceInstanceId 用真的在場上的卡（跟 effects-core.test.ts
    // 其他測試共用的 fake 'player-one-starter-1' 不同，那個不對應任何實際
    // 卡片），才能驗證「找得到來源」這條路徑，而不是一律 fallback 成
    // 「未知效果」。
    state = executeCardEffect(
      state,
      { ...context, sourceInstanceId: ownCookie.card.instanceId },
      {
        kind: 'modify-attack',
        amount: -5,
        duration: 'this-turn',
        target: { side: 'opponent', min: 1, max: 1 },
      },
      [opponent.card.instanceId],
    )

    const untouched = getEffectiveAttackBreakdown(
      state,
      ownCookie.card.instanceId,
    )
    expect(untouched).toEqual({
      base: ownCookie.card.attack,
      effective: ownCookie.card.attack,
      entries: [],
    })

    const modified = getEffectiveAttackBreakdown(
      state,
      opponent.card.instanceId,
    )
    expect(modified.base).toBe(opponent.card.attack)
    expect(modified.effective).toBe(0)
    expect(modified.entries).toEqual([
      { sourceCardName: ownCookie.card.name, amount: -5 },
    ])
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

  it('sets attack damage meeting a threshold to the specified amount', () => {
    let state = createDemoGame()
    const attacker = state.players['player-two'].battleArea[0]
    const target = state.players['player-one'].battleArea[0]

    state = {
      ...state,
      attackModifiers: [
        {
          sourceInstanceId: context.sourceInstanceId,
          targetInstanceId: attacker.card.instanceId,
          amount: 3,
          expiresAfterTurn: null,
        },
      ],
    }
    state = executeCardEffect(
      state,
      context,
      {
        kind: 'modify-damage-received',
        amount: 0,
        duration: 'opponent-next-turn',
        target: { side: 'self', min: 1, max: 1 },
        minimumDamage: 2,
        setDamageTo: 1,
      },
      [target.card.instanceId],
    )

    expect(
      getAttackDamageAgainst(
        state,
        attacker.card.instanceId,
        target.card.instanceId,
      ),
    ).toBe(1)
  })

  it('enforces break-level activation conditions', () => {
    let state = createDemoGame()
    const target = {
      ...state.players['player-two'].battleArea[0],
      hpCards: [
        ...state.players['player-two'].battleArea[0].hpCards,
        createSupport('condition-extra-hp'),
      ],
    }
    state = {
      ...state,
      players: {
        ...state.players,
        'player-two': {
          ...state.players['player-two'],
          battleArea: [target],
        },
      },
    }
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

  it('checks keyword conditions against cards in the source support area', () => {
    let state = createDemoGame()
    const effect: CardEffect = {
      kind: 'damage',
      amount: 1,
      condition: {
        kind: 'support-keyword-at-least',
        keyword: 'soul-jam',
        count: 1,
      },
      target: { side: 'opponent', min: 0, max: 1 },
    }

    expect(isEffectConditionMet(state, context, effect)).toBe(false)

    state = {
      ...state,
      players: {
        ...state.players,
        'player-one': {
          ...state.players['player-one'],
          supportArea: [
            ...state.players['player-one'].supportArea,
            {
              card: {
                ...createSupport('soul-jam-support'),
                keywords: ['soul-jam'],
              },
              rested: false,
            },
          ],
        },
      },
    }

    expect(isEffectConditionMet(state, context, effect)).toBe(true)
  })

  it('checks battle-area level conditions for either player', () => {
    let state = createDemoGame()
    const effect: CardEffect = {
      kind: 'damage',
      amount: 1,
      condition: {
        kind: 'battle-area-has-cookie-with-level',
        side: 'self',
        level: 3,
      },
      target: { side: 'opponent', min: 0, max: 1 },
    }

    expect(isEffectConditionMet(state, context, effect)).toBe(false)

    state = {
      ...state,
      players: {
        ...state.players,
        'player-one': {
          ...state.players['player-one'],
          battleArea: state.players['player-one'].battleArea.map((cookie) => ({
            ...cookie,
            card: { ...cookie.card, level: 3 },
          })),
        },
      },
    }

    expect(isEffectConditionMet(state, context, effect)).toBe(true)
    expect(
      isEffectConditionMet(state, context, {
        ...effect,
        condition: {
          kind: 'battle-area-has-cookie-with-level',
          side: 'opponent',
          level: 3,
        },
      }),
    ).toBe(false)
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

  /**
   * 回歸測試（BS3-006）：`modify-all-attack` 掛在 `trigger: 'passive'` 技能上
   * 是「只要來源還在戰鬥區」的條件式光環，不會被 executeAbilityEffects 執行、
   * 寫進 attackModifiers——被動技能從未走過那條指令派送路徑。getEffectiveAttack
   * 必須額外掃描雙方戰鬥區的被動技能來源即時套用，而不是只看
   * attackModifiers 與目標自己的被動技能。
   */
  it('applies a passive modify-all-attack aura from another battle-area cookie', () => {
    let state = createDemoGame()
    const auraSource: GameCard = {
      ...state.players['player-one'].battleArea[0].card,
      id: 'aura-source',
      instanceId: 'aura-source-1',
      level: 1,
      energyColor: 'red',
      skill: {
        trigger: 'passive',
        oncePerTurn: false,
        yourTurn: false,
        restSource: false,
        cost: { energy: {}, discardHand: 0 },
        text: 'aura',
        effects: [
          {
            kind: 'modify-all-attack',
            amount: 1,
            duration: 'persistent',
            side: 'self',
            energyColor: 'red',
            minLevel: 2,
          },
        ],
      },
    }
    const buffedAlly: GameCard = {
      ...state.players['player-one'].battleArea[0].card,
      id: 'buffed-ally',
      instanceId: 'buffed-ally-1',
      level: 2,
      energyColor: 'red',
      attack: 3,
    }
    const tooLowLevelAlly: GameCard = {
      ...buffedAlly,
      id: 'low-level-ally',
      instanceId: 'low-level-ally-1',
      level: 1,
    }
    const wrongColorAlly: GameCard = {
      ...buffedAlly,
      id: 'wrong-color-ally',
      instanceId: 'wrong-color-ally-1',
      energyColor: 'blue',
    }

    state = {
      ...state,
      players: {
        ...state.players,
        'player-one': {
          ...state.players['player-one'],
          battleArea: [
            { card: auraSource, hpCards: [], rested: false, battleEntryId: 'aura-source-1:battle:1' },
            { card: buffedAlly, hpCards: [], rested: false, battleEntryId: 'buffed-ally-1:battle:2' },
            { card: tooLowLevelAlly, hpCards: [], rested: false, battleEntryId: 'low-level-ally-1:battle:3' },
            { card: wrongColorAlly, hpCards: [], rested: false, battleEntryId: 'wrong-color-ally-1:battle:4' },
          ],
        },
      },
    }

    expect(getEffectiveAttack(state, 'buffed-ally-1')).toBe(4)
    expect(getEffectiveAttack(state, 'low-level-ally-1')).toBe(3)
    expect(getEffectiveAttack(state, 'wrong-color-ally-1')).toBe(3)
    expect(getEffectiveAttack(state, 'aura-source-1')).toBe(auraSource.attack)

    const withoutAuraSource: GameState = {
      ...state,
      players: {
        ...state.players,
        'player-one': {
          ...state.players['player-one'],
          battleArea: state.players['player-one'].battleArea.filter(
            (cookie) => cookie.card.instanceId !== 'aura-source-1',
          ),
        },
      },
    }
    expect(getEffectiveAttack(withoutAuraSource, 'buffed-ally-1')).toBe(3)
  })
})
