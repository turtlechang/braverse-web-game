import { describe, expect, it } from 'vitest'
import { applyGameCommand } from './commands'
import {
  createBs1009HpCostPreviewDemoState,
  parseTestStateConfig,
} from './demo'

const sourceId = 'bs10-009-preview-source'

describe('BS10-009 dedicated localhost HP-cost preview', () => {
  it('accepts only the reviewed scenario names on localhost', () => {
    expect(parseTestStateConfig(
      '?test-state=bs10-009-hp-cost&scenario=normal',
      'localhost',
    )).toEqual({ kind: 'bs10-009-hp-cost', scenario: 'normal' })
    expect(parseTestStateConfig(
      '?test-state=bs10-009-hp-cost&scenario=unknown',
      'localhost',
    )).toBeNull()
    expect(parseTestStateConfig(
      '?test-state=bs10-009-hp-cost&scenario=normal',
      'example.test',
    )).toBeNull()
  })

  it.each(['normal', 'source-last-hp', 'ally-last-hp', 'mixed-support', 'wrong-target', 'once-used'] as const)(
    'builds a clean real-card state for %s',
    (scenario) => {
      const state = createBs1009HpCostPreviewDemoState(scenario)
      const own = state.players['player-one']
      expect(own.battleArea).toHaveLength(2)
      expect(own.battleArea[0]?.card.id).toBe('BS10-009')
      expect(own.battleArea[0]?.card.level).toBe(2)
      expect(state.pendingBattle).toBeNull()
      expect(state.pendingAbilityEffect).toBeUndefined()
      expect(state.pendingReplacement).toBeNull()
    },
  )

  it('pays the source HP through the real command and records the source-only red reduction', () => {
    const state = createBs1009HpCostPreviewDemoState('normal')
    const paid = applyGameCommand(state, {
      kind: 'begin-activate-skill',
      playerId: 'player-one',
      sourceInstanceId: sourceId,
      trigger: 'activate',
      paymentIds: [],
      hpToTrashTargetIds: [sourceId],
    })
    expect(paid.players['player-one'].battleArea[0]?.hpCards).toHaveLength(1)
    expect(paid.players['player-one'].discardPile.map((card) => card.id)).toContain('BS6-047')
    expect(paid.pendingAbilityEffect).toBeTruthy()
    const resolved = applyGameCommand(paid, {
      kind: 'resolve-ability-effect', playerId: 'player-one', targetIds: [sourceId],
    })
    expect(resolved.pendingAbilityEffect).toBeUndefined()
    expect(resolved.attackCostModifiers).toEqual(expect.arrayContaining([
      expect.objectContaining({ targetInstanceId: sourceId, energyCost: { red: 1 } }),
    ]))
    expect(resolved.skillUsesThisTurn).toContain('bs10-009-preview-source:battle:1')
  })

  it('allows a real allied LV2 Cookie to pay its top HP while leaving Cranberry active', () => {
    const state = createBs1009HpCostPreviewDemoState('ally-last-hp')
    const allyId = state.players['player-one'].battleArea[1]!.card.instanceId
    const paid = applyGameCommand(state, {
      kind: 'begin-activate-skill',
      playerId: 'player-one',
      sourceInstanceId: sourceId,
      trigger: 'activate',
      paymentIds: [],
      hpToTrashTargetIds: [allyId],
    })
    expect(paid.players['player-one'].battleArea.some((entry) => entry.card.instanceId === sourceId)).toBe(true)
    expect(paid.players['player-one'].battleArea.some((entry) => entry.card.instanceId === allyId)).toBe(false)
    expect(paid.cookiesFaintedThisTurn?.['player-one']).toBe(1)
    expect(paid.pendingFaintEffects).toHaveLength(1)
    let faintResolved = paid.pendingFaintEffects?.length
      ? applyGameCommand(paid, { kind: 'resolve-faint-effect', playerId: 'player-one', targetIds: [] })
      : paid
    expect(faintResolved.pendingDrawUpTo?.max).toBe(2)
    if (faintResolved.pendingDrawUpTo) {
      faintResolved = applyGameCommand(faintResolved, {
        kind: 'resolve-draw-up-to', playerId: 'player-one', drawCount: 0,
      })
    }
    expect(faintResolved.pendingDrawUpTo).toBeNull()
    const resolved = applyGameCommand(faintResolved, {
      kind: 'resolve-ability-effect', playerId: 'player-one', targetIds: [sourceId],
    })
    const finished = resolved.pendingReplacement
      ? applyGameCommand(resolved, { kind: 'skip-replacement', playerId: 'player-one' })
      : resolved
    expect(finished.pendingFaintEffects ?? null).toBeNull()
    expect(finished.pendingReplacement).toBeNull()
    expect(finished.cookiesFaintedThisTurn?.['player-one']).toBe(1)
    expect(finished.attackCostModifiers).toEqual(expect.arrayContaining([
      expect.objectContaining({ targetInstanceId: sourceId, energyCost: { red: 1 } }),
    ]))
  })

  it('pays the source final HP, completes the ability, and does not transfer the reduction to the ally', () => {
    const state = createBs1009HpCostPreviewDemoState('source-last-hp')
    const allyId = state.players['player-one'].battleArea[1]!.card.instanceId
    const paid = applyGameCommand(state, {
      kind: 'begin-activate-skill', playerId: 'player-one', sourceInstanceId: sourceId,
      trigger: 'activate', paymentIds: [], hpToTrashTargetIds: [sourceId],
    })
    expect(paid.players['player-one'].battleArea.some((entry) => entry.card.instanceId === sourceId)).toBe(false)
    const resolved = applyGameCommand(paid, {
      kind: 'resolve-ability-effect', playerId: 'player-one', targetIds: [sourceId],
    })
    expect(resolved.pendingAbilityEffect).toBeUndefined()
    const finished = resolved.pendingReplacement
      ? applyGameCommand(resolved, { kind: 'skip-replacement', playerId: 'player-one' })
      : resolved
    expect(finished.pendingReplacement).toBeNull()
    expect(finished.attackCostModifiers ?? []).toEqual([])
    expect(finished.attackCostModifiers?.some((modifier) => modifier.targetInstanceId === allyId)).toBe(false)
  })

  it('rejects opponent, LV1, and a second activation without changing the clean state', () => {
    const wrongTargetState = createBs1009HpCostPreviewDemoState('wrong-target')
    const wrongTargetSnapshot = JSON.stringify(wrongTargetState)
    const wrongTargetId = wrongTargetState.players['player-one'].battleArea[1]!.card.instanceId
    expect(() => applyGameCommand(wrongTargetState, {
      kind: 'begin-activate-skill', playerId: 'player-one', sourceInstanceId: sourceId,
      trigger: 'activate', paymentIds: [], hpToTrashTargetIds: [wrongTargetId],
    })).toThrow()
    expect(JSON.stringify(wrongTargetState)).toBe(wrongTargetSnapshot)
    const opponentId = wrongTargetState.players['player-two'].battleArea[0]!.card.instanceId
    expect(() => applyGameCommand(wrongTargetState, {
      kind: 'begin-activate-skill', playerId: 'player-one', sourceInstanceId: sourceId,
      trigger: 'activate', paymentIds: [], hpToTrashTargetIds: [opponentId],
    })).toThrow()
    expect(JSON.stringify(wrongTargetState)).toBe(wrongTargetSnapshot)

    const onceState = createBs1009HpCostPreviewDemoState('once-used')
    const onceSnapshot = JSON.stringify(onceState)
    expect(() => applyGameCommand(onceState, {
      kind: 'begin-activate-skill', playerId: 'player-one', sourceInstanceId: sourceId,
      trigger: 'activate', paymentIds: [], hpToTrashTargetIds: [sourceId],
    })).toThrow()
    expect(JSON.stringify(onceState)).toBe(onceSnapshot)
  })

  it('uses the reduced one-red cost for a real Cranberry attack after activation', () => {
    const state = createBs1009HpCostPreviewDemoState('mixed-support')
    const paid = applyGameCommand(state, {
      kind: 'begin-activate-skill', playerId: 'player-one', sourceInstanceId: sourceId,
      trigger: 'activate', paymentIds: [], hpToTrashTargetIds: [sourceId],
    })
    const resolved = applyGameCommand(paid, {
      kind: 'resolve-ability-effect', playerId: 'player-one', targetIds: [sourceId],
    })
    const redSupportId = resolved.players['player-one'].supportArea[0]!.card.instanceId
    const greenSupportId = resolved.players['player-one'].supportArea[1]!.card.instanceId
    expect(() => applyGameCommand(resolved, {
      kind: 'declare-attack', playerId: 'player-one', attackerInstanceId: sourceId,
      targetInstanceId: resolved.players['player-two'].battleArea[0]!.card.instanceId,
      supportPaymentIds: [greenSupportId],
    })).toThrow()
    const attacked = applyGameCommand(resolved, {
      kind: 'declare-attack', playerId: 'player-one', attackerInstanceId: sourceId,
      targetInstanceId: resolved.players['player-two'].battleArea[0]!.card.instanceId,
      supportPaymentIds: [redSupportId],
    })
    expect(attacked.pendingBattle?.attackerInstanceId).toBe(sourceId)
    expect(attacked.players['player-one'].supportArea.filter((support) => support.rested)).toHaveLength(1)
    const afterTrap = applyGameCommand(attacked, { kind: 'skip-trap', playerId: 'player-two' })
    const settled = applyGameCommand(afterTrap, { kind: 'resolve-battle', playerId: 'player-one' })
    expect(settled.players['player-two'].battleArea[0]?.hpCards).toHaveLength(3)
    expect(settled.players['player-one'].supportArea[0]?.rested).toBe(true)
    expect(settled.players['player-one'].supportArea[1]?.rested).toBe(false)
    expect(settled.pendingBattle).toBeNull()
  })
})
