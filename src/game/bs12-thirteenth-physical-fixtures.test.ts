import {expect,it} from 'vitest'
import {createBs12MintChocoDemoState,createBs12HerbDemoState,createBs12AppleFaerieDemoState,createBs12MarbleberryDemoState,createBs12PeppermintDemoState,createCardCheckDemoState,createCardNegativeDemoState,parseTestStateConfig} from './demo'
import {applyGameCommand} from './commands'
import {canActivateCookieSkill} from './skills'
import {assertBs12PhysicalFixture} from './bs12-physical-fixtures.test-helpers'

it.each([["positive","BS12-054@1"],["empty-trash","BS12-054@1"],["item-trash","BS12-054@1"],["item-only-support","BS12-054@1"],["no-support","BS12-054@1"],["rested-cost","BS12-054@1"],["all-rested","BS12-054@1"],["source-rested","BS12-054@1"],["opponent-turn","BS12-054@1"],["outside-main","BS12-054@1"],["used","BS12-054@1"],["source-support","BS12-054@1"],["attack","BS12-054@1"],["attack-few","BS12-054@1"],["attack-wrong","BS12-054@1"],["attack-rested-energy","BS12-054@1"],["attack-rested-source","BS12-054@1"],["deploy","BS12-054@1"],["positive","BS12-054"],["empty-trash","BS12-054"],["item-trash","BS12-054"],["item-only-support","BS12-054"],["no-support","BS12-054"],["rested-cost","BS12-054"],["all-rested","BS12-054"],["source-rested","BS12-054"],["opponent-turn","BS12-054"],["outside-main","BS12-054"],["used","BS12-054"],["source-support","BS12-054"],["attack","BS12-054"],["attack-few","BS12-054"],["attack-wrong","BS12-054"],["attack-rested-energy","BS12-054"],["attack-rested-source","BS12-054"],["deploy","BS12-054"]] as const)('054 %s %s matches physical records and unboosted initial printed HP',(scenario,number)=>{
 const state=createBs12MintChocoDemoState(scenario,number)
 assertBs12PhysicalFixture(state)
 for(const player of Object.values(state.players))for(const cookie of player.battleArea)expect(cookie.hpCards.length,cookie.card.name).toBeLessThanOrEqual(cookie.card.hp)
})

it.each([["positive","BS12-055@1"],["rested-entry","BS12-055@1"],["source-rested","BS12-055@1"],["hand-origin","BS12-055@1"],["other-cookie","BS12-055@1"],["old-turn","BS12-055@1"],["no-hand","BS12-055@1"],["source-support","BS12-055@1"],["opponent-turn","BS12-055@1"],["outside-main","BS12-055@1"],["deck-item","BS12-055@1"],["deck-stage","BS12-055@1"],["deck-blue","BS12-055@1"],["refresh","BS12-055@1"],["refresh-lv10","BS12-055@1"],["source-only","BS12-055@1"],["source-only-no-cookie","BS12-055@1"],["empty-deck","BS12-055@1"],["attack","BS12-055@1"],["attack-wrong","BS12-055@1"],["attack-rested-energy","BS12-055@1"],["attack-rested-source","BS12-055@1"],["deploy","BS12-055@1"],["positive","BS12-055"],["rested-entry","BS12-055"],["source-rested","BS12-055"],["hand-origin","BS12-055"],["other-cookie","BS12-055"],["old-turn","BS12-055"],["no-hand","BS12-055"],["source-support","BS12-055"],["opponent-turn","BS12-055"],["outside-main","BS12-055"],["deck-item","BS12-055"],["deck-stage","BS12-055"],["deck-blue","BS12-055"],["refresh","BS12-055"],["refresh-lv10","BS12-055"],["source-only","BS12-055"],["source-only-no-cookie","BS12-055"],["empty-deck","BS12-055"],["attack","BS12-055"],["attack-wrong","BS12-055"],["attack-rested-energy","BS12-055"],["attack-rested-source","BS12-055"],["deploy","BS12-055"]] as const)('055 %s %s matches physical records and unboosted initial printed HP',(scenario,number)=>{
 const state=createBs12HerbDemoState(scenario,number)
 assertBs12PhysicalFixture(state)
 for(const player of Object.values(state.players))for(const cookie of player.battleArea)expect(cookie.hpCards.length,cookie.card.name).toBeLessThanOrEqual(cookie.card.hp)
})

