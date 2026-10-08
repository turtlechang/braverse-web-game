import { describe, expect, it } from 'vitest'
import { createBs12GingerBraveDemoState, createBs12MayorDemoState, createBs12BananaRotiDemoState, createBs12YappingDemoState, createBs12CarpetDemoState, createCardCheckDemoState, createCardNegativeDemoState, parseTestStateConfig } from './demo'
import { assertBs12PhysicalFixture } from './bs12-physical-fixtures.test-helpers'

describe('BS12-024 physical resources', () => {
  it.each(["positive","blue-energy","green-energy","yellow-energy","few-energy","rested-energy","source-rested","opponent-turn","target-faints","deploy"] as const)('%s retains original printed records and per-owner copy limits', scenario => assertBs12PhysicalFixture(createBs12GingerBraveDemoState(scenario)))
})

describe('BS12-025 physical resources', () => {
  it.each(["positive","red-choux","rested-choux","no-choux","wrong-name","opponent-choux","support-choux","no-energy","rested-support","opponent-turn","attack","wrong-energy","few-energy","rested-energy","source-rested","target-faints"] as const)('%s retains original printed records and per-owner copy limits', scenario => assertBs12PhysicalFixture(createBs12MayorDemoState(scenario)))
})

describe('BS12-026 physical resources', () => {
  it.each(["four-arena","five-arena","mixed-arena","three-arena","high-level","non-arena-break","opponent-break","trash-arena","turn-event","green-event","hand-event","faint-event","removed-event","previous-turn","non-arena-event","opponent-event","both","no-condition","no-hand","item-hand","blue-hand","target-faints","wrong-energy","few-energy","rested-energy","source-rested","opponent-turn","deploy"] as const)('%s retains original printed records and per-owner copy limits', scenario => assertBs12PhysicalFixture(createBs12BananaRotiDemoState(scenario)))
})

describe('BS12-027 physical resources', () => {
  it.each(["four","three","five","arena-only","yellow-only","non-arena","high-level","opponent-break","trash-arena","support-arena","battle-arena","free-no-energy","free-wrong-energy","free-rested-energy","no-energy","wrong-energy","rested-energy","disabled","used","main","after-battle"] as const)('%s retains original printed records and per-owner copy limits', scenario => assertBs12PhysicalFixture(createBs12YappingDemoState(scenario)))
})

describe('BS12-028 physical resources', () => {
  it.each(["positive","no-cost","non-arena","arena-item","red-only","wrong-energy","rested-energy","no-energy","opponent-turn","outside-main","break-nine","short-deck"] as const)('%s retains original printed records and per-owner copy limits', scenario => assertBs12PhysicalFixture(createBs12CarpetDemoState(scenario)))
})

it.each(['BS12-024','BS12-025','BS12-026','BS12-027','BS12-028'] as const)('%s generic aliases load effect-specific physical resources', number => {
  const scenarios=number==='BS12-024'?['positive','few-energy']:number==='BS12-025'?['positive','no-choux']:number==='BS12-026'?['four-arena','no-hand']:number==='BS12-027'?['four','no-energy']:['positive','no-cost']
  for(const [index,prefix] of ['card','card-negative'].entries()) {
    expect(parseTestStateConfig(`?test-state=${prefix}:${number}`,'localhost')).toEqual({kind:number.toLowerCase(),scenario:scenarios[index]})
    expect(parseTestStateConfig(`?test-state=${prefix}:${number}`,'example.com')).toBeNull()
  }
  assertBs12PhysicalFixture(createCardCheckDemoState(number))
  assertBs12PhysicalFixture(createCardNegativeDemoState(number))
})

it('027 trap lock comes from actual Burning Spice equipment and LV8', () => {
  const state=createBs12YappingDemoState('disabled')
  const attacker=state.players['player-two'].battleArea[0]
  expect(attacker.card.id).toBe('BS8-009')
  expect(attacker.card.attack).toBe(3)
  expect(attacker.equippedCards?.map(card=>card.id)).toEqual(['BS8-021'])
  expect(state.players['player-two'].breakArea.reduce((sum,card)=>sum+card.level,0)).toBe(8)
  expect(state.pendingBattle).toMatchObject({trapsDisabled:true,remainingDamage:3})
})

it('027 used control has an actually discarded first trap and a remaining second trap', () => {
  const state=createBs12YappingDemoState('used')
  expect(state.players['player-one'].discardPile.map(card=>({id:card.id,instanceId:card.instanceId}))).toEqual([{id:'BS12-027',instanceId:'bs12-027-used-trap'}])
  expect(state.players['player-one'].hand.map(card=>card.instanceId)).toEqual(['bs12-027-trap'])
  expect(state.pendingBattle).toMatchObject({trapUsed:true,stage:'damage',remainingDamage:4})
})
