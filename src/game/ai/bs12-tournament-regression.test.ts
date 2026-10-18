import { describe, expect, it } from 'vitest'
import { createCustomDeckMatch, simulateAiMatchDetailed, type SwissRosterDeck } from '..'
import { BS12_DECK_PRESETS } from '../bs12-deck-recipes'

const deck = (color: 'blue' | 'green' | 'yellow' | 'red' | 'purple' | 'black'): SwissRosterDeck => ({
  ...BS12_DECK_PRESETS[`bs12-${color}-arena`], color, id: color, format: 'standard',
  createdAt: '2026-10-09', updatedAt: '2026-10-09',
})

describe('BS12 real tournament failure seeds', () => {
  it.each([
    [21261123, 'green', 'black', 'player-two', 'Licorice has no Special Play hand card'],
    [21261189, 'blue', 'yellow', 'player-two', 'Choux trigger waits for Clotted Cream continuation'],
    [21261336, 'green', 'yellow', 'player-one', 'Choux waits during attack continuation'],
    [21261379, 'yellow', 'green', 'player-two', 'Choux delayed heal during recovery'],
    [21261397, 'black', 'black', 'player-two', 'Licorice mirror no legal hand HP'],
    [21261451, 'black', 'green', 'player-two', 'Licorice source still alive without legal hand HP'],
    [21261488, 'red', 'yellow', 'player-one', 'Choux yellow continuation versus red'],
    [22261178, 'black', 'red', 'player-two', 'Venom cannot heal a source removed by FLIP'],
    [23261236, 'purple', 'red', 'player-one', 'Stardust sequential damage must finish before ability continuation'],
    [25261324, 'blue', 'green', 'player-one', 'Returned Extra Cookie is not a legal hand replacement'],
    [29261405, 'green', 'yellow', 'player-two', 'Choux resolves before a concurrent Kouign-Amann OnPlay'],
  ] as const)('%i %s vs %s (%s): %s', (seed, left, right, first, _reason) => {
    const result = simulateAiMatchDetailed(createCustomDeckMatch(seed, deck(left), deck(right), first),
      500, { levels: { 'player-one': 5, 'player-two': 5 }, seed, searchNow: () => 0 })
    expect(result.error, result.logs.join('\n')).toBeNull()
    expect(result.stuck).toBe(false)
    expect(result.endInfo.winner).not.toBeNull()
    expect(result.behavior.invalidActionCount).toBe(0)
    expect(result.behavior.deadlockCount).toBe(0)
  }, 30000)
})
