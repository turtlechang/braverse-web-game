import type {OfficialCardRecord} from '../cards/types'
import {createSt7012PreviewState} from './st7-012-demo'
import {getCardPoolEntry} from './card-pool'
import {createCard} from './starter-deck'
import {applyGameCommand} from './commands'
import type {GameState,PlayerId} from './types'

const record=getCardPoolEntry('ST7-011')
if(!record)throw Error('Missing formal original ST7-011')
export const raw=record as OfficialCardRecord
export const createSt7011PreviewState=(scenario='positive',prepareOnly=false):GameState=>{
 let state=createSt7012PreviewState('attack-yellow',true)
 const replace=(owner:PlayerId,index:number,original:OfficialCardRecord)=>{
  const player=state.players[owner],cookie=player.battleArea[index],card=createCard(original,owner,1)
  if(card.type!=='cookie')throw Error('Printed Cookie required')
  cookie.card=card;cookie.battleEntryId=card.instanceId+':entry'
  if(card.hp<cookie.hpCards.length)player.deck.push(...cookie.hpCards.splice(card.hp))
  else cookie.hpCards.push(...player.deck.splice(0,card.hp-cookie.hpCards.length))
 }
 const formal=(number:string)=>{const original=getCardPoolEntry(number);if(!original)throw Error('Missing original '+number);return original}
 replace('player-one',0,raw)
 replace('player-one',1,formal(['wrong-name','opponent-witness'].includes(scenario)?'ST6-007':'BS4-038'))
 if(scenario==='opponent-witness')replace('player-two',0,formal('BS4-038'))
 const own=state.players['player-one']
 if(scenario==='rested-witness')own.battleArea[1].rested=true
 if(scenario==='rested-source')own.battleArea[0].rested=true
 if(['no-witness','break-witness','support-witness'].includes(scenario)){
  const witness=own.battleArea.pop();if(!witness)throw Error('Missing original witness')
  own.deck.push(...witness.hpCards)
  if(scenario==='break-witness')own.breakArea.push(witness.card)
  else if(scenario==='support-witness')own.supportArea.push({card:witness.card,rested:false})
  else own.discardPile.push(witness.card)
 }
 if(scenario==='wrong-energy'){
  for(const [index,number]of ['ST1-018','ST1-019','ST1-020'].entries()){
   own.deck.push(own.supportArea[index].card);own.deck.shift()
   own.supportArea[index].card=createCard(formal(number),'player-one',1)
  }
 }
 if(scenario==='rested-energy')own.supportArea.forEach(support=>{support.rested=true})
 if(scenario==='few-energy')own.supportArea.forEach((support,index)=>{support.rested=index>0})
 if(scenario==='wrong-phase')state.phase='support'
 if(scenario==='short-deck')own.discardPile.push(...own.deck.splice(1))
 if(['injured-one-hp','departed-flip'].includes(scenario)){
  replace('player-two',0,formal('ST1-011'))
  const foe=state.players['player-two']
  if(scenario==='departed-flip'){
   const oldHp=foe.battleArea[0].hpCards.pop();if(!oldHp)throw Error('Printed target HP required')
   foe.deck.push(oldHp);foe.deck.shift()
   foe.battleArea[0].hpCards.push(createCard(formal('BS1-002'),'player-two',1))
   const fodder=foe.deck.shift();if(!fodder)throw Error('Original hand cost required');foe.hand.push(fodder)
  }
  foe.deck.shift();foe.supportArea=[{card:createCard(formal('ST1-018'),'player-two',1),rested:false}]
  state.activePlayerId='player-two'
  if(prepareOnly)return state
  state=applyGameCommand(state,{kind:'declare-attack',playerId:'player-two',attackerInstanceId:foe.battleArea[0].card.instanceId,targetInstanceId:own.battleArea[0].card.instanceId,supportPaymentIds:[foe.supportArea[0].card.instanceId]})
  state=applyGameCommand(state,{kind:'skip-trap',playerId:'player-one'})
  state=applyGameCommand(state,{kind:'resolve-battle',playerId:'player-two'})
  for(let i=0;!(state.activePlayerId==='player-one'&&state.phase==='main')&&i<12;i++)state=applyGameCommand(state,{kind:'advance-phase',playerId:state.activePlayerId})
  if(state.activePlayerId!=='player-one'||state.phase!=='main'||state.players['player-one'].battleArea[0].hpCards.length!==1)throw Error('Actual injury/phase parent did not settle')
 }
 if(scenario==='three-hp'){
  replace('player-two',0,formal('BS4-038'))
  if(prepareOnly)return state
  state=applyGameCommand(state,{kind:'declare-attack',playerId:'player-one',attackerInstanceId:own.battleArea[0].card.instanceId,targetInstanceId:state.players['player-two'].battleArea[0].card.instanceId,supportPaymentIds:own.supportArea.slice(0,2).map(s=>s.card.instanceId)})
  state=applyGameCommand(state,{kind:'skip-trap',playerId:'player-two'})
  state=applyGameCommand(state,{kind:'resolve-battle',playerId:'player-one'})
  if(state.players['player-one'].battleArea[0].hpCards.length!==3)throw Error('Actual first Then must produce3HP')
  state=applyGameCommand(state,{kind:'advance-phase',playerId:'player-one'})
  for(let i=0;!(state.activePlayerId==='player-two'&&state.phase==='main')&&i<12;i++)state=applyGameCommand(state,{kind:'advance-phase',playerId:state.activePlayerId})
  state=applyGameCommand(state,{kind:'advance-phase',playerId:'player-two'})
  for(let i=0;!(state.activePlayerId==='player-one'&&state.phase==='main')&&i<12;i++)state=applyGameCommand(state,{kind:'advance-phase',playerId:state.activePlayerId})
  if(state.activePlayerId!=='player-one'||state.phase!=='main')throw Error('Actual second turn parent did not settle')
 }
 return state
}
