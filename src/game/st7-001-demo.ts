import {applyGameCommand} from './commands'
import {getAllCardPoolEntries,getCardPoolEntry,hasFlipAbility} from './card-pool'
import {createCard,createOfficialRedStarterDeck} from './starter-deck'
import {createGame} from './setup'
import type {GameCard,PlayerId,CookieInBattle} from './types'
const original=getCardPoolEntry('ST7-001')
if(!original)throw Error('Missing formal original ST7-001')
export const raw=original
export const createSt7001PreviewState=(scenario='positive')=>{
 const counts=new Map<string,number>()
 const card=(id:string,owner:PlayerId):GameCard=>{const key=owner+':'+id,n=(counts.get(key)??0)+1;if(n>4)throw Error('copy limit');counts.set(key,n);const record=id==='ST7-001'?raw:getCardPoolEntry(id);if(!record)throw Error(id);return createCard(record,owner,n)}
 const filler=(count:number,owner:PlayerId)=>{const cards:GameCard[]=[];if(!count)return cards;for(const r of getAllCardPoolEntries()){if(r.variant||r.type==='extra'||hasFlipAbility(r)||(counts.get(owner+':'+r.baseCardNumber)??0)>=4)continue;cards.push(card(r.baseCardNumber,owner));if(cards.length===count)return cards}throw Error('fill')}
 const battle=(id:string,owner:PlayerId):CookieInBattle=>{const c=card(id,owner);if(c.type!=='cookie')throw Error(id);return{card:c,rested:false,hpCards:filler(c.hp,owner),battleEntryId:c.instanceId+':entry'}}
 const s=createGame({id:'player-one',name:'ST7-001準備局面',deck:createOfficialRedStarterDeck('player-one')},{id:'player-two',name:'目標',deck:createOfficialRedStarterDeck('player-two')},'player-one',cards=>cards)
 s.phase='main';s.status='playing';s.turnNumber=5
 for(const p of Object.values(s.players)){p.deck=[];p.hand=[];p.battleArea=[];p.supportArea=[];p.breakArea=[];p.discardPile=[];p.stage=null;p.extraDeck=[];p.startingCookieSelected=true}
 const own=s.players['player-one'],foe=s.players['player-two'];own.battleArea=[battle('ST7-001','player-one')];own.hand=['ST1-001','ST6-002','BS7-056','ST1-018'].map(id=>card(id,'player-one'));own.supportArea=['ST2-020','ST2-019','ST2-018','ST1-019'].map(id=>({card:card(id,'player-one'),rested:false}));foe.battleArea=[battle('ST6-002','player-two'),battle('ST6-012','player-two')];
 for(const owner of ['player-one','player-two'] as const){const p=s.players[owner],used=p.hand.length+p.supportArea.length+p.battleArea.reduce((n,c)=>n+1+c.hpCards.length,0);p.deck=filler(60-used,owner)}
 if(scenario==='rested-source')own.battleArea[0].rested=true
 if(scenario==='rested-target')foe.battleArea.forEach(c=>c.rested=true)
 if(scenario==='negative')own.supportArea.forEach(c=>c.rested=true)
 if(scenario==='wrong-color')own.supportArea.forEach(c=>{if(c.card.energyColor==='yellow')c.rested=true})
 if(scenario==='attack-wrong-color')own.supportArea[2].rested=true
 if(scenario==='wrong-phase')s.phase='support'
 if(scenario==='no-cost'){own.discardPile.push(...own.hand.filter(c=>c.type==='cookie'));own.hand=own.hand.filter(c=>c.type!=='cookie')}
 if(scenario==='no-target'){for(const c of foe.battleArea)foe.discardPile.push(c.card,...c.hpCards);foe.battleArea=[]}
 if(scenario==='break-loss'){
  const choices=new Map<number,string[]>([[0,[]]])
  for(const c of own.deck){if(c.type!=='cookie')continue;for(const [sum,ids]of [...choices])if(sum+c.level<=7&&!choices.has(sum+c.level))choices.set(sum+c.level,[...ids,c.instanceId]);if(choices.has(7))break}
  const ids=choices.get(7);if(!ids)throw Error('Missing original Break resources');const chosen=new Set(ids)
  for(const c of own.deck.filter(c=>chosen.has(c.instanceId))){if(c.type!=='cookie')throw Error('Cookie only');own.breakArea.push(c)}own.deck=own.deck.filter(c=>!chosen.has(c.instanceId))
 }
 if(scenario==='used')return applyGameCommand(s,{kind:'activate-skill',playerId:'player-one',sourceInstanceId:own.battleArea[0].card.instanceId,trigger:'activate',paymentIds:[own.supportArea[0].card.instanceId],handToBreakAreaIds:[own.hand[0].instanceId],effectTargets:[[]]})
 return s
}
