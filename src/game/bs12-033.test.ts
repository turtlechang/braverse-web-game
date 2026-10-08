import { describe, expect, it } from 'vitest'
import { createBs12EspressoDemoState, parseTestStateConfig } from './demo'
import { applyGameCommand, getPendingDecision } from './commands'
import { executeCardEffect } from './effects'
import type { CardEffect } from './types'
import { describeCommandSteps } from './command-log'
import { resolveNextDamage } from './battle'
const playerId = 'player-one' as const
const sourceId = 'bs12-032-source'
const arenaContext = { sourcePlayerId: playerId, sourceInstanceId: 'bs12-032-mover' }

describe.each(['BS12-033', 'BS12-033@1'] as const)('%s source Break entry optional draw', number => {
  it.each([0, 1])('waits for printed BS7-033 damage then allows draw %s', count => {
    const before = createBs12EspressoDemoState('on-play', number)
    expect(parseTestStateConfig(`?test-state=${number.toLowerCase()}:on-play`, 'localhost')).toMatchObject({ kind: 'bs12-033', cardNumber: number })
    expect(parseTestStateConfig(`?test-state=${number.toLowerCase()}:on-play`, 'example.com')).toBeNull()
    const paid = applyGameCommand(before, { kind: 'begin-activate-skill', playerId,
      sourceInstanceId: arenaContext.sourceInstanceId, trigger: 'on-play', paymentIds: [], trashBattleCookieIds: [sourceId],
    })
    expect(paid.pendingAfterDamageEffects).toHaveLength(1)
    expect(() => applyGameCommand(paid, { kind: 'resolve-after-damage-effect', playerId, targetIds: [] })).toThrow()
    const damaged = applyGameCommand(paid, { kind: 'resolve-ability-effect', playerId, targetIds: ['bs12-032-opponent'] })
    expect(damaged.players['player-two'].battleArea[0].hpCards).toHaveLength(4)
    const choice = applyGameCommand(damaged, { kind: 'resolve-after-damage-effect', playerId, targetIds: [] })
    // Runtime IDs are shared by alternate prints; their image URL stays distinct.
    expect(choice.pendingDrawUpTo).toMatchObject({ max: 1, sourceCardId: 'BS12-033', sourceCardName: 'Espresso Cookie' })
    expect(choice.pendingDrawUpTo?.effectText).toMatch(/draw up to 1/)
    expect(getPendingDecision(choice)?.kind).toBe('draw-up-to')
    expect(describeCommandSteps(damaged, choice, { kind: 'resolve-after-damage-effect', playerId, targetIds: [] })?.map(step => step.text).join(' ')).toMatch(/抽牌/)
    const done = applyGameCommand(choice, { kind: 'resolve-draw-up-to', playerId, drawCount: count })
    expect(done.players[playerId].hand).toHaveLength(count)
    expect(done.players[playerId].deck).toHaveLength(12 - count)
    expect(done.players[playerId].battleArea[0].hpCards).toHaveLength(5)
    expect(done.players[playerId].discardPile).toHaveLength(2)
  })
  it.each(['non-arena', 'opponent-turn'] as const)('does not trigger direct movement in %s', scenario => {
    const before = createBs12EspressoDemoState(scenario, number)
    const done = executeCardEffect(before, arenaContext, { kind: 'battle-to-break', target: { side: 'self', min: 0, max: 1 } }, [sourceId])
    expect(done.players[playerId].breakArea).toHaveLength(1)
    expect(done.pendingAfterDamageEffects).toBeUndefined()
  })
  it.each(['damage', 'make-faint'] as const)('shares the confirmed Arena effect %s cause', kind => {
    const before = createBs12EspressoDemoState('positive', number)
    const effect: CardEffect = kind === 'damage' ? { kind, amount: 2, target: { side: 'self', min: 0, max: 1 } }
      : { kind, target: { side: 'self', min: 0, max: 1 } }
    const fainted = executeCardEffect(before, arenaContext, effect, [sourceId])
    expect(fainted.pendingAfterDamageEffects).toHaveLength(1)
    expect(fainted.pendingAfterDamageEffects?.[0].effect).toEqual({ kind: 'draw-up-to', max: 1 })
  })
  it('rejects more than one card and another player without changing the choice', () => {
    const moved = executeCardEffect(createBs12EspressoDemoState('positive', number), arenaContext,
      { kind: 'battle-to-break', target: { side: 'self', min: 0, max: 1 } }, [sourceId])
    const choice = applyGameCommand(moved, { kind: 'resolve-after-damage-effect', playerId, targetIds: [] })
    expect(() => applyGameCommand(choice, { kind: 'resolve-draw-up-to', playerId, drawCount: 2 })).toThrow()
    expect(() => applyGameCommand(choice, { kind: 'resolve-draw-up-to', playerId: 'player-two', drawCount: 1 })).toThrow()
    expect(choice.players[playerId].deck).toHaveLength(12)
  })
  it('rejects a Cookie target for the untargeted draw standby effect', () => {
    const moved = executeCardEffect(createBs12EspressoDemoState('positive', number), arenaContext,
      { kind: 'battle-to-break', target: { side: 'self', min: 0, max: 1 } }, [sourceId])
    expect(() => applyGameCommand(moved, { kind: 'resolve-after-damage-effect', playerId, targetIds: [arenaContext.sourceInstanceId] })).toThrow()
  })
  it('waits for the printed 028 hand-cost draw before its own optional draw', () => {
    const before = createBs12EspressoDemoState('cost-hand', number)
    const costPaid = applyGameCommand(before, { kind: 'begin-play-item', playerId, instanceId: 'bs12-032-item',
      paymentIds: ['bs12-032-payment-0'], handToBreakAreaIds: [sourceId],
    })
    const paid = applyGameCommand(costPaid, { kind: 'resolve-ability-effect', playerId, targetIds: [] })
    expect(paid.pendingDrawUpTo?.max).toBe(3)
    expect(() => applyGameCommand(paid, { kind: 'resolve-after-damage-effect', playerId, targetIds: [] })).toThrow()
    const outerDone = applyGameCommand(paid, { kind: 'resolve-draw-up-to', playerId, drawCount: 0 })
    const choice = applyGameCommand(outerDone, { kind: 'resolve-after-damage-effect', playerId, targetIds: [] })
    expect(choice.pendingDrawUpTo).toMatchObject({ max: 1, sourceCardId: 'BS12-033' })
    const done = applyGameCommand(choice, { kind: 'resolve-draw-up-to', playerId, drawCount: 1 })
    expect(done.players[playerId].hand).toHaveLength(1)
    expect(done.players[playerId].deck).toHaveLength(11)
  })
  it.each(['arena-faint', 'arena-faint-nested'] as const)('keeps printed 004 causality in %s', scenario => {
    const before = createBs12EspressoDemoState(scenario, number)
    let next = applyGameCommand(before, { kind: 'declare-attack', playerId, attackerInstanceId: sourceId,
      targetInstanceId: 'bs12-032-opponent', supportPaymentIds: before.players[playerId].supportArea.map(entry => entry.card.instanceId),
    })
    next = applyGameCommand(next, { kind: 'skip-trap', playerId: 'player-two' })
    next = applyGameCommand(next, { kind: 'resolve-next-damage', playerId: 'player-two' })
    next = applyGameCommand(next, { kind: 'resolve-flip', playerId: 'player-two', activate: true, targetIds: [sourceId] })
    for (let i = 0; i < 12 && next.pendingBattle?.effectDamageSequence; i++) {
      next = next.pendingBattle.stage === 'flip'
        ? applyGameCommand(next, { kind: 'resolve-flip', playerId, activate: false }) : resolveNextDamage(next)
    }
    expect(next.pendingAfterDamageEffects).toHaveLength(1)
    expect(next.pendingAfterDamageEffects?.[0].effect).toEqual({ kind: 'draw-up-to', max: 1 })
    const choice = applyGameCommand(next, { kind: 'resolve-after-damage-effect', playerId, targetIds: [] })
    expect(choice.pendingDrawUpTo?.sourceCardId).toBe('BS12-033')
  })
  it.each(['break-to-trash', 'break-to-hand'] as const)('handles public/private source movement %s before activation', kind => {
    const moved = executeCardEffect(createBs12EspressoDemoState('positive', number), arenaContext,
      { kind: 'battle-to-break', target: { side: 'self', min: 0, max: 1 } }, [sourceId])
    const effect: CardEffect = kind === 'break-to-trash' ? { kind, max: 1 } : { kind, amount: 1 }
    const changed = executeCardEffect(moved, arenaContext, effect, [sourceId])
    expect(changed.pendingAfterDamageEffects?.length ?? 0).toBe(kind === 'break-to-trash' ? 1 : 0)
  })
})
