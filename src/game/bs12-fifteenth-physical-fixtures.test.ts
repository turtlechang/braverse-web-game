import {expect,it} from 'vitest'
import {createBs12CreamPuffDemoState,createBs12FanLetterDemoState,createBs12EndingPoseDemoState,createBs12ComebackStageDemoState,createBs12MultivitaminDemoState,createCardCheckDemoState,createCardNegativeDemoState,parseTestStateConfig} from './demo'
import {assertBs12PhysicalFixture} from './bs12-physical-fixtures.test-helpers'

it.each(["positive","green-arena","red-arena","yellow-arena","non-arena","level-one","level-three","arena-item","top-only","short-deck","empty-deck","deploy","attack","wrong-energy","few-energy","rested-energy","source-rested","opponent-turn","draw-zero","draw-one","skip-skill","cancel-confirm","cancel-payment","cancel-target"] as const)('064 %s matches every physical record and initial printed HP',scenario=>{
 const state=createBs12CreamPuffDemoState(scenario)
 assertBs12PhysicalFixture(state)
 for(const player of Object.values(state.players))for(const cookie of player.battleArea)expect(cookie.hpCards.length,cookie.card.name).toBeLessThanOrEqual(cookie.card.hp)
})

it.each(["positive","green-arena","red-arena","yellow-arena","non-arena","level-one","level-three","arena-item","no-hand","short-deck","empty-deck","no-energy","wrong-energy","rested-energy","disabled","used","main","draw-zero","skip-then","zero-target","other-target","cancel-payment","cancel-target","cancel-then"] as const)('065 %s matches every physical record and initial printed HP',scenario=>{
 const state=createBs12FanLetterDemoState(scenario)
 assertBs12PhysicalFixture(state)
 for(const player of Object.values(state.players))for(const cookie of player.battleArea)expect(cookie.hpCards.length,cookie.card.name).toBeLessThanOrEqual(cookie.card.hp)
})

it.each(["positive","green-arena","red-arena","yellow-arena","non-arena","level-one","level-three","arena-item","top-only","short-deck","refresh-defeat","empty-deck","no-energy","wrong-energy","rested-energy","disabled","used","main","zero-target","other-target","cancel-payment","back-energy"] as const)('066 %s matches every physical record and initial printed HP',scenario=>{
 const state=createBs12EndingPoseDemoState(scenario)
 assertBs12PhysicalFixture(state)
 for(const player of Object.values(state.players))for(const cookie of player.battleArea)expect(cookie.hpCards.length,cookie.card.name).toBeLessThanOrEqual(cookie.card.hp)
})

it.each(["positive","green-arena","red-arena","yellow-arena","non-arena","level-one","level-three","arena-item","top-only","short-deck","refresh-defeat","empty-deck","replace","placed","no-energy","wrong-energy","rested-energy","one-energy","activation-no-energy","activation-wrong-energy","activation-rested-energy","rested-source","opponent-turn","outside-main"] as const)('067 %s matches every physical record and initial printed HP',scenario=>{
 const state=createBs12ComebackStageDemoState(scenario)
 assertBs12PhysicalFixture(state)
 if(scenario==='outside-main')expect(state.phase).toBe('support')
 for(const player of Object.values(state.players))for(const cookie of player.battleArea)expect(cookie.hpCards.length,cookie.card.name).toBeLessThanOrEqual(cookie.card.hp)
})

it.each(["positive","difference-one","equal-support","more-own","large-gap","all-opponent-rested","non-cookie-support","no-energy","wrong-energy","rested-energy","opponent-turn","outside-main","short-deck","refresh-defeat","empty-deck","no-refresh-cookie"] as const)('068 %s matches every physical record and initial printed HP',scenario=>{
 const state=createBs12MultivitaminDemoState(scenario)
 assertBs12PhysicalFixture(state)
 if(scenario==='outside-main')expect(state.phase).toBe('support')
 for(const player of Object.values(state.players))for(const cookie of player.battleArea)expect(cookie.hpCards.length,cookie.card.name).toBeLessThanOrEqual(cookie.card.hp)
})

