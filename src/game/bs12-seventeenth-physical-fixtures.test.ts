import {expect,it} from 'vitest'
import {createBs12PoppingCandyDemoState,createBs12GnomeBandDemoState,createBs12BlackberryDemoState,createBs12SpotlightFanDemoState,createBs12OnionDemoState,createCardCheckDemoState,createCardNegativeDemoState,parseTestStateConfig} from './demo'
import {assertBs12PhysicalFixture} from './bs12-physical-fixtures.test-helpers'
import {applyGameCommand} from './commands'
import type {GameState} from './types'

it.each(["extra","extra-no-event","extra-non-arena","extra-top","extra-hand","extra-support","extra-opponent","extra-old-turn","extra-full","extra-used","extra-opponent-turn","extra-outside-main","onplay","onplay-first","onplay-short","onplay-refresh-defeat","onplay-no-refresh-cookie","positive","green-arena","red-arena","yellow-arena","bottom-dj","level-one","level-three","non-arena","arena-item","top-only","empty-deck","short-deck","refresh-defeat","no-refresh-cookie","one-energy","two-energy","wrong-energy","rested-energy","source-rested","opponent-turn","outside-main","target-last-hp","other-last-hp","target-faints","flip","ordinary-flip"] as const)('074 %s uses exact physical records and ids without unproved initial HP gain',scenario=>{
 const state=createBs12PoppingCandyDemoState(scenario, 'BS12-074');assertBs12PhysicalFixture(state)
 for(const player of Object.values(state.players))for(const cookie of player.battleArea)expect(cookie.hpCards.length,cookie.card.name).toBeLessThanOrEqual(cookie.card.hp)
 if(['outside-main','attack-outside-main','extra-outside-main'].includes(scenario))expect(state.phase).toBe('support')
})

it('074 generic routes reach mechanism-specific printed fixtures',()=>{
 for(const[prefix,scenario]of [['card','extra'],['card-negative','extra-no-event']]as const){
 expect(parseTestStateConfig('?test-state='+prefix+':BS12-074','localhost')).toEqual({kind:'bs12-074',scenario,cardNumber:'BS12-074'})
 expect(parseTestStateConfig('?test-state='+prefix+':BS12-074','example.com')).toBeNull()
 const state=prefix==='card'?createCardCheckDemoState('BS12-074'):createCardNegativeDemoState('BS12-074');assertBs12PhysicalFixture(state)
 for(const player of Object.values(state.players))for(const cookie of player.battleArea)expect(cookie.hpCards.length,cookie.card.name).toBeLessThanOrEqual(cookie.card.hp)
 }
})

it.each(["extra","extra-no-event","extra-non-arena","extra-top","extra-hand","extra-support","extra-opponent","extra-old-turn","extra-full","extra-used","extra-opponent-turn","extra-outside-main","onplay","onplay-first","onplay-short","onplay-refresh-defeat","onplay-no-refresh-cookie","positive","green-arena","red-arena","yellow-arena","bottom-dj","level-one","level-three","non-arena","arena-item","top-only","empty-deck","short-deck","refresh-defeat","no-refresh-cookie","one-energy","two-energy","wrong-energy","rested-energy","source-rested","opponent-turn","outside-main","target-last-hp","other-last-hp","target-faints","flip","ordinary-flip"] as const)('074@1 %s uses exact physical records and ids without unproved initial HP gain',scenario=>{
 const state=createBs12PoppingCandyDemoState(scenario, 'BS12-074@1');assertBs12PhysicalFixture(state)
 for(const player of Object.values(state.players))for(const cookie of player.battleArea)expect(cookie.hpCards.length,cookie.card.name).toBeLessThanOrEqual(cookie.card.hp)
 if(['outside-main','attack-outside-main','extra-outside-main'].includes(scenario))expect(state.phase).toBe('support')
})

