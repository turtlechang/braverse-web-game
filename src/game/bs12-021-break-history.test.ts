import { describe, expect, it } from 'vitest'
import { createBs12MuscleDemoState } from './demo'
import { applyGameCommand } from './commands'
import { executeCardEffect } from './effects'
import { advancePhase } from './turn'

const playerId = 'player-one' as const
const context = { sourcePlayerId: playerId, sourceInstanceId: 'bs12-019-source' }
const source = 'bs12-019-source'
describe('Arena break-entry history for Mango On Play', () => {
  it.each(['battle-to-break', 'make-faint'] as const)('records real %s movement, retains it after removal and does not mutate input', kind => {
    const before = createBs12MuscleDemoState()
    const snapshot = structuredClone(before)
    const after = executeCardEffect(before, context, { kind, target: { side: 'self', min: 1, max: 1 } }, [source])
    expect(after.arenaCookiesPlacedInBreakThisTurn?.[playerId]).toBe(1)
    expect(after.players[playerId].breakArea.map(c => c.instanceId)).toEqual([source])
    const removed = executeCardEffect(after, context, { kind: 'break-to-hand', amount: 1 }, [source])
    expect(removed.players[playerId].breakArea).toEqual([])
    expect(removed.arenaCookiesPlacedInBreakThisTurn?.[playerId]).toBe(1)
    expect(before).toEqual(snapshot)
  })
  it('records a real battle faint for its owner, not the attacker', () => {
    const base = createBs12MuscleDemoState('target-faints')
    const opponent = base.players['player-two']
    const before = { ...base, players: { ...base.players, 'player-two': { ...opponent,
      battleArea: opponent.battleArea.map((c, i) => i === 0 ? { ...c, hpCards: c.hpCards.slice(0, 1) } : c) } } }
    const after = applyGameCommand(before, { kind: 'attack', playerId, attackerInstanceId: source,
      targetInstanceId: 'bs12-019-opponent', supportPaymentIds: before.players[playerId].supportArea.map(s => s.card.instanceId) })
    expect(after.arenaCookiesPlacedInBreakThisTurn?.['player-two']).toBe(1)
    expect(after.arenaCookiesPlacedInBreakThisTurn?.[playerId] ?? 0).toBe(0)
  })
  it('records hand-to-break only once and clears history at the next Active Phase', () => {
    const base = createBs12MuscleDemoState()
    const card = base.players[playerId].battleArea[0].card
    const before = { ...base, players: { ...base.players, [playerId]: { ...base.players[playerId], hand: [{ ...card, instanceId: 'new-arena' }] } } }
    const after = executeCardEffect(before, context, { kind: 'hand-to-break', amount: 1 }, ['new-arena'])
    expect(after.arenaCookiesPlacedInBreakThisTurn?.[playerId]).toBe(1)
    const active = advancePhase({ ...after, phase: 'active', pendingReplacement: null })
    expect(active.arenaCookiesPlacedInBreakThisTurn).toEqual({})
  })
  it('records Refresh Arena entry through the real refresh command', () => {
    const base = createBs12MuscleDemoState()
    const arena = base.players[playerId].battleArea[0].card
    const before = { ...base, players: { ...base.players, [playerId]: { ...base.players[playerId], deck: [],
      discardPile: [{ ...arena, instanceId: 'refresh-arena' }, ...base.players[playerId].deck] } } }
    const after = applyGameCommand(before, { kind: 'refresh-deck', playerId, cookieInstanceId: 'refresh-arena', shuffleSeed: 3 })
    expect(after.players[playerId].breakArea.map(c => c.instanceId)).toEqual(['refresh-arena'])
    expect(after.arenaCookiesPlacedInBreakThisTurn?.[playerId]).toBe(1)
  })
  it('counts a second entry of the same physical Arena Cookie after leaving break', () => {
    const before = createBs12MuscleDemoState()
    const moved = executeCardEffect(before, context, { kind: 'battle-to-break', target: { side: 'self', min: 1, max: 1 } }, [source])
    const returned = executeCardEffect(moved, context, { kind: 'break-to-hand', amount: 1 }, [source])
    const after = executeCardEffect(returned, context, { kind: 'hand-to-break', amount: 1 }, [source])
    expect(after.arenaCookiesPlacedInBreakThisTurn?.[playerId]).toBe(2)
  })
  it('does not count old break cards, non-Arena or trash departures', () => {
    const before = createBs12MuscleDemoState()
    const player = before.players[playerId]
    const nonArena = { ...before, players: { ...before.players, [playerId]: { ...player,
      battleArea: player.battleArea.map(c => ({ ...c, card: { ...c.card, keywords: [] } })) } } }
    const moved = executeCardEffect(nonArena, context, { kind: 'battle-to-break', target: { side: 'self', min: 1, max: 1 } }, [source])
    expect(moved.arenaCookiesPlacedInBreakThisTurn?.[playerId] ?? 0).toBe(0)
    const trashed = executeCardEffect(before, context, { kind: 'field-to-trash', target: { side: 'self', min: 1, max: 1 } }, [source])
    expect(trashed.arenaCookiesPlacedInBreakThisTurn?.[playerId] ?? 0).toBe(0)
  })
})
