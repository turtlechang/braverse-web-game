import { describe, expect, it } from 'vitest'
import {
  beginAttack,
  applyGameCommand,
  createOfficialRedStarterDeck,
  explainUnavailableTraps,
  getPendingDecision,
  getTrapTargetCandidates,
  getTrapSelfTargetCandidates,
  getTrapCandidates,
  playTrap,
  resolveDrawUpTo,
  resolveFlip,
  resolveNextDamage,
  takeAiStep,
  type CookieCard,
  type GameCard,
  type GameState,
} from '.'
import { cookie, createBattleState, declareAttack, item } from './test-helpers/battle-helpers'

describe('TRAP response window', () => {
  it('BS6-008 prevents the defender from activating Traps only for an attack at 4 HP or less', () => {
    const trap: GameCard = {
      id: 'trap-response',
      instanceId: 'trap-response',
      name: 'Trap response',
      type: 'trap',
      officialType: 'trap',
      trap: { text: 'Trap response', cost: { energy: {}, discardHand: 0 }, effects: [] },
    }
    const sugarSwanSkill = {
      trigger: 'passive' as const,
      oncePerTurn: false,
      yourTurn: false,
      restSource: false,
      cost: { energy: {}, discardHand: 0 },
      text: 'When this Cookie attacks, if this Cookie\'s remaining HP is 4 or less, during this battle, your opponent cannot activate traps.',
      effects: [
        {
          kind: 'disable-traps' as const,
          duration: 'current-battle' as const,
          condition: { kind: 'source-hp-at-most' as const, amount: 4 },
        },
      ],
    }
    let state = createBattleState()
    state.players['player-two'].battleArea[0] = {
      ...state.players['player-two'].battleArea[0],
      card: {
        ...state.players['player-two'].battleArea[0].card,
        id: 'BS6-008',
        skill: sugarSwanSkill,
      },
      hpCards: [
        item('attacker-hp-1'),
        item('attacker-hp-2'),
        item('attacker-hp-3'),
        item('attacker-hp-4'),
      ],
    }
    state.players['player-one'].hand = [trap]

    state = declareAttack(state)

    expect(state.pendingBattle?.trapsDisabled).toBe(true)
    expect(getTrapCandidates(state, 'player-one')).toEqual([])
    expect(explainUnavailableTraps(state, 'player-one')).toEqual([
      expect.objectContaining({ instanceId: trap.instanceId, reason: 'traps-disabled' }),
    ])
    expect(() =>
      playTrap(state, 'player-one', {
        trapInstanceId: trap.instanceId,
        paymentIds: [],
        targetIds: [],
      }),
    ).toThrow('Invalid battle action.')

    state = createBattleState()
    state.players['player-two'].battleArea[0] = {
      ...state.players['player-two'].battleArea[0],
      card: {
        ...state.players['player-two'].battleArea[0].card,
        id: 'BS6-008',
        skill: sugarSwanSkill,
      },
      hpCards: Array.from({ length: 5 }, (_, index) => item(`attacker-hp-${index}`)),
    }
    state.players['player-one'].hand = [trap]

    state = declareAttack(state)

    expect(state.pendingBattle?.trapsDisabled).toBeUndefined()
    expect(getTrapCandidates(state, 'player-one')).toContainEqual(trap)
  })

  const discardCostTrap = (): GameCard => ({
    id: 'ST4-020',
    instanceId: 'st4-020-test',
    name: 'Octo-Ink Spray',
    type: 'trap',
    officialType: 'trap',
    trap: {
      text: '《{B}》《Discard 2 cards.》 Select up to 1 opponent Cookie.',
      cost: { energy: {}, discardHand: 2 },
      effects: [
        {
          kind: 'modify-attack',
          amount: -3,
          duration: 'this-turn',
          target: { side: 'opponent', min: 0, max: 1 },
        },
      ],
    },
  })

  it('keeps the declared attack target when ST2-020 only modifies the attacker', () => {
    const windingKeyShield: GameCard = {
      id: 'ST2-020',
      instanceId: 'st2-020-test',
      name: 'Winding Key Shield',
      type: 'trap',
      officialType: 'trap',
      energyColor: 'yellow',
      trap: {
        text: 'Select up to 1 of your opponent\'s Cookies. During this turn, that Cookie deals -3 attack damage.',
        cost: { energy: { yellow: 2 }, discardHand: 0 },
        condition: { kind: 'break-level-at-least', level: 5 },
        effects: [
          {
            kind: 'modify-attack',
            amount: -3,
            duration: 'this-turn',
            target: { side: 'opponent', min: 0, max: 1 },
          },
        ],
      },
    }
    let state = createBattleState()
    state.players['player-one'].hand = [windingKeyShield]
    state.players['player-one'].supportArea = [
      { card: item('p1-yellow-a', 'yellow'), rested: false },
      { card: item('p1-yellow-b', 'yellow'), rested: false },
    ]
    state.players['player-one'].breakArea = Array.from(
      { length: 5 },
      (_, index) => cookie(`p1-break-${index}`),
    )
    state = declareAttack(state)

    const result = playTrap(state, 'player-one', {
      trapInstanceId: windingKeyShield.instanceId,
      paymentIds: ['p1-yellow-a', 'p1-yellow-b'],
      targetIds: ['attacker'],
    })

    expect(result.pendingBattle?.targetInstanceId).toBe('defender')
    expect(result.attackModifiers).toContainEqual(
      expect.objectContaining({
        sourceInstanceId: windingKeyShield.instanceId,
        targetInstanceId: 'attacker',
        amount: -3,
      }),
    )
  })

  it('applies BS3-045 damage-by-break-count to the selected opponent Cookie', () => {
    const counterattackTrap: GameCard = {
      id: 'BS3-045',
      instanceId: 'bs3-045-test',
      name: "Golden Monarch's Counterattack",
      type: 'trap',
      officialType: 'trap',
      energyColor: 'yellow',
      trap: {
        text: 'Select up to 1 of your opponent\'s Cookies. That Cookie receives 1 damage for each LV.3 Cookie in your break area.',
        cost: { energy: { yellow: 2 }, discardHand: 0 },
        effects: [
          {
            kind: 'damage-by-break-count',
            perCount: 1,
            exactBreakLevel: 3,
            target: { side: 'opponent', min: 0, max: 1 },
          },
        ],
      },
    }
    let state = createBattleState()
    state.players['player-one'].hand = [counterattackTrap]
    state.players['player-one'].supportArea = [
      { card: item('p1-yellow-a', 'yellow'), rested: false },
      { card: item('p1-yellow-b', 'yellow'), rested: false },
    ]
    state.players['player-one'].breakArea = [
      { ...cookie('p1-lv3'), level: 3 },
    ]
    state.players['player-two'].battleArea[0].hpCards = [
      item('attacker-hp-a'),
      item('attacker-hp-b'),
    ]
    state = declareAttack(state)

    expect(
      getTrapTargetCandidates(state, 'player-one', counterattackTrap.instanceId)
        .map((candidate) => candidate.card.instanceId),
    ).toEqual(['attacker'])

    const result = playTrap(state, 'player-one', {
      trapInstanceId: counterattackTrap.instanceId,
      paymentIds: ['p1-yellow-a', 'p1-yellow-b'],
      targetIds: ['attacker'],
    })

    expect(result.players['player-two'].battleArea[0].hpCards).toHaveLength(1)
  })

  // 官方文字沒有「休息區要有 LV.3 才能發動」這種前置條件，只是傷害量按
  // 休息區 LV.3 張數縮放（0 張時就是 0 傷害）。這張卡不該被「休息區沒有
  // LV.3」擋在 getTrapCandidates 之外——玩家仍可能為了消耗手牌、觸發其他
  // 聯動效果而選擇發動。
  it('remains playable (and resolves to 0 damage) when the break area has no LV.3 Cookie', () => {
    const counterattackTrap: GameCard = {
      id: 'BS3-045',
      instanceId: 'bs3-045-test-no-lv3',
      name: "Golden Monarch's Counterattack",
      type: 'trap',
      officialType: 'trap',
      energyColor: 'yellow',
      trap: {
        text: 'Select up to 1 of your opponent\'s Cookies. That Cookie receives 1 damage for each LV.3 Cookie in your break area.',
        cost: { energy: { yellow: 2 }, discardHand: 0 },
        effects: [
          {
            kind: 'damage-by-break-count',
            perCount: 1,
            exactBreakLevel: 3,
            target: { side: 'opponent', min: 0, max: 1 },
          },
        ],
      },
    }
    let state = createBattleState()
    state.players['player-one'].hand = [counterattackTrap]
    state.players['player-one'].supportArea = [
      { card: item('p1-yellow-a', 'yellow'), rested: false },
      { card: item('p1-yellow-b', 'yellow'), rested: false },
    ]
    state.players['player-one'].breakArea = []
    state.players['player-two'].battleArea[0].hpCards = [
      item('attacker-hp-a'),
      item('attacker-hp-b'),
    ]
    state = declareAttack(state)

    expect(
      getTrapCandidates(state, 'player-one').map((card) => card.instanceId),
    ).toContain(counterattackTrap.instanceId)

    const result = playTrap(state, 'player-one', {
      trapInstanceId: counterattackTrap.instanceId,
      paymentIds: ['p1-yellow-a', 'p1-yellow-b'],
      targetIds: ['attacker'],
    })

    expect(result.players['player-two'].battleArea[0].hpCards).toHaveLength(2)
  })

  const purpleCookieCostTrap = (): GameCard => ({
    id: 'ST5-020',
    instanceId: 'st5-020-test',
    name: 'Forbidden Grimoire',
    type: 'trap',
    officialType: 'trap',
    trap: {
      text: 'Place 1 purple LV.1 Cookie from your battle area into the trash.',
      cost: {
        energy: {},
        discardHand: 0,
        trashBattleCookie: { count: 1, level: 1, energyColor: 'purple' },
      },
      effects: [
        {
          kind: 'modify-attack',
          amount: -3,
          duration: 'this-turn',
          target: { side: 'opponent', min: 0, max: 1 },
        },
      ],
    },
  })

  const trashCountConditionTrap = (): GameCard => ({
    id: 'BS2-080',
    instanceId: 'bs2-080-test',
    name: 'Abandoned Cloud Nest',
    type: 'trap',
    officialType: 'trap',
    trap: {
      text: '《{P}{P}》 If there are 15 cards or more in your trash, select up to 1 of your opponent\'s Cookies. During this turn, that Cookie deals -3 attack damage.',
      cost: { energy: { purple: 2 }, discardHand: 0 },
      // 產生自泛用 parser 的 condition.kind 命名為 'opponent-trash-count-at-least'，
      // 但陷阱評估（battle.ts isTrapConditionMet）實際檢查的是「陷阱擁有者
      // （防守方）自己」的棄牌區，並非對手（攻擊方）的——這是刻意保留的既有語意
      // （與 CardEffect 用的同名 condition 語意不同，見 targeting.ts），不要
      // 誤以為是命名反過來要「修正」成檢查對手棄牌區。
      condition: { kind: 'opponent-trash-count-at-least', count: 15 },
      effects: [
        {
          kind: 'modify-attack',
          amount: -3,
          duration: 'this-turn',
          target: { side: 'opponent', min: 0, max: 1 },
        },
      ],
    },
  })

  const hiddenWarpgateTrap = (): GameCard => ({
    id: 'ST5-021',
    instanceId: 'st5-021-test',
    name: 'Hidden Warpgate',
    type: 'trap',
    officialType: 'trap',
    trap: {
      text: 'Place 1 opponent Cookie whose remaining HP is 2 or less into the trash.',
      cost: { energy: {}, discardHand: 0 },
      effects: [
        {
          kind: 'field-to-trash',
          target: { side: 'opponent', min: 1, max: 1, remainingHp: 2 },
        },
      ],
    },
  })

  it('requires and pays the ST5-020 purple LV.1 battle-cookie cost', () => {
    const trap = purpleCookieCostTrap()
    let state = createBattleState()
    state.players['player-one'].hand = [trap, ...state.players['player-one'].hand]
    state = declareAttack(state)

    expect(getTrapCandidates(state, 'player-one')).toEqual([])

    state.players['player-one'].battleArea[0].card.energyColor = 'purple'
    expect(getTrapCandidates(state, 'player-one')).toEqual([trap])
    expect(() =>
      playTrap(state, 'player-one', {
        trapInstanceId: trap.instanceId,
        paymentIds: [],
        targetIds: ['attacker'],
      }),
    ).toThrow('戰鬥區餅乾')

    const result = playTrap(state, 'player-one', {
      trapInstanceId: trap.instanceId,
      paymentIds: [],
      targetIds: ['attacker'],
      trashBattleCookieIds: ['defender'],
    })

    expect(result.players['player-one'].battleArea).toHaveLength(0)
    expect(result.players['player-one'].discardPile.map((card) => card.instanceId)).toEqual(
      expect.arrayContaining(['defender', 'defender-hp-a', 'defender-hp-b', 'defender-hp-c']),
    )
    expect(result.pendingReplacement).toMatchObject({
      tasks: [{ playerId: 'player-one', remaining: 1 }],
    })
  })

  it("gates BS2-080's condition on the trap owner's (defender's) own trash, not the attacker's", () => {
    const trap = trashCountConditionTrap()
    let state = createBattleState()
    state.players['player-one'].hand = [trap, ...state.players['player-one'].hand]
    state.players['player-one'].supportArea = [
      { card: item('p1-purple-a', 'purple'), rested: false },
      { card: item('p1-purple-b', 'purple'), rested: false },
    ]
    state = declareAttack(state)

    // 防守方（陷阱擁有者）自己的棄牌區未滿 15 張：不該出現在候選陷阱中。
    expect(getTrapCandidates(state, 'player-one')).toEqual([])

    // 攻擊方（對手）棄牌區堆到 15 張以上，但條件檢查的不是這裡，候選仍應為空。
    state.players['player-two'].discardPile = Array.from(
      { length: 20 },
      (_, i) => item(`p2-trash-${i}`),
    )
    expect(getTrapCandidates(state, 'player-one')).toEqual([])

    // 防守方自己的棄牌區到達 15 張，條件才成立、陷阱才可發動。
    state.players['player-one'].discardPile = Array.from(
      { length: 15 },
      (_, i) => item(`p1-trash-${i}`),
    )
    expect(getTrapCandidates(state, 'player-one')).toEqual([trap])

    const result = playTrap(state, 'player-one', {
      trapInstanceId: trap.instanceId,
      paymentIds: ['p1-purple-a', 'p1-purple-b'],
      targetIds: ['attacker'],
    })
    expect(result.attackModifiers).toContainEqual(
      expect.objectContaining({ targetInstanceId: 'attacker', amount: -3 }),
    )
  })

  it('lets ST5-021 select and trash the attacking Cookie', () => {
    const trap = hiddenWarpgateTrap()
    let state = createBattleState()
    state.players['player-one'].hand = [trap, ...state.players['player-one'].hand]
    state = declareAttack(state)

    expect(getTrapCandidates(state, 'player-one')).toContain(trap)

    const result = playTrap(state, 'player-one', {
      trapInstanceId: trap.instanceId,
      paymentIds: [],
      targetIds: ['attacker'],
    })

    expect(result.players['player-two'].battleArea).toHaveLength(0)
    expect(result.players['player-two'].discardPile.map((card) => card.instanceId)).toEqual(
      expect.arrayContaining(['attacker', 'attacker-hp']),
    )
  })

  it('does not offer ST5-021 when no opposing Cookie has 2 or less remaining HP', () => {
    const trap = hiddenWarpgateTrap()
    let state = createBattleState()
    state.players['player-two'].battleArea[0].hpCards = [
      item('attacker-hp-a'),
      item('attacker-hp-b'),
      item('attacker-hp-c'),
    ]
    state.players['player-one'].hand = [trap, ...state.players['player-one'].hand]
    state = declareAttack(state)

    expect(getTrapCandidates(state, 'player-one')).not.toContain(trap)
  })

  it('does not offer a trap when its discard-hand cost cannot be paid', () => {
    const trap = discardCostTrap()
    let state = createBattleState()
    state.players['player-one'].hand = [trap, item('only-discard')]
    state = declareAttack(state)

    expect(getTrapCandidates(state, 'player-one')).toEqual([])
  })

  it('requires support cards before offering a support-to-trash trap', () => {
    const trap: GameCard = {
      id: 'ST3-019',
      instanceId: 'st3-019-test',
      name: 'Supreme Whipped Cream',
      type: 'trap',
      officialType: 'trap',
      trap: {
        text: 'Place 1 card from your support area into the trash.',
        cost: { energy: {}, discardHand: 0 },
        effects: [{ kind: 'support-to-trash', amount: 1 }],
      },
    }
    let state = createBattleState()
    state.players['player-one'].hand = [trap]
    state.players['player-one'].supportArea = []
    state = declareAttack(state)

    expect(getTrapCandidates(state, 'player-one')).toEqual([])

    const support = item('support-trash-option', 'green')
    state.players['player-one'].supportArea = [{ card: support, rested: false }]
    expect(getTrapCandidates(state, 'player-one')).toEqual([trap])

    const result = playTrap(state, 'player-one', {
      trapInstanceId: trap.instanceId,
      paymentIds: [],
      targetIds: [],
      supportTrashIds: [support.instanceId],
    })
    expect(result.players['player-one'].supportArea).toEqual([])
    expect(result.players['player-one'].discardPile).toContainEqual(support)
  })

  it('requires the player to choose exactly two hand cards for ST4-020', () => {
    const trap = discardCostTrap()
    const discardA = item('discard-a')
    const discardB = item('discard-b')
    const keep = item('keep')
    let state = createBattleState()
    state.players['player-one'].hand = [trap, discardA, discardB, keep]
    state = declareAttack(state)

    expect(() =>
      playTrap(state, 'player-one', {
        trapInstanceId: trap.instanceId,
        paymentIds: [],
        targetIds: ['attacker'],
        discardHandIds: [],
      }),
    ).toThrow('Must discard exactly 2 cards from hand.')

    const result = playTrap(state, 'player-one', {
      trapInstanceId: trap.instanceId,
      paymentIds: [],
      targetIds: ['attacker'],
      discardHandIds: [discardA.instanceId, discardB.instanceId],
    })

    expect(result.players['player-one'].hand).toEqual([keep])
    expect(result.players['player-one'].discardPile).toEqual(
      expect.arrayContaining([trap, discardA, discardB]),
    )
  })

  it('only offers traps whose energy color and quantity can be paid', () => {
    const trap: GameCard = {
      id: 'yellow-trap',
      instanceId: 'yellow-trap',
      name: '黃色陷阱',
      type: 'trap',
      officialType: 'trap',
      trap: {
        text: '{Y}{Y} The attacking Cookie deals -1 damage.',
        cost: { energy: { yellow: 2 }, discardHand: 0 },
        effects: [
          {
            kind: 'modify-attack',
            amount: -1,
            duration: 'this-turn',
            target: { side: 'opponent', min: 1, max: 1 },
          },
        ],
      },
    }
    let state = createBattleState()
    state.players['player-one'].hand = [
      trap,
      ...state.players['player-one'].hand,
    ]
    state = declareAttack(state)

    expect(getTrapCandidates(state, 'player-one')).toEqual([])

    state.players['player-one'].supportArea = [
      { card: item('yellow-support-a', 'yellow'), rested: false },
      { card: item('yellow-support-b', 'yellow'), rested: false },
    ]

    expect(getTrapCandidates(state, 'player-one')).toEqual([trap])
  })

  it('pays for one trap and applies attack reduction before damage', () => {
    const trap: GameCard = {
      id: 'red-trap',
      instanceId: 'red-trap',
      name: '減攻陷阱',
      type: 'trap',
      officialType: 'trap',
      energyColor: 'red',
      trap: {
        text: '《{R}》 Opponent Cookie deals -2 attack damage.',
        cost: { energy: { red: 1 }, discardHand: 0 },
        effects: [
          {
            kind: 'modify-attack',
            amount: -2,
            duration: 'this-turn',
            target: { side: 'opponent', min: 1, max: 1 },
          },
        ],
      },
    }
    let state = createBattleState()
    state.players['player-one'].hand = [
      trap,
      ...state.players['player-one'].hand,
    ]
    state = declareAttack(state)
    state = playTrap(state, 'player-one', {
      trapInstanceId: trap.instanceId,
      paymentIds: ['p1-support-a'],
      targetIds: ['attacker'],
    })

    expect(state.pendingBattle).toMatchObject({
      stage: 'damage',
      trapUsed: true,
      remainingDamage: 1,
    })
    expect(state.players['player-one'].discardPile).toContain(trap)
    expect(state.players['player-one'].supportArea[0].rested).toBe(true)
    expect(() =>
      playTrap(state, 'player-one', {
        trapInstanceId: trap.instanceId,
        paymentIds: [],
        targetIds: [],
      }),
    ).toThrow('Invalid battle action.')
  })

  it('skips attack damage when a trap knocks out the attacker', () => {
    const trap: GameCard = {
      id: 'damage-trap',
      instanceId: 'damage-trap',
      name: '反擊陷阱',
      type: 'trap',
      officialType: 'trap',
      trap: {
        text: 'Deal 1 damage.',
        cost: { energy: { red: 1 }, discardHand: 0 },
        effects: [
          {
            kind: 'damage',
            amount: 1,
            target: {
              side: 'opponent',
              min: 1,
              max: 1,
              remainingHp: 1,
            },
          },
        ],
      },
    }
    let state = createBattleState()
    state.players['player-one'].hand = [
      trap,
      ...state.players['player-one'].hand,
    ]
    state = declareAttack(state)
    state = playTrap(state, 'player-one', {
      trapInstanceId: trap.instanceId,
      paymentIds: ['p1-support-a'],
      targetIds: ['attacker'],
    })

    expect(state.pendingBattle).toMatchObject({
      damagePlayerId: 'player-two',
      damageTargetInstanceId: 'attacker',
      remainingDamage: 1,
      suspendedAttackDamage: 3,
    })

    state = resolveNextDamage(state)
    expect(state.players['player-two'].battleArea).toHaveLength(0)
    expect(state.pendingBattle).toBeNull()
  })

  it('skips attack damage after trap damage knocks out attacker with FLIP', () => {
    const attackerFlip: GameCard = {
      ...cookie('attacker-flip'),
      officialType: 'flip',
      flip: {
        text: 'Draw up to 1 card from your deck.',
        cost: { energy: {}, discardHand: 0 },
        effects: [{ kind: 'draw', amount: 1 }],
      },
    }
    const trap: GameCard = {
      id: 'flip-damage-trap',
      instanceId: 'flip-damage-trap',
      name: '翻牌反擊',
      type: 'trap',
      officialType: 'trap',
      trap: {
        text: 'Deal 1 damage.',
        cost: { energy: { red: 1 }, discardHand: 0 },
        effects: [
          {
            kind: 'damage',
            amount: 1,
            target: { side: 'opponent', min: 1, max: 1 },
          },
        ],
      },
    }
    let state = createBattleState()
    state.players['player-two'].battleArea[0].hpCards = [attackerFlip]
    state.players['player-one'].hand = [
      trap,
      ...state.players['player-one'].hand,
    ]
    state = playTrap(declareAttack(state), 'player-one', {
      trapInstanceId: trap.instanceId,
      paymentIds: ['p1-support-a'],
      targetIds: ['attacker'],
    })
    state = resolveNextDamage(state)

    expect(state.pendingBattle?.stage).toBe('flip')
    expect(state.pendingBattle?.damagePlayerId).toBe('player-two')

    state = resolveFlip(state, 'player-two', { activate: false })
    expect(state.pendingBattle).toBeNull()
  })

  it('prevents the protected target from reaching zero HP this battle', () => {
    const trap: GameCard = {
      id: 'guard-trap',
      instanceId: 'guard-trap',
      name: '守護陷阱',
      type: 'trap',
      officialType: 'trap',
      trap: {
        text: 'HP cannot reach 0 during this battle.',
        cost: { energy: { red: 1 }, discardHand: 0 },
        effects: [
          {
            kind: 'prevent-knockout',
            target: { side: 'self', min: 1, max: 1 },
          },
        ],
      },
    }
    let state = createBattleState()
    state.players['player-one'].battleArea[0].hpCards = [item('last-hp')]
    state.players['player-one'].hand = [
      trap,
      ...state.players['player-one'].hand,
    ]
    state = declareAttack(state)
    state = playTrap(state, 'player-one', {
      trapInstanceId: trap.instanceId,
      paymentIds: ['p1-support-a'],
      targetIds: ['defender'],
    })
    state = resolveNextDamage(state)

    expect(state.pendingBattle).toBeNull()
    expect(state.players['player-one'].battleArea[0].hpCards).toHaveLength(1)
  })

  it('resolves a faint-condition trap after battle damage', () => {
    const trap: GameCard = {
      id: 'faint-trap',
      instanceId: 'faint-trap',
      name: '昏厥後支援陷阱',
      type: 'trap',
      officialType: 'trap',
      trap: {
        text:
          'If any of your {G} Cookies fainted during this battle, take the top card from your deck and place it in your support area as rested.',
        cost: { energy: { red: 1 }, discardHand: 0 },
        condition: {
          kind: 'friendly-color-fainted-this-battle',
          color: 'green',
        },
        effects: [{ kind: 'deck-to-support', amount: 1, rested: true }],
      },
    }
    let state = createBattleState()
    state.players['player-one'].battleArea[0] = {
      ...state.players['player-one'].battleArea[0],
      card: {
        ...state.players['player-one'].battleArea[0].card,
        energyColor: 'green',
      },
      hpCards: [item('last-green-hp')],
    }
    state.players['player-one'].hand = [
      trap,
      ...state.players['player-one'].hand,
    ]
    state = playTrap(declareAttack(state), 'player-one', {
      trapInstanceId: trap.instanceId,
      paymentIds: ['p1-support-a'],
      targetIds: [],
    })
    state = resolveNextDamage(state)
    state = resolveNextDamage(state)

    expect(
      state.players['player-one'].supportArea.find(
        (support) => support.card.instanceId === 'p1-deck-a',
      ),
    ).toMatchObject({ rested: true })
  })

  it('prompts a BS2-049-like faint trap and resolves draw before discard', () => {
    const trap: GameCard = {
      id: 'BS2-049',
      instanceId: 'bs2-049-test',
      name: 'Salt Crystal Trident',
      type: 'trap',
      officialType: 'trap',
      trap: {
        text:
          'If 1 of your {B} Cookies faints during this battle, draw up to 3 cards from your deck and discard 1 card from your hand.',
        cost: { energy: { blue: 1 }, discardHand: 0 },
        condition: {
          kind: 'friendly-color-fainted-this-battle',
          color: 'blue',
        },
        effects: [
          { kind: 'draw-up-to', max: 3 },
          { kind: 'discard-hand', count: 1 },
        ],
      },
    }
    let state = createBattleState()
    state.players['player-one'].battleArea[0] = {
      ...state.players['player-one'].battleArea[0],
      card: {
        ...state.players['player-one'].battleArea[0].card,
        energyColor: 'blue',
      },
      hpCards: [item('last-blue-hp')],
    }
    state.players['player-one'].deck = [
      item('draw-1'),
      item('draw-2'),
      item('draw-3'),
    ]
    state.players['player-one'].hand = [
      trap,
      item('discard-option-a'),
      item('discard-option-b'),
    ]
    state.players['player-one'].supportArea = [
      { card: item('p1-support-blue', 'blue'), rested: false },
    ]

    state = declareAttack(state)

    expect(getTrapCandidates(state, 'player-one')).toContainEqual(trap)

    state = playTrap(state, 'player-one', {
      trapInstanceId: trap.instanceId,
      paymentIds: ['p1-support-blue'],
      targetIds: [],
    })
    state = resolveNextDamage(state)
    state = resolveNextDamage(state)

    expect(state.pendingDrawUpTo).toMatchObject({
      playerId: 'player-one',
      max: 3,
      sourceCardName: 'Salt Crystal Trident',
    })
    expect(state.pendingOpponentHandDiscard ?? null).toBeNull()

    state = resolveDrawUpTo(state, 'player-one', 2)

    expect(state.pendingDrawUpTo ?? null).toBeNull()
    expect(state.pendingOpponentHandDiscard).toMatchObject({
      playerId: 'player-one',
      count: 1,
      sourceCardName: 'Salt Crystal Trident',
    })
    expect(state.players['player-one'].hand).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ instanceId: 'draw-1' }),
        expect.objectContaining({ instanceId: 'draw-2' }),
      ]),
    )
  })

  it('lets the same player order simultaneous BS2-040 and BS2-049 effects', () => {
    const trap: GameCard = {
      id: 'BS2-049',
      instanceId: 'bs2-049-order',
      name: 'Salt Crystal Trident',
      type: 'trap',
      officialType: 'trap',
      trap: {
        text:
          'If 1 of your {B} Cookies faints during this battle, draw up to 3 cards from your deck and discard 1 card from your hand.',
        cost: { energy: { blue: 1 }, discardHand: 0 },
        condition: {
          kind: 'friendly-color-fainted-this-battle',
          color: 'blue',
        },
        effects: [
          { kind: 'draw-up-to', max: 3 },
          { kind: 'discard-hand', count: 1 },
        ],
      },
    }
    const aloe: CookieCard = {
      ...cookie('bs2-040-order', 1, 2),
      id: 'BS2-040',
      instanceId: 'defender',
      name: 'Aloe Cookie',
      energyColor: 'blue',
      skill: {
        trigger: 'passive',
        oncePerTurn: false,
        yourTurn: false,
        restSource: false,
        cost: {},
        text:
          'When this Cookie faints, view the top 3 cards of your deck. Select 1 {B} card.',
        effects: [
          {
            kind: 'inspect-deck',
            lookCount: 3,
            pickCount: 1,
            restDestination: 'bottom',
            filterColor: 'blue',
          },
        ],
        faint: true,
      },
    }

    let state = createBattleState()
    state.players['player-one'].battleArea[0] = {
      card: aloe,
      hpCards: [item('aloe-last-hp')],
      rested: false,
      battleEntryId: 'aloe:battle:1',
    }
    state.players['player-one'].deck = [
      item('top-blue', 'blue'),
      item('top-red', 'red'),
      item('top-blue-2', 'blue'),
      item('after-top', 'blue'),
    ]
    state.players['player-one'].hand = [
      trap,
      item('discard-option-a'),
      item('discard-option-b'),
    ]
    state.players['player-one'].supportArea = [
      { card: item('p1-support-blue', 'blue'), rested: false },
    ]

    state = declareAttack(state)
    state = playTrap(state, 'player-one', {
      trapInstanceId: trap.instanceId,
      paymentIds: ['p1-support-blue'],
      targetIds: [],
    })
    state = resolveNextDamage(state)

    const orderDecision = getPendingDecision(state)
    expect(orderDecision).toMatchObject({
      kind: 'effect-order',
      playerId: 'player-one',
    })
    if (orderDecision?.kind !== 'effect-order') {
      throw new Error('Expected effect-order decision')
    }
    expect(orderDecision.items.map((item) => item.kind)).toEqual(
      expect.arrayContaining(['faint-effect', 'draw-up-to']),
    )

    const faintFirstIds = [
      orderDecision.items.find((item) => item.kind === 'faint-effect')!.id,
      orderDecision.items.find((item) => item.kind === 'draw-up-to')!.id,
    ]
    const faintFirst = applyGameCommand(state, {
      kind: 'resolve-effect-order',
      playerId: 'player-one',
      orderedIds: faintFirstIds,
    })
    expect(getPendingDecision(faintFirst)?.kind).toBe('faint-effect')
    const afterFaint = applyGameCommand(faintFirst, {
      kind: 'resolve-faint-effect',
      playerId: 'player-one',
      targetIds: [],
    })
    expect(getPendingDecision(afterFaint)?.kind).toBe('inspect-deck')

    const drawFirst = applyGameCommand(state, {
      kind: 'resolve-effect-order',
      playerId: 'player-one',
      orderedIds: [...faintFirstIds].reverse(),
    })
    expect(getPendingDecision(drawFirst)?.kind).toBe('draw-up-to')
  })

  it('skips attack damage when official ST1-021 trap knocks out official ST1-013 attacker', () => {
    const p1Deck = createOfficialRedStarterDeck('player-one')
    const p2Deck = createOfficialRedStarterDeck('player-two')

    const defenderCard = p1Deck.find((c) => c.id === 'ST1-014') as CookieCard
    const attackerCard = p2Deck.find((c) => c.id === 'ST1-013') as CookieCard
    const trapCard = p1Deck.find((c) => c.id === 'ST1-021')!

    expect(defenderCard).toBeDefined()
    expect(attackerCard).toBeDefined()
    expect(trapCard).toBeDefined()
    expect(attackerCard.hp).toBe(1)
    expect(attackerCard.flip).toBeDefined()
    expect(trapCard.trap?.effects[0]).toMatchObject({
      kind: 'damage',
      amount: 1,
      target: { side: 'opponent', remainingHp: 1 },
    })

    const defenderHpCards = Array.from({ length: 6 }, (_, i) =>
      item(`defender-hp-${i}`, 'red'),
    )
    const attackerHpCards = [item('attacker-hp-0', 'red')]

    const state: GameState = {
      players: {
        'player-one': {
          id: 'player-one',
          name: 'P1',
          deck: [item('p1-deck-a'), item('p1-deck-b')],
          hand: [trapCard, cookie('p1-replacement')],
          battleArea: [
            {
              card: defenderCard,
              hpCards: defenderHpCards,
              rested: false,
              battleEntryId: 'defender:battle:1',
            },
          ],
          supportArea: [
            { card: item('p1-support-a', 'red'), rested: false },
            { card: item('p1-support-b', 'red'), rested: false },
          ],
          breakArea: [],
          discardPile: [],
          stage: null,
          hasMulliganed: false,
          startingCookieSelected: true,
        },
        'player-two': {
          id: 'player-two',
          name: 'P2',
          deck: [item('p2-deck-a')],
          hand: [cookie('p2-replacement')],
          battleArea: [
            {
              card: attackerCard,
              hpCards: attackerHpCards,
              rested: false,
              battleEntryId: 'attacker:battle:2',
            },
          ],
          supportArea: [
            { card: item('p2-support', 'red'), rested: false },
          ],
          breakArea: [],
          discardPile: [],
          stage: null,
          hasMulliganed: false,
          startingCookieSelected: true,
        },
      },
      firstPlayerId: 'player-one',
      activePlayerId: 'player-two',
      turnNumber: 2,
      phase: 'main',
      status: 'playing',
      result: null,
      supportPlacedThisTurn: false,
      skillUsesThisTurn: [],
      nextBattleEntrySequence: 3,
      attackModifiers: [],
      damageReceivedModifiers: [],
      pendingReplacement: null,
      departedCookieCounts: { 'player-one': 0, 'player-two': 0 },
      pendingRefresh: null,
      pendingBattle: null,
    }

    let battleState = beginAttack(
      state,
      attackerCard.instanceId,
      defenderCard.instanceId,
      ['p2-support'],
    )

    battleState = playTrap(battleState, 'player-one', {
      trapInstanceId: trapCard.instanceId,
      paymentIds: ['p1-support-a', 'p1-support-b'],
      targetIds: [attackerCard.instanceId],
    })

    expect(battleState.pendingBattle).toMatchObject({
      stage: 'damage',
      damagePlayerId: 'player-two',
      damageTargetInstanceId: attackerCard.instanceId,
      remainingDamage: 1,
    })
    expect(battleState.pendingBattle?.suspendedAttackDamage).toBeDefined()

    battleState = resolveNextDamage(battleState)

    expect(battleState.pendingBattle).toBeNull()
    expect(battleState.players['player-two'].battleArea).toHaveLength(0)
    expect(
      battleState.players['player-one'].battleArea[0].hpCards.length,
    ).toBe(6)
  })

  // 迴歸測試：對手有多隻餅乾時，減攻擊類陷阱的目標必須是「當前攻擊者」，
  // 而非戰鬥區的第一隻餅乾，否則傷害不會被減少（看似「陷阱沒效果」）。
  it('targets the actual attacker (not the first cookie) when the AI defends with a modify-attack trap', () => {
    const modifyTrap: GameCard = {
      id: 'modify-trap',
      instanceId: 'modify-trap',
      name: 'Modify Trap',
      type: 'trap',
      officialType: 'trap',
      energyColor: 'blue',
      trap: {
        text: 'Select up to 1 opponent Cookie. It deals -3 attack this turn.',
        cost: { energy: {}, discardHand: 0 },
        effects: [
          {
            kind: 'modify-attack',
            amount: -3,
            duration: 'this-turn',
            target: { side: 'opponent', min: 0, max: 1 },
          },
        ],
      },
    }

    // player-one 攻擊，戰鬥區有兩隻餅乾：'other'（第一隻）與 'atk'（實際攻擊者，第二隻）
    const state: GameState = {
      ...createBattleState(),
      activePlayerId: 'player-one',
      players: {
        'player-one': {
          id: 'player-one',
          name: '攻擊玩家',
          deck: [item('p1-deck')],
          hand: [],
          battleArea: [
            {
              card: cookie('other', 3, 2),
              hpCards: [item('other-hp')],
              rested: false,
              battleEntryId: 'other:battle:1',
            },
            {
              card: cookie('atk', 3, 2),
              hpCards: [item('atk-hp')],
              rested: true,
              battleEntryId: 'atk:battle:2',
            },
          ],
          supportArea: [],
          breakArea: [],
          discardPile: [],
          stage: null,
          hasMulliganed: false,
          startingCookieSelected: true,
        },
        'player-two': {
          id: 'player-two',
          name: '防守 AI',
          deck: [item('p2-deck')],
          hand: [modifyTrap],
          battleArea: [
            {
              card: cookie('p2-def', 1, 3),
              hpCards: [item('d-a'), item('d-b'), item('d-c')],
              rested: false,
              battleEntryId: 'p2-def:battle:1',
            },
          ],
          supportArea: [{ card: item('p2-s', 'blue'), rested: false }],
          breakArea: [],
          discardPile: [],
          stage: null,
          hasMulliganed: false,
          startingCookieSelected: true,
        },
      },
      pendingBattle: {
        attackerPlayerId: 'player-one',
        defenderPlayerId: 'player-two',
        attackerInstanceId: 'atk',
        targetInstanceId: 'p2-def',
        declaredDamage: 3,
        remainingDamage: 3,
        stage: 'trap',
        trapUsed: false,
        revealedHpCard: null,
        preventKnockoutTargetIds: [],
        faintedColors: [],
        attackEffects: [],
        attackEffectIndex: 0,
      },
    }

    const decision = takeAiStep(state, 'player-two')

    expect(decision.action).toBe('play-trap')
    // 減攻擊修正必須套用在實際攻擊者 'atk' 上
    const modifier = decision.state.attackModifiers.find(
      (m) => m.sourceInstanceId === 'modify-trap',
    )
    expect(modifier?.targetInstanceId).toBe('atk')
    // 傷害因此由 3 降到 0
    expect(decision.state.pendingBattle?.declaredDamage).toBe(0)
  })
})

