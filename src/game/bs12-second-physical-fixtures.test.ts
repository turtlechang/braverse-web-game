import { expect, it } from 'vitest'
import { createBs12ActivateDemoState, createBs12PositionCostDemoState, createBs12EquipDemoState, createBs12EquippedAttackDemoState, createBs12ReadyDemoState, createCardCheckDemoState, createCardNegativeDemoState, parseTestStateConfig } from './demo'
import { assertBs12PhysicalFixture } from './bs12-physical-fixtures.test-helpers'

it.each(['positive', 'normal-active', 'previous-turn', 'other-cookie', 'used', 'rested-after-effect', 'reentered', 'opponent-turn', 'enable'] as const)('005 %s has only unchanged physical cards', scenario => {
  assertBs12PhysicalFixture(createBs12ActivateDemoState(scenario))
})
it.each(['positive', 'self', 'no-cost', 'wrong-keyword', 'no-energy', 'wrong-energy', 'rested-energy', 'used', 'opponent-turn'] as const)('006 %s has only unchanged physical cards', scenario => {
  assertBs12PhysicalFixture(createBs12PositionCostDemoState(scenario))
})
it.each(['blocked', 'positive', 'rested-source', 'rested-host', 'no-energy', 'wrong-energy', 'rested-energy', 'used', 'opponent-turn', 'no-host', 'wrong-host', 'opponent-host'] as const)('007 %s has only unchanged physical cards', scenario => {
  assertBs12PhysicalFixture(createBs12EquipDemoState(scenario))
})
it.each([true, false])('007 prepared equipment %s has only unchanged physical cards', equipped => {
  assertBs12PhysicalFixture(createBs12EquippedAttackDemoState(equipped))
})
it.each(['BS12-008', 'BS12-008@1'] as const)('008 print %s all support threshold counterexamples use real cards', number => {
  for (const scenario of ['positive', 'five', 'three', 'wrong-color', 'wrong-keyword', 'rested-support', 'rested-source', 'active-target', 'cheerleader', 'no-target', 'opponent-turn'] as const) assertBs12PhysicalFixture(createBs12ReadyDemoState(scenario, number))
})
it.each(['BS12-005', 'BS12-006', 'BS12-007', 'BS12-008', 'BS12-008@1'] as const)('%s generic entry builds the physical ability and blocked state', number => {
  assertBs12PhysicalFixture(createCardCheckDemoState(number))
  assertBs12PhysicalFixture(createCardNegativeDemoState(number))
  expect(parseTestStateConfig(`?test-state=card:${number}`, 'localhost')?.kind).toBe(`bs12-${number.slice(5, 8)}`)
  expect(parseTestStateConfig(`?test-state=card-negative:${number}`, 'localhost')?.kind).toBe(`bs12-${number.slice(5, 8)}`)
})
