import {getAllCardPoolEntries,getCardPoolEntry,hasFlipAbility} from './card-pool'
import {createCard,createOfficialRedStarterDeck} from './starter-deck'
import {createGame} from './setup'
import {applyGameCommand} from './commands'
import type {CookieInBattle,GameCard,PlayerId,EnergyColor} from './types'
const original=getCardPoolEntry('ST7-009')
if(!original)throw Error('Missing formal original ST7-009')
export const raw=original
export const createSt7009PreviewState = (scenario:string,prepareOnly=false)=>{
 const counts=new Map<string,number>()
 const card=(number:string,owner:PlayerId):GameCard=>{
  const key=owner+':'+number,copy=(counts.get(key)??0)+1
  if(copy>4)throw Error('Original four-copy limit '+key)
  counts.set(key,copy)
  const record=number==='ST7-009'?raw:getCardPoolEntry(number)
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
 let state=createGame({id:'player-one',name:'ST7逐卡驗收',deck:createOfficialRedStarterDeck('player-one')},{id:'player-two',name:'原卡對手',deck:createOfficialRedStarterDeck('player-two')},'player-one',cards=>cards)
 state.status='playing';state.phase='main';state.turnNumber=3
 for(const player of Object.values(state.players)){
  player.deck=[];player.hand=[];player.supportArea=[];player.battleArea=[];player.breakArea=[];player.discardPile=[];player.stage=null;player.startingCookieSelected=true
 }
 const self=state.players['player-one'],foe=state.players['player-two']
 self.battleArea=[battle('ST7-009','player-one'),battle('ST1-011','player-one')]
 const color=(['red','yellow','green','blue','purple','black'].includes(scenario)?scenario:'yellow') as EnergyColor
 const paymentColors:EnergyColor[]=scenario==='mixed'?['red','green','blue']:[color,color,color]
 self.supportArea=paymentColors.map((requested,index)=>{const record=getAllCardPoolEntries().find(row=>!row.variant&&row.type!=='extra'&&!hasFlipAbility(row)&&row.color?.toLowerCase()===requested&&(counts.get('player-one:'+row.baseCardNumber)??0)<4);if(!record)throw Error('Missing original energy '+requested);return {card:card(record.baseCardNumber,'player-one'),rested:scenario==='negative'||scenario==='insufficient'&&index===2}})
 if(scenario==='used')self.supportArea.push(...['ST2-018','ST2-019','ST2-020'].map(number=>({card:card(number,'player-one'),rested:false})))
 foe.battleArea=[battle(scenario==='faint'?'BS6-017':'ST6-006','player-two'),battle('ST1-011','player-two')]
 for(const owner of ['player-one','player-two'] as const){
  const player=state.players[owner],used=player.supportArea.length+player.battleArea.reduce((sum,c)=>sum+1+c.hpCards.length,0)
  player.deck=filler(60-used,owner)
 }
 if(scenario==='wrong-phase')state.phase='support'
 if(scenario==='rested-source')self.battleArea[0].rested=true
 if(prepareOnly)return state
 if(scenario==='used'){
  state=applyGameCommand(state,{kind:'declare-attack',playerId:'player-one',attackerInstanceId:self.battleArea[0].card.instanceId,targetInstanceId:foe.battleArea[0].card.instanceId,supportPaymentIds:self.supportArea.slice(0,3).map(s=>s.card.instanceId)})
  state=applyGameCommand(state,{kind:'skip-trap',playerId:'player-two'})
  state=applyGameCommand(state,{kind:'resolve-battle',playerId:'player-one'})
 }
 return state
}
