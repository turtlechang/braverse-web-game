import { describe, expect, it } from 'vitest'
import {
  applyGameCommand,
  executeCardEffect,
  getEffectiveAttack,
  replaceDefeatedCookie,
  resolveNextDamage,
  skipTrap,
  type CookieCard,
  type GameState,
} from '.'
import { cookie, createBattleState, declareAttack, item } from './test-helpers/battle-helpers'

const onPlayDrawCookie = (instanceId: string): CookieCard => ({
  ...cookie(instanceId, 1, 1),
  skill: {
    trigger: 'on-play',
    oncePerTurn: false,
    yourTurn: false,
    restSource: false,
    cost: { energy: {}, discardHand: 0 },
    text: '{ap} Draw 1 card from your deck.',
    effects: [{ kind: 'draw', amount: 1 }],
  },
})

const createSimultaneousReplacementState = (): GameState => ({
  players: {
    'player-one': {
      id: 'player-one',
      name: '回合玩家',
      deck: [item('p1-hp'), item('p1-draw'), item('p1-spare')],
      hand: [onPlayDrawCookie('p1-on-play')],
      battleArea: [],
      supportArea: [],
      breakArea: [],
      discardPile: [],
      stage: null,
      hasMulliganed: false,
      startingCookieSelected: true,
    },
    'player-two': {
      id: 'player-two',
      name: '非回合玩家',
      deck: [item('p2-hp'), item('p2-draw'), item('p2-spare')],
      hand: [onPlayDrawCookie('p2-on-play')],
      battleArea: [],
      supportArea: [],
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
  nextBattleEntrySequence: 1,
  attackModifiers: [],
  damageReceivedModifiers: [],
  pendingReplacement: {
    tasks: [
      { playerId: 'player-one', remaining: 1 },
      { playerId: 'player-two', remaining: 1 },
    ],
  },
  departedCookieCounts: { 'player-one': 0, 'player-two': 0 },
  pendingRefresh: null,
  pendingBattle: null,
})

describe('2026-03-30 official rule update', () => {
  it('resolves the turn player replacement OnPlay before the non-turn player replaces', () => {
    let state = createSimultaneousReplacementState()

    state = replaceDefeatedCookie(state, 'p1-on-play')
    expect(state.pendingOnPlay).toEqual({
      playerId: 'player-one',
      sourceInstanceId: 'p1-on-play',
    })
    expect(state.pendingReplacement?.tasks[0]?.playerId).toBe('player-two')
    expect(() => replaceDefeatedCookie(state, 'p2-on-play')).toThrow(
      '必須先處理餅乾的登場效果。',
    )

    state = applyGameCommand(state, {
      kind: 'activate-skill',
      playerId: 'player-one',
      sourceInstanceId: 'p1-on-play',
      trigger: 'on-play',
      paymentIds: [],
    })
    expect(state.players['player-one'].hand.map((card) => card.instanceId)).toEqual([
      'p1-draw',
    ])
    expect(state.pendingOnPlay).toBeNull()
    expect(state.pendingReplacement?.tasks).toEqual([
      { playerId: 'player-two', remaining: 1 },
    ])

    state = replaceDefeatedCookie(state, 'p2-on-play')
    expect(state.players['player-two'].battleArea[0].card.instanceId).toBe('p2-on-play')
  })

  it('does not recalculate the current attack after the damage step has started', () => {
    let state = createBattleState()
    const attacker = state.players['player-two'].battleArea[0]
    state = {
      ...state,
      players: {
        ...state.players,
        'player-two': {
          ...state.players['player-two'],
          battleArea: [
            {
              ...attacker,
              card: { ...attacker.card, attack: 2 },
            },
          ],
        },
      },
    }

    state = skipTrap(declareAttack(state), 'player-one')
    expect(state.pendingBattle?.remainingDamage).toBe(2)

    state = resolveNextDamage(state)
    expect(state.pendingBattle?.remainingDamage).toBe(1)

    state = executeCardEffect(
      state,
      { sourcePlayerId: 'player-two', sourceInstanceId: 'attacker' },
      {
        kind: 'modify-attack',
        amount: 2,
        duration: 'this-turn',
        target: { side: 'self', min: 1, max: 1 },
      },
      ['attacker'],
    )
    expect(getEffectiveAttack(state, 'attacker')).toBe(4)
    expect(state.pendingBattle?.remainingDamage).toBe(1)

    state = resolveNextDamage(state)
    expect(state.players['player-one'].battleArea[0].hpCards).toHaveLength(1)
  })
})
