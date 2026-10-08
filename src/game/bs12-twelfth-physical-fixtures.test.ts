import {expect,it} from 'vitest'
import {createBs12AudienceDemoState,createBs12MelodyDemoState,createBs12FerretDemoState,createBs12CocoaDemoState,createBs12KumihoDemoState,createCardCheckDemoState,createCardNegativeDemoState,parseTestStateConfig} from './demo'
import {applyGameCommand} from './commands'
import {assertBs12PhysicalFixture} from './bs12-physical-fixtures.test-helpers'

it.each([["positive","BS12-049"],["rested-cost","BS12-049"],["non-arena-only","BS12-049"],["opponent-only","BS12-049"],["battle-only","BS12-049"],["no-energy","BS12-049"],["wrong-energy","BS12-049"],["rested-energy","BS12-049"],["disabled","BS12-049"],["used","BS12-049"],["main","BS12-049"],["after-battle","BS12-049"],["last-deck","BS12-049"],["refresh-lv10","BS12-049"]] as const)('049 %s %s matches physical records and initial printed HP',(scenario,_number)=>{
 const state=createBs12AudienceDemoState(scenario)
 assertBs12PhysicalFixture(state)
 for(const player of Object.values(state.players))for(const cookie of player.battleArea)expect(cookie.hpCards.length,cookie.card.name).toBeLessThanOrEqual(cookie.card.hp)
})

it.each([["positive","BS12-050"],["empty-trash","BS12-050"],["non-arena-only","BS12-050"],["opponent-only","BS12-050"],["battle-only","BS12-050"],["no-energy","BS12-050"],["wrong-energy","BS12-050"],["few-energy","BS12-050"],["rested-energy","BS12-050"],["opponent-turn","BS12-050"],["outside-main","BS12-050"],["last-deck","BS12-050"]] as const)('050 %s %s matches physical records and initial printed HP',(scenario,_number)=>{
 const state=createBs12MelodyDemoState(scenario)
 assertBs12PhysicalFixture(state)
 for(const player of Object.values(state.players))for(const cookie of player.battleArea)expect(cookie.hpCards.length,cookie.card.name).toBeLessThanOrEqual(cookie.card.hp)
})

it.each([["positive","BS12-051@1"],["rested-entry","BS12-051@1"],["high-level","BS12-051@1"],["no-arena","BS12-051@1"],["item-only","BS12-051@1"],["full-battle","BS12-051@1"],["no-energy","BS12-051@1"],["wrong-energy","BS12-051@1"],["rested-energy","BS12-051@1"],["source-rested","BS12-051@1"],["source-support","BS12-051@1"],["opponent-turn","BS12-051@1"],["outside-main","BS12-051@1"],["target-last-hp","BS12-051@1"],["last-deck","BS12-051@1"],["short-deck","BS12-051@1"],["refresh-lv10","BS12-051@1"],["positive","BS12-051"],["rested-entry","BS12-051"],["high-level","BS12-051"],["no-arena","BS12-051"],["item-only","BS12-051"],["full-battle","BS12-051"],["no-energy","BS12-051"],["wrong-energy","BS12-051"],["rested-energy","BS12-051"],["source-rested","BS12-051"],["source-support","BS12-051"],["opponent-turn","BS12-051"],["outside-main","BS12-051"],["target-last-hp","BS12-051"],["last-deck","BS12-051"],["short-deck","BS12-051"],["refresh-lv10","BS12-051"]] as const)('051 %s %s matches physical records and initial printed HP',(scenario,number)=>{
 const state=createBs12FerretDemoState(scenario,number)
 assertBs12PhysicalFixture(state)
 for(const player of Object.values(state.players))for(const cookie of player.battleArea)expect(cookie.hpCards.length,cookie.card.name).toBeLessThanOrEqual(cookie.card.hp)
})

