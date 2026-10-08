import {expect,it} from 'vitest'
import {createBs12CurrantCreamDemoState,createBs12KohlrabiDemoState,createBs12PuddingDemoState,createBs12DjDemoState,createBs12GuitarStringDemoState,createCardCheckDemoState,createCardNegativeDemoState,parseTestStateConfig} from './demo'
import {assertBs12PhysicalFixture} from './bs12-physical-fixtures.test-helpers'
import {applyGameCommand} from './commands'

it.each(["positive","blue-energy","purple-energy","green-energy","yellow-energy","spare-energy","few-energy","rested-energy","source-rested","opponent-turn","target-faints","deploy","outside-main"] as const)('079 %s uses exact physical records and known initial HP without invented gain',scenario=>{
 const state=createBs12CurrantCreamDemoState(scenario);assertBs12PhysicalFixture(state)
 for(const player of Object.values(state.players))for(const cookie of player.battleArea)expect(cookie.hpCards.length,cookie.card.name).toBeLessThanOrEqual(cookie.card.hp)
 if(scenario==='outside-main')expect(state.phase).toBe('support')
})

it('079 generic routes provide mechanism-specific physical resources',()=>{
 for(const[prefix,scenario]of [['card','positive'],['card-negative','few-energy']]as const){expect(parseTestStateConfig('?test-state='+prefix+':BS12-079','localhost')).toEqual({kind:'bs12-079',scenario});expect(parseTestStateConfig('?test-state='+prefix+':BS12-079','example.com')).toBeNull();assertBs12PhysicalFixture(prefix==='card'?createCardCheckDemoState('BS12-079'):createCardNegativeDemoState('BS12-079'))}
})

it.each(["positive","green-arena","non-arena","no-arena","no-hand","item-hand","last-hp","follow-up","rested-target","equipment","attack","wrong-energy","few-energy","rested-energy","opponent-turn","source-rested","deploy","red-arena","refresh","outside-main","purple-arena","stage-hand","trap-hand"] as const)('080 %s uses exact physical records and known initial HP without invented gain',scenario=>{
 const state=createBs12KohlrabiDemoState(scenario);assertBs12PhysicalFixture(state)
 for(const player of Object.values(state.players))for(const cookie of player.battleArea)expect(cookie.hpCards.length,cookie.card.name).toBeLessThanOrEqual(cookie.card.hp)
 if(scenario==='outside-main')expect(state.phase).toBe('support')
})

it('080 generic routes provide mechanism-specific physical resources',()=>{
 for(const[prefix,scenario]of [['card','positive'],['card-negative','no-arena']]as const){expect(parseTestStateConfig('?test-state='+prefix+':BS12-080','localhost')).toEqual({kind:'bs12-080',scenario});expect(parseTestStateConfig('?test-state='+prefix+':BS12-080','example.com')).toBeNull();assertBs12PhysicalFixture(prefix==='card'?createCardCheckDemoState('BS12-080'):createCardNegativeDemoState('BS12-080'))}
})

it.each(["response","no-hand","wrong-color","non-arena","split-cost","item-cost","stage-cost","trap-cost","rested-source","original-target","twice","second-response","attack","deploy","wrong-energy","few-energy","rested-energy","source-rested","opponent-turn","outside-main"] as const)('081 %s uses exact physical records and known initial HP without invented gain',scenario=>{
 const state=createBs12PuddingDemoState(scenario);assertBs12PhysicalFixture(state)
 for(const player of Object.values(state.players))for(const cookie of player.battleArea)expect(cookie.hpCards.length,cookie.card.name).toBeLessThanOrEqual(cookie.card.hp)
 if(scenario==='outside-main')expect(state.phase).toBe('support')
})

it('081 generic routes provide mechanism-specific physical resources',()=>{
 for(const[prefix,scenario]of [['card','response'],['card-negative','non-arena']]as const){expect(parseTestStateConfig('?test-state='+prefix+':BS12-081','localhost')).toEqual({kind:'bs12-081',scenario});expect(parseTestStateConfig('?test-state='+prefix+':BS12-081','example.com')).toBeNull();assertBs12PhysicalFixture(prefix==='card'?createCardCheckDemoState('BS12-081'):createCardNegativeDemoState('BS12-081'))}
})

