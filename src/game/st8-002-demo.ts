import document from '../../data/candidates/st6-st10/official-st8.en.json'
import type {OfficialCardRecord} from '../cards/types'
import {getAllCardPoolEntries,getCardPoolEntry,hasFlipAbility} from './card-pool'
import {createCard,createOfficialRedStarterDeck} from './starter-deck'
import {createGame} from './setup'
import {applyGameCommand} from './commands'
import type {CookieInBattle,GameCard,GameState,PlayerId} from './types'

export const raw=(getCardPoolEntry('ST8-002')??(document.cards as OfficialCardRecord[]).find(c=>c.cardNumber==='ST8-002')) as OfficialCardRecord
if(!raw)throw Error('Original ST8-002 required')
export const zones=(state:GameState,id:PlayerId):GameCard[]=>{
 const p=state.players[id],revealed=state.pendingBattle?.defenderPlayerId===id?state.pendingBattle.revealedHpCard:null
 return [...p.deck,...p.hand,...p.discardPile,...p.breakArea,...p.supportArea.map(s=>s.card),...p.battleArea.flatMap(c=>[c.card,...c.hpCards,...(c.equippedCards??[])]),...(p.stage?[p.stage.card]:[]),...(revealed?[revealed]:[])]
}
/** Original cards and real attack commands; isolated candidate routing until accepted. */
export const fixture=(scenario='positive'):GameState=>{
 if(scenario.startsWith('ai-'))return JSON.parse(JSON.stringify(fixture(scenario.slice(3))).replaceAll('player-one','player-swap').replaceAll('player-two','player-one').replaceAll('player-swap','player-two')) as GameState
 const counts=new Map<string,number>()
 const card=(number:string,owner:PlayerId):GameCard=>{
  const key=owner+':'+number,copy=(counts.get(key)??0)+1
  if(copy>4)throw Error('Original four-copy limit')
  counts.set(key,copy)
  const record=number==='ST8-002'?raw:getCardPoolEntry(number)
  if(!record)throw Error('Original card required: '+number)
  return createCard(record,owner,copy)
 }
 const filler=(count:number,owner:PlayerId)=>{
  const cards:GameCard[]=[]
  if(count===0)return cards
  for(const record of getAllCardPoolEntries()){
   if(record.variant||record.type==='extra'||hasFlipAbility(record)||(counts.get(owner+':'+record.baseCardNumber)??0)>=4)continue
   cards.push(card(record.baseCardNumber,owner));if(cards.length===count)return cards
  }
  throw Error('Insufficient original cards')
 }
 const battle=(number:string,owner:PlayerId):CookieInBattle=>{
  const source=card(number,owner);if(source.type!=='cookie')throw Error('Cookie required')
  return {card:source,hpCards:filler(source.hp,owner),rested:false,battleEntryId:source.instanceId+':entry'}
 }
 let state=createGame({id:'player-one',name:'ST8-002 實體驗收',deck:createOfficialRedStarterDeck('player-one')},{id:'player-two',name:'實體對手',deck:createOfficialRedStarterDeck('player-two')},'player-one',cards=>cards)
 state.status='playing';state.phase='main';state.turnNumber=3
 for(const p of Object.values(state.players)){p.deck=[];p.hand=[];p.supportArea=[];p.breakArea=[];p.discardPile=[];p.battleArea=[];p.stage=null;p.startingCookieSelected=true}
 const own=state.players['player-one'],foe=state.players['player-two']
 const attack=['attack','attack-negative','wrong-color','wrong-phase','rested-source','first-turn','play'].includes(scenario)
 own.battleArea=[battle(attack?'ST8-002':'ST1-005','player-one'),battle('ST1-011','player-one')]
 foe.battleArea=[battle(attack?'BS12-059':'ST6-003','player-two')]
 if(attack){
  own.supportArea=['ST3-016','ST3-019',scenario==='wrong-color'?'ST2-020':'ST3-020'].map((number,index)=>({card:card(number,'player-one'),rested:scenario==='attack-negative'&&index===2}))
  if(scenario==='wrong-phase')state.phase='support'
  if(scenario==='rested-source')own.battleArea[0].rested=true
  if(scenario==='first-turn')state.turnNumber=1
  if(scenario==='play'){const source=own.battleArea.shift()!;own.hand.push(source.card);own.deck.push(...source.hpCards)}
 }else{
  const position=scenario==='low'?0:own.battleArea[0].hpCards.length-1
  own.deck.push(own.battleArea[0].hpCards[position]);own.battleArea[0].hpCards[position]=card('ST8-002','player-one')
  foe.supportArea=['ST1-018','ST2-020','ST3-016'].map(number=>({card:card(number,'player-two'),rested:false}))
  state.activePlayerId='player-two'
 }
 for(const id of ['player-one','player-two'] as const){state.players[id].deck.push(...filler(60-zones(state,id).length,id))}
 if(!attack){
  state=applyGameCommand(state,{kind:'declare-attack',playerId:'player-two',attackerInstanceId:foe.battleArea[0].card.instanceId,targetInstanceId:own.battleArea[0].card.instanceId,supportPaymentIds:foe.supportArea.map(s=>s.card.instanceId)})
  state=applyGameCommand(state,{kind:'skip-trap',playerId:'player-one'})
  for(let i=0;i<(scenario==='low'?3:1);i++)state=applyGameCommand(state,{kind:'resolve-next-damage',playerId:'player-one'})
 }
 for(const id of ['player-one','player-two'] as const){const cards=zones(state,id);if(cards.length!==60||new Set(cards.map(c=>c.instanceId)).size!==60)throw Error('Original sixty-card identities');for(const c of cards)if(cards.filter(x=>x.id===c.id).length>4)throw Error('Four-copy limit')}
 return state
}
