import { describe, expect, it } from 'vitest'
import { createBs12MelonDemoState } from './demo'
import { applyGameCommand } from './commands'
import { canActivateCookieSkill } from './skills'
import { assertBs12PhysicalFixture, printedFixtureCard } from './bs12-physical-fixtures.test-helpers'

const playerId = 'player-one' as const
const sourceInstanceId = 'pomegranate-source'

describe.each(['BS11-114', 'BS11-114@1'] as const)('%s printed fixed-discard On Play log', number => {
  it.each([5, 6, 7])('classifies an optional skip with %i cards before the printed discard', count => {
    const base = createBs12MelonDemoState('deploy')
    const source = printedFixtureCard(number, sourceInstanceId)
    const hand = Array.from({ length: count }, (_, index) =>
      printedFixtureCard(index < 3 ? number : 'BS11-113', `pomegranate-hand-${index}`))
    const before = {
      ...base,
      players: {
        ...base.players,
        [playerId]: { ...base.players[playerId], hand: [source, ...hand] },
      },
    }
    assertBs12PhysicalFixture(before)
    const entered = applyGameCommand(before, { kind: 'deploy-cookie', playerId, instanceId: sourceInstanceId })
    assertBs12PhysicalFixture(entered)
    expect(entered.players[playerId].hand).toHaveLength(count)
    expect(entered.players[playerId].battleArea.find(entry => entry.card.instanceId === sourceInstanceId)?.hpCards).toHaveLength(2)
    // The printed one-card discard changes six cards to five before the draw condition.
    expect(canActivateCookieSkill(entered, playerId, sourceInstanceId, 'on-play')).toBe(count <= 6)
    const after = applyGameCommand(entered, { kind: 'skip-on-play', playerId, sourceInstanceId })
    assertBs12PhysicalFixture(after)
    expect(after.players).toEqual(entered.players)
    expect(after.pendingOnPlay).toBeNull()
    const entry = after.commandLog?.at(-1)
    if (count <= 6) {
      expect(entry?.summary).toContain('選擇不發動')
      expect(JSON.stringify(entry)).not.toContain('條件不成立')
    } else {
      expect(entry?.summary).toContain('登場效果：條件不成立')
      expect(entry?.summary).not.toContain('選擇不發動')
      expect(entry?.steps).toContainEqual(expect.objectContaining({ text: '登場效果結果：條件不成立，效果未執行。' }))
    }
  })
})