it('074@1 generic routes reach mechanism-specific printed fixtures',()=>{
 for(const[prefix,scenario]of [['card','extra'],['card-negative','extra-no-event']]as const){
 expect(parseTestStateConfig('?test-state='+prefix+':BS12-074@1','localhost')).toEqual({kind:'bs12-074',scenario,cardNumber:'BS12-074@1'})
 expect(parseTestStateConfig('?test-state='+prefix+':BS12-074@1','example.com')).toBeNull()
 const state=prefix==='card'?createCardCheckDemoState('BS12-074@1'):createCardNegativeDemoState('BS12-074@1');assertBs12PhysicalFixture(state)
 for(const player of Object.values(state.players))for(const cookie of player.battleArea)expect(cookie.hpCards.length,cookie.card.name).toBeLessThanOrEqual(cookie.card.hp)
 }
})

it.each(["positive","deploy","four","six","repeat","source-rested","no-hand","opponent-turn","outside-main","item-cost","non-arena-cost","same-name-cost","receiver","attack","attack-one-energy","attack-wrong-energy","attack-rested-energy","attack-source-rested","attack-opponent-turn","attack-outside-main","attack-flip","attack-target-faints"] as const)('075 %s uses exact physical records and ids without unproved initial HP gain',scenario=>{
 const state=createBs12GnomeBandDemoState(scenario, 'BS12-075');assertBs12PhysicalFixture(state)
 for(const player of Object.values(state.players))for(const cookie of player.battleArea)expect(cookie.hpCards.length,cookie.card.name).toBeLessThanOrEqual(cookie.card.hp)
 if(['outside-main','attack-outside-main','extra-outside-main'].includes(scenario))expect(state.phase).toBe('support')
})

it('075 generic routes reach mechanism-specific printed fixtures',()=>{
 for(const[prefix,scenario]of [['card','positive'],['card-negative','four']]as const){
 expect(parseTestStateConfig('?test-state='+prefix+':BS12-075','localhost')).toEqual({kind:'bs12-075',scenario,cardNumber:'BS12-075'})
 expect(parseTestStateConfig('?test-state='+prefix+':BS12-075','example.com')).toBeNull()
 const state=prefix==='card'?createCardCheckDemoState('BS12-075'):createCardNegativeDemoState('BS12-075');assertBs12PhysicalFixture(state)
 for(const player of Object.values(state.players))for(const cookie of player.battleArea)expect(cookie.hpCards.length,cookie.card.name).toBeLessThanOrEqual(cookie.card.hp)
 }
})

it.each(["positive","deploy","four","six","repeat","source-rested","no-hand","opponent-turn","outside-main","item-cost","non-arena-cost","same-name-cost","receiver","attack","attack-one-energy","attack-wrong-energy","attack-rested-energy","attack-source-rested","attack-opponent-turn","attack-outside-main","attack-flip","attack-target-faints"] as const)('075@1 %s uses exact physical records and ids without unproved initial HP gain',scenario=>{
 const state=createBs12GnomeBandDemoState(scenario, 'BS12-075@1');assertBs12PhysicalFixture(state)
 for(const player of Object.values(state.players))for(const cookie of player.battleArea)expect(cookie.hpCards.length,cookie.card.name).toBeLessThanOrEqual(cookie.card.hp)
 if(['outside-main','attack-outside-main','extra-outside-main'].includes(scenario))expect(state.phase).toBe('support')
})

it('075@1 generic routes reach mechanism-specific printed fixtures',()=>{
 for(const[prefix,scenario]of [['card','positive'],['card-negative','four']]as const){
 expect(parseTestStateConfig('?test-state='+prefix+':BS12-075@1','localhost')).toEqual({kind:'bs12-075',scenario,cardNumber:'BS12-075@1'})
 expect(parseTestStateConfig('?test-state='+prefix+':BS12-075@1','example.com')).toBeNull()
 const state=prefix==='card'?createCardCheckDemoState('BS12-075@1'):createCardNegativeDemoState('BS12-075@1');assertBs12PhysicalFixture(state)
 for(const player of Object.values(state.players))for(const cookie of player.battleArea)expect(cookie.hpCards.length,cookie.card.name).toBeLessThanOrEqual(cookie.card.hp)
 }
})

