import { describe, expect, it } from 'vitest'
import type { CommandLogEntry } from '../../game'
import { groupCommandLogEntries } from './commandLogGrouping'

const entry = (overrides: Partial<CommandLogEntry> & { id: number }): CommandLogEntry => ({
  turnNumber: 1,
  phase: 'main',
  playerId: 'player-one',
  commandKind: 'declare-attack',
  payload: {},
  ...overrides,
})

describe('groupCommandLogEntries', () => {
  it('clusters consecutive entries sharing the same groupId into one group', () => {
    const entries: CommandLogEntry[] = [
      entry({ id: 1, groupId: 1, commandKind: 'declare-attack', summary: '宣告攻擊' }),
      entry({ id: 2, groupId: 1, commandKind: 'skip-trap', summary: '未發動陷阱' }),
      entry({ id: 3, groupId: 1, commandKind: 'resolve-next-damage', summary: '結算傷害' }),
      entry({ id: 4, groupId: 4, commandKind: 'place-support', summary: '放置支援卡' }),
    ]

    const groups = groupCommandLogEntries(entries)

    expect(groups).toHaveLength(2)
    expect(groups[0].groupId).toBe(1)
    expect(groups[0].header.id).toBe(1)
    expect(groups[0].steps.map((step) => step.id)).toEqual([2, 3])
    expect(groups[0].entries.map((item) => item.id)).toEqual([1, 2, 3])
    expect(groups[1].groupId).toBe(4)
    expect(groups[1].header.id).toBe(4)
    expect(groups[1].steps).toEqual([])
  })

  it('treats an entry with no groupId as its own standalone group (legacy/foreign data)', () => {
    const entries: CommandLogEntry[] = [
      entry({ id: 1, commandKind: 'advance-phase', summary: '推進了階段' }),
    ]

    const groups = groupCommandLogEntries(entries)

    expect(groups).toHaveLength(1)
    expect(groups[0].groupId).toBe(1)
    expect(groups[0].header.id).toBe(1)
    expect(groups[0].entries).toHaveLength(1)
  })

  it('keeps groups in the same order the entries were given (oldest first)', () => {
    const entries: CommandLogEntry[] = [
      entry({ id: 1, groupId: 1 }),
      entry({ id: 2, groupId: 2 }),
      entry({ id: 3, groupId: 3 }),
    ]

    const groups = groupCommandLogEntries(entries)

    expect(groups.map((group) => group.groupId)).toEqual([1, 2, 3])
  })

  it('does not merge two different groupIds even if they are numerically identical to a later id', () => {
    const entries: CommandLogEntry[] = [
      entry({ id: 1, groupId: 1 }),
      entry({ id: 2, groupId: 2 }),
      entry({ id: 3, groupId: 2 }),
    ]

    const groups = groupCommandLogEntries(entries)

    expect(groups).toHaveLength(2)
    expect(groups[1].entries.map((item) => item.id)).toEqual([2, 3])
  })

  it('returns an empty array for an empty log', () => {
    expect(groupCommandLogEntries([])).toEqual([])
  })
})
