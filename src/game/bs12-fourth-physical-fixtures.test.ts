import { describe, expect, it } from 'vitest'
import { createBs12ActivePhaseDemoState, createBs12ParfaitDemoState, createBs12MochiDemoState, createBs12CandyAppleDemoState, createBs12GlitterDemoState, createCardCheckDemoState, createCardNegativeDemoState, parseTestStateConfig } from './demo'
import { assertBs12PhysicalFixture } from './bs12-physical-fixtures.test-helpers'

const activePhase = ['positive', 'solo', 'non-arena', 'green-arena', 'other-rested', 'already-active', 'equipment', 'support-only', 'opponent-only', 'two-copies', 'effect-ready', 'no-energy', 'wrong-energy', 'rested-energy', 'opponent-turn'] as const

describe.each(['BS12-014', 'BS12-014@1'] as const)('%s physical resources', number => {
  it.each(activePhase)('%s retains every printed card, instance identity and four-copy limit', scenario => assertBs12PhysicalFixture(createBs12ActivePhaseDemoState(scenario, number)))
})
describe.each(['BS12-015', 'BS12-015@1'] as const)('%s physical resources', number => {
  it.each([...activePhase, 'attack-solo', 'attack-non-arena', 'attack-equipment', 'attack-support-only', 'attack-opponent-only', 'attack-green-arena', 'target-faints', 'few-red'] as const)('%s retains every printed card and copy limit', scenario => assertBs12PhysicalFixture(createBs12ParfaitDemoState(scenario, number)))
})
describe.each(['BS12-016', 'BS12-016@1'] as const)('%s physical resources', number => {
  it.each(['positive', 'green-arena', 'active-target', 'source-rested', 'solo', 'non-arena', 'equipment', 'support-only', 'opponent-only', 'no-energy', 'opponent-turn', 'effect-ready', 'attack-normal', 'attack-other', 'target-faints', 'wrong-energy', 'few-red', 'rested-energy', 'already-active-ready'] as const)('%s retains every printed card and copy limit', scenario => assertBs12PhysicalFixture(createBs12MochiDemoState(scenario, number)))
})
describe.each(['BS12-017', 'BS12-017@1'] as const)('%s physical resources', number => {
  it.each(['positive', 'green-arena', 'active-target', 'source-rested', 'solo', 'non-arena', 'equipment', 'support-only', 'opponent-only', 'no-energy', 'opponent-turn', 'no-hand', 'one-hand', 'no-faerie', 'faerie-support', 'faerie-opponent', 'faerie-variant', 'target-faints', 'wrong-energy', 'few-energy', 'rested-energy', 'attack', 'faerie-only'] as const)('%s retains every printed card and copy limit', scenario => assertBs12PhysicalFixture(createBs12CandyAppleDemoState(scenario, number)))
})
describe.each(['BS12-018', 'BS12-018@1'] as const)('%s physical resources', number => {
  it.each(['positive', 'extra', 'break-low', 'no-hand', 'non-arena-hand', 'full-battle', 'green-hand', 'item-hand', 'first-player', 'target-faints', 'green-arena', 'non-arena', 'equipment', 'active-target', 'source-rested', 'solo', 'support-only', 'opponent-only', 'no-energy', 'opponent-turn', 'wrong-energy', 'few-energy', 'rested-energy'] as const)('%s retains printed EXTRA materialization and all copy limits', scenario => assertBs12PhysicalFixture(createBs12GlitterDemoState(scenario, number)))
})

it.each(['BS12-014', 'BS12-014@1', 'BS12-015', 'BS12-015@1', 'BS12-016', 'BS12-016@1', 'BS12-017', 'BS12-017@1', 'BS12-018', 'BS12-018@1'] as const)('%s generic aliases provide their physical effect and negative resources', number => {
  const base = number.split('@')[0]
  const scenarios = base === 'BS12-014' ? ['positive', 'solo'] : base === 'BS12-015' ? ['positive', 'attack-solo']
    : base === 'BS12-016' ? ['positive', 'opponent-turn'] : base === 'BS12-017' ? ['positive', 'no-hand'] : ['extra', 'break-low']
  for (const [index, prefix] of ['card', 'card-negative'].entries()) {
    expect(parseTestStateConfig(`?test-state=${prefix}:${number}`, 'localhost')).toEqual({ kind: base.toLowerCase(), cardNumber: number, scenario: scenarios[index] })
    expect(parseTestStateConfig(`?test-state=${prefix}:${number}`, 'example.com')).toBeNull()
  }
  const positive = createCardCheckDemoState(number), negative = createCardNegativeDemoState(number)
  assertBs12PhysicalFixture(positive)
  assertBs12PhysicalFixture(negative)
  if (base === 'BS12-018') {
    expect(positive.players['player-one'].extraDeck?.map(card => card.instanceId)).toEqual(['bs12-018-source'])
    expect(positive.players['player-one'].battleArea.some(entry => entry.card.instanceId === 'bs12-018-source')).toBe(false)
    expect(negative.players['player-one'].extraDeck?.map(card => card.instanceId)).toEqual(['bs12-018-source'])
  }
})
