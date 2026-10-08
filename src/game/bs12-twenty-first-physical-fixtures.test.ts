import {expect,it} from 'vitest'
import * as demos from './demo'
import {assertBs12PhysicalFixture} from './bs12-physical-fixtures.test-helpers'
import {applyGameCommand} from './commands'

for(const scenario of demos.BS12_BUTTER_ROLL_SCENARIOS)it('094 printed HP and real reference identities '+scenario,()=>{
 const state=demos.createBs12ButterRollDemoState(scenario);assertBs12PhysicalFixture(state)
 expect(state.players['player-one'].battleArea.map(c=>c.hpCards.length)).toEqual(scenario==='target-flip'?[4,2]:scenario==='deploy'?[2]:[4])
 expect(state.players['player-two'].battleArea.map(c=>c.hpCards.length)).toEqual([scenario==='target-faints'||scenario==='target-flip'?4:5,4])
 expect(state.players['player-two'].battleArea.map(c=>c.card.id)).toEqual([scenario==='target-faints'?'BS12-019':'BS12-026','BS12-019'])
})
for(const scenario of demos.BS12_JASMINE_SCENARIOS)it('097 printed HP and real reference identities '+scenario,()=>{
 const state=demos.createBs12JasmineDemoState(scenario);assertBs12PhysicalFixture(state)
 expect(state.players['player-one'].battleArea.map(c=>c.hpCards.length)).toEqual([2])
 expect(state.players['player-two'].battleArea.map(c=>c.hpCards.length)).toEqual([['target-faints','target-flip'].includes(scenario)?1:2,4])
 expect(state.players['player-two'].battleArea.map(c=>c.card.id)).toEqual([['target-faints','target-flip'].includes(scenario)?'BS12-080':'BS12-003','BS12-019'])
})
it('094 lastHP setup uses actual Peach N1 damage rather than four HP on a five HP Cookie',()=>{
 const state=demos.createBs12ButterRollDemoState('target-flip');assertBs12PhysicalFixture(state)
 expect(state.players['player-one'].battleArea.find(c=>c.card.instanceId==='bs12-094-preparation-peach')?.rested).toBe(true)
 expect(state.players['player-one'].battleArea[0].rested).toBe(false)
 expect(state.players['player-one'].supportArea.map(s=>s.rested)).toEqual([false,false,false,true])
 expect(state.players['player-two'].battleArea[0].hpCards).toHaveLength(4)
 expect(state.commandLog?.some(e=>e.commandKind==='declare-attack'&&e.summary?.includes('Peach Cookie'))).toBe(true)
 expect(state.pendingBattle).toBeFalsy()
})
it.each(['094','097']as const)('%s actual deployment installs literal printed HP',number=>{
 const before=number==='094'?demos.createBs12ButterRollDemoState('deploy'):demos.createBs12JasmineDemoState('deploy')
 const after=applyGameCommand(before,{kind:'deploy-cookie',playerId:'player-one',instanceId:`bs12-${number}-source`});assertBs12PhysicalFixture(after)
 expect(after.players['player-one'].battleArea.find(c=>c.card.instanceId===`bs12-${number}-source`)?.hpCards).toEqual(before.players['player-one'].deck.slice(0,number==='094'?4:2))
})
it.each(['094','097']as const)('%s actual ordinary attack leaves one HP on printed target',number=>{
 const before=number==='094'?demos.createBs12ButterRollDemoState('attack'):demos.createBs12JasmineDemoState('attack');assertBs12PhysicalFixture(before)
 let state=applyGameCommand(before,{kind:'declare-attack',playerId:'player-one',attackerInstanceId:`bs12-${number}-source`,targetInstanceId:`bs12-${number}-opponent`,supportPaymentIds:before.players['player-one'].supportArea.map(s=>s.card.instanceId)})
 state=applyGameCommand(state,{kind:'skip-trap',playerId:'player-two'})
 for(let hit=0;hit<(number==='094'?4:1);hit++)state=applyGameCommand(state,{kind:'resolve-next-damage',playerId:'player-two'})
 assertBs12PhysicalFixture(state);expect(state.players['player-two'].battleArea.map(c=>c.hpCards.length)).toEqual([1,4])
})
it.each(['094','097']as const)('%s last HP FLIP follows actual printed damage and rescues physical Arena bearer',number=>{
 const before=number==='094'?demos.createBs12ButterRollDemoState('target-flip'):demos.createBs12JasmineDemoState('target-flip');assertBs12PhysicalFixture(before)
 let state=applyGameCommand(before,{kind:'declare-attack',playerId:'player-one',attackerInstanceId:`bs12-${number}-source`,targetInstanceId:`bs12-${number}-opponent`,supportPaymentIds:before.players['player-one'].supportArea.slice(0,number==='094'?3:1).map(s=>s.card.instanceId)})
 state=applyGameCommand(state,{kind:'skip-trap',playerId:'player-two'})
 for(let hit=0;hit<(number==='094'?4:1);hit++)state=applyGameCommand(state,{kind:'resolve-next-damage',playerId:'player-two'})
 expect(state.pendingBattle?.revealedHpCard?.id).toBe('BS12-002');expect(state.players['player-two'].battleArea[0].hpCards).toHaveLength(0)
 state=applyGameCommand(state,{kind:'resolve-flip',playerId:'player-two',activate:true,discardHandIds:[`bs12-${number}-flip-hand-cost`],targetIds:[`bs12-${number}-opponent`]})
 assertBs12PhysicalFixture(state);expect(state.players['player-two'].battleArea.map(c=>c.hpCards.length)).toEqual([1,4]);expect(state.players['player-two'].breakArea).toEqual([])
})

