import {getAllCardPoolEntries,getCardPoolEntry,hasFlipAbility} from './card-pool'
import {createCard,createOfficialRedStarterDeck} from './starter-deck'
import {createGame} from './setup'
import {applyGameCommand} from './commands'
import type {CookieInBattle,GameCard,PlayerId} from './types'
const original=getCardPoolEntry('ST7-012')
if(!original)throw Error('Missing formal original ST7-012')
export const raw=original
export const createSt7012PreviewState=(scenario='positive',prepareOnly=false)=>{
 const counts=new Map<string,number>()
 const card=(number:string,owner:PlayerId):GameCard=>{
  const key=owner+':'+number,copy=(counts.get(key)??0)+1
  if(copy>4)throw Error('Original four-copy limit '+key)
  counts.set(key,copy)
  const record=number==='ST7-012'?raw:getCardPoolEntry(number)
  if(!record)throw Error('Missing original '+number)
  return createCard(record,owner,copy)
 }
 const filler=(count:number,owner:PlayerId)=>{
  const cards:GameCard[]=[];if(count===0)return cards
  for(const record of getAllCardPoolEntries()){
   if(record.variant||record.type==='extra'||hasFlipAbility(record)||(counts.get(owner+':'+record.baseCardNumber)??0)>=4)continue
   cards.push(card(record.baseCardNumber,owner));if(cards.length===count)return cards
  }
  throw Error('Insufficient original filler')
 }
 const battle=(number:string,owner:PlayerId):CookieInBattle=>{
  const original=card(number,owner);if(original.type!=='cookie')throw Error('Original Cookie required')
  return {card:original,hpCards:filler(original.hp,owner),rested:false,battleEntryId:original.instanceId+':entry'}
 }
 let state=createGame({id:'player-one',name:'ST7-012逐卡驗收',deck:createOfficialRedStarterDeck('player-one')},{id:'player-two',name:'原卡對手',deck:createOfficialRedStarterDeck('player-two')},'player-one',cards=>cards)
 state.status='playing';state.phase='main';state.turnNumber=3
 for(const player of Object.values(state.players)){
  player.deck=[];player.hand=[];player.supportArea=[];player.battleArea=[];player.breakArea=[];player.discardPile=[];player.extraDeck=[];player.stage=null;player.startingCookieSelected=true
 }
 const own=state.players['player-one'],foe=state.players['player-two'],attack=scenario.startsWith('attack')
 own.battleArea=[battle('ST7-012','player-one'),battle('ST1-011','player-one')]
 own.supportArea=['ST2-018','ST2-019','ST2-020'].map(number=>({card:card(number,'player-one'),rested:false}))
 foe.battleArea=[battle(attack?(scenario==='attack-faint'?'BS6-017':'ST6-006'):'ST1-011','player-two')]
 if(!attack){
  state.activePlayerId='player-two'
  if(['second-attack','second-response'].includes(scenario))foe.battleArea.push(battle('ST1-011','player-two'))
  foe.supportArea=['ST1-018','ST1-019'].map(number=>({card:card(number,'player-two'),rested:false}))
 }
 const neutralIds:Record<string,string>={'attack-red':'ST1-020','attack-green':'ST3-016','attack-blue':'ST4-020','attack-purple':'ST5-020','attack-black':'ST6-020'}
 if(neutralIds[scenario])own.supportArea[1]={card:card(neutralIds[scenario],'player-one'),rested:false}
 if(['wrong-color','attack-wrong-color'].includes(scenario))own.supportArea=['ST1-018','ST1-019','ST1-020'].map(number=>({card:card(number,'player-one'),rested:false}))
 if(['rested-energy','attack-rested-energy'].includes(scenario))own.supportArea.forEach(support=>{support.rested=true})
 if(scenario==='attack-insufficient')own.supportArea.forEach((support,index)=>{support.rested=index>0})
 if(['rested-source','attack-rested-source'].includes(scenario))own.battleArea[0].rested=true
 if(scenario==='no-energy')own.supportArea=[]
 if(scenario==='wrong-zone'){const source=own.battleArea.shift();if(!source)throw Error('Original source');own.discardPile.push(source.card,...source.hpCards)}
 for(const owner of ['player-one','player-two'] as const){
  const player=state.players[owner],used=player.hand.length+player.discardPile.length+player.supportArea.length+player.battleArea.reduce((sum,cookie)=>sum+1+cookie.hpCards.length,0)
  player.deck=filler(60-used,owner)
 }
 if(scenario==='attack-wrong-phase')state.phase='support'
 if(prepareOnly||attack)return state
 state=applyGameCommand(state,{kind:'declare-attack',playerId:'player-two',attackerInstanceId:foe.battleArea[0].card.instanceId,targetInstanceId:own.battleArea[scenario==='already-target'?0:own.battleArea.length-1].card.instanceId,supportPaymentIds:[foe.supportArea[0].card.instanceId]})
 if(scenario==='second-response'){
  state=applyGameCommand(state,{kind:'play-blocker',playerId:'player-one',sourceInstanceId:own.battleArea[0].card.instanceId,paymentIds:[own.supportArea[0].card.instanceId]})
  state=applyGameCommand(state,{kind:'resolve-battle',playerId:'player-two'})
  state=applyGameCommand(state,{kind:'declare-attack',playerId:'player-two',attackerInstanceId:foe.battleArea[1].card.instanceId,targetInstanceId:own.battleArea[1].card.instanceId,supportPaymentIds:[foe.supportArea[1].card.instanceId]})
 }
 return state
}
