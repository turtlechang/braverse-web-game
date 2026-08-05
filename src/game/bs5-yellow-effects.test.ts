import { describe, expect, it } from 'vitest'
import {
  applyGameCommand,
  beginAttack,
  executeCardEffect,
  getEffectTargetCandidates,
  getFaintEffectCardCandidates,
  getFaintEffectMinMax,
  isEffectConditionMet,
  resolveAttackEffect,
  resolveFaintEffect,
  resolveNextDamage,
  skipTrap,
  type CardEffect,
  type CookieCard,
  type EffectContext,
  type GameCard,
  type GameState,
} from '.'
import { cookie, item } from './test-helpers/battle-helpers'

const makeFaintEffect: CardEffect = {
  kind: 'make-faint',
  target: {
    side: 'opponent',
    min: 0,
    max: 1,
    maxLevel: 1,
    noSkillOnly: true,
  },
}

const djCookie = (instanceId: string): CookieCard => {
  const card = cookie(instanceId, 2, 2)
  return {
    ...card,
    id: 'BS5-026',
    name: 'DJ Cookie',
    level: 1,
    energyColor: 'yellow' as const,
    skill: {
      trigger: 'passive',
      oncePerTurn: false,
      yourTurn: false,
      restSource: false,
      cost: { energy: {}, discardHand: 0 },
      text: 'When this Cookie faints, place 1 {Y} LV.2 or lower Cookie from your hand into your break area. Return this Cookie to your hand.',
      effects: [
        {
          kind: 'hand-to-break',
          amount: 1,
          energyColor: 'yellow' as const,
          maxLevel: 2,
        },
        {
          kind: 'return-to-hand',
          target: { side: 'self', min: 1, max: 1, sourceOnly: true },
        },
      ],
      faint: true,
    },
  }
}

const createState = (): GameState => {
  const base = {
    players: {
      'player-one': {
        id: 'player-one',
        name: 'P1',
        deck: [item('p1-d-1'), item('p1-d-2'), item('p1-d-3')],
        hand: [item('p1-hand')],
        battleArea: [],
        supportArea: [{ card: item('p1-s'), rested: false }],
        breakArea: [],
        discardPile: [],
        stage: null,
        hasMulliganed: false,
        startingCookieSelected: true,
      },
      'player-two': {
        id: 'player-two',
        name: 'P2',
        deck: [item('p2-d-1'), item('p2-d-2'), item('p2-d-3')],
        hand: [item('p2-hand')],
        battleArea: [],
        supportArea: [{ card: item('p2-s'), rested: false }],
        breakArea: [],
        discardPile: [],
        stage: null,
        hasMulliganed: false,
        startingCookieSelected: true,
      },
    },
    firstPlayerId: 'player-one',
    activePlayerId: 'player-one',
    turnNumber: 2,
    phase: 'main',
    status: 'playing',
    result: null,
    supportPlacedThisTurn: false,
    skillUsesThisTurn: [],
    nextBattleEntrySequence: 10,
    attackModifiers: [],
    damageReceivedModifiers: [],
    pendingReplacement: null,
    departedCookieCounts: { 'player-one': 0, 'player-two': 0 },
    pendingRefresh: null,
    pendingBattle: null,
  }
  return base as GameState
}

