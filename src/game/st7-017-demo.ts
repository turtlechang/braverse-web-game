import {createSt6012PreviewState as foundation} from './st6-012-demo'
import {zones} from './st7-014-demo'
import {createCard} from './starter-deck'
import {getCardPoolEntry} from './card-pool'
import {applyGameCommand as apply} from './commands'
import type {GameState,GameCard,PlayerId} from './types'
import type {GameCommand} from './commands'
export const fixture=(scenario='break4',prepareOnly=false):GameState=>{
 if(scenario.startsWith('ai-')){
  const state=JSON.parse(JSON.stringify(fixture(scenario.slice(3),true)).replaceAll('player-one','player-swap').replaceAll('player-two','player-one').replaceAll('player-swap','player-two')) as GameState
  if(prepareOnly)return state
  return apply(state,{kind:'declare-attack',playerId:'player-one',attackerInstanceId:state.players['player-one'].battleArea[1].card.instanceId,targetInstanceId:state.players['player-two'].battleArea[1].card.instanceId,supportPaymentIds:state.players['player-one'].supportArea.slice(0,3).map(s=>s.card.instanceId)})
 }
 const state=foundation('positive'),own=state.players['player-one'],foe=state.players['player-two']
 const original=(id:string,owner:PlayerId):GameCard=>{
  const raw=getCardPoolEntry(id);if(!raw)throw Error('Original '+id)
  const used=new Set(zones(state,owner).map(c=>c.instanceId))
  for(let copy=1;copy<=4;copy++){const card=createCard(raw,owner,copy);if(!used.has(card.instanceId))return card}
  throw Error('Four-copy limit '+id)
 }
 own.deck.shift();own.hand=[original('ST7-017','player-one')];own.name='ST7-017 原卡逐卡驗收'
 const addBreak=(id:string,owner:PlayerId)=>{const card=original(id,owner);if(card.type!=='cookie')throw Error('Original Cookie');state.players[owner].deck.shift();state.players[owner].breakArea.push(card)}
 if(scenario!=='break0')addBreak('ST7-010',scenario==='opponent-break4'?'player-two':'player-one')
 if(!['break0','break3'].includes(scenario))addBreak('ST1-011',scenario==='opponent-break4'?'player-two':'player-one')
 if(scenario==='break5')addBreak('ST1-011','player-one')
 if(scenario==='hand-level4'){own.hand.push(...own.breakArea);own.breakArea=[]}
 if(scenario==='trash-level4'){own.discardPile.push(...own.breakArea);own.breakArea=[]}
 if(scenario==='rested-energy')own.supportArea[3].rested=true
 if(scenario==='wrong-energy')own.supportArea[3].card=original('ST1-020','player-one')
 if(scenario==='main'||scenario==='wrong-phase'){if(scenario==='wrong-phase')state.phase='support';return state}
 state.activePlayerId='player-two'
 for(const owner of ['player-one','player-two'] as const){const cards=zones(state,owner);if(cards.length!==60||new Set(cards.map(c=>c.instanceId)).size!==60)throw Error('Original sixty');for(const card of cards)if(cards.filter(c=>c.id===card.id).length>4)throw Error('Four copies');for(const battle of state.players[owner].battleArea)if(battle.hpCards.length!==battle.card.hp)throw Error('Original printed HP')}
 if(prepareOnly)return state
 return apply(state,{kind:'declare-attack',playerId:'player-two',attackerInstanceId:foe.battleArea[1].card.instanceId,targetInstanceId:own.battleArea[1].card.instanceId,supportPaymentIds:foe.supportArea.slice(0,3).map(s=>s.card.instanceId)})
}
export const command=(state:GameState,targets?:string[]):GameCommand=>({kind:'play-trap',playerId:'player-one',trapInstanceId:state.players['player-one'].hand[0].instanceId,paymentIds:[state.players['player-one'].supportArea[3].card.instanceId],targetIds:[],effectTargets:[targets??[state.players['player-two'].battleArea[1].card.instanceId]]})