it.each([["064","positive","non-arena"],["065","positive","non-arena"],["066","positive","non-arena"],["067","placed","non-arena"],["068","positive","difference-one"]] as const)('%s generic routes load dedicated printed positive and negative states',(number,positive,negative)=>{
 const id='BS12-'+number
 for(const[prefix,scenario]of [['card',positive],['card-negative',negative]]as const){
  expect(parseTestStateConfig('?test-state='+prefix+':'+id,'localhost')).toEqual({kind:'bs12-'+number,scenario})
  expect(parseTestStateConfig('?test-state='+prefix+':'+id,'example.com')).toBeNull()
  const state=prefix==='card'?createCardCheckDemoState(id):createCardNegativeDemoState(id);assertBs12PhysicalFixture(state)
  if(number==='064'||number==='066')expect(state.players['player-one'].deck.at(-1)?.id).toBe(prefix==='card'?'BS12-060':'ST4-001')
  if(number==='065')expect(state.players['player-one'].hand[1].id).toBe(prefix==='card'?'BS12-060':'ST4-001')
  if(number==='067'){expect(state.players['player-one'].stage?.card.id).toBe(prefix==='card'?'BS12-067':undefined);expect(state.players['player-one'].deck.at(-1)?.id).toBe(prefix==='card'?'BS12-060':'ST4-001')}
  if(number==='068')expect(state.players['player-two'].supportArea).toHaveLength(prefix==='card'?3:2)
 }
})

it.each(["BS12-064","BS12-065","BS12-066","BS12-067","BS12-068"] as const)('%s generic initial HP does not invent gain',number=>{
 for(const state of[createCardCheckDemoState(number),createCardNegativeDemoState(number)])for(const player of Object.values(state.players))for(const cookie of player.battleArea)expect(cookie.hpCards.length,cookie.card.name).toBeLessThanOrEqual(cookie.card.hp)
})

it('064 OnPlay source comes from real deployment with printed5HP',()=>{
 const state=createBs12CreamPuffDemoState('positive');assertBs12PhysicalFixture(state)
 expect(state.players['player-one'].battleArea[0].card.id).toBe('BS12-064');expect(state.players['player-one'].battleArea[0].hpCards).toHaveLength(5)
 expect(state.commandLog?.some(c=>c.commandKind==='deploy-cookie')).toBe(true)
})

it('065 opens the real printed059 attack trap window',()=>{
 const state=createBs12FanLetterDemoState('positive');assertBs12PhysicalFixture(state)
 expect(state.pendingBattle?.stage).toBe('trap');expect(state.pendingBattle?.attackerInstanceId).toBe('bs12-065-attacker')
 const attacker=state.players['player-two'].battleArea[0];expect(attacker.card.id).toBe('BS12-059');expect(attacker.hpCards).toHaveLength(4);expect(attacker.rested).toBe(true)
 expect(state.players['player-two'].supportArea).toHaveLength(3);expect(state.players['player-two'].supportArea.every(s=>s.rested)).toBe(true)
 expect(state.players['player-one'].battleArea[0].card.id).toBe('BS12-064');expect(state.players['player-one'].battleArea[0].hpCards).toHaveLength(5)
})

it('066 opens the real printed059 attack trap window',()=>{
 const state=createBs12EndingPoseDemoState('positive');assertBs12PhysicalFixture(state)
 expect(state.pendingBattle?.stage).toBe('trap');expect(state.pendingBattle?.attackerInstanceId).toBe('bs12-066-attacker')
 const attacker=state.players['player-two'].battleArea[0];expect(attacker.card.id).toBe('BS12-059');expect(attacker.hpCards).toHaveLength(4);expect(attacker.rested).toBe(true)
 expect(state.players['player-two'].supportArea).toHaveLength(3);expect(state.players['player-two'].supportArea.every(s=>s.rested)).toBe(true)
 expect(state.players['player-one'].battleArea[0].card.id).toBe('BS12-064');expect(state.players['player-one'].battleArea[0].hpCards).toHaveLength(5)
})

it('067 placed route pays printedB through real stage command',()=>{
 const state=createBs12ComebackStageDemoState('placed');assertBs12PhysicalFixture(state)
 expect(state.players['player-one'].stage?.card.id).toBe('BS12-067');expect(state.players['player-one'].stage?.rested).toBe(false)
 expect(state.players['player-one'].supportArea.map(s=>s.rested)).toEqual([true,false]);expect(state.commandLog?.some(c=>c.commandKind==='play-stage')).toBe(true)
})
