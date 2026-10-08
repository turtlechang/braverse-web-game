import {expect,it} from 'vitest'
import * as demos from './demo'
import {assertBs12PhysicalFixture} from './bs12-physical-fixtures.test-helpers'
import {applyGameCommand} from './commands'
import {getTrapCandidates} from './battle'
import {getCardPoolEntry} from './card-pool'
it.each(demos.BS12_RECIPE_SCENARIOS)('104 future physical %s retains printed cards and fullHP with actual emptyDeck parent',scenario=>{
 const s=demos.createBs12RecipeDemoState(scenario);assertBs12PhysicalFixture(s)
 for(const c of s.players['player-one'].battleArea)expect(c.hpCards).toHaveLength(c.card.hp)
 if(scenario==='empty-deck'){
  expect(s.pendingRefresh).toMatchObject({playerId:'player-one',remainingDraws:1})
  expect(s.commandLog?.map(c=>c.commandKind)).toEqual(['declare-attack','skip-trap','resolve-next-damage','resolve-attack-effect','resolve-optional-cost-attack','resolve-draw-up-to'])
  expect(s.players['player-one'].battleArea.map(c=>c.card.id)).toEqual(['BS12-095','BS12-101'])
  expect(s.players['player-two'].battleArea[0].hpCards).toHaveLength(3)
 }else for(const c of s.players['player-two'].battleArea)expect(c.hpCards).toHaveLength(c.card.hp)
})
it.each(demos.BS12_PERFECT_STAGE_SCENARIOS)('105 future physical %s retains printed cards and actual flag provenance',scenario=>{
 const s=demos.createBs12PerfectStageDemoState(scenario);assertBs12PhysicalFixture(s)
 for(const c of s.players['player-one'].battleArea)expect(c.hpCards).toHaveLength(c.card.hp)
 for(const c of s.players['player-two'].battleArea)expect(c.hpCards).toHaveLength(scenario==='disabled'&&c.card.id==='BS6-008'?2:c.card.hp)
 if(scenario==='disabled'){
  expect(s.pendingBattle).toMatchObject({trapsDisabled:true,remainingDamage:3})
  expect(s.players['player-two'].battleArea[0].card).toMatchObject({id:'BS6-008',hp:6,attack:3,attackEnergyCost:{red:3}})
  expect(s.commandLog?.filter(c=>c.commandKind==='resolve-next-damage')).toHaveLength(4)
  expect(s.commandLog?.filter(c=>c.commandKind==='declare-attack')).toHaveLength(2)
  expect(s.players['player-one'].supportArea.map(c=>c.rested)).toEqual([true,true,true,false])
 }else if(scenario==='used'){
  expect(s.pendingBattle).toMatchObject({trapUsed:true,remainingDamage:2})
  expect(s.commandLog?.map(c=>c.commandKind)).toEqual(['declare-attack','play-trap'])
  expect(s.players['player-one'].hand.map(c=>c.instanceId)).toEqual(['bs12-105-second-trap'])
  expect(s.players['player-one'].discardPile.map(c=>c.instanceId)).toEqual(['bs12-105-trap'])
  expect(getTrapCandidates(s,'player-one')).toEqual([])
  expect(()=>applyGameCommand(s,{kind:'play-trap',playerId:'player-one',trapInstanceId:'bs12-105-second-trap',paymentIds:['bs12-105-payment-1'],targetIds:[],effectTargets:[['bs12-105-attacker']]})).toThrow()
 }else if(!['main','after-battle'].includes(scenario))expect(s.commandLog?.map(c=>c.commandKind)).toEqual(['declare-attack'])
})
it('104 actualRefresh resumes priorChess draw before an independent Item draw and SpecialPlay buff',()=>{
 let s=demos.createBs12RecipeDemoState('empty-deck')
 s=applyGameCommand(s,{kind:'refresh-deck',playerId:'player-one',cookieInstanceId:'bs12-104-refresh'},{shuffle:cards=>[...cards]})
 expect(s.pendingRefresh).toBeFalsy();expect(s.pendingBattle).toBeFalsy();assertBs12PhysicalFixture(s)
 expect(s.players['player-one'].deck).toHaveLength(6)
 s=applyGameCommand(s,{kind:'begin-play-item',playerId:'player-one',instanceId:'bs12-104-item',paymentIds:['bs12-104-payment-1']})
 s=applyGameCommand(s,{kind:'resolve-ability-effect',playerId:'player-one',targetIds:[]})
 s=applyGameCommand(s,{kind:'resolve-draw-up-to',playerId:'player-one',drawCount:1})
 s=applyGameCommand(s,{kind:'resolve-ability-effect',playerId:'player-one',targetIds:['bs12-104-target']})
 expect(s.attackModifiers?.at(-1)).toMatchObject({targetInstanceId:'bs12-104-target',amount:1})
 expect(s.players['player-one'].deck).toHaveLength(5);assertBs12PhysicalFixture(s)
})
it('105 realSugarSwan three damage follows actual trap seal without changing canonicalCard',()=>{
 let s=demos.createBs12PerfectStageDemoState('disabled')
 s=applyGameCommand(s,{kind:'skip-trap',playerId:'player-one'})
 while(s.pendingBattle?.stage==='damage')s=applyGameCommand(s,{kind:'resolve-next-damage',playerId:'player-one'})
 expect(s.players['player-one'].battleArea[0].hpCards).toHaveLength(1)
 assertBs12PhysicalFixture(s)
})
for(const [number,factory,positive,negative]of[
 ['BS12-104',demos.createBs12RecipeDemoState,'positive','no-energy'],
 ['BS12-105',demos.createBs12PerfectStageDemoState,'positive','split'],
]as const)for(const isNegative of[false,true]){
 const route=isNegative?'card-negative:':'card:',scenario=isNegative?negative:positive
 it(route+number+' routes to actual physical effect scene and preserves candidate isolation',()=>{
  expect(demos.parseTestStateConfig('?test-state='+route+number,'localhost')).toEqual({kind:number.toLowerCase(),scenario})
  expect(demos.parseTestStateConfig('?test-state='+route+number,'example.com')).toBeNull()
  const s=isNegative?demos.createCardNegativeDemoState(number):demos.createCardCheckDemoState(number)
  expect(s).toEqual((factory as (value:typeof scenario)=>typeof s)(scenario));assertBs12PhysicalFixture(s)
  expect(getCardPoolEntry(number)).toBeUndefined()
 })
}
