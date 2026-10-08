import { describe, expect, it } from 'vitest'
import { runSwissTournament, type SwissRosterDeck } from './tournament'
import { validateCustomDeckDefinition } from './custom-deck'

const deck = (color: 'black' | 'red'): SwissRosterDeck => ({
  id: color, name: color, color,
  entries: (color === 'black'
    ? [92, 94, 97, 98, 99, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111]
    : Array.from({ length: 15 }, (_, index) => index + 1))
    .map((number) => ({ cardNumber: `BS11-${String(number).padStart(3, '0')}`, count: 4 })),
  createdAt: '2026-09-30', updatedAt: '2026-09-30',
})

describe('Swiss black-color reporting', () => {
  it('keeps black entries and statistics visible in a mixed-color tournament', async () => {
    // Deliberately tiny action cap tests accounting, not competitive results or deck legality.
    const decks = [deck('black'), deck('red')]
    expect(decks.every((entry) => validateCustomDeckDefinition(entry).isValid)).toBe(true)
    const report = await runSwissTournament(decks, { rounds: 1, maxActions: 1 })
    expect(report.colors.find((entry) => entry.color === 'black')?.deckCount).toBe(1)
    expect(report.colors.find((entry) => entry.color === 'red')?.deckCount).toBe(1)
    expect(report.colors.reduce((sum, entry) => sum + entry.deckCount, 0)).toBe(2)
    expect(report.standings.find((entry) => entry.color === 'black')?.games).toBe(1)
  })
  it('preserves the five-color summary shape when the roster has no black deck', async () => {
    const left = deck('red')
    const report = await runSwissTournament([left, { ...left, id: 'red-two' }], { rounds: 1, maxActions: 1 })
    expect(report.colors.map((entry) => entry.color)).toEqual(['red', 'yellow', 'green', 'blue', 'purple'])
  })
})
