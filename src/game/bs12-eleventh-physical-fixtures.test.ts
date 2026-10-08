import {expect,it} from 'vitest'
import {createBs12HerbTeapotDemoState,createBs12CloverDemoState,createBs12CameraDemoState,createBs12HarmonyDemoState,createBs12OrchestraDemoState,createBs12KumihoDemoState,createCardCheckDemoState,createCardNegativeDemoState,parseTestStateConfig} from './demo'
import {assertBs12PhysicalFixture} from './bs12-physical-fixtures.test-helpers'

it.each(["positive","not-herb","wrong-name","rested-herb","source-rested","active-target","all-active","blue-target","no-arena","item-only","no-support","full-battle","existing-herb","opponent-turn","outside-main","used","last-deck","short-deck","refresh-lv10","attack","attack-wrong","attack-few","attack-rested","deploy"] as const)('044 %s matches physical records in every zone',scenario=>assertBs12PhysicalFixture(createBs12HerbTeapotDemoState(scenario)))

it.each(["five","four","six","zero","all-rested","non-arena","opponent-only","battle-only","support-five","support-four","opponent-turn","short-deck","last-deck","refresh-lv10","attack","attack-blue","attack-wrong","attack-few","attack-rested","attack-rested-source"] as const)('045 %s matches physical records in every zone',scenario=>assertBs12PhysicalFixture(createBs12CloverDemoState(scenario)))

it.each(["positive","no-event","removed","old-turn","hand-entry","opponent-entry","no-energy","wrong-energy","rested-energy","rested-entry","short-deck","last-deck","refresh-lv10","opponent-turn","outside-main"] as const)('046 %s matches physical records in every zone',scenario=>assertBs12PhysicalFixture(createBs12CameraDemoState(scenario)))

it.each(["seven","six","eight","non-arena","rested-other","opponent-only","battle-only","no-energy","one-energy","wrong-energy","mixed-energy","rested-energy","one-rested","disabled","used","main","after-battle","short-deck","refresh-lv10"] as const)('047 %s matches physical records in every zone',scenario=>assertBs12PhysicalFixture(createBs12HarmonyDemoState(scenario)))

it.each(["positive","placed","replace","rested-entry","blue-entry","no-arena","item-only","no-support","full-battle","no-energy","wrong-energy","rested-energy","entry-only-energy","rested-source","opponent-turn","outside-main","no-opponent-support","rested-target","last-deck","short-deck","refresh-lv10"] as const)('048 %s matches physical records in every zone',scenario=>assertBs12PhysicalFixture(createBs12OrchestraDemoState(scenario)))

it.each([["044","positive","item-only"],["045","five","four"],["046","positive","hand-entry"],["047","seven","six"],["048","positive","item-only"]] as const)('%s generic positive/negative are physical and mechanism-specific',(number,positive,negative)=>{
 const id='BS12-'+number
 for(const[prefix,scenario]of [['card',positive],['card-negative',negative]]as const){
  expect(parseTestStateConfig('?test-state='+prefix+':'+id,'localhost')).toMatchObject({kind:'bs12-'+number,scenario})
  expect(parseTestStateConfig('?test-state='+prefix+':'+id,'example.com')).toBeNull()
  const state=prefix==='card'?createCardCheckDemoState(id):createCardNegativeDemoState(id);assertBs12PhysicalFixture(state)
  const own=state.players['player-one']
  if(number==='044')expect(own.supportArea.some(s=>s.card.type==='cookie')).toBe(prefix==='card')
  if(number==='045')expect(own.supportArea.length).toBe(prefix==='card'?5:4)
  if(number==='046'){expect(own.hand.map(c=>c.id)).toContain(id);expect(state.cookiesPlayedFromSupportThisTurn?.['player-one']??false).toBe(false);expect(own.supportArea.some(s=>s.card.id==='BS12-055')).toBe(true)}
  if(number==='047'){expect(state.pendingBattle?.stage).toBe('trap');expect(own.supportArea.length).toBe(prefix==='card'?7:6)}
  if(number==='048'){expect(own.hand.map(c=>c.id)).toContain(id);expect(own.supportArea.filter(s=>s.card.type==='cookie'&&s.card.keywords?.includes('arena')).length).toBe(prefix==='card'?2:0)}
 }
})

it.each(['044','045','047']as const)('%s prepared damage parent HP respects actual printed capacity',number=>{
 const state=number==='044'?createBs12HerbTeapotDemoState('attack'):number==='045'?createBs12CloverDemoState('attack'):createBs12HarmonyDemoState('seven')
 for(const player of Object.values(state.players))for(const cookie of player.battleArea)expect(cookie.hpCards.length,cookie.card.name).toBeLessThanOrEqual(cookie.card.hp)
 if(number!=='047')expect(state.players['player-two'].battleArea[0].card.id).toBe('BS6-008')
 else expect(state.players['player-one'].battleArea[0].card.id).toBe('BS7-055')
})

it('046 removal event is caused by actual printed stage rather than injected movement',()=>{
 const state=createBs12CameraDemoState('removed');assertBs12PhysicalFixture(state)
 expect(state.players['player-one'].stage?.card.id).toBe('BS8-025');expect(state.players['player-one'].stage?.rested).toBe(true)
 expect(state.players['player-one'].breakArea.some(c=>c.id==='BS12-055')).toBe(true)
 expect(state.cookiesPlayedFromSupportThisTurn?.['player-one']).toBe(true)
 expect(state.commandLog?.some(c=>c.commandKind==='activate-stage')).toBe(true)
})

it('046 opponent support entry uses real Shining Glitter skill and does not satisfy own event',()=>{
 const state=createBs12CameraDemoState('opponent-entry');assertBs12PhysicalFixture(state)
 expect(state.players['player-two'].battleArea.map(c=>c.card.id)).toEqual(['BS7-055','BS12-003'])
 expect(state.cookiesPlayedFromSupportThisTurn?.['player-two']).toBe(true);expect(state.cookiesPlayedFromSupportThisTurn?.['player-one']??false).toBe(false)
 expect(state.commandLog?.some(c=>c.commandKind==='activate-skill'&&c.playerId==='player-two')).toBe(true)
})

it.each(['BS12-053','BS12-053@1']as const)('%s inherited response keeps the actual neutral-cost attacker',number=>{
 const state=createBs12KumihoDemoState('response',number)
 const parent=state.players['player-two'].battleArea[0]
 expect(parent.card).toMatchObject({id:'BS12-001',hp:4,attack:4,attackEnergyCost:{neutral:3}})
 expect(parent.hpCards).toHaveLength(4)
 expect(state.players['player-two'].supportArea).toHaveLength(3)
 expect(state.players['player-two'].supportArea.every(s=>s.rested)).toBe(true)
 expect(state.pendingBattle?.remainingDamage).toBe(4)
})
