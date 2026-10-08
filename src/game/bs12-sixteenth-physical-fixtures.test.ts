import {expect,it} from 'vitest'
import {createBs12PhotocardDemoState,createBs12StardustDemoState,createBs12IcePopDemoState,createBs12CreamSodaDemoState,createBs12DjMiyaDemoState,createCardCheckDemoState,createCardNegativeDemoState,parseTestStateConfig} from './demo'
import {assertBs12PhysicalFixture} from './bs12-physical-fixtures.test-helpers'
import {applyGameCommand} from './commands'
import type {GameState} from './types'

it.each(["positive","green-arena","red-arena","yellow-arena","non-arena","level-one","level-three","arena-item","top-only","short-deck","refresh-defeat","no-refresh-cookie","empty-deck","no-energy","one-energy","wrong-energy","mixed-energy","rested-energy","opponent-turn","outside-main","target-faints","target-rested","flip"] as const)('069 %s uses exact physical records, unique zone ids and printed initial HP',scenario=>{
 const state=createBs12PhotocardDemoState(scenario)
 assertBs12PhysicalFixture(state)
 for(const player of Object.values(state.players))for(const cookie of player.battleArea)expect(cookie.hpCards.length,cookie.card.name).toBeLessThanOrEqual(cookie.card.hp)
 if(['outside-main','attack-outside-main'].includes(scenario))expect(state.phase).toBe('support')
})

it.each(["positive","green-arena","red-arena","yellow-arena","non-arena","level-one","level-three","arena-item","top-only","short-deck","refresh-defeat","no-refresh-cookie","empty-deck","no-energy","one-energy","wrong-energy","mixed-energy","rested-energy","opponent-turn","outside-main","target-faints","target-rested","flip","source-rested","single-opponent","other-faints","ordinary-flip","protected","all-protected","short-all-protected"] as const)('070 %s uses exact physical records, unique zone ids and printed initial HP',scenario=>{
 const state=createBs12StardustDemoState(scenario, 'BS12-070')
 assertBs12PhysicalFixture(state)
 for(const player of Object.values(state.players))for(const cookie of player.battleArea)expect(cookie.hpCards.length,cookie.card.name).toBeLessThanOrEqual(cookie.card.hp)
 if(['outside-main','attack-outside-main'].includes(scenario))expect(state.phase).toBe('support')
})

it.each(["positive","green-arena","red-arena","yellow-arena","non-arena","level-one","level-three","arena-item","top-only","short-deck","refresh-defeat","no-refresh-cookie","empty-deck","no-energy","one-energy","wrong-energy","mixed-energy","rested-energy","opponent-turn","outside-main","target-faints","target-rested","flip","source-rested","single-opponent","other-faints","ordinary-flip","protected","all-protected","short-all-protected"] as const)('070@1 %s uses exact physical records, unique zone ids and printed initial HP',scenario=>{
 const state=createBs12StardustDemoState(scenario, 'BS12-070@1')
 assertBs12PhysicalFixture(state)
 for(const player of Object.values(state.players))for(const cookie of player.battleArea)expect(cookie.hpCards.length,cookie.card.name).toBeLessThanOrEqual(cookie.card.hp)
 if(['outside-main','attack-outside-main'].includes(scenario))expect(state.phase).toBe('support')
})

it.each(["positive","green-arena","red-arena","yellow-arena","non-arena","level-one","level-three","arena-item","top-only","short-deck","refresh-defeat","no-refresh-cookie","empty-deck","no-energy","one-energy","wrong-energy","mixed-energy","rested-energy","source-rested","opponent-turn","outside-main","two-cookies","equipped","once-used","hand-decoy"] as const)('071 %s uses exact physical records, unique zone ids and printed initial HP',scenario=>{
 const state=createBs12IcePopDemoState(scenario, 'BS12-071')
 assertBs12PhysicalFixture(state)
 for(const player of Object.values(state.players))for(const cookie of player.battleArea)expect(cookie.hpCards.length,cookie.card.name).toBeLessThanOrEqual(cookie.card.hp)
 if(['outside-main','attack-outside-main'].includes(scenario))expect(state.phase).toBe('support')
})