describe('R15: trap multi-effect targeting (BS2-079)', () => {
  const modifyAttackAndTrashToDeckTrap = (): GameCard => ({
    id: 'BS2-079',
    instanceId: 'bs2-079-test',
    name: 'Two-Effect Trap',
    type: 'trap',
    officialType: 'trap',
    trap: {
      text: '《{P}》 Select up to 1 of your opponent\'s Cookies. During this turn, that Cookie deals -1 attack damage. Select up to 5 non-FLIP cards in your trash. Shuffle them into your deck.',
      cost: { energy: { purple: 1 }, discardHand: 0 },
      effects: [
        {
          kind: 'modify-attack',
          amount: -1,
          duration: 'this-turn',
          target: { side: 'opponent', min: 0, max: 1 },
        },
        { kind: 'trash-to-deck', max: 5, excludeFlip: true },
      ],
    },
  })

  it('lets the modify-attack target and the trash-to-deck selection be chosen independently via trashToDeckIds', () => {
    const trap = modifyAttackAndTrashToDeckTrap()
    let state = createBattleState()
    state.players['player-one'].hand = [trap, ...state.players['player-one'].hand]
    state.players['player-one'].supportArea = [
      { card: item('p1-purple', 'purple'), rested: false },
    ]
    state.players['player-one'].discardPile = [
      item('p1-trash-1'),
      item('p1-trash-2'),
      item('p1-trash-3'),
    ]
    state = declareAttack(state)

    const result = playTrap(state, 'player-one', {
      trapInstanceId: trap.instanceId,
      paymentIds: ['p1-purple'],
      targetIds: ['attacker'],
      trashToDeckIds: ['p1-trash-1', 'p1-trash-2'],
    })

    // 第一段效果：修改攻擊者傷害，目標來自 targetIds
    expect(result.attackModifiers).toContainEqual(
      expect.objectContaining({ targetInstanceId: 'attacker', amount: -1 }),
    )

    // 第二段效果：洗回牌庫，選擇對象來自獨立的 trashToDeckIds，
    // 不受第一段 targetIds（攻擊者，不在棄牌區合法範圍內）影響。
    const player = result.players['player-one']
    // 陷阱卡本身結算後也會進入棄牌區，一併出現在結果中。
    expect(player.discardPile.map((card) => card.instanceId)).toEqual([
      'p1-trash-3',
      trap.instanceId,
    ])
    expect(
      player.deck.some((card) => card.instanceId === 'p1-trash-1'),
    ).toBe(true)
    expect(
      player.deck.some((card) => card.instanceId === 'p1-trash-2'),
    ).toBe(true)
  })

  it('leaves the trash pile untouched when trashToDeckIds is omitted (no silent forced discard)', () => {
    const trap = modifyAttackAndTrashToDeckTrap()
    let state = createBattleState()
    state.players['player-one'].hand = [trap, ...state.players['player-one'].hand]
    state.players['player-one'].supportArea = [
      { card: item('p1-purple', 'purple'), rested: false },
    ]
    state.players['player-one'].discardPile = [item('p1-trash-1')]
    state = declareAttack(state)

    const result = playTrap(state, 'player-one', {
      trapInstanceId: trap.instanceId,
      paymentIds: ['p1-purple'],
      targetIds: ['attacker'],
    })

    expect(
      result.players['player-one'].discardPile.map((card) => card.instanceId),
    ).toEqual(['p1-trash-1', trap.instanceId])
  })

  it('AI defender fills both effects independently: attacker takes modify-attack, own trash feeds trash-to-deck', () => {
    const trap = modifyAttackAndTrashToDeckTrap()

    const state: GameState = {
      ...createBattleState(),
      activePlayerId: 'player-one',
      players: {
        'player-one': {
          id: 'player-one',
          name: '攻擊玩家',
          deck: [item('p1-deck')],
          hand: [],
          battleArea: [
            {
              card: cookie('atk', 3, 2),
              hpCards: [item('atk-hp')],
              rested: true,
              battleEntryId: 'atk:battle:1',
            },
          ],
          supportArea: [],
          breakArea: [],
          discardPile: [],
          stage: null,
          hasMulliganed: false,
          startingCookieSelected: true,
        },
        'player-two': {
          id: 'player-two',
          name: '防守 AI',
          deck: [item('p2-deck')],
          hand: [trap],
          battleArea: [
            {
              card: cookie('p2-def', 1, 3),
              hpCards: [item('d-a'), item('d-b'), item('d-c')],
              rested: false,
              battleEntryId: 'p2-def:battle:1',
            },
          ],
          supportArea: [{ card: item('p2-s', 'purple'), rested: false }],
          breakArea: [],
          discardPile: [item('p2-trash-1'), item('p2-trash-2')],
          stage: null,
          hasMulliganed: false,
          startingCookieSelected: true,
        },
      },
      pendingBattle: {
        attackerPlayerId: 'player-one',
        defenderPlayerId: 'player-two',
        attackerInstanceId: 'atk',
        targetInstanceId: 'p2-def',
        declaredDamage: 3,
        remainingDamage: 3,
        stage: 'trap',
        trapUsed: false,
        revealedHpCard: null,
        preventKnockoutTargetIds: [],
        faintedColors: [],
        attackEffects: [],
        attackEffectIndex: 0,
      },
    }

    const decision = takeAiStep(state, 'player-two')

    expect(decision.action).toBe('play-trap')
    // 第一段效果：套用在實際攻擊者身上（沿用既有攻擊者鎖定邏輯）
    const modifier = decision.state.attackModifiers.find(
      (m) => m.sourceInstanceId === trap.instanceId,
    )
    expect(modifier?.targetInstanceId).toBe('atk')
    // 第二段效果：AI 自己選了 trashToDeckIds，把自己的棄牌區卡片洗回牌庫，
    // 不會因為與第一段共用 targetIds（攻擊者，不在棄牌區合法範圍）而靜默失敗。
    const defenderAfter = decision.state.players['player-two']
    expect(defenderAfter.discardPile.map((card) => card.instanceId)).toEqual([
      trap.instanceId,
    ])
    expect(
      defenderAfter.deck.some((card) => card.instanceId === 'p2-trash-1'),
    ).toBe(true)
    expect(
      defenderAfter.deck.some((card) => card.instanceId === 'p2-trash-2'),
    ).toBe(true)
  })
})

