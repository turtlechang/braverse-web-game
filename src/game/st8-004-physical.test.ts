import { describe, expect, it } from 'vitest'
import { fixture, declare, openThen } from './st8-004-demo'
import { applyGameCommand as apply } from './commands'
import { takeAiStep } from './ai'
import { zones } from './st8-002-demo'
import { getCardPoolEntry } from './card-pool'
import { createCard } from './starter-deck'
import { getActingPlayerId } from './controller'

describe('ST8-004 physical attack and independent Then', () => {
  it('deploys from hand with five original HP alongside the existing survivor', () => {
    const state = fixture('play'), before = structuredClone(state)
    const next = apply(state, { kind: 'deploy-cookie', playerId: 'player-one', instanceId: state.players['player-one'].hand[0].instanceId })
    expect(next.players['player-one'].battleArea).toHaveLength(2)
    expect(next.players['player-one'].battleArea.find(cookie => cookie.card.id === 'ST8-004')?.hpCards).toHaveLength(5)
    expect(next.players['player-one'].battleArea[0]).toEqual(before.players['player-one'].battleArea[0])
    expect(state).toEqual(before)
  })
  it('retains target-faint Then until the player resolves it', () => {
    const state = openThen('target-faints')
    expect(state.players['player-two'].breakArea.some(card => card.id === 'ST1-005')).toBe(true)
    expect(state.pendingBattle?.stage).toBe('attack-effect')
    const next = apply(state, { kind: 'resolve-attack-effect', playerId: 'player-one', targetIds: [state.players['player-one'].supportArea[0].card.instanceId] })
    expect(next.players['player-one'].supportArea[0].rested).toBe(false)
  })
  it('continues Then after the original HP5 source takes ordinary4 and actual Kumiho FLIP1', () => {
    let state = fixture()
    const own = state.players['player-one'], foe = state.players['player-two']
    const sourceId = own.battleArea[0].card.instanceId, attackerId = foe.battleArea[0].card.instanceId
    const kumiho = getCardPoolEntry('BS1-002')
    if (!kumiho) throw Error('Original Kumiho required')
    foe.supportArea = foe.deck.splice(0, 3).map(card => ({ card, rested: false }))
    const cost = foe.deck.shift()
    if (!cost) throw Error('Real discard cost required')
    foe.hand = [cost]
    foe.battleArea[0].hpCards[foe.battleArea[0].hpCards.length - 1] = createCard(kumiho, 'player-two', 1)
    state.activePlayerId = 'player-two'
    for (const id of ['player-one', 'player-two'] as const) {
      const cards = zones(state, id)
      expect(cards).toHaveLength(60)
      expect(new Set(cards.map(card => card.instanceId)).size).toBe(60)
      for (const card of cards) expect(cards.filter(other => other.id === card.id).length).toBeLessThanOrEqual(4)
    }
    state = apply(state, { kind: 'declare-attack', playerId: 'player-two', attackerInstanceId: attackerId, targetInstanceId: sourceId, supportPaymentIds: foe.supportArea.map(support => support.card.instanceId) })
    state = apply(state, { kind: 'skip-trap', playerId: 'player-one' })
    state = apply(state, { kind: 'resolve-battle', playerId: 'player-two' })
    expect(state.players['player-one'].battleArea[0].hpCards).toHaveLength(1)
    for (let i = 0; i < 10 && !(state.activePlayerId === 'player-one' && state.phase === 'main'); i++) {
      state = apply(state, { kind: 'advance-phase', playerId: state.activePlayerId })
    }
    state = declare(state)
    state = apply(state, { kind: 'skip-trap', playerId: 'player-two' })
    state = apply(state, { kind: 'resolve-next-damage', playerId: 'player-two' })
    expect(state.pendingBattle?.revealedHpCard?.id).toBe('BS1-002')
    state = apply(state, { kind: 'resolve-flip', playerId: 'player-two', activate: true, discardHandIds: [state.players['player-two'].hand[0].instanceId], targetIds: [sourceId] })
    for (let i = 0; i < 20 && state.pendingBattle?.stage !== 'attack-effect'; i++) {
      if (state.pendingReplacement) state = apply(state, { kind: 'skip-replacement', playerId: getActingPlayerId(state) })
      else {
        const decision = takeAiStep(state, getActingPlayerId(state), { level: 5, searchNow: () => 0 })
        expect(decision.action).not.toBe('error')
        state = decision.state
      }
    }
    expect(state.players['player-one'].breakArea.some(card => card.instanceId === sourceId)).toBe(true)
    expect(state.pendingBattle?.stage).toBe('attack-effect')
    const before = structuredClone(state)
    const next = apply(state, { kind: 'resolve-attack-effect', playerId: 'player-one', targetIds: [state.players['player-one'].supportArea[0].card.instanceId] })
    expect(next.players['player-one'].supportArea[0].rested).toBe(false)
    expect(next.players['player-two']).toEqual(before.players['player-two'])
    expect(next.pendingBattle ?? null).toBeNull()
    expect(state).toEqual(before)
  })
  it.each(['positive', 'three', 'four', 'six', 'opponent-five', 'already-active', 'rested-energy', 'wrong-color', 'rested-source', 'wrong-phase', 'first-turn'])('retains original sixty-card resources: %s', scenario => {
    const state = fixture(scenario)
    expect(state.players['player-one'].battleArea[0].hpCards).toHaveLength(5)
    for (const id of ['player-one', 'player-two'] as const) {
      const cards = zones(state, id)
      expect(cards).toHaveLength(60)
      expect(new Set(cards.map(card => card.instanceId)).size).toBe(60)
      for (const card of cards) expect(cards.filter(other => other.id === card.id).length).toBeLessThanOrEqual(4)
    }
  })
  it.each(['positive', 'six'])('pays GGG and readies exactly one just-paid support: %s', scenario => {
    const state = openThen(scenario), before = structuredClone(state)
    expect(state.players['player-two'].battleArea[0].hpCards).toHaveLength(1)
    expect(state.players['player-one'].supportArea.slice(0, 3).every(support => support.rested)).toBe(true)
    expect(state.players['player-one'].battleArea[0].rested).toBe(true)
    const next = apply(state, { kind: 'resolve-attack-effect', playerId: 'player-one', targetIds: [state.players['player-one'].supportArea[0].card.instanceId] })
    expect(next.players['player-one'].supportArea[0].rested).toBe(false)
    expect(next.players['player-one'].supportArea.slice(1)).toEqual(before.players['player-one'].supportArea.slice(1))
    expect(next.players['player-two']).toEqual(before.players['player-two'])
    expect(next.pendingBattle ?? null).toBeNull()
    expect(state).toEqual(before)
  })
  it.each(['three', 'four', 'opponent-five'])('does not ready support below the own five-card threshold: %s', scenario => {
    const state = openThen(scenario), before = structuredClone(state)
    const next = state.pendingBattle?.stage === 'attack-effect'
      ? apply(state, { kind: 'resolve-attack-effect', playerId: 'player-one', targetIds: [] }) : state
    expect(next.players).toEqual(before.players)
    expect(next.players['player-one'].supportArea.slice(0, 3).every(support => support.rested)).toBe(true)
    expect(next.pendingBattle ?? null).toBeNull()
  })
  it('allows zero without refunding attack payment', () => {
    const state = openThen(), next = apply(state, { kind: 'resolve-attack-effect', playerId: 'player-one', targetIds: [] })
    expect(next.players).toEqual(state.players)
    expect(next.pendingBattle ?? null).toBeNull()
  })
  it('allows a non-green support and an already-active support', () => {
    for (const scenario of ['positive', 'already-active']) {
      const state = openThen(scenario), support = state.players['player-one'].supportArea[4]
      expect(support.card.energyColor).not.toBe('green')
      const next = apply(state, { kind: 'resolve-attack-effect', playerId: 'player-one', targetIds: [support.card.instanceId] })
      expect(next.players['player-one'].supportArea[4].rested).toBe(false)
      expect(next.players['player-one'].supportArea.slice(0, 4)).toEqual(state.players['player-one'].supportArea.slice(0, 4))
    }
  })
  it('rejects excess, duplicate, wrong-zone and wrong-player selection without mutation', () => {
    const state = openThen(), before = structuredClone(state)
    const ids = state.players['player-one'].supportArea.slice(0, 2).map(support => support.card.instanceId)
    for (const targetIds of [ids, [ids[0], ids[0]], [state.players['player-one'].battleArea[0].card.instanceId], [state.players['player-two'].battleArea[0].card.instanceId]]) {
      expect(() => apply(state, { kind: 'resolve-attack-effect', playerId: 'player-one', targetIds })).toThrow()
    }
    expect(() => apply(state, { kind: 'resolve-attack-effect', playerId: 'player-two', targetIds: [ids[0]] })).toThrow()
    expect(state).toEqual(before)
  })
  it.each(['rested-energy', 'wrong-color', 'rested-source', 'wrong-phase', 'first-turn'])('rejects illegal attack: %s', scenario => {
    const state = fixture(scenario), before = structuredClone(state)
    expect(() => declare(state)).toThrow()
    expect(state).toEqual(before)
  })
  it.each([3, 4, 5] as const)('Lv%s resolves Then with a legal support and no mutation', level => {
    const state = openThen(), before = structuredClone(state)
    const result = takeAiStep(state, 'player-one', { level, searchNow: () => 0 })
    expect(result.action).not.toBe('error')
    expect(result.state.players['player-one'].supportArea.filter(support => !support.rested)).toHaveLength(1)
    expect(result.state.pendingBattle ?? null).toBeNull()
    expect(state).toEqual(before)
  })
})
