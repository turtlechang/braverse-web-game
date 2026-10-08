import { describe, expect, it } from 'vitest'
import { createBs12MuscleDemoState, createBs12StrawberryDemoState, createBs12MangoDemoState, createBs12MintWaferDemoState, createBs12BonbonDemoState, createCardCheckDemoState, createCardNegativeDemoState, parseTestStateConfig } from './demo'
import { assertBs12PhysicalFixture, printedFixtureCard } from './bs12-physical-fixtures.test-helpers'

describe('BS12-019 physical resources', () => {
  it.each(['positive', 'blue-energy', 'few-energy', 'rested-energy', 'source-rested', 'opponent-turn', 'target-faints'] as const)('%s retains every printed card and copy limit', scenario => assertBs12PhysicalFixture(createBs12MuscleDemoState(scenario)))
})
describe('BS12-020 physical resources', () => {
  it.each(['positive', 'three-arena', 'five-arena', 'non-arena-break', 'opponent-break', 'trash-arena', 'high-level', 'mixed-arena', 'no-hand', 'item-hand', 'last-hp', 'follow-up', 'attack', 'wrong-energy', 'few-energy', 'rested-energy'] as const)('%s retains every printed card and real revealed HP', scenario => assertBs12PhysicalFixture(createBs12StrawberryDemoState(scenario)))
})
describe.each(['BS12-021', 'BS12-021@1'] as const)('%s physical resources', number => {
  it.each(['positive', 'faint', 'green-arena', 'hand-break', 'removed-break', 'old-break', 'previous-turn', 'non-arena', 'opponent-break', 'trash-arena', 'no-event', 'opponent-turn', 'no-energy', 'rested-support', 'attack', 'wrong-energy', 'few-energy', 'full-battle', 'refresh'] as const)('%s retains every printed card and event resources', scenario => assertBs12PhysicalFixture(createBs12MangoDemoState(scenario, number)))
})
describe('BS12-022 physical resources', () => {
  it.each(['positive', 'green-arena', 'non-arena', 'no-arena', 'no-hand', 'item-hand', 'last-hp', 'follow-up', 'rested-target', 'equipment', 'attack', 'wrong-energy', 'few-energy', 'rested-energy', 'opponent-turn', 'source-rested'] as const)('%s retains every printed card and real revealed HP', scenario => assertBs12PhysicalFixture(createBs12MintWaferDemoState(scenario)))
})
describe('BS12-023 physical resources', () => {
  it.each(['zero', 'two', 'three', 'five', 'six', 'eight', 'nine', 'non-arena', 'high-level', 'green-arena', 'opponent-break', 'trash-arena', 'history-only', 'opponent-turn', 'no-energy', 'rested-support', 'attack', 'wrong-energy', 'few-yellow', 'few-energy', 'rested-energy', 'refresh'] as const)('%s retains every printed card and copy limit', scenario => assertBs12PhysicalFixture(createBs12BonbonDemoState(scenario)))
})

it.each(['BS12-019', 'BS12-020', 'BS12-021', 'BS12-021@1', 'BS12-022', 'BS12-023'] as const)('%s generic aliases provide exact physical effect and negative resources', number => {
  const base=number.split('@')[0]
  const scenarios=base==='BS12-019'?['positive','few-energy']:base==='BS12-020'?['positive','three-arena']:base==='BS12-021'?['positive','no-event']:base==='BS12-022'?['positive','no-hand']:['three','zero']
  for(const [index,prefix] of ['card','card-negative'].entries()) {
    expect(parseTestStateConfig(`?test-state=${prefix}:${number}`,'localhost')).toEqual({kind:base.toLowerCase(),...(base==='BS12-021'?{cardNumber:number}:{}),scenario:scenarios[index]})
    expect(parseTestStateConfig(`?test-state=${prefix}:${number}`,'example.com')).toBeNull()
  }
  const positive=createCardCheckDemoState(number),negative=createCardNegativeDemoState(number)
  assertBs12PhysicalFixture(positive)
  assertBs12PhysicalFixture(negative)
  if(base==='BS12-020'||base==='BS12-022') {
    expect(positive.pendingBattle?.stage).toBe('flip')
    expect(positive.pendingBattle?.revealedHpCard?.id).toBe(base)
    if(base==='BS12-020') {
      expect(negative.pendingBattle).toBeNull()
      expect(negative.players['player-one'].discardPile.some(card=>card.id===base)).toBe(true)
    } else expect(negative.pendingBattle?.revealedHpCard?.id).toBe(base)
  }
})

it('counts revealed HP copies against the actual damaged player when the original defender differs', () => {
  const before=createBs12StrawberryDemoState()
  if(!before.pendingBattle) throw new Error('Expected actual FLIP battle')
  const state={...before,pendingBattle:{...before.pendingBattle,defenderPlayerId:'player-two' as const,damagePlayerId:'player-one' as const},players:{...before.players,
    'player-one':{...before.players['player-one'],hand:[...before.players['player-one'].hand,...Array.from({length:4},(_,index)=>printedFixtureCard('BS12-020',`physical-owner-copy-${index}`))]}}}
  expect(()=>assertBs12PhysicalFixture(state)).toThrow(/player-one BS12-020 copies/)
})
