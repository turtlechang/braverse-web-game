import { describe, expect, it } from 'vitest'
import {
  advancePhase,
  attackCookie,
  createDemoGame,
  executeCardEffect,
  getAttackDamageAgainst,
  getEffectiveAttack,
  getEffectiveAttackBreakdown,
  getEffectTargetCandidatesForEffect,
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

  it('BS6-010 blocks only the opponent from moving Cookies out of either battle area', () => {
    const base = createDemoGame()
    const timekeeper = {
      ...base.players['player-one'].battleArea[0],
      card: {
        ...base.players['player-one'].battleArea[0].card,
        id: 'BS6-010',
        skill: {
          trigger: 'passive' as const,
          oncePerTurn: false,
          yourTurn: false,
          restSource: false,
          cost: {},
          text: '',
          effects: [{ kind: 'prevent-opponent-battle-movement' as const }],
        },
      },
    }
    const ally = {
      ...base.players['player-one'].battleArea[0],
      card: {
        ...base.players['player-one'].battleArea[0].card,
        instanceId: 'timekeeper-ally',
      },
    }
    const protectedState: GameState = {
      ...base,
      players: {
        ...base.players,
        'player-one': {
          ...base.players['player-one'],
          battleArea: [timekeeper, ally],
          stage: {
            card: {
              ...base.players['player-one'].battleArea[0].card,
              id: 'test-stage',
              instanceId: 'timekeeper-stage',
              type: 'stage',
            },
            rested: false,
          },
        },
      },
    }
    const opponentContext = {
      sourcePlayerId: 'player-two' as const,
      sourceInstanceId: base.players['player-two'].battleArea[0].card.instanceId,
    }
    const returnOpponentCookie: CardEffect = {
      kind: 'return-to-hand',
      target: { side: 'opponent', min: 1, max: 1 },
    }

    expect(
      getEffectTargetCandidatesForEffect(
        protectedState,
        opponentContext,
        returnOpponentCookie,
      ),
    ).toEqual([])
    const blocked = executeCardEffect(
      protectedState,
      opponentContext,
      returnOpponentCookie,
      [timekeeper.card.instanceId],
    )
    expect(blocked.players['player-one'].battleArea).toHaveLength(2)
    expect(blocked.players['player-one'].hand).toHaveLength(
      protectedState.players['player-one'].hand.length,
    )

    const damaged = executeCardEffect(
      protectedState,
      opponentContext,
      {
        kind: 'damage',
        amount: 1,
        target: { side: 'opponent', min: 1, max: 1 },
      },
      [timekeeper.card.instanceId],
    )
    expect(damaged.players['player-one'].battleArea[0].hpCards).toHaveLength(
      timekeeper.hpCards.length - 1,
    )

    const stageMoved = executeCardEffect(
      protectedState,
      opponentContext,
      {
        kind: 'field-to-trash',
        allowStage: true,
        target: { side: 'opponent', min: 1, max: 1 },
      },
      ['timekeeper-stage'],
    )
    expect(stageMoved.players['player-one'].stage).toBeNull()
    expect(stageMoved.players['player-one'].battleArea).toHaveLength(2)

    const controllerCanMove = executeCardEffect(
      protectedState,
      { ...context, sourceInstanceId: timekeeper.card.instanceId },
      { kind: 'opponent-battle-to-trash', min: 1 },
      [base.players['player-two'].battleArea[0].card.instanceId],
    )
    expect(controllerCanMove.players['player-two'].battleArea).toHaveLength(0)
  })

  it('applies a passive no-damage condition only while its controller has fewer supports', () => {
    let state = createDemoGame()
    const attacker = state.players['player-two'].battleArea[0]
    const target = state.players['player-one'].battleArea[0]
    const protectedTarget = {
      ...target,
      card: {
        ...target.card,
        skill: {
          trigger: 'passive' as const,
          oncePerTurn: false,
          yourTurn: true,
          restSource: false,
          cost: {},
          text: '',
          effects: [
            {
              kind: 'modify-damage-received' as const,
              amount: 0,
              duration: 'persistent' as const,
              target: { side: 'self' as const, min: 1, max: 1, sourceOnly: true },
              minimumDamage: 0,
              setDamageTo: 0,
              condition: {
                kind: 'support-count-less-than-opponent' as const,
                difference: 1,
              },
            },
          ],
        },
      },
    }

    state = {
      ...state,
      activePlayerId: 'player-one',
      players: {
        ...state.players,
        'player-one': {
          ...state.players['player-one'],
          battleArea: [protectedTarget],
          supportArea: [],
        },
        'player-two': {
          ...state.players['player-two'],
          supportArea: [
            { card: createSupport('opponent-support'), rested: false },
          ],
        },
      },
    }

    expect(
      getAttackDamageAgainst(
        state,
        attacker.card.instanceId,
        protectedTarget.card.instanceId,
      ),
    ).toBe(0)

    state = {
      ...state,
      players: {
        ...state.players,
        'player-one': {
          ...state.players['player-one'],
          supportArea: [
            { card: createSupport('matching-support'), rested: false },
          ],
        },
      },
    }

    expect(
      getAttackDamageAgainst(
        state,
        attacker.card.instanceId,
        protectedTarget.card.instanceId,
      ),
    ).toBe(attacker.card.attack)
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

  it('keeps exactly five support cards and returns the remainder to hand', () => {
    let state = createDemoGame()
    const supports = Array.from({ length: 6 }, (_, index) => ({
      card: createSupport(`keep-support-${index + 1}`),
      rested: false,
    }))
    state = {
      ...state,
      players: {
        ...state.players,
        'player-one': {
          ...state.players['player-one'],
          supportArea: supports,
        },
      },
    }

    state = executeCardEffect(
      state,
      context,
      {
        kind: 'support-to-hand',
        amount: 0,
        keepCount: 5,
      },
      supports.slice(0, 5).map((support) => support.card.instanceId),
    )

    expect(
      state.players['player-one'].supportArea.map(
        (support) => support.card.instanceId,
      ),
    ).toEqual(supports.slice(0, 5).map((support) => support.card.instanceId))
    expect(state.players['player-one'].hand).toContainEqual(supports[5].card)
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

  it('all-of condition only passes when every sub-condition is met (BS4-077)', () => {
    const base = createDemoGame()
    const blueCookie: GameCard = {
      id: 'blue-battle-cookie',
      instanceId: 'blue-battle-cookie',
      name: 'Blue Battle Cookie',
      type: 'cookie',
      level: 1,
      hp: 1,
      attack: 1,
      attackCost: 1,
      energyColor: 'blue',
    }
    const effect: CardEffect = {
      kind: 'draw-up-to',
      max: 2,
      condition: {
        kind: 'all-of',
        conditions: [
          { kind: 'hand-count-at-most', count: 5 },
          { kind: 'battle-area-has-color', side: 'self', color: 'blue' },
        ],
      },
    }

    const bothMet: GameState = {
      ...base,
      players: {
        ...base.players,
        'player-one': {
          ...base.players['player-one'],
          hand: base.players['player-one'].hand.slice(0, 5),
          battleArea: [
            ...base.players['player-one'].battleArea,
            { card: blueCookie, hpCards: [], rested: false },
          ],
        },
      },
    }
    expect(isEffectConditionMet(bothMet, context, effect)).toBe(true)

    const handTooLarge: GameState = {
      ...bothMet,
      players: {
        ...bothMet.players,
        'player-one': {
          ...bothMet.players['player-one'],
          hand: [
            ...bothMet.players['player-one'].hand,
            createSupport('extra-hand-card'),
          ],
        },
      },
    }
    expect(handTooLarge.players['player-one'].hand.length).toBeGreaterThan(5)
    expect(isEffectConditionMet(handTooLarge, context, effect)).toBe(false)

    const noBlueCookie: GameState = {
      ...bothMet,
      players: {
        ...bothMet.players,
        'player-one': {
          ...bothMet.players['player-one'],
          battleArea: bothMet.players['player-one'].battleArea.filter(
            (cookie) => cookie.card.instanceId !== blueCookie.instanceId,
          ),
        },
      },
    }
    expect(isEffectConditionMet(noBlueCookie, context, effect)).toBe(false)
  })

  it('draws only when the Cookie selected by a modify-attack follow-up has the required HP', () => {
    let state = createDemoGame()
    const base = state.players['player-one'].battleArea[0]
    const selectedAtTwoHp = {
      ...base,
      card: { ...base.card, instanceId: 'selected-at-two-hp', level: 2 },
      hpCards: [createSupport('two-hp-a'), createSupport('two-hp-b')],
    }
    const unselectedAtOneHp = {
      ...base,
      card: { ...base.card, instanceId: 'unselected-at-one-hp', level: 2 },
      hpCards: [createSupport('one-hp')],
    }
    state = {
      ...state,
      players: {
        ...state.players,
        'player-one': {
          ...state.players['player-one'],
          battleArea: [selectedAtTwoHp, unselectedAtOneHp],
        },
      },
    }
    const effect: CardEffect = {
      kind: 'modify-attack',
      amount: 1,
      duration: 'this-turn',
      target: { side: 'self', min: 0, max: 1, minLevel: 2, maxRemainingHp: 3 },
      thenDrawUpToIfTargetRemainingHp: { remainingHp: 1, max: 1 },
    }

    const withoutDraw = executeCardEffect(state, context, effect, [
      selectedAtTwoHp.card.instanceId,
    ])
    expect(withoutDraw.pendingDrawUpTo).toBeUndefined()

    const withDraw = executeCardEffect(state, context, effect, [
      unselectedAtOneHp.card.instanceId,
    ])
    expect(withDraw.pendingDrawUpTo).toMatchObject({
      playerId: 'player-one',
      max: 1,
    })
  })

  it('only returns HP to hand while the hand-count condition is met (BS6-012)', () => {
    const base = createDemoGame()
    const source = base.players['player-one'].battleArea[0]
    const effect: CardEffect = {
      kind: 'hp-to-hand',
      amount: 1,
      target: { side: 'self', min: 1, max: 1 },
      condition: { kind: 'hand-count-at-most', count: 5 },
    }
    const withFiveCards: GameState = {
      ...base,
      players: {
        ...base.players,
        'player-one': {
          ...base.players['player-one'],
          hand: Array.from({ length: 5 }, (_, index) =>
            createSupport(`hand-${index}`),
          ),
          battleArea: [
            {
              ...source,
              hpCards: [createSupport('hp-a'), createSupport('hp-b')],
            },
          ],
        },
      },
    }

    expect(isEffectConditionMet(withFiveCards, context, effect)).toBe(true)
    const resolved = executeCardEffect(withFiveCards, context, effect, [
      source.card.instanceId,
    ])
    expect(resolved.players['player-one'].battleArea[0].hpCards).toHaveLength(1)
    expect(resolved.players['player-one'].hand).toHaveLength(6)

    const withSixCards: GameState = {
      ...withFiveCards,
      players: {
        ...withFiveCards.players,
        'player-one': {
          ...withFiveCards.players['player-one'],
          hand: Array.from({ length: 6 }, (_, index) =>
            createSupport(`too-many-hand-${index}`),
          ),
        },
      },
    }

    expect(isEffectConditionMet(withSixCards, context, effect)).toBe(false)
    expect(() =>
      executeCardEffect(withSixCards, context, effect, [source.card.instanceId]),
    ).toThrow('尚未滿足卡牌效果的發動條件。')
  })
})