describe('BS6-106 Peak Engineer Performance: trap Then selection', () => {
  const bs6106Trap = (): GameCard => ({
    id: 'BS6-106',
    instanceId: 'bs6-106-test',
    name: 'Peak Engineer Performance',
    type: 'trap',
    officialType: 'trap',
    energyColor: 'purple',
    trap: {
      text: 'Select up to 1 opponent Cookie. It gets -1 attack damage. Then, play up to 1 purple Cookie with 2 or less HP from your trash.',
      cost: { energy: { purple: 2 }, discardHand: 0 },
      effects: [
        {
          kind: 'modify-attack',
          amount: -1,
          duration: 'this-turn',
          target: { side: 'opponent', min: 0, max: 1 },
        },
        {
          kind: 'trash-to-battle',
          amount: 1,
          optional: true,
          energyColor: 'purple',
          maxHp: 2,
        },
      ],
    },
  })

  const createBs6106State = () => {
    const trap = bs6106Trap()
    const eligible = {
      ...cookie('bs6-106-purple-hp2', 1, 2),
      energyColor: 'purple' as const,
    }
    let state = createBattleState()
    state.players['player-one'].hand = [trap]
    state.players['player-one'].supportArea = [
      { card: item('p1-purple-a', 'purple'), rested: false },
      { card: item('p1-purple-b', 'purple'), rested: false },
    ]
    state.players['player-one'].deck = [
      item('p1-deck-a'),
      item('p1-deck-b'),
      item('p1-deck-c'),
    ]
    state.players['player-one'].discardPile = [eligible]
    state = declareAttack(state)
    return { state, trap, eligible }
  }

  it('keeps the battle pending while the defender selects the optional trash Cookie', () => {
    const { state, trap, eligible } = createBs6106State()

    const afterTrap = playTrap(state, 'player-one', {
      trapInstanceId: trap.instanceId,
      paymentIds: ['p1-purple-a', 'p1-purple-b'],
      targetIds: ['attacker'],
    })

    expect(afterTrap.attackModifiers).toContainEqual(
      expect.objectContaining({ targetInstanceId: 'attacker', amount: -1 }),
    )
    expect(afterTrap.pendingBattle?.stage).toBe('trap')
    expect(afterTrap.pendingAbilityEffect).toMatchObject({
      playerId: 'player-one',
      sourceKind: 'trap',
      effectIndex: 1,
      battleContinuation: 'after-trap',
    })

    const resolved = applyGameCommand(afterTrap, {
      kind: 'resolve-ability-effect',
      playerId: 'player-one',
      targetIds: [eligible.instanceId],
    })

    expect(resolved.pendingAbilityEffect).toBeUndefined()
    expect(resolved.players['player-one'].battleArea).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          card: expect.objectContaining({ instanceId: eligible.instanceId }),
          hpCards: expect.arrayContaining([
            expect.objectContaining({ instanceId: 'p1-deck-a' }),
          ]),
        }),
      ]),
    )
    expect(
      resolved.players['player-one'].discardPile.some(
        (card) => card.instanceId === eligible.instanceId,
      ),
    ).toBe(false)
    expect(resolved.pendingBattle).toMatchObject({
      stage: 'damage',
      declaredDamage: 2,
      remainingDamage: 2,
    })
  })

  it('allows skipping the optional trash Cookie while preserving the first effect and battle flow', () => {
    const { state, trap, eligible } = createBs6106State()
    const afterTrap = playTrap(state, 'player-one', {
      trapInstanceId: trap.instanceId,
      paymentIds: ['p1-purple-a', 'p1-purple-b'],
      targetIds: ['attacker'],
    })

    const skipped = applyGameCommand(afterTrap, {
      kind: 'resolve-ability-effect',
      playerId: 'player-one',
      targetIds: [],
    })

    expect(skipped.pendingAbilityEffect).toBeUndefined()
    expect(skipped.attackModifiers).toContainEqual(
      expect.objectContaining({ targetInstanceId: 'attacker', amount: -1 }),
    )
    expect(skipped.players['player-one'].discardPile).toContainEqual(eligible)
    expect(skipped.pendingBattle).toMatchObject({
      stage: 'damage',
      declaredDamage: 2,
      remainingDamage: 2,
    })
  })
})

