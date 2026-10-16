import {describe,expect,it} from 'vitest'
import {createSt8012PreviewState as fixture,st8012Scenarios,st8012Zones} from './st8-012-demo'
import {applyGameCommand as apply} from './commands'
import {commandFromLogEntry} from './replay'
import {getActingPlayerId} from './controller'
import {isEffectConditionMet} from './effects/targeting'
import {selectEnergyPayment} from './energy'
import type {GameState} from './types'

const owner='player-one' as const
const required=<T,>(value:T|null|undefined,label:string):T=>{
 if(value===null||value===undefined)throw Error(`Missing ${label}`)
 return value
}
const sourceId=(state:GameState)=>required(state.players[owner].battleArea.find(c=>c.card.id==='ST8-012'),'Windcatcher').card.instanceId
const windId=(state:GameState)=>required(state.players[owner].battleArea.find(c=>c.card.name==='Wind Archer Cookie'),'battle Wind').card.instanceId
const begin=(state:GameState)=>apply(state,{kind:'begin-activate-skill',playerId:owner,sourceInstanceId:sourceId(state),trigger:'activate',paymentIds:[]})
// Resolve real interruptions, never inject flags, pending queues or reduced HP.
const settleInterruptions=(initial:GameState):GameState=>{
 let state=initial
 for(let step=0;step<40;step++){
  if(state.pendingRefresh){
   const actor=state.pendingRefresh.playerId,cookie=required(state.players[actor].discardPile.find(c=>c.type==='cookie'&&c.level>=1),'Refresh Cookie')
   state=apply(state,{kind:'refresh-deck',playerId:actor,cookieInstanceId:cookie.instanceId,shuffleSeed:1});continue
  }
  if(state.pendingReplacement){
   const actor=getActingPlayerId(state),player=state.players[actor]
   state=player.battleArea.length?apply(state,{kind:'skip-replacement',playerId:actor}):apply(state,{kind:'replace-cookie',playerId:actor,instanceId:required(player.hand.find(c=>c.type==='cookie'),'mandatory replacement').instanceId})
   continue
  }
  if(state.pendingBattle){
   const actor=getActingPlayerId(state),stage=state.pendingBattle.stage
   state=stage==='flip'?apply(state,{kind:'resolve-flip',playerId:actor,activate:false}):stage==='trap'?apply(state,{kind:'skip-trap',playerId:actor}):stage==='damage'?apply(state,{kind:'resolve-next-damage',playerId:actor}):apply(state,{kind:'resolve-battle',playerId:actor})
   continue
  }
  return state
 }
 throw Error('Actual interrupt sequence did not settle')
}
const openThen=(initial:GameState,targetIds:string[]=[]):GameState=>{
 let state=begin(initial)
 for(let i=0;i<4&&!state.pendingOptionalCostAttack;i++){
  const pending=required(state.pendingAbilityEffect,'ability queue'),effect=required(pending.effects[pending.effectIndex],'current effect')
  state=apply(state,{kind:'resolve-ability-effect',playerId:owner,targetIds:effect.kind==='damage'?targetIds:[]})
  state=settleInterruptions(state)
 }
 if(!state.pendingOptionalCostAttack)throw Error('Independent optional Then must become pending')
 return state
}
const pay=(state:GameState,paymentIds?:string[])=>apply(state,{kind:'resolve-optional-cost-attack',playerId:owner,action:'pay',paymentIds:paymentIds??required(selectEnergyPayment({green:1},state.players[owner].supportArea),'active G support')})
const heal=(state:GameState,targetIds:string[])=>settleInterruptions(apply(state,{kind:'resolve-ability-effect',playerId:owner,targetIds}))
const replay=(scenario:string,state:GameState)=>{
 let independent=fixture(scenario,true)
 for(const entry of state.commandLog??[])independent=apply(independent,commandFromLogEntry(entry))
 expect(JSON.parse(JSON.stringify(independent))).toEqual(JSON.parse(JSON.stringify(state)))
}