it.each(["positive","rested-source","cookie-cost","item-cost","stage-cost","trap-cost","no-hand","wrong-energy","rested-energy","no-energy","source-hand","source-support","source-discard","source-break","own-source","twice","original-cost","missing-original-cost","multiple-source","attack","deploy","source-rested","opponent-turn","outside-main","hand-threshold","hand-above-threshold"] as const)('082 %s uses exact physical records and known initial HP without invented gain',scenario=>{
 const state=createBs12DjDemoState(scenario);assertBs12PhysicalFixture(state)
 for(const player of Object.values(state.players))for(const cookie of player.battleArea)expect(cookie.hpCards.length,cookie.card.name).toBeLessThanOrEqual(cookie.card.hp)
 if(scenario==='outside-main')expect(state.phase).toBe('support')
})

it('082 generic routes provide mechanism-specific physical resources',()=>{
 for(const[prefix,scenario]of [['card','positive'],['card-negative','no-hand']]as const){expect(parseTestStateConfig('?test-state='+prefix+':BS12-082','localhost')).toEqual({kind:'bs12-082',scenario});expect(parseTestStateConfig('?test-state='+prefix+':BS12-082','example.com')).toBeNull();assertBs12PhysicalFixture(prefix==='card'?createCardCheckDemoState('BS12-082'):createCardNegativeDemoState('BS12-082'))}
})

it.each(["positive","red-blocker","two-blockers","no-blocker","full-field","wrong-energy","rested-energy","no-energy","opponent-turn","outside-main","dj-new-target","dj-existing-target","dj-no-hand","short-deck","refresh-defeat","no-refresh-cookie"] as const)('083 %s uses exact physical records and known initial HP without invented gain',scenario=>{
 const state=createBs12GuitarStringDemoState(scenario);assertBs12PhysicalFixture(state)
 for(const player of Object.values(state.players))for(const cookie of player.battleArea)expect(cookie.hpCards.length,cookie.card.name).toBeLessThanOrEqual(cookie.card.hp)
 if(scenario==='outside-main')expect(state.phase).toBe('support')
})

it('083 generic routes provide mechanism-specific physical resources',()=>{
 for(const[prefix,scenario]of [['card','positive'],['card-negative','no-blocker']]as const){expect(parseTestStateConfig('?test-state='+prefix+':BS12-083','localhost')).toEqual({kind:'bs12-083',scenario});expect(parseTestStateConfig('?test-state='+prefix+':BS12-083','example.com')).toBeNull();assertBs12PhysicalFixture(prefix==='card'?createCardCheckDemoState('BS12-083'):createCardNegativeDemoState('BS12-083'))}
})

it('079 actual normal entry takes printed2 HP from physical deck',()=>{
 const before=createBs12CurrantCreamDemoState('deploy');assertBs12PhysicalFixture(before);const after=applyGameCommand(before,{kind:'deploy-cookie',playerId:'player-one',instanceId:'bs12-079-source'});assertBs12PhysicalFixture(after);expect(after.players['player-one'].battleArea.find(c=>c.card.instanceId==='bs12-079-source')?.hpCards).toEqual(before.players['player-one'].deck.slice(0,2));expect(after.commandLog?.at(-1)?.commandKind).toBe('deploy-cookie')
})

it('080 actual normal entry takes printed1 HP from physical deck',()=>{
 const before=createBs12KohlrabiDemoState('deploy');assertBs12PhysicalFixture(before);const after=applyGameCommand(before,{kind:'deploy-cookie',playerId:'player-one',instanceId:'bs12-080-source'});assertBs12PhysicalFixture(after);expect(after.players['player-one'].battleArea.find(c=>c.card.instanceId==='bs12-080-source')?.hpCards).toEqual(before.players['player-one'].deck.slice(0,1));expect(after.commandLog?.at(-1)?.commandKind).toBe('deploy-cookie')
})

it('081 actual normal entry takes printed2 HP from physical deck',()=>{
 const before=createBs12PuddingDemoState('deploy');assertBs12PhysicalFixture(before);const after=applyGameCommand(before,{kind:'deploy-cookie',playerId:'player-one',instanceId:'bs12-081-source'});assertBs12PhysicalFixture(after);expect(after.players['player-one'].battleArea.find(c=>c.card.instanceId==='bs12-081-source')?.hpCards).toEqual(before.players['player-one'].deck.slice(0,2));expect(after.commandLog?.at(-1)?.commandKind).toBe('deploy-cookie')
})

it('082 actual normal entry takes printed2 HP from physical deck',()=>{
 const before=createBs12DjDemoState('deploy');assertBs12PhysicalFixture(before);const after=applyGameCommand(before,{kind:'deploy-cookie',playerId:'player-one',instanceId:'bs12-082-source'});assertBs12PhysicalFixture(after);expect(after.players['player-one'].battleArea.find(c=>c.card.instanceId==='bs12-082-source')?.hpCards).toEqual(before.players['player-one'].deck.slice(0,2));expect(after.commandLog?.at(-1)?.commandKind).toBe('deploy-cookie')
})

