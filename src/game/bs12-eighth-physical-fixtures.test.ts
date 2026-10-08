import { describe, expect, it } from 'vitest'
import { createBs12ChouxDemoState, createBs12EspressoDemoState, createBs12MadeleineDemoState, createBs12KouignDemoState, createCardCheckDemoState, createCardNegativeDemoState, parseTestStateConfig, type Bs12ChouxScenario, type Bs12MadeleineScenario, type Bs12KouignScenario } from './demo'
import { assertBs12PhysicalFixture } from './bs12-physical-fixtures.test-helpers'

const chouxScenarios: Bs12ChouxScenario[] = ['mechanism-faint','mechanism-faint-opponent-turn','mechanism-faint-non-arena','arena-faint','arena-faint-nested','arena-faint-no-condition','on-play','on-play-opponent-turn','on-play-non-arena','on-play-rested','on-play-equipped','on-play-short-deck','on-play-break-nine','positive','non-arena','opponent-turn','rested-source','equipped-source','cost','cost-rested','cost-equipped','cost-wrong-energy','cost-one-energy','cost-rested-energy','cost-other-cookie','cost-hand','cost-short-deck','cost-break-nine','cost-prevented','attack','mixed-energy','wrong-energy','one-energy','rested-energy','old-break','refresh','ui-choice','ui-choice-rested','ui-choice-refresh','ui-choice-prevented','ui-choice-public-source']
const madeleineScenarios: Bs12MadeleineScenario[] = ['positive','four-arena','three-arena','non-arena-break','opponent-break','high-level','wrong-energy','one-energy','rested-energy','rested-source','rested-ally','lv2-ally','non-arena-ally','equipped-ally','break-nine','short-deck','espresso-ally']
const kouignScenarios: Bs12KouignScenario[] = ['positive','peach-cost','no-cost','wrong-energy','no-energy','rested-energy','opponent-turn','break-nine','attack','attack-rested']

describe.each(['BS12-032','BS12-032@1'] as const)('%s physical resources',number=>it.each(chouxScenarios)('%s matches printed records and legal equipment',scenario=>assertBs12PhysicalFixture(createBs12ChouxDemoState(scenario,number))))
describe.each(['BS12-033','BS12-033@1'] as const)('%s physical resources',number=>it.each(chouxScenarios)('%s matches printed records and legal equipment',scenario=>assertBs12PhysicalFixture(createBs12EspressoDemoState(scenario,number))))
describe.each(['BS12-034','BS12-034@1'] as const)('%s physical resources',number=>it.each(madeleineScenarios)('%s matches printed records and legal equipment',scenario=>assertBs12PhysicalFixture(createBs12MadeleineDemoState(scenario,number))))
describe.each(['BS12-035','BS12-035@1'] as const)('%s physical resources',number=>it.each(kouignScenarios)('%s matches printed records and legal equipment',scenario=>assertBs12PhysicalFixture(createBs12KouignDemoState(scenario,number))))

it.each(['BS12-032','BS12-032@1','BS12-033','BS12-033@1'] as const)('%s generic entry uses printed Arena FLIP causality',number=>{
  for(const [prefix,scenario] of [['card','arena-faint'],['card-negative','arena-faint-no-condition']] as const){
    expect(parseTestStateConfig(`?test-state=${prefix}:${number}`,'localhost')).toEqual({kind:number.startsWith('BS12-032')?'bs12-032':'bs12-033',cardNumber:number,scenario})
    expect(parseTestStateConfig(`?test-state=${prefix}:${number}`,'example.com')).toBeNull()
  }
  assertBs12PhysicalFixture(createCardCheckDemoState(number)); assertBs12PhysicalFixture(createCardNegativeDemoState(number))
})

it.each(['BS12-034','BS12-034@1','BS12-035','BS12-035@1'] as const)('%s generic entry loads its printed cost and counterexample',number=>{
  assertBs12PhysicalFixture(createCardCheckDemoState(number));assertBs12PhysicalFixture(createCardNegativeDemoState(number))
  if(number.startsWith('BS12-035')) expect(createCardCheckDemoState(number).players['player-one'].hand.find(card=>card.instanceId==='bs12-035-cost')?.id).toBe('BS12-003')
})

it.each(['BS12-032','BS12-032@1'] as const)('%s legacy direct-faint alias uses a real printed nonArena Then',number=>{
  const state=createBs12ChouxDemoState('mechanism-faint',number)
  expect(state.pendingAbilityEffect).toBeUndefined()
  expect(state.players['player-one'].battleArea.find(entry=>entry.card.instanceId==='bs12-032-mover')?.card.id).toBe('BS8-010')
  expect(state.pendingBattle).toMatchObject({attackerInstanceId:'bs12-032-mover'})
  expect(state.players['player-one'].supportArea.map(entry=>entry.rested)).toEqual([true,true,true])
})

it.each(['BS12-033','BS12-033@1'] as const)('%s prepared choice retains its own printed draw effect',number=>{
  const state=createBs12EspressoDemoState('ui-choice',number)
  expect(state.pendingAfterDamageEffects?.[0]).toMatchObject({sourceCardName:'Espresso Cookie',effect:{kind:'draw-up-to',max:1}})
})