it.each([["positive","BS12-052@1"],["rested-entry","BS12-052@1"],["no-hand","BS12-052@1"],["item-hand","BS12-052@1"],["stage-hand","BS12-052@1"],["non-arena-hand","BS12-052@1"],["hand","BS12-052@1"],["stage-entry","BS12-052@1"],["full-battle","BS12-052@1"],["last-hp","BS12-052@1"],["short-deck","BS12-052@1"],["last-deck","BS12-052@1"],["refresh-lv10","BS12-052@1"],["isolated-opponent-turn","BS12-052@1"],["attack","BS12-052@1"],["attack-blue","BS12-052@1"],["attack-wrong","BS12-052@1"],["attack-few","BS12-052@1"],["attack-rested-energy","BS12-052@1"],["attack-rested-source","BS12-052@1"],["positive","BS12-052"],["rested-entry","BS12-052"],["no-hand","BS12-052"],["item-hand","BS12-052"],["stage-hand","BS12-052"],["non-arena-hand","BS12-052"],["hand","BS12-052"],["stage-entry","BS12-052"],["full-battle","BS12-052"],["last-hp","BS12-052"],["short-deck","BS12-052"],["last-deck","BS12-052"],["refresh-lv10","BS12-052"],["isolated-opponent-turn","BS12-052"],["attack","BS12-052"],["attack-blue","BS12-052"],["attack-wrong","BS12-052"],["attack-few","BS12-052"],["attack-rested-energy","BS12-052"],["attack-rested-source","BS12-052"]] as const)('052 %s %s matches physical records and initial printed HP',(scenario,number)=>{
 const state=createBs12CocoaDemoState(scenario,number)
 assertBs12PhysicalFixture(state)
 for(const player of Object.values(state.players))for(const cookie of player.battleArea)expect(cookie.hpCards.length,cookie.card.name).toBeLessThanOrEqual(cookie.card.hp)
})

it.each([["response","BS12-053@1"],["response-rested-source","BS12-053@1"],["response-other","BS12-053@1"],["response-no-support","BS12-053@1"],["response-rested-support","BS12-053@1"],["response-used","BS12-053@1"],["response-last-hp","BS12-053@1"],["attack","BS12-053@1"],["attack-active-fifth","BS12-053@1"],["attack-rested-fifth","BS12-053@1"],["attack-few","BS12-053@1"],["attack-wrong","BS12-053@1"],["attack-rested-energy","BS12-053@1"],["attack-rested-source","BS12-053@1"],["attack-source-support","BS12-053@1"],["attack-opponent-turn","BS12-053@1"],["attack-outside-main","BS12-053@1"],["attack-target-faint","BS12-053@1"],["attack-other-faint","BS12-053@1"],["attack-flip","BS12-053@1"],["response","BS12-053"],["response-rested-source","BS12-053"],["response-other","BS12-053"],["response-no-support","BS12-053"],["response-rested-support","BS12-053"],["response-used","BS12-053"],["response-last-hp","BS12-053"],["attack","BS12-053"],["attack-active-fifth","BS12-053"],["attack-rested-fifth","BS12-053"],["attack-few","BS12-053"],["attack-wrong","BS12-053"],["attack-rested-energy","BS12-053"],["attack-rested-source","BS12-053"],["attack-source-support","BS12-053"],["attack-opponent-turn","BS12-053"],["attack-outside-main","BS12-053"],["attack-target-faint","BS12-053"],["attack-other-faint","BS12-053"],["attack-flip","BS12-053"]] as const)('053 %s %s matches physical records and initial printed HP',(scenario,number)=>{
 const state=createBs12KumihoDemoState(scenario,number)
 assertBs12PhysicalFixture(state)
 for(const player of Object.values(state.players))for(const cookie of player.battleArea)expect(cookie.hpCards.length,cookie.card.name).toBeLessThanOrEqual(cookie.card.hp)
})

it.each([["049","positive","non-arena-only"],["050","positive","non-arena-only"],["051","positive","no-arena"],["051@1","positive","no-arena"],["052","positive","hand"],["052@1","positive","hand"],["053","response","response-no-support"],["053@1","response","response-no-support"]] as const)('%s generic routes use physical effect-specific witnesses',(number,positive,negative)=>{
 const id='BS12-'+number,base=number.slice(0,3)
 for(const[prefix,scenario]of [['card',positive],['card-negative',negative]]as const){
  expect(parseTestStateConfig('?test-state='+prefix+':'+id,'localhost')).toEqual({kind:'bs12-'+base,scenario,...(['051','052','053'].includes(base)?{cardNumber:id}:{})})
  expect(parseTestStateConfig('?test-state='+prefix+':'+id,'example.com')).toBeNull()
  const state=prefix==='card'?createCardCheckDemoState(id):createCardNegativeDemoState(id);assertBs12PhysicalFixture(state)
  const own=state.players['player-one']
  if(base==='049')expect(own.supportArea.some(s=>s.card.keywords?.includes('arena'))).toBe(prefix==='card')
  if(base==='050')expect(own.discardPile.some(c=>c.type==='cookie'&&c.keywords?.includes('arena'))).toBe(prefix==='card')
  if(base==='051')expect(own.supportArea.some(s=>s.card.type==='cookie'&&s.card.keywords?.includes('arena'))).toBe(prefix==='card')
  if(base==='052'){expect(own.supportArea.some(s=>s.card.id==='BS12-052')).toBe(prefix==='card');expect(own.hand.some(c=>c.id==='BS12-052')).toBe(prefix==='card-negative')}
  if(base==='053'){expect(state.pendingBattle?.attackerInstanceId).toBe('bs12-044-opponent');expect(own.supportArea.length).toBe(prefix==='card'?4:0)}
 }
})

