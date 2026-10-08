import {getFaintEffectCardCandidates} from './battle'
import {applyGameCommand} from './commands'
import {assertBs12PhysicalFixture} from './bs12-physical-fixtures.test-helpers'
import * as demos from './demo'
import {BS12_CAKE_HOUND_SCENARIOS,createBs12CakeHoundDemoState,BS12_STRATEGIST_SCENARIOS,createBs12StrategistDemoState,BS12_CHESS_CHOCO_SCENARIOS,BS12_COFFEE_TRUCK_SCENARIOS,BS12_SUNGLASSES_SCENARIOS,createBs12ChessChocoDemoState,createBs12CoffeeTruckDemoState,createBs12SunglassesDemoState} from './demo'
import {expect,it} from 'vitest'
import {getCardPoolEntry} from './card-pool'

// Independent printed-card cases from test-results/bs12-twenty-second-cake-hound-physical.check.ts
it.each(BS12_CAKE_HOUND_SCENARIOS)('099 draft %s uses exact original cards and actual printedHP parents',scenario=>{
 const s=createBs12CakeHoundDemoState(scenario,true);assertBs12PhysicalFixture(s)
 for(const p of Object.values(s.players))for(const c of p.battleArea)expect(c.hpCards.length).toBeLessThanOrEqual(c.card.hp)
 if(!['direct-faint','own-turn','effect-damage','deploy'].includes(scenario))expect(s.players['player-one'].battleArea.find(c=>c.card.instanceId==='bs12-099-source')?.hpCards).toHaveLength(2)
})
it.each(['faint','old-target','same-name','lv-one','rested-source','hand-and-support'] as const)('099 %s takes real PN2 damage from printed2HP before recovery',scenario=>{
 const before=createBs12CakeHoundDemoState(scenario,true)
 expect(before.players['player-one'].battleArea[0].hpCards).toHaveLength(2)
 expect(before.players['player-two'].battleArea[0].card.id).toBe('BS12-091')
 expect(before.players['player-two'].supportArea.filter(c=>c.rested)).toHaveLength(2)
 const s=createBs12CakeHoundDemoState(scenario)
 expect(s.commandLog?.map(c=>c.commandKind)).toEqual(['declare-attack','skip-trap','resolve-next-damage','resolve-next-damage'])
 expect(s.players['player-one'].breakArea.map(c=>c.instanceId)).toEqual(['bs12-099-source'])
 expect(s.players['player-one'].discardPile.filter(c=>c.instanceId.startsWith('bs12-099-source-hp-'))).toHaveLength(2)
 expect(s.pendingFaintEffects?.[0].cost?.deckToTrash?.amount).toBe(3)
 expect(getFaintEffectCardCandidates(s)).toEqual([])
 let paid=applyGameCommand(s,{kind:'resolve-faint-effect',playerId:'player-one',payDeckToTrash:true,targetIds:[]})
 assertBs12PhysicalFixture(paid)
 expect(getFaintEffectCardCandidates(paid).some(c=>c.instanceId==='bs12-099-milled-target')).toBe(true)
 expect(getFaintEffectCardCandidates(paid).some(c=>c.instanceId==='bs12-099-source')).toBe(false)
 paid=applyGameCommand(paid,{kind:'resolve-faint-effect',playerId:'player-one',targetIds:['bs12-099-milled-target']})
 assertBs12PhysicalFixture(paid)
 expect(paid.players['player-one'].hand.some(c=>c.instanceId==='bs12-099-milled-target')).toBe(true)
})
it.each(['direct-faint','own-turn'] as const)('099 %s comes from printed Red Velvet RRN3 Then',scenario=>{
 const s=createBs12CakeHoundDemoState(scenario);assertBs12PhysicalFixture(s)
 expect(s.activePlayerId).toBe('player-one')
 expect(s.players['player-one'].battleArea.map(c=>[c.card.id,c.hpCards.length])).toEqual([['BS8-010',4]])
 expect(s.players['player-two'].battleArea.map(c=>[c.card.id,c.hpCards.length])).toEqual([['BS12-019',1]])
 expect(s.commandLog?.map(c=>c.commandKind)).toEqual(['declare-attack','skip-trap','resolve-next-damage','resolve-next-damage','resolve-next-damage','resolve-attack-effect'])
 expect(s.commandLog?.at(-1)?.payload).toMatchObject({targetIds:['bs12-099-source']})
 expect(s.players['player-one'].discardPile).toHaveLength(2)
 expect(s.pendingFaintEffects?.[0].sourceInstanceId).toBe('bs12-099-source')
})
it('099 effect damage uses an actual own faint, replacement and two separately used Red Velvet skills',()=>{
 const s=createBs12CakeHoundDemoState('effect-damage');assertBs12PhysicalFixture(s)
 expect(s.commandLog?.map(c=>c.commandKind)).toEqual(['declare-attack','skip-trap','resolve-next-damage','resolve-next-damage','resolve-next-damage','resolve-attack-effect','replace-cookie','activate-skill','activate-skill'])
 expect(s.commandLog?.filter(c=>c.commandKind==='activate-skill').map(c=>c.payload)).toMatchObject([
  {sourceInstanceId:'bs12-099-opponent',paymentIds:[],effectTargets:[['bs12-099-source']]},
  {sourceInstanceId:'bs12-099-red-velvet-second',paymentIds:[],effectTargets:[['bs12-099-source']]},
 ])
 expect(s.players['player-one'].battleArea.map(c=>[c.card.id,c.hpCards.length])).toEqual([['BS12-019',1]])
 expect(s.players['player-one'].breakArea.map(c=>c.id)).toEqual(['BS12-099'])
 expect(s.players['player-one'].discardPile).toHaveLength(5)
 expect(s.players['player-two'].battleArea.map(c=>[c.card.id,c.hpCards.length])).toEqual([['BS8-010',4],['BS8-010',4]])
 expect(s.players['player-two'].breakArea.map(c=>c.id)).toEqual(['BS12-003'])
 expect(s.players['player-two'].deck).toHaveLength(8)
 expect(s.pendingFaintEffects?.[0].sourceInstanceId).toBe('bs12-099-source')
})
it('099 lastHP FLIP begins with full printed2HP and reveals after both PN2 hits; real heal prevents faint',()=>{
 let s=createBs12CakeHoundDemoState('last-hp-flip')
 expect(s.commandLog?.filter(c=>c.commandKind==='resolve-next-damage')).toHaveLength(2)
 expect(s.players['player-one'].battleArea[0].hpCards).toHaveLength(0)
 expect(s.pendingBattle?.revealedHpCard?.id).toBe('BS12-002')
 expect(s.players['player-one'].discardPile).toHaveLength(1)
 s=applyGameCommand(s,{kind:'resolve-flip',playerId:'player-one',activate:true,discardHandIds:['bs12-099-hand-cost'],targetIds:['bs12-099-source']})
 assertBs12PhysicalFixture(s)
 expect(s.players['player-one'].battleArea[0].hpCards).toHaveLength(1)
 expect(s.players['player-one'].breakArea).toEqual([])
 expect(s.pendingFaintEffects).toBeUndefined()
})

