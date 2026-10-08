import {expect,it} from 'vitest'

import {createBs12BaguetteDemoState,createBs12BasilDemoState,createBs12ChamomileDemoState,createBs12CoffeeCandyDemoState,createCardCheckDemoState,createCardNegativeDemoState,parseTestStateConfig} from './demo'

import {assertBs12PhysicalFixture} from './bs12-physical-fixtures.test-helpers'

it.each([
 ['042', 'positive', 1], ['042', 'follow-up', 4],
 ['043', 'positive', 1], ['043', 'follow-up', 4],
] as const)('%s %s starts the printed parent attacker with %i HP', (number, scenario, hp) => {
 const state=number==='042'?createBs12ChamomileDemoState(scenario):createBs12CoffeeCandyDemoState(scenario)
 const attacker=state.players['player-two'].battleArea[0]
 expect(attacker.card.id).toBe(scenario==='positive'?'BS6-017':'BS12-019')
 expect(attacker.card.hp).toBe(hp)
 expect(attacker.hpCards).toHaveLength(hp)
})

it.each(["positive","item-hand","stage-hand","yellow-hand","returned-arena","rested-cost","non-arena-cost","non-arena-hand","item-support-only","no-support","source-rested","all-support-rested","opponent-turn","outside-main","used","attack","attack-wrong","attack-few","attack-rested-energy","attack-rested-source","deploy"] as const)('040 %s matches exact printed cards in all zones',scenario=>assertBs12PhysicalFixture(createBs12BaguetteDemoState(scenario)))

it.each(["positive","blue-energy","few-energy","rested-energy","source-rested","opponent-turn","target-faints","deploy"] as const)('041 %s matches exact printed cards in all zones',scenario=>assertBs12PhysicalFixture(createBs12BasilDemoState(scenario)))

it.each(["positive","green-arena","non-arena","no-arena","no-hand","item-hand","last-hp","follow-up","rested-target","equipment","attack","wrong-energy","few-energy","rested-energy","opponent-turn","source-rested","deploy","red-arena","refresh"] as const)('042 %s matches exact printed cards in all zones',scenario=>assertBs12PhysicalFixture(createBs12ChamomileDemoState(scenario)))

it.each(["positive","four","six","rested-own","item-count","stage-count","non-arena","wrong-color","intersection","opponent-only","battle-only","all-target-rested","last-hp","follow-up","attack","attack-wrong","attack-few","attack-rested","attack-source-rested","opponent-turn","deploy"] as const)('043 %s matches exact printed cards in all zones',scenario=>assertBs12PhysicalFixture(createBs12CoffeeCandyDemoState(scenario)))

it.each(['BS12-040','BS12-041','BS12-042','BS12-043'] as const)('%s generic positive/negative resources are physical and effect-specific',number=>{
 const positive=createCardCheckDemoState(number),negative=createCardNegativeDemoState(number)
 assertBs12PhysicalFixture(positive);assertBs12PhysicalFixture(negative)
 const scenario='positive',negativeScenario=number==='BS12-040'?'item-support-only':number==='BS12-041'?'few-energy':number==='BS12-042'?'no-arena':'four'
 for(const[prefix,expected]of [['card',scenario],['card-negative',negativeScenario]] as const){
  expect(parseTestStateConfig('?test-state='+prefix+':'+number,'localhost')).toMatchObject({kind:number.toLowerCase(),scenario:expected})
  expect(parseTestStateConfig('?test-state='+prefix+':'+number,'example.com')).toBeNull()
 }
 const self=positive.players['player-one'],blocked=negative.players['player-one']
 if(number==='BS12-040'){
  expect(self.battleArea[0].card).toMatchObject({id:number,level:2,hp:3,attack:3,attackEnergyCost:{green:2,neutral:1}})
  expect(self.supportArea.some(s=>s.card.type==='cookie')).toBe(true)
  expect(self.hand.some(c=>c.keywords?.includes('arena'))).toBe(true)
  expect(blocked.supportArea.length).toBeGreaterThan(0)
  expect(blocked.supportArea.every(s=>s.card.type==='item')).toBe(true)
 }else if(number==='BS12-041'){
  expect(self.battleArea[0].card).toMatchObject({id:number,level:1,hp:2,attack:1,attackEnergyCost:{neutral:1}})
  expect(self.supportArea).toHaveLength(1);expect(blocked.supportArea).toHaveLength(0)
 }else if(number==='BS12-042'){
  expect(positive.pendingBattle?.revealedHpCard?.id).toBe(number)
  expect(negative.pendingBattle?.revealedHpCard?.id).toBe(number)
  expect(self.hand).toHaveLength(1);expect(blocked.hand).toHaveLength(1)
  expect(self.battleArea.some(c=>c.card.keywords?.includes('arena'))).toBe(true)
  expect(blocked.battleArea.every(c=>!c.card.keywords?.includes('arena'))).toBe(true)
 }else{
  const count=(p:typeof self)=>p.supportArea.filter(s=>s.card.energyColor==='green'&&s.card.keywords?.includes('arena')).length
  expect(positive.pendingBattle?.revealedHpCard?.id).toBe(number)
  expect(negative.pendingBattle).toBeNull()
  expect(blocked.discardPile.map(card=>card.id)).toEqual([number])
  expect(negative.players['player-two'].supportArea.map(entry=>entry.rested)).toEqual([true,false,false,false])
  expect(count(self)).toBe(5);expect(count(blocked)).toBe(4)
 }
})
