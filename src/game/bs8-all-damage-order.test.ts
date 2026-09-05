import { describe, expect, it } from 'vitest'
import { applyGameCommand } from './commands'
import { createCardCheckDemoState } from './demo'
import { executeCardEffect, getEffectTargetCandidatesForEffect } from './effects'
import { resolveNextDamage } from './battle'
import { takeAiStep } from './ai'
import type { GameState } from './types'

const setup = (number = 'BS8-024') => {
  const state = createCardCheckDemoState(number)
  const card = state.players['player-one'].hand.find(card => card.id === number)!
  const effect = (card.stageAbility?.effects ?? card.trap?.effects)?.[0]
  if (effect?.kind !== 'damage-all') throw new Error('Expected all-Cookie damage')
  const context = { sourcePlayerId: 'player-one' as const, sourceInstanceId: card.instanceId }
  return { state, card, effect, context }
}

const drainDamage = (initial: GameState) => {
  let state = initial
  for (let i = 0; i < 20 && state.pendingBattle?.effectDamageSequence; i++) {
    state = resolveNextDamage(state)
  }
  expect(state.pendingBattle?.effectDamageSequence).toBeUndefined()
  return state
}

describe('BS8 all-Cookie damage across both players', () => {
  it.each([1, 2, 3, 4, 5] as const)('AI level %i submits a complete legal trap order', level => {
    const { state } = setup('BS8-023')
    const decision = takeAiStep(state, 'player-one', { level, seed: 1 })
    expect(decision.action).toBe('play-trap')
    expect(decision.state.pendingBattle?.effectDamageSequence).toBeDefined()
    expect(drainDamage(decision.state).pendingBattle?.remainingDamage).toBe(6)
  })
  it.each(['BS8-023', 'BS8-024'])('%s offers both players in one ordered selection', number => {
    const { state, effect, context } = setup(number)
    expect(effect).toMatchObject({ side: 'either', sequential: true, target: { side: 'either' } })
    const candidates = getEffectTargetCandidatesForEffect(state, context, effect)
    expect(candidates.map(cookie => cookie.card.instanceId)).toEqual(
      Object.values(state.players).flatMap(player => player.battleArea)
        .filter(cookie => number !== 'BS8-023' || cookie.hpCards.length >= 2)
        .map(cookie => cookie.card.instanceId),
    )
  })

  it('preserves each selected owner when the opponent is first and self is last', () => {
    const { state, effect, context } = setup()
    const own = state.players['player-one'].battleArea
    const opponent = state.players['player-two'].battleArea
    const targets = [...opponent, ...own].map(cookie => cookie.card.instanceId)
    const before = structuredClone(state)
    const started = executeCardEffect(state, context, effect, targets)
    expect(started.pendingBattle).toMatchObject({
      damagePlayerId: 'player-two', damageTargetInstanceId: targets[0],
      effectDamageSequence: { remainingTargets: [
        ...opponent.slice(1).map(cookie => ({ playerId: 'player-two', instanceId: cookie.card.instanceId, damage: 1 })),
        ...own.map(cookie => ({ playerId: 'player-one', instanceId: cookie.card.instanceId, damage: 1 })),
      ] },
    })
    const resolved = drainDamage(started)
    for (const playerId of ['player-one', 'player-two'] as const) {
      expect(resolved.players[playerId].battleArea.map(cookie => cookie.hpCards.length)).toEqual(
        state.players[playerId].battleArea.map(cookie => cookie.hpCards.length - 1),
      )
    }
    expect(state).toEqual(before)
  })

  it('excludes damage immunity from the same UI and execution candidate set', () => {
    const { state, effect, context } = setup()
    const protectedId = state.players['player-two'].battleArea[0].card.instanceId
    state.effectDamagePreventedUntilTurn = { [protectedId]: state.turnNumber }
    const candidates = getEffectTargetCandidatesForEffect(state, context, effect)
    expect(candidates.map(cookie => cookie.card.instanceId)).not.toContain(protectedId)
    const ids = candidates.map(cookie => cookie.card.instanceId)
    expect(() => executeCardEffect(state, context, effect, ids.slice(1))).toThrow()
    expect(() => executeCardEffect(state, context, effect, [...ids, ids[0]])).toThrow()
    expect(() => executeCardEffect(state, context, effect, [...ids, protectedId])).toThrow()
    const resolved = drainDamage(executeCardEffect(state, context, effect, ids))
    expect(resolved.players['player-two'].battleArea[0]).toEqual(state.players['player-two'].battleArea[0])
  })

  it('resumes the original attack after trap damage finishes on the attacker', () => {
    const { state, card } = setup('BS8-023')
    const originalBattle = state.pendingBattle!
    const targets = [state.players['player-one'].battleArea[0], state.players['player-two'].battleArea[0]]
      .map(cookie => cookie.card.instanceId)
    const played = applyGameCommand(state, { kind: 'play-trap', playerId: 'player-one', trapInstanceId: card.instanceId,
      paymentIds: ['support-pay-0', 'support-pay-1'], targetIds: targets })
    const resolved = drainDamage(played)
    expect(resolved.pendingBattle).toMatchObject({
      attackerInstanceId: originalBattle.attackerInstanceId,
      targetInstanceId: originalBattle.targetInstanceId,
      stage: 'damage', remainingDamage: 6,
    })
    expect(resolved.pendingBattle?.damagePlayerId).toBeUndefined()
    expect(resolved.pendingBattle?.damageTargetInstanceId).toBeUndefined()
    const attacked = resolveNextDamage(resolved)
    expect(attacked.players['player-two'].battleArea[0].hpCards).toHaveLength(4)
    expect(attacked.players['player-one'].battleArea[0].hpCards).toHaveLength(3)
  })

  it('rejects incomplete, duplicate and foreign trap target lists before payment', () => {
    const { state, card } = setup('BS8-023')
    const ids = Object.values(state.players).map(player => player.battleArea[0].card.instanceId)
    const before = structuredClone(state)
    for (const targetIds of [[], ids.slice(0, 1), [...ids, ids[0]], [...ids, 'not-in-battle']]) {
      expect(() => applyGameCommand(state, { kind: 'play-trap', playerId: 'player-one',
        trapInstanceId: card.instanceId, paymentIds: ['support-pay-0', 'support-pay-1'], targetIds })).toThrow()
      expect(state).toEqual(before)
    }
  })

  it('waits for the first opponent FLIP before damaging the next player and counts the faint', () => {
    const { state, effect, context } = setup()
    const flip = createCardCheckDemoState('BS8-023').players['player-one'].battleArea[1].hpCards[0]
    const first = state.players['player-two'].battleArea[0]
    first.hpCards = [{ ...flip, instanceId: 'ordered-flip-hp' }]
    const own = state.players['player-one'].battleArea[0]
    const last = state.players['player-two'].battleArea[1]
    const started = executeCardEffect(state, context, effect,
      [first.card.instanceId, own.card.instanceId, last.card.instanceId])
    const paused = resolveNextDamage(started)
    expect(paused.pendingBattle).toMatchObject({ stage: 'flip', damagePlayerId: 'player-two' })
    expect(paused.players['player-one'].battleArea[0]).toEqual(own)
    expect(paused.players['player-two'].battleArea[1]).toEqual(last)
    expect(() => applyGameCommand(paused, { kind: 'resolve-flip', playerId: 'player-one', activate: false })).toThrow()
    const skipped = applyGameCommand(paused, { kind: 'resolve-flip', playerId: 'player-two', activate: false })
    const resolved = drainDamage(skipped)
    expect(resolved.players['player-two'].breakArea).toContainEqual(first.card)
    expect(resolved.cookiesFaintedThisTurn?.['player-two']).toBe(1)
    expect(resolved.players['player-one'].battleArea[0].hpCards).toHaveLength(own.hpCards.length - 1)
    expect(resolved.players['player-two'].battleArea[0].hpCards).toHaveLength(last.hpCards.length - 1)
  })
})
