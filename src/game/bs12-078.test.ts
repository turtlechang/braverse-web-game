import { describe, expect, it } from 'vitest'
import { createBs12OnionDemoState as create, parseTestStateConfig } from './demo'
import { applyGameCommand } from './commands'
import { hasActivatableFlipEffect } from './battle'
import { commandFromLogEntry, replayCommands } from './replay'
import type { GameState } from './types'

const holder = 'player-one' as const
const enemy = 'player-two' as const
const activate = (state: GameState, discardHandIds = ['bs12-078-cost']) => applyGameCommand(state, { kind: 'resolve-flip', playerId: holder, activate: true, discardHandIds })
const choose = (state: GameState, cardIds = state.players[enemy].hand.slice(1, 3).map(c => c.instanceId)) => applyGameCommand(state, { kind: 'resolve-opponent-hand-discard', playerId: enemy, cardIds })
const finish = (state: GameState) => {
  let next = state
  for (let i = 0; next.pendingBattle && i < 8; i++) {
    if (next.pendingBattle.stage === 'damage') next = applyGameCommand(next, { kind: 'resolve-next-damage', playerId: next.pendingBattle.defenderPlayerId })
    else if (next.pendingBattle.stage === 'attack-effect') next = applyGameCommand(next, { kind: 'resolve-attack-effect', playerId: next.pendingBattle.attackerPlayerId, targetIds: [] })
    else break
  }
  return next
}
describe('078 public FLIP cost and opponent exact-two private selection', () => {
  it.each(['positive', 'six', 'item-cost', 'stage-cost', 'trap-cost'] as const)('pays a real purple Arena hand card, then lets only the opponent choose two: %s', scenario => {
    const before = create(scenario)
    const copy = structuredClone(before)
    expect(before.pendingBattle?.stage).toBe('flip')
    const paid = activate(before)
    expect(paid.players[holder].hand).toEqual([])
    expect(paid.players[holder].discardPile).toContainEqual(before.players[holder].hand[0])
    expect(paid.players[enemy]).toEqual(before.players[enemy])
    expect(paid.pendingOpponentHandDiscard).toMatchObject({ playerId: enemy, count: 2, sourceInstanceId: 'bs12-078-source' })
    const ids = before.players[enemy].hand.slice(1, 3).map(c => c.instanceId)
    expect(() => applyGameCommand(paid, { kind: 'resolve-opponent-hand-discard', playerId: holder, cardIds: ids })).toThrow()
    for (const cardIds of [[], ids.slice(0, 1), [ids[0], ids[0]], [...ids, before.players[enemy].hand[0].instanceId], ['foreign', ids[0]]]) {
      expect(() => choose(paid, cardIds)).toThrow()
    }
    const after = finish(choose(paid, ids))
    expect(after.players[enemy].hand).toEqual(before.players[enemy].hand.filter(c => !ids.includes(c.instanceId)))
    expect(after.players[enemy].discardPile).toEqual(before.players[enemy].hand.filter(c => ids.includes(c.instanceId)))
    expect(after.players[holder].discardPile.map(c => c.instanceId)).toEqual(['bs12-078-cost', 'bs12-078-source'])
    expect(after.players[holder].deck).toEqual(before.players[holder].deck)
    expect(after.players[holder].battleArea).toEqual(before.players[holder].battleArea)
    expect(after.pendingBattle).toBeNull()
    expect(after.pendingOpponentHandDiscard).toBeNull()
    expect(before).toEqual(copy)
  })
  it('does not activate or pay its FLIP when the opponent has only four hand cards', () => {
    const before = create('four')
    const source = before.pendingBattle?.revealedHpCard
    if (source?.flip) expect(hasActivatableFlipEffect(before, source.flip, { sourcePlayerId: holder, sourceInstanceId: source.instanceId }, 'bs12-078-bearer')).toBe(false)
    expect(before.pendingOpponentHandDiscard).toBeUndefined()
    expect(before.players[holder].hand.map(c => c.instanceId)).toEqual(['bs12-078-cost'])
    expect(before.players[enemy].hand).toHaveLength(4)
    if (before.pendingBattle?.stage === 'flip') {
      const skipped = applyGameCommand(before, { kind: 'resolve-flip', playerId: holder, activate: false })
      expect(finish(skipped).players[holder].hand).toEqual(before.players[holder].hand)
    }
  })
  it.each(['wrong-color', 'non-arena', 'split-cost', 'no-hand'] as const)('cannot pay an invalid or missing intersection cost: %s', scenario => {
    const before = create(scenario)
    const copy = structuredClone(before)
    expect(() => activate(before)).toThrow()
    expect(before).toEqual(copy)
  })
  it('rejects duplicate, multiple, opponent or support hand-cost identifiers', () => {
    const before = create()
    for (const ids of [[], ['bs12-078-cost', 'bs12-078-cost'], ['bs12-078-receiver-hand-0'], ['bs12-078-attacker-payment']]) expect(() => activate(before, ids)).toThrow()
  })
  it('declines without paying or affecting the opponent hand', () => {
    const before = create('decline')
    const after = finish(applyGameCommand(before, { kind: 'resolve-flip', playerId: holder, activate: false }))
    expect(after.players[holder].hand).toEqual(before.players[holder].hand)
    expect(after.players[enemy]).toEqual(before.players[enemy])
    expect(after.players[holder].discardPile.map(c => c.instanceId)).toEqual(['bs12-078-source'])
  })
  it('finishes the recipient choice before fainting the zero-HP bearer', () => {
    const before = create('last-hp')
    const paid = activate(before)
    expect(paid.players[holder].breakArea).toEqual([])
    expect(paid.pendingOpponentHandDiscard).not.toBeNull()
    const selected = choose(paid)
    expect(selected.players[holder].breakArea.map(c => c.instanceId)).toContain('bs12-078-bearer')
    const after = finish(selected)
    expect(after.players[holder].breakArea.map(c => c.instanceId)).toContain('bs12-078-bearer')
    expect(after.players[holder].battleArea.map(c => c.card.instanceId)).toEqual(['bs12-078-ally'])
    expect(after.players[enemy].hand).toHaveLength(3)
  })
  it('routes the already paid FLIP to the human recipient for exactly-two choice', () => {
    const state = create('receiver')
    expect(state.pendingOpponentHandDiscard).toMatchObject({ playerId: holder, count: 2 })
    expect(state.players[enemy].hand).toEqual([])
    expect(state.players[holder].hand).toHaveLength(5)
  })
  it.each(['positive', 'last-hp'] as const)('preserves recipient selection and faint continuation in replay and serialized state: %s', scenario => {
    const before = create(scenario)
    const paid = activate(before)
    expect(paid.pendingOpponentHandDiscard?.battleContinuation).toBe('flip-damage')
    const restored: GameState = JSON.parse(JSON.stringify(paid))
    const selected = choose(paid)
    expect(choose(restored)).toEqual(selected)
    const commands = (selected.commandLog ?? []).slice(before.commandLog?.length ?? 0).map(commandFromLogEntry)
    expect(commands.map(c => c.kind)).toEqual(['resolve-flip', 'resolve-opponent-hand-discard'])
    expect(replayCommands(before, commands)).toEqual(selected)
    expect(selected.players[holder].breakArea.map(c => c.instanceId)).toEqual(scenario === 'last-hp' ? ['bs12-078-bearer'] : [])
  })
  it('normally deploys three HP without a skill or On Play', () => {
    const before = create('deploy')
    const after = applyGameCommand(before, { kind: 'deploy-cookie', playerId: holder, instanceId: 'bs12-078-source' })
    expect(after.players[holder].battleArea[0].hpCards).toHaveLength(3)
    expect(after.players[holder].deck).toHaveLength(9)
    expect(after.pendingOnPlay).toBeNull()
  })
  it('pays PPP and deals ordinary three without an attack Then or FLIP activation', () => {
    const before = create('attack')
    const declared = applyGameCommand(before, { kind: 'declare-attack', playerId: holder, attackerInstanceId: 'bs12-078-source', targetInstanceId: 'bs12-078-attacker', supportPaymentIds: before.players[holder].supportArea.map(s => s.card.instanceId) })
    const after = finish(applyGameCommand(declared, { kind: 'skip-trap', playerId: enemy }))
    expect(after.players[enemy].battleArea.map(c => c.hpCards.length)).toEqual([1, 4])
    expect(after.players[holder].battleArea[0].hpCards).toHaveLength(3)
    expect(after.players[holder].supportArea.every(s => s.rested)).toBe(true)
    expect(after.pendingOpponentHandDiscard).toBeUndefined()
  })
  it.each(['wrong-energy', 'few-energy', 'rested-energy', 'source-rested', 'opponent-turn', 'outside-main'] as const)('rejects illegal PPP attack payment or timing: %s', scenario => {
    const before = create(scenario)
    expect(() => applyGameCommand(before, { kind: 'declare-attack', playerId: holder, attackerInstanceId: 'bs12-078-source', targetInstanceId: 'bs12-078-attacker', supportPaymentIds: before.players[holder].supportArea.map(s => s.card.instanceId) })).toThrow()
  })
  it.each(['positive', 'four', 'six', 'no-hand', 'wrong-color', 'non-arena', 'split-cost', 'item-cost', 'stage-cost', 'trap-cost', 'last-hp', 'decline', 'receiver', 'deploy', 'attack', 'wrong-energy', 'few-energy', 'rested-energy', 'source-rested', 'opponent-turn', 'outside-main'] as const)('keeps %s local with legal capacity and unique physical identities', scenario => {
    expect(parseTestStateConfig(`?test-state=bs12-078:${scenario}`, 'localhost')).toEqual({ kind: 'bs12-078', scenario })
    expect(parseTestStateConfig(`?test-state=bs12-078:${scenario}`, 'example.com')).toBeNull()
    const state = create(scenario)
    const ids = Object.values(state.players).flatMap(p => {
      expect(p.battleArea.length).toBeLessThanOrEqual(2)
      return [...p.hand, ...p.deck, ...p.breakArea, ...p.discardPile, ...p.supportArea.map(s => s.card), ...p.battleArea.flatMap(c => [c.card, ...c.hpCards])].map(c => c.instanceId)
    })
    if (state.pendingBattle?.revealedHpCard) ids.push(state.pendingBattle.revealedHpCard.instanceId)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
