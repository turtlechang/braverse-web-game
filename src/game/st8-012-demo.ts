import document from '../../data/candidates/st6-st10/official-st8.en.json'
import type {OfficialCardRecord} from '../cards/types'
import {getAllCardPoolEntries,getCardPoolEntry,hasFlipAbility} from './card-pool'
import {createCard,createOfficialRedStarterDeck} from './starter-deck'
import {createGame} from './setup'
import {applyGameCommand} from './commands'
import type {CookieInBattle,GameCard,GameState,PlayerId} from './types'

const required=<T,>(value:T|null|undefined,label:string):T=>{
 if(value===undefined||value===null)throw Error(`Missing ${label}`)
 return value
}
export const raw:OfficialCardRecord=required(getCardPoolEntry('ST8-012')??(document.cards as OfficialCardRecord[]).find(c=>c.cardNumber==='ST8-012'),'original Windcatcher')
/** Source inventory, not a ruling: printed “an Item card” has no owner qualifier.
 * Fixtures follow the project's existing own itemsActivatedThisTurn semantics.
 * Then G is normal active Support payment; source Cookie never supplies energy.
 * No fixture contains more than two battle Cookies or invents printed HP.
 */
export const st8012SourceIds=['ST8-012','ST8-005','BS2-058','BS11-052','ST1-016','ST1-018','ST3-019','ST1-011','BS6-017','ST6-003','ST1-005','ST2-020','ST3-016','ST3-020'] as const
export const st8012Scenarios=['positive','no-item','item-support','opponent-item','previous-item','no-hand',
 'then-no-green','then-wrong-color','then-rested','rested-source','wrong-phase','wrong-turn',
 'wind-purple','wind-other-green','wind-rested','wind-hand','wind-support','wind-deck','wind-opponent','wind-break','wind-trash','wrong-name',
 'damage-faint','damage-mandatory-replacement','last-deck','damaged-wind','play','attack','attack-no-green','attack-rested-source','attack-wrong-phase'] as const