describe('trap choose-one continuation', () => {
  it('lets AI expand and resolve a choose-one trap before damage', () => {
    const trap: GameCard = {
      id: 'BS6-choose-one-trap',
      instanceId: 'bs6-choose-one-trap',
      name: 'Choose One Trap',
      type: 'trap',
      officialType: 'trap',
      trap: {
        text: 'Choose one.',
        cost: { energy: {}, discardHand: 0 },
        effects: [
          {
            kind: 'choose-one',
            modes: [
              {
                label: 'Reduce attack',
                effects: [
                  {
                    kind: 'modify-attack',
                    amount: -1,
                    duration: 'this-turn',
                    target: { side: 'opponent', min: 0, max: 1 },
                  },
                ],
              },
              { label: 'Do nothing', effects: [] },
            ],
          },
        ],
      },
    }
    let state = createBattleState()
    state.players['player-one'].hand = [trap]
    state = declareAttack(state)

    const played = takeAiStep(state, 'player-one')
    expect(played.action).toBe('play-trap')
    expect(played.state.pendingAbilityEffect).toMatchObject({
      sourceKind: 'trap',
      effectIndex: 0,
      battleContinuation: 'after-trap',
    })

    const modeResolved = takeAiStep(played.state, 'player-one')
    expect(modeResolved.action).toBe('idle')
    // AI 可能選到「不執行」模式；該模式沒有子效果，展開後應直接
    // 清空佇列；下一個 AI step 會沿用陷阱回應流程收尾並進入傷害階段，
    // 不得留下卡死的 pending。
    expect(modeResolved.state.pendingAbilityEffect).toBeUndefined()

    const continued = takeAiStep(modeResolved.state, 'player-one')
    expect(continued.state.pendingAbilityEffect).toBeUndefined()
    expect(continued.state.pendingBattle?.stage).toBe('damage')
    expect(continued.state.pendingBattle?.declaredDamage).toBe(3)
  })
})