const printed:Record<string,number>={'BS12-001':4,'BS12-003':2,'BS12-019':4,'BS12-024':2,'BS12-040':3,'BS12-064':5,'BS12-078':3,'BS12-079':2,'BS12-080':1,'BS12-091':2,'BS12-094':4,'BS12-095':1,'BS12-096':1,'BS12-097':2,'BS12-098':1,'BS11-092':4,'BS11-093':1,'BS11-095':1,'ST4-001':3}
const sources=[['095',demos.BS12_BLUEBERRY_SCENARIOS,demos.createBs12BlueberryDemoState],['096',demos.BS12_CRIMSON_SCENARIOS,demos.createBs12CrimsonDemoState],['098',demos.BS12_CARAMEL_PUDDING_SCENARIOS,demos.createBs12CaramelPuddingDemoState]]as const
for(const[number,scenarios,factory]of sources)for(const scenario of scenarios)it(`${number} physical identity and independently transcribed HP ${scenario}`,()=>{
 const state=(factory as (s:never,wait?:boolean)=>ReturnType<typeof demos.createBs12BlueberryDemoState>)(scenario as never,true);assertBs12PhysicalFixture(state)
 for(const player of Object.values(state.players))for(const entry of player.battleArea){
  expect(printed[entry.card.id],entry.card.id).toBeDefined()
  const damage=number==='095'&&scenario.startsWith('flip')&&entry.card.instanceId==='bs12-095-bearer'?(scenario==='flip-last-hp'?2:1):0
  expect(entry.hpCards.length,`${scenario}:${entry.card.instanceId}`).toBe(printed[entry.card.id]-damage)
 }
 if(scenario.startsWith('flip')){
  expect(state.commandLog?.filter(e=>e.commandKind==='declare-attack')).toHaveLength(1)
  if(number==='095'){
   expect(state.pendingBattle?.revealedHpCard?.id).toBe('BS12-095')
   expect(state.commandLog?.filter(e=>e.commandKind==='resolve-next-damage')).toHaveLength(scenario==='flip-last-hp'?2:1)
   expect(state.commandLog?.find(e=>e.commandKind==='declare-attack')?.summary).toContain(scenario==='flip-last-hp'?'Caramel Arrow Cookie':'Peach Cookie')
  }else{
   expect(state.pendingBattle?.stage).toBe('damage')
   expect(state.commandLog?.some(e=>e.commandKind==='resolve-next-damage')).toBe(false)
  }
 }
})
it('095 blue target is actual BLUE Cream Puff HP5, never GREEN Cream Ferret',()=>{
 const state=demos.createBs12BlueberryDemoState('flip-blue');assertBs12PhysicalFixture(state)
 expect(state.players['player-one'].battleArea[1].card.id).toBe('BS12-064');expect(state.players['player-one'].battleArea[1].card.cardColor).toBe('blue');expect(state.players['player-one'].battleArea[1].hpCards).toHaveLength(5)
})
it.each([['flip-blue','BS12-064',5],['flip-black','BS12-095',1]]as const)('095 actual FLIP may add HP above printed HP on %s',(scenario,id,hp)=>{
 const before=demos.createBs12BlueberryDemoState(scenario);assertBs12PhysicalFixture(before)
 const companion=before.players['player-one'].battleArea[1];expect(companion.card.id).toBe(id);expect(companion.hpCards).toHaveLength(hp)
 const state=applyGameCommand(before,{kind:'resolve-flip',playerId:'player-one',activate:true,discardHandIds:['bs12-095-hand-cost'],targetIds:['bs12-095-companion']});assertBs12PhysicalFixture(state)
 expect(state.players['player-one'].battleArea[1].card).toEqual(companion.card)
 expect(state.players['player-one'].battleArea[1].hpCards).toEqual([...companion.hpCards,before.players['player-one'].deck[0]])
 expect(state.players['player-one'].battleArea[1].hpCards).toHaveLength(hp+1)
 expect(state.commandLog?.at(-1)?.commandKind).toBe('resolve-flip')
})
for(const scenario of demos.BS12_CARAMEL_PUDDING_SCENARIOS.filter(s=>s.startsWith('flip')))it('098 last/current HP is reached through actual printed damage '+scenario,()=>{
 const before=demos.createBs12CaramelPuddingDemoState(scenario,true),state=demos.createBs12CaramelPuddingDemoState(scenario);assertBs12PhysicalFixture(before);assertBs12PhysicalFixture(state)
 const hp=printed[before.players['player-one'].battleArea[0].card.id],hits=scenario.startsWith('flip-last-hp')?hp:1
 expect(state.commandLog?.filter(e=>e.commandKind==='resolve-next-damage')).toHaveLength(hits)
 const expectedAttacker=scenario.startsWith('flip-last-hp')?hp===2?'BS12-091':hp===3?'BS12-078':'BS12-019':'BS12-003'
 expect(before.players['player-two'].battleArea[0].card.id).toBe(expectedAttacker)
 expect(before.players['player-two'].supportArea.every(s=>s.rested)).toBe(true)
 const ineligible=['flip-lv-one','flip-no-black','flip-black-non-arena','flip-split','flip-support-only','flip-hand-only','flip-trash-only','flip-break-only','flip-opponent-only','flip-last-hp-lv-one'].includes(scenario)
 if(ineligible){
  expect(state.pendingBattle?.revealedHpCard).toBeUndefined()
  expect(state.players['player-one'].discardPile.some(c=>c.id==='BS12-098')).toBe(true)
  expect(state.commandLog?.filter(e=>e.commandKind==='resolve-next-damage').at(-1)?.summary).toContain('Caramel Pudding Cake Hound')
 }else expect(state.pendingBattle?.revealedHpCard?.id).toBe('BS12-098')
 if(scenario==='flip-last-hp-lv-one'){
  expect(state.players['player-one'].breakArea.map(c=>c.id)).toEqual(['BS12-003'])
  expect(state.players['player-one'].battleArea.map(c=>c.card.instanceId)).toEqual(['bs12-098-companion'])
 }else expect(state.players['player-one'].battleArea[0].hpCards).toHaveLength(printed[before.players['player-one'].battleArea[0].card.id]-hits)
})
it.each(['095','096','098']as const)('%s actual special-play discards printed HP1 cost, enters printed HP1',number=>{
 const factory=number==='095'?demos.createBs12BlueberryDemoState:number==='096'?demos.createBs12CrimsonDemoState:demos.createBs12CaramelPuddingDemoState
 const before=factory('special');assertBs12PhysicalFixture(before)
 const state=applyGameCommand(before,{kind:'deploy-cookie',playerId:'player-one',instanceId:`bs12-${number}-source`,specialPlayCookieInstanceIds:['bs12-095-cost']});assertBs12PhysicalFixture(state)
 expect(state.players['player-one'].discardPile).toHaveLength(2)
 expect(state.players['player-one'].battleArea[0].card.id).toBe(`BS12-${number}`)
 expect(state.players['player-one'].battleArea[0].hpCards).toHaveLength(1)
 expect(state.players['player-one'].deck).toHaveLength(11)
})