// Independent printed-card cases from test-results/bs12-twenty-second-strategist-physical.check.ts
it.each(BS12_STRATEGIST_SCENARIOS)('100 draft %s uses exact physical cards and printed initial HP',scenario=>{
 const s=createBs12StrategistDemoState(scenario,true);assertBs12PhysicalFixture(s)
 for(const p of Object.values(s.players))for(const c of p.battleArea)expect(c.hpCards).toHaveLength(c.card.hp)
 if(scenario.startsWith('flip'))expect(s.players['player-one'].battleArea.map(c=>c.hpCards.length)).toEqual([2,2])
})
it.each(['flip','flip-same-name','flip-pudding'] as const)('100 %s free recovery follows printedPeachN1 and preserves companion',scenario=>{
 let s=createBs12StrategistDemoState(scenario)
 expect(s.commandLog?.map(c=>c.commandKind)).toEqual(['declare-attack','skip-trap','resolve-next-damage'])
 expect(s.players['player-one'].battleArea.map(c=>c.hpCards.length)).toEqual([1,2])
 expect(s.pendingBattle?.revealedHpCard?.id).toBe('BS12-100')
 const deck=s.players['player-one'].deck
 s=applyGameCommand(s,{kind:'resolve-flip',playerId:'player-one',activate:true,targetIds:['bs12-100-target']})
 assertBs12PhysicalFixture(s)
 expect(s.players['player-one'].hand.map(c=>c.instanceId)).toEqual(['bs12-100-target'])
 expect(s.players['player-one'].battleArea.map(c=>c.hpCards.length)).toEqual([1,2])
 expect(s.players['player-one'].deck).toEqual(deck)
})
it.each(['flip-last-hp','flip-last-hp-same-name','flip-last-hp-faint-chain'] as const)('100 %s uses realPN2 from full2HP before lastHP recovery and faint',scenario=>{
 let s=createBs12StrategistDemoState(scenario)
 expect(s.commandLog?.filter(c=>c.commandKind==='resolve-next-damage')).toHaveLength(2)
 expect(s.players['player-two'].battleArea[0].card.id).toBe('BS12-091')
 expect(s.players['player-two'].supportArea.filter(c=>c.rested)).toHaveLength(2)
 expect(s.players['player-one'].battleArea.map(c=>c.hpCards.length)).toEqual([0,2])
 expect(s.players['player-one'].discardPile.some(c=>c.instanceId==='bs12-100-bottom-hp')).toBe(true)
 expect(s.players['player-one'].discardPile.some(c=>c.instanceId==='bs12-100-source')).toBe(false)
 s=applyGameCommand(s,{kind:'resolve-flip',playerId:'player-one',activate:true,targetIds:['bs12-100-target']})
 assertBs12PhysicalFixture(s)
 expect(s.players['player-one'].battleArea.map(c=>c.hpCards.length)).toEqual([2])
 expect(s.players['player-one'].breakArea.map(c=>c.id)).toEqual([scenario==='flip-last-hp-faint-chain'?'BS12-099':'BS12-003'])
 expect(s.players['player-one'].discardPile.some(c=>c.instanceId==='bs12-100-source')).toBe(true)
 expect(s.players['player-one'].hand.map(c=>c.instanceId)).toEqual(['bs12-100-target'])
 expect(Boolean(s.pendingFaintEffects?.length)).toBe(scenario==='flip-last-hp-faint-chain')
})