describe('BS3-021 Oath on the Shield: modify-attack + self-damage', () => {
  const bs3021Trap = (): GameCard => ({
    id: 'BS3-021',
    instanceId: 'bs3-021-test',
    name: 'Oath on the Shield',
    type: 'trap',
    officialType: 'trap',
    trap: {
      text: 'Select up to 1 of your opponent\'s Cookies. During this turn, that Cookie deals -3 attack damage. Then, select 1 of your Cookies. That Cookie receives 1 damage.',
      cost: { energy: { red: 2 }, discardHand: 0 },
      effects: [
        {
          kind: 'modify-attack',
          amount: -3,
          duration: 'this-turn',
          target: { side: 'opponent', min: 0, max: 1 },
        },
        {
          kind: 'damage',
          amount: 1,
          target: { side: 'self', min: 1, max: 1 },
        },
      ],
    },
  })

  it('reduces attacker attack by 3 and damages own cookie when both targets provided', () => {
    const trap = bs3021Trap()
    let state = createBattleState()
    state.players['player-one'].hand = [
      trap,
      ...state.players['player-one'].hand,
    ]
    state.players['player-one'].supportArea = [
      { card: item('p1-red-1', 'red'), rested: false },
      { card: item('p1-red-2', 'red'), rested: false },
    ]
    state.players['player-one'].battleArea[0].hpCards = [
      item('self-hp-1'),
      item('self-hp-2'),
      item('self-hp-3'),
    ]
    state = declareAttack(state)

    const result = playTrap(state, 'player-one', {
      trapInstanceId: trap.instanceId,
      paymentIds: ['p1-red-1', 'p1-red-2'],
      targetIds: ['attacker'],
      selfTargetIds: ['defender'],
    })

    expect(result.attackModifiers).toContainEqual(
      expect.objectContaining({ targetInstanceId: 'attacker', amount: -3 }),
    )
    expect(result.pendingBattle?.stage).toBe('damage')
    expect(result.pendingBattle?.damageTargetInstanceId).toBe('defender')
    expect(result.pendingBattle?.remainingDamage).toBe(1)
  })

  it('still applies modify-attack even without selfTargetIds (backward compatible)', () => {
    const trap = bs3021Trap()
    let state = createBattleState()
    state.players['player-one'].hand = [
      trap,
      ...state.players['player-one'].hand,
    ]
    state.players['player-one'].supportArea = [
      { card: item('p1-red-1', 'red'), rested: false },
      { card: item('p1-red-2', 'red'), rested: false },
    ]
    state = declareAttack(state)

    const result = playTrap(state, 'player-one', {
      trapInstanceId: trap.instanceId,
      paymentIds: ['p1-red-1', 'p1-red-2'],
      targetIds: ['attacker'],
    })

    expect(result.attackModifiers).toContainEqual(
      expect.objectContaining({ targetInstanceId: 'attacker', amount: -3 }),
    )
  })
})

