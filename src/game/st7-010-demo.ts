import {getAllCardPoolEntries,getCardPoolEntry,hasFlipAbility} from './card-pool'
import {createCard,createOfficialRedStarterDeck} from './starter-deck'
import {createGame} from './setup'
import {applyGameCommand as apply} from './commands'
import type {GameCard,CookieInBattle,PlayerId,GameState} from './types'
export const raw=getCardPoolEntry('ST7-010')
if(!raw)throw Error('Formal original ST7-010 required')
export const fixture=(scenario='skill-positive',prepareOnly=false):GameState=>{
 const counts=new Map<string,number>()
 const card=(number:string,owner:PlayerId):GameCard=>{
  const record=number==='ST7-010'?raw:getCardPoolEntry(number);if(!record)throw Error('Original '+number)
  const key=owner+':'+number,copy=(counts.get(key)??0)+1;if(copy>4)throw Error('Four-copy limit '+key)
  counts.set(key,copy);return createCard(record,owner,copy)
 }
 const filler=(amount:number,owner:PlayerId)=>{
  const result:GameCard[]=[]
  if(!amount)return result
  for(const record of getAllCardPoolEntries()){
   if(record.variant||record.type==='extra'||hasFlipAbility(record))continue
   while((counts.get(owner+':'+record.baseCardNumber)??0)<4&&result.length<amount)result.push(card(record.baseCardNumber,owner))
   if(result.length===amount)return result
  }
  throw Error('Original filler insufficient')
 }
 const battle=(number:string,owner:PlayerId):CookieInBattle=>{
  const c=card(number,owner);if(c.type!=='cookie')throw Error('Original Cookie required')
  return {card:c,hpCards:filler(c.hp,owner),rested:false,battleEntryId:c.instanceId+':entry'}
 }
 let state=createGame({id:'player-one',name:'ST7-010逐卡驗收',deck:createOfficialRedStarterDeck('player-one')},{id:'player-two',name:'原卡對手',deck:createOfficialRedStarterDeck('player-two')},'player-one',cards=>cards)
 state.status='playing';state.phase='main';state.turnNumber=3
 for(const p of Object.values(state.players)){p.deck=[];p.hand=[];p.discardPile=[];p.breakArea=[];p.supportArea=[];p.battleArea=[];p.extraDeck=[];p.stage=null;p.startingCookieSelected=true}
 const own=state.players['player-one'],foe=state.players['player-two']
 own.battleArea=[battle('ST7-010','player-one'),battle(scenario==='skill-once'?'ST1-011':scenario==='skill-no-target'?'BS4-038':'ST6-006','player-one')]
 foe.battleArea=[battle('ST6-006','player-two'),battle('ST1-011','player-two')]
 own.supportArea=['ST2-018','ST2-019','ST2-020'].map(number=>({card:card(number,'player-one'),rested:false}))
 foe.supportArea=[{card:card('ST1-020','player-two'),rested:false}]
 own.hand=[card(scenario==='attack-no-flip'?'ST1-011':scenario==='attack-noncookie'?'ST7-013':'ST6-006','player-one'),card('ST7-013','player-one')]
 if(scenario==='ai-preserve'||scenario==='ai-one-safe'){
  for(let i=0;i<3;i++){const high=card('ST7-003','player-one');if(high.type!=='cookie')throw Error('Original LV3 required');own.breakArea.push(high)}
 }
 for(const owner of ['player-one','player-two'] as const){const p=state.players[owner],used=p.hand.length+p.discardPile.length+p.breakArea.length+p.supportArea.length+p.battleArea.reduce((sum,c)=>sum+c.hpCards.length+1,0);p.deck=filler(60-used,owner)}
 if(scenario.includes('refresh'))own.discardPile.push(...own.deck.splice(1))
 if(scenario==='skill-rested-source'||scenario==='attack-rested-source')own.battleArea[0].rested=true
 if(scenario==='skill-rested-energy')own.supportArea.forEach(s=>{s.rested=true})
 if(scenario==='attack-rested-support')own.supportArea[2].rested=true
 if(scenario==='attack-wrong-energy'){
  const record=getCardPoolEntry('ST1-020');if(!record)throw Error('Original support')
  own.supportArea[2].card=createCard(record,'player-one',4)
 }
 if(scenario==='skill-wrong-phase'||scenario==='attack-wrong-phase')state.phase='support'
 if(scenario==='skill-source4')state.activePlayerId='player-two'
 if(scenario==='ai-preserve'||scenario==='ai-one-safe')own.hand.push(...own.deck.splice(scenario==='ai-preserve'?1:2))
 if(scenario.startsWith('ai-')){
  state=JSON.parse(JSON.stringify(state).replaceAll('player-one','player-swap').replaceAll('player-two','player-one').replaceAll('player-swap','player-two')) as GameState
  if(prepareOnly)return state
  const player=state.players['player-two']
  state=apply(state,{kind:'declare-attack',playerId:'player-two',attackerInstanceId:'player-two-ST7-010-1',targetInstanceId:'player-one-ST6-006-1',supportPaymentIds:player.supportArea.map(s=>s.card.instanceId)})
  state=apply(state,{kind:'skip-trap',playerId:'player-one'})
  for(let i=0;i<12&&state.pendingBattle?.stage==='damage';i++)state=apply(state,{kind:'resolve-next-damage',playerId:'player-one'})
  return apply(state,{kind:'resolve-attack-effect',playerId:'player-two',targetIds:[]})
 }
 if(prepareOnly)return state
 if(scenario==='skill-once')state=apply(state,{kind:'activate-skill',trigger:'activate',playerId:'player-one',sourceInstanceId:own.battleArea[0].card.instanceId,paymentIds:[],discardHandIds:[own.hand[0].instanceId],effectTargets:[[own.battleArea[1].card.instanceId]]})
 if(scenario==='skill-source4'){
  state=apply(state,{kind:'declare-attack',playerId:'player-two',attackerInstanceId:foe.battleArea[1].card.instanceId,targetInstanceId:own.battleArea[0].card.instanceId,supportPaymentIds:[foe.supportArea[0].card.instanceId]})
  state=apply(apply(state,{kind:'skip-trap',playerId:'player-one'}),{kind:'resolve-battle',playerId:'player-two'})
  for(let i=0;i<12&&!(state.activePlayerId==='player-one'&&state.phase==='main');i++)state=apply(state,{kind:'advance-phase',playerId:state.activePlayerId})
 }
 return state
}