it.each(["positive","green-arena","red-arena","yellow-arena","non-arena","level-one","level-three","arena-item","top-only","short-deck","refresh-defeat","no-refresh-cookie","empty-deck","no-energy","one-energy","wrong-energy","mixed-energy","rested-energy","source-rested","opponent-turn","outside-main","two-cookies","equipped","once-used","hand-decoy"] as const)('071@1 %s uses exact physical records, unique zone ids and printed initial HP',scenario=>{
 const state=createBs12IcePopDemoState(scenario, 'BS12-071@1')
 assertBs12PhysicalFixture(state)
 for(const player of Object.values(state.players))for(const cookie of player.battleArea)expect(cookie.hpCards.length,cookie.card.name).toBeLessThanOrEqual(cookie.card.hp)
 if(['outside-main','attack-outside-main'].includes(scenario))expect(state.phase).toBe('support')
})

it.each(["positive","green-arena","red-arena","yellow-arena","level-one","level-three","non-arena","rested-target","equipped-target","same-name","no-target","hand-only","support-only","stage-only","no-energy","one-energy","wrong-energy","rested-energy","source-rested","opponent-turn","outside-main","once-used","short-deck","awakened-target"] as const)('072 %s uses exact physical records, unique zone ids and printed initial HP',scenario=>{
 const state=createBs12CreamSodaDemoState(scenario, 'BS12-072')
 assertBs12PhysicalFixture(state)
 for(const player of Object.values(state.players))for(const cookie of player.battleArea)expect(cookie.hpCards.length,cookie.card.name).toBeLessThanOrEqual(cookie.card.hp)
 if(['outside-main','attack-outside-main'].includes(scenario))expect(state.phase).toBe('support')
})

it.each(["positive","green-arena","red-arena","yellow-arena","level-one","level-three","non-arena","rested-target","equipped-target","same-name","no-target","hand-only","support-only","stage-only","no-energy","one-energy","wrong-energy","rested-energy","source-rested","opponent-turn","outside-main","once-used","short-deck","awakened-target"] as const)('072@1 %s uses exact physical records, unique zone ids and printed initial HP',scenario=>{
 const state=createBs12CreamSodaDemoState(scenario, 'BS12-072@1')
 assertBs12PhysicalFixture(state)
 for(const player of Object.values(state.players))for(const cookie of player.battleArea)expect(cookie.hpCards.length,cookie.card.name).toBeLessThanOrEqual(cookie.card.hp)
 if(['outside-main','attack-outside-main'].includes(scenario))expect(state.phase).toBe('support')
})

it.each(["positive","deploy","green-arena","red-arena","yellow-arena","level-one","level-three","non-arena","arena-item","top-only","same-name","same-name-alt","five","seven","empty-deck","short-deck","receiver","receiver-mismatch","attack","attack-item-cost","attack-equipped","attack-ally","attack-no-hand","attack-one-energy","attack-wrong-energy","attack-rested-energy","attack-source-rested","attack-opponent-turn","attack-outside-main","attack-target-faints","attack-flip","attack-awakened","refresh-defeat","no-refresh-cookie","onplay-opponent-turn","onplay-source-rested"] as const)('073 %s uses exact physical records, unique zone ids and printed initial HP',scenario=>{
 const state=createBs12DjMiyaDemoState(scenario, 'BS12-073')
 assertBs12PhysicalFixture(state)
 for(const player of Object.values(state.players))for(const cookie of player.battleArea)expect(cookie.hpCards.length,cookie.card.name).toBeLessThanOrEqual(cookie.card.hp)
 if(['outside-main','attack-outside-main'].includes(scenario))expect(state.phase).toBe('support')
})

it.each(["positive","deploy","green-arena","red-arena","yellow-arena","level-one","level-three","non-arena","arena-item","top-only","same-name","same-name-alt","five","seven","empty-deck","short-deck","receiver","receiver-mismatch","attack","attack-item-cost","attack-equipped","attack-ally","attack-no-hand","attack-one-energy","attack-wrong-energy","attack-rested-energy","attack-source-rested","attack-opponent-turn","attack-outside-main","attack-target-faints","attack-flip","attack-awakened","refresh-defeat","no-refresh-cookie","onplay-opponent-turn","onplay-source-rested"] as const)('073@1 %s uses exact physical records, unique zone ids and printed initial HP',scenario=>{
 const state=createBs12DjMiyaDemoState(scenario, 'BS12-073@1')
 assertBs12PhysicalFixture(state)
 for(const player of Object.values(state.players))for(const cookie of player.battleArea)expect(cookie.hpCards.length,cookie.card.name).toBeLessThanOrEqual(cookie.card.hp)
 if(['outside-main','attack-outside-main'].includes(scenario))expect(state.phase).toBe('support')
})