describe('BS6-020 Tonic Spray: selectable self HP return', () => {
  const tonicSprayTrap = (): GameCard => ({
    id: 'BS6-020',
    instanceId: 'bs6-020-test',
    name: 'Tonic Spray',
    type: 'trap',
    officialType: 'trap',
    trap: {
      text: "Select up to 1 of your opponent's Cookies. During this turn, that Cookie deals -2 attack damage. Then, return up to 1 card from the top of your Cookie's HP to your hand.",
      cost: { energy: { red: 2 }, discardHand: 0 },
      effects: [
        {
          kind: 'modify-attack',
          amount: -2,
          duration: 'this-turn',
          target: { side: 'opponent', min: 0, max: 1 },
        },
        {
          kind: 'hp-to-hand',
          amount: 1,
          target: { side: 'self', min: 0, max: 1 },
        },
      ],
    },
  })

  it('exposes own Cookies as selectable self targets', () => {
    const trap = tonicSprayTrap()
    let state = createBattleState()
    state.players['player-one'].hand = [trap]
    state = declareAttack(state)

    expect(
      getTrapSelfTargetCandidates(
        state,
        'player-one',
        trap.instanceId,
      ).map((candidate) => candidate.card.instanceId),
    ).toEqual(['defender'])
  })

  it('returns the selected Cookie top HP card, while allowing the optional effect to be skipped', () => {
    const trap = tonicSprayTrap()
    let state = createBattleState()
    state.players['player-one'].hand = [trap]
    state.players['player-one'].supportArea = [
      { card: item('p1-red-1', 'red'), rested: false },
      { card: item('p1-red-2', 'red'), rested: false },
    ]
    state.players['player-one'].battleArea[0].hpCards = [
      item('self-hp-1'),
      item('self-hp-2'),
    ]
    state = declareAttack(state)

    const selected = playTrap(state, 'player-one', {
      trapInstanceId: trap.instanceId,
      paymentIds: ['p1-red-1', 'p1-red-2'],
      targetIds: ['attacker'],
      selfTargetIds: ['defender'],
    })
    expect(selected.players['player-one'].hand.map((card) => card.instanceId)).toContain(
      'self-hp-2',
    )
    expect(
      selected.players['player-one'].battleArea[0].hpCards.map(
        (card) => card.instanceId,
      ),
    ).toEqual(['self-hp-1'])

    const skippedState = createBattleState()
    skippedState.players['player-one'].hand = [trap]
    skippedState.players['player-one'].supportArea = [
      { card: item('p1-red-1', 'red'), rested: false },
      { card: item('p1-red-2', 'red'), rested: false },
    ]
    skippedState.players['player-one'].battleArea[0].hpCards = [
      item('self-hp-1'),
      item('self-hp-2'),
    ]
    const declaredSkippedState = declareAttack(skippedState)
    const skipped = playTrap(declaredSkippedState, 'player-one', {
      trapInstanceId: trap.instanceId,
      paymentIds: ['p1-red-1', 'p1-red-2'],
      targetIds: ['attacker'],
      selfTargetIds: [],
    })
    expect(
      skipped.players['player-one'].battleArea[0].hpCards.map(
        (card) => card.instanceId,
      ),
    ).toEqual(['self-hp-1', 'self-hp-2'])
  })
})

