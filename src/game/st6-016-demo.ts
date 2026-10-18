import {createSt6012PreviewState} from './st6-012-demo'
import {createCard} from './starter-deck'
import {getCardPoolEntry} from './card-pool'
import {applyGameCommand as apply} from './commands'
const original=getCardPoolEntry('ST6-016')
if(!original)throw Error('Missing original formal ST6-016 record')
export const raw=original
export const createSt6016PreviewState=(scenario='positive')=>{
 let state=createSt6012PreviewState(scenario==='negative'?'negative':scenario==='wrong-color'?'wrong-color':scenario==='wrong-phase'?'wrong-phase':'positive')
 const own=state.players['player-one']
 own.deck.shift();own.hand=[createCard(raw,'player-one',1),own.deck.shift()!]
 if(scenario==='no-discard')own.discardPile.push(own.hand.pop()!)
 if(scenario==='faint'||scenario==='both-faint'){
  state=apply(state,{kind:'declare-attack',playerId:'player-one',attackerInstanceId:own.battleArea[0].card.instanceId,targetInstanceId:state.players['player-two'].battleArea[1].card.instanceId,supportPaymentIds:own.supportArea.slice(0,2).map(s=>s.card.instanceId)})
  state=apply(state,{kind:'skip-trap',playerId:'player-two'})
  state=apply(state,{kind:'resolve-battle',playerId:'player-one'})
  for(let i=0;i<12&&!(state.turnNumber>3&&state.activePlayerId==='player-one'&&state.phase==='main');i++)state=apply(state,{kind:'advance-phase',playerId:state.activePlayerId})
  if(state.activePlayerId!=='player-one'||state.phase!=='main')throw Error('Missing next own main')
 }
 if(scenario==='both-faint'){
  const foe=state.players['player-two'],target=foe.battleArea[0],record=getCardPoolEntry('ST6-005')
  if(!record)throw Error('Missing original Agar Agar')
  const card=createCard(record,'player-two',1)
  if(card.type!=='cookie'||card.hp!==1)throw Error('Wrong printed Agar Agar')
  target.card=card;target.battleEntryId=card.instanceId+':entry';foe.discardPile.push(...target.hpCards.splice(1))
 }
 if(scenario==='reveal'){
  const target=state.players['player-two'].battleArea[1],record=getCardPoolEntry('ST6-006')
  if(!record?.flipText)throw Error('Missing original Cherry FLIP')
  target.hpCards[target.hpCards.length-1]=createCard(record,'player-two',1)
 }
 return state
}
