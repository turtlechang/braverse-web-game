import { describe, expect, it } from 'vitest'
import roster from '../../../data/decks/bs11-1024-roster.json'
import { createCustomDeckMatch, simulateAiMatchDetailed } from '..'
import type { SwissRosterDeck } from '../tournament'

const decks = new Map((roster.decks as SwissRosterDeck[]).map((deck) => [deck.id, deck]))
describe('BS11 real tournament seed regressions', () => {
  it('round 6 table 369 skips inactive Night Raven trap Then before validating its targets', () => {
    const seed = 26261298
    const result = simulateAiMatchDetailed(createCustomDeckMatch(seed, decks.get('bs11-1024-green-119')!, decks.get('bs11-1024-purple-137')!, 'player-one'),
      500, { levels: { 'player-one': 5, 'player-two': 5 }, seed, experienceProfile: null, searchNow: () => 0 })
    expect(result.error, result.logs.join('\n')).toBeNull()
    expect(result.stuck).toBe(false)
    expect(result.endInfo.winner).not.toBeNull()
  }, 30000)
  it.each([
    [1, 70, 'yellow-171', 'black-029', 'player-one', 'break source moved after replacement'],
    [1, 75, 'green-157', 'purple-068', 'player-two', 'FLIP interrupts attack Then'],
    [1, 106, 'green-105', 'black-022', 'player-one', 'draw FLIP interrupts attack Then'],
    [1, 149, 'yellow-030', 'blue-022', 'player-two', 'unplayable paid Then choice'],
    [1, 180, 'blue-036', 'red-063', 'player-one', 'cross-Cookie HP payment'],
    [1, 469, 'green-085', 'yellow-031', 'player-two', 'trap per-effect support selection'],
    [2, 24, 'blue-144', 'black-151', 'player-two', 'On Play replacement must use replacement activation'],
  ] as const)('round %i table %i: %s vs %s (%s; %s)', (round, table, left, right, first, _reason) => {
    const seed = 20260930 + round * 1_000_000 + table - 1
    const result = simulateAiMatchDetailed(createCustomDeckMatch(seed, decks.get(`bs11-1024-${left}`)!, decks.get(`bs11-1024-${right}`)!, first),
      500, { levels: { 'player-one': 5, 'player-two': 5 }, seed, experienceProfile: null })
    expect(result.error, result.logs.slice(-8).join('\n')).toBeNull()
    expect(result.stuck).toBe(false)
    expect(result.endInfo.winner).not.toBeNull()
  }, 30000)
})
