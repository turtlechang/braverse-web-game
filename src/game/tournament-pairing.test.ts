import { describe, expect, it } from 'vitest'
import { avoidRepeatedPairings } from './tournament-pairing'

const entrant = (id: string, points = 3, opponents: string[] = []) => ({ deck: { id }, points, opponents: new Set(opponents) })
describe('Swiss rematch repair', () => {
  it('repairs the last greedy pair and preserves every entrant exactly once without mutation', () => {
    const a = entrant('a'), b = entrant('b'), c = entrant('c', 3, ['d']), d = entrant('d', 3, ['c'])
    const input: Array<[typeof a, typeof a]> = [[a, b], [c, d]]
    const result = avoidRepeatedPairings(input)
    expect(result).toEqual([[d, b], [c, a]])
    expect(input).toEqual([[a, b], [c, d]])
    expect(new Set(result.flat().map((row) => row.deck.id)).size).toBe(4)
    expect(result.every(([left, right]) => !left.opponents.has(right.deck.id) && !right.opponents.has(left.deck.id))).toBe(true)
  })
  it('prefers an exchange inside the same score group over a float', () => {
    const a = entrant('a', 9, ['b']), b = entrant('b', 9, ['a'])
    const result = avoidRepeatedPairings([[a, b], [entrant('c', 0), entrant('d', 0)], [entrant('e', 9), entrant('f', 9)]])
    expect(result[0].map((row) => row.deck.id)).toEqual(['a', 'e'])
    expect(result[1].map((row) => row.deck.id)).toEqual(['c', 'd'])
  })
  it('floats to another group when two entrants at the same score have already met', () => {
    const result = avoidRepeatedPairings([[entrant('a', 9, ['b']), entrant('b', 9, ['a'])], [entrant('c', 6), entrant('d', 6)]])
    expect(result.map((pair) => pair.map((row) => row.deck.id))).toEqual([['a', 'c'], ['b', 'd']])
  })
  it('refuses to silently schedule an impossible rematch', () => {
    expect(() => avoidRepeatedPairings([[entrant('a', 0, ['b']), entrant('b', 0, ['a'])]])).toThrow('Cannot avoid')
  })
})
