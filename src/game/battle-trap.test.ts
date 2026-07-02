import { describe, expect, it } from 'vitest'
import {
  beginAttack,
  createOfficialRedStarterDeck,
  getTrapCandidates,
  playTrap,
  resolveFlip,
  resolveNextDamage,
  type CookieCard,
  type GameCard,
  type GameState,
} from '.'
import { cookie, createBattleState, declareAttack, item } from './test-helpers/battle-helpers'

describe('TRAP response window', () => {
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
})