describe('ST8-012 original-card physical parent and independent Then',()=>{
 it.each(st8012Scenarios)('%s starts from sixty true cards and printed HP',scenario=>{
  const state=fixture(scenario,true),ids:string[]=[]
  for(const id of ['player-one','player-two'] as const){
   const cards=st8012Zones(state,id);expect(cards).toHaveLength(60);ids.push(...cards.map(c=>c.instanceId))
   const numbers=new Map<string,number>(),names=new Map<string,number>()
   for(const card of cards){expect(card.imageUrl).toMatch(/^https:\/\/cookierunbraverse.com\//);numbers.set(card.id,(numbers.get(card.id)??0)+1);names.set(card.name,(names.get(card.name)??0)+1)}
   expect([...numbers.values()].every(n=>n<=4)).toBe(true);expect([...names.values()].every(n=>n<=4)).toBe(true)
   expect(state.players[id].battleArea.length).toBeLessThanOrEqual(2)
   for(const cookie of state.players[id].battleArea)expect(cookie.hpCards).toHaveLength(cookie.card.hp)
  }
  expect(new Set(ids).size).toBe(120)
 })
 it('creates Item history only from real RR Item play and zero legal target',()=>{
  const state=fixture(),prepared=fixture('positive',true),item=required(prepared.players[owner].hand.find(c=>c.id==='ST1-016'),'Icky Sticky Jelly')
  expect(state.itemsActivatedThisTurn?.[owner]).toBe(1)
  expect(state.commandLog?.some(e=>e.commandKind==='play-item')).toBe(true)
  expect(state.players[owner].discardPile.some(c=>c.instanceId===item.instanceId)).toBe(true)
  expect(state.players['player-two'].battleArea).toEqual(prepared.players['player-two'].battleArea)
  expect(state.players[owner].supportArea.filter(c=>c.rested)).toHaveLength(2)
  replay('positive',state)
 })
 it.each([0,1])('REST source, optional damage%i and independent G then heal',count=>{
  const initial=fixture(),before=structuredClone(initial),target=initial.players['player-two'].battleArea[0],wind=required(initial.players[owner].battleArea[1],'Wind')
  const then=openThen(initial,count?[target.card.instanceId]:[])
  expect(then.players[owner].battleArea.find(c=>c.card.id==='ST8-012')?.rested).toBe(true)
  expect(then.players['player-two'].battleArea[0].hpCards).toHaveLength(target.hpCards.length-count)
  expect(then.players[owner].supportArea).toEqual(initial.players[owner].supportArea)
  const paid=pay(then)
  expect(paid.players[owner].supportArea.filter(c=>c.rested)).toHaveLength(3)
  expect(paid.players[owner].battleArea.find(c=>c.card.instanceId===wind.card.instanceId)?.hpCards).toEqual(wind.hpCards)
  const state=heal(paid,[wind.card.instanceId])
  expect(state.players[owner].battleArea.find(c=>c.card.instanceId===wind.card.instanceId)?.hpCards).toHaveLength(wind.hpCards.length+1)
  expect(state.itemsActivatedThisTurn?.[owner]).toBe(1);expect(initial).toEqual(before);replay('positive',state)
 })
 it.each(['no-item','item-support','previous-item'])('%s no damage but still allows independent Then',scenario=>{
  const initial=fixture(scenario),before=structuredClone(initial.players['player-two'].battleArea)
  expect(initial.itemsActivatedThisTurn?.[owner]??0).toBe(0)
  const then=openThen(initial),state=heal(pay(then),[windId(initial)])
  expect(state.players['player-two'].battleArea).toEqual(before)
  expect(state.players[owner].battleArea.find(c=>c.card.instanceId===windId(initial))?.hpCards.length).toBe(required(initial.players[owner].battleArea[1],'Wind').hpCards.length+1)
  expect(state.itemsActivatedThisTurn?.[owner]??0).toBe(0)
  replay(scenario,state)
 })
 it('opponent Item history does not satisfy another Cookie owner’s damage condition',()=>{
  const state=fixture('opponent-item'),source=required(state.players[owner].battleArea.find(c=>c.card.id==='ST8-012'),'source'),effect=required(source.card.skill?.effects[0],'damage')
  expect(state.itemsActivatedThisTurn?.['player-two']).toBe(1);expect(state.itemsActivatedThisTurn?.[owner]??0).toBe(0)
  expect(isEffectConditionMet(state,{sourcePlayerId:owner,sourceInstanceId:source.card.instanceId},effect)).toBe(false)
  replay('opponent-item',state)
 })
 it('own skill activation never creates an Item event',()=>{
  const initial=fixture('no-item'),next=begin(initial)
  expect(next.itemsActivatedThisTurn?.[owner]??0).toBe(0)
  expect(next.players[owner].battleArea.find(c=>c.card.id==='ST8-012')?.rested).toBe(true)
  replay('no-item',next)
 })
 it.each(['positive','no-item'])('%s may skip G Then without paying or healing',scenario=>{
  const then=openThen(fixture(scenario)),before=structuredClone(then.players[owner]),state=apply(then,{kind:'resolve-optional-cost-attack',playerId:owner,action:'skip'})
  expect(state.players[owner]).toEqual(before);expect(state.pendingOptionalCostAttack??null).toBeNull();expect(state.pendingAbilityEffect).toBeUndefined();replay(scenario,state)
 })
 it('paid G and zero heal target still spends real support energy',()=>{
  const then=openThen(fixture()),wind=required(then.players[owner].battleArea[1],'Wind'),paid=pay(then),state=heal(paid,[])
  expect(state.players[owner].supportArea.filter(c=>c.rested)).toHaveLength(3)
  expect(state.players[owner].battleArea.find(c=>c.card.instanceId===wind.card.instanceId)?.hpCards).toEqual(wind.hpCards);replay('positive',state)
 })
 it.each(['then-no-green','then-wrong-color','then-rested'])('%s cannot replace active support G with the source Cookie',scenario=>{
  const then=openThen(fixture(scenario)),before=structuredClone(then)
  expect(selectEnergyPayment({green:1},then.players[owner].supportArea)).toBeNull()
  for(const ids of [[],[sourceId(then)],then.players[owner].supportArea.map(s=>s.card.instanceId)])expect(()=>pay(then,ids)).toThrow()
  expect(then).toEqual(before)
  const skipped=apply(then,{kind:'resolve-optional-cost-attack',playerId:owner,action:'skip'});replay(scenario,skipped)
 })
 it('payment rejects duplicate/foe IDs and selecting the heal target before paying',()=>{
  const then=openThen(fixture()),id=required(selectEnergyPayment({green:1},then.players[owner].supportArea),'G')[0],before=structuredClone(then)
  for(const ids of [[id,id],[then.players['player-two'].supportArea[0].card.instanceId],[sourceId(then)]])expect(()=>pay(then,ids)).toThrow()
  expect(()=>apply(then,{kind:'resolve-optional-cost-attack',playerId:owner,action:'pay',paymentIds:[id],targetIds:[windId(then)]})).toThrow()
  expect(then).toEqual(before)
 })
 it.each([['positive','ST8-005',3,6],['wind-purple','BS2-058',3,5],['wind-other-green','BS11-052',2,5]] as const)('heals exact same name across original %s / %s', (scenario,id,level,hp)=>{
  const initial=fixture(scenario),wind=required(initial.players[owner].battleArea.find(c=>c.card.id===id),'Wind')
  expect([wind.card.name,wind.card.level,wind.card.hp,wind.hpCards.length]).toEqual(['Wind Archer Cookie',level,hp,hp])
  const state=heal(pay(openThen(initial)),[wind.card.instanceId])
  expect(state.players[owner].battleArea.find(c=>c.card.instanceId===wind.card.instanceId)?.hpCards).toHaveLength(hp+1);replay(scenario,state)
 })
 it('same named rested Wind remains a legal HP recipient',()=>{
  const initial=fixture('wind-rested'),wind=required(initial.players[owner].battleArea[1],'Wind')
  expect(wind.rested).toBe(true)
  const state=heal(pay(openThen(initial)),[wind.card.instanceId]);expect(state.players[owner].battleArea[1].hpCards).toHaveLength(7);replay('wind-rested',state)
 })
 it.each(['wind-hand','wind-support','wind-deck','wind-opponent','wind-break','wind-trash','wrong-name'])('%s cannot substitute for own battle named recipient',scenario=>{
  const initial=fixture(scenario),paid=pay(openThen(initial)),before=structuredClone(paid)
  const wrong=scenario==='wind-opponent'?required(initial.players['player-two'].battleArea.find(c=>c.card.name==='Wind Archer Cookie'),'opposing Wind').card:
   st8012Zones(initial,owner).find(c=>c.name==='Wind Archer Cookie')??required(initial.players[owner].battleArea[1],'wrong-name').card
  expect(()=>heal(paid,[wrong.instanceId])).toThrow();expect(paid).toEqual(before)
  const state=heal(paid,[]);replay(scenario,state)
 })
 it('rejects own source and duplicate/two recipient selection after real G payment',()=>{
  const initial=fixture(),paid=pay(openThen(initial)),before=structuredClone(paid),wind=windId(initial)
  for(const ids of [[sourceId(initial)],[wind,wind],[wind,sourceId(initial)]])expect(()=>heal(paid,ids)).toThrow()
  expect(paid).toEqual(before)
 })
 it('empty hand after the true Item still allows REST skill and normal G Then',()=>{
  const initial=fixture('no-hand');expect(initial.players[owner].hand).toEqual([])
  const state=heal(pay(openThen(initial)),[windId(initial)])
  expect(state.players[owner].hand).toEqual([]);expect(state.players[owner].battleArea[1].hpCards).toHaveLength(7);replay('no-hand',state)
 })
 it.each(['rested-source','wrong-phase','wrong-turn'])('%s rejects illegal Activate without mutation',scenario=>{
  const initial=fixture(scenario),before=structuredClone(initial)
  expect(()=>begin(initial)).toThrow();expect(initial).toEqual(before)
 })
 it('damage excludes friendly, hand, support and two targets',()=>{
  const initial=fixture(),started=begin(initial),before=structuredClone(started),foe=initial.players['player-two'].battleArea
  for(const ids of [[sourceId(initial)],[initial.players[owner].supportArea[0].card.instanceId],[required(initial.players[owner].hand[0],'hand').instanceId],foe.map(c=>c.card.instanceId)])expect(()=>apply(started,{kind:'resolve-ability-effect',playerId:owner,targetIds:ids})).toThrow()
  expect(started).toEqual(before)
 })
 it.each(['damage-faint','damage-mandatory-replacement'])('%s uses actual effect damage, faint/replacement then resumes heal',scenario=>{
  const initial=fixture(scenario),target=initial.players['player-two'].battleArea[0]
  expect(target.card.hp).toBe(1)
  const state=heal(pay(openThen(initial,[target.card.instanceId])),[windId(initial)])
  expect(state.players['player-two'].breakArea.some(c=>c.instanceId===target.card.instanceId)).toBe(true)
  expect(state.pendingReplacement??null).toBeNull()
  expect(state.commandLog?.some(e=>e.commandKind===(scenario==='damage-faint'?'skip-replacement':'replace-cookie'))).toBe(true)
  expect(state.players[owner].battleArea[1].hpCards).toHaveLength(7);replay(scenario,state)
 })
 it('last deck HP gain triggers real Refresh and finishes the pending ability',()=>{
  const initial=fixture('last-deck'),top=initial.players[owner].deck[0],paid=pay(openThen(initial))
  expect(paid.players[owner].deck).toHaveLength(1)
  const pending=apply(paid,{kind:'resolve-ability-effect',playerId:owner,targetIds:[windId(initial)]})
  expect(pending.pendingRefresh?.playerId).toBe(owner)
  expect(pending.players[owner].battleArea[1].hpCards.at(-1)).toEqual(top)
  const state=settleInterruptions(pending)
  expect(state.pendingRefresh??null).toBeNull();expect(state.players[owner].deck.length).toBeGreaterThan(0)
  expect(state.commandLog?.some(e=>e.commandKind==='refresh-deck')).toBe(true);replay('last-deck',state)
 })
 it('real NNN3 damage parent lowers Wind before the true Item and heal',()=>{
  // Start from the same prepared state as independent replay. Changing only
  // activePlayerId in a fixture would not be represented by a real command.
  let initial=fixture('damaged-wind',true)
  const reachMain=(state:GameState,actor:'player-one'|'player-two')=>{
   let next=state
   for(let step=0;step<20&&!(next.activePlayerId===actor&&next.phase==='main');step++)next=apply(next,{kind:'advance-phase',playerId:next.activePlayerId})
   expect([next.activePlayerId,next.phase]).toEqual([actor,'main'])
   return next
  }
  initial=reachMain(initial,'player-two')
  const attacker=required(initial.players['player-two'].battleArea.find(c=>c.card.id==='ST6-003'),'real Devil'),target=required(initial.players[owner].battleArea[1],'original Wind')
  expect(target.hpCards).toHaveLength(6)
  initial=apply(initial,{kind:'declare-attack',playerId:'player-two',attackerInstanceId:attacker.card.instanceId,targetInstanceId:target.card.instanceId,supportPaymentIds:required(selectEnergyPayment({neutral:3},initial.players['player-two'].supportArea),'NNN')})
  initial=apply(initial,{kind:'skip-trap',playerId:owner})
  initial=apply(initial,{kind:'resolve-battle',playerId:'player-two'})
  initial=reachMain(initial,owner)
  const item=required(initial.players[owner].hand.find(c=>c.id==='ST1-016'),'actual hand Item')
  initial=apply(initial,{kind:'play-item',playerId:owner,instanceId:item.instanceId,paymentIds:required(selectEnergyPayment({red:2},initial.players[owner].supportArea),'RR'),effectTargets:[[]]})
  const wind=required(initial.players[owner].battleArea[1],'damaged Wind')
  expect(wind.hpCards).toHaveLength(3)
  expect(initial.itemsActivatedThisTurn?.[owner]).toBe(1)
  const state=heal(pay(openThen(initial)),[wind.card.instanceId]);expect(state.players[owner].battleArea[1].hpCards).toHaveLength(4)
  expect(initial.commandLog?.some(e=>e.commandKind==='declare-attack')).toBe(true);replay('damaged-wind',state)
 })
 it('normal deployment configures printed HP2 without OnPlay',()=>{
  const initial=fixture('play'),source=required(initial.players[owner].hand.find(c=>c.id==='ST8-012'),'hand source')
  const state=apply(initial,{kind:'deploy-cookie',playerId:owner,instanceId:source.instanceId})
  expect(state.players[owner].battleArea.find(c=>c.card.instanceId===source.instanceId)?.hpCards).toHaveLength(2);expect(state.pendingOnPlay??null).toBeNull();replay('play',state)
 })
 it('ordinary GG deals exactly two without a skill or attack Then event',()=>{
  const initial=fixture('attack'),target=initial.players['player-two'].battleArea[1]
  let state=apply(initial,{kind:'declare-attack',playerId:owner,attackerInstanceId:sourceId(initial),targetInstanceId:target.card.instanceId,supportPaymentIds:required(selectEnergyPayment({green:2},initial.players[owner].supportArea),'GG')})
  state=apply(state,{kind:'skip-trap',playerId:'player-two'});state=apply(state,{kind:'resolve-battle',playerId:owner})
  expect(state.players['player-two'].battleArea.find(c=>c.card.instanceId===target.card.instanceId)?.hpCards.length).toBe(target.hpCards.length-2)
  expect(state.itemsActivatedThisTurn?.[owner]??0).toBe(0);expect(state.pendingOptionalCostAttack??null).toBeNull();replay('attack',state)
 })
 it.each(['attack-no-green','attack-rested-source','attack-wrong-phase'])('%s rejects ordinary GG',scenario=>{
  const initial=fixture(scenario),before=structuredClone(initial)
  expect(()=>apply(initial,{kind:'declare-attack',playerId:owner,attackerInstanceId:sourceId(initial),targetInstanceId:initial.players['player-two'].battleArea[0].card.instanceId,supportPaymentIds:selectEnergyPayment({green:2},initial.players[owner].supportArea)??[]})).toThrow();expect(initial).toEqual(before)
 })
})