const entries=[['094',demos.createBs12ButterRollDemoState],['095',demos.createBs12BlueberryDemoState],['096',demos.createBs12CrimsonDemoState],['097',demos.createBs12JasmineDemoState],['098',demos.createBs12CaramelPuddingDemoState]]as const
for(const[number,factory]of entries)for(const negative of [false,true]){
 const ordinary=['094','097'].includes(number),scenario=ordinary?negative?number==='097'?'no-energy':'few-energy':'attack':negative?'special-wrong-level':'special'
 it(`${number} ${negative?'negative':'positive'} generic URL uses independently physical scene`,()=>{
  const expected=(factory as (s:never)=>ReturnType<typeof demos.createBs12BlueberryDemoState>)(scenario as never),state=negative?demos.createCardNegativeDemoState(`BS12-${number}`):demos.createCardCheckDemoState(`BS12-${number}`)
  expect(demos.parseTestStateConfig(`?test-state=${negative?'card-negative':'card'}:BS12-${number}`,'localhost')).toEqual({kind:`bs12-${number}`,scenario})
  assertBs12PhysicalFixture(state);expect(state).toEqual(expected)
 })
 it(`${number} ${negative?'blocked':'payable'} normal attack route uses actual printed payment`,()=>{
  const option=negative?'blocked':'payable',state=negative?demos.createCardNegativeDemoState(`BS12-${number}`,{normalAttack:option}):demos.createCardCheckDemoState(`BS12-${number}`,{normalAttack:option})
  assertBs12PhysicalFixture(state);expect(state).toEqual((factory as (s:never)=>ReturnType<typeof demos.createBs12BlueberryDemoState>)((ordinary?negative?number==='097'?'no-energy':'few-energy':'attack':negative?'attack-few-energy':'attack')as never))
  expect(state.players['player-one'].supportArea).toHaveLength(ordinary?negative?number==='094'?2:0:number==='094'?3:1:negative?1:2)
 })
}
