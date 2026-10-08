import { expect, it } from 'vitest'
import { createBs12StrawberryDemoState, createBs12MintWaferDemoState, createBs12MangoDemoState, createBs12BonbonDemoState } from './demo'
import { assertBs12PhysicalFixture } from './bs12-physical-fixtures.test-helpers'

it.each(['positive', 'last-hp', 'follow-up', 'mixed-arena', 'no-hand'] as const)('020 %s has printed HP before its actual damage reveal', scenario => {
  const state = createBs12StrawberryDemoState(scenario)
  assertBs12PhysicalFixture(state)
  for (const player of Object.values(state.players)) for (const entry of player.battleArea) {
    expect(entry.hpCards.length).toBe(entry.card.hp! - (entry.card.instanceId === 'bs12-020-bearer' ? 1 : 0))
  }
  expect(state.commandLog?.map(entry => entry.commandKind)).toEqual(['declare-attack', 'skip-trap', 'resolve-next-damage'])
})

it.each(['positive', 'last-hp', 'follow-up', 'green-arena', 'non-arena', 'no-arena', 'equipment'] as const)('022 %s has printed HP before its actual damage reveal', scenario => {
  const state = createBs12MintWaferDemoState(scenario)
  assertBs12PhysicalFixture(state)
  for (const player of Object.values(state.players)) for (const entry of player.battleArea) {
    expect(entry.hpCards.length).toBe(entry.card.hp! - (entry.card.instanceId === 'bs12-022-bearer' ? 1 : 0))
  }
  expect(state.commandLog?.map(entry => entry.commandKind)).toEqual(['declare-attack', 'skip-trap', 'resolve-next-damage'])
})

it.each(['BS12-021', 'BS12-021@1'] as const)('021 %s earns current Arena history through actual printed031 payment', number => {
  const state = createBs12MangoDemoState('positive', number)
  assertBs12PhysicalFixture(state)
  for (const player of Object.values(state.players)) for (const entry of player.battleArea) expect(entry.hpCards).toHaveLength(entry.card.hp!)
  expect(state.commandLog?.map(entry => entry.commandKind)).toEqual(['begin-play-item', 'resolve-ability-effect', 'resolve-draw-up-to', 'resolve-ability-effect', 'skip-replacement'])
  expect(state.commandLog?.[0].card?.id).toBe('BS12-031')
  expect(state.players['player-one'].breakArea.map(card => card.instanceId)).toEqual(['bs12-021-event'])
  expect(state.arenaCookiesPlacedInBreakThisTurn?.['player-one']).toBe(1)
  expect(state.cookiesFaintedThisTurn?.['player-one'] ?? 0).toBe(0)
  expect(state.players['player-one'].discardPile.map(card => card.instanceId)).toEqual(['bs12-021-event-hp-0', 'bs12-021-history-item'])
  expect(state.pendingReplacement).toBeNull()
})

it.each((['BS12-021', 'BS12-021@1'] as const).flatMap(number => (['faint', 'green-arena', 'hand-break', 'removed-break', 'non-arena', 'opponent-break', 'previous-turn'] as const).map(scenario => ({ number, scenario }))))('021 $number $scenario preserves the actual parent and correct owner/turn history', ({ number, scenario }) => {
  const state = createBs12MangoDemoState(scenario, number)
  assertBs12PhysicalFixture(state)
  for (const player of Object.values(state.players)) for (const entry of player.battleArea) expect(entry.hpCards).toHaveLength(entry.card.hp!)
  const trueHistory = !['non-arena', 'opponent-break', 'previous-turn'].includes(scenario)
  expect(state.arenaCookiesPlacedInBreakThisTurn?.['player-one'] ?? 0).toBe(trueHistory ? 1 : 0)
  expect(state.pendingReplacement).toBeNull()
  const commands = state.commandLog ?? []
  if (['faint', 'green-arena', 'non-arena'].includes(scenario)) {
    expect(commands.filter(entry => entry.commandKind === 'play-stage')[0].card?.id).toBe('BS8-025')
    expect(commands.some(entry => entry.commandKind === 'activate-stage')).toBe(true)
    expect(state.cookiesFaintedThisTurn?.['player-one']).toBe(1)
  } else if (scenario === 'hand-break') {
    expect(commands[0].card?.id).toBe('BS12-028')
    expect(state.cookiesFaintedThisTurn?.['player-one'] ?? 0).toBe(0)
  } else if (scenario === 'removed-break') {
    expect(commands.some(entry => entry.commandKind === 'activate-skill' && entry.card?.id === 'ST2-008')).toBe(true)
    expect(state.players['player-one'].discardPile.some(card => card.instanceId === 'bs12-021-event')).toBe(true)
    expect(state.players['player-one'].breakArea.map(card => card.instanceId)).toEqual(['bs12-021-recovery'])
    expect(state.players['player-one'].deck).toHaveLength(16)
  } else if (scenario === 'opponent-break') {
    expect(state.cookiesFaintedThisTurn?.['player-two']).toBe(1)
    expect(state.players['player-two'].breakArea.map(card => card.instanceId)).toEqual(['bs12-021-opponent'])
  } else {
    expect(state.turnNumber).toBe(4)
    expect(commands.some(entry => entry.commandKind === 'advance-phase')).toBe(true)
  }
})

it('023 uses real six-HP Sugar Swan before its printed four-HP entry', () => {
  const state = createBs12BonbonDemoState('three')
  assertBs12PhysicalFixture(state)
  for (const player of Object.values(state.players)) for (const entry of player.battleArea) expect(entry.hpCards).toHaveLength(entry.card.hp!)
  expect(state.players['player-two'].battleArea[0].card.id).toBe('BS6-008')
})
