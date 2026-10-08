import { describe, expect, it } from 'vitest'
import { createBs12ChouxDemoState, createBs12FlipDemoState, parseTestStateConfig } from './demo'
import { executeCardEffect, beginEffectDamageSequence } from './effects'
import { applyGameCommand, getPendingDecision } from './commands'
import { resolveNextDamage } from './battle'
import type { CardEffect, GameState } from './types'
import { assertBs12PhysicalFixture } from './bs12-physical-fixtures.test-helpers'

const playerId = 'player-one' as const
const context = { sourcePlayerId: playerId, sourceInstanceId: 'bs12-032-mover' }
const targetId = 'bs12-032-source'
const effects: CardEffect[] = [
  { kind: 'damage', amount: 2, target: { side: 'self', min: 0, max: 1 } },
  { kind: 'make-faint', target: { side: 'self', min: 0, max: 1 } },
]

describe.each(['BS12-032', 'BS12-032@1'] as const)('%s Arena effect-caused faint ruling', number => {
  it.each(['mechanism-faint', 'mechanism-faint-opponent-turn', 'mechanism-faint-non-arena'] as const)('uses printed nonArena BS8-010 Then or blocks declaration in %s', scenario => {
    expect(parseTestStateConfig(`?test-state=${number.toLowerCase()}:${scenario}`, 'localhost')).toMatchObject({ kind: 'bs12-032', scenario, cardNumber: number })
    expect(parseTestStateConfig(`?test-state=${number.toLowerCase()}:${scenario}`, 'example.com')).toBeNull()
    const before = createBs12ChouxDemoState(scenario, number)
    assertBs12PhysicalFixture(before)
    expect(before.pendingAbilityEffect).toBeUndefined()
    const mover = before.players[playerId].battleArea.find(entry => entry.card.instanceId === context.sourceInstanceId)!
    expect(mover.card.id).toBe('BS8-010')
    expect(mover.card.keywords ?? []).not.toContain('arena')
    if (scenario === 'mechanism-faint-opponent-turn') {
      expect(before.pendingBattle).toBeNull()
      expect(before.players[playerId].supportArea.map(entry => entry.rested)).toEqual([false, false, false])
      expect(() => applyGameCommand(before, { kind: 'declare-attack', playerId, attackerInstanceId: context.sourceInstanceId,
        targetInstanceId: 'bs12-032-opponent', supportPaymentIds: before.players[playerId].supportArea.map(entry => entry.card.instanceId),
      })).toThrow()
      expect(before.players[playerId].breakArea).toHaveLength(0)
      expect(before.pendingAfterDamageEffects).toBeUndefined()
      return
    }
    expect(before.pendingBattle).toMatchObject({ attackerInstanceId: context.sourceInstanceId, stage: 'attack-effect' })
    expect(before.players[playerId].supportArea.map(entry => entry.rested)).toEqual([true, true, true])
    const after = applyGameCommand(before, { kind: 'resolve-attack-effect', playerId, targetIds: [targetId] })
    assertBs12PhysicalFixture(after)
    expect(after.players[playerId].breakArea.map(card => card.instanceId)).toEqual([targetId])
    expect(after.players[playerId].discardPile).toHaveLength(2)
    expect(after.players[playerId].battleArea).toHaveLength(1)
    expect(after.players[playerId].battleArea[0].hpCards).toHaveLength(4)
    expect(after.players[playerId].deck).toHaveLength(12)
    expect(after.pendingAfterDamageEffects).toBeUndefined()
  })
  it.each(['arena-faint', 'arena-faint-nested', 'arena-faint-no-condition'] as const)('uses real printed 004 in %s', scenario => {
    const before = createBs12ChouxDemoState(scenario, number)
    expect(before.players['player-two'].battleArea[0].card.id).toBe('BS12-001')
    expect(before.players['player-two'].battleArea[0].hpCards).toHaveLength(1)
    expect(before.players['player-two'].battleArea[1].card.id).toBe(scenario === 'arena-faint-no-condition' ? 'ST4-001' : 'BS12-003')
    expect(before.players['player-two'].battleArea[1].hpCards).toHaveLength(scenario === 'arena-faint-no-condition' ? 3 : 2)
    const attacked = applyGameCommand(before, { kind: 'declare-attack', playerId,
      attackerInstanceId: targetId, targetInstanceId: 'bs12-032-opponent',
      supportPaymentIds: before.players[playerId].supportArea.map(entry => entry.card.instanceId),
    })
    const ready = applyGameCommand(attacked, { kind: 'skip-trap', playerId: 'player-two' })
    let next = applyGameCommand(ready, { kind: 'resolve-next-damage', playerId: 'player-two' })
    if (scenario === 'arena-faint-no-condition') {
      expect(next.pendingBattle?.stage).not.toBe('flip')
      expect(next.pendingAfterDamageEffects).toBeUndefined()
      expect(next.players[playerId].battleArea[0].hpCards).toHaveLength(1)
      return
    }
    expect(next.pendingBattle?.stage).toBe('flip')
    next = applyGameCommand(next, { kind: 'resolve-flip', playerId: 'player-two', activate: true, targetIds: [targetId] })
    for (let i = 0; i < 12 && next.pendingBattle?.effectDamageSequence; i++) {
      next = next.pendingBattle.stage === 'flip'
        ? applyGameCommand(next, { kind: 'resolve-flip', playerId, activate: false })
        : resolveNextDamage(next)
    }
    expect(next.players[playerId].breakArea.map(card => card.instanceId)).toEqual([targetId])
    expect(next.pendingAfterDamageEffects).toHaveLength(1)
    expect(getPendingDecision(next)?.kind).toBe('after-damage-effect')
  })
  it.each(effects)('queues HP after $kind causes a real faint', effect => {
    // Isolated shared effect mechanism; this does not represent BS7-033's printed skill.
    const before = createBs12ChouxDemoState('positive', number)
    const snapshot = structuredClone(before)
    const fainted = executeCardEffect(before, context, effect, [targetId])
    expect(before).toEqual(snapshot)
    expect(fainted.players[playerId].breakArea.map(c => c.instanceId)).toEqual([targetId])
    expect(fainted.players[playerId].discardPile).toHaveLength(2)
    expect(fainted.cookiesFaintedThisTurn?.[playerId]).toBe(1)
    expect(fainted.pendingAfterDamageEffects).toHaveLength(1)
    const done = applyGameCommand(fainted, { kind: 'resolve-after-damage-effect', playerId, targetIds: [context.sourceInstanceId] })
    expect(done.players[playerId].battleArea[0].hpCards).toHaveLength(6)
    expect(done.players[playerId].deck).toHaveLength(11)
    expect(done.pendingAfterDamageEffects).toBeUndefined()
  })
  it.each(effects)('does not trigger $kind on the opponent turn', effect => {
    const initial = createBs12ChouxDemoState('positive', number)
    const before: GameState = { ...initial, activePlayerId: 'player-two' }
    const done = executeCardEffect(before, context, effect, [targetId])
    expect(done.players[playerId].breakArea).toHaveLength(1)
    expect(done.pendingAfterDamageEffects).toBeUndefined()
    expect(done.players[playerId].deck).toHaveLength(12)
  })
  it.each(effects)('does not trigger $kind from a non-Arena source', effect => {
    const initial = createBs12ChouxDemoState('non-arena', number)
    const done = executeCardEffect(initial, context, effect, [targetId])
    expect(done.players[playerId].breakArea).toHaveLength(1)
    expect(done.pendingAfterDamageEffects).toBeUndefined()
  })
  it('collects a deferred effect-damage faint exactly once, after the sequence', () => {
    const before = createBs12ChouxDemoState('positive', number)
    let next = beginEffectDamageSequence(before, context, [{ playerId, instanceId: targetId, damage: 2 }], true)!
    expect(next.pendingAfterDamageEffects).toBeUndefined()
    for (let i = 0; i < 10 && next.pendingBattle?.effectDamageSequence; i++) next = resolveNextDamage(next)
    expect(next.pendingBattle?.effectDamageSequence).toBeUndefined()
    expect(next.players[playerId].breakArea).toHaveLength(1)
    expect(next.pendingAfterDamageEffects).toHaveLength(1)
    expect(getPendingDecision(next)?.kind).toBe('after-damage-effect')
    const done = applyGameCommand(next, { kind: 'resolve-after-damage-effect', playerId, targetIds: [context.sourceInstanceId] })
    expect(done.players[playerId].battleArea[0].hpCards).toHaveLength(6)
  })
  it('retains a revealed Arena FLIP source through a second HP FLIP', () => {
    const initial = createBs12ChouxDemoState('positive', number)
    const hpFlip = createBs12FlipDemoState('positive').pendingBattle!.revealedHpCard!
    const arenaFlip = createBs12FlipDemoState('positive', 'BS12-004').pendingBattle!.revealedHpCard!
    const before: GameState = { ...initial,
      players: { ...initial.players, [playerId]: { ...initial.players[playerId], battleArea: initial.players[playerId].battleArea.map((entry, i) =>
        i === 0 ? { ...entry, hpCards: [hpFlip] } : entry) } },
      pendingBattle: { ...createBs12FlipDemoState('positive', 'BS12-004').pendingBattle!,
        attackerPlayerId: 'player-one', defenderPlayerId: 'player-two', revealedHpCard: arenaFlip,
      },
    }
    const sourceContext = { sourcePlayerId: 'player-two' as const, sourceInstanceId: arenaFlip.instanceId }
    let next = executeCardEffect(before, sourceContext, { kind: 'damage', amount: 1, target: { side: 'opponent', min: 0, max: 1 } }, [targetId])
    expect(next.pendingBattle?.effectDamageSequence).toBeDefined()
    for (let i = 0; i < 12 && next.pendingBattle?.effectDamageSequence; i++) {
      next = next.pendingBattle.stage === 'flip'
        ? applyGameCommand(next, { kind: 'resolve-flip', playerId, activate: false })
        : resolveNextDamage(next)
    }
    expect(next.pendingBattle?.effectDamageSequence).toBeUndefined()
    expect(next.pendingAfterDamageEffects).toHaveLength(1)
    expect(next.players[playerId].breakArea.map(c => c.instanceId)).toEqual([targetId])
  })
  it('finishes two sequential faint targets before either standby choice', () => {
    const initial = createBs12ChouxDemoState('positive', number)
    const arenaSource = createBs12ChouxDemoState('arena-faint', number).players['player-two'].battleArea[0].card
    const first = initial.players[playerId].battleArea[0]
    const second = { ...first, card: { ...first.card, instanceId: 'second-choux' },
      battleEntryId: 'second-choux-entry', hpCards: first.hpCards.map(card => ({ ...card, instanceId: `second-${card.instanceId}` })),
    }
    const before: GameState = { ...initial, players: { ...initial.players,
      [playerId]: { ...initial.players[playerId], battleArea: [first, second] },
      'player-two': { ...initial.players['player-two'], battleArea: initial.players['player-two'].battleArea.map((entry, index) =>
        index === 0 ? { ...entry, card: arenaSource } : entry) },
    } }
    let next = beginEffectDamageSequence(before, { sourcePlayerId: 'player-two', sourceInstanceId: 'bs12-032-opponent' },
      [targetId, 'second-choux'].map(instanceId => ({ playerId, instanceId, damage: 2 })), true)!
    for (let i = 0; i < 15 && next.pendingBattle?.effectDamageSequence; i++) next = resolveNextDamage(next)
    expect(next.pendingBattle?.effectDamageSequence).toBeUndefined()
    expect(next.players[playerId].breakArea).toHaveLength(2)
    expect(next.pendingAfterDamageEffects).toHaveLength(2)
    expect(getPendingDecision(next)?.kind).toBe('after-damage-effect')
    next = applyGameCommand(next, { kind: 'resolve-after-damage-effect', playerId, targetIds: [] })
    next = applyGameCommand(next, { kind: 'resolve-after-damage-effect', playerId, targetIds: [] })
    expect(next.pendingAfterDamageEffects).toBeUndefined()
  })
  it('does not attach Arena provenance to deferred non-Arena damage', () => {
    const before = createBs12ChouxDemoState('non-arena', number)
    let next = beginEffectDamageSequence(before, context, [{ playerId, instanceId: targetId, damage: 2 }], true)!
    expect(next.pendingBattle?.effectDamageSequence?.arenaBreakEntryContext).toBeUndefined()
    for (let i = 0; i < 10 && next.pendingBattle?.effectDamageSequence; i++) next = resolveNextDamage(next)
    expect(next.players[playerId].breakArea).toHaveLength(1)
    expect(next.pendingAfterDamageEffects).toBeUndefined()
  })
  it('does not create HP at the terminal Break level', () => {
    const initial = createBs12ChouxDemoState('positive', number)
    const source = initial.players[playerId].battleArea[0].card
    const before = { ...initial, players: { ...initial.players, [playerId]: { ...initial.players[playerId],
      breakArea: Array.from({ length: 9 }, (_, i) => ({ ...source, instanceId: `old-${i}` })),
    } } }
    const done = executeCardEffect(before, context, effects[1], [targetId])
    expect(done.status).toBe('finished')
    expect(done.pendingAfterDamageEffects).toBeUndefined()
  })
})