describe('BS1-050 Broken Signpost: redirect-attack self target', () => {
  it('redirects attack to a self cookie using selfTargetIds', () => {
    const trap: GameCard = {
      id: 'BS1-050',
      instanceId: 'bs1-050-test',
      name: 'Broken Signpost',
      type: 'trap',
      officialType: 'trap',
      trap: {
        text: 'Redirect',
        cost: { energy: {}, discardHand: 0 },
        effects: [
          {
            kind: 'redirect-attack',
            target: { side: 'self', min: 1, max: 1, excludeAttackTarget: true },
          },
        ],
      },
    }
    let state = createBattleState()
    state.players['player-one'].hand = [
      trap,
      ...state.players['player-one'].hand,
    ]
    state.players['player-one'].battleArea.push({
      card: cookie('redirect-target', 1, 3),
      hpCards: [item('rt-hp')],
      rested: false,
      battleEntryId: 'redirect-target:battle:1',
    })
    state = declareAttack(state)

    const result = playTrap(state, 'player-one', {
      trapInstanceId: trap.instanceId,
      paymentIds: [],
      targetIds: [],
      selfTargetIds: ['redirect-target'],
    })

    expect(result.pendingBattle?.targetInstanceId).toBe('redirect-target')
  })

  it('BS3-021 modify-attack -3 actually reduces attack damage to 0 when attacker has 2', () => {
    const trap: GameCard = {
      id: 'BS3-021',
      instanceId: 'bs3-021-test',
      name: 'Oath on the Shield',
      type: 'trap',
      officialType: 'trap',
      trap: {
        text: '-3 this turn; deal 1 to 1 of your Cookies',
        cost: { energy: {}, discardHand: 0 },
        effects: [
          {
            kind: 'modify-attack',
            amount: -3,
            duration: 'this-turn',
            target: { side: 'opponent', min: 0, max: 1 },
          },
          {
            kind: 'damage',
            amount: 1,
            target: { side: 'self', min: 1, max: 1 },
          },
        ],
      },
    }
    let state = createBattleState()
    state.players['player-two'].battleArea[0].card = {
      ...state.players['player-two'].battleArea[0].card,
      attack: 2,
    } as CookieCard

    state.players['player-one'].hand = [
      trap,
      ...state.players['player-one'].hand,
    ]

    const attackerInstanceId = state.players['player-two'].battleArea[0].card.instanceId
    const targetCookie = state.players['player-one'].battleArea[0]

    state = declareAttack(state)
    expect(state.pendingBattle?.stage).toBe('trap')

    let result = playTrap(state, 'player-one', {
      trapInstanceId: trap.instanceId,
      paymentIds: [],
      targetIds: [attackerInstanceId],
      selfTargetIds: [targetCookie.card.instanceId],
    })

    expect(result.pendingBattle?.stage).toBe('damage')
    expect(result.pendingBattle?.remainingDamage).toBe(1)
    expect(result.pendingBattle?.suspendedAttackDamage).toBeDefined()

    while (
      result.pendingBattle &&
      result.pendingBattle.stage === 'damage' &&
      result.pendingBattle.remainingDamage > 0
    ) {
      result = resolveNextDamage(result)
    }

    expect(result.pendingBattle?.suspendedAttackDamage).toBeUndefined()

    const finalDamage = result.pendingBattle?.remainingDamage ?? 0
    expect(finalDamage).toBe(0)
  })
})

/**
 * 既有 bug（跟本次任何一張卡的文字轉換修正無關，是稽核 BS3 卡牌時意外發現
 * 的 AI 陷阱決策/執行路徑問題）：像 BS3-070 這種一次帶多個子效果、各自有
 * 自己 condition 的陷阱（例如 draw-up-to／discard-hand 都掛「支援區至少
 * 5 張」），playTrap 對落到 fallback 分支（非 support-to-trash／
 * prevent-knockout／support-to-hand／hand-to-support／redirect-attack／
 * damage／trash-to-deck 這些特別處理過的效果種類）的效果會直接呼叫
 * executeCardEffect，而它內部的 assertCondition 在條件不成立時會直接拋錯，
 * 不是優雅跳過——導致玩家/AI 支援區不夠時，整個 playTrap（包含前面已經生效
 * 的 modify-attack）都會連帶失敗。用 BS3 Green Lily 牌組 Lv.4 AI 互打
 * 60 個種子可以穩定重現：防守方在 pendingBattle.stage === 'trap' 時踩到
 * 這個錯誤，AI 判定為 stuck，整場模擬卡死不動。
 */
describe('BS3-070-like traps: condition-gated sub-effects should be skipped, not thrown', () => {
  const puppetTheater = (): GameCard => ({
    id: 'BS3-070',
    instanceId: 'bs3-070-test',
    name: 'Puppet Theater of Chaos',
    type: 'trap',
    officialType: 'trap',
    energyColor: 'green',
    trap: {
      text: 'test',
      cost: { energy: { green: 1 }, discardHand: 0 },
      effects: [
        {
          kind: 'modify-attack',
          amount: -1,
          duration: 'this-turn',
          target: { side: 'opponent', min: 0, max: 2 },
        },
        {
          kind: 'draw-up-to',
          max: 2,
          condition: { kind: 'support-count-at-least', count: 5 },
        },
        {
          kind: 'discard-hand',
          count: 1,
          condition: { kind: 'support-count-at-least', count: 5 },
        },
      ],
    },
  })

  it('skips condition-not-met sub-effects instead of throwing, while still applying the rest', () => {
    const trapCard = puppetTheater()
    let state = createBattleState()
    state.players['player-one'].hand = [trapCard]
    state.players['player-one'].supportArea = [
      { card: item('p1-green-a', 'green'), rested: false },
    ]
    state = declareAttack(state)

    const result = playTrap(state, 'player-one', {
      trapInstanceId: trapCard.instanceId,
      paymentIds: ['p1-green-a'],
      targetIds: ['attacker'],
    })
    expect(result.status).toBe('playing')
    expect(result.attackModifiers).toContainEqual(
      expect.objectContaining({ sourceInstanceId: trapCard.instanceId, amount: -1 }),
    )
    expect(result.pendingDrawUpTo).toBeUndefined()
  })

  it('still applies condition-met sub-effects normally', () => {
    const trapCard = puppetTheater()
    let state = createBattleState()
    state.players['player-one'].hand = [trapCard]
    state.players['player-one'].supportArea = [
      { card: item('p1-green-a', 'green'), rested: false },
      { card: item('p1-green-b', 'green'), rested: false },
      { card: item('p1-green-c', 'green'), rested: false },
      { card: item('p1-green-d', 'green'), rested: false },
      { card: item('p1-green-e', 'green'), rested: false },
    ]
    state = declareAttack(state)

    const result = playTrap(state, 'player-one', {
      trapInstanceId: trapCard.instanceId,
      paymentIds: ['p1-green-a'],
      targetIds: ['attacker'],
    })
    expect(result.status).toBe('playing')
    expect(result.attackModifiers).toContainEqual(
      expect.objectContaining({ sourceInstanceId: trapCard.instanceId, amount: -1 }),
    )
    expect(result.pendingDrawUpTo).toBeDefined()
  })
})

/**
 * `[auto-skip-trap]` 的診斷示警原本只要「手上有陷阱卡卻沒有候選」就印，於是
 * 每次被攻擊而付不出代價都會噴一則假警報——被攻擊時支援卡多半還橫置著
 * （支援區要到自己回合的活躍階段才重置），這是日常狀況而非 bug。
 * explainUnavailableTraps 要能把這些日常情形明確歸因，示警才只會在真正
 * 無法解釋時出現。
 */