it.each([["extra-named","BS12-056@1"],["extra-named-rested","BS12-056@1"],["extra-seven","BS12-056@1"],["extra-seven-rested","BS12-056@1"],["extra-six","BS12-056@1"],["extra-seven-mixed","BS12-056@1"],["extra-non-arena","BS12-056@1"],["extra-wrong-name","BS12-056@1"],["extra-support-name","BS12-056@1"],["extra-opponent-name","BS12-056@1"],["extra-equipment","BS12-056@1"],["extra-full","BS12-056@1"],["extra-used","BS12-056@1"],["extra-outside-main","BS12-056@1"],["extra-opponent-turn","BS12-056@1"],["extra-refresh","BS12-056@1"],["positive","BS12-056@1"],["active-target","BS12-056@1"],["first-player","BS12-056@1"],["no-hand","BS12-056@1"],["all-blue","BS12-056@1"],["few-energy","BS12-056@1"],["rested-energy","BS12-056@1"],["source-rested","BS12-056@1"],["outside-main","BS12-056@1"],["opponent-turn","BS12-056@1"],["target-faints","BS12-056@1"],["extra-named","BS12-056"],["extra-named-rested","BS12-056"],["extra-seven","BS12-056"],["extra-seven-rested","BS12-056"],["extra-six","BS12-056"],["extra-seven-mixed","BS12-056"],["extra-non-arena","BS12-056"],["extra-wrong-name","BS12-056"],["extra-support-name","BS12-056"],["extra-opponent-name","BS12-056"],["extra-equipment","BS12-056"],["extra-full","BS12-056"],["extra-used","BS12-056"],["extra-outside-main","BS12-056"],["extra-opponent-turn","BS12-056"],["extra-refresh","BS12-056"],["positive","BS12-056"],["active-target","BS12-056"],["first-player","BS12-056"],["no-hand","BS12-056"],["all-blue","BS12-056"],["few-energy","BS12-056"],["rested-energy","BS12-056"],["source-rested","BS12-056"],["outside-main","BS12-056"],["opponent-turn","BS12-056"],["target-faints","BS12-056"]] as const)('056 %s %s matches physical records and unboosted initial printed HP',(scenario,number)=>{
 const state=createBs12AppleFaerieDemoState(scenario,number)
 assertBs12PhysicalFixture(state)
 for(const player of Object.values(state.players))for(const cookie of player.battleArea)expect(cookie.hpCards.length,cookie.card.name).toBeLessThanOrEqual(cookie.card.hp)
})

it.each([["positive","BS12-057"],["cost-item","BS12-057"],["cost-stage","BS12-057"],["no-cost","BS12-057"],["cost-non-arena","BS12-057"],["cost-wrong-color","BS12-057"],["cost-split","BS12-057"],["opponent-cost-only","BS12-057"],["rested-target","BS12-057"],["only-high","BS12-057"],["no-target","BS12-057"],["target-only","BS12-057"],["target-equipped","BS12-057"],["movement-blocked","BS12-057"],["full-battle","BS12-057"],["opponent-turn","BS12-057"],["outside-main","BS12-057"],["refresh","BS12-057"],["refresh-lv10","BS12-057"],["isolated-opponent-on-play","BS12-057"],["support-entry","BS12-057"],["rested-support-entry","BS12-057"],["attack","BS12-057"],["attack-all-blue","BS12-057"],["attack-wrong","BS12-057"],["attack-few","BS12-057"],["attack-rested-energy","BS12-057"],["attack-source-rested","BS12-057"]] as const)('057 %s %s matches physical records and unboosted initial printed HP',(scenario,_number)=>{
 const state=createBs12MarbleberryDemoState(scenario)
 assertBs12PhysicalFixture(state)
 for(const player of Object.values(state.players))for(const cookie of player.battleArea)expect(cookie.hpCards.length,cookie.card.name).toBeLessThanOrEqual(cookie.card.hp)
})

it.each([["positive","BS12-058"],["red-hand","BS12-058"],["green-hand","BS12-058"],["item-hand","BS12-058"],["stage-hand","BS12-058"],["no-hand","BS12-058"],["non-arena-hand","BS12-058"],["opponent-cost-only","BS12-058"],["last-hp","BS12-058"],["last-hp-refresh","BS12-058"],["follow-up","BS12-058"],["short-deck","BS12-058"],["last-deck","BS12-058"],["refresh-lv10","BS12-058"],["isolated-own-turn","BS12-058"],["attack","BS12-058"],["attack-wrong","BS12-058"],["attack-few","BS12-058"],["attack-rested-energy","BS12-058"],["attack-source-rested","BS12-058"],["deploy","BS12-058"],["positive","BS12-058@1"],["red-hand","BS12-058@1"],["green-hand","BS12-058@1"],["item-hand","BS12-058@1"],["stage-hand","BS12-058@1"],["no-hand","BS12-058@1"],["non-arena-hand","BS12-058@1"],["opponent-cost-only","BS12-058@1"],["last-hp","BS12-058@1"],["last-hp-refresh","BS12-058@1"],["follow-up","BS12-058@1"],["short-deck","BS12-058@1"],["last-deck","BS12-058@1"],["refresh-lv10","BS12-058@1"],["isolated-own-turn","BS12-058@1"],["attack","BS12-058@1"],["attack-wrong","BS12-058@1"],["attack-few","BS12-058@1"],["attack-rested-energy","BS12-058@1"],["attack-source-rested","BS12-058@1"],["deploy","BS12-058@1"]] as const)('058 %s %s matches physical records and unboosted initial printed HP',(scenario,number)=>{
 const state=createBs12PeppermintDemoState(scenario,number)
 assertBs12PhysicalFixture(state)
 for(const player of Object.values(state.players))for(const cookie of player.battleArea)expect(cookie.hpCards.length,cookie.card.name).toBeLessThanOrEqual(cookie.card.hp)
})