it.each(["069","070","070@1","071","071@1","072","072@1","073","073@1"] as const)('%s generic positive and negative routes use dedicated real cards',number=>{
 const id='BS12-'+number
 for(const[prefix,scenario]of [['card','positive'],['card-negative','non-arena']]as const){
  expect(parseTestStateConfig('?test-state='+prefix+':'+id,'localhost')).toEqual({kind:'bs12-'+number.split('@')[0],scenario,...(number==='069'?{}:{cardNumber:id})})
  expect(parseTestStateConfig('?test-state='+prefix+':'+id,'example.com')).toBeNull()
  const state=prefix==='card'?createCardCheckDemoState(id):createCardNegativeDemoState(id);assertBs12PhysicalFixture(state)
  if(!number.startsWith('072'))expect(state.players['player-one'].deck.at(-1)?.id).toBe(prefix==='card'?'BS12-060':'ST4-001')
  else expect(state.players['player-one'].battleArea[1].card.id).toBe(prefix==='card'?'BS12-060':'ST4-001')
 }
})

it.each(["069","070","070@1","071","071@1","072","072@1","073","073@1"] as const)('%s generic HP does not invent a gain parent',number=>{
 const state=createCardCheckDemoState('BS12-'+number);assertBs12PhysicalFixture(state)
 for(const player of Object.values(state.players))for(const cookie of player.battleArea)expect(cookie.hpCards.length,cookie.card.name).toBeLessThanOrEqual(cookie.card.hp)
})

it('070 normal deployment uses printed 2 real HP cards',()=>{
 const state=createBs12StardustDemoState('positive','BS12-070');const own=state.players['player-one'];const source=own.battleArea[0]
 const before:GameState={...state,commandLog:[],players:{...state.players,'player-one':{...own,battleArea:own.battleArea.slice(1),hand:[source.card,...own.hand],deck:[...source.hpCards,...own.deck]}}}
 assertBs12PhysicalFixture(before)
 const after=applyGameCommand(before,{kind:'deploy-cookie',playerId:'player-one',instanceId:source.card.instanceId});assertBs12PhysicalFixture(after)
 expect(after.players['player-one'].battleArea.find(c=>c.card.instanceId===source.card.instanceId)?.hpCards).toHaveLength(2)
 expect(after.players['player-one'].deck).toEqual(own.deck);expect(after.commandLog?.at(-1)?.commandKind).toBe('deploy-cookie')
})

it('070@1 normal deployment uses printed 2 real HP cards',()=>{
 const state=createBs12StardustDemoState('positive','BS12-070@1');const own=state.players['player-one'];const source=own.battleArea[0]
 const before:GameState={...state,commandLog:[],players:{...state.players,'player-one':{...own,battleArea:own.battleArea.slice(1),hand:[source.card,...own.hand],deck:[...source.hpCards,...own.deck]}}}
 assertBs12PhysicalFixture(before)
 const after=applyGameCommand(before,{kind:'deploy-cookie',playerId:'player-one',instanceId:source.card.instanceId});assertBs12PhysicalFixture(after)
 expect(after.players['player-one'].battleArea.find(c=>c.card.instanceId===source.card.instanceId)?.hpCards).toHaveLength(2)
 expect(after.players['player-one'].deck).toEqual(own.deck);expect(after.commandLog?.at(-1)?.commandKind).toBe('deploy-cookie')
})

it('071 normal deployment uses printed 3 real HP cards',()=>{
 const state=createBs12IcePopDemoState('positive','BS12-071');const own=state.players['player-one'];const source=own.battleArea[0]
 const before:GameState={...state,commandLog:[],players:{...state.players,'player-one':{...own,battleArea:own.battleArea.slice(1),hand:[source.card,...own.hand],deck:[...source.hpCards,...own.deck]}}}
 assertBs12PhysicalFixture(before)
 const after=applyGameCommand(before,{kind:'deploy-cookie',playerId:'player-one',instanceId:source.card.instanceId});assertBs12PhysicalFixture(after)
 expect(after.players['player-one'].battleArea.find(c=>c.card.instanceId===source.card.instanceId)?.hpCards).toHaveLength(3)
 expect(after.players['player-one'].deck).toEqual(own.deck);expect(after.commandLog?.at(-1)?.commandKind).toBe('deploy-cookie')
})

it('071@1 normal deployment uses printed 3 real HP cards',()=>{
 const state=createBs12IcePopDemoState('positive','BS12-071@1');const own=state.players['player-one'];const source=own.battleArea[0]
 const before:GameState={...state,commandLog:[],players:{...state.players,'player-one':{...own,battleArea:own.battleArea.slice(1),hand:[source.card,...own.hand],deck:[...source.hpCards,...own.deck]}}}
 assertBs12PhysicalFixture(before)
 const after=applyGameCommand(before,{kind:'deploy-cookie',playerId:'player-one',instanceId:source.card.instanceId});assertBs12PhysicalFixture(after)
 expect(after.players['player-one'].battleArea.find(c=>c.card.instanceId===source.card.instanceId)?.hpCards).toHaveLength(3)
 expect(after.players['player-one'].deck).toEqual(own.deck);expect(after.commandLog?.at(-1)?.commandKind).toBe('deploy-cookie')
})

