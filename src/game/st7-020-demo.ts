import document from '../../data/candidates/st6-st10/official-st7.en.json'
import type {OfficialCardRecord} from '../cards/types'
import {fixture as foundation} from './st7-014-demo'
import {getCardPoolEntry} from './card-pool'
import {createCard} from './starter-deck'
import {applyGameCommand as apply} from './commands'
import {commandFromLogEntry} from './replay'
import type {GameCard,GameState,PlayerId} from './types'
export const raw=(getCardPoolEntry('ST7-020')??(document.cards as OfficialCardRecord[]).find(c=>c.cardNumber==='ST7-020')) as OfficialCardRecord
if(!raw)throw Error('Original Forest of Life required')
const owner='player-one',foe='player-two'
const swap=<T,>(value:T):T=>JSON.parse(JSON.stringify(value).replaceAll('player-one','player-swap').replaceAll('player-two','player-one').replaceAll('player-swap','player-two')) as T
export const zones=(state:GameState,id:PlayerId):GameCard[]=>{
 const p=state.players[id]
 return [...p.deck,...p.hand,...p.discardPile,...p.breakArea,...p.supportArea.map(s=>s.card),...p.battleArea.flatMap(c=>[c.card,...c.hpCards,...(c.equippedCards??[])]),...(p.stage?[p.stage.card]:[])]
}
export const fixture=(scenario='positive',prepareOnly=false):GameState=>{
 if(scenario.startsWith('ai-')){
  const base=scenario.slice(3)
  let state=swap(fixture(base,true))
  if(prepareOnly)return state
  for(const entry of fixture(base).commandLog??[]){const command=commandFromLogEntry(entry);if(!command)throw Error('Actual parent command required');state=apply(state,swap(command))}
  return state
 }
 let state=foundation('battle')
 const own=state.players[owner],other=state.players[foe]
 const original=(number:string,id:PlayerId=owner):GameCard=>{
  const record=number==='ST7-020'?raw:getCardPoolEntry(number)
  if(!record)throw Error('Original '+number)
  const used=new Set(zones(state,id).map(c=>c.instanceId))
  for(let copy=1;copy<=4;copy++){const card=createCard(record,id,copy);if(!used.has(card.instanceId))return card}
  throw Error('Original four-copy limit '+number)
 }
 own.hand[0]=original('ST7-020')
 own.name='ST7-020 原卡逐卡驗收'
 if(scenario==='rested-target')own.battleArea[1].rested=true
 if(scenario==='rested-energy')own.supportArea[2].rested=true
 if(scenario==='wrong-energy')own.supportArea[2].card=original('ST1-020')
 if(scenario==='placement-rested')own.supportArea[1].rested=true
 if(scenario==='placement-wrong-energy')own.supportArea[1].card=original('ST1-020')
 if(scenario==='wrong-phase')state.phase='support'
 if(scenario==='fatal-refresh')for(let i=0;i<3;i++){
  const card=original('ST7-010');if(card.type!=='cookie')throw Error('Original LV3 Cookie required')
  own.deck.shift();own.breakArea.push(card)
 }
 if(scenario==='last-deck'||scenario==='fatal-refresh')own.discardPile.push(...own.deck.splice(2))
 if(scenario==='short-deck')own.discardPile.push(...own.deck.splice(3))
 if(scenario==='opponent-only'){
  const card=original('ST7-004');if(card.type!=='cookie')throw Error('Original Fig required')
  const previous=own.battleArea[0];while(previous.hpCards.length>card.hp)own.deck.push(previous.hpCards.pop()!)
  own.battleArea[0]={card,hpCards:previous.hpCards,rested:false,battleEntryId:card.instanceId+':entry'}
  other.deck.shift();other.hand.push(original('ST7-018',foe))
  other.supportArea[0].card=original('ST2-019',foe)
  other.deck.shift();other.supportArea.push({card:original('ST2-020',foe),rested:false})
 }
 for(const id of [owner,foe] as const){
  const cards=zones(state,id)
  if(cards.length!==60||new Set(cards.map(c=>c.instanceId)).size!==60)throw Error('Original sixty-card identities')
  for(const card of cards)if(cards.filter(c=>c.id===card.id).length>4)throw Error('Original four-copy limit')
  for(const cookie of state.players[id].battleArea)if(cookie.hpCards.length!==cookie.card.hp)throw Error('Original printed initial HP')
 }
 if(prepareOnly||['wrong-phase','placement-rested','placement-wrong-energy'].includes(scenario))return state
 const place=()=>{state=apply(state,{kind:'play-stage',playerId:owner,instanceId:state.players[owner].hand.find(c=>c.id==='ST7-020')!.instanceId,paymentIds:[state.players[owner].supportArea[1].card.instanceId]})}
 const gain=(target:number|null)=>{state=apply(state,{kind:'play-item',playerId:owner,instanceId:state.players[owner].hand.find(c=>c.id==='ST7-014')!.instanceId,paymentIds:[state.players[owner].supportArea[0].card.instanceId],effectTargets:[target===null?[]:[state.players[owner].battleArea[target].card.instanceId]]})}
 if(scenario==='opponent-only'){
  place()
  state=apply(state,{kind:'declare-attack',playerId:owner,attackerInstanceId:state.players[owner].battleArea[0].card.instanceId,targetInstanceId:state.players[foe].battleArea[0].card.instanceId,supportPaymentIds:[state.players[owner].supportArea[0].card.instanceId]})
  state=apply(state,{kind:'play-trap',playerId:foe,trapInstanceId:state.players[foe].hand.find(c=>c.id==='ST7-018')!.instanceId,paymentIds:state.players[foe].supportArea.map(s=>s.card.instanceId),targetIds:[],effectTargets:[state.players[foe].battleArea.map(c=>c.card.instanceId)]})
  return apply(state,{kind:'resolve-battle',playerId:owner})
 }
 if(scenario==='after-placement')place()
 if(scenario==='zero-gain')gain(null)
 else if(scenario!=='no-gain')gain(scenario==='rested-target'?1:0)
 if(scenario==='prior-turn')for(let i=0;i<16&&!(state.turnNumber>=5&&state.activePlayerId===owner&&state.phase==='main');i++)state=apply(state,{kind:'advance-phase',playerId:state.activePlayerId})
 if(scenario==='place')return state
 if(scenario!=='after-placement')place()
 if(scenario==='rested-stage'){
  state=apply(state,{kind:'begin-activate-stage',playerId:owner,paymentIds:[state.players[owner].supportArea[2].card.instanceId]})
  if(state.pendingAbilityEffect)state=apply(state,{kind:'resolve-ability-effect',playerId:owner,targetIds:[]})
  if(state.pendingDrawUpTo)state=apply(state,{kind:'resolve-draw-up-to',playerId:owner,drawCount:0})
 }
 if(scenario==='activation-phase')state=apply(state,{kind:'advance-phase',playerId:owner})
 return state
}
export const command=(state:GameState,id:PlayerId=owner)=>({kind:'begin-activate-stage' as const,playerId:id,paymentIds:[state.players[id].supportArea[2].card.instanceId]})
