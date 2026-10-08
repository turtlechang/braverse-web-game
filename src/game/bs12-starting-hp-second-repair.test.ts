import { expect, it } from 'vitest'
import { createBs12MochiDemoState, createBs12GlitterDemoState, createBs12MuscleDemoState } from './demo'
import { assertBs12PhysicalFixture } from './bs12-physical-fixtures.test-helpers'

it.each(['BS12-016', 'BS12-016@1'] as const)('016 %s uses printed HP for living and fainting defenders', number => {
  for (const scenario of ['positive', 'target-faints'] as const) {
    const state = createBs12MochiDemoState(scenario, number)
    assertBs12PhysicalFixture(state)
    for (const player of Object.values(state.players)) for (const cookie of player.battleArea) expect(cookie.hpCards).toHaveLength(cookie.card.hp)
    expect(state.players['player-two'].battleArea[0].card.id).toBe(scenario === 'target-faints' ? 'BS12-008' : 'BS6-008')
  }
})

it.each(['BS12-018', 'BS12-018@1'] as const)('018 %s enters through the printed Arena hand cost before its skill/attack preview', number => {
  const state = createBs12GlitterDemoState('positive', number)
  assertBs12PhysicalFixture(state)
  for (const player of Object.values(state.players)) for (const cookie of player.battleArea) expect(cookie.hpCards).toHaveLength(cookie.card.hp)
  expect(state.commandLog?.map(entry => entry.commandKind)).toEqual(['play-extra-deck-cookie', 'resolve-optional-cost-attack'])
  expect(state.players['player-one'].hand).toEqual([])
  expect(state.players['player-one'].discardPile.map(card => card.instanceId)).toEqual(['bs12-018-hand'])
  expect(state.players['player-one'].deck).toHaveLength(11)
  expect(state.players['player-one'].extraDeck).toEqual([])
  expect(state.extraDeckPlayUsedThisTurn).toBe(true)
  expect(state.players['player-one'].battleArea.map(cookie => cookie.card.instanceId)).toEqual(['bs12-018-other', 'bs12-018-source'])
})

it.each(['BS12-018', 'BS12-018@1'] as const)('018 %s becomes rested through a paid ordinary attack after actual EXTRA entry', number => {
  const state = createBs12GlitterDemoState('source-rested', number)
  assertBs12PhysicalFixture(state)
  expect(state.commandLog?.map(entry => entry.commandKind)).toEqual([
    'play-extra-deck-cookie', 'resolve-optional-cost-attack', 'declare-attack', 'skip-trap',
    ...Array(4).fill('resolve-next-damage'), 'resolve-attack-effect',
  ])
  expect(state.players['player-one'].battleArea.find(cookie => cookie.card.instanceId === 'bs12-018-source')).toMatchObject({ rested: true })
  expect(state.players['player-one'].supportArea.every(card => card.rested)).toBe(true)
  expect(state.players['player-two'].battleArea.map(cookie => cookie.hpCards.length)).toEqual([2, 4])
  expect(state.pendingBattle).toBeNull()
})

it('019 ordinary four damage has a real six-HP defender, and its fainting case uses printed four HP', () => {
  for (const scenario of ['positive', 'target-faints'] as const) {
    const state = createBs12MuscleDemoState(scenario)
    assertBs12PhysicalFixture(state)
    for (const player of Object.values(state.players)) for (const cookie of player.battleArea) expect(cookie.hpCards).toHaveLength(cookie.card.hp)
    expect(state.players['player-two'].battleArea[0].card.id).toBe(scenario === 'target-faints' ? 'BS12-001' : 'BS6-008')
  }
})
