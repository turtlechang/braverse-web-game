import {getAllCardPoolEntries,getCardPoolEntry,hasFlipAbility} from './card-pool'
import {createCard,createOfficialRedStarterDeck} from './starter-deck'
import {createGame} from './setup'
import {applyGameCommand as apply} from './commands'
import type {GameCard,PlayerId,CookieInBattle,GameState} from './types'
const raw=getCardPoolEntry('ST7-008')
if(!raw)throw Error('Formal original required')
const fixture=(witness='break',lethal=false,boundary='')=>{
 const counts=new Map<string,number>()
 const card=(number:string,owner:PlayerId):GameCard=>{
  const record=number==='ST7-008'?raw:getCardPoolEntry(number);if(!record)throw Error('Original '+number)
  const key=owner+':'+number,copy=(counts.get(key)??0)+1;if(copy>4)throw Error('Four-copy limit')
  counts.set(key,copy);return createCard(record,owner,copy)
 }
 const filler=(amount:number,owner:PlayerId)=>{
  const result:GameCard[]=[]
  for(const record of getAllCardPoolEntries()){
   if(record.variant||record.type==='extra'||hasFlipAbility(record))continue
   while((counts.get(owner+':'+record.baseCardNumber)??0)<4&&result.length<amount)result.push(card(record.baseCardNumber,owner))
   if(result.length===amount)return result
  }
  throw Error('Original filler insufficient')
 }
 const battle=(number:string,owner:PlayerId):CookieInBattle=>{
  const cookie=card(number,owner);if(cookie.type!=='cookie')throw Error('Original Cookie')
  return {card:cookie,hpCards:filler(cookie.hp,owner),rested:false,battleEntryId:cookie.instanceId+':entry'}
 }
 const state=createGame({id:'player-one',name:'Original Elder',deck:createOfficialRedStarterDeck('player-one')},{id:'player-two',name:'Original opponent',deck:createOfficialRedStarterDeck('player-two')},'player-one',cards=>cards)
 state.status='playing';state.phase='main';state.turnNumber=3
 for(const p of Object.values(state.players)){p.deck=[];p.hand=[];p.discardPile=[];p.breakArea=[];p.supportArea=[];p.battleArea=[];p.extraDeck=[];p.stage=null;p.startingCookieSelected=true}
 const own=state.players['player-one'],foe=state.players['player-two']
 own.hand=[card('ST7-008','player-one')];own.battleArea=[battle('ST1-011','player-one')]
 own.supportArea=['ST2-018','ST2-019','ST2-020'].map(number=>({card:card(number,'player-one'),rested:false}))
 const low=card('ST7-004','player-one');if(low.type!=='cookie')throw Error('Original yellow LV1')
 own.breakArea=[low]
 if(witness==='break'){const tree=card('BS4-038','player-one');if(tree.type!=='cookie')throw Error('Tree');own.breakArea.push(tree)}
 if(witness==='battle')own.battleArea=[battle('BS4-038','player-one')]
 if(witness==='wrong-name'){const other=card('ST7-003','player-one');if(other.type!=='cookie')throw Error('Other');own.breakArea.push(other)}
 if(witness==='opponent')foe.battleArea.push(battle('BS4-038','player-two'))
 if(witness==='hand')own.hand.push(card('BS4-038','player-one'))
 if(witness==='trash')own.discardPile.push(card('BS4-038','player-one'))
 if(witness==='support')own.supportArea.push({card:card('BS4-038','player-one'),rested:false})
 foe.battleArea.unshift(battle(boundary==='faint'?'BS6-017':'ST6-006','player-two'))
 if(!lethal&&witness!=='opponent')foe.battleArea.push(battle('ST1-011','player-two'))
 if(boundary==='departed-flip'){
  foe.supportArea=['ST1-018','ST1-019','ST1-020'].map(number=>({card:card(number,'player-two'),rested:false}))
  const old=foe.battleArea[0].hpCards.pop();if(!old)throw Error('Original HP');foe.discardPile.push(old)
  foe.battleArea[0].hpCards.push(card('BS1-002','player-two'));foe.hand.push(card('ST1-020','player-two'))
 }
 if(lethal)for(let i=0;i<3;i++){const cookie=card('ST7-003','player-two');if(cookie.type!=='cookie')throw Error('LV3');foe.breakArea.push(cookie)}
 for(const owner of ['player-one','player-two'] as const){const p=state.players[owner],used=p.hand.length+p.discardPile.length+p.breakArea.length+p.supportArea.length+p.battleArea.reduce((sum,c)=>sum+1+c.hpCards.length,0);p.deck=filler(60-used,owner)}
 if(boundary==='refresh')own.discardPile.push(...own.deck.splice(3))
 return {state,source:own.hand[0].instanceId,low:low.instanceId,target:foe.battleArea[0].card.instanceId}
}
const deploy=(f:ReturnType<typeof fixture>)=>apply(f.state,{kind:'deploy-cookie',playerId:'player-one',instanceId:f.source})
const recovery=(state:GameState,source:string,targets:string[])=>apply(apply(state,{kind:'begin-activate-skill',playerId:'player-one',sourceInstanceId:source,trigger:'on-play',paymentIds:[]}),{kind:'resolve-ability-effect',playerId:'player-one',targetIds:targets})
export const createSt7008PreviewState=(scenario='positive',prepareOnly=false):GameState=>{
 const witness=['wrong-name','opponent','none','battle','hand','trash','support'].includes(scenario)?scenario:'break'
 const setup=fixture(witness,scenario==='lethal'||scenario==='attack-lethal'||scenario==='ai-lethal',scenario==='refresh'?'refresh':scenario==='attack-faint'?'faint':scenario==='attack-departed-flip'?'departed-flip':''),state=setup.state
 state.players['player-one'].name='ST7-008逐卡驗收'
 if(scenario==='wrong-phase')state.phase='support'
 if(scenario==='rested-energy'||scenario==='attack-rested-energy')state.players['player-one'].supportArea.forEach(s=>{s.rested=true})
 if(scenario==='attack-few-energy')state.players['player-one'].supportArea[2].rested=true
 if(scenario==='wrong-energy'||scenario==='attack-wrong-energy'){
  const support=state.players['player-one'].supportArea[0],record=getCardPoolEntry('ST1-020');if(!record)throw Error('Original red support')
  const red=createCard(record,'player-one',4);if(state.players['player-one'].deck.some(c=>c.instanceId===red.instanceId))throw Error('Original copy collision')
  support.card=red
 }
 if(scenario.startsWith('attack-')){
  if(prepareOnly)return state
  let ready=deploy(setup)
  ready=scenario==='attack-break3'?recovery(ready,setup.source,[setup.low]):apply(ready,{kind:'skip-on-play',playerId:'player-one',sourceInstanceId:setup.source})
  if(scenario==='attack-departed-flip'){
   for(let i=0;!(ready.activePlayerId==='player-two'&&ready.phase==='main')&&i<12;i++)ready=apply(ready,{kind:'advance-phase',playerId:ready.activePlayerId})
   ready=apply(ready,{kind:'declare-attack',playerId:'player-two',attackerInstanceId:setup.target,targetInstanceId:setup.source,supportPaymentIds:ready.players['player-two'].supportArea.map(s=>s.card.instanceId)})
   ready=apply(apply(ready,{kind:'skip-trap',playerId:'player-one'}),{kind:'resolve-battle',playerId:'player-two'})
   for(let i=0;!(ready.activePlayerId==='player-one'&&ready.phase==='main')&&i<12;i++)ready=apply(ready,{kind:'advance-phase',playerId:ready.activePlayerId})
  }
  if(scenario==='attack-rested-source')ready.players['player-one'].battleArea.find(c=>c.card.instanceId===setup.source)!.rested=true
  if(scenario==='attack-wrong-phase')ready.phase='support'
  return ready
 }
 if(scenario.startsWith('ai-')){
  const swapped=JSON.parse(JSON.stringify(state).replaceAll('player-one','player-swap').replaceAll('player-two','player-one').replaceAll('player-swap','player-two')) as GameState
  return prepareOnly?swapped:apply(swapped,{kind:'deploy-cookie',playerId:'player-two',instanceId:setup.source.replace('player-one','player-two')})
 }
 return state
}