it('072 normal deployment uses printed 3 real HP cards',()=>{
 const state=createBs12CreamSodaDemoState('positive','BS12-072');const own=state.players['player-one'];const source=own.battleArea[0]
 const before:GameState={...state,commandLog:[],players:{...state.players,'player-one':{...own,battleArea:own.battleArea.slice(1),hand:[source.card,...own.hand],deck:[...source.hpCards,...own.deck]}}}
 assertBs12PhysicalFixture(before)
 const after=applyGameCommand(before,{kind:'deploy-cookie',playerId:'player-one',instanceId:source.card.instanceId});assertBs12PhysicalFixture(after)
 expect(after.players['player-one'].battleArea.find(c=>c.card.instanceId===source.card.instanceId)?.hpCards).toHaveLength(3)
 expect(after.players['player-one'].deck).toEqual(own.deck);expect(after.commandLog?.at(-1)?.commandKind).toBe('deploy-cookie')
})

it('072@1 normal deployment uses printed 3 real HP cards',()=>{
 const state=createBs12CreamSodaDemoState('positive','BS12-072@1');const own=state.players['player-one'];const source=own.battleArea[0]
 const before:GameState={...state,commandLog:[],players:{...state.players,'player-one':{...own,battleArea:own.battleArea.slice(1),hand:[source.card,...own.hand],deck:[...source.hpCards,...own.deck]}}}
 assertBs12PhysicalFixture(before)
 const after=applyGameCommand(before,{kind:'deploy-cookie',playerId:'player-one',instanceId:source.card.instanceId});assertBs12PhysicalFixture(after)
 expect(after.players['player-one'].battleArea.find(c=>c.card.instanceId===source.card.instanceId)?.hpCards).toHaveLength(3)
 expect(after.players['player-one'].deck).toEqual(own.deck);expect(after.commandLog?.at(-1)?.commandKind).toBe('deploy-cookie')
})

it('073 OnPlay comes from actual source deployment with2HP',()=>{
 const state=createBs12DjMiyaDemoState('positive','BS12-073');assertBs12PhysicalFixture(state)
 expect(state.pendingOnPlay?.sourceInstanceId).toBe('bs12-073-source');expect(state.players['player-one'].battleArea[0].hpCards).toHaveLength(2)
 expect(state.commandLog?.some(c=>c.commandKind==='deploy-cookie')).toBe(true)
})

it('073@1 OnPlay comes from actual source deployment with2HP',()=>{
 const state=createBs12DjMiyaDemoState('positive','BS12-073@1');assertBs12PhysicalFixture(state)
 expect(state.pendingOnPlay?.sourceInstanceId).toBe('bs12-073-source');expect(state.players['player-one'].battleArea[0].hpCards).toHaveLength(2)
 expect(state.commandLog?.some(c=>c.commandKind==='deploy-cookie')).toBe(true)
})

it('071 Once-used counterexample has actual printed skill commands',()=>{
 const state=createBs12IcePopDemoState('once-used','BS12-071');assertBs12PhysicalFixture(state)
 const kinds=state.commandLog?.map(c=>c.commandKind)??[];expect(kinds).toContain('begin-activate-skill');expect(kinds).toContain('resolve-ability-effect')
 expect(kinds).toContain('resolve-reveal-top-deck');expect(kinds).toContain('resolve-optional-cost-attack')
})

it('071@1 Once-used counterexample has actual printed skill commands',()=>{
 const state=createBs12IcePopDemoState('once-used','BS12-071@1');assertBs12PhysicalFixture(state)
 const kinds=state.commandLog?.map(c=>c.commandKind)??[];expect(kinds).toContain('begin-activate-skill');expect(kinds).toContain('resolve-ability-effect')
 expect(kinds).toContain('resolve-reveal-top-deck');expect(kinds).toContain('resolve-optional-cost-attack')
})

it('072 Once-used counterexample has actual printed skill commands',()=>{
 const state=createBs12CreamSodaDemoState('once-used','BS12-072');assertBs12PhysicalFixture(state)
 const kinds=state.commandLog?.map(c=>c.commandKind)??[];expect(kinds).toContain('begin-activate-skill');expect(kinds).toContain('resolve-ability-effect')
 expect(state.players['player-one'].supportArea[0].rested).toBe(true);expect(state.players['player-one'].battleArea[0].rested).toBe(false)
})

