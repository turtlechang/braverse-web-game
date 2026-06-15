import { describe, expect, it } from 'vitest'
import {
  beginAttack,
  executeCardEffect,
  getFaintEffectCandidates,
  resolveFaintEffect,
  resolveNextDamage,
  skipTrap,
  type CookieCard,
  type GameState,
} from '.'
import { cookie, item } from './test-helpers/battle-helpers'

describe('faint effect queue', () => {
  const createFaintState = (): GameState => {
    const faintCookie: CookieCard = {
      id: 'faint-cookie',
      instanceId: 'faint-cookie',
      name: 'Faint Cookie',
      type: 'cookie',
      officialType: 'cookie',
      level: 2,
      hp: 1,
      attack: 1,
      attackCost: 1,
      attackEnergyCost: { red: 1 },
      energyColor: 'yellow',
      skill: {
        trigger: 'passive',
        oncePerTurn: false,
        yourTurn: false,
        restSource: false,
        cost: { energy: {}, discardHand: 0 },
        text: 'When this Cookie faints, select up to 1 of your opponent\'s Cookies. That Cookie receives 1 damage.',
        effects: [
          {
            kind: 'damage',
            amount: 1,
            target: { side: 'opponent', min: 0, max: 1 },
          },
        ],
        faint: true,
      },
    }

    const attacker: CookieCard = {
      id: 'attacker',
      instanceId: 'attacker',
      name: 'attacker',
      type: 'cookie',
      officialType: 'cookie',
      level: 1,
      hp: 2,
      attack: 5,
      attackCost: 1,
      attackEnergyCost: { red: 1 },
      energyColor: 'red',
    }

    return {
      players: {
        'player-one': {
          id: 'player-one',
          name: 'P1',
          deck: [item('p1-d')],
          hand: [cookie('p1-replacement')],
          battleArea: [
            {
              card: faintCookie,
              hpCards: [item('faint-hp')],
              rested: false,
              battleEntryId: 'faint:battle:1',
            },
          ],
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
          deck: [item('p2-d')],
          hand: [cookie('p2-replacement')],
          battleArea: [
            {
              card: attacker,
              hpCards: [item('p2-hp')],
              rested: false,
              battleEntryId: 'attacker:battle:2',
            },
          ],
          supportArea: [{ card: item('p2-s'), rested: false }],
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

  it('queues faint effect instead of auto-executing in battle damage', () => {
    const state = createFaintState()
    const battleState = beginAttack(
      state,
      'attacker',
      'faint-cookie',
      ['p2-s'],
    )
    const battle1 = skipTrap(battleState, 'player-one')
    const afterDamage = resolveNextDamage(battle1)

    expect(afterDamage.pendingFaintEffects).toBeDefined()
    expect(afterDamage.pendingFaintEffects!.length).toBe(1)
    expect(afterDamage.pendingFaintEffects![0].sourceInstanceId).toBe('faint-cookie')
    expect(afterDamage.pendingFaintEffects![0].sourcePlayerId).toBe('player-one')
  })

  it('getFaintEffectCandidates returns opponent cookies', () => {
    const state = createFaintState()
    let battleState = beginAttack(state, 'attacker', 'faint-cookie', ['p2-s'])
    battleState = skipTrap(battleState, 'player-one')
    const afterDamage = resolveNextDamage(battleState)

    const candidates = getFaintEffectCandidates(afterDamage)
    expect(candidates.length).toBe(1)
    expect(candidates[0].card.instanceId).toBe('attacker')
  })

  it('resolveFaintEffect damages selected target', () => {
    const state = createFaintState()
    state.players['player-two'].battleArea[0] = {
      ...state.players['player-two'].battleArea[0],
      hpCards: [item('p2-hp-a'), item('p2-hp-b')],
    }
    let battleState = beginAttack(state, 'attacker', 'faint-cookie', ['p2-s'])
    battleState = skipTrap(battleState, 'player-one')
    let afterDamage = resolveNextDamage(battleState)

    afterDamage = resolveFaintEffect(afterDamage, ['attacker'])
    expect(afterDamage.pendingFaintEffects).toBeUndefined()
    expect(afterDamage.players['player-two'].battleArea[0].hpCards.length).toBe(1)
  })

  it('resolveFaintEffect skips when targets empty (up to 1 → 0)', () => {
    const state = createFaintState()
    let battleState = beginAttack(state, 'attacker', 'faint-cookie', ['p2-s'])
    battleState = skipTrap(battleState, 'player-one')
    let afterDamage = resolveNextDamage(battleState)

    afterDamage = resolveFaintEffect(afterDamage, [])
    expect(afterDamage.pendingFaintEffects).toBeUndefined()
    expect(afterDamage.players['player-two'].battleArea[0].hpCards.length).toBe(1)
  })

  it('faint triggered by effect damage also queues', () => {
    const state = createFaintState()
    const result = executeCardEffect(
      state,
      { sourcePlayerId: 'player-two', sourceInstanceId: 'attacker' },
      {
        kind: 'damage',
        amount: 1,
        target: { side: 'opponent', min: 0, max: 1 },
      },
      ['faint-cookie'],
    )

    expect(result.pendingFaintEffects).toBeDefined()
    expect(result.pendingFaintEffects!.length).toBeGreaterThanOrEqual(1)
  })

  it('faint respects missing candidates (empty opponent battle area)', () => {
    let state = createFaintState()
    state = {
      ...state,
      players: {
        ...state.players,
        'player-two': {
          ...state.players['player-two'],
          battleArea: [],
        },
      },
    }
    const result = executeCardEffect(
      state,
      { sourcePlayerId: 'player-two', sourceInstanceId: 'effect-source' },
      {
        kind: 'damage',
        amount: 1,
        target: { side: 'opponent', min: 1, max: 1 },
      },
      ['faint-cookie'],
    )

    expect(result.pendingFaintEffects ?? []).toHaveLength(0)
  })
})