describe('make-faint（BS5-036 Milk Cookie）', () => {
  it('targets only no-skill LV.1 opponent cookies', () => {
    const state = createState()
    const plain = cookie('plain-cookie', 1, 1)
    plain.level = 1
    const skilled = { ...cookie('skilled-cookie', 1, 1), level: 1, skill: {
      trigger: 'activate' as const,
      oncePerTurn: false,
      yourTurn: false,
      restSource: false,
      cost: { energy: {}, discardHand: 0 },
      text: 'demo skill',
      effects: [],
    } }
    const highLevel = { ...cookie('high-cookie', 1, 1), level: 2 }
    state.players['player-two'].battleArea = [
      { card: plain, hpCards: [item('plain-hp-1'), item('plain-hp-2')], rested: false, battleEntryId: 'plain:battle:1' },
      { card: skilled, hpCards: [item('skilled-hp-1')], rested: false, battleEntryId: 'skilled:battle:2' },
      { card: highLevel, hpCards: [item('high-hp-1')], rested: false, battleEntryId: 'high:battle:3' },
    ]

    const candidates = getEffectTargetCandidates(
      state,
      { sourcePlayerId: 'player-one', sourceInstanceId: 'milk-cookie' },
      makeFaintEffect.target,
    )
    expect(candidates.map((entry) => entry.card.instanceId)).toEqual([
      'plain-cookie',
    ])
  })

  it('resolves a fainted no-skill cookie through the faint pipeline', () => {
    const state = createState()
    const target = cookie('target-cookie', 1, 2)
    target.level = 1
    state.players['player-two'].battleArea = [
      {
        card: target,
        hpCards: [item('target-hp-1'), item('target-hp-2')],
        rested: false,
        battleEntryId: 'target:battle:1',
      },
    ]

    const context: EffectContext = {
      sourcePlayerId: 'player-one',
      sourceInstanceId: 'milk-cookie',
      sourceCardName: 'Milk Cookie',
    }
    const after = executeCardEffect(state, context, makeFaintEffect, [
      'target-cookie',
    ])

    const p2 = after.players['player-two']
    expect(p2.battleArea).toHaveLength(0)
    expect(p2.breakArea.map((card) => card.instanceId)).toEqual(['target-cookie'])
    expect(p2.discardPile.map((card) => card.instanceId)).toEqual([
      'target-hp-1',
      'target-hp-2',
    ])
    expect(after.departedCookieCounts['player-two']).toBe(1)
  })

  it('rejects invalid targets with a rule error', () => {
    const state = createState()
    const target = cookie('plain-cookie', 1, 1)
    target.level = 1
    state.players['player-two'].battleArea = [
      {
        card: target,
        hpCards: [item('plain-hp-1')],
        rested: false,
        battleEntryId: 'plain:battle:1',
      },
    ]

    expect(() =>
      executeCardEffect(
        state,
        { sourcePlayerId: 'player-one', sourceInstanceId: 'milk-cookie' },
        makeFaintEffect,
        ['not-a-candidate'],
      ),
    ).toThrowError()
  })

  it('skips cleanly when no target is selected', () => {
    const state = createState()
    const context: EffectContext = {
      sourcePlayerId: 'player-one',
      sourceInstanceId: 'milk-cookie',
      sourceCardName: 'Milk Cookie',
    }
    const after = executeCardEffect(state, context, makeFaintEffect, [])
    expect(after.players['player-two'].battleArea).toHaveLength(0)
    expect(after.departedCookieCounts['player-two']).toBe(0)
  })
})

