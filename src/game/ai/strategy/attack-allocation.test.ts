import { describe, expect, it } from 'vitest'
import { createPublicAttackAllocationForecast } from '../attack-allocation'
import { takeAiStep } from '../../ai'
import { getActingPlayerId } from '../../controller'
import { createBattleState, cookie, item } from '../../test-helpers/battle-helpers'
import type { AttackCommand } from '../../commands'
import type { CookieInBattle, GameState, PlayerId } from '../../types'

// Synthetic public tactical counterexample, not physical-card acceptance.
const battle = (id: string, attack: number, hp: number): CookieInBattle => ({
  card: cookie(id, attack, hp), rested: false, battleEntryId: `${id}:entry`,
  hpCards: Array.from({ length: hp }, (_, i) => item(`${id}-hp-${i}`)),
})
const fixture = (): GameState => {
  const state = createBattleState()
  state.activePlayerId = 'player-one'; state.turnNumber = 3
  for (const player of Object.values(state.players)) {
    player.hand = []; player.supportArea = []
    player.deck = Array.from({ length: 12 }, (_, i) => item(`${player.id}-deck-${i}`))
  }
  state.players['player-one'].battleArea = [battle('a-strong', 2, 3), battle('z-weak', 1, 3)]
  state.players['player-two'].battleArea = [battle('a-low', 1, 1), battle('z-high', 1, 2)]
  state.players['player-one'].supportArea = [0, 1].map(i => ({ card: item(`support-${i}`), rested: false }))
  return state
}
const command = (source = 'a-strong', target = 'a-low'): AttackCommand => ({
  kind: 'attack', playerId: 'player-one', attackerInstanceId: source,
  targetInstanceId: target, supportPaymentIds: ['support-0'],
})

describe('Lv5 public normal-attack allocation', () => {
  it.each([[false, false], [true, false], [false, true], [true, true]])(
    'knocks out both enemies without wasting the strong attack (reverse self=%s foe=%s)',
    (reverseSelf, reverseFoe) => {
      let state = fixture()
      if (reverseSelf) state.players['player-one'].battleArea.reverse()
      if (reverseFoe) state.players['player-two'].battleArea.reverse()
      const before = structuredClone(state)
      const first = takeAiStep(state, 'player-one', { level: 5, seed: 2026110101, searchNow: () => 0 })
      expect(first.action).toBe('attack')
      expect(first.state.pendingBattle).not.toMatchObject({ attackerInstanceId: 'a-strong', targetInstanceId: 'a-low' })
      expect(state).toEqual(before)
      state = first.state
      const memories: Partial<Record<PlayerId, NonNullable<typeof first.reason>['strategyMemory']>> = {
        'player-one': first.reason?.strategyMemory,
      }
      for (let i = 0; i < 30 && state.status !== 'finished' && state.activePlayerId === 'player-one' && state.phase === 'main'; i++) {
        const playerId = getActingPlayerId(state)
        const step = takeAiStep(state, playerId, { level: 5, seed: 2026110101, searchNow: () => 0, memory: memories[playerId] })
        expect(step.action).not.toBe('error')
        expect(step.state).not.toBe(state)
        memories[playerId] = step.reason?.strategyMemory
        state = step.state
      }
      expect(state.players['player-two'].battleArea).toEqual([])
      expect(state.players['player-two'].breakArea.map(c => c.instanceId).sort()).toEqual(['a-low', 'z-high'])
      expect(state.players['player-one'].supportArea.every(s => s.rested)).toBe(true)
    },
  )
  it('only penalizes worse allocation and leaves the input immutable', () => {
    const state = fixture(), before = structuredClone(state)
    const forecast = createPublicAttackAllocationForecast()
    expect(forecast(state, 'player-one', command())?.amount).toBeLessThan(0)
    expect(forecast(state, 'player-one', command('a-strong', 'z-high'))).toBeNull()
    expect(forecast(state, 'player-one', command('z-weak', 'a-low'))).toBeNull()
    expect(state).toEqual(before)
  })
  it('leaves existing risk and target priorities intact when both allocations knock out the same level', () => {
    const state = fixture()
    state.players['player-one'].battleArea = [battle('a-strong', 4, 3), battle('z-weak', 3, 3)]
    state.players['player-two'].battleArea = [battle('a-low', 1, 5), battle('z-high', 1, 7)]
    const forecast = createPublicAttackAllocationForecast()
    // Both two-attack sequences remove one LV1. The larger target requires all
    // seven damage; extra partial damage must not override existing response risk.
    expect(forecast(state, 'player-one', command('a-strong', 'a-low'))).toBeNull()
    expect(forecast(state, 'player-one', command('a-strong', 'z-high'))).toBeNull()
  })
  it('cannot reuse one support or a rested second attacker', () => {
    const oneSupport = fixture(); oneSupport.players['player-one'].supportArea.pop()
    expect(createPublicAttackAllocationForecast()(oneSupport, 'player-one', command())).toBeNull()
    const rested = fixture(); rested.players['player-one'].battleArea[1].rested = true
    expect(createPublicAttackAllocationForecast()(rested, 'player-one', command())).toBeNull()
  })
  it('reserves the color needed for the second attack', () => {
    const state = fixture()
    state.players['player-one'].battleArea[1].card.attackEnergyCost = { yellow: 1 }
    expect(createPublicAttackAllocationForecast()(state, 'player-one', command())).toBeNull()
    state.players['player-one'].supportArea[1].card = item('yellow-support', 'yellow')
    expect(createPublicAttackAllocationForecast()(state, 'player-one', command())?.amount).toBeLessThan(0)
  })
  it('declines the entire forecast when its budget is exhausted', () => {
    expect(createPublicAttackAllocationForecast({ nodeBudget: 0 })(fixture(), 'player-one', command())).toBeNull()
    expect(createPublicAttackAllocationForecast({ shouldStop: () => true })(fixture(), 'player-one', command())).toBeNull()
  })
  it('scopes a shared forecast cache to the acting player', () => {
    const state = fixture(), forecast = createPublicAttackAllocationForecast()
    expect(forecast(state, 'player-two', { ...command('a-low', 'z-weak'), playerId: 'player-two' })).toBeNull()
    expect(forecast(state, 'player-one', command())?.amount).toBeLessThan(0)
  })
  it('includes public reduction instead of treating base damage as a knockout', () => {
    const state = fixture()
    state.damageReceivedModifiers = [{ sourceInstanceId: 'z-high', targetInstanceId: 'z-high',
      amount: -2, damageType: 'attack', expiresAfterTurn: 3 }]
    expect(createPublicAttackAllocationForecast()(state, 'player-one', command())).toBeNull()
  })
  it('does not inspect unknown deck, HP or opponent hand faces', () => {
    const state = fixture()
    state.players['player-two'].hand = [item('unknown-hand')]
    const hidden = structuredClone(state)
    for (const player of Object.values(hidden.players)) {
      player.deck = player.deck.map((c) => cookie(c.instanceId, 99, 99))
      for (const target of player.battleArea) target.hpCards = target.hpCards.map(c => cookie(c.instanceId, 99, 99))
    }
    hidden.players['player-two'].hand = [cookie('unknown-hand', 99, 99)]
    expect(createPublicAttackAllocationForecast()(hidden, 'player-one', command()))
      .toEqual(createPublicAttackAllocationForecast()(state, 'player-one', command()))
    const chosen = (input: GameState) => takeAiStep(input, 'player-one', { level: 5, seed: 2026110101, searchNow: () => 0 }).state.pendingBattle
    expect(chosen(hidden)).toEqual(chosen(state))
  })
})
