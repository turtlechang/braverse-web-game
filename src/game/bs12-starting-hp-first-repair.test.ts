import { expect, it } from 'vitest'
import { createBs12ActivateDemoState, createBs12PositionCostDemoState, createBs12ParfaitDemoState } from './demo'
import { assertBs12PhysicalFixture } from './bs12-physical-fixtures.test-helpers'

it('005 positive starts at printed HP and gains its qualifying history through an actual attack and FLIP', () => {
  const state = createBs12ActivateDemoState('positive')
  assertBs12PhysicalFixture(state)
  expect(state.players['player-one'].battleArea[0].hpCards).toHaveLength(3)
  expect(state.commandLog?.map(entry => entry.commandKind)).toEqual(expect.arrayContaining([
    'declare-attack', 'deploy-cookie', 'begin-activate-skill', 'resolve-next-damage', 'resolve-flip', 'resolve-draw-up-to', 'resolve-ability-effect',
  ]))
  expect(state.players['player-two'].battleArea.every(cookie => cookie.hpCards.length <= cookie.card.hp)).toBe(true)
  const initial = createBs12ActivateDemoState('normal-active')
  assertBs12PhysicalFixture(initial)
  for (const player of Object.values(initial.players)) for (const cookie of player.battleArea) expect(cookie.hpCards).toHaveLength(cookie.card.hp)
  expect(state.players['player-one'].battleArea[1].card.id).toBe('P-018')
  expect(state.players['player-one'].battleArea[1].hpCards).toHaveLength(4)
  expect(state.players['player-one'].supportArea.map(card => card.rested)).toEqual([true, true, true, false, false, false])
  expect(state.pendingBattle).toBeNull()
  expect(state.pendingAbilityEffect).toBeUndefined()
  expect(state.pendingDrawUpTo).toBeNull()
})
it.each(['positive', 'wrong-keyword'] as const)('006 %s uses printed HP for every combatant', scenario => {
  const state = createBs12PositionCostDemoState(scenario)
  assertBs12PhysicalFixture(state)
  for (const player of Object.values(state.players)) for (const cookie of player.battleArea) expect(cookie.hpCards).toHaveLength(cookie.card.hp)
})
it.each(['BS12-015', 'BS12-015@1'] as const)('015 %s includes a printed five-HP defender and a printed three-HP fainting defender', number => {
  for (const scenario of ['positive', 'target-faints'] as const) {
    const state = createBs12ParfaitDemoState(scenario, number)
    assertBs12PhysicalFixture(state)
    for (const player of Object.values(state.players)) for (const cookie of player.battleArea) expect(cookie.hpCards).toHaveLength(cookie.card.hp)
  }
})
