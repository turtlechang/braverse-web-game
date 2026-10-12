import { describe, expect, it } from 'vitest'
import { executeCardEffect } from './effects'
import { createBattleState } from './test-helpers/battle-helpers'
import { COMMUNITY_DECK_PRESETS } from './community-deck-recipes'
import { createCustomDeckMatch, type SwissRosterDeck } from './tournament'
import { simulateAiMatchDetailed } from './ai-detailed-sim'
import type { CardEffect } from './types'

const selfGain: CardEffect = {
  kind: 'gain-hp', amount: 1,
  target: { side: 'self', min: 1, max: 1, sourceOnly: true },
}
const context = { sourcePlayerId: 'player-one' as const, sourceInstanceId: 'defender' }

describe('source-only HP gain after the source leaves battle', () => {
  it('does not draw HP or heal another Cookie when the source is in the public Break Area', () => {
    const state = createBattleState()
    const source = state.players['player-one'].battleArea[0]
    state.players['player-one'].battleArea = []
    state.players['player-one'].breakArea = [source.card]
    const before = structuredClone(state)
    const result = executeCardEffect(state, context, selfGain, [])
    expect(result).toEqual(before)
    expect(state).toEqual(before)
  })

  it('still adds exactly one HP to a source remaining in battle', () => {
    const state = createBattleState()
    const result = executeCardEffect(state, context, selfGain, [])
    expect(result.players['player-one'].battleArea[0].hpCards).toHaveLength(4)
    expect(result.players['player-one'].deck).toHaveLength(1)
    expect(state.players['player-one'].battleArea[0].hpCards).toHaveLength(3)
  })

  it('still rejects a missing explicitly selected mandatory recipient', () => {
    const state = createBattleState()
    expect(() => executeCardEffect(state, context, {
      kind: 'gain-hp', amount: 1, target: { side: 'self', min: 1, max: 1 },
    }, ['missing-cookie'])).toThrow()
  })

  it('finishes the real Cookierift blue/red seed that lost Earl Grey to a FLIP before its Then', () => {
    const deck = (choice: 'cookierift-921' | 'cookierift-83', color: 'blue' | 'red'): SwissRosterDeck => ({
      ...COMMUNITY_DECK_PRESETS[choice], id: choice, color, format: 'standard',
      createdAt: '', updatedAt: '',
    })
    const seed = 202671171
    const state = createCustomDeckMatch(seed, deck('cookierift-921', 'blue'), deck('cookierift-83', 'red'))
    const result = simulateAiMatchDetailed(state, 500, {
      levels: { 'player-one': 5, 'player-two': 5 }, seed, searchNow: () => 0,
    })
    expect(result.error, result.logs.join('\n')).toBeNull()
    expect(result.stuck).toBe(false)
    expect(result.endInfo.winner).not.toBeNull()
    expect(result.behavior.invalidActionCount).toBe(0)
  }, 30000)
})
