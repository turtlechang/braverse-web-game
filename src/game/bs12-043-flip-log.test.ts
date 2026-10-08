import { describe, expect, it } from 'vitest'
import { createBs12CoffeeCandyDemoState } from './demo'
import { applyGameCommand } from './commands'
import { assertBs12PhysicalFixture } from './bs12-physical-fixtures.test-helpers'

const playerId = 'player-one' as const
const targets = ['Langue de Chat Cookie', 'Sweet Jams Guitar', 'Crown Stage', 'Candy Diver Cookie']

describe.each(['targetIds', 'effectTargetIds'] as const)('BS12-043 printed support FLIP log using %s', field => {
  it.each([0, 1, 2, 3])('names the actual selected support, including Cookie/Item/Stage and already rested: %i', index => {
    const before = createBs12CoffeeCandyDemoState('positive')
    const after = applyGameCommand(before, {
      kind: 'resolve-flip', playerId, activate: true,
      [field]: [`bs12-043-opponent-support-${index}`],
    })
    assertBs12PhysicalFixture(before)
    assertBs12PhysicalFixture(after)
    expect(after.players['player-two'].supportArea.map(entry => entry.rested)).toEqual([true, index === 1, index === 2, index === 3])
    const entry = after.commandLog?.at(-1)
    const outcome = entry?.steps?.find(step => step.text.startsWith('FLIP 支援疲勞結果：'))
    expect(outcome?.text).toBe(`FLIP 支援疲勞結果：「${targets[index]}」${index === 0 ? '（原已疲勞）' : ''}設為疲勞。`)
    expect(outcome?.cards).toEqual([before.players['player-two'].supportArea[index].card])
  })
})

it('records an explicit zero support selection without claiming a target was rested', () => {
  const before = createBs12CoffeeCandyDemoState('positive')
  const after = applyGameCommand(before, { kind: 'resolve-flip', playerId, activate: true, effectTargetIds: [] })
  assertBs12PhysicalFixture(before)
  assertBs12PhysicalFixture(after)
  expect(after.players['player-two']).toEqual(before.players['player-two'])
  expect(after.commandLog?.at(-1)?.steps).toContainEqual({ text: 'FLIP 支援疲勞結果：未選擇支援卡，沒有支援卡改變狀態。' })
})

it('keeps declining the printed FLIP separate from selecting zero', () => {
  const before = createBs12CoffeeCandyDemoState('positive')
  const after = applyGameCommand(before, { kind: 'resolve-flip', playerId, activate: false })
  assertBs12PhysicalFixture(before)
  assertBs12PhysicalFixture(after)
  expect(after.players['player-two']).toEqual(before.players['player-two'])
  expect(after.commandLog?.at(-1)?.steps).toContainEqual(expect.objectContaining({ text: 'FLIP 效果結果：選擇不發動，效果未執行' }))
  expect(after.commandLog?.at(-1)?.steps?.some(step => step.text.startsWith('FLIP 支援疲勞結果：'))).toBe(false)
})
