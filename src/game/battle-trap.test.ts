import { describe, expect, it } from 'vitest'
import {
  getTrapCandidates,
  playTrap,
  resolveFlip,
  resolveNextDamage,
  type GameCard,
} from '.'
import { cookie, createBattleState, declareAttack, item } from './test-helpers/battle-helpers'

describe('TRAP response window', () => {
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
    ).toThrow('目前不能發動陷阱')
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
})