it.each(["positive","blue-energy","few-energy","rested-energy","source-rested","opponent-turn","target-faints","deploy","outside-main","purple-energy"] as const)('076 %s uses exact physical records and ids without unproved initial HP gain',scenario=>{
 const state=createBs12BlackberryDemoState(scenario);assertBs12PhysicalFixture(state)
 for(const player of Object.values(state.players))for(const cookie of player.battleArea)expect(cookie.hpCards.length,cookie.card.name).toBeLessThanOrEqual(cookie.card.hp)
 if(['outside-main','attack-outside-main','extra-outside-main'].includes(scenario))expect(state.phase).toBe('support')
})

it('076 generic routes reach mechanism-specific printed fixtures',()=>{
 for(const[prefix,scenario]of [['card','positive'],['card-negative','few-energy']]as const){
 expect(parseTestStateConfig('?test-state='+prefix+':BS12-076','localhost')).toEqual({kind:'bs12-076',scenario})
 expect(parseTestStateConfig('?test-state='+prefix+':BS12-076','example.com')).toBeNull()
 const state=prefix==='card'?createCardCheckDemoState('BS12-076'):createCardNegativeDemoState('BS12-076');assertBs12PhysicalFixture(state)
 for(const player of Object.values(state.players))for(const cookie of player.battleArea)expect(cookie.hpCards.length,cookie.card.name).toBeLessThanOrEqual(cookie.card.hp)
 }
})

it.each(["equipped","no-equipment","wrong-host","other-attacker","defender","defender-no-equipment","defender-rested-blocker","defender-trap","flip","equip-blocked","deploy","attack","mixed-energy","wrong-energy","few-energy","rested-energy","source-rested","opponent-turn","outside-main"] as const)('077 %s uses exact physical records and ids without unproved initial HP gain',scenario=>{
 const state=createBs12SpotlightFanDemoState(scenario);assertBs12PhysicalFixture(state)
 for(const player of Object.values(state.players))for(const cookie of player.battleArea)expect(cookie.hpCards.length,cookie.card.name).toBeLessThanOrEqual(cookie.card.hp)
 if(['outside-main','attack-outside-main','extra-outside-main'].includes(scenario))expect(state.phase).toBe('support')
})

it('077 generic routes reach mechanism-specific printed fixtures',()=>{
 for(const[prefix,scenario]of [['card','equip-positive'],['card-negative','equip-wrong-host']]as const){
 expect(parseTestStateConfig('?test-state='+prefix+':BS12-077','localhost')).toEqual({kind:'bs12-077',scenario})
 expect(parseTestStateConfig('?test-state='+prefix+':BS12-077','example.com')).toBeNull()
 const state=prefix==='card'?createCardCheckDemoState('BS12-077'):createCardNegativeDemoState('BS12-077');assertBs12PhysicalFixture(state)
 for(const player of Object.values(state.players))for(const cookie of player.battleArea)expect(cookie.hpCards.length,cookie.card.name).toBeLessThanOrEqual(cookie.card.hp)
 }
})

it.each(["positive","four","six","no-hand","wrong-color","non-arena","split-cost","item-cost","stage-cost","trap-cost","last-hp","decline","receiver","deploy","attack","wrong-energy","few-energy","rested-energy","source-rested","opponent-turn","outside-main"] as const)('078 %s uses exact physical records and ids without unproved initial HP gain',scenario=>{
 const state=createBs12OnionDemoState(scenario);assertBs12PhysicalFixture(state)
 for(const player of Object.values(state.players))for(const cookie of player.battleArea)expect(cookie.hpCards.length,cookie.card.name).toBeLessThanOrEqual(cookie.card.hp)
 if(['outside-main','attack-outside-main','extra-outside-main'].includes(scenario))expect(state.phase).toBe('support')
})