export const createSt8012PreviewState=(scenario='positive',prepareOnly=false):GameState=>{
 if(!st8012Scenarios.some(s=>s===scenario))throw Error(`Unknown ST8-012 scenario ${scenario}`)
 const copies=new Map<string,number>(),names=new Map<string,number>()
 const card=(id:string,owner:PlayerId):GameCard=>{
  const record=id==='ST8-012'?raw:required(getCardPoolEntry(id),id)
  const key=`${owner}:${record.baseCardNumber||record.cardNumber}`,copy=(copies.get(key)??0)+1,nameKey=`${owner}:${record.name}`
  if(copy>4||(names.get(nameKey)??0)>=4)throw Error(`Four-copy/name resource limit ${key}`)
  copies.set(key,copy);names.set(nameKey,(names.get(nameKey)??0)+1)
  return createCard(record,owner,copy)
 }
 const reserved=new Set<string>(st8012SourceIds)
 const filler=(count:number,owner:PlayerId):GameCard[]=>{
  const result:GameCard[]=[]
  if(count===0)return result
  for(const record of getAllCardPoolEntries()){
   if(!record.flags.enabled||record.flags.hidden||record.flags.extra||record.variant||record.type==='extra'||record.type==='unknown'||hasFlipAbility(record)||reserved.has(record.poolId)||record.name==='Wind Archer Cookie'||(copies.get(`${owner}:${record.poolId}`)??0)>=4||(names.get(`${owner}:${record.name}`)??0)>=4)continue
   result.push(card(record.poolId,owner));if(result.length===count)return result
  }
  throw Error('Insufficient original resources')
 }
 const battle=(id:string,owner:PlayerId):CookieInBattle=>{
  const value=card(id,owner);if(value.type!=='cookie')throw Error(`Cookie required ${id}`)
  return {card:value,hpCards:filler(value.hp,owner),rested:false,battleEntryId:`${value.instanceId}:entry`}
 }
 let state=createGame({id:'player-one',name:'ST8-012逐卡驗收',deck:createOfficialRedStarterDeck('player-one')},
  {id:'player-two',name:'原卡對手',deck:createOfficialRedStarterDeck('player-two')},'player-one',cards=>cards)
 state.status='playing';state.phase='main';state.turnNumber=3
 for(const player of Object.values(state.players)){
  player.deck=[];player.hand=[];player.battleArea=[];player.supportArea=[];player.discardPile=[];player.breakArea=[];player.extraDeck=[];player.stage=null;player.startingCookieSelected=true
 }
 const own=state.players['player-one'],foe=state.players['player-two'],attack=scenario.startsWith('attack')
 own.battleArea=[battle('ST8-012','player-one'),battle(scenario==='wind-purple'?'BS2-058':scenario==='wind-other-green'?'BS11-052':scenario==='wrong-name'?'ST1-011':'ST8-005','player-one')]
 own.hand=[card('ST1-016','player-one')]
 if(scenario!=='no-hand')own.hand.push(card('ST1-011','player-one'))
 own.supportArea=['ST1-018','ST1-018','ST3-019'].map(id=>({card:card(id,'player-one'),rested:false}))
 foe.battleArea=[battle(['damage-faint','damage-mandatory-replacement'].includes(scenario)?'BS6-017':scenario==='damaged-wind'?'ST6-003':'ST1-011','player-two')]
 if(scenario!=='damage-mandatory-replacement')foe.battleArea.push(battle('ST1-005','player-two'))
 foe.hand=[card('ST1-011','player-two')]
 foe.supportArea=['ST1-018','ST2-020','ST3-016'].map(id=>({card:card(id,'player-two'),rested:false}))
 if(scenario.startsWith('wind-')&&['hand','support','deck','opponent','break','trash'].includes(scenario.slice(5))){
  const wind=required(own.battleArea.pop(),'original Wind');own.deck.push(...wind.hpCards)
  if(scenario==='wind-hand')own.hand.push(wind.card)
  if(scenario==='wind-support')own.supportArea.push({card:wind.card,rested:false})
  if(scenario==='wind-deck')own.deck.push(wind.card)
  if(scenario==='wind-break')own.breakArea.push(wind.card)
  if(scenario==='wind-trash')own.discardPile.push(wind.card)
  if(scenario==='wind-opponent'){
   // Cross-owner resources are rebuilt with their actual owner, not moved with a false instance prefix.
   own.deck.push(wind.card)
   const displaced=required(foe.battleArea.pop(),'opposing second Cookie');foe.deck.push(displaced.card,...displaced.hpCards)
   foe.battleArea.push(battle('ST8-005','player-two'))
  }
 }
 if(scenario==='item-support'){
  const item=required(own.hand.shift(),'unactivated hand Item');own.supportArea.push({card:item,rested:false})
 }
 if(scenario==='opponent-item'){
  foe.hand.push(card('ST1-016','player-two'));foe.deck.push(...foe.supportArea.map(s=>s.card))
  foe.supportArea=['ST1-018','ST1-018'].map(id=>({card:card(id,'player-two'),rested:false}));state.activePlayerId='player-two'
 }
 if(['then-no-green','then-wrong-color'].includes(scenario)){
  own.deck.push(required(own.supportArea.pop(),'Then G').card)
  if(scenario==='then-wrong-color')own.supportArea.push({card:card('ST2-020','player-one'),rested:false})
 }
 if(scenario==='then-rested')required(own.supportArea[2],'Then G').rested=true
 if(scenario==='rested-source'||scenario==='attack-rested-source')own.battleArea[0].rested=true
 if(scenario==='wind-rested')required(own.battleArea[1],'Wind').rested=true
 if(scenario==='wrong-phase'||scenario==='attack-wrong-phase')state.phase='support'
 if(scenario==='wrong-turn'||scenario==='damaged-wind')state.activePlayerId='player-two'
 if(attack){
  own.supportArea.push({card:card('ST3-020','player-one'),rested:false})
  if(scenario==='attack-no-green')for(const support of own.supportArea)if(support.card.energyColor==='green')support.rested=true
 }
 for(const owner of ['player-one','player-two'] as const){
  const player=state.players[owner],used=st8012Zones(state,owner).length
  player.deck.push(...filler(60-used,owner))
 }
 if(scenario==='last-deck')own.discardPile.push(...own.deck.splice(1))
 if(scenario==='play'){
  const source=required(own.battleArea.shift(),'Windcatcher');own.hand.unshift(source.card);own.deck.push(...source.hpCards)
 }
 if(prepareOnly||attack||scenario==='play')return state
 const playItem=(s:GameState,owner:PlayerId)=>{
  const player=s.players[owner],item=required(player.hand.find(c=>c.id==='ST1-016'),'real Icky Sticky Jelly')
  const red=player.supportArea.filter(c=>!c.rested&&c.card.energyColor==='red').slice(0,2)
  if(red.length!==2)throw Error('Real RR payment required')
  return applyGameCommand(s,{kind:'play-item',playerId:owner,instanceId:item.instanceId,paymentIds:red.map(c=>c.card.instanceId),effectTargets:[[]]})
 }
 if(scenario==='opponent-item')return playItem(state,'player-two')
 // Wrong timing/REST and no-history cases leave their true prepared resources untouched.
 if(['no-item','item-support','wrong-phase','wrong-turn','rested-source'].includes(scenario))return state
 if(scenario==='damaged-wind'){
  state=applyGameCommand(state,{kind:'declare-attack',playerId:'player-two',attackerInstanceId:foe.battleArea[0].card.instanceId,targetInstanceId:required(own.battleArea[1],'Wind').card.instanceId,supportPaymentIds:foe.supportArea.map(s=>s.card.instanceId)})
  state=applyGameCommand(state,{kind:'skip-trap',playerId:'player-one'})
  state=applyGameCommand(state,{kind:'resolve-battle',playerId:'player-two'})
  for(let i=0;i<20&&!(state.activePlayerId==='player-one'&&state.phase==='main');i++)state=applyGameCommand(state,{kind:'advance-phase',playerId:state.activePlayerId})
  if(state.activePlayerId!=='player-one'||state.phase!=='main')throw Error('Actual opposing damage parent must reach own Main')
 }
 state=playItem(state,'player-one')
 if(scenario==='previous-item'){
  for(let i=0;i<30&&!(state.turnNumber>=5&&state.activePlayerId==='player-one'&&state.phase==='main');i++)state=applyGameCommand(state,{kind:'advance-phase',playerId:state.activePlayerId})
  if(state.turnNumber<5||state.activePlayerId!=='player-one'||state.phase!=='main')throw Error('Actual previous-turn Item must reach new own Main')
 }
 return state
}

export const st8012Zones=(state:GameState,owner:PlayerId):GameCard[]=>{
 const p=state.players[owner]
 return [...p.deck,...p.hand,...p.discardPile,...p.breakArea,...p.supportArea.map(s=>s.card),...p.battleArea.flatMap(c=>[c.card,...c.hpCards])]
}