it('072@1 Once-used counterexample has actual printed skill commands',()=>{
 const state=createBs12CreamSodaDemoState('once-used','BS12-072@1');assertBs12PhysicalFixture(state)
 const kinds=state.commandLog?.map(c=>c.commandKind)??[];expect(kinds).toContain('begin-activate-skill');expect(kinds).toContain('resolve-ability-effect')
 expect(state.players['player-one'].supportArea[0].rested).toBe(true);expect(state.players['player-one'].battleArea[0].rested).toBe(false)
})

it('069 faint witness is printed1HP Pink Choco',()=>{
 const state=createBs12PhotocardDemoState('target-faints');assertBs12PhysicalFixture(state);expect(state.players['player-two'].battleArea[0].card.id).toBe('BS6-017');expect(state.players['player-two'].battleArea[0].hpCards).toHaveLength(1)
})

it('070 protected witnesses use actual GingerBrave3HP',()=>{
 for(const scenario of ['protected','all-protected','short-all-protected'] as const){const state=createBs12StardustDemoState(scenario,'BS12-070');assertBs12PhysicalFixture(state);const protectedCookies=state.players['player-two'].battleArea.filter(c=>c.card.id==='BS3-082');expect(protectedCookies).toHaveLength(scenario==='protected'?1:2);for(const cookie of protectedCookies)expect(cookie.hpCards).toHaveLength(3);expect(state.players['player-two'].hand.length).toBeLessThanOrEqual(5)}
})

it('070 faint witnesses use printed2HP Sorbet and1HP Pink Choco',()=>{
 const target=createBs12StardustDemoState('target-faints','BS12-070');assertBs12PhysicalFixture(target);expect(target.players['player-two'].battleArea[0].card.id).toBe('BS12-060');expect(target.players['player-two'].battleArea[0].hpCards).toHaveLength(2)
 const other=createBs12StardustDemoState('other-faints','BS12-070');assertBs12PhysicalFixture(other);expect(other.players['player-two'].battleArea[1].card.id).toBe('BS6-017');expect(other.players['player-two'].battleArea[1].hpCards).toHaveLength(1)
})

it('070@1 protected witnesses use actual GingerBrave3HP',()=>{
 for(const scenario of ['protected','all-protected','short-all-protected'] as const){const state=createBs12StardustDemoState(scenario,'BS12-070@1');assertBs12PhysicalFixture(state);const protectedCookies=state.players['player-two'].battleArea.filter(c=>c.card.id==='BS3-082');expect(protectedCookies).toHaveLength(scenario==='protected'?1:2);for(const cookie of protectedCookies)expect(cookie.hpCards).toHaveLength(3);expect(state.players['player-two'].hand.length).toBeLessThanOrEqual(5)}
})

it('070@1 faint witnesses use printed2HP Sorbet and1HP Pink Choco',()=>{
 const target=createBs12StardustDemoState('target-faints','BS12-070@1');assertBs12PhysicalFixture(target);expect(target.players['player-two'].battleArea[0].card.id).toBe('BS12-060');expect(target.players['player-two'].battleArea[0].hpCards).toHaveLength(2)
 const other=createBs12StardustDemoState('other-faints','BS12-070@1');assertBs12PhysicalFixture(other);expect(other.players['player-two'].battleArea[1].card.id).toBe('BS6-017');expect(other.players['player-two'].battleArea[1].hpCards).toHaveLength(1)
})

it('073 ally and faint target use actual Sorbet2HP',()=>{
 for(const scenario of ['attack-ally','attack-target-faints'] as const){const state=createBs12DjMiyaDemoState(scenario,'BS12-073');assertBs12PhysicalFixture(state);const cookie=scenario==='attack-ally'?state.players['player-one'].battleArea[1]:state.players['player-two'].battleArea[0];expect(cookie.card.id).toBe('BS12-060');expect(cookie.hpCards).toHaveLength(2)}
})

it('073@1 ally and faint target use actual Sorbet2HP',()=>{
 for(const scenario of ['attack-ally','attack-target-faints'] as const){const state=createBs12DjMiyaDemoState(scenario,'BS12-073@1');assertBs12PhysicalFixture(state);const cookie=scenario==='attack-ally'?state.players['player-one'].battleArea[1]:state.players['player-two'].battleArea[0];expect(cookie.card.id).toBe('BS12-060');expect(cookie.hpCards).toHaveLength(2)}
})