it.each([["054","positive","no-support"],["054@1","positive","no-support"],["055","positive","hand-origin"],["055@1","positive","hand-origin"],["056","extra-named","extra-six"],["056@1","extra-named","extra-six"],["057","positive","cost-split"],["058","positive","non-arena-hand"],["058@1","positive","non-arena-hand"]] as const)('%s generic routes use dedicated printed witnesses',(number,positive,negative)=>{
 const id='BS12-'+number,base=number.slice(0,3)
 for(const[prefix,scenario]of [['card',positive],['card-negative',negative]]as const){
  expect(parseTestStateConfig('?test-state='+prefix+':'+id,'localhost')).toEqual({kind:'bs12-'+base,scenario,...(base==='057'?{}:{cardNumber:id})})
  expect(parseTestStateConfig('?test-state='+prefix+':'+id,'example.com')).toBeNull()
  const state=prefix==='card'?createCardCheckDemoState(id):createCardNegativeDemoState(id);assertBs12PhysicalFixture(state)
  const own=state.players['player-one']
  if(base==='054')expect(own.supportArea.length>0).toBe(prefix==='card')
  if(base==='055')expect(canActivateCookieSkill(state,'player-one','bs12-055-source','activate')).toBe(prefix==='card')
  if(base==='056'){expect(own.extraDeck?.[0].id).toBe('BS12-056');expect(own.battleArea.some(c=>c.card.name==='Candy Apple Cookie'&&c.card.keywords?.includes('arena'))).toBe(prefix==='card');if(prefix==='card-negative')expect(own.supportArea.filter(s=>s.card.energyColor==='green')).toHaveLength(6)}
  if(base==='057')expect(own.hand.some(c=>c.instanceId!=='bs12-057-source'&&c.energyColor==='blue'&&c.keywords?.includes('arena'))).toBe(prefix==='card')
  if(base==='058'){expect(state.pendingBattle?.revealedHpCard?.id).toBe('BS12-058');expect(own.hand.some(c=>c.keywords?.includes('arena'))).toBe(prefix==='card')}
 }
})

it.each(["BS12-054","BS12-054@1","BS12-055","BS12-055@1","BS12-056","BS12-056@1","BS12-057","BS12-058","BS12-058@1"] as const)('%s generic initial HP needs no invented gain',number=>{
 const state=createCardCheckDemoState(number)
 for(const player of Object.values(state.players))for(const cookie of player.battleArea)expect(cookie.hpCards.length,cookie.card.name).toBeLessThanOrEqual(cookie.card.hp)
})

it.each([['BS12-055','positive'],['BS12-055','other-cookie'],['BS12-055@1','positive'],['BS12-055@1','other-cookie']]as const)('%s %s differentiates its own printed Support entry from another Cookie',(number,scenario)=>{
 const state=createBs12HerbDemoState(scenario,number)
 assertBs12PhysicalFixture(state)
 const source=state.players['player-one'].battleArea.find(c=>c.card.instanceId==='bs12-055-source')!
 expect(source.hpCards).toHaveLength(2)
 expect(source.enteredFrom).toBe(scenario==='positive'?'support':'hand')
 expect(state.cookiesPlayedFromSupportThisTurn?.['player-one']).toBe(true)
 expect(canActivateCookieSkill(state,'player-one',source.card.instanceId,'activate')).toBe(scenario==='positive')
})

it.each(['BS12-056','BS12-056@1']as const)('%s real printed EXTRA command configures three HP',(number)=>{
 const before=createBs12AppleFaerieDemoState('extra-named',number)
 assertBs12PhysicalFixture(before)
 const state=applyGameCommand(before,{kind:'play-extra-deck-cookie',playerId:'player-one',instanceId:'bs12-056-source'})
 expect(state.players['player-one'].extraDeck).toHaveLength(0)
 const source=state.players['player-one'].battleArea.find(c=>c.card.instanceId==='bs12-056-source')!
 expect(source.card).toMatchObject({id:'BS12-056',name:'Apple Faerie Cookie',hp:3})
 expect(source.hpCards).toHaveLength(3)
 assertBs12PhysicalFixture(state)
})

it.each(['BS12-058','BS12-058@1']as const)('%s real ordinary attack reveals the exact physical FLIP print',(number)=>{
 const state=createBs12PeppermintDemoState('positive',number)
 assertBs12PhysicalFixture(state)
 expect(state.pendingBattle?.stage).toBe('flip')
 expect(state.pendingBattle?.revealedHpCard).toMatchObject({id:'BS12-058',instanceId:'bs12-058-source'})
 expect(state.players['player-two'].supportArea.every(s=>s.rested)).toBe(true)
})
