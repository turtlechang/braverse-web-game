import { describe, expect, it } from 'vitest'
import { runTop8, type PlayoffGame } from './lib/bs11-playoffs'
import type { SwissStanding } from '../src/game/tournament'

const standings: SwissStanding[] = Array.from({ length: 8 }, (_, index) => ({
  rank: index + 1, deckId: `d${index + 1}`, name: `deck${index + 1}`, color: 'black', points: 30 - index,
  wins: 10 - index, losses: index, draws: 0, games: 10, buchholz: 100, stuckMatches: 0,
}))
const game = (stage: PlayoffGame['stage'], table: number, leftId: string, rightId: string): PlayoffGame => ({
  stage, table, leftId, rightId, winnerId: leftId, seed: 1, firstPlayerId: 'player-one', actions: 100, turns: 10, error: null,
})
describe('BS11 top cut result integrity', () => {
  it('runs a fixed seven-match bracket and reports the actual winner and all semifinalists', () => {
    const result = runTop8(standings, game)
    expect(result.matches).toHaveLength(7)
    expect(result.top4.map((entry) => entry.deckId)).toEqual(['d1', 'd4', 'd2', 'd3'])
    expect(result.champion?.deckId).toBe('d1')
    expect(result.runnerUp?.deckId).toBe('d2')
  })
  it('never awards an unresolved final to a higher Swiss seed', () => {
    const result = runTop8(standings, (...args) => {
      const row = game(...args)
      return row.stage === 'final' ? { ...row, winnerId: null, error: 'action cap' } : row
    })
    expect(result.status).toBe('FAIL')
    expect(result.champion).toBeNull()
    expect(result.top4).toHaveLength(4)
  })
  it('rejects incomplete top cuts and fabricated winners', () => {
    expect(() => runTop8(standings.slice(1), game)).toThrow(/eight/)
    expect(() => runTop8(standings, (...args) => ({ ...game(...args), winnerId: 'outsider' }))).toThrow(/belong/)
  })
})
