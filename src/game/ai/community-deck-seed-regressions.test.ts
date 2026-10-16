import { describe, expect, it } from 'vitest'
import {
  createCustomDeckMatch,
  simulateAiMatchDetailed,
  type SwissRosterDeck,
} from '..'
import { BS12_DECK_PRESETS } from '../bs12-deck-recipes'
import { COMMUNITY_DECK_PRESETS, type CommunityDeckChoice } from '../community-deck-recipes'

const communityColors = {
  'cookierift-801': 'green',
  'cookierift-1164': 'blue',
  'cookierift-927': 'green',
  'cookierift-1239': 'yellow',
  'cookierift-1035': 'yellow',
  'cookierift-973': 'green',
  'cookierift-568': 'purple',
  'cookierift-793': 'red',
} as const

const communityDeck = (choice: keyof typeof communityColors): SwissRosterDeck => {
  const recipe = COMMUNITY_DECK_PRESETS[choice as CommunityDeckChoice]
  return {
    id: choice,
    name: recipe.name,
    entries: recipe.entries,
    extraDeckEntries: recipe.extraDeckEntries,
    color: communityColors[choice],
    format: 'standard',
    createdAt: '2026-10-16',
    updatedAt: '2026-10-16',
  }
}

const greenArenaDeck: SwissRosterDeck = {
  ...BS12_DECK_PRESETS['bs12-green-arena'],
  id: 's3-defense-green',
  color: 'green',
  format: 'standard',
  createdAt: '2026-10-09',
  updatedAt: '2026-10-09',
}

describe('AI community-deck benchmark failure seeds', () => {
  it('continues the defender FLIP while the attacker owns a queued FLIP continuation', () => {
    const seed = 204061601
    const result = simulateAiMatchDetailed(
      createCustomDeckMatch(
        seed,
        communityDeck('cookierift-1035'),
        communityDeck('cookierift-973'),
        'player-one',
      ),
      500,
      { levels: { 'player-one': 3, 'player-two': 3 }, seed, searchNow: () => 0 },
    )

    expect(result.error, result.logs.join('\n')).toBeNull()
    expect(result.stuck).toBe(false)
    expect(result.state.status).toBe('finished')
  }, 30000)

  it.each([
    [203712000, greenArenaDeck, communityDeck('cookierift-1239'), 'player-two'],
    [204182000, communityDeck('cookierift-927'), communityDeck('cookierift-1239'), 'player-one'],
    [204182000, communityDeck('cookierift-927'), communityDeck('cookierift-1239'), 'player-two'],
    [203791901, communityDeck('cookierift-801'), communityDeck('cookierift-1164'), 'player-one'],
    [203891900, communityDeck('cookierift-1164'), communityDeck('cookierift-1164'), 'player-two'],
    [203892001, communityDeck('cookierift-801'), communityDeck('cookierift-1239'), 'player-two'],
    [203921501, communityDeck('cookierift-568'), communityDeck('cookierift-793'), 'player-one'],
    [203991901, communityDeck('cookierift-1164'), communityDeck('cookierift-1164'), 'player-two'],
  ] as const)('%i completes without invalid actions', (seed, left, right, firstPlayerId) => {
    const result = simulateAiMatchDetailed(
      createCustomDeckMatch(seed, left, right, firstPlayerId),
      500,
      { levels: { 'player-one': 5, 'player-two': 5 }, seed, searchNow: () => 0 },
    )

    expect(result.error, result.logs.join('\n')).toBeNull()
    expect(result.behavior.invalidActionCount).toBe(0)
    expect(result.stuck).toBe(false)
    expect(result.state.status).toBe('finished')
  }, 30000)
})
