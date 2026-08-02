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

  it('可用 entry 本身存的 category 篩選', () => {
    const withCategory: CommandLogEntry[] = [
      { ...entries[0], category: 'attack' },
      { ...entries[1], category: 'deploy' },
    ]
    const filters = { ...emptyCommandLogFilters(), category: 'deploy' as const }
    expect(filterCommandLogEntries(withCategory, filters).map((entry) => entry.id)).toEqual([2])
  })

  it('沒有 category 欄位的舊資料退回用 commandKind 對照表歸類', () => {
    const filters = { ...emptyCommandLogFilters(), category: 'attack' as const }
    // entries[0] 是 declare-attack、沒有存 category 欄位——應該還是能歸到 'attack'。
    expect(filterCommandLogEntries(entries, filters).map((entry) => entry.id)).toEqual([1])
  })
})