describe('faint 技能（BS5-026 DJ Cookie）', () => {
  it('queues hand-to-break and return-to-hand when DJ faints in battle', () => {
    const state = createState()
    state.players['player-two'].battleArea = [
      {
        card: djCookie('dj-cookie'),
        hpCards: [item('dj-hp-1'), item('dj-hp-2')],
        rested: false,
        battleEntryId: 'dj:battle:1',
      },
    ]
    const attacker = { ...cookie('attacker', 3, 1), energyColor: 'yellow' as const }
    state.players['player-one'].battleArea = [
      {
        card: attacker,
        hpCards: [item('attacker-hp-1')],
        rested: false,
        battleEntryId: 'attacker:battle:2',
      },
    ]

    let battleState = beginAttack(state, 'attacker', 'dj-cookie', ['p1-s'])
    battleState = skipTrap(battleState, 'player-two')
    while (battleState.pendingBattle?.stage === 'damage') {
      battleState = resolveNextDamage(battleState)
    }

    const faints = battleState.pendingFaintEffects
    expect(faints?.map((entry) => entry.effect.kind)).toEqual([
      'hand-to-break',
      'return-to-hand',
    ])
    expect(
      battleState.players['player-two'].breakArea.map((card) => card.instanceId),
    ).toContain('dj-cookie')
  })

  it('resolves the faint skill: yellow LV.2 or lower hand cookie to break, DJ back to hand', () => {
    const state = createState()
    const yellowLv2 = { ...cookie('yellow-lv2', 1, 2), level: 2, energyColor: 'yellow' as const }
    const yellowLv3 = { ...cookie('yellow-lv3', 1, 2), level: 3, energyColor: 'yellow' as const }
    const redLv1 = { ...cookie('red-lv1', 1, 2), energyColor: 'red' as const }
    const dj = djCookie('dj-cookie')
    state.players['player-two'].battleArea = [
      {
        card: dj,
        hpCards: [item('dj-hp-1'), item('dj-hp-2')],
        rested: false,
        battleEntryId: 'dj:battle:1',
      },
    ]
    state.players['player-two'].hand = [yellowLv2, yellowLv3, redLv1]
    state.players['player-two'].deck = [
      item('p2-d-1'),
      item('p2-d-2'),
      item('p2-d-3'),
    ]
    // DJ 已昏厥離場：只留在休息區，戰鬥區為空
    state.players['player-two'].battleArea = []
    state.pendingFaintEffects = [
      {
        sourcePlayerId: 'player-two',
        sourceInstanceId: 'dj-cookie',
        sourceCardName: 'DJ Cookie',
        effect: {
          kind: 'hand-to-break',
          amount: 1,
          energyColor: 'yellow' as const,
          maxLevel: 2,
        },
        context: {
          sourcePlayerId: 'player-two',
          sourceInstanceId: 'dj-cookie',
          sourceCardName: 'DJ Cookie',
        },
      },
      {
        sourcePlayerId: 'player-two',
        sourceInstanceId: 'dj-cookie',
        sourceCardName: 'DJ Cookie',
        effect: {
          kind: 'return-to-hand',
          target: { side: 'self', min: 1, max: 1, sourceOnly: true },
        },
        context: {
          sourcePlayerId: 'player-two',
          sourceInstanceId: 'dj-cookie',
          sourceCardName: 'DJ Cookie',
        },
      },
    ]
    state.players['player-two'].breakArea = [dj]

    // 手牌候選：只有黃色 LV.2 符合
    expect(
      getFaintEffectCardCandidates(state).map((card) => card.instanceId),
    ).toEqual(['yellow-lv2'])

    // return-to-hand 的來源在休息區：不需要選目標
    const returnEffect = state.pendingFaintEffects[1].effect
    expect(getFaintEffectMinMax(state, returnEffect)).toEqual({ min: 0, max: 0 })

    let next = resolveFaintEffect(state, ['yellow-lv2'])
    expect(next.players['player-two'].breakArea.map((card) => card.instanceId)).toEqual([
      'dj-cookie',
      'yellow-lv2',
    ])
    // 第二個昏厥效果（return-to-hand）在來源於休息區時自動結算，不需選目標
    next = resolveFaintEffect(next, [])
    const p2 = next.players['player-two']
    expect(p2.breakArea.map((card) => card.instanceId)).toEqual(['yellow-lv2'])
    expect(p2.hand.map((card) => card.instanceId)).toEqual([
      'yellow-lv3',
      'red-lv1',
      'dj-cookie',
    ])
    expect(next.pendingFaintEffects).toBeUndefined()
  })
})

