import {expect,it} from 'vitest'
import {createBs12SourBeltDemoState,createBs12SorbetSharkDemoState,createBs12SonicWaterDemoState,createBs12AngelLightstickDemoState,createBs12CakePopsDemoState,createCardCheckDemoState,createCardNegativeDemoState,parseTestStateConfig} from './demo'
import {assertBs12PhysicalFixture} from './bs12-physical-fixtures.test-helpers'

it.each(["positive","blue-energy","few-energy","rested-energy","source-rested","opponent-turn","target-faints","deploy","outside-main"] as const)('059 %s matches every physical record and initial printed HP',scenario=>{
 const state=createBs12SourBeltDemoState(scenario)
 if(scenario==='outside-main')expect(state.phase).toBe('support')
 assertBs12PhysicalFixture(state)
 for(const player of Object.values(state.players))for(const cookie of player.battleArea)expect(cookie.hpCards.length,cookie.card.name).toBeLessThanOrEqual(cookie.card.hp)
})

it.each(["positive","green-arena","non-arena","no-arena","no-hand","item-hand","last-hp","follow-up","rested-target","equipment","attack","wrong-energy","few-energy","rested-energy","opponent-turn","source-rested","deploy","red-arena","refresh","blue-arena","stage-hand","non-arena-hand"] as const)('060 %s matches every physical record and initial printed HP',scenario=>{
 const state=createBs12SorbetSharkDemoState(scenario)
 assertBs12PhysicalFixture(state)
 for(const player of Object.values(state.players))for(const cookie of player.battleArea)expect(cookie.hpCards.length,cookie.card.name).toBeLessThanOrEqual(cookie.card.hp)
})

it.each(["positive","blue-energy","green-energy","yellow-energy","few-energy","rested-energy","source-rested","opponent-turn","target-faints","deploy","outside-main"] as const)('061 %s matches every physical record and initial printed HP',scenario=>{
 const state=createBs12SonicWaterDemoState(scenario)
 if(scenario==='outside-main')expect(state.phase).toBe('support')
 assertBs12PhysicalFixture(state)
 for(const player of Object.values(state.players))for(const cookie of player.battleArea)expect(cookie.hpCards.length,cookie.card.name).toBeLessThanOrEqual(cookie.card.hp)
})

it.each(["equipped","hand-five","hand-six","hand-zero","no-equipment","wrong-host","short-deck","refresh","equip-blocked","deploy","attack","wrong-energy","few-energy","rested-energy","source-rested","opponent-turn","cancel-payment","cancel-target","draw-zero","draw-one","skip-trigger"] as const)('062 %s matches every physical record and initial printed HP',scenario=>{
 const state=createBs12AngelLightstickDemoState(scenario)
 assertBs12PhysicalFixture(state)
 for(const player of Object.values(state.players))for(const cookie of player.battleArea)expect(cookie.hpCards.length,cookie.card.name).toBeLessThanOrEqual(cookie.card.hp)
})

it.each(["positive","no-host","host-rested","host-support","host-hand","host-trash","host-break","host-equipped","opponent-host","source-rested","one-damage","two-damage","three-damage","other-target","attack","wrong-energy","few-energy","rested-energy","deploy","effect-positive","effect-no-host","effect-other-target","effect-zero","effect-cancel-payment","effect-cancel-target"] as const)('063 %s matches every physical record and initial printed HP',scenario=>{
 const state=createBs12CakePopsDemoState(scenario)
 assertBs12PhysicalFixture(state)
 for(const player of Object.values(state.players))for(const cookie of player.battleArea)expect(cookie.hpCards.length,cookie.card.name).toBeLessThanOrEqual(cookie.card.hp)
})

it.each([["059","positive","few-energy"],["060","positive","no-hand"],["061","positive","few-energy"],["062","equip-positive","equip-wrong-host"],["063","positive","no-host"]] as const)('%s generic routes load dedicated printed positive and negative states',(number,positive,negative)=>{
 const id='BS12-'+number
 for(const[prefix,scenario]of [['card',positive],['card-negative',negative]]as const){
  expect(parseTestStateConfig('?test-state='+prefix+':'+id,'localhost')).toEqual({kind:'bs12-'+number,scenario})
  expect(parseTestStateConfig('?test-state='+prefix+':'+id,'example.com')).toBeNull()
  const state=prefix==='card'?createCardCheckDemoState(id):createCardNegativeDemoState(id);assertBs12PhysicalFixture(state)
  if(number==='059')expect(state.players['player-one'].supportArea).toHaveLength(prefix==='card'?3:2)
  if(number==='060')expect(state.players['player-one'].hand).toHaveLength(prefix==='card'?1:0)
  if(number==='061')expect(state.players['player-one'].supportArea).toHaveLength(prefix==='card'?1:0)
  if(number==='062'){expect(state.players['player-one'].hand).toHaveLength(1);expect(state.players['player-one'].battleArea.find(c=>c.card.instanceId==='bs12-062-host')?.card.name==='Popping Candy Cookie').toBe(prefix==='card')}
  if(number==='063')expect(state.players['player-two'].battleArea.some(c=>c.card.name==='Popping Candy Cookie')).toBe(prefix==='card')
 }
})

it.each(["BS12-059","BS12-060","BS12-061","BS12-062","BS12-063"] as const)('%s generic initial HP does not invent gain',number=>{
 for(const state of[createCardCheckDemoState(number),createCardNegativeDemoState(number)])for(const player of Object.values(state.players))for(const cookie of player.battleArea)expect(cookie.hpCards.length,cookie.card.name).toBeLessThanOrEqual(cookie.card.hp)
})

it('060 reveals the real FLIP through printed Pink Choco red attack',()=>{
 const state=createBs12SorbetSharkDemoState('positive');assertBs12PhysicalFixture(state)
 expect(state.pendingBattle?.stage).toBe('flip');expect(state.pendingBattle?.revealedHpCard?.id).toBe('BS12-060')
 expect(state.players['player-two'].battleArea[0].card.id).toBe('BS6-017');expect(state.players['player-two'].battleArea[0].hpCards).toHaveLength(1)
 expect(state.players['player-two'].supportArea.every(s=>s.rested)).toBe(true)
})

it('061 ordinary source comes from real deployment with printed HP',()=>{
 const state=createBs12SonicWaterDemoState('positive');assertBs12PhysicalFixture(state)
 expect(state.players['player-one'].battleArea.find(c=>c.card.id==='BS12-061')?.hpCards).toHaveLength(2)
 expect(state.commandLog?.some(c=>c.commandKind==='deploy-cookie')).toBe(true)
})

it('062 ordinary source comes from real deployment with printed HP',()=>{
 const state=createBs12AngelLightstickDemoState('attack');assertBs12PhysicalFixture(state)
 expect(state.players['player-one'].battleArea.find(c=>c.card.id==='BS12-062')?.hpCards).toHaveLength(3)
 expect(state.commandLog?.some(c=>c.commandKind==='deploy-cookie')).toBe(true)
})

it('063 ordinary source comes from real deployment with printed HP',()=>{
 const state=createBs12CakePopsDemoState('attack');assertBs12PhysicalFixture(state)
 expect(state.players['player-one'].battleArea.find(c=>c.card.id==='BS12-063')?.hpCards).toHaveLength(2)
 expect(state.commandLog?.some(c=>c.commandKind==='deploy-cookie')).toBe(true)
})
