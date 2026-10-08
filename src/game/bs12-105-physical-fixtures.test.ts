import { it } from 'vitest'
import { BS12_PERFECT_STAGE_SCENARIOS, createBs12PerfectStageDemoState } from './demo'
import { assertBs12PhysicalFixture } from './bs12-physical-fixtures.test-helpers'

it.each(BS12_PERFECT_STAGE_SCENARIOS)('105 %s uses unchanged printed cards and at most four copies', scenario => {
  assertBs12PhysicalFixture(createBs12PerfectStageDemoState(scenario))
})
