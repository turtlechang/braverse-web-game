import { describe, expect, it } from 'vitest'
import { fixture, activate, declare, openThen, settle } from './st8-005-demo'
import { applyGameCommand as apply } from './commands'
import { zones } from './st8-002-demo'
import { takeAiStep } from './ai'

describe('ST8-005 original resources and actual commands', () => {
  it.each(['positive', 'three-supports', 'four-supports', 'six-supports', 'skill', 'skill-four', 'skill-five', 'skill-six',
    'skill-no-item', 'skill-rested', 'skill-used', 'refresh', 'source-faints', 'other-target', 'play'])('retains physical identity and four-copy limit: %s', scenario => {
    const state = fixture(scenario)
    for (const id of ['player-one', 'player-two'] as const) {
      const cards = zones(state, id)
      expect(cards).toHaveLength(60)
      expect(new Set(cards.map(card => card.instanceId)).size).toBe(60)
      for (const card of cards) expect(cards.filter(other => other.id === card.id).length).toBeLessThanOrEqual(4)
    }
  })
  it.each([['skill', 0], ['skill-four', 4], ['skill-five', 5]] as const)('draws exactly one after real Item with %s', (scenario, count) => {
    const state = fixture(scenario), before = structuredClone(state), next = activate(state)
    expect(state.itemsActivatedThisTurn?.['player-one']).toBe(1)
    expect(next.players['player-one'].hand).toHaveLength(count + 1)
    expect(next.players['player-one'].deck).toHaveLength(before.players['player-one'].deck.length - 1)
    expect(next.players['player-one'].supportArea).toEqual(before.players['player-one'].supportArea)
    expect(state).toEqual(before)
    expect(() => activate(next)).toThrow()
  })
  it.each(['skill-six', 'skill-no-item', 'skill-used', 'skill-wrong-phase', 'skill-opponent-turn'])('blocks condition, Once or timing without moving resources: %s', scenario => {
    const state = fixture(scenario), before = structuredClone(state)
    expect(() => activate(state)).toThrow()
    expect(state).toEqual(before)
  })
  it('allows a rested source without extra payment', () => {
    const state = fixture('skill-rested'), next = activate(state)
    expect(next.players['player-one'].hand).toHaveLength(1)
    expect(next.players['player-one'].battleArea[0].rested).toBe(true)
    expect(next.players['player-one'].supportArea).toEqual(state.players['player-one'].supportArea)
  })
  it('draws the actual last card before mandatory Refresh and resumes', () => {
    const state = fixture('refresh'), last = state.players['player-one'].deck[0].instanceId
    const pending = activate(state)
    expect(pending.players['player-one'].hand.some(card => card.instanceId === last)).toBe(true)
    expect(pending.pendingRefresh).toBeTruthy()
    const next = settle(pending)
    expect(next.pendingRefresh ?? null).toBeNull()
    expect(next.status).toBe('playing')
    expect(next.players['player-one'].deck.length).toBeGreaterThan(0)
    expect(next.players['player-one'].hand.some(card => card.instanceId === last)).toBe(true)
  })
  it.each([0, 1, 2])('ordinary GGG3 then rests %i active supports for equal damage', count => {
    const state = openThen(), before = structuredClone(state), target = state.players['player-two'].battleArea[0]
    expect(state.pendingBattle?.stage).toBe('attack-effect')
    expect(target.hpCards).toHaveLength(1)
    const ids = state.players['player-one'].supportArea.slice(3, 3 + count).map(support => support.card.instanceId)
    const next = settle(apply(state, { kind: 'resolve-attack-effect', playerId: 'player-one', targetIds: [...ids, target.card.instanceId] }))
    expect(next.players['player-one'].supportArea.filter(support => support.rested)).toHaveLength(3 + count)
    expect(next.players['player-two'].battleArea.find(cookie => cookie.card.instanceId === target.card.instanceId)?.hpCards.length ?? 0)
      .toBe(Math.max(0, 1 - count))
    if (count > 0) expect(next.players['player-two'].breakArea.some(card => card.instanceId === target.card.instanceId)).toBe(true)
    expect(state).toEqual(before)
  })
  it.each(['zero', 'support-only', 'target-only'])('allows independent zero selections: %s', mode => {
    const state = openThen(), target = state.players['player-two'].battleArea[0]
    const ids = mode === 'support-only' ? [state.players['player-one'].supportArea[3].card.instanceId]
      : mode === 'target-only' ? [target.card.instanceId] : []
    const next = settle(apply(state, { kind: 'resolve-attack-effect', playerId: 'player-one', targetIds: ids }))
    expect(next.players['player-two'].battleArea[0].hpCards).toHaveLength(1)
    expect(next.players['player-one'].supportArea.filter(support => support.rested)).toHaveLength(mode === 'support-only' ? 4 : 3)
  })
  it('rejects wrong support owner, paid supports, own Cookies and three supports', () => {
    const state = openThen('six-supports'), own = state.players['player-one'], target = state.players['player-two'].battleArea[0].card.instanceId
    for (const ids of [
      [own.supportArea[0].card.instanceId, target],
      [...own.supportArea.slice(3).map(support => support.card.instanceId), target],
      [state.players['player-two'].deck[0].instanceId, target],
      [own.battleArea[0].card.instanceId],
    ]) {
      const before = structuredClone(state)
      expect(() => apply(state, { kind: 'resolve-attack-effect', playerId: 'player-one', targetIds: ids })).toThrow()
      expect(state).toEqual(before)
    }
  })
  it('damages another opponent Cookie independently of the original defender', () => {
    const state = openThen('other-target'), original = state.players['player-two'].battleArea[0], target = state.players['player-two'].battleArea[1]
    const next = settle(apply(state, { kind: 'resolve-attack-effect', playerId: 'player-one',
      targetIds: [state.players['player-one'].supportArea[3].card.instanceId, target.card.instanceId] }))
    expect(next.players['player-two'].battleArea[0].hpCards).toEqual(original.hpCards)
    expect(next.players['player-two'].battleArea.find(cookie => cookie.card.instanceId === target.card.instanceId)?.hpCards.length ?? 0)
      .toBe(Math.max(0, target.hpCards.length - 1))
  })
  it('continues support/damage Then after HP6 takes ordinary4 and two real Kumiho FLIPs', () => {
    const state = openThen('source-faints'), target = state.players['player-two'].battleArea[0]
    expect(state.players['player-one'].breakArea.some(card => card.id === 'ST8-005')).toBe(true)
    expect(state.pendingBattle?.stage).toBe('attack-effect')
    const next = settle(apply(state, { kind: 'resolve-attack-effect', playerId: 'player-one',
      targetIds: [state.players['player-one'].supportArea[3].card.instanceId, target.card.instanceId] }))
    expect(next.players['player-one'].supportArea[3].rested).toBe(true)
    expect(next.players['player-two'].battleArea.find(cookie => cookie.card.instanceId === target.card.instanceId)?.hpCards.length ?? 0)
      .toBe(Math.max(0, target.hpCards.length - 1))
  })
  it.each(['rested-energy', 'wrong-color', 'rested-source', 'wrong-phase', 'first-turn'])('blocks illegal ordinary attack: %s', scenario => {
    const state = fixture(scenario), before = structuredClone(state)
    expect(() => declare(state)).toThrow()
    expect(state).toEqual(before)
  })
  it('deploys from hand with original six HP', () => {
    const state = fixture('play'), next = apply(state, { kind: 'deploy-cookie', playerId: 'player-one', instanceId: state.players['player-one'].hand[0].instanceId })
    expect(next.players['player-one'].battleArea.find(cookie => cookie.card.id === 'ST8-005')?.hpCards).toHaveLength(6)
  })
  it.each([3, 4, 5] as const)('Lv%i uses one support to finish HP1 and preserves the other', level => {
    const state = openThen(), before = structuredClone(state), decision = takeAiStep(state, 'player-one', { level, searchNow: () => 0 })
    expect(decision.action).not.toBe('error')
    const next = settle(decision.state)
    expect(next.players['player-one'].supportArea.filter(support => support.rested)).toHaveLength(4)
    expect(next.players['player-two'].breakArea.some(card => card.instanceId === state.players['player-two'].battleArea[0].card.instanceId)).toBe(true)
    expect(state).toEqual(before)
  })
})