// Independent printed-card cases from test-results/bs12-twenty-second-chess-stage-item-physical.check.ts
it.each(BS12_CHESS_CHOCO_SCENARIOS)('101 %s has physical cards and full printedHP or actual injury',scenario=>{
 const s=createBs12ChessChocoDemoState(scenario);assertBs12PhysicalFixture(s)
 for(const p of Object.values(s.players))for(const c of p.battleArea)expect(c.hpCards.length).toBe(c.card.instanceId==='bs12-101-source'&&scenario==='source-faints'?1:c.card.hp)
 if(scenario==='source-faints'){
  expect(s.commandLog?.slice(0,3).map(c=>c.commandKind)).toEqual(['declare-attack','skip-trap','resolve-next-damage'])
  expect(s.commandLog?.slice(3).every(c=>c.commandKind==='advance-phase')).toBe(true)
  expect(s.activePlayerId).toBe('player-one');expect(s.phase).toBe('main')
  expect(s.players['player-one'].discardPile).toHaveLength(1)
  expect(s.players['player-one'].deck).toHaveLength(10)
  expect(s.players['player-one'].hand).toHaveLength(3)
 }
})
it('101 actual preparatoryPeach hit then CherryFLIP faints source before its printedThen still pays',()=>{
 const before=createBs12ChessChocoDemoState('source-faints')
 let s=applyGameCommand(before,{kind:'declare-attack',playerId:'player-one',attackerInstanceId:'bs12-101-source',targetInstanceId:'bs12-101-opponent',supportPaymentIds:['bs12-101-payment']})
 s=applyGameCommand(s,{kind:'skip-trap',playerId:'player-two'})
 s=applyGameCommand(s,{kind:'resolve-next-damage',playerId:'player-two'})
 expect(s.pendingBattle?.revealedHpCard?.id).toBe('BS12-004')
 expect(s.players['player-two'].battleArea.map(c=>[c.card.id,c.hpCards.length])).toEqual([['BS12-003',1],['BS12-001',4]])
 s=applyGameCommand(s,{kind:'resolve-flip',playerId:'player-two',activate:true,targetIds:['bs12-101-source']})
 if(s.pendingReplacement)s=applyGameCommand(s,{kind:'skip-replacement',playerId:'player-one'})
 while(s.pendingBattle?.stage==='damage')s=applyGameCommand(s,{kind:'resolve-next-damage',playerId:s.pendingBattle.damagePlayerId??s.pendingBattle.defenderPlayerId})
 expect(s.players['player-one'].breakArea.map(c=>c.id)).toEqual(['BS12-101'])
 s=applyGameCommand(s,{kind:'resolve-attack-effect',playerId:'player-one',targetIds:[]})
 s=applyGameCommand(s,{kind:'resolve-optional-cost-attack',playerId:'player-one',action:'pay',paymentIds:[],discardCardIds:['bs12-101-cost'],targetIds:[]})
 s=applyGameCommand(s,{kind:'resolve-draw-up-to',playerId:'player-one',drawCount:1})
 assertBs12PhysicalFixture(s)
 expect(s.players['player-one'].hand).toEqual([...before.players['player-one'].hand.filter(c=>c.instanceId!=='bs12-101-cost'),before.players['player-one'].deck[0]])
 expect(s.players['player-one'].battleArea.map(c=>c.hpCards.length)).toEqual([2])
})
it.each(BS12_COFFEE_TRUCK_SCENARIOS)('102 %s has real negative zones and printed3HP CandyDiver',scenario=>{
 const s=createBs12CoffeeTruckDemoState(scenario);assertBs12PhysicalFixture(s)
 expect(s.players['player-one'].battleArea.map(c=>[c.card.id,c.card.hp,c.hpCards.length])).toEqual([['ST4-001',3,3]])
 for(const c of s.players['player-two'].battleArea)expect(c.hpCards).toHaveLength(c.card.hp)
})
it.each(BS12_SUNGLASSES_SCENARIOS)('103 %s has real peek cards, printed3HP and explicit Refresh origin',scenario=>{
 const s=createBs12SunglassesDemoState(scenario);assertBs12PhysicalFixture(s)
 expect(s.players['player-one'].battleArea[0].card.id).toBe('ST4-001')
 expect(s.players['player-one'].battleArea[0].hpCards).toHaveLength(3)
 if(scenario==='empty-deck'){
  expect(s.commandLog?.map(c=>c.commandKind)).toEqual(['declare-attack','skip-trap','resolve-next-damage','resolve-attack-effect','resolve-optional-cost-attack','resolve-draw-up-to'])
  expect(s.pendingRefresh).toMatchObject({playerId:'player-one',remainingDraws:1})
  expect(s.players['player-one'].battleArea[1].card.id).toBe('BS12-101')
  expect(s.players['player-one'].battleArea[1].hpCards).toHaveLength(2)
  expect(s.players['player-two'].battleArea[0].hpCards).toHaveLength(1)
  expect(s.players['player-one'].hand.map(c=>c.instanceId)).toEqual(['bs12-103-item'])
 }else{
  expect(s.commandLog??[]).toEqual([])
  expect(s.players['player-two'].battleArea[0].hpCards).toHaveLength(2)
 }
})
it('103 actualRefresh continuation clears precedingChess battle before Item usage and preserves its activeK payment',()=>{
 let s=createBs12SunglassesDemoState('empty-deck')
 s=applyGameCommand(s,{kind:'refresh-deck',playerId:'player-one',cookieInstanceId:'bs12-103-refresh'},{shuffle:cards=>[...cards]})
 expect(s.pendingRefresh).toBeFalsy();expect(s.pendingBattle).toBeFalsy()
 expect(s.players['player-one'].supportArea.map(c=>c.rested)).toEqual([false,true])
 assertBs12PhysicalFixture(s)
 s=applyGameCommand(s,{kind:'begin-play-item',playerId:'player-one',instanceId:'bs12-103-item',paymentIds:['bs12-103-payment-0']})
 s=applyGameCommand(s,{kind:'resolve-ability-effect',playerId:'player-one',targetIds:[]})
 expect(s.pendingInspectDeck?.revealedCards).toHaveLength(4)
 expect(s.players['player-one'].supportArea.map(c=>c.rested)).toEqual([true,true])
 assertBs12PhysicalFixture(s)
})