it('078 generic routes reach mechanism-specific printed fixtures',()=>{
 for(const[prefix,scenario]of [['card','positive'],['card-negative','non-arena']]as const){
 expect(parseTestStateConfig('?test-state='+prefix+':BS12-078','localhost')).toEqual({kind:'bs12-078',scenario})
 expect(parseTestStateConfig('?test-state='+prefix+':BS12-078','example.com')).toBeNull()
 const state=prefix==='card'?createCardCheckDemoState('BS12-078'):createCardNegativeDemoState('BS12-078');assertBs12PhysicalFixture(state)
 for(const player of Object.values(state.players))for(const cookie of player.battleArea)expect(cookie.hpCards.length,cookie.card.name).toBeLessThanOrEqual(cookie.card.hp)
 }
})

it('074 legal EXTRA uses actual072commands and printed5HP entry',()=>{
 const before=createBs12PoppingCandyDemoState('extra','BS12-074');assertBs12PhysicalFixture(before)
 expect(before.commandLog?.map(c=>c.commandKind)).toContain('begin-activate-skill');expect(before.commandLog?.map(c=>c.commandKind)).toContain('resolve-ability-effect')
 expect(before.players['player-one'].battleArea[0].card.id).toBe('BS12-072');expect(before.players['player-one'].battleArea[0].hpCards).toHaveLength(3)
 expect(before.players['player-one'].extraDeck?.[0].id).toBe('BS12-074');expect(before.players['player-one'].deck.at(-1)?.id).toBe('BS12-060')
 const after=applyGameCommand(before,{kind:'play-extra-deck-cookie',playerId:'player-one',instanceId:'bs12-074-source'});assertBs12PhysicalFixture(after)
 expect(after.players['player-one'].battleArea[1].hpCards).toEqual(before.players['player-one'].deck.slice(0,5));expect(after.commandLog?.at(-1)?.commandKind).toBe('play-extra-deck-cookie')
})

it('074 OnPlay has actualEXTRAparent and second-player0-2draw',()=>{
 for(const drawCount of[0,1,2]){const before=createBs12PoppingCandyDemoState('onplay','BS12-074');assertBs12PhysicalFixture(before)
 expect(before.firstPlayerId).toBe('player-two');expect(before.commandLog?.map(c=>c.commandKind)).toContain('play-extra-deck-cookie');expect(before.players['player-one'].battleArea[1].hpCards).toHaveLength(5)
 const offered=applyGameCommand(before,{kind:'begin-activate-skill',playerId:'player-one',sourceInstanceId:'bs12-074-source',trigger:'on-play',paymentIds:[],targetIds:[]})
 const after=applyGameCommand(offered,{kind:'resolve-draw-up-to',playerId:'player-one',drawCount});assertBs12PhysicalFixture(after)
 expect(after.players['player-one'].hand).toEqual([...before.players['player-one'].hand,...before.players['player-one'].deck.slice(0,drawCount)])}
})

it('074 lastHP and faint targets have real printedHP4/3/1',()=>{
 for(const[scenario,id,hp,index]of [['target-last-hp','BS12-019',4,0],['target-faints','BS12-075',3,0],['other-last-hp','BS6-017',1,1]]as const){const state=createBs12PoppingCandyDemoState(scenario,'BS12-074');assertBs12PhysicalFixture(state);expect(state.players['player-two'].battleArea[index].card.id).toBe(id);expect(state.players['player-two'].battleArea[index].hpCards).toHaveLength(hp)}
})

