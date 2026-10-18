import document from '../../data/candidates/st6-st10/official-st7.en.json'
import {createSt6012PreviewState as foundation} from './st6-012-demo'
import {zones} from './st7-014-demo'
import {createCard} from './starter-deck'
import {getCardPoolEntry} from './card-pool'
import {applyGameCommand as apply} from './commands'
import type {OfficialCardRecord} from '../cards/types'
import type {GameState,GameCard,PlayerId} from './types'
import type {GameCommand} from './commands'
const raw=(getCardPoolEntry('ST7-018')??(document.cards as OfficialCardRecord[]).find(c=>c.cardNumber==='ST7-018')) as OfficialCardRecord|undefined
if(!raw)throw Error('Original ST7-018 required')
/** Candidate-only original-card fixture; production routes stay isolated until promotion. */
export const fixture=(scenario='positive',prepareOnly=false):GameState=>{
 if(scenario.startsWith('ai-')){
  const swap=<T,>(value:T):T=>JSON.parse(JSON.stringify(value).replaceAll('player-one','player-swap').replaceAll('player-two','player-one').replaceAll('player-swap','player-two')) as T
  return swap(fixture(scenario.slice(3),prepareOnly))
 }
 let state=foundation('positive',scenario==='lethal'?'BS12-076':'ST6-002')
 const own=state.players['player-one'],foe=state.players['player-two']
 const original=(id:string,owner:PlayerId):GameCard=>{
  const record=id==='ST7-018'?raw:getCardPoolEntry(id);if(!record)throw Error('Original '+id)
  const used=new Set(zones(state,owner).map(c=>c.instanceId))
  for(let copy=1;copy<=4;copy++){const card=createCard(record,owner,copy);if(!used.has(card.instanceId))return card}
  throw Error('Four-copy limit '+id)
 }
 own.deck.shift();own.hand=[original('ST7-018','player-one')];own.name='ST7-018 原卡逐卡驗收'
 own.supportArea[2].card=original('ST2-019','player-one')
 if(scenario==='one-cookie'){
  const moved=own.battleArea.shift();if(!moved)throw Error('Original Cookie')
  own.discardPile.push(moved.card,...moved.hpCards)
 }
 if(scenario==='rested-energy')own.supportArea[2].rested=true
 if(scenario==='wrong-energy')own.supportArea[2].card=original('ST1-020','player-one')
 if(scenario==='one-yellow')own.supportArea[3].card=original('ST1-020','player-one')
 if(scenario==='fatal-refresh'){
  for(let count=0;count<3;count++){own.deck.shift();const card=original('BS12-076','player-one');if(card.type!=='cookie')throw Error('Original LV3 Cookie');own.breakArea.push(card)}
 }
 if(scenario==='short-deck'||scenario==='fatal-refresh')own.discardPile.push(...own.deck.splice(1))
 if(scenario==='empty-deck')own.discardPile.push(...own.deck.splice(0))
 if(scenario==='prevented'){
  const source=original('BS9-035','player-two');if(source.type!=='cookie')throw Error('Original Truthless Recluse')
  const previous=foe.battleArea[0]
  while(previous.hpCards.length>source.hp)foe.deck.push(previous.hpCards.pop()!)
  foe.battleArea[0]={...previous,card:source,battleEntryId:source.instanceId+':entry'}
  const cost=foe.deck.shift();if(!cost)throw Error('Original discard cost');foe.hand=[cost]
 }
 if(scenario==='main'||scenario==='wrong-phase'){if(scenario==='wrong-phase')state.phase='support';return state}
 state.activePlayerId=scenario==='rested'?'player-one':'player-two'
 if(prepareOnly)return state
 if(scenario==='prevented')state=apply(state,{kind:'activate-skill',playerId:'player-two',trigger:'activate',sourceInstanceId:foe.battleArea[0].card.instanceId,paymentIds:[],discardHandIds:[foe.hand[0].instanceId]})
 if(scenario==='rested'){
  state=apply(state,{kind:'declare-attack',playerId:'player-one',attackerInstanceId:own.battleArea[0].card.instanceId,targetInstanceId:foe.battleArea[1].card.instanceId,supportPaymentIds:own.supportArea.slice(0,2).map(s=>s.card.instanceId)})
  state=apply(state,{kind:'skip-trap',playerId:'player-two'})
  state=apply(state,{kind:'resolve-battle',playerId:'player-one'})
  for(let i=0;i<8&&!(state.activePlayerId==='player-two'&&state.phase==='main');i++)state=apply(state,{kind:'advance-phase',playerId:state.activePlayerId})
  if(state.activePlayerId!=='player-two'||state.phase!=='main')throw Error('Actual opponent main not reached')
 }
 return apply(state,{kind:'declare-attack',playerId:'player-two',attackerInstanceId:state.players['player-two'].battleArea[1].card.instanceId,targetInstanceId:state.players['player-one'].battleArea.at(-1)!.card.instanceId,supportPaymentIds:state.players['player-two'].supportArea.slice(0,3).map(s=>s.card.instanceId)})
}
export const command=(state:GameState,targets?:string[]):GameCommand=>({kind:'play-trap',playerId:'player-one',trapInstanceId:state.players['player-one'].hand.find(c=>c.id==='ST7-018')!.instanceId,paymentIds:state.players['player-one'].supportArea.slice(2,4).map(s=>s.card.instanceId),targetIds:[],effectTargets:[targets??state.players['player-one'].battleArea.map(c=>c.card.instanceId)]})