it.each(["BS12-049","BS12-050","BS12-051","BS12-051@1","BS12-052","BS12-052@1","BS12-053","BS12-053@1"] as const)('%s default HP has no unproved printed gain',number=>{
 const state=createCardCheckDemoState(number)
 for(const player of Object.values(state.players))for(const cookie of player.battleArea)expect(cookie.hpCards.length,cookie.card.name).toBeLessThanOrEqual(cookie.card.hp)
})

it.each([['BS12-052','positive'],['BS12-052','stage-entry'],['BS12-052@1','positive'],['BS12-052@1','stage-entry']]as const)('%s %s actual parent enters Cocoa and pays its printed hand cost',(number,scenario)=>{
 let state=createBs12CocoaDemoState(scenario,number)
 if(scenario==='stage-entry')state=applyGameCommand(state,{kind:'activate-stage',playerId:'player-one',paymentIds:[],effectTargets:[['bs12-052-source']]})
 else{
  state=applyGameCommand(state,{kind:'declare-attack',playerId:'player-one',attackerInstanceId:'bs12-051-source',targetInstanceId:'bs12-044-opponent',supportPaymentIds:['bs12-051-support-0']})
  state=applyGameCommand(state,{kind:'skip-trap',playerId:'player-two'})
  for(let i=0;state.pendingBattle?.stage==='damage'&&i<10;i++)state=applyGameCommand(state,{kind:'resolve-next-damage',playerId:'player-two'})
  state=applyGameCommand(state,{kind:'resolve-attack-effect',playerId:'player-one',targetIds:['bs12-052-source']})
 }
 assertBs12PhysicalFixture(state)
 expect(state.pendingOnPlay).toMatchObject({origin:'support',sourceInstanceId:'bs12-052-source'})
 expect(state.players['player-one'].battleArea.at(-1)?.hpCards).toHaveLength(2)
 const cost=state.players['player-one'].hand[0]
 state=applyGameCommand(state,{kind:'activate-skill',playerId:'player-one',sourceInstanceId:'bs12-052-source',trigger:'on-play',paymentIds:[],discardHandIds:[cost.instanceId],effectTargets:[['bs12-044-opponent-other']]})
 for(let i=0;state.pendingBattle?.stage==='damage'&&i<10;i++)state=applyGameCommand(state,{kind:'resolve-next-damage',playerId:'player-two'})
 expect(state.players['player-two'].battleArea[1].hpCards).toHaveLength(2)
 expect(state.players['player-one'].discardPile.some(c=>c.instanceId===cost.instanceId)).toBe(true)
 assertBs12PhysicalFixture(state)
})

it.each(['BS12-053','BS12-053@1']as const)('%s response begins with printed neutral parent payment',number=>{
 const state=createBs12KumihoDemoState('response',number)
 expect(state.players['player-two'].battleArea[0].card).toMatchObject({id:'BS12-001',attack:4,hp:4,attackEnergyCost:{neutral:3}})
 expect(state.players['player-two'].battleArea[0].hpCards).toHaveLength(4)
 expect(state.players['player-two'].supportArea.map(s=>s.rested)).toEqual([true,true,true])
 expect(state.pendingBattle?.remainingDamage).toBe(4)
 expect(state.commandLog?.some(c=>c.commandKind==='declare-attack')).toBe(true)
 assertBs12PhysicalFixture(state)
})

it.each(['BS12-053','BS12-053@1']as const)('%s another attacked Cookie uses its printed four HP',number=>{
 const state=createBs12KumihoDemoState('response-other',number)
 const ally=state.players['player-one'].battleArea.find(c=>c.card.instanceId==='bs12-053-ally')!
 expect(ally.card).toMatchObject({id:'BS12-039',hp:4})
 expect(ally.hpCards).toHaveLength(4)
 expect(state.pendingBattle?.targetInstanceId).toBe(ally.card.instanceId)
})