it('074@1 legal EXTRA uses actual072commands and printed5HP entry',()=>{
 const before=createBs12PoppingCandyDemoState('extra','BS12-074@1');assertBs12PhysicalFixture(before)
 expect(before.commandLog?.map(c=>c.commandKind)).toContain('begin-activate-skill');expect(before.commandLog?.map(c=>c.commandKind)).toContain('resolve-ability-effect')
 expect(before.players['player-one'].battleArea[0].card.id).toBe('BS12-072');expect(before.players['player-one'].battleArea[0].hpCards).toHaveLength(3)
 expect(before.players['player-one'].extraDeck?.[0].id).toBe('BS12-074');expect(before.players['player-one'].deck.at(-1)?.id).toBe('BS12-060')
 const after=applyGameCommand(before,{kind:'play-extra-deck-cookie',playerId:'player-one',instanceId:'bs12-074-source'});assertBs12PhysicalFixture(after)
 expect(after.players['player-one'].battleArea[1].hpCards).toEqual(before.players['player-one'].deck.slice(0,5));expect(after.commandLog?.at(-1)?.commandKind).toBe('play-extra-deck-cookie')
})

it('074@1 OnPlay has actualEXTRAparent and second-player0-2draw',()=>{
 for(const drawCount of[0,1,2]){const before=createBs12PoppingCandyDemoState('onplay','BS12-074@1');assertBs12PhysicalFixture(before)
 expect(before.firstPlayerId).toBe('player-two');expect(before.commandLog?.map(c=>c.commandKind)).toContain('play-extra-deck-cookie');expect(before.players['player-one'].battleArea[1].hpCards).toHaveLength(5)
 const offered=applyGameCommand(before,{kind:'begin-activate-skill',playerId:'player-one',sourceInstanceId:'bs12-074-source',trigger:'on-play',paymentIds:[],targetIds:[]})
 const after=applyGameCommand(offered,{kind:'resolve-draw-up-to',playerId:'player-one',drawCount});assertBs12PhysicalFixture(after)
 expect(after.players['player-one'].hand).toEqual([...before.players['player-one'].hand,...before.players['player-one'].deck.slice(0,drawCount)])}
})

it('074@1 lastHP and faint targets have real printedHP4/3/1',()=>{
 for(const[scenario,id,hp,index]of [['target-last-hp','BS12-019',4,0],['target-faints','BS12-075',3,0],['other-last-hp','BS6-017',1,1]]as const){const state=createBs12PoppingCandyDemoState(scenario,'BS12-074@1');assertBs12PhysicalFixture(state);expect(state.players['player-two'].battleArea[index].card.id).toBe(id);expect(state.players['player-two'].battleArea[index].hpCards).toHaveLength(hp)}
})

it('075 normaldeployment supplies printed3realHP',()=>{
 const before=createBs12GnomeBandDemoState('deploy', 'BS12-075');assertBs12PhysicalFixture(before)
 const after=applyGameCommand(before,{kind:'deploy-cookie',playerId:'player-one',instanceId:'bs12-075-source'});assertBs12PhysicalFixture(after)
 expect(after.players['player-one'].battleArea.find(c=>c.card.instanceId==='bs12-075-source')?.hpCards).toEqual(before.players['player-one'].deck.slice(0,3));expect(after.commandLog?.at(-1)?.commandKind).toBe('deploy-cookie')
})

it('075@1 normaldeployment supplies printed3realHP',()=>{
 const before=createBs12GnomeBandDemoState('deploy', 'BS12-075@1');assertBs12PhysicalFixture(before)
 const after=applyGameCommand(before,{kind:'deploy-cookie',playerId:'player-one',instanceId:'bs12-075-source'});assertBs12PhysicalFixture(after)
 expect(after.players['player-one'].battleArea.find(c=>c.card.instanceId==='bs12-075-source')?.hpCards).toEqual(before.players['player-one'].deck.slice(0,3));expect(after.commandLog?.at(-1)?.commandKind).toBe('deploy-cookie')
})

it('077 normaldeployment supplies printed3realHP',()=>{
 const before=createBs12SpotlightFanDemoState('deploy');assertBs12PhysicalFixture(before)
 const after=applyGameCommand(before,{kind:'deploy-cookie',playerId:'player-one',instanceId:'bs12-077-source'});assertBs12PhysicalFixture(after)
 expect(after.players['player-one'].battleArea.find(c=>c.card.instanceId==='bs12-077-source')?.hpCards).toEqual(before.players['player-one'].deck.slice(0,3));expect(after.commandLog?.at(-1)?.commandKind).toBe('deploy-cookie')
})

