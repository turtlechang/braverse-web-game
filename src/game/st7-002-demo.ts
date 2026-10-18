import {applyGameCommand} from './commands'
import {getAllCardPoolEntries,getCardPoolEntry,hasFlipAbility} from './card-pool'
import {createCard,createOfficialRedStarterDeck} from './starter-deck'
import {createGame} from './setup'
import type {CookieInBattle,GameCard,PlayerId} from './types'
const original=getCardPoolEntry('ST7-002')
if(!original)throw Error('Missing formal original ST7-002')
export const raw=original
export const prepare=(breakLevel=2,sourceId='ST7-002',withSupports=true,extraHandCount=0)=>{
 const counts=new Map<string,number>()
 const card=(id:string,owner:PlayerId):GameCard=>{
  const key=owner+':'+id,n=(counts.get(key)??0)+1
  if(n>4)throw Error('copy limit '+key)
  counts.set(key,n)
  const printed=id==='ST7-002'?raw:getCardPoolEntry(id)
  if(!printed)throw Error('missing '+id)
  return createCard(printed,owner,n)
 }
 const fill=(count:number,owner:PlayerId)=>{
  const out:GameCard[]=[]
  if(count===0)return out
  for(const record of getAllCardPoolEntries()){
   if(record.variant||record.type==='extra'||hasFlipAbility(record)||(counts.get(owner+':'+record.baseCardNumber)??0)>=4)continue
   out.push(card(record.baseCardNumber,owner))
   if(out.length===count)return out
  }
  throw Error('original fillers')
 }
 const battle=(id:string,owner:PlayerId):CookieInBattle=>{
  const c=card(id,owner)
  if(c.type!=='cookie')throw Error('Cookie')
  return {card:c,rested:false,hpCards:fill(c.hp,owner),battleEntryId:c.instanceId+':entry'}
 }
 const s=createGame({id:'player-one',name:'ST7-002 physical preparation',deck:createOfficialRedStarterDeck('player-one')},{id:'player-two',name:'Original reference',deck:createOfficialRedStarterDeck('player-two')},'player-one',cards=>cards)
 s.phase='main';s.status='playing';s.turnNumber=5
 for(const p of Object.values(s.players)){p.deck=[];p.hand=[];p.battleArea=[];p.supportArea=[];p.breakArea=[];p.discardPile=[];p.stage=null;p.extraDeck=[];p.startingCookieSelected=true}
 const own=s.players['player-one'],foe=s.players['player-two']
 own.battleArea=[battle('ST6-002','player-one')]
 own.battleArea[0].rested=true
 own.hand=[card(sourceId,'player-one'),...fill(extraHandCount,'player-one')]
 if(withSupports)own.supportArea=['ST2-020','ST2-019',sourceId==='BS6-078'?'ST9-016':'ST1-019'].map(id=>({card:card(id,'player-one'),rested:false}))
 for(let remaining=breakLevel;remaining>0;){
  const id=remaining>=3?'ST6-002':'ST6-012',c=card(id,'player-one')
  if(c.type!=='cookie')throw Error('Break Cookie')
  own.breakArea.push(c);remaining-=c.level
 }
 foe.battleArea=[battle('ST6-012','player-two')]
 for(const owner of ['player-one','player-two'] as const){
  const p=s.players[owner],used=p.hand.length+p.breakArea.length+p.supportArea.length+p.battleArea.reduce((n,c)=>n+1+c.hpCards.length,0)
  p.deck=fill(60-used,owner)
 }
 return s
}
export const fixture=(breakLevel=2,sourceId='ST7-002',withSupports=true,extraHandCount=0)=>{
 const s=prepare(breakLevel,sourceId,withSupports,extraHandCount)
 return applyGameCommand(s,{kind:'deploy-cookie',playerId:'player-one',instanceId:s.players['player-one'].hand[0].instanceId})
}

export const createSt7002PreviewState=(scenario='positive')=>{
 const coffee=scenario.startsWith('coffee-'),choux=scenario.startsWith('choux-')
 const id=coffee?'BS6-078':choux?'BS4-033':'ST7-002'
 const threshold=choux?5:2
 const level=coffee?0:scenario.endsWith('-below')?threshold-1:scenario.endsWith('-above')?threshold+1:threshold
 const hand=coffee?(scenario.endsWith('-above')?6:scenario.endsWith('-below')?4:5):0
 const s=fixture(level,id,scenario!=='no-supports',hand)
 if(scenario.endsWith('-rested'))s.players['player-one'].battleArea.find(c=>c.card.id===id)!.rested=true
 if(scenario.endsWith('-no-energy'))s.players['player-one'].supportArea.forEach(c=>c.rested=true)
 if(scenario==='mango-attack-wrong-color')s.players['player-one'].supportArea.forEach(c=>{if(c.card.energyColor==='yellow')c.rested=true})
 return s
}
