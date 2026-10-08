import { expect, it } from 'vitest'
import { createBs12GuitarDemoState, createBs12RecordDemoState, createBs12StageDemoState, createBs12TrapDemoState, createCardCheckDemoState, createCardNegativeDemoState, parseTestStateConfig } from './demo'
import { assertBs12PhysicalFixture } from './bs12-physical-fixtures.test-helpers'

it.each(['BS12-009', 'BS12-010'] as const)('%s trap resources and all cost counterexamples are physical cards', number => {
  for (const scenario of ['positive', 'one-rested', 'two-rested', 'non-arena', 'mic-equipped', 'no-energy', 'wrong-energy', 'rested-energy', 'disabled', 'used'] as const) assertBs12PhysicalFixture(createBs12TrapDemoState(scenario, number))
})
it.each(['positive', 'active-target', 'non-arena', 'no-target', 'mic-equipped', 'no-energy', 'wrong-energy', 'rested-energy', 'opponent-turn', 'removed', 'replaced', 'rested-stage'] as const)('011 %s preserves every printed card and copy limit', scenario => {
  assertBs12PhysicalFixture(createBs12StageDemoState(scenario))
})
it.each(['positive', 'active-target', 'wrong-color', 'wrong-keyword', 'no-target', 'no-energy', 'wrong-energy', 'rested-energy', 'opponent-turn'] as const)('012 %s preserves every printed card and copy limit', scenario => {
  assertBs12PhysicalFixture(createBs12GuitarDemoState(scenario))
})
it.each(['positive', 'active-target', 'wrong-color', 'wrong-keyword', 'no-target', 'no-energy', 'wrong-energy', 'rested-energy', 'opponent-turn'] as const)('013 %s preserves every printed card and copy limit', scenario => {
  assertBs12PhysicalFixture(createBs12RecordDemoState(scenario))
})
it.each(['BS12-009', 'BS12-010', 'BS12-011', 'BS12-012', 'BS12-013'] as const)('%s generic routes select the card-specific physical effect and blocked state', number => {
  assertBs12PhysicalFixture(createCardCheckDemoState(number))
  assertBs12PhysicalFixture(createCardNegativeDemoState(number))
  expect(parseTestStateConfig(`?test-state=card:${number}`, 'localhost')?.kind).toBe(`bs12-${number.slice(5, 8)}`)
  expect(parseTestStateConfig(`?test-state=card-negative:${number}`, 'localhost')?.kind).toBe(`bs12-${number.slice(5, 8)}`)
  expect(parseTestStateConfig(`?test-state=card:${number}`, 'example.com')).toBeNull()
})
