import document from '../../data/candidates/st6-st10/official-st7.en.json'
import {createSt6012PreviewState as foundation} from './st6-012-demo'
import {zones} from './st7-014-demo'
import {getCardPoolEntry} from './card-pool'
import {createCard} from './starter-deck'
import {applyGameCommand as apply} from './commands'
import {commandFromLogEntry} from './replay'
import type {OfficialCardRecord} from '../cards/types'
import type {GameCard,GameState,PlayerId} from './types'
import type {GameCommand} from './commands'
const raw=(getCardPoolEntry('ST7-019')??document.cards.find(c=>c.cardNumber==='ST7-019')) as OfficialCardRecord|undefined
if(!raw)throw Error('Original ST7-019 required')
let base:GameState|undefined
/** Original sixty-card prepared fixture, isolated from production routes until promotion. */
export const fixture=(scenario='positive',prepareOnly=false):GameState=>{
 if(scenario.startsWith('ai-')){
  const swap=<T,>(value:T):T=>JSON.parse(JSON.stringify(value).replaceAll('player-one','player-swap').replaceAll('player-two','player-one').replaceAll('player-swap','player-two')) as T
  let state=swap(fixture(scenario.slice(3),true))
  if(prepareOnly)return state
  for(const entry of fixture(scenario.slice(3)).commandLog??[]){
   const command=commandFromLogEntry(entry);if(!command)throw Error('Actual parent command')
   state=apply(state,swap(command))
  }
  return state
 }
 base??=foundation('positive');let state=structuredClone(base)
 const own=state.players['player-one'],foe=state.players['player-two']
 const original=(id:string,owner:PlayerId):GameCard=>{
  const record=id==='ST7-019'?raw:getCardPoolEntry(id);if(!record)throw Error('Original '+id)
  const used=new Set(zones(state,owner).map(c=>c.instanceId))
  for(let copy=1;copy<=4;copy++){const card=createCard(record,owner,copy);if(!used.has(card.instanceId))return card}
  throw Error('Four-copy limit '+id)
 }
 const add=(id:string,owner:PlayerId,zone:'hand'|'breakArea')=>{
  const card=original(id,owner);if(!state.players[owner].deck.shift())throw Error('Original replacement card')
  if(zone==='hand')state.players[owner].hand.push(card)
  else{if(card.type!=='cookie')throw Error('Cookie Break cost');state.players[owner].breakArea.push(card)}
  return card
 }
 const replaceBattle=(owner:PlayerId,index:number,id:string)=>{
  const card=original(id,owner);if(card.type!=='cookie')throw Error('Original battle Cookie')
  const p=state.players[owner],previous=p.battleArea[index]
  while(previous.hpCards.length>card.hp)p.deck.push(previous.hpCards.pop()!)
  while(previous.hpCards.length<card.hp){const hp=p.deck.shift();if(!hp)throw Error('Original HP');previous.hpCards.push(hp)}
  p.battleArea[index]={...previous,card,battleEntryId:card.instanceId+':entry'}
 }
 replaceBattle('player-one',0,'ST7-004')
 replaceBattle('player-two',0,'BS12-061')
 own.supportArea[2].card=original('ST2-019','player-one');own.name='ST7-019 原卡逐卡驗收'
 for(const id of ['ST7-019','ST7-004','ST7-007','BS12-076','ST1-011',scenario==='safe-alternative'?'ST2-020':'ST6-016'])add(id,'player-one','hand')
 if(scenario==='no-cookie'){const cookies=own.hand.filter(c=>c.type==='cookie');own.hand=own.hand.filter(c=>c.type!=='cookie');own.deck.push(...cookies)}
 if(scenario==='rested-energy')own.supportArea.slice(2).forEach(s=>{s.rested=true})
 if(scenario==='wrong-energy')for(const index of [2,3])own.supportArea[index].card=original('ST1-020','player-one')
 const breakLevel=scenario==='break7'?7:scenario==='break8'?8:['cost-loss','mutual-win','all-fatal','safe-alternative'].includes(scenario)?9:0
 if(breakLevel){for(let i=0;i<Math.floor(breakLevel/3);i++)add('BS12-076','player-one','breakArea');if(breakLevel%3)add(breakLevel%3===1?'ST7-004':'ST7-007','player-one','breakArea')}
 if(['mutual-win','winning','break7','break8','safe-alternative'].includes(scenario))for(let i=0;i<3;i++)add('BS12-076','player-two','breakArea')
 if(scenario==='main'||scenario==='wrong-phase'){if(scenario==='wrong-phase')state.phase='support';return state}
 state.activePlayerId='player-one'
 if(prepareOnly)return state
 // Real ordinary1 damage makes the original2HP opponent publicly vulnerable.
 state=apply(state,{kind:'declare-attack',playerId:'player-one',attackerInstanceId:own.battleArea[0].card.instanceId,targetInstanceId:foe.battleArea[0].card.instanceId,supportPaymentIds:[own.supportArea[0].card.instanceId]})
 state=apply(state,{kind:'skip-trap',playerId:'player-two'})
 state=apply(state,{kind:'resolve-battle',playerId:'player-one'})
 for(let i=0;i<8&&!(state.activePlayerId==='player-two'&&state.phase==='main');i++)state=apply(state,{kind:'advance-phase',playerId:state.activePlayerId})
 if(state.activePlayerId!=='player-two'||state.phase!=='main')throw Error('Actual opponent main required')
 return apply(state,{kind:'declare-attack',playerId:'player-two',attackerInstanceId:state.players['player-two'].battleArea[1].card.instanceId,targetInstanceId:state.players['player-one'].battleArea[1].card.instanceId,supportPaymentIds:state.players['player-two'].supportArea.slice(0,3).map(s=>s.card.instanceId)})
}
export const command=(state:GameState,targets?:string[],costId='ST7-004'):GameCommand=>({kind:'play-trap',playerId:'player-one',trapInstanceId:state.players['player-one'].hand.find(c=>c.id==='ST7-019')!.instanceId,paymentIds:[state.players['player-one'].supportArea[2].card.instanceId],handToBreakIds:[state.players['player-one'].hand.find(c=>c.id===costId)!.instanceId],targetIds:[],effectTargets:[targets??[state.players['player-two'].battleArea[0].card.instanceId]]})