it('078 normaldeployment supplies printed3realHP',()=>{
 const before=createBs12OnionDemoState('deploy');assertBs12PhysicalFixture(before)
 const after=applyGameCommand(before,{kind:'deploy-cookie',playerId:'player-one',instanceId:'bs12-078-source'});assertBs12PhysicalFixture(after)
 expect(after.players['player-one'].battleArea.find(c=>c.card.instanceId==='bs12-078-source')?.hpCards).toEqual(before.players['player-one'].deck.slice(0,3));expect(after.commandLog?.at(-1)?.commandKind).toBe('deploy-cookie')
})

it('076 normaldeployment supplies printed4realHP',()=>{
 const state=createBs12BlackberryDemoState();const own=state.players['player-one'];const source=own.battleArea[0]
 const before:GameState={...state,commandLog:[],players:{...state.players,'player-one':{...own,battleArea:[],hand:[source.card],deck:[...source.hpCards,...own.deck]}}};assertBs12PhysicalFixture(before)
 const after=applyGameCommand(before,{kind:'deploy-cookie',playerId:'player-one',instanceId:source.card.instanceId});assertBs12PhysicalFixture(after);expect(after.players['player-one'].battleArea[0].hpCards).toEqual(source.hpCards);expect(after.commandLog?.at(-1)?.commandKind).toBe('deploy-cookie')
})

it('075 threshold and receiver actualcost/REST use realprivatehand resources',()=>{
 const state=createBs12GnomeBandDemoState('receiver');assertBs12PhysicalFixture(state);expect(state.players['player-two'].battleArea[0].hpCards).toHaveLength(3);expect(state.players['player-two'].battleArea[0].rested).toBe(true);expect(state.pendingOpponentHandDiscard).toMatchObject({playerId:'player-one',count:1});expect(state.commandLog?.map(c=>c.commandKind)).toContain('begin-activate-skill')
 const faint=createBs12GnomeBandDemoState('attack-target-faints');expect(faint.players['player-two'].battleArea[0].card.id).toBe('BS12-060');expect(faint.players['player-two'].battleArea[0].hpCards).toHaveLength(2)
})

it('078 lastHP is printedPinkChoco1HP with actual damage FLIP parent',()=>{
 const state=createBs12OnionDemoState('last-hp');assertBs12PhysicalFixture(state);expect(state.players['player-one'].battleArea[0].card.id).toBe('BS6-017');expect(state.pendingBattle?.revealedHpCard?.id).toBe('BS12-078');expect(state.commandLog?.map(c=>c.commandKind)).toEqual(['declare-attack','skip-trap','resolve-next-damage']);expect(state.players['player-two'].battleArea[0].hpCards).toHaveLength(2)
})

it('077 generic controls use actual Spotlight deployment, exact host and wrong-name negative',()=>{
 const positive=createCardCheckDemoState('BS12-077');const negative=createCardNegativeDemoState('BS12-077');assertBs12PhysicalFixture(positive);assertBs12PhysicalFixture(negative)
 expect(positive.players['player-one'].battleArea[0].card.id).toBe('BS4-090');expect(positive.players['player-one'].battleArea[0].equippedCards??[]).toEqual([]);expect(positive.players['player-two'].battleArea[1].card.id).toBe('BS4-014')
 expect(negative.players['player-one'].battleArea[0].card.id).toBe('BS12-075');expect(negative.players['player-one'].battleArea[0].equippedCards??[]).toEqual([])
 for(const state of[positive,negative]){expect(state.commandLog?.some(c=>c.commandKind==='deploy-cookie')).toBe(true);expect(state.players['player-one'].battleArea.find(c=>c.card.id==='BS12-077')?.hpCards).toHaveLength(3)}
})