// Independent printed-card cases from test-results/bs12-twenty-second-generic-physical.check.ts
const rows=[
 {number:'BS12-099',positive:'faint',negative:'unpayable',factory:(scenario:'faint'|'unpayable')=>demos.createBs12CakeHoundDemoState(scenario,true)},
 {number:'BS12-100',positive:'special',negative:'special-wrong-level',factory:(scenario:'special'|'special-wrong-level')=>demos.createBs12StrategistDemoState(scenario)},
 {number:'BS12-101',positive:'positive',negative:'non-arena',factory:(scenario:'positive'|'non-arena')=>demos.createBs12ChessChocoDemoState(scenario)},
 {number:'BS12-102',positive:'positive',negative:'split',factory:(scenario:'positive'|'split')=>demos.createBs12CoffeeTruckDemoState(scenario)},
 {number:'BS12-103',positive:'positive',negative:'split',factory:(scenario:'positive'|'split')=>demos.createBs12SunglassesDemoState(scenario)},
] as const
for(const row of rows)for(const negative of [false,true]){
 const route=negative?'card-negative:':'card:',scenario=negative?row.negative:row.positive
 it(route+row.number+' parses only local dedicated effect scene',()=>{
  expect(demos.parseTestStateConfig('?test-state='+route+row.number,'localhost')).toEqual({kind:row.number.toLowerCase(),scenario})
  expect(demos.parseTestStateConfig('?test-state='+route+row.number,'example.com')).toBeNull()
 })
 it(route+row.number+' equals real physical factory and remains candidate-isolated',()=>{
  const s=negative?demos.createCardNegativeDemoState(row.number):demos.createCardCheckDemoState(row.number)
  assertBs12PhysicalFixture(s)
  // The row's expected scenario is narrowed by its printed-card factory above.
  const expected=(row.factory as (fixtureScenario:typeof scenario)=>typeof s)(scenario)
  expect(s).toEqual(expected)
  expect(getCardPoolEntry(row.number)).toBeUndefined()
 })
}
