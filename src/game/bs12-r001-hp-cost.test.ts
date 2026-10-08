import { describe, expect, it } from 'vitest'
import { createBs12ChouxDemoState, createBs12EspressoDemoState } from './demo'
import { applyGameCommand } from './commands'
import { assertBs12PhysicalFixture } from './bs12-physical-fixtures.test-helpers'
import type { GameState } from './types'

const owner = 'player-one' as const
const sourceId = 'bs12-032-source'
const parentId = 'r001-earl-grey'

const prepare = (number: 'BS12-032' | 'BS12-032@1' | 'BS12-033' | 'BS12-033@1', damageFirst: boolean): GameState => {
  const scenario = damageFirst ? 'hp-cost' : 'hp-cost-survives'
  const state = number.startsWith('BS12-032')
    ? createBs12ChouxDemoState(scenario, number as 'BS12-032' | 'BS12-032@1')
    : createBs12EspressoDemoState(scenario, number as 'BS12-033' | 'BS12-033@1')
  assertBs12PhysicalFixture(state)
  expect(state.players[owner].battleArea[0].hpCards).toHaveLength(damageFirst ? 1 : 2)
  return state
}

describe.each(['BS12-032', 'BS12-032@1', 'BS12-033', 'BS12-033@1'] as const)('%s R001 real Arena HP cost', number => {
  it('triggers only after actual ordinary damage followed by Earl Grey HP payment', () => {
    const before = prepare(number, true)
    const snapshot = structuredClone(before)
    const paid = applyGameCommand(before, { kind: 'begin-activate-skill', playerId: owner,
      sourceInstanceId: parentId, trigger: 'on-play', paymentIds: [], hpToTrashTargetIds: [sourceId] })
    expect(before).toEqual(snapshot)
    assertBs12PhysicalFixture(paid)
    expect(paid.players[owner].breakArea.map(c => c.instanceId)).toEqual([sourceId])
    expect(paid.pendingAfterDamageEffects).toHaveLength(1)
    expect(() => applyGameCommand(paid, { kind: 'resolve-after-damage-effect', playerId: owner, targetIds: [] })).toThrow()
    const parentDone = applyGameCommand(paid, { kind: 'resolve-ability-effect', playerId: owner, targetIds: [] })
    const next = applyGameCommand(parentDone, { kind: 'resolve-after-damage-effect', playerId: owner,
      targetIds: number.startsWith('BS12-032') ? [parentId] : [] })
    const done = number.startsWith('BS12-032') ? next
      : applyGameCommand(next, { kind: 'resolve-draw-up-to', playerId: owner, drawCount: 1 })
    expect(done.players[owner].deck).toHaveLength(parentDone.players[owner].deck.length - 1)
    expect(done.players[owner].battleArea[0].hpCards).toHaveLength(number.startsWith('BS12-032') ? 4 : 3)
    expect(done.pendingAfterDamageEffects).toBeUndefined()
    assertBs12PhysicalFixture(done)
  })
  it('does not trigger when the actual HP cost leaves one HP', () => {
    const before = prepare(number, false)
    const paid = applyGameCommand(before, { kind: 'begin-activate-skill', playerId: owner,
      sourceInstanceId: parentId, trigger: 'on-play', paymentIds: [], hpToTrashTargetIds: [sourceId] })
    expect(paid.players[owner].battleArea[0].hpCards).toHaveLength(1)
    expect(paid.players[owner].breakArea).toHaveLength(0)
    expect(paid.pendingAfterDamageEffects).toBeUndefined()
  })
})