it.each([['positive','BS12-021',1],['last-hp','BS12-080',0],['follow-up','BS12-064',4],['no-arena','ST3-001',1]]as const)('080 actual printed damage/FLIP parent %s', (scenario,bearer,remaining)=>{
 const state=createBs12KohlrabiDemoState(scenario);assertBs12PhysicalFixture(state);expect(state.players['player-one'].battleArea[0].card.id).toBe(bearer);expect(state.players['player-one'].battleArea[0].hpCards).toHaveLength(remaining);expect(state.pendingBattle?.revealedHpCard?.id).toBe('BS12-080');expect(state.commandLog?.map(c=>c.commandKind)).toEqual(['declare-attack','skip-trap','resolve-next-damage']);expect(state.players['player-two'].battleArea[0].hpCards).toHaveLength(scenario==='follow-up'?4:1)
})

it('080 companions keep independently printed HP before gain, including equipment host',()=>{
 for(const[scenario,number,hp]of [['positive','BS12-019',4],['red-arena','BS12-003',2],['purple-arena','BS12-079',2],['green-arena','BS7-061',4],['non-arena','ST4-001',3],['equipment','BS4-095',4]]as const){const state=createBs12KohlrabiDemoState(scenario);assertBs12PhysicalFixture(state);expect(state.players['player-one'].battleArea[1].card.id).toBe(number);expect(state.players['player-one'].battleArea[1].hpCards).toHaveLength(hp)}
})

it('081 Blocker response and second battle use printed attackers and actual first damage parent',()=>{
 const first=createBs12PuddingDemoState('response');assertBs12PhysicalFixture(first);expect(first.commandLog?.map(c=>c.commandKind)).toEqual(['declare-attack']);expect(first.players['player-one'].battleArea[0].hpCards).toHaveLength(2);expect(first.players['player-two'].battleArea.map(c=>c.hpCards.length)).toEqual([2,2]);const second=createBs12PuddingDemoState('second-response');assertBs12PhysicalFixture(second);expect(second.commandLog?.map(c=>c.commandKind)).toContain('play-blocker');expect(second.players['player-one'].battleArea[0].hpCards).toHaveLength(1);expect(second.players['player-one'].battleArea[0].rested).toBe(false)
})

it.each(['hand-threshold','hand-above-threshold']as const)('082 exact printed blue Item after tax %s',scenario=>{
 const state=createBs12DjDemoState(scenario);assertBs12PhysicalFixture(state);expect(state.players['player-one'].hand[0]).toMatchObject({id:'BS8-096',cardColor:'blue'});expect(state.players['player-one'].battleArea[0].hpCards).toHaveLength(4);expect(state.players['player-two'].battleArea[0].hpCards).toHaveLength(2)
})

it.each([['positive','BS12-081',2],['red-blocker','BS1-009',3]]as const)('083 actual special entry from own real trash %s',(scenario,number,hp)=>{
 const before=createBs12GuitarStringDemoState(scenario);assertBs12PhysicalFixture(before);const target=before.players['player-one'].discardPile.find(c=>c.id===number)!;const paid=applyGameCommand(before,{kind:'begin-play-item',playerId:'player-one',instanceId:'bs12-083-item',paymentIds:['bs12-083-payment']});const after=applyGameCommand(paid,{kind:'resolve-ability-effect',playerId:'player-one',targetIds:[target.instanceId]});assertBs12PhysicalFixture(after);expect(after.players['player-one'].battleArea[1].hpCards).toEqual(before.players['player-one'].deck.slice(0,hp));expect(after.commandLog?.map(c=>c.commandKind)).toEqual(['begin-play-item','resolve-ability-effect'])
})

it('083 DJ paid hand becomes actual trash target before printed2HP special entry',()=>{
 const before=createBs12GuitarStringDemoState('dj-new-target');assertBs12PhysicalFixture(before);let state=applyGameCommand(before,{kind:'begin-play-item',playerId:'player-one',instanceId:'bs12-083-item',paymentIds:['bs12-083-payment']});state=applyGameCommand(state,{kind:'resolve-opponent-hand-discard',playerId:'player-one',cardIds:['bs12-083-hand-blocker']});assertBs12PhysicalFixture(state);state=applyGameCommand(state,{kind:'resolve-ability-effect',playerId:'player-one',targetIds:['bs12-083-hand-blocker']});assertBs12PhysicalFixture(state);expect(state.players['player-one'].battleArea[1].hpCards).toEqual(before.players['player-one'].deck.slice(0,2))
})