describe('explainUnavailableTraps', () => {
  const blueTrap = (instanceId: string, energy: number): GameCard => ({
    id: 'BS3-094',
    instanceId,
    name: 'Radiant Coronation',
    type: 'trap',
    officialType: 'trap',
    energyColor: 'blue',
    trap: {
      text: '<{B}{B}> 對手餅乾攻擊力 -2。',
      cost: { energy: { blue: energy }, discardHand: 0 },
      effects: [
        {
          kind: 'modify-attack',
          amount: -2,
          duration: 'this-turn',
          target: { side: 'opponent', min: 0, max: 1 },
        },
      ],
    },
  })

  const trapStageState = (): GameState => {
    const state = createBattleState()
    state.players['player-one'].hand = [blueTrap('trap-1', 2)]
    return declareAttack(state)
  }

  it('allows P-082 alternative payment by moving a valid trash Cookie to the break area', () => {
    const trap: GameCard = {
      id: 'P-082',
      instanceId: 'p-082-test',
      name: 'Sugar Gnome Cake Shop',
      type: 'trap',
      trap: {
        text: 'Pay {Y}{N} or place a non-FLIP Cookie with 1 HP from your trash into your break area. Gain +2 HP to one of your Cookies, then gain +2 HP to one opponent Cookie.',
        cost: { energy: { yellow: 1, neutral: 1 } },
        alternativeCosts: [
          {
            energy: {},
            trashCookieToBreakArea: {
              count: 1,
              hp: 1,
              excludeFlip: true,
            },
          },
        ],
        effects: [
          { kind: 'gain-hp', amount: 2, target: { side: 'self', min: 1, max: 1 } },
          { kind: 'gain-hp', amount: 2, target: { side: 'opponent', min: 1, max: 1 } },
        ],
      },
    }
    const alternativeCookie: CookieCard = {
      ...cookie('p-082-payment-cookie', 1, 1),
    }
    let state = createBattleState()
    state.players['player-one'].hand = [trap]
    state.players['player-one'].deck = [
      item('p1-p-082-deck-a'),
      item('p1-p-082-deck-b'),
      item('p1-p-082-deck-c'),
    ]
    state.players['player-two'].deck = [
      item('p2-p-082-deck-a'),
      item('p2-p-082-deck-b'),
    ]
    state.players['player-one'].discardPile = [alternativeCookie]
    state = declareAttack(state)

    expect(getTrapCandidates(state, 'player-one')).toEqual([trap])
    expect(
      getTrapTargetCandidates(state, 'player-one', trap.instanceId).map(
        (cookie) => cookie.card.instanceId,
      ),
    ).toEqual(['attacker'])
    expect(
      getTrapSelfTargetCandidates(state, 'player-one', trap.instanceId).map(
        (cookie) => cookie.card.instanceId,
      ),
    ).toEqual(['defender'])

    const result = playTrap(state, 'player-one', {
      trapInstanceId: trap.instanceId,
      costOptionIndex: 1,
      paymentIds: [],
      trashCookieToBreakAreaIds: [alternativeCookie.instanceId],
      targetIds: ['attacker'],
      selfTargetIds: ['defender'],
    })

    expect(result.players['player-one'].breakArea).toContainEqual(alternativeCookie)
    expect(result.players['player-one'].discardPile).not.toContainEqual(alternativeCookie)
    expect(result.players['player-one'].supportArea.every((support) => !support.rested)).toBe(true)
    expect(result.pendingBattle?.trapUsed).toBe(true)
  })

  it('requires the trap owner to have three Cookies in break for BS6-042-style conditions', () => {
    const conditionalTrap: GameCard = {
      id: 'BS6-042',
      instanceId: 'bs6-042-break-count',
      name: 'Clever Advice',
      type: 'trap',
      officialType: 'trap',
      trap: {
        text: 'If there are 3 or more Cookies in your break area.',
        cost: { energy: { yellow: 1 }, discardHand: 0 },
        condition: { kind: 'break-area-card-count-at-least', count: 3 },
        effects: [],
      },
    }
    let state = createBattleState()
    state.players['player-one'].hand = [conditionalTrap]
    state.players['player-one'].supportArea = [
      { card: item('p1-yellow', 'yellow'), rested: false },
    ]
    state = declareAttack(state)

    expect(explainUnavailableTraps(state, 'player-one')).toEqual([
      expect.objectContaining({
        instanceId: conditionalTrap.instanceId,
        reason: 'condition-not-met',
      }),
    ])

    state.players['player-one'].breakArea = [
      cookie('break-1'),
      cookie('break-2'),
      cookie('break-3'),
    ]
    expect(getTrapCandidates(state, 'player-one')).toContainEqual(
      expect.objectContaining({ instanceId: conditionalTrap.instanceId }),
    )
  })

  it('blames rested support energy rather than reporting an unknown engine fault', () => {
    const state = trapStageState()
    // 支援卡全部橫置＝沒有可用能量，正是使用者 log 裡的兩則情形。
    state.players['player-one'].supportArea = [
      { card: { ...item('p1-sup-a'), energyColor: 'blue' }, rested: true },
      { card: { ...item('p1-sup-b'), energyColor: 'blue' }, rested: true },
    ]

    expect(getTrapCandidates(state, 'player-one')).toHaveLength(0)
    expect(explainUnavailableTraps(state, 'player-one')).toEqual([
      { instanceId: 'trap-1', cardId: 'BS3-094', reason: 'cannot-pay-energy' },
    ])
  })

  it('blames an unmet trap condition when energy alone would be payable', () => {
    const state = trapStageState()
    state.players['player-one'].hand = [
      {
        ...blueTrap('trap-cond', 1),
        id: 'ST2-020',
        trap: {
          text: '《{Y}{Y}》 休息區 LV.5 以上才能發動。',
          cost: { energy: { blue: 1 }, discardHand: 0 },
          condition: { kind: 'break-level-at-least', level: 5 },
          effects: [
            {
              kind: 'modify-attack',
              amount: -3,
              duration: 'this-turn',
              target: { side: 'opponent', min: 0, max: 1 },
            },
          ],
        },
      },
    ]
    state.players['player-one'].breakArea = []
    state.players['player-one'].supportArea = [
      { card: { ...item('p1-sup-a'), energyColor: 'blue' }, rested: false },
    ]

    expect(explainUnavailableTraps(state, 'player-one')).toEqual([
      {
        instanceId: 'trap-cond',
        cardId: 'ST2-020',
        reason: 'condition-not-met',
      },
    ])
  })

  it('omits traps that are actually usable', () => {
    const state = trapStageState()
    state.players['player-one'].supportArea = [
      { card: { ...item('p1-sup-a'), energyColor: 'blue' }, rested: false },
      { card: { ...item('p1-sup-b'), energyColor: 'blue' }, rested: false },
    ]

    expect(getTrapCandidates(state, 'player-one')).toHaveLength(1)
    expect(explainUnavailableTraps(state, 'player-one')).toEqual([])
  })
})

describe('BS2-014 conditional break-to-hand follow-up', () => {
  const makeTrap = (): GameCard => ({
    id: 'BS2-014',
    instanceId: 'bs2-014-test',
    name: 'Erratic Yakgwa Robot',
    type: 'trap',
    officialType: 'trap',
    energyColor: 'yellow',
    trap: {
      text: '《{Y}》 Select up to 1 of your opponent\'s Cookies. During this turn, that Cookie deals -1 attack damage. Then, you can return 1 LV.1 Cookie from your break area to your hand. If you did, place 1 Cookie from your hand into your break area.',
      cost: { energy: { yellow: 1 }, discardHand: 0 },
      effects: [
        {
          kind: 'modify-attack',
          amount: -1,
          duration: 'this-turn',
          target: { side: 'opponent', min: 0, max: 1 },
        },
        {
          kind: 'break-to-hand',
          amount: 1,
          minLevel: 1,
          maxLevel: 1,
          optional: true,
          thenEffects: [{ kind: 'hand-to-break', amount: 1 }],
        },
      ],
    },
  })

  it('only exposes and resolves the hand-to-break follow-up after a break card is returned', () => {
    const trap = makeTrap()
    const returned = cookie('break-lv1')
    const handCookie = cookie('hand-lv1')
    let state = createBattleState()
    state.players['player-one'].hand = [trap, handCookie]
    state.players['player-one'].breakArea = [returned]
    state.players['player-one'].supportArea = [
      { card: item('yellow-payment', 'yellow'), rested: false },
    ]
    state = declareAttack(state)

    const afterTrap = playTrap(state, 'player-one', {
      trapInstanceId: trap.instanceId,
      paymentIds: ['yellow-payment'],
      targetIds: ['attacker'],
    })
    expect(afterTrap.pendingAbilityEffect?.effectIndex).toBe(1)

    const returnedState = applyGameCommand(afterTrap, {
      kind: 'resolve-ability-effect',
      playerId: 'player-one',
      targetIds: [returned.instanceId],
    })
    expect(returnedState.pendingAbilityEffect?.effectIndex).toBe(2)
    expect(returnedState.players['player-one'].hand).toContainEqual(returned)

    const resolved = applyGameCommand(returnedState, {
      kind: 'resolve-ability-effect',
      playerId: 'player-one',
      targetIds: [handCookie.instanceId],
    })
    expect(resolved.pendingAbilityEffect).toBeUndefined()
    expect(resolved.players['player-one'].breakArea).toContainEqual(handCookie)
    expect(resolved.pendingBattle?.stage).toBe('damage')
  })

  it('does not run the If you did step when the optional return is skipped', () => {
    const trap = makeTrap()
    const returned = cookie('break-lv1')
    const handCookie = cookie('hand-lv1')
    let state = createBattleState()
    state.players['player-one'].hand = [trap, handCookie]
    state.players['player-one'].breakArea = [returned]
    state.players['player-one'].supportArea = [
      { card: item('yellow-payment', 'yellow'), rested: false },
    ]
    state = declareAttack(state)

    const afterTrap = playTrap(state, 'player-one', {
      trapInstanceId: trap.instanceId,
      paymentIds: ['yellow-payment'],
      targetIds: ['attacker'],
    })
    const skipped = applyGameCommand(afterTrap, {
      kind: 'resolve-ability-effect',
      playerId: 'player-one',
      targetIds: [],
    })

    expect(skipped.pendingAbilityEffect).toBeUndefined()
    expect(skipped.players['player-one'].breakArea).toContainEqual(returned)
    expect(skipped.players['player-one'].hand).toContainEqual(handCookie)
    expect(skipped.pendingBattle?.stage).toBe('damage')
  })
})
