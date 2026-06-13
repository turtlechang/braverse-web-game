import { describe, expect, it } from 'vitest'
import {
  beginAttack,
  getTrapCandidates,
  playTrap,
  resolveNextDamage,
  type GameCard,
  type GameState,
} from '.'
import { cookie, item } from './test-helpers/battle-helpers'

describe('ST2-021 Pretzel Snare condition + damage', () => {
  const pretzelSnare: GameCard = {
    id: 'ST2-021',
    instanceId: 'pretzel-snare',
    name: 'Pretzel Snare',
    type: 'trap',
    officialType: 'trap',
    energyColor: 'yellow',
    trap: {
      text: '《{Y}{Y}》 If 1 of your opponent\'s Cookies attacks more than 4 damage, select up to 1 of your opponent\'s Cookies. That Cookie receives 1 damage.',
      cost: { energy: { yellow: 2 }, discardHand: 0 },
      condition: { kind: 'attacker-attack-more-than', amount: 4 },
      effects: [
        {
          kind: 'damage',
          amount: 1,
          target: { side: 'opponent', min: 0, max: 1 },
        },
      ],
    },
  }

  const yellowSupport = (id: string): GameCard => ({
    id,
    instanceId: id,
    name: id,
    type: 'item',
    energyColor: 'yellow',
  })

  const createPretzelState = (attack: number): GameState => {
    const attacker = { ...cookie('attacker', attack, 3) }
    const defender = cookie('defender', 1, 3)
    return {
      players: {
        'player-one': {
          id: 'player-one',
          name: 'P1',
          deck: [item('p1-d')],
          hand: [pretzelSnare, cookie('p1-replacement')],
          battleArea: [
            {
              card: defender,
              hpCards: [item('defender-hp-a'), item('defender-hp-b'), item('defender-hp-c')],
              rested: false,
              battleEntryId: 'defender:battle:1',
            },
          ],
          supportArea: [
            { card: yellowSupport('p1-yellow-a'), rested: false },
            { card: yellowSupport('p1-yellow-b'), rested: false },
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
          deck: [item('p2-d')],
          hand: [cookie('p2-replacement')],
          battleArea: [
            {
              card: attacker,
              hpCards: [item('attacker-hp-a'), item('attacker-hp-b'), item('attacker-hp-c')],
              rested: false,
              battleEntryId: 'attacker:battle:2',
            },
          ],
          supportArea: [
            { card: item('p2-support'), rested: false },
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
  }

  it('excludes trap when declaredDamage=4 (condition not met)', () => {
    const state = beginAttack(createPretzelState(4), 'attacker', 'defender', ['p2-support'])
    expect(getTrapCandidates(state, 'player-one')).toEqual([])
  })

  it('includes trap when declaredDamage=5 (condition met)', () => {
    const state = beginAttack(createPretzelState(5), 'attacker', 'defender', ['p2-support'])
    expect(getTrapCandidates(state, 'player-one')).toEqual([pretzelSnare])
  })

  it('deals 1 damage to selected target and continues original attack', () => {
    let state = beginAttack(createPretzelState(5), 'attacker', 'defender', ['p2-support'])
    state = playTrap(state, 'player-one', {
      trapInstanceId: pretzelSnare.instanceId,
      paymentIds: ['p1-yellow-a', 'p1-yellow-b'],
      targetIds: ['attacker'],
    })
    expect(state.pendingBattle).toMatchObject({
      stage: 'damage',
      damagePlayerId: 'player-two',
      damageTargetInstanceId: 'attacker',
      remainingDamage: 1,
      suspendedAttackDamage: 5,
    })
    expect(state.players['player-one'].discardPile).toContain(pretzelSnare)

    state = resolveNextDamage(state)
    expect(state.players['player-two'].battleArea[0].hpCards).toHaveLength(2)

    state = resolveNextDamage(state)
    state = resolveNextDamage(state)
    state = resolveNextDamage(state)
    state = resolveNextDamage(state)
    expect(state.pendingBattle).toBeNull()
    expect(state.players['player-one'].battleArea).toHaveLength(0)
  })

  it('skips damage effect when targetIds=[] (select 0) and continues original attack', () => {
    let state = beginAttack(createPretzelState(5), 'attacker', 'defender', ['p2-support'])
    state = playTrap(state, 'player-one', {
      trapInstanceId: pretzelSnare.instanceId,
      paymentIds: ['p1-yellow-a', 'p1-yellow-b'],
      targetIds: [],
    })
    expect(state.players['player-one'].discardPile).toContain(pretzelSnare)
    expect(state.pendingBattle).toMatchObject({
      stage: 'damage',
      trapUsed: true,
    })
    expect((state.pendingBattle as NonNullable<typeof state.pendingBattle>).suspendedAttackDamage).toBeUndefined()

    state = resolveNextDamage(state)
    state = resolveNextDamage(state)
    state = resolveNextDamage(state)
    state = resolveNextDamage(state)
    expect(state.pendingBattle).toBeNull()
    expect(state.players['player-one'].battleArea).toHaveLength(0)
    expect(state.players['player-two'].battleArea[0].hpCards).toHaveLength(3)
  })

  it('rejects invalid payment (not enough yellow energy)', () => {
    const state = beginAttack(createPretzelState(5), 'attacker', 'defender', ['p2-support'])
    expect(() => playTrap(state, 'player-one', {
      trapInstanceId: pretzelSnare.instanceId,
      paymentIds: ['p1-yellow-a'],
      targetIds: ['attacker'],
    })).toThrow('支付無效')
  })
})