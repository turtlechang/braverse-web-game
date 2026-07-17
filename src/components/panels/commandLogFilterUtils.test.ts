import { describe, expect, it } from 'vitest'
import type { CommandLogEntry } from '../../game'
import { emptyCommandLogFilters, filterCommandLogEntries } from './commandLogFilterUtils'

const entries: CommandLogEntry[] = [
  {
    id: 1,
    turnNumber: 1,
    phase: 'main',
    playerId: 'player-one',
    commandKind: 'declare-attack',
    payload: {},
    summary: 'Alice 使用「Hydrangea Cookie」攻擊「Onion Cookie」',
  },
  {
    id: 2,
    turnNumber: 2,
    phase: 'support',
    playerId: 'player-two',
    commandKind: 'place-support',
    payload: {},
    summary: 'Bob 放置了支援卡「Salt Cookie」',
  },
]

describe('commandLogFilterUtils', () => {
  it('可依回合、階段、玩家與卡牌名稱篩選', () => {
    const filters = {
      ...emptyCommandLogFilters(),
      turn: '1',
      phase: 'main' as const,
      player: 'player-one' as const,
      card: 'Hydrangea',
    }
    expect(filterCommandLogEntries(entries, filters).map((entry) => entry.id)).toEqual([1])
  })
})
