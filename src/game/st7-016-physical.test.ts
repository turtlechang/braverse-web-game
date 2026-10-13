import {describe,expect,it} from 'vitest'
import document from '../../data/candidates/st6-st10/official-st7.en.json'
import {fixture as foundation} from './st7-010-demo'
import {zones} from './st7-014-demo'
import {getCardPoolEntry} from './card-pool'
import {createCard} from './starter-deck'
import {applyGameCommand as apply} from './commands'
import type {GameCommand} from './commands'
import {canPlayItem} from './card-abilities'
import {takeAiStep} from './ai'
import type {OfficialCardRecord} from '../cards/types'
import type {GameState,GameCard,PlayerId} from './types'

export const fixture=(scenario='positive',prepareOnly=false):GameState=>{
 if(scenario.startsWith('ai-')){
  const swap=<T,>(value:T):T=>JSON.parse(JSON.stringify(value).replaceAll('player-one','player-swap').replaceAll('player-two','player-one').replaceAll('player-swap','player-two')) as T
  let state=swap(aiFixture(scenario.slice(3),true))
  if(prepareOnly)return state
  const own=state.players['player-two'],foe=state.players['player-one']
  state=apply(state,{kind:'activate-skill',trigger:'activate',playerId:'player-two',sourceInstanceId:own.battleArea[0].card.instanceId,paymentIds:[],discardHandIds:[own.hand[0].instanceId],effectTargets:[[own.battleArea[1].card.instanceId]]})
  if(scenario==='ai-duplicate')state=apply(state,{kind:'play-item',playerId:'player-two',instanceId:'player-two-ST7-016-1',paymentIds:own.supportArea.slice(0,2).map(s=>s.card.instanceId),effectTargets:[[foe.battleArea[0].card.instanceId]]})
  return state
 }
 let state=foundation('skill-once',true)
 const own=state.players['player-one'],foe=state.players['player-two']
 const raw=(getCardPoolEntry('ST7-016')??(document.cards as OfficialCardRecord[]).find(card=>card.cardNumber==='ST7-016')) as OfficialCardRecord|undefined
 if(!raw)throw Error('Original ST7-016 required')
 const original=(id:string,owner:PlayerId):GameCard=>{
  const record=id==='ST7-016'?raw:getCardPoolEntry(id);if(!record)throw Error('Original '+id)
  const used=new Set(zones(state,owner).map(c=>c.instanceId))
  for(let copy=1;copy<=4;copy++){const card=createCard(record,owner,copy);if(!used.has(card.instanceId))return card}
  throw Error('Original four-copy limit '+id)
 }
 own.hand[1]=original('ST7-016','player-one');own.name='ST7-016 原卡逐卡驗收'
 if(scenario==='no-target'||scenario==='purple-target'){
  const card=original(scenario==='no-target'?'ST7-012':'BS3-101','player-two');if(card.type!=='cookie')throw Error('Original Cookie')
  const previous=foe.battleArea[1],hpCards=[...previous.hpCards]
  while(hpCards.length<card.hp){const hp=foe.deck.shift();if(!hp)throw Error('Original HP');hpCards.push(hp)}
  foe.battleArea[1]={card,hpCards,rested:false,battleEntryId:card.instanceId+':entry'}
 }
 if(scenario==='few-energy')own.supportArea.slice(1).forEach(s=>{s.rested=true})
 if(scenario==='rested-energy')own.supportArea.forEach(s=>{s.rested=true})
 if(scenario==='wrong-energy')for(const support of own.supportArea)support.card=original('ST1-020','player-one')
 if(scenario==='wrong-phase')state.phase='support'
 if(scenario==='rested-target'){state.activePlayerId='player-two';state.turnNumber=2}
 for(const owner of ['player-one','player-two'] as const){
  const cards=zones(state,owner)
  if(cards.length!==60||new Set(cards.map(c=>c.instanceId)).size!==60)throw Error('Original sixty identities')
  for(const card of cards)if(cards.filter(c=>c.id===card.id).length>4)throw Error('Four-copy limit')
  for(const battle of state.players[owner].battleArea)if(battle.hpCards.length!==battle.card.hp)throw Error('Initial printed HP')
 }
 if(prepareOnly)return state
 if(scenario==='one-hp'){
  state=apply(state,{kind:'declare-attack',playerId:'player-one',attackerInstanceId:own.battleArea[1].card.instanceId,targetInstanceId:foe.battleArea[1].card.instanceId,supportPaymentIds:[own.supportArea[0].card.instanceId]})
  state=apply(state,{kind:'skip-trap',playerId:'player-two'});state=apply(state,{kind:'resolve-battle',playerId:'player-one'})
 }
 if(scenario==='rested-target'){
  state=apply(state,{kind:'declare-attack',playerId:'player-two',attackerInstanceId:foe.battleArea[1].card.instanceId,targetInstanceId:own.battleArea[0].card.instanceId,supportPaymentIds:[foe.supportArea[0].card.instanceId]})
  state=apply(state,{kind:'skip-trap',playerId:'player-one'});state=apply(state,{kind:'resolve-battle',playerId:'player-two'})
  for(let step=0;step<10&&!(state.activePlayerId==='player-one'&&state.phase==='main');step++)state=apply(state,{kind:'advance-phase',playerId:state.activePlayerId})
 }
 return state
}
export const command=(state:GameState,targetIds:string[]):GameCommand=>({kind:'play-item',playerId:'player-one',instanceId:state.players['player-one'].hand.find(c=>c.id==='ST7-016')!.instanceId,paymentIds:state.players['player-one'].supportArea.filter(s=>!s.rested).slice(0,2).map(s=>s.card.instanceId),effectTargets:[targetIds]})
export const aiFixture=(scenario='rested',prepareOnly=false):GameState=>{
 let state=fixture('purple-target',true)
 const own=state.players['player-one'],foe=state.players['player-two']
 for(const c of own.battleArea)c.rested=true
 const removed=foe.battleArea.shift();if(!removed)throw Error('Original Cookie')
 foe.deck.push(removed.card,...removed.hpCards);foe.battleArea[0].rested=scenario!=='active'
 const original=(id:string,owner:PlayerId,copy=1)=>{
  const raw=getCardPoolEntry(id)??(document.cards as OfficialCardRecord[]).find(c=>c.cardNumber===id) as OfficialCardRecord|undefined
  if(!raw)throw Error('Original '+id)
  return createCard(raw,owner,copy)
 }
 foe.supportArea=[1,2].map(copy=>({card:original(scenario==='wrong-color'?'ST1-020':'BS12-085','player-two',copy),rested:true}));foe.deck.shift()
 if(scenario==='duplicate'){
  for(const copy of [2,3]){own.supportArea.push({card:original('ST2-018','player-one',copy),rested:false});own.deck.shift()}
  own.hand.push(original('ST7-016','player-one',2));own.deck.shift()
 }
 for(const owner of ['player-one','player-two'] as const){const cards=zones(state,owner);if(cards.length!==60||new Set(cards.map(c=>c.instanceId)).size!==60)throw Error('AI original sixty');for(const c of cards)if(cards.filter(x=>x.id===c.id).length>4)throw Error('AI original four copies')}
 if(prepareOnly)return state
 state=apply(state,{kind:'activate-skill',trigger:'activate',playerId:'player-one',sourceInstanceId:own.battleArea[0].card.instanceId,paymentIds:[],discardHandIds:[own.hand[0].instanceId],effectTargets:[[own.battleArea[1].card.instanceId]]})
 if(scenario==='duplicate')state=apply(state,command(state,[foe.battleArea[0].card.instanceId]))
 return state
}
const nextMain=(initial:GameState,owner:PlayerId)=>{
 let state=initial
 for(let step=0;step<12;step++){
  state=apply(state,{kind:'advance-phase',playerId:state.activePlayerId})
  if(state.activePlayerId===owner&&state.phase==='main')return state
 }
 throw Error('Actual next Main not reached')
}
describe('ST7-016 original sixty-card next Active Phase lifecycle',()=>{
 it.each([3,4,5].flatMap(level=>['rested','active','wrong-color','duplicate'].map(scenario=>({level:level as 3|4|5,scenario}))))('Lv$level distinguishes useful next Active lock: $scenario',({level,scenario})=>{
  const state=aiFixture(scenario),before=structuredClone(state),decision=takeAiStep(state,'player-one',{level,searchNow:()=>0})
  expect(decision.action).toBe(scenario==='rested'?'play-item':'advance-phase')
  if(scenario==='rested')expect(decision.state.preventCookieActiveNextPhase).toEqual({'player-two':['player-two-BS3-101-1']})
  else{expect(decision.state.players['player-one'].hand).toEqual(state.players['player-one'].hand);expect(decision.state.players['player-one'].supportArea).toEqual(state.players['player-one'].supportArea)}
  expect(state).toEqual(before)
 })
 it.each(['positive','zero','no-target','purple-target','one-hp','rested-target','few-energy','rested-energy','wrong-energy','wrong-phase'])('preserves original full identities including real attack parents: %s',scenario=>{
  const state=fixture(scenario)
  for(const owner of ['player-one','player-two'] as const)expect(zones(state,owner)).toHaveLength(60)
 })
 it.each(['positive','purple-target','one-hp','rested-target'])('pays YY and marks only target without immediate REST: %s',scenario=>{
  const state=fixture(scenario),before=structuredClone(state),target=state.players['player-two'].battleArea[1],next=apply(state,command(state,[target.card.instanceId]))
  expect(next.preventCookieActiveNextPhase).toEqual({'player-two':[target.card.instanceId]})
  expect(next.players['player-two']).toEqual(state.players['player-two'])
  expect(next.players['player-one'].supportArea.filter(s=>s.rested).length-state.players['player-one'].supportArea.filter(s=>s.rested).length).toBe(2)
  expect(next.players['player-one'].discardPile.some(c=>c.id==='ST7-016')).toBe(true);expect(state).toEqual(before)
 })
 it.each(['positive','no-target'])('selecting zero still pays and makes no mark: %s',scenario=>{
  const state=fixture(scenario),next=apply(state,command(state,[]))
  expect(next.preventCookieActiveNextPhase).toBeUndefined();expect(next.players['player-two']).toEqual(state.players['player-two'])
  expect(next.players['player-one'].supportArea.filter(s=>s.rested)).toHaveLength(2)
 })
 it.each(['few-energy','rested-energy','wrong-energy','wrong-phase'])('rejects unavailable use: %s',scenario=>{
  const state=fixture(scenario),before=structuredClone(state),item=state.players['player-one'].hand[1]
  expect(canPlayItem(state,'player-one',item.instanceId)).toBe(false);expect(()=>apply(state,command(state,[]))).toThrow();expect(state).toEqual(before)
 })
 it('rejects own HP2, opponent HP3/4 and overselection without payment',()=>{
  const state=fixture(),before=structuredClone(state)
  expect(()=>apply(state,command(state,[state.players['player-one'].battleArea[1].card.instanceId]))).toThrow()
  expect(()=>apply(state,command(state,[state.players['player-two'].battleArea[0].card.instanceId]))).toThrow()
  expect(()=>apply(state,command(state,state.players['player-two'].battleArea.map(c=>c.card.instanceId)))).toThrow()
  const hp3=fixture('no-target');expect(()=>apply(hp3,command(hp3,[hp3.players['player-two'].battleArea[1].card.instanceId]))).toThrow();expect(state).toEqual(before)
 })
 it.each(['positive','rested-target'])('skips only actual next Active, preserves existing active/rested status: %s',scenario=>{
  let state=fixture(scenario);const target=state.players['player-two'].battleArea[1],rested=target.rested
  state=apply(state,command(state,[target.card.instanceId]));state=nextMain(state,'player-two')
  expect(state.players['player-two'].battleArea[1].rested).toBe(rested);expect(state.preventCookieActiveNextPhase).toBeUndefined()
  state=nextMain(state,'player-one');state=nextMain(state,'player-two')
  expect(state.players['player-two'].battleArea[1].rested).toBe(false)
 })
})
