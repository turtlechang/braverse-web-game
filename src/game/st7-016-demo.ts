import {fixture as foundation} from './st7-010-demo'
import {zones} from './st7-014-demo'
import {getCardPoolEntry} from './card-pool'
import {createCard} from './starter-deck'
import {applyGameCommand as apply} from './commands'
import type {GameCommand} from './commands'
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
 const raw=getCardPoolEntry('ST7-016')
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
  const raw=getCardPoolEntry(id)
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