describe('cookie-gained-hp-this-turn 條件（BS5-044）', () => {
  const stageDamageEffect: CardEffect = {
    kind: 'damage',
    amount: 1,
    target: { side: 'opponent', min: 0, max: 1 },
    condition: { kind: 'cookie-gained-hp-this-turn' },
  }
  const context: EffectContext = {
    sourcePlayerId: 'player-one',
    sourceInstanceId: 'stage-instance',
    sourceCardName: "Ananas Dragon Cookie's Nest",
  }

  it('is not met before any gain-hp this turn', () => {
    const state = createState()
    state.players['player-two'].battleArea = [
      {
        card: cookie('p2-cookie', 1, 2),
        hpCards: [item('p2-cookie-hp-1'), item('p2-cookie-hp-2')],
        rested: false,
        battleEntryId: 'p2-cookie:battle:1',
      },
    ]
    expect(isEffectConditionMet(state, context, stageDamageEffect)).toBe(false)
  })

  it('is met after a gain-hp effect resolved this turn', () => {
    const state = createState()
    const target = cookie('p1-cookie', 1, 1)
    state.players['player-one'].battleArea = [
      {
        card: target,
        hpCards: [item('p1-cookie-hp-1')],
        rested: false,
        battleEntryId: 'p1-cookie:battle:1',
      },
    ]
    const gainHp: CardEffect = {
      kind: 'gain-hp',
      amount: 1,
      target: { side: 'self', min: 1, max: 1, sourceOnly: true },
    }
    const afterGain = executeCardEffect(
      state,
      { sourcePlayerId: 'player-one', sourceInstanceId: 'p1-cookie' },
      gainHp,
      ['p1-cookie'],
    )
    expect(afterGain.cookiesGainedHpThisTurn).toEqual({ 'player-one': true })
    expect(
      isEffectConditionMet(afterGain, context, stageDamageEffect),
    ).toBe(true)
  })

  it('skips the damage effect when the condition is not met（場景啟動流程）', () => {
    const state = createState()
    const p2Cookie = cookie('p2-cookie', 1, 2)
    p2Cookie.level = 1
    state.players['player-two'].battleArea = [
      {
        card: p2Cookie,
        hpCards: [item('p2-cookie-hp-1'), item('p2-cookie-hp-2')],
        rested: false,
        battleEntryId: 'p2-cookie:battle:1',
      },
    ]
    state.players['player-one'].supportArea = [
      { card: item('p1-yellow', 'yellow'), rested: false },
    ]
    const stageCard: GameCard = {
      id: 'BS5-044',
      instanceId: 'bs5-044-stage',
      name: "Ananas Dragon Cookie's Nest",
      type: 'stage',
      energyColor: 'yellow' as const,
      stageAbility: {
        placementCost: { yellow: 1 },
        cost: { energy: { yellow: 1 }, discardHand: 0 },
        restSource: true,
        text: 'test stage',
        effects: [stageDamageEffect, {
          kind: 'gain-hp',
          amount: 1,
          target: {
            side: 'self',
            min: 0,
            max: 1,
            cardName: 'Ananas Dragon Cookie',
          },
        }],
      },
    }
    state.players['player-one'].stage = { card: stageCard, rested: false }

    const activated = applyGameCommand(state, {
      kind: 'activate-stage',
      playerId: 'player-one',
      paymentIds: ['p1-yellow'],
      effectTargets: [[], []],
    })
    // 本回合沒有餅乾獲得 HP：damage 效果被跳過，對手餅乾毫髮無傷
    expect(
      activated.players['player-two'].battleArea[0].hpCards,
    ).toHaveLength(2)
    expect(activated.players['player-one'].stage?.rested).toBe(true)
  })

  it('deals the damage when a Cookie gained HP this turn（場景啟動流程）', () => {
    const state = createState()
    const p2Cookie = cookie('p2-cookie', 1, 2)
    p2Cookie.level = 1
    state.players['player-two'].battleArea = [
      {
        card: p2Cookie,
        hpCards: [item('p2-cookie-hp-1'), item('p2-cookie-hp-2')],
        rested: false,
        battleEntryId: 'p2-cookie:battle:1',
      },
    ]
    state.players['player-one'].supportArea = [
      { card: item('p1-yellow', 'yellow'), rested: false },
    ]
    state.players['player-one'].battleArea = [
      {
        card: cookie('ananas', 1, 2),
        hpCards: [item('ananas-hp-1')],
        rested: false,
        battleEntryId: 'ananas:battle:1',
      },
    ]
    const stageCard: GameCard = {
      id: 'BS5-044',
      instanceId: 'bs5-044-stage',
      name: "Ananas Dragon Cookie's Nest",
      type: 'stage',
      energyColor: 'yellow' as const,
      stageAbility: {
        placementCost: { yellow: 1 },
        cost: { energy: { yellow: 1 }, discardHand: 0 },
        restSource: true,
        text: 'test stage',
        effects: [stageDamageEffect, {
          kind: 'gain-hp',
          amount: 1,
          target: {
            side: 'self',
            min: 0,
            max: 1,
            cardName: 'Ananas Dragon Cookie',
          },
        }],
      },
    }
    state.players['player-one'].stage = { card: stageCard, rested: false }
    state.cookiesGainedHpThisTurn = { 'player-one': true }

    const activated = applyGameCommand(state, {
      kind: 'activate-stage',
      playerId: 'player-one',
      paymentIds: ['p1-yellow'],
      effectTargets: [['p2-cookie'], ['ananas']],
    })
    expect(
      activated.players['player-two'].battleArea[0].hpCards,
    ).toHaveLength(1)
    expect(
      activated.players['player-one'].battleArea[0].hpCards,
    ).toHaveLength(2)
  })
})

