import { describe, expect, it } from 'vitest'
import { createBs12GreenbellDemoState } from './demo'
import { applyGameCommand } from './commands'
import { assertBs12PhysicalFixture } from './bs12-physical-fixtures.test-helpers'

const playerId = 'player-one' as const
const sourceInstanceId = 'bs12-038-source'
describe.each(['BS12-038', 'BS12-038@1'] as const)('%s physical conditional On Play log', number => {
  it.each(['equal-after', 'more-after', 'foe-zero'] as const)('records unmet condition instead of a player choice: %s', scenario => {
    const entered = applyGameCommand(createBs12GreenbellDemoState(scenario, number), {
      kind: 'activate-skill', playerId, sourceInstanceId: 'bs12-038-deployer', trigger: 'activate', paymentIds: [], effectTargets: [[sourceInstanceId]],
    })
    assertBs12PhysicalFixture(entered)
    const after = applyGameCommand(entered, { kind: 'skip-on-play', playerId, sourceInstanceId })
    assertBs12PhysicalFixture(after)
    expect(after.players).toEqual(entered.players)
    const entry = after.commandLog?.at(-1)
    expect(entry?.summary).toContain('登場效果：條件不成立')
    expect(entry?.summary).not.toContain('選擇不發動')
    expect(entry?.steps).toContainEqual(expect.objectContaining({ text: '登場效果結果：條件不成立，效果未執行。' }))
  })
  it('keeps an explicit optional skip as a player choice when the condition is met', () => {
    const entered = applyGameCommand(createBs12GreenbellDemoState('positive', number), {
      kind: 'activate-skill', playerId, sourceInstanceId: 'bs12-038-deployer', trigger: 'activate', paymentIds: [], effectTargets: [[sourceInstanceId]],
    })
    const after = applyGameCommand(entered, { kind: 'skip-on-play', playerId, sourceInstanceId })
    assertBs12PhysicalFixture(entered)
    assertBs12PhysicalFixture(after)
    expect(after.players).toEqual(entered.players)
    expect(after.commandLog?.at(-1)?.summary).toContain('選擇不發動')
    expect(JSON.stringify(after.commandLog?.at(-1))).not.toContain('條件不成立')
  })
  it('records the wrong origin when deployed from hand despite fewer supports', () => {
    const entered = applyGameCommand(createBs12GreenbellDemoState('hand', number), {
      kind: 'deploy-cookie', playerId, instanceId: sourceInstanceId,
    })
    const after = applyGameCommand(entered, { kind: 'skip-on-play', playerId, sourceInstanceId })
    assertBs12PhysicalFixture(entered)
    assertBs12PhysicalFixture(after)
    expect(after.players).toEqual(entered.players)
    expect(after.commandLog?.at(-1)?.summary).toContain('本次不是從支援區登場')
    expect(after.commandLog?.at(-1)?.summary).not.toContain('選擇不發動')
  })
})