describe('attack-target-remaining-hp-at-most 條件（BS5-024）', () => {
  it('deals the Then damage only when the attacked Cookie has 2 or fewer HP left', () => {
    const state = createState()
    state.players['player-one'].battleArea = [
      {
        card: { ...cookie('defender', 1, 3) },
        hpCards: [item('d-hp-1'), item('d-hp-2'), item('d-hp-3')],
        rested: false,
        battleEntryId: 'defender:battle:1',
      },
    ]
    const attacker = {
      ...cookie('attacker', 2, 1),
      energyColor: 'yellow' as const,
      attackEffects: [
        {
          kind: 'damage' as const,
          amount: 1,
          target: { side: 'opponent' as const, min: 1, max: 1, attackTargetOnly: true },
          condition: { kind: 'attack-target-remaining-hp-at-most' as const, amount: 2 },
        },
      ],
    }
    state.players['player-two'].battleArea = [
      {
        card: attacker,
        hpCards: [item('a-hp-1')],
        rested: false,
        battleEntryId: 'attacker:battle:2',
      },
    ]
    state.activePlayerId = 'player-two'

    let battleState = beginAttack(state, 'attacker', 'defender', ['p2-s'])
    battleState = skipTrap(battleState, 'player-one')
    while (battleState.pendingBattle?.stage === 'damage') {
      battleState = resolveNextDamage(battleState)
    }

    // 攻擊 2 傷害後剩 1 HP：條件「剩餘 HP 2 以下」成立，Then 再打 1 → 昏厥
    expect(
      battleState.players['player-one'].battleArea[0].hpCards,
    ).toHaveLength(1)
    const after = resolveAttackEffect(battleState, 'player-two', ['defender'])
    expect(after.players['player-one'].battleArea).toHaveLength(0)
  })

  it('skips the Then damage when the attacked Cookie still has 3+ HP', () => {
    const state = createState()
    state.players['player-one'].battleArea = [
      {
        card: { ...cookie('defender', 1, 4) },
        hpCards: [item('d-hp-1'), item('d-hp-2'), item('d-hp-3'), item('d-hp-4')],
        rested: false,
        battleEntryId: 'defender:battle:1',
      },
    ]
    const attacker = {
      ...cookie('attacker', 1, 1),
      energyColor: 'yellow' as const,
      attackEffects: [
        {
          kind: 'damage' as const,
          amount: 1,
          target: { side: 'opponent' as const, min: 1, max: 1, attackTargetOnly: true },
          condition: { kind: 'attack-target-remaining-hp-at-most' as const, amount: 2 },
        },
      ],
    }
    state.players['player-two'].battleArea = [
      {
        card: attacker,
        hpCards: [item('a-hp-1')],
        rested: false,
        battleEntryId: 'attacker:battle:2',
      },
    ]
    state.activePlayerId = 'player-two'

    let battleState = beginAttack(state, 'attacker', 'defender', ['p2-s'])
    battleState = skipTrap(battleState, 'player-one')
    while (battleState.pendingBattle?.stage === 'damage') {
      battleState = resolveNextDamage(battleState)
    }

    // 攻擊 1 傷害後剩 3 HP：條件不成立，Then 不執行
    const after = resolveAttackEffect(battleState, 'player-two', ['defender'])
    expect(
      after.players['player-one'].battleArea[0].hpCards,
    ).toHaveLength(3)
  })
})

describe('gain-hp 記錄 cookiesGainedHpThisTurn', () => {
  it('records the source player and resets on turn change', () => {
    const state = createState()
    state.players['player-one'].battleArea = [
      {
        card: cookie('p1-cookie', 1, 1),
        hpCards: [item('p1-cookie-hp-1')],
        rested: false,
        battleEntryId: 'p1-cookie:battle:1',
      },
    ]
    const gainHp: CardEffect = {
      kind: 'gain-hp',
      amount: 1,
      target: { side: 'self', min: 1, max: 1, sourceOnly: true },
    }
    const after = executeCardEffect(state, { sourcePlayerId: 'player-one', sourceInstanceId: 'p1-cookie' }, gainHp, ['p1-cookie'])
    expect(after.cookiesGainedHpThisTurn).toEqual({ 'player-one': true })

    const advanced = applyGameCommand(after, { kind: 'advance-phase', playerId: 'player-one' })
    const nextTurn = applyGameCommand(advanced, { kind: 'advance-phase', playerId: 'player-one' })
    expect(nextTurn.cookiesGainedHpThisTurn).toEqual({})
  })
